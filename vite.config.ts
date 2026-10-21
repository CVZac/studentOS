import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 使用相对路径，构建产物可直接部署到任意静态托管（含 GitHub Pages 子路径）
export default defineConfig({
  base: './',
  plugins: [react()],
});
