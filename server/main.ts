import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { openDatabase } from './db';

declare const __APP_VERSION__: string;

const env = process.env;
const port = Number(env.PORT ?? 8080);
const host = env.HOST ?? '0.0.0.0';
const dataDir = path.resolve(env.DATA_DIR ?? 'data');
const staticDir = path.resolve(env.STATIC_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'public'));

mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'studentos.db');
let store: ReturnType<typeof openDatabase>;
try {
  store = openDatabase(dbFile);
} catch (err) {
  console.error(`无法打开数据库 ${dbFile}：${err instanceof Error ? err.message : String(err)}`);
  console.error('请确认 DATA_DIR 存在且可写（Docker 镜像中需属于 node 用户）');
  process.exit(1);
}
const app = createApp({
  store,
  staticDir: existsSync(staticDir) ? staticDir : null,
  publicUrl: env.PUBLIC_URL || null,
  trustProxy: env.TRUST_PROXY === '1',
  version: __APP_VERSION__,
  commit: env.GIT_SHA || undefined,
});

const server = createServer(app.handle);
server.listen(port, host, () => {
  console.log(`Student OS server ${__APP_VERSION__} listening on http://${host}:${port}`);
  console.log(`  data: ${path.join(dataDir, 'studentos.db')}`);
  console.log(`  web:  ${existsSync(staticDir) ? staticDir : '(not built, API only)'}`);
  if (env.PUBLIC_URL) console.log(`  public url: ${env.PUBLIC_URL}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  app.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  // 长连接未及时关闭时强制退出
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
