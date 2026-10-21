import { defineConfig } from 'vite';

/**
 * 构建可发布为 claude.ai Artifact 的单文件页面：
 * React 以 UMD 全局变量从 cdnjs 加载（React 19 不再提供 UMD，故使用 18.3.1），
 * 应用代码与样式由 scripts/build-artifact.mjs 内联进页面。
 */
export default defineConfig({
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsxInject: `import React from 'react'`,
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: 'src/main.tsx', formats: ['iife'], name: 'StudentOS', fileName: () => 'app.js' },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
        assetFileNames: 'app[extname]',
      },
    },
  },
});
