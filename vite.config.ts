import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 使用相对路径，构建产物可直接部署到任意静态托管（含 GitHub Pages 子路径）
export default defineConfig({
  base: './',
  plugins: [react()],
  // npm run dev:cloud 时把 /api 转发到本地运行的 Student OS 服务器
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
