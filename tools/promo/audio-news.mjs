// 「山寺上新」的配乐：100 拍/分钟，明快、有鼓点（用户要求宣传片配乐不要太舒缓）。全部用代码合成，不调用任何音乐生成模型。
//   鼓：底鼓、拍手军鼓、八分踩镲、十六分沙锤；贝斯：跟和弦的切分低音；古筝式拨弦奏主题；笛子式长音在后半段接旋律；
//   寺院的音色只当节奏点用：木鱼在小节尾、抄经时每次落墨敲一下；梵钟只在开头、片尾各一声。
//   和弦每小节一换：D – A – Bm – G（D 大调五声）。段落按镜头：
//     开头一小节引子（成片没有片头，直接是咖啡馆外景）→ 咖啡馆一段（全鼓组）→ 灯廊、柿饼一段（12 小节，加笛子）→ 抄经（3 小节，半拍子、只留底鼓和踩镲）
//     → 入夜（3 小节，全鼓组加镲）→ 片尾（收在主和弦上，梵钟余音）
// 用法：CUT=news node tools/promo/audio-news.mjs 输出.wav
import fs from 'node:fs';
import { SHOTS, EVENTS, TOTAL, BEAT, BAR } from './timeline.mjs';

const SR = 48000;
const LEN = Math.ceil((TOTAL + 0.3) * SR);
const L = new Float32Array(LEN), R = new Float32Array(LEN), SEND = new Float32Array(LEN);
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const at = (id) => SHOTS.find((s) => s.id === id)?.start ?? 0;

// 把一段单声道的声音放到时间轴上：gain 音量、pan 左右（-1..1）、send 送进混响的比例
function add(buf, time, gain, pan = 0, send = 0) {
  const i0 = Math.round(time * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2, gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = 0; i < buf.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= LEN) continue;
    L[j] += buf[i] * gl;
    R[j] += buf[i] * gr;
    SEND[j] += buf[i] * gain * send;
  }
}
// 一阶低通 / 高通（简单够用）
function lp(buf, f) {
  const a = Math.exp((-2 * Math.PI * f) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) buf[i] = y = (1 - a) * buf[i] + a * y;
  return buf;
}
function hp(buf, f) {
  const a = Math.exp((-2 * Math.PI * f) / SR);
  let y = 0, x0 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    y = a * (y + x - x0);
    x0 = x;
    buf[i] = y;
  }
  return buf;
}
function bp(buf, f, q = 1) {
  // 二阶带通（RBJ）
  const w = (2 * Math.PI * f) / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[i] = y;
  }
  return buf;
}
const env = (i, n, a, d) => Math.min(1, i / (a * SR)) * Math.exp(-i / (d * SR));

// —— 鼓 ——
function kick() {
  const n = Math.floor(0.42 * SR), b = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 46 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    b[i] = Math.sin(ph) * Math.exp(-t * 7.5) + (i < 90 ? (rnd() * 2 - 1) * 0.35 * (1 - i / 90) : 0);
  }
  return b;
}
function clap() {
  const n = Math.floor(0.32 * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // 三下很快的拍手 + 一点尾巴
    const burst = [0, 0.011, 0.023].reduce((s, o) => s + (t >= o ? Math.exp(-(t - o) * 140) : 0), 0) + 0.45 * Math.exp(-t * 18);
    b[i] = (rnd() * 2 - 1) * burst;
  }
  bp(b, 1500, 0.9);
  // 军鼓的鼓皮
  for (let i = 0; i < n; i++) b[i] += Math.sin((2 * Math.PI * 190 * i) / SR) * Math.exp(-i / SR / 0.05) * 0.5;
  return b;
}
function hat(open = false) {
  const n = Math.floor((open ? 0.26 : 0.05) * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = (rnd() * 2 - 1) * Math.exp(-i / SR / (open ? 0.09 : 0.013));
  return hp(hp(b, 7000), 7000);
}
function shaker() {
  const n = Math.floor(0.07 * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = (rnd() * 2 - 1) * env(i, n, 0.012, 0.02);
  return bp(b, 6200, 1.2);
}
function crash() {
  const n = Math.floor(2.2 * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = (rnd() * 2 - 1) * Math.exp(-i / SR / 0.6);
  return hp(b, 4200);
}
// 木鱼：圆润的「笃」
function woodblock(f = 820) {
  const n = Math.floor(0.25 * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b[i] = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.7 * t)) * Math.exp(-t * 32) + (i < 40 ? (rnd() * 2 - 1) * 0.3 : 0);
  }
  return b;
}
// 梵钟、小磬
function partials(f, list, dur) {
  const n = Math.floor(dur * SR), b = new Float32Array(n);
  for (const [r, a, d] of list) for (let i = 0; i < n; i++) b[i] += a * Math.sin((2 * Math.PI * f * r * i) / SR) * Math.exp(-i / SR / d) * Math.min(1, i / 200);
  return b;
}
const templeBell = () => partials(98, [[1, 0.6, 4], [1.006, 0.4, 3.5], [2.76, 0.35, 2], [5.4, 0.2, 1], [8.9, 0.08, 0.5]], 6);
const ding = (f = 1568) => partials(f, [[1, 0.6, 1.4], [2.42, 0.25, 0.6], [4.1, 0.1, 0.3]], 2.2);

// —— 旋律乐器 ——
const N = { D2: 73.42, E2: 82.41, Fs2: 92.5, G1: 49, G2: 98, A1: 55, A2: 110, B1: 61.74, B2: 123.47, D3: 146.83, Fs3: 185, A3: 220, B3: 246.94, D4: 293.66, E4: 329.63, Fs4: 369.99, G4: 392, A4: 440, B4: 493.88, D5: 587.33, E5: 659.26, Fs5: 739.99, A5: 880, B5: 987.77, Cs4: 277.18, Cs5: 554.37, G3: 196, E3: 164.81 };
// 古筝式拨弦：弦振动（Karplus-Strong），起音亮、很快变暗
function pluck(f, dur = 1.6, bright = 0.6) {
  const n = Math.floor(dur * SR), b = new Float32Array(n);
  const P = Math.max(2, Math.round(SR / f));
  const line = new Float32Array(P);
  for (let i = 0; i < P; i++) line[i] = (rnd() * 2 - 1) * (0.5 + 0.5 * bright);
  let k = 0, prev = 0;
  const damp = 0.996 - (1 - bright) * 0.004;
  for (let i = 0; i < n; i++) {
    const cur = line[k];
    const nx = line[(k + 1) % P];
    line[k] = ((cur + nx) / 2) * damp * (1 - bright * 0.02) + prev * bright * 0.02;
    prev = cur;
    b[i] = cur;
    k = (k + 1) % P;
  }
  // 拨弦的指甲声
  for (let i = 0; i < 120; i++) b[i] += (rnd() * 2 - 1) * 0.25 * (1 - i / 120);
  return lp(b, 5200);
}
// 笛子式长音：带气声和颤音
function flute(f, dur) {
  const n = Math.floor(dur * SR), b = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.4);
    ph += (2 * Math.PI * f * vib) / SR;
    const a = Math.min(1, t / 0.06) * Math.min(1, (dur - t) / 0.12);
    b[i] = a * (Math.sin(ph) + 0.28 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph) + (rnd() * 2 - 1) * 0.05);
  }
  return lp(b, 4800);
}
// 贝斯：正弦加一点锯齿，低通
function bass(f, dur) {
  const n = Math.floor(dur * SR), b = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f) / SR;
    const saw = 2 * ((ph / (2 * Math.PI)) % 1) - 1;
    b[i] = (Math.sin(ph) * 0.85 + saw * 0.22) * Math.min(1, t / 0.005) * Math.min(1, (dur - t) / 0.03) * Math.exp(-t * 1.2);
  }
  return lp(b, 900);
}
// 铺底和弦：几把略走音的锯齿，慢起慢收
function pad(freqs, dur) {
  const n = Math.floor(dur * SR), b = new Float32Array(n);
  for (const f of freqs)
    for (const det of [-0.004, 0.004]) {
      let ph = rnd();
      for (let i = 0; i < n; i++) {
        ph += (f * (1 + det)) / SR;
        const t = i / SR;
        b[i] += (2 * (ph % 1) - 1) * Math.min(1, t / 0.5) * Math.min(1, (dur - t) / 0.6) * 0.18;
      }
    }
  return lp(lp(b, 1400), 1400);
}

// —— 编排 ——
const bars = Math.ceil(TOTAL / BAR) + 1;
const barT = (k) => k * BAR;
// 各段从第几小节开始（镜头起点都在小节线上）
const S = {
  cafe: Math.round(at('nCafe') / BAR),
  alley: Math.round(at('nAlley') / BAR),
  sutra: Math.round(at('nSutra') / BAR),
  night: Math.round(at('nNight') / BAR),
  end: Math.round(at('nEnd') / BAR),
};
const CH = [
  { root: N.D2, tones: [N.D4, N.Fs4, N.A4], pad: [N.D3, N.Fs3, N.A3] },
  { root: N.A1, tones: [N.Cs4, N.E4, N.A4], pad: [N.A2 * 1, N.Cs4 / 2, N.E3] },
  { root: N.B1, tones: [N.B3, N.D4, N.Fs4], pad: [N.B2, N.D3, N.Fs3] },
  { root: N.G1, tones: [N.B3, N.D4, N.G4], pad: [N.G2, N.B2, N.D3] },
];
// 主题：两小节一句，八分音符（null 是空拍）
const HOOK = [
  ['A4', null, 'B4', 'A4', 'Fs4', null, 'E4', null, 'E4', null, 'Fs4', 'A4', 'B4', null, 'A4', null],
  ['Fs4', null, 'A4', 'B4', 'D5', null, 'B4', 'A4', 'B4', null, 'A4', 'Fs4', 'E4', null, 'D4', null],
  ['A4', 'B4', 'D5', null, 'E5', null, 'D5', 'B4', 'A4', null, 'Fs4', 'E4', 'Fs4', null, null, null],
  ['D5', null, 'B4', 'A4', 'B4', null, 'A4', 'Fs4', 'E4', 'Fs4', 'A4', null, 'D4', null, null, null],
];
// 笛子：四小节一句（音名、拍数）
const LEAD = [
  [['Fs5', 2], ['E5', 1], ['D5', 1]],
  [['E5', 4]],
  [['Fs5', 2], ['A5', 2]],
  [['B5', 2], ['A5', 1], ['Fs5', 1]],
  [['A5', 2], ['Fs5', 1], ['E5', 1]],
  [['Fs5', 3], ['E5', 1]],
  [['D5', 2], ['E5', 1], ['Fs5', 1]],
  [['D5', 4]],
];
const swing = (k8) => (k8 % 2 ? BEAT * 0.06 : 0); // 反拍略往后，轻微摇摆

for (let k = 0; k < bars; k++) {
  const t0 = barT(k);
  if (t0 > TOTAL) break;
  const ch = CH[k % 4];
  // 引子：成片开头的头一小节（前面有片头时是片头那几小节）
  const introEnd = Math.max(1, S.cafe);
  const intro = k < introEnd, A = !intro && k < S.alley, B = k >= S.alley && k < S.sutra, C = k >= S.sutra && k < S.night;
  const D = k >= S.night && k < S.end, END = k >= S.end;
  // 鼓
  if (END) {
    if (k === S.end) {
      add(kick(), t0, 0.95);
      add(crash(), t0, 0.32, 0.2, 0.2);
    }
  } else if (C) {
    // 抄经：半拍子，只留底鼓和踩镲，让落墨的木鱼声出来
    add(kick(), t0, 0.8);
    add(kick(), t0 + 2 * BEAT, 0.6);
    for (let e = 0; e < 8; e++) add(hat(), t0 + e * (BEAT / 2) + swing(e), e % 2 ? 0.16 : 0.24, 0.25);
  } else if (intro) {
    if (k < introEnd - 1) for (let s = 0; s < 16; s++) add(shaker(), t0 + s * (BEAT / 4), s % 4 === 0 ? 0.2 : 0.1, -0.3);
    if (k === introEnd - 1) {
      for (let s = 0; s < 16; s++) add(shaker(), t0 + s * (BEAT / 4), s % 4 === 0 ? 0.16 : 0.08, -0.3);
      add(kick(), t0, 0.85);
      add(kick(), t0 + 2 * BEAT, 0.8);
      for (let e = 0; e < 8; e++) add(hat(), t0 + e * (BEAT / 2) + swing(e), 0.2, 0.25);
      // 进主歌前一串拍手
      for (let s = 0; s < 4; s++) add(clap(), t0 + 3 * BEAT + s * (BEAT / 4), 0.25 + s * 0.08, 0, 0.08);
    }
  } else {
    // 全鼓组：底鼓 1、2 后半、3；拍手在 2、4；八分踩镲；十六分沙锤
    for (const b of [0, 1.5, 2]) add(kick(), t0 + b * BEAT, b === 0 ? 0.95 : 0.8);
    for (const b of [1, 3]) add(clap(), t0 + b * BEAT, 0.5, 0, 0.1);
    for (let e = 0; e < 8; e++) add(hat(e === 7 && k % 4 === 3), t0 + e * (BEAT / 2) + swing(e), e % 2 ? 0.2 : 0.3, 0.25);
    for (let s = 0; s < 16; s++) add(shaker(), t0 + s * (BEAT / 4), s % 2 ? 0.07 : 0.11, -0.35);
    // 每四小节最后一拍一串军鼓
    if (k % 4 === 3) for (let s = 0; s < 4; s++) add(clap(), t0 + 3 * BEAT + s * (BEAT / 4), 0.18 + s * 0.06, 0, 0.06);
    // 木鱼在小节尾的反拍上「笃」一声（两小节一次）
    if (k % 2 === 1) add(woodblock(), t0 + 3.5 * BEAT, 0.42, -0.4, 0.15);
    if ((A && k === introEnd) || (D && k === Math.ceil(S.night)) || (B && k === Math.ceil(S.alley))) add(crash(), t0, 0.3, 0.2, 0.2);
  }
  // 贝斯
  if (!intro && !END) {
    if (C) add(bass(ch.root, BAR * 0.95), t0, 0.55);
    else {
      const pat = [[0, 1.4, 1], [1.5, 0.45, 2], [2.5, 0.45, 1.5], [3.5, 0.45, 1]];
      for (const [b, d, m] of pat) add(bass(ch.root * m, d * BEAT), t0 + b * BEAT, 0.62);
    }
  }
  if (k === S.end) add(bass(N.D2, BAR * 1.5), t0, 0.65);
  // 铺底和弦（引子和抄经段落小一些）
  if (!END || k === S.end) add(pad(ch.pad, BAR * (k === S.end ? 2.2 : 1.02)), t0, intro ? 0.18 : C ? 0.2 : 0.26, 0, 0.35);
  // 古筝主题：引子、咖啡馆一段、入夜一段；灯廊一段轻一点做伴奏
  const hookOn = (intro && k >= 0) || A || D || B;
  if (hookOn) {
    const ph = HOOK[Math.floor(k / 2) % HOOK.length];
    const half = k % 2;
    for (let e = 0; e < 8; e++) {
      const note = ph[half * 8 + e];
      if (!note) continue;
      add(pluck(N[note], 1.4, 0.65), t0 + e * (BEAT / 2) + swing(e), B ? 0.24 : intro && k === 0 ? 0.3 : 0.38, 0.3, 0.25);
    }
  }
  // 抄经段落：拨弦只弹和弦分解，留出空间
  if (C) ch.tones.forEach((f, i) => add(pluck(f, 1.6, 0.5), t0 + i * BEAT * 0.5, 0.22, 0.3, 0.3));
  // 笛子：灯廊一段接旋律，入夜一段再吹一遍
  if (B || D) {
    const ph = LEAD[Math.round(k - (B ? S.alley : S.night)) % LEAD.length];
    let b = 0;
    for (const [note, beats] of ph) {
      add(flute(N[note], beats * BEAT * 0.96), t0 + b * BEAT, D ? 0.2 : 0.22, -0.25, 0.35);
      b += beats;
    }
  }
}
// 收尾：主和弦一拨到底
if (S.end) {
  const t = barT(S.end);
  [N.D4, N.Fs4, N.A4, N.D5].forEach((f, i) => add(pluck(f, 3.2, 0.55), t + i * 0.06, 0.32, 0.3, 0.35));
  add(templeBell(), t + 0.05, 0.42, 0, 0.5);
}
// 开头：一声梵钟，接一串拨弦上行
add(templeBell(), 0.02, 0.4, 0, 0.5);
['D4', 'E4', 'Fs4', 'A4', 'B4', 'D5'].forEach((n, i) => add(pluck(N[n], 1.2, 0.6), 0.6 + i * 0.12, 0.2, 0.3, 0.3));

// —— 画面里的动作：同一拍上发声 ——
const ev = (id, rel) => at(id) + rel;
add(ding(1568), ev('nBar', EVENTS.nCupReady), 0.32, 0.3, 0.4); // 咖啡做好
add(ding(1760), ev('nTreat', EVENTS.nGive), 0.3, -0.2, 0.4); // 递过去
add(ding(2093), ev('nTreat', EVENTS.nGive) + 0.3, 0.18, 0.2, 0.4);
{
  // 灯离手往上升：一阵升调的气声 + 三颗小铃
  const t = ev('nHang', EVENTS.nHangRelease);
  const n = Math.floor(1.6 * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = (rnd() * 2 - 1) * Math.sin((Math.PI * i) / n) * 0.5;
  bp(b, 2400, 0.8);
  add(b, t, 0.18, 0, 0.4);
  [1760, 2093, 2637].forEach((f, i) => add(ding(f), t + 0.4 + i * BEAT / 2, 0.16, (i - 1) * 0.3, 0.45));
}
// 柿柿如意：小磬上行琶音
[1175, 1397, 1760, 2093].forEach((f, i) => add(ding(f), ev('nPersimmon', EVENTS.nPersimmon) + i * 0.1, 0.17, (i - 1.5) * 0.25, 0.45));
// 键盘抄经：每次落墨，木鱼轻轻「笃」一下（高一点的木鱼）
for (const tt of EVENTS.nInk) add(woodblock(1150), ev('nSutra', tt), 0.36, 0.15, 0.2);

// —— 混响（Schroeder：四个梳状 + 两个全通），左右声道错开一点 ——
function reverb(input, spread) {
  const out = new Float32Array(LEN);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: d + spread, buf: new Float32Array(d + spread), i: 0, f: 0 }));
  for (let i = 0; i < LEN; i++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.f = y * 0.75 + c.f * 0.25;
      c.buf[c.i] = input[i] * 0.3 + c.f * 0.82;
      c.i = (c.i + 1) % c.d;
      s += y;
    }
    out[i] = s;
  }
  for (const d of [556 + spread, 441 + spread]) {
    const buf = new Float32Array(d);
    let k = 0;
    for (let i = 0; i < LEN; i++) {
      const y = buf[k];
      buf[k] = out[i] + y * 0.5;
      out[i] = y - out[i] * 0.5;
      k = (k + 1) % d;
    }
  }
  return out;
}
const wl = reverb(SEND, 0), wr = reverb(SEND, 23);
for (let i = 0; i < LEN; i++) {
  L[i] += wl[i] * 0.22;
  R[i] += wr[i] * 0.22;
}
// 低切、柔和限幅、归一化，开头结尾淡入淡出
hp(L, 30);
hp(R, 30);
let peak = 0;
for (let i = 0; i < LEN; i++) {
  L[i] = Math.tanh(L[i] * 1.1);
  R[i] = Math.tanh(R[i] * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / (peak || 1);
const fadeOut = Math.floor(1.2 * SR);
const data = Buffer.alloc(LEN * 4);
for (let i = 0; i < LEN; i++) {
  const f = Math.min(1, i / 600) * Math.min(1, (LEN - i) / fadeOut);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm * f)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm * f)) * 32767), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0);
hdr.writeUInt32LE(36 + data.length, 4);
hdr.write('WAVE', 8);
hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16);
hdr.writeUInt16LE(1, 20);
hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28);
hdr.writeUInt16LE(4, 32);
hdr.writeUInt16LE(16, 34);
hdr.write('data', 36);
hdr.writeUInt32LE(data.length, 40);
const outPath = process.argv[2] || '/tmp/sansa-promo/score.wav';
fs.writeFileSync(outPath, Buffer.concat([hdr, data]));
console.log('配乐', outPath, TOTAL.toFixed(1), '秒');
