import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** 页面只加载同源脚本与样式；React 的 style 属性需要 'unsafe-inline' 样式 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** 提供前端构建产物；返回 false 表示未命中，由调用方返回 404 */
export async function serveStatic(req: IncomingMessage, res: ServerResponse, root: string, pathname: string) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let relative: string;
  try {
    relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    return false;
  }
  const file = path.resolve(root, `.${relative}`);
  // 防止路径穿越到构建目录之外
  if (file !== root && !file.startsWith(root + path.sep)) return false;

  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    const headers: Record<string, string | number> = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // 带内容哈希的资源长期缓存，入口页每次校验
      'Cache-Control': relative.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    if (ext === '.html') headers['Content-Security-Policy'] = CSP;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
    return true;
  } catch {
    return false;
  }
}
