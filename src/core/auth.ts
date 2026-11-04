/**
 * 本地账号：用户名 + 密码，密码经 PBKDF2-SHA256 加盐派生后保存。
 * 账号只存在当前浏览器中，用于区分使用者与隔离数据，不替代服务端鉴权。
 */

export interface AccountRecord {
  id: string;
  /** 展示用用户名（NFKC 规范化并去除首尾空白） */
  username: string;
  /** 查找键：小写用户名，用于不区分大小写的唯一性判断 */
  key: string;
  /** base64 编码的 16 字节随机盐 */
  salt: string;
  /** base64 编码的 32 字节派生密钥 */
  hash: string;
  iterations: number;
  createdAt: string;
}

export interface PublicAccount {
  id: string;
  username: string;
  createdAt: string;
}

export type AuthField = 'username' | 'password' | 'confirm' | 'current';
export type AuthResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string; field?: AuthField };

/** OWASP 推荐的 PBKDF2-HMAC-SHA256 迭代次数 */
export const PASSWORD_ITERATIONS = 600_000;
export const USERNAME_RULE = '2–20 位，可用中文、字母、数字或下划线';
export const PASSWORD_RULE = '8–64 位，同时包含字母和数字';

const USERNAME_PATTERN = /^[\p{L}\p{N}_]{2,20}$/u;

export const normalizeUsername = (raw: string) => raw.normalize('NFKC').trim();
export const usernameKey = (raw: string) => normalizeUsername(raw).toLowerCase();

export function validateUsername(raw: string): string | null {
  const name = normalizeUsername(raw);
  if (!name) return '请输入用户名';
  if (!USERNAME_PATTERN.test(name)) return `用户名需为${USERNAME_RULE}`;
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return '请输入密码';
  if (password.length < 8 || password.length > 64) return '密码需为 8–64 位';
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) return '密码需同时包含字母和数字';
  return null;
}

/** 密码强度 0–3：弱 / 一般 / 良好 / 强 */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (validatePassword(password)) return 0;
  let score = 1;
  if (password.length >= 12) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((r) => r.test(password)).length;
  if (classes >= 3) score++;
  return Math.min(3, score) as 1 | 2 | 3;
}

export const toPublic = (r: AccountRecord): PublicAccount => ({ id: r.id, username: r.username, createdAt: r.createdAt });

export const findAccount = (accounts: readonly AccountRecord[], username: string) =>
  accounts.find((a) => a.key === usernameKey(username));

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

function subtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('当前环境不支持安全加密，请通过 HTTPS 或 localhost 打开');
  return subtle;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const subtle = subtleCrypto();
  const key = await subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const randomId = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : toBase64(globalThis.crypto.getRandomValues(new Uint8Array(12))).replace(/[^a-z0-9]/gi, '');

async function hashSecret(password: string, iterations: number) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { salt: toBase64(salt), hash: toBase64(await derive(password, salt, iterations)), iterations };
}

export interface HashOptions {
  /** 仅测试时调低 */
  iterations?: number;
  now?: Date;
}

export async function createAccount(
  existing: readonly AccountRecord[],
  username: string,
  password: string,
  options: HashOptions = {},
): Promise<AuthResult<AccountRecord>> {
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, error: usernameError, field: 'username' };
  if (findAccount(existing, username)) return { ok: false, error: '该用户名已被注册', field: 'username' };
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError, field: 'password' };

  const secret = await hashSecret(password, options.iterations ?? PASSWORD_ITERATIONS);
  return {
    ok: true,
    value: {
      id: randomId(),
      username: normalizeUsername(username),
      key: usernameKey(username),
      ...secret,
      createdAt: (options.now ?? new Date()).toISOString(),
    },
  };
}

export async function verifyPassword(record: AccountRecord, password: string): Promise<boolean> {
  const derived = await derive(password, fromBase64(record.salt), record.iterations);
  return timingSafeEqual(derived, fromBase64(record.hash));
}

/** 修改密码：校验新密码后使用新盐重新派生 */
export async function rehashAccount(
  record: AccountRecord,
  nextPassword: string,
  options: HashOptions = {},
): Promise<AuthResult<AccountRecord>> {
  const error = validatePassword(nextPassword);
  if (error) return { ok: false, error, field: 'password' };
  return { ok: true, value: { ...record, ...(await hashSecret(nextPassword, options.iterations ?? PASSWORD_ITERATIONS)) } };
}
