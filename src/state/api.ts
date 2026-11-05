import type { AuthField } from '../core/auth';

/** 构建时决定：server 为云端账号（需要 Student OS 服务器），否则为浏览器本地账号 */
export const AUTH_MODE: 'server' | 'local' = import.meta.env.VITE_AUTH_MODE === 'server' ? 'server' : 'local';

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; field?: AuthField; details?: string[] };

const OFFLINE = '无法连接服务器，请检查网络后重试';

/** 调用同源 API；网络错误与服务端错误统一为 { ok: false, error } */
export async function api<T = undefined>(
  method: string,
  path: string,
  body?: unknown,
  options: { keepalive?: boolean } = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      keepalive: options.keepalive,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }
  let data: Record<string, unknown> | null = null;
  if (res.status !== 204) {
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }
  if (res.ok) return { ok: true, status: res.status, data: data as T };
  return {
    ok: false,
    status: res.status,
    error: typeof data?.error === 'string' ? data.error : res.status >= 500 ? '服务器暂时不可用，请稍后重试' : `请求失败（${res.status}）`,
    field: data?.field as AuthField | undefined,
    details: Array.isArray(data?.details) ? (data.details as string[]) : undefined,
  };
}
