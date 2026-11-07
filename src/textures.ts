// 程序生成的贴图：全部在 canvas 上画，不依赖外部图片。
import * as THREE from 'three';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  return { c, g };
}

function finish(c: HTMLCanvasElement, repeat = 1, srgb = true) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, r: () => number, colors: string[], size: [number, number], alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.3 + r() * 0.7);
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    g.beginPath();
    g.ellipse(r() * w, r() * h, s, s * (0.5 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

// 秋天的院子地面：泥土 + 枯草 + 落叶
export function groundTexture() {
  const { c, g } = canvas(1024);
  const r = rng(11);
  g.fillStyle = '#7a6a4c';
  g.fillRect(0, 0, 1024, 1024);
  speckle(g, 1024, 1024, 900, r, ['#8a7a58', '#6c5c40', '#93835f', '#5f5238'], [10, 46], 0.35);
  speckle(g, 1024, 1024, 2600, r, ['#9a8a62', '#7d6d4b', '#a5946a', '#5b6a3a', '#6f7a45'], [1.5, 5], 0.6);
  // 草茎
  g.lineWidth = 1.2;
  for (let i = 0; i < 2200; i++) {
    g.strokeStyle = ['#a39364', '#8b8a55', '#6d7440', '#b5a578'][Math.floor(r() * 4)];
    g.globalAlpha = 0.5;
    const x = r() * 1024, y = r() * 1024, a = r() * Math.PI, l = 4 + r() * 12;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // 落叶
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.75;
    g.fillStyle = ['#b5452b', '#c9692e', '#d79a3a', '#8e3a25', '#a8662f'][Math.floor(r() * 5)];
    leafPath(g, r() * 1024, r() * 1024, 5 + r() * 6, r() * Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return finish(c, 26);
}

function leafPath(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? s : s * 0.45;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.restore();
}

// 石板路
export function pavingTexture() {
  const { c, g } = canvas(512);
  const r = rng(23);
  g.fillStyle = '#5d5b55';
  g.fillRect(0, 0, 512, 512);
  const rows = 6;
  const rh = 512 / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 60;
    while (x < 512) {
      const w = 60 + r() * 70;
      const shade = 140 + Math.floor(r() * 40);
      g.fillStyle = `rgb(${shade},${shade - 3},${shade - 9})`;
      const inset = 3;
      roundRect(g, x + inset, row * rh + inset, w - inset * 2, rh - inset * 2, 7);
      g.fill();
      x += w;
    }
  }
  speckle(g, 512, 512, 1500, r, ['#77736b', '#a29d92', '#8a857b', '#6b6a5d'], [1, 3.5], 0.45);
  speckle(g, 512, 512, 80, r, ['#6c7a52', '#8a8a5a'], [3, 9], 0.25);
  return finish(c, 1);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 花岗岩块（台基、石塔、石灯）
export function stoneTexture(seed = 5, base = '#9c978b') {
  const { c, g } = canvas(512);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  speckle(g, 512, 512, 6000, r, ['#7d786e', '#b3ada0', '#8c877b', '#c4bfb2', '#6d695f'], [0.6, 2.2], 0.5);
  speckle(g, 512, 512, 60, r, ['#6f6a5f', '#8a8476'], [20, 60], 0.12);
  return finish(c, 1);
}

// 台基侧面：长条石块
export function stoneBlockTexture() {
  const { c, g } = canvas(512, 256);
  const r = rng(41);
  g.fillStyle = '#5f5b52';
  g.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 2; row++) {
    let x = -r() * 100;
    while (x < 512) {
      const w = 110 + r() * 90;
      const sh = 150 + Math.floor(r() * 30);
      g.fillStyle = `rgb(${sh},${sh - 4},${sh - 12})`;
      g.fillRect(x + 2, row * 128 + 2, w - 4, 124);
      x += w;
    }
  }
  speckle(g, 512, 256, 3500, r, ['#7d786e', '#b3ada0', '#8c877b'], [0.6, 2], 0.5);
  return finish(c, 1);
}

// 木纹。dark 用于柱子（深红褐色）
export function woodTexture(seed = 3, colors = ['#5a2d22', '#4a2219', '#6b3828']) {
  const { c, g } = canvas(256, 512);
  const r = rng(seed);
  g.fillStyle = colors[0];
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = colors[1 + Math.floor(r() * (colors.length - 1))];
    g.globalAlpha = 0.25 + r() * 0.4;
    g.lineWidth = 0.8 + r() * 2.5;
    const x0 = r() * 256;
    g.beginPath();
    for (let y = 0; y <= 512; y += 16) {
      const x = x0 + Math.sin(y * 0.012 + i) * 4 + Math.sin(y * 0.05 + i * 3) * 1.4;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  return finish(c, 1);
}

// 木地板
export function floorTexture() {
  const { c, g } = canvas(512);
  const r = rng(17);
  g.fillStyle = '#3a2a20';
  g.fillRect(0, 0, 512, 512);
  const planks = 8;
  const pw = 512 / planks;
  for (let i = 0; i < planks; i++) {
    let y = -r() * 200;
    while (y < 512) {
      const len = 180 + r() * 200;
      const sh = r() * 18;
      g.fillStyle = `rgb(${78 + sh},${55 + sh * 0.7},${40 + sh * 0.5})`;
      g.fillRect(i * pw + 1.5, y + 1.5, pw - 3, len - 3);
      g.strokeStyle = 'rgba(40,25,15,0.35)';
      for (let k = 0; k < 6; k++) {
        g.lineWidth = 0.8;
        const xx = i * pw + 4 + r() * (pw - 8);
        g.beginPath();
        g.moveTo(xx, y + 4);
        g.lineTo(xx + Math.sin(k) * 2, y + len - 4);
        g.stroke();
      }
      y += len;
    }
  }
  return finish(c, 1);
}

// 白灰墙
export function plasterTexture() {
  const { c, g } = canvas(256);
  const r = rng(8);
  g.fillStyle = '#e4ddcc';
  g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 1200, r, ['#d8d0bd', '#ece6d8', '#cfc6b2'], [1, 5], 0.4);
  return finish(c, 1);
}

// 瓦屋顶：灰色筒瓦的竖向条纹
export function roofTexture() {
  const { c, g } = canvas(256);
  const r = rng(29);
  g.fillStyle = '#4a4c4c';
  g.fillRect(0, 0, 256, 256);
  const cols = 8;
  const cw = 256 / cols;
  for (let i = 0; i < cols; i++) {
    const grad = g.createLinearGradient(i * cw, 0, i * cw + cw, 0);
    grad.addColorStop(0, '#2f3232');
    grad.addColorStop(0.3, '#5d605f');
    grad.addColorStop(0.55, '#6e7170');
    grad.addColorStop(1, '#2c2f2f');
    g.fillStyle = grad;
    g.fillRect(i * cw + cw * 0.2, 0, cw * 0.6, 256);
  }
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = 'rgba(20,22,22,0.35)';
    g.fillRect(0, y, 256, 3);
  }
  speckle(g, 256, 256, 500, r, ['#7b7d78', '#3a3c3b', '#6a6b5f'], [0.5, 2], 0.4);
  return finish(c, 1);
}

// 丹青（梁枋彩画）：绿底 + 红白纹样
export function dancheongTexture() {
  const { c, g } = canvas(512, 64);
  g.fillStyle = '#2f6b5b';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#244f45';
  g.fillRect(0, 0, 512, 8);
  g.fillRect(0, 56, 512, 8);
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = '#b8473a';
    g.beginPath();
    g.arc(x + 32, 32, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f0e8d4';
    g.beginPath();
    g.arc(x + 32, 32, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d9a441';
    g.beginPath();
    g.arc(x + 32, 32, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f0e8d4';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + 2, 12);
    g.lineTo(x + 10, 32);
    g.lineTo(x + 2, 52);
    g.stroke();
    g.strokeStyle = '#3d7fa0';
    g.beginPath();
    g.moveTo(x + 60, 12);
    g.lineTo(x + 52, 32);
    g.lineTo(x + 60, 52);
    g.stroke();
  }
  const tex = finish(c, 1);
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 格子窗（窗户纸）
export function latticeTexture() {
  const { c, g } = canvas(256);
  g.fillStyle = '#efe7d3';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#6a3b2a';
  g.lineWidth = 5;
  g.strokeRect(2.5, 2.5, 251, 251);
  g.lineWidth = 3;
  for (let i = 1; i < 8; i++) {
    g.beginPath();
    g.moveTo((i * 256) / 8, 0);
    g.lineTo((i * 256) / 8, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, (i * 256) / 8);
    g.lineTo(256, (i * 256) / 8);
    g.stroke();
  }
  return finish(c, 1);
}

// 佛坛后方的壁画：深红底，金色光环与莲花
export function muralTexture() {
  const { c, g } = canvas(1024, 512);
  const r = rng(77);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#5a1f17');
  grad.addColorStop(1, '#3d140f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // 缠枝花纹
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = r() > 0.5 ? 'rgba(201,150,70,0.35)' : 'rgba(60,110,90,0.35)';
    g.lineWidth = 2 + r() * 2;
    const x = r() * 1024, y = r() * 512, s = 14 + r() * 26;
    g.beginPath();
    g.arc(x, y, s, r() * 6, r() * 6 + 3);
    g.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * 1024, y = r() * 512;
    g.fillStyle = ['#c47a3a', '#d9a35a', '#9b3a2a', '#e0c07a'][Math.floor(r() * 4)];
    g.globalAlpha = 0.55;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 7, 4, a, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  // 三尊佛的身光与头光
  for (const [cx, big] of [[512, 1], [205, 0.75], [819, 0.75]] as [number, number][]) {
    const rg = g.createRadialGradient(cx, 300, 10, cx, 300, 230 * big);
    rg.addColorStop(0, 'rgba(240,200,110,0.55)');
    rg.addColorStop(0.6, 'rgba(200,130,60,0.25)');
    rg.addColorStop(1, 'rgba(120,40,20,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.ellipse(cx, 300, 180 * big, 230 * big, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(232,190,100,0.8)';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(cx, 300, 165 * big, 215 * big, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(cx, 150 + (1 - big) * 80, 70 * big, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      g.fillStyle = 'rgba(240,205,120,0.7)';
      g.beginPath();
      g.arc(cx + Math.cos(a) * 190 * big, 300 + Math.sin(a) * 240 * big, 6 * big, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = finish(c, 1);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 匾额：深绿底金字，从右往左写
// 匾额：蓝底金字，外框是金色的云纹边，字从左往右写
export function plaqueTexture(text: string, vertical = false) {
  const chars = [...text];
  const W = vertical ? 300 : 260 * chars.length + 140;
  const H = vertical ? 250 * chars.length + 140 : 340;
  const { c, g } = canvas(W, H);
  // 金色外框
  const gold = g.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#e3c070');
  gold.addColorStop(0.5, '#b98a36');
  gold.addColorStop(1, '#e0bb66');
  g.fillStyle = gold;
  g.fillRect(0, 0, W, H);
  // 框上的回纹 / 云纹
  g.strokeStyle = 'rgba(110,70,20,0.55)';
  g.lineWidth = 3;
  const step = 34;
  for (let x = 10; x < W - 10; x += step) {
    for (const y of [16, H - 40]) {
      g.beginPath();
      g.arc(x + 12, y + 12, 9, Math.PI * 0.2, Math.PI * 1.8);
      g.stroke();
    }
  }
  for (let y = 10; y < H - 10; y += step) {
    for (const x of [16, W - 40]) {
      g.beginPath();
      g.arc(x + 12, y + 12, 9, Math.PI * 0.2, Math.PI * 1.8);
      g.stroke();
    }
  }
  // 蓝底
  const inset = 52;
  const bg = g.createLinearGradient(0, inset, 0, H - inset);
  bg.addColorStop(0, '#1d3b66');
  bg.addColorStop(1, '#142a4c');
  g.fillStyle = bg;
  g.fillRect(inset, inset, W - inset * 2, H - inset * 2);
  g.strokeStyle = '#d8b35c';
  g.lineWidth = 5;
  g.strokeRect(inset + 10, inset + 10, W - inset * 2 - 20, H - inset * 2 - 20);
  // 金字，带一点浮雕阴影
  g.font = `700 ${vertical ? 200 : 210}px "Songti SC","STSong","STKaiti","Kaiti SC","Noto Serif CJK SC",serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const x = vertical ? W / 2 : W / 2 + (i - (chars.length - 1) / 2) * 260;
    const y = vertical ? H / 2 + (i - (chars.length - 1) / 2) * 250 : H / 2 + 8;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillText(ch, x + 4, y + 5);
    const tg = g.createLinearGradient(0, y - 100, 0, y + 100);
    tg.addColorStop(0, '#f6dc8e');
    tg.addColorStop(0.55, '#d4a23e');
    tg.addColorStop(1, '#f0d080');
    g.fillStyle = tg;
    g.fillText(ch, x, y);
  });
  const tex = finish(c, 1);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 旋子彩画：青绿底，金线勾边，两端是旋花，中间是锦纹
export function caihuaTexture() {
  const { c, g } = canvas(1024, 128);
  g.fillStyle = '#1f5a5a';
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#244f86';
  g.fillRect(0, 16, 1024, 96);
  // 中间的锦纹
  for (let x = 300; x < 724; x += 32) {
    g.fillStyle = (x / 32) % 2 ? '#2a6f62' : '#2f4f8f';
    g.fillRect(x, 24, 32, 80);
    g.fillStyle = '#d9b35a';
    g.beginPath();
    g.moveTo(x + 16, 30);
    g.lineTo(x + 28, 64);
    g.lineTo(x + 16, 98);
    g.lineTo(x + 4, 64);
    g.closePath();
    g.globalAlpha = 0.6;
    g.fill();
    g.globalAlpha = 1;
  }
  // 两端的旋花
  for (const cx of [140, 884]) {
    for (let r = 46; r > 6; r -= 10) {
      g.fillStyle = r % 20 === 6 ? '#e8e2d0' : r % 20 === 16 ? '#2f6f63' : '#2a4f8c';
      g.beginPath();
      g.arc(cx, 64, r, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#d9b35a';
    g.lineWidth = 3;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * 30, 64 + Math.sin(a) * 30, 16, a + 1, a + 3.6);
      g.stroke();
    }
    g.fillStyle = '#c44a3a';
    g.beginPath();
    g.arc(cx, 64, 7, 0, Math.PI * 2);
    g.fill();
  }
  // 金线分界
  g.strokeStyle = '#d9b35a';
  g.lineWidth = 4;
  for (const x of [240, 300, 724, 784]) {
    g.beginPath();
    g.moveTo(x, 16);
    g.lineTo(x + (x < 512 ? 20 : -20), 64);
    g.lineTo(x, 112);
    g.stroke();
  }
  g.fillStyle = '#d9b35a';
  g.fillRect(0, 12, 1024, 4);
  g.fillRect(0, 112, 1024, 4);
  const tex = finish(c, 1);
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 井口天花：方格里画莲花，青绿底金边
export function cofferTexture() {
  const { c, g } = canvas(256);
  g.fillStyle = '#7a2a1e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const x = i * 128, y = j * 128;
      g.fillStyle = '#d4a84a';
      g.fillRect(x + 6, y + 6, 116, 116);
      g.fillStyle = '#1f4f7a';
      g.fillRect(x + 12, y + 12, 104, 104);
      g.fillStyle = '#2b6a5c';
      g.beginPath();
      g.arc(x + 64, y + 64, 40, 0, Math.PI * 2);
      g.fill();
      for (let p = 0; p < 8; p++) {
        const a = (p / 8) * Math.PI * 2;
        g.fillStyle = p % 2 ? '#e7d8b4' : '#d76f5a';
        g.beginPath();
        g.ellipse(x + 64 + Math.cos(a) * 22, y + 64 + Math.sin(a) * 22, 16, 7, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#e8c56a';
      g.beginPath();
      g.arc(x + 64, y + 64, 9, 0, Math.PI * 2);
      g.fill();
    }
  return finish(c, 1);
}

// 千佛壁：深红底，一格一格的小金佛
export function thousandBuddhaTexture() {
  const { c, g } = canvas(512);
  g.fillStyle = '#4a1610';
  g.fillRect(0, 0, 512, 512);
  const n = 8;
  const cell = 512 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = i * cell, y = j * cell;
      g.fillStyle = '#2e0c08';
      g.fillRect(x + 4, y + 4, cell - 8, cell - 8);
      // 龛
      g.fillStyle = '#6a2a1a';
      g.beginPath();
      g.moveTo(x + 10, y + cell - 8);
      g.lineTo(x + 10, y + 22);
      g.quadraticCurveTo(x + cell / 2, y + 2, x + cell - 10, y + 22);
      g.lineTo(x + cell - 10, y + cell - 8);
      g.closePath();
      g.fill();
      // 小佛：头光、头、身
      g.fillStyle = 'rgba(230,180,80,0.35)';
      g.beginPath();
      g.arc(x + cell / 2, y + 26, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d9a845';
      g.beginPath();
      g.arc(x + cell / 2, y + 26, 6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(x + cell / 2, y + 44, 11, 10, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(x + cell / 2, y + 54, 16, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
  return finish(c, 1);
}

// 黄色桌围：正中一朵莲花，四周回纹
export function altarClothTexture() {
  const { c, g } = canvas(512, 256);
  g.fillStyle = '#d9a52e';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#a3241a';
  g.fillRect(0, 0, 512, 28);
  g.fillRect(0, 228, 512, 28);
  g.strokeStyle = '#f2d48a';
  g.lineWidth = 3;
  for (let x = 6; x < 512; x += 26) {
    g.strokeRect(x, 6, 16, 16);
    g.strokeRect(x, 234, 16, 16);
  }
  // 莲花
  const cx = 256, cy = 132;
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    g.fillStyle = k % 2 ? '#c8423a' : '#e46a5a';
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * 34, cy + Math.sin(a) * 30 + 10, 30, 13, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#f3d27a';
  g.beginPath();
  g.ellipse(cx, cy + 14, 26, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2f7a5a';
  g.lineWidth = 5;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 40, cy + 30);
    g.bezierCurveTo(cx + s * 110, cy + 60, cx + s * 150, cy - 20, cx + s * 210, cy + 10);
    g.stroke();
    g.fillStyle = '#3f8a62';
    g.beginPath();
    g.ellipse(cx + s * 150, cy + 6, 26, 12, s * 0.4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = finish(c, 1);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 格扇门：朱红门框，上半是菱花格心（糊着白纸），下半是裙板
export function geshanTexture() {
  const { c, g } = canvas(256, 512);
  g.fillStyle = '#8c2418';
  g.fillRect(0, 0, 256, 512);
  // 格心
  g.fillStyle = '#efe6d0';
  g.fillRect(22, 22, 212, 300);
  g.strokeStyle = '#8c2418';
  g.lineWidth = 6;
  for (let k = -12; k < 24; k++) {
    g.beginPath();
    g.moveTo(22 + k * 22, 22);
    g.lineTo(22 + k * 22 + 300, 322);
    g.stroke();
    g.beginPath();
    g.moveTo(234 - k * 22, 22);
    g.lineTo(234 - k * 22 - 300, 322);
    g.stroke();
  }
  g.fillStyle = '#8c2418';
  g.fillRect(0, 0, 22, 512);
  g.fillRect(234, 0, 22, 512);
  g.fillRect(0, 0, 256, 22);
  g.fillRect(0, 322, 256, 22);
  // 金线和裙板
  g.strokeStyle = '#d4a84a';
  g.lineWidth = 3;
  g.strokeRect(22, 22, 212, 300);
  g.fillStyle = '#7a1f15';
  g.fillRect(34, 362, 188, 120);
  g.strokeRect(34, 362, 188, 120);
  g.fillStyle = '#d4a84a';
  g.beginPath();
  g.ellipse(128, 422, 40, 26, 0, 0, Math.PI * 2);
  g.globalAlpha = 0.5;
  g.fill();
  g.globalAlpha = 1;
  const tex = finish(c, 1);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 银杏叶簇：几十片扇形小叶（白色，实例颜色再染成金黄）
export function ginkgoClusterTexture(seed = 2) {
  const { c, g } = canvas(256);
  const r = rng(seed);
  for (let i = 0; i < 80; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 100;
    const x = 128 + Math.cos(a) * d;
    const y = 128 + Math.sin(a) * d;
    const l = 0.75 + r() * 0.25;
    g.fillStyle = `rgb(${Math.floor(255 * l)},${Math.floor(255 * l)},${Math.floor(240 * l)})`;
    const s = 11 + r() * 7;
    const rot = r() * Math.PI * 2;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, s, -Math.PI * 0.85, -Math.PI * 0.15);
    g.closePath();
    g.fill();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 袈裟：红褐底，金色细线分成一块块“福田”
export function kasayaTexture() {
  const { c, g } = canvas(256);
  g.fillStyle = '#8a3524';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#d9a65a';
  g.lineWidth = 5;
  for (let x = 0; x <= 256; x += 51) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  for (let y = 0; y <= 256; y += 85) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  const tex = finish(c, 1);
  return tex;
}

// 枫叶形状（白色，实例颜色再着色）
export function mapleLeafTexture() {
  const { c, g } = canvas(128);
  g.fillStyle = '#fff';
  g.translate(64, 70);
  g.beginPath();
  const pts = 5;
  for (let i = 0; i <= pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? 58 : 24;
    const jag = i % 2 === 0 ? 0 : 0;
    g.lineTo(Math.cos(a) * (rr + jag), Math.sin(a) * (rr + jag) * 0.95);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 一团叶簇（多片叶子叠在一张图上，做树冠用）
export function foliageClusterTexture(seed = 1) {
  const { c, g } = canvas(256);
  const r = rng(seed);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 100;
    const x = 128 + Math.cos(a) * d;
    const y = 128 + Math.sin(a) * d;
    const l = 0.72 + r() * 0.28;
    g.fillStyle = `rgb(${Math.floor(255 * l)},${Math.floor(255 * l)},${Math.floor(255 * l)})`;
    leafPath(g, x, y, 13 + r() * 9, r() * Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 水面法线（细小波纹）
export function waterNormalTexture() {
  const size = 256;
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const r = rng(91);
  const waves: [number, number, number, number][] = [];
  for (let i = 0; i < 14; i++) waves.push([r() * 6.28, 1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6), 0.3 + r()]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const [ph, fx, fy, a] of waves) {
        const v = Math.cos(((x * fx + y * fy) / size) * Math.PI * 2 + ph) * a;
        dx += v * fx;
        dy += v * fy;
      }
      const i = (y * size + x) * 4;
      img.data[i] = 128 + dx * 4;
      img.data[i + 1] = 128 + dy * 4;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, 3, false);
}

// 莲花灯：粉色花瓣的发光纹理
export function lanternTexture(hue: string) {
  const { c, g } = canvas(128);
  g.fillStyle = hue;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(i * 22 + (j % 2) * 11, j * 34 + 14, 9, 16, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(150,40,60,0.35)';
      g.lineWidth = 1.5;
      g.stroke();
    }
  }
  return finish(c, 1);
}
