import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createAccount, findAccount, rehashAccount, toPublic, usernameKey, verifyPassword } from '../core/auth';
import type { AccountRecord, AuthResult, PublicAccount } from '../core/auth';
import {
  KEYS,
  LEGACY_WORKSPACE,
  moveKey,
  readJSON,
  removeKeys,
  storageAvailable,
  workspaceKeys,
  writeJSON,
} from './storage';

interface Session {
  accountId: string;
  /** 毫秒时间戳；仅「保持登录」的会话有过期时间 */
  expiresAt: number | null;
}

interface AuthValue {
  account: PublicAccount | null;
  hasAccounts: boolean;
  /** false 表示浏览器禁止本地存储，账号只在本次打开期间有效 */
  persistent: boolean;
  register(username: string, password: string, remember: boolean): Promise<AuthResult>;
  login(username: string, password: string, remember: boolean): Promise<AuthResult>;
  logout(): void;
  changePassword(current: string, next: string): Promise<AuthResult>;
  deleteAccount(password: string): Promise<AuthResult>;
}

const SESSION_DAYS = 30;
const MAX_FAILURES = 5;
const LOCK_MS = 30_000;
const WRONG_CREDENTIALS = '用户名或密码错误';

const AuthContext = createContext<AuthValue | null>(null);

/** 先读「保持登录」的长期会话，再读仅限当前标签页的会话 */
function restoreSession(accounts: readonly AccountRecord[]): Session | null {
  const candidates = [readJSON<Session | null>(KEYS.session, null), readJSON<Session | null>(KEYS.session, null, 'session')];
  for (const s of candidates) {
    if (!s || typeof s.accountId !== 'string') continue;
    if (s.expiresAt !== null && s.expiresAt < Date.now()) continue;
    if (accounts.some((a) => a.id === s.accountId)) return s;
  }
  return null;
}

function clearSessions() {
  writeJSON(KEYS.session, undefined);
  writeJSON(KEYS.session, undefined, 'session');
}

const loadAccounts = () => {
  const list = readJSON<AccountRecord[]>(KEYS.accounts, []);
  return Array.isArray(list) ? list : [];
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountRecord[]>(loadAccounts);
  const [session, setSession] = useState<Session | null>(() => restoreSession(loadAccounts()));
  const [persistent] = useState(storageAvailable);
  // 异步派生期间用 ref 读取最新账号列表，避免闭包里的旧值覆盖并发修改
  const accountsRef = useRef(accounts);
  const failures = useRef(new Map<string, { count: number; lockedUntil: number }>());

  const saveAccounts = useCallback((next: AccountRecord[]) => {
    accountsRef.current = next;
    setAccounts(next);
    writeJSON(KEYS.accounts, next);
  }, []);

  // 其他标签页登录、退出或修改账号时同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEYS.accounts && e.key !== KEYS.session && e.key !== null) return;
      const list = loadAccounts();
      accountsRef.current = list;
      setAccounts(list);
      setSession(restoreSession(list));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const startSession = useCallback((accountId: string, remember: boolean) => {
    clearSessions();
    const next: Session = { accountId, expiresAt: remember ? Date.now() + SESSION_DAYS * 86_400_000 : null };
    writeJSON(KEYS.session, next, remember ? 'local' : 'session');
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    clearSessions();
    setSession(null);
  }, []);

  const register = useCallback<AuthValue['register']>(
    async (username, password, remember) => {
      try {
        const result = await createAccount(accountsRef.current, username, password);
        if (!result.ok) return result;
        // 重新检查，防止派生期间其他标签页注册了同名账号
        if (findAccount(accountsRef.current, username)) return { ok: false, error: '该用户名已被注册', field: 'username' };
        const isFirst = accountsRef.current.length === 0;
        saveAccounts([...accountsRef.current, result.value]);
        if (isFirst) {
          // 登录功能上线前保存的数据归首个账号所有
          const ws = workspaceKeys(result.value.id);
          moveKey(LEGACY_WORKSPACE.dataset, ws.dataset);
          moveKey(LEGACY_WORKSPACE.student, ws.student);
          moveKey(LEGACY_WORKSPACE.todos, ws.todos);
        }
        startSession(result.value.id, remember);
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : '注册失败，请重试' };
      }
    },
    [saveAccounts, startSession],
  );

  const login = useCallback<AuthValue['login']>(
    async (username, password, remember) => {
      const key = usernameKey(username);
      const state = failures.current.get(key);
      const wait = state ? state.lockedUntil - Date.now() : 0;
      if (wait > 0) return { ok: false, error: `尝试次数过多，请 ${Math.ceil(wait / 1000)} 秒后再试` };
      if (!key || !password) return { ok: false, error: '请输入用户名和密码' };

      try {
        const record = findAccount(accountsRef.current, username);
        const valid = record ? await verifyPassword(record, password) : false;
        if (!record || !valid) {
          const count = (state?.count ?? 0) + 1;
          failures.current.set(
            key,
            count >= MAX_FAILURES ? { count: 0, lockedUntil: Date.now() + LOCK_MS } : { count, lockedUntil: 0 },
          );
          return {
            ok: false,
            error: count >= MAX_FAILURES ? `尝试次数过多，请 ${LOCK_MS / 1000} 秒后再试` : WRONG_CREDENTIALS,
          };
        }
        failures.current.delete(key);
        startSession(record.id, remember);
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : '登录失败，请重试' };
      }
    },
    [startSession],
  );

  const current = session ? (accounts.find((a) => a.id === session.accountId) ?? null) : null;

  const changePassword = useCallback<AuthValue['changePassword']>(
    async (currentPassword, nextPassword) => {
      const record = accountsRef.current.find((a) => a.id === session?.accountId);
      if (!record) return { ok: false, error: '登录已失效，请重新登录' };
      try {
        if (!(await verifyPassword(record, currentPassword))) {
          return { ok: false, error: '当前密码不正确', field: 'current' };
        }
        if (currentPassword === nextPassword) return { ok: false, error: '新密码不能与当前密码相同', field: 'password' };
        const result = await rehashAccount(record, nextPassword);
        if (!result.ok) return result;
        saveAccounts(accountsRef.current.map((a) => (a.id === record.id ? result.value : a)));
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : '修改失败，请重试' };
      }
    },
    [session, saveAccounts],
  );

  const deleteAccount = useCallback<AuthValue['deleteAccount']>(
    async (password) => {
      const record = accountsRef.current.find((a) => a.id === session?.accountId);
      if (!record) return { ok: false, error: '登录已失效，请重新登录' };
      try {
        if (!(await verifyPassword(record, password))) return { ok: false, error: '密码不正确', field: 'current' };
        saveAccounts(accountsRef.current.filter((a) => a.id !== record.id));
        removeKeys(Object.values(workspaceKeys(record.id)));
        logout();
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : '删除失败，请重试' };
      }
    },
    [session, saveAccounts, logout],
  );

  const value = useMemo<AuthValue>(
    () => ({
      account: current ? toPublic(current) : null,
      hasAccounts: accounts.length > 0,
      persistent,
      register,
      login,
      logout,
      changePassword,
      deleteAccount,
    }),
    [current, accounts.length, persistent, register, login, logout, changePassword, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
