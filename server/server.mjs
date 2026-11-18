// 山寺服务器：托管构建好的前端，并用 WebSocket 同步同一房间里的小和尚
// 运行：node server/server.mjs   （PORT 环境变量可改端口，默认 4318）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
// 宣传片目录（视频和封面），不进 Git；用 PROMO_DIR 指定，默认项目下的 promo/
const PROMO_DIR = path.resolve(process.env.PROMO_DIR || path.join(__dirname, '../promo'));
const PORT = Number(process.env.PORT || 4318);
const ROOMS = 5;
const CAPACITY = 50;
const TICK_MS = 120;
const INCENSE_MS = 3 * 60 * 1000;
const ACTIONS = new Set(['idle', 'walk', 'bow', 'hapjang', 'sit', 'bench', 'moktak', 'rosary', 'incense', 'lantern', 'feed', 'fortune', 'hang']);
const LANTERN_MS = 8 * 60 * 1000; // 河灯在水上漂 8 分钟
const LANTERN_MAX = 30;
const SEAT_RE = /^(c\d{1,3}|b\d{1,2}-\d|k\d{1,2})$/;
// 手里的咖啡：饮品.还剩几口
const CUP_RE = /^(latte|americano|coldbrew|osmanthus|decaf)\.[0-3]$/;
const LOOK_RE = /^[a-z]{2,10}\.[a-z]{2,10}\.[0-6]$/;
const PLACES = new Set(['yard', 'altar']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
};

/** @type {Map<number, {players: Map<string, any>, incense: any[]}>} */
const rooms = new Map();
for (let i = 1; i <= ROOMS; i++) rooms.set(i, { players: new Map(), incense: [], lanterns: [] });

function roomList() {
  return [...rooms.entries()].map(([id, r]) => ({ id, count: r.players.size, capacity: CAPACITY }));
}

function cleanName(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 16) || '…';
}

// 发送文件，支持 Range（手机浏览器播放视频、拖动进度都要靠它）
function sendFile(req, res, file, extra = {}) {
  let st;
  try {
    st = fs.statSync(file);
    if (!st.isFile()) throw new Error('not file');
  } catch {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const head = { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'accept-ranges': 'bytes', 'last-modified': st.mtime.toUTCString(), ...extra };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (start > end) {
      res.writeHead(416, { 'content-range': `bytes */${st.size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...head, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...head, 'content-length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function promoPage() {
  const has = (f) => fs.existsSync(path.join(PROMO_DIR, f));
  const items = [
    ['promo.mp4', '宣传片 · 竖版 9:16', '9/16', 'cover.jpg', '一句话复刻韩国爆火的山寺.mp4'],
    ['explainer-16x9.mp4', '讲解视频 · 横版 16:9', '16/9', '', '一句话复刻韩国爆火的山寺-讲解.mp4'],
    ['short-3x4.mp4', '短视频 · 竖版 3:4', '3/4', 'cover-3x4.jpg', '一句话复刻韩国爆火的山寺-短视频.mp4'],
  ].filter(([f]) => has(f));
  const blocks = items
    .map(([f, label, ar, poster, dl]) => `<section><h2>${label}</h2><video src="${f}"${poster && has(poster) ? ` poster="${poster}"` : ''} controls playsinline preload="metadata" style="aspect-ratio:${ar}"></video><a href="${f}" download="${dl}">下载</a></section>`)
    .join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>一句话复刻韩国爆火的山寺</title>
<meta property="og:title" content="一句话复刻韩国爆火的山寺"><meta property="og:image" content="cover.jpg"><meta property="og:type" content="video.other">
<style>
html,body{margin:0;background:#1b1714;color:#efe5d0;font-family:"Songti SC","Noto Serif CJK SC",serif}
main{max-width:1100px;margin:0 auto;padding:22px 16px 40px;display:flex;flex-direction:column;align-items:center;gap:30px}
h1{margin:0;font-size:22px;font-weight:600;letter-spacing:3px}
section{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
h2{margin:0;font-size:16px;font-weight:500;color:#cdbb98;letter-spacing:2px}
video{display:block;max-width:100%;max-height:78vh;background:#000;border-radius:10px;box-shadow:0 10px 40px #0008}
a{color:#e2c48a;text-decoration:none;border-bottom:1px solid #e2c48a55;padding-bottom:2px;font-size:15px}
nav{display:flex;gap:22px}
</style></head><body><main>
<h1>一句话复刻韩国爆火的山寺</h1>${blocks}
<nav><a href="cover.jpg" download="封面-9比16.jpg">封面 9:16</a><a href="cover-3x4.jpg" download="封面-3比4.jpg">封面 3:4</a><a href="../">进山寺</a></nav>
</main></body></html>`;
}

const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  // 任意前缀下的 /api/rooms 都认（预览代理会加子路径）
  if (url.pathname.endsWith('/api/rooms')) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(roomList()));
    return;
  }
  if (url.pathname.endsWith('/healthz')) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end('bad request');
    return;
  }
  const parts = rel.split('/').filter(Boolean);
  // 宣传片：任意前缀下的 promo/（页面）和 promo/文件名
  const pi = parts.lastIndexOf('promo');
  if (pi >= 0 && pi >= parts.length - 2) {
    const name = parts[pi + 1];
    if (!name) {
      if (!rel.endsWith('/')) {
        res.writeHead(301, { location: 'promo/' });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(promoPage());
      return;
    }
    sendFile(req, res, path.join(PROMO_DIR, path.basename(name)), { 'cache-control': 'public, max-age=600' });
    return;
  }
  // 去掉可能的子路径前缀，只要能在 dist 里找到文件即可
  const tryFiles = [];
  for (let i = 0; i <= parts.length; i++) tryFiles.push(parts.slice(i).join('/'));
  for (const p of tryFiles) {
    const file = path.join(DIST, p || 'index.html');
    if (file !== DIST && !file.startsWith(DIST + path.sep)) continue;
    try {
      const st = fs.statSync(file);
      const target = st.isDirectory() ? path.join(file, 'index.html') : file;
      if (!fs.existsSync(target)) continue;
      const ext = path.extname(target);
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': target.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      fs.createReadStream(target).pipe(res);
      return;
    } catch {
      /* 继续尝试下一个 */
    }
  }
  res.writeHead(404);
  res.end('not found');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://x');
  if (!url.pathname.endsWith('/ws')) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, except) {
  const data = JSON.stringify(obj);
  for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(data);
}

// —— 祈福灯廊的心愿：所有房间共用一份，挂七天，最多留 WISH_MAX 条（存在内存里；
// 服务器重启后，作者再进来时客户端会把自己七天内挂的补交回来）——
const WISH_MAX = 240;
const WISH_MS = 7 * 24 * 3600 * 1000;
const WISH_ID = /^[0-9a-f]{8}$/;
let wishes = [];
function cleanWish(s) {
  if (typeof s !== 'string') return '';
  const t = [...s.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 24).join('');
  // 不收网址和像电话号码的长串数字
  if (/(https?:|www\.|\.(com|cn|net|org|io|cc)\b)/i.test(t) || /\d{7,}/.test(t.replace(/[\s-]/g, ''))) return '';
  return t;
}
const wishOut = (w) => ({ id: w.id, by: w.by, text: w.text, c: w.c, k: w.k, at: w.at, likes: w.likes });
function broadcastAll(obj) {
  for (const room of rooms.values()) broadcast(room, obj);
}
function addWish(me, m, at) {
  const id = String(m.id || '');
  const text = cleanWish(m.text);
  if (!WISH_ID.test(id) || !text || wishes.some((w) => w.id === id)) return false;
  const w = { id, by: me.name, owner: me.id, text, c: Math.floor(num(m.c, 0, 5)), k: Math.floor(num(m.k, 0, 6)), at, likes: 0, likedBy: new Set(), reports: new Set() };
  wishes.push(w);
  if (wishes.length > WISH_MAX) {
    const old = wishes.shift();
    broadcastAll({ t: 'wishDel', id: old.id });
  }
  broadcastAll({ t: 'wishAdd', w: wishOut(w) });
  return true;
}

function lanternMsg(room) {
  return { t: 'lanterns', now: Date.now(), list: room.lanterns.map((l) => ({ id: l.id, by: l.by, owner: l.owner, seed: l.seed, start: l.start, until: l.until })) };
}

function incenseMsg(room) {
  return { t: 'incense', now: Date.now(), list: room.incense.map((i) => ({ id: i.id, by: i.by, owner: i.owner, until: i.until, start: i.start, place: i.place })) };
}

wss.on('connection', (ws) => {
  let me = null;
  let room = null;
  let lastMsgs = [];
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  // 超长或格式错误的帧会触发 error；没有监听时整个进程会退出
  ws.on('error', () => ws.terminate());

  ws.on('message', (raw) => {
    // 简单限速：每秒最多 30 条
    const now = Date.now();
    lastMsgs = lastMsgs.filter((t) => now - t < 1000);
    if (lastMsgs.length > 30) return;
    lastMsgs.push(now);
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'hello' && !me) {
      let id = Number(msg.room);
      if (!rooms.has(id)) {
        // 自动选人最多但没满的房间，让大家聚在一起
        const open = roomList().filter((r) => r.count < CAPACITY).sort((a, b) => b.count - a.count || a.id - b.id);
        id = open[0]?.id ?? 0;
      }
      const r = rooms.get(id);
      if (!r || r.players.size >= CAPACITY) {
        send(ws, { t: 'full' });
        return;
      }
      room = r;
      me = { id: crypto.randomBytes(6).toString('hex'), ws, name: cleanName(msg.name), x: 0, z: 22, yaw: Math.PI, a: 'idle', s: null, n: 0, k: '', c: '' };
      room.players.set(me.id, me);
      send(ws, { t: 'welcome', id: me.id, room: id, capacity: CAPACITY });
      send(ws, incenseMsg(room));
      send(ws, lanternMsg(room));
      send(ws, { t: 'wishes', list: wishes.map(wishOut) });
      return;
    }
    if (!me) return;

    switch (msg.t) {
      case 'state':
        me.x = num(msg.x, -46, 46);
        me.z = num(msg.z, -52, 70);
        me.yaw = num(msg.yaw, -100, 100);
        me.a = ACTIONS.has(msg.a) ? msg.a : 'idle';
        me.n = Math.floor(num(msg.n, 0, 100000));
        // 衣钵与等级：只收「小写字母.小写字母.0-6」这种格式
        if (typeof msg.k === 'string' && LOOK_RE.test(msg.k)) me.k = msg.k;
        if (msg.c === '' || (typeof msg.c === 'string' && CUP_RE.test(msg.c))) me.c = msg.c;
        if (msg.s === null || (typeof msg.s === 'string' && me.s === msg.s)) me.s = msg.s ?? null;
        break;
      case 'name':
        me.name = cleanName(msg.name);
        break;
      case 'claim': {
        const seat = String(msg.seat || '');
        if (!SEAT_RE.test(seat)) return;
        const taken = [...room.players.values()].some((p) => p !== me && p.s === seat);
        if (!taken) me.s = seat;
        send(ws, { t: 'claim', seat, ok: !taken });
        break;
      }
      case 'release':
        me.s = null;
        break;
      case 'incense': {
        const t = Date.now();
        const place = PLACES.has(msg.place) ? msg.place : 'yard';
        // 每人在每个香炉同时只能有一炷香
        if (room.incense.some((i) => i.owner === me.id && i.place === place && i.until > t)) return;
        room.incense.push({ id: crypto.randomBytes(4).toString('hex'), by: me.name, owner: me.id, start: t, until: t + INCENSE_MS, place });
        const same = room.incense.filter((i) => i.place === place);
        if (same.length > 24) room.incense.splice(room.incense.indexOf(same[0]), 1);
        broadcast(room, incenseMsg(room));
        break;
      }
      case 'lantern': {
        // 放河灯：每人同时只能有一盏在水上，整个房间最多 30 盏
        const t = Date.now();
        if (room.lanterns.some((l) => l.owner === me.id && l.until > t)) return;
        room.lanterns.push({ id: crypto.randomBytes(4).toString('hex'), by: me.name, owner: me.id, seed: Math.random(), start: t, until: t + LANTERN_MS });
        if (room.lanterns.length > LANTERN_MAX) room.lanterns.shift();
        broadcast(room, lanternMsg(room));
        break;
      }
      case 'wish': {
        // 挂一盏：每个连接十分钟内只能挂一盏
        const t = Date.now();
        if (t - (me.wishAt || 0) < 10 * 60 * 1000) return;
        if (addWish(me, msg, t)) me.wishAt = t;
        break;
      }
      case 'wishBack': {
        // 重连后补交自己七天内挂过的（每个连接一次、最多三条）
        if (me.wishBack || !Array.isArray(msg.list)) return;
        me.wishBack = true;
        const t = Date.now();
        for (const m of msg.list.slice(0, 3)) {
          const at = Number(m && m.at);
          if (Number.isFinite(at) && at <= t && t - at < WISH_MS) addWish(me, m, at);
        }
        break;
      }
      case 'like': {
        const w = wishes.find((x) => x.id === msg.id);
        if (!w || w.owner === me.id || w.likedBy.has(me.id)) return;
        w.likedBy.add(me.id);
        w.likes++;
        broadcastAll({ t: 'wishLike', id: w.id, n: w.likes });
        break;
      }
      case 'report': {
        // 两个人举报就撤下
        const w = wishes.find((x) => x.id === msg.id);
        if (!w || w.owner === me.id) return;
        w.reports.add(me.id);
        if (w.reports.size >= 2) {
          wishes = wishes.filter((x) => x !== w);
          broadcastAll({ t: 'wishDel', id: w.id });
        }
        break;
      }
      case 'give': {
        // 请人喝咖啡：自己手上是满杯、对方空着手、两人离得够近，杯子就换到对方手上
        const to = room.players.get(String(msg.to || ''));
        const ok = !!to && to !== me && /\.3$/.test(me.c) && !to.c && Math.hypot(to.x - me.x, to.z - me.z) < 3.5;
        if (ok) {
          to.c = me.c;
          me.c = '';
          send(to.ws, { t: 'gift', from: me.id, name: me.name, c: to.c });
        }
        send(ws, { t: 'gave', to: String(msg.to || ''), ok, why: !to ? 'gone' : to.c && !ok ? 'has' : ok ? '' : 'far' });
        break;
      }
      case 'bell': {
        // 撞钟 / 击鼓：转告房间里其他人（钟 15 秒一次，鼓 3.5 秒一次）
        const t = Date.now();
        const kind = msg.kind === 'drum' ? 'drum' : 'bell';
        const key = kind === 'drum' ? 'drumAt' : 'bellAt';
        if (t - (me[key] || 0) < (kind === 'drum' ? 3500 : 15000)) return;
        me[key] = t;
        broadcast(room, { t: 'bell', from: me.id, kind }, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (me && room) {
      room.players.delete(me.id);
      broadcast(room, { t: 'leave', id: me.id });
    }
  });
});

// 定时广播房间快照
setInterval(() => {
  const now = Date.now();
  wishes = wishes.filter((w) => {
    if (now - w.at < WISH_MS) return true;
    broadcastAll({ t: 'wishDel', id: w.id });
    return false;
  });
  for (const room of rooms.values()) {
    const before = room.incense.length;
    room.incense = room.incense.filter((i) => i.until > now);
    if (room.incense.length !== before) broadcast(room, incenseMsg(room));
    const lb = room.lanterns.length;
    room.lanterns = room.lanterns.filter((l) => l.until > now);
    if (room.lanterns.length !== lb) broadcast(room, lanternMsg(room));
    if (!room.players.size) continue;
    const p = [...room.players.values()].map((q) => [q.id, q.name, q.x, q.z, q.yaw, q.a, q.s, q.n, q.k, q.c]);
    broadcast(room, { t: 'snap', p });
  }
}, TICK_MS);

// 清理断线
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`[sansa] http://${HOST}:${PORT}  (dist: ${DIST})`);
});
