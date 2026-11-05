import type { IncomingMessage, ServerResponse } from 'node:http';

/** 以 HTTP 状态码表达的业务错误；field 指向出错的表单字段 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public field?: string,
    public details?: string[],
  ) {
    super(message);
  }
}

const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};

export function setCommonHeaders(res: ServerResponse) {
  for (const [k, v] of Object.entries(COMMON_HEADERS)) res.setHeader(k, v);
}

export function sendJson(res: ServerResponse, status: number, body?: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

/** 读取 JSON 请求体：要求 application/json（同时阻止跨站表单提交），并限制大小 */
export async function readJson(req: IncomingMessage, limitBytes: number): Promise<Record<string, unknown>> {
  const type = req.headers['content-type'] ?? '';
  if (!/^application\/json\b/i.test(type)) throw new HttpError(415, '请求格式需为 JSON');
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limitBytes) throw new HttpError(413, '请求内容过大');

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw new HttpError(413, '请求内容过大');
    chunks.push(chunk as Buffer);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, '请求内容不是有效的 JSON 对象');
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // 忽略无法解码的 cookie
    }
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { secure: boolean; maxAgeSeconds?: number; expire?: boolean },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (opts.secure) parts.push('Secure');
  if (opts.expire) parts.push('Max-Age=0');
  else if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  return parts.join('; ');
}

export const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '');
