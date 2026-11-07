import { defineConfig } from 'vite';

// 前端资源全部用相对路径，方便挂在任意子路径下（例如预览代理的 /p/<id>/）
export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:4318', ws: true },
      '/api': { target: 'http://127.0.0.1:4318' },
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
