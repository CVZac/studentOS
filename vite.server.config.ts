import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** 把 server/ 与共享的 src/core 打包成单个 Node 入口 dist-cloud/server.js（无第三方运行时依赖） */
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-cloud',
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'server.js', format: 'es' } },
  },
  ssr: { noExternal: true },
});
