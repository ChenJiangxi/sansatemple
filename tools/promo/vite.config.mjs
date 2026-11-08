// 宣传片录制用的开发服务器：npx vite --config tools/promo/vite.config.mjs
// 页面 /tools/promo/promo.html 逐帧渲染，把 JPEG 帧 POST 回来，写到 PROMO_OUT（默认 /tmp/sansa-promo）
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.PROMO_OUT || '/tmp/sansa-promo';

function capture() {
  return {
    name: 'promo-capture',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://x');
        if (url.pathname.startsWith('/__promo/ui/')) {
          const f = path.join(process.env.PROMO_UI || path.join(OUT, 'ui'), path.basename(url.pathname));
          if (!fs.existsSync(f)) return res.writeHead(404).end();
          res.writeHead(200, { 'content-type': 'image/jpeg' });
          return fs.createReadStream(f).pipe(res);
        }
        if (url.pathname.startsWith('/__promo/fonts/')) {
          const f = path.join(OUT, 'fonts', path.basename(url.pathname));
          if (!fs.existsSync(f)) return res.writeHead(404).end();
          res.writeHead(200, { 'content-type': 'font/ttf' });
          return fs.createReadStream(f).pipe(res);
        }
        if (url.pathname === '/__promo/frame' && req.method === 'POST') {
          const shot = (url.searchParams.get('shot') || 'x').replace(/[^a-z0-9_-]/gi, '');
          const i = Number(url.searchParams.get('i')) | 0;
          const dir = path.join(OUT, 'shots', shot);
          fs.mkdirSync(dir, { recursive: true });
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            fs.writeFileSync(path.join(dir, String(i).padStart(5, '0') + '.jpg'), Buffer.concat(chunks));
            res.writeHead(204).end();
          });
          return;
        }
        if (url.pathname === '/__promo/log' && req.method === 'POST') {
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            fs.mkdirSync(OUT, { recursive: true });
            fs.appendFileSync(path.join(OUT, 'log.txt'), Buffer.concat(chunks).toString() + '\n');
            res.writeHead(204).end();
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root,
  base: '/',
  publicDir: path.join(root, 'public'),
  server: { host: '127.0.0.1', port: 4327, strictPort: true },
  plugins: [capture()],
});
