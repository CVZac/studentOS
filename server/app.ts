import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeUsername, usernameKey, validatePassword, validateUsername } from '../src/core/auth';
import { validateDataset } from '../src/core/dataset';
import type { Store, UserRow } from './db';
import { HttpError, parseCookies, readJson, sendJson, serializeCookie, setCommonHeaders, str } from './http';
import { DEFAULT_SCRYPT, hashPassword, verifyPassword } from './password';
import type { ScryptParams } from './password';
import { FailureLimiter, WindowLimiter } from './rateLimit';
import { serveStatic } from './static';

export interface AppOptions {
  store: Store;
  /** 前端构建目录；为 null 时只提供 API */
  staticDir?: string | null;
  /** 对外访问地址，如 https://studentos.example.com；https 时启用 Secure cookie 并据此校验来源 */
  publicUrl?: string | null;
  /** 位于反向代理之后时信任 X-Forwarded-For 获取客户端 IP */
  trustProxy?: boolean;
  scrypt?: ScryptParams;
  version?: string;
  commit?: string;
  log?: boolean;
  now?: () => number;
}

const DAY = 86_400_000;
const PERSISTENT_SESSION_MS = 30 * DAY;
const BROWSER_SESSION_MS = DAY;
const LIMITS = { auth: 16 * 1024, dataset: 8 * 1024 * 1024, todos: 1024 * 1024 };
const WRONG_CREDENTIALS = '用户名或密码错误';

const publicAccount = (u: UserRow) => ({ id: u.id, username: u.username, createdAt: u.created_at });
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** 待办状态的结构校验：{ done: {学生: [待办 id]}, custom: {学生: [自定义待办]} } */
function validTodos(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const { done, custom } = value as Record<string, unknown>;
  const isRecordOf = (v: unknown, item: (x: unknown) => boolean) =>
    typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((list) => Array.isArray(list) && list.every(item));
  return (
    isRecordOf(done, (x) => typeof x === 'string') &&
    isRecordOf(custom, (x) => {
      const t = x as Record<string, unknown>;
      return typeof t === 'object' && t !== null && typeof t.id === 'string' && typeof t.title === 'string' && ['P0', 'P1', 'P2'].includes(t.priority as string);
    })
  );
}

export function createApp(options: AppOptions) {
  const { store } = options;
  const now = options.now ?? Date.now;
  const scryptParams = options.scrypt ?? DEFAULT_SCRYPT;
  const publicOrigin = options.publicUrl ? new URL(options.publicUrl).origin : null;
  const secure = publicOrigin?.startsWith('https:') ?? false;
  const cookieName = secure ? '__Host-sos_session' : 'sos_session';

  const loginFailures = new FailureLimiter(5, 30_000, now);
  const authByIp = new WindowLimiter(30, 10 * 60_000, now);
  // 用户不存在时也做一次等价的哈希比较，避免通过响应时间探测用户名
  const dummyHash = hashPassword(randomUUID(), scryptParams);

  const purgeTimer = setInterval(() => store.purgeSessions(now()), 60 * 60_000);
  purgeTimer.unref();

  function clientIp(req: IncomingMessage): string {
    if (options.trustProxy) {
      const forwarded = String(req.headers['x-forwarded-for'] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // 取最右侧，即最近一跳代理写入的地址
      if (forwarded.length) return forwarded[forwarded.length - 1];
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  function checkOrigin(req: IncomingMessage) {
    const origin = req.headers.origin;
    if (!origin) return;
    // 未配置 PUBLIC_URL 时按访问的主机名校验；位于反向代理之后时以代理转发的主机名为准
    const forwardedHost = options.trustProxy ? String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim() : '';
    const host = forwardedHost || req.headers.host || '';
    const allowed = publicOrigin ? [publicOrigin] : [`http://${host}`, `https://${host}`];
    if (!allowed.includes(origin)) throw new HttpError(403, '请求来源不被允许');
  }

  function startSession(res: ServerResponse, userId: string, remember: boolean) {
    const token = randomBytes(32).toString('base64url');
    const at = now();
    store.createSession(hashToken(token), userId, at, at + (remember ? PERSISTENT_SESSION_MS : BROWSER_SESSION_MS), remember);
    res.setHeader(
      'Set-Cookie',
      serializeCookie(cookieName, token, { secure, maxAgeSeconds: remember ? PERSISTENT_SESSION_MS / 1000 : undefined }),
    );
  }

  function clearCookie(res: ServerResponse) {
    res.setHeader('Set-Cookie', serializeCookie(cookieName, '', { secure, expire: true }));
  }

  function currentSession(req: IncomingMessage) {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (!token) return null;
    const tokenHash = hashToken(token);
    const user = store.sessionUser(tokenHash, now());
    return user ? { user, tokenHash } : null;
  }

  function requireSession(req: IncomingMessage) {
    const session = currentSession(req);
    if (!session) throw new HttpError(401, '登录已失效，请重新登录');
    return session;
  }

  function limitAuth(req: IncomingMessage) {
    if (!authByIp.hit(clientIp(req))) throw new HttpError(429, '请求过于频繁，请稍后再试');
  }

  type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

  const routes: Record<string, Handler> = {
    'GET /api/health': (_req, res) => {
      let db = 'ok';
      try {
        store.ping();
      } catch {
        db = 'error';
      }
      sendJson(res, db === 'ok' ? 200 : 503, {
        status: db === 'ok' ? 'ok' : 'degraded',
        db,
        version: options.version ?? 'dev',
        commit: options.commit ?? null,
        time: new Date(now()).toISOString(),
      });
    },

    'POST /api/auth/register': async (req, res) => {
      limitAuth(req);
      const body = await readJson(req, LIMITS.auth);
      const username = str(body.username, 100);
      const password = str(body.password, 200);
      const usernameError = validateUsername(username);
      if (usernameError) throw new HttpError(400, usernameError, 'username');
      const passwordError = validatePassword(password);
      if (passwordError) throw new HttpError(400, passwordError, 'password');
      const key = usernameKey(username);
      if (store.userByKey(key)) throw new HttpError(409, '该用户名已被注册', 'username');

      const user: UserRow = {
        id: randomUUID(),
        username: normalizeUsername(username),
        username_key: key,
        password_hash: await hashPassword(password, scryptParams),
        created_at: new Date(now()).toISOString(),
      };
      try {
        store.createUser(user);
      } catch {
        // 并发注册同名用户时由唯一索引兜底
        throw new HttpError(409, '该用户名已被注册', 'username');
      }
      startSession(res, user.id, body.remember === true);
      sendJson(res, 201, { account: publicAccount(user) });
    },

    'POST /api/auth/login': async (req, res) => {
      limitAuth(req);
      const body = await readJson(req, LIMITS.auth);
      const username = str(body.username, 100);
      const password = str(body.password, 200);
      if (!username.trim() || !password) throw new HttpError(400, '请输入用户名和密码');
      const key = usernameKey(username);
      const wait = loginFailures.remaining(key);
      if (wait > 0) throw new HttpError(429, `尝试次数过多，请 ${Math.ceil(wait / 1000)} 秒后再试`);

      const user = store.userByKey(key);
      const valid = await verifyPassword(password, user?.password_hash ?? (await dummyHash));
      if (!user || !valid) {
        const locked = loginFailures.fail(key);
        throw new HttpError(locked ? 429 : 401, locked ? '尝试次数过多，请 30 秒后再试' : WRONG_CREDENTIALS);
      }
      loginFailures.reset(key);
      startSession(res, user.id, body.remember === true);
      sendJson(res, 200, { account: publicAccount(user) });
    },

    'POST /api/auth/logout': (req, res) => {
      const session = currentSession(req);
      if (session) store.deleteSession(session.tokenHash);
      clearCookie(res);
      sendJson(res, 204);
    },

    // 未登录时返回 account: null 而不是 401，便于前端启动时静默判断登录状态
    'GET /api/auth/me': (req, res) => {
      const session = currentSession(req);
      sendJson(res, 200, { account: session ? publicAccount(session.user) : null });
    },

    'POST /api/auth/password': async (req, res) => {
      const { user, tokenHash } = requireSession(req);
      const body = await readJson(req, LIMITS.auth);
      const current = str(body.current, 200);
      const next = str(body.next, 200);
      if (!(await verifyPassword(current, user.password_hash))) throw new HttpError(400, '当前密码不正确', 'current');
      if (current === next) throw new HttpError(400, '新密码不能与当前密码相同', 'password');
      const error = validatePassword(next);
      if (error) throw new HttpError(400, error, 'password');
      store.updatePassword(user.id, await hashPassword(next, scryptParams));
      // 改密后让其他设备上的登录失效，保留当前会话
      store.deleteOtherSessions(user.id, tokenHash);
      sendJson(res, 204);
    },

    'DELETE /api/auth/account': async (req, res) => {
      const { user } = requireSession(req);
      const body = await readJson(req, LIMITS.auth);
      if (!(await verifyPassword(str(body.password, 200), user.password_hash))) {
        throw new HttpError(400, '密码不正确', 'current');
      }
      store.deleteUser(user.id);
      clearCookie(res);
      sendJson(res, 204);
    },

    'GET /api/workspace': (req, res) => {
      const { user } = requireSession(req);
      const row = store.workspace(user.id);
      if (!row) throw new HttpError(404, '工作区不存在');
      sendJson(res, 200, {
        dataset: row.dataset ? JSON.parse(row.dataset) : null,
        studentId: row.student_id,
        todos: JSON.parse(row.todos),
        updatedAt: row.updated_at,
      });
    },

    'PUT /api/workspace/dataset': async (req, res) => {
      const { user } = requireSession(req);
      const body = await readJson(req, LIMITS.dataset);
      if (body.dataset === null) {
        store.setDataset(user.id, null);
        return sendJson(res, 204);
      }
      const result = validateDataset(body.dataset);
      if (!result.ok) throw new HttpError(400, '数据校验失败', undefined, result.errors);
      store.setDataset(user.id, JSON.stringify(result.dataset));
      sendJson(res, 204);
    },

    'PUT /api/workspace/student': async (req, res) => {
      const { user } = requireSession(req);
      const body = await readJson(req, LIMITS.auth);
      if (typeof body.studentId !== 'string' || body.studentId.length > 64) throw new HttpError(400, '学生 id 无效');
      store.setStudent(user.id, body.studentId);
      sendJson(res, 204);
    },

    'PUT /api/workspace/todos': async (req, res) => {
      const { user } = requireSession(req);
      const body = await readJson(req, LIMITS.todos);
      if (!validTodos(body.todos)) throw new HttpError(400, '待办数据格式无效');
      store.setTodos(user.id, JSON.stringify(body.todos));
      sendJson(res, 204);
    },
  };

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const started = performance.now();
    setCommonHeaders(res);
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (options.log !== false) {
      res.once('finish', () =>
        console.log(`${req.method} ${pathname} ${res.statusCode} ${Math.round(performance.now() - started)}ms`),
      );
    }
    try {
      if (pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') checkOrigin(req);
        const route = routes[`${req.method} ${pathname}`];
        if (!route) throw new HttpError(404, '接口不存在');
        await route(req, res);
      } else if (!options.staticDir || !(await serveStatic(req, res, options.staticDir, pathname))) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      }
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, field: err.field, details: err.details });
      } else {
        console.error(err);
        if (!res.headersSent) sendJson(res, 500, { error: '服务器内部错误，请稍后重试' });
        else res.end();
      }
    }
  }

  return {
    handle: (req: IncomingMessage, res: ServerResponse) => void handle(req, res),
    close: () => clearInterval(purgeTimer),
  };
}
