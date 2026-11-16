import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// ez-tree 用源码版本，并把它的贴图模块换成按需加载的版本（见 src/world/ez-textures.ts）
const ezTextures: Plugin = {
  name: 'ez-tree-textures',
  enforce: 'pre',
  resolveId(source, importer) {
    if (importer && importer.includes('/ez-tree/src/lib/') && /^\.\/textures(\.js)?$/.test(source)) return here('./src/world/ez-textures.ts');
    return null;
  },
};

// 前端资源全部用相对路径，方便挂在任意子路径下（例如预览代理的 /p/<id>/）
export default defineConfig({
  base: './',
  plugins: [ezTextures],
  resolve: { alias: { 'ez-tree-src': here('./node_modules/@dgreenheck/ez-tree/src/lib/index.js') } },
  server: {
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:4318', ws: true },
      '/api': { target: 'http://127.0.0.1:4318' },
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
