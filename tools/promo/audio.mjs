// 宣传片配乐：全部用代码合成（不调用任何音乐生成模型）
// 古琴似的拨弦用 Karplus-Strong 算法，配梵钟、木鱼、磬、风声、鸟鸣、低声齐诵；时间轴与画面共用 timeline.mjs
// 用法：node tools/promo/audio.mjs 输出.wav
import fs from 'node:fs';
import { SHOTS, EVENTS, TOTAL, PROMPT_LINES } from './timeline.mjs';

const SR = 48000;
const LEN = Math.ceil((TOTAL + 0.2) * SR);
const L = new Float32Array(LEN), R = new Float32Array(LEN), SEND = new Float32Array(LEN);
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const at = (id) => SHOTS.find((s) => s.id === id).start;

function add(buf, time, gain, pan = 0, send = 0.3) {
  const i0 = Math.round(time * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < buf.length && i0 + i < LEN; i++) {
    if (i0 + i < 0) continue;
    const v = buf[i];
    L[i0 + i] += v * gl;
    R[i0 + i] += v * gr;
    SEND[i0 + i] += v * gain * send;
  }
}

// —— 二阶滤波器 ——
function biquad(type, f, q, gainDb = 0) {
  const w = (2 * Math.PI * f) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') [b0, b1, b2, a0, a1, a2] = [(1 - c) / 2, 1 - c, (1 - c) / 2, 1 + a, -2 * c, 1 - a];
  else if (type === 'hp') [b0, b1, b2, a0, a1, a2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + a, -2 * c, 1 - a];
  else if (type === 'bp') [b0, b1, b2, a0, a1, a2] = [a, 0, -a, 1 + a, -2 * c, 1 - a];
  else [b0, b1, b2, a0, a1, a2] = [1 + a * A, -2 * c, 1 - a * A, 1 + a / A, -2 * c, 1 - a / A]; // peak
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

// —— 古琴拨弦：Karplus-Strong，可滑音（吟猱）——
function qin(f0, dur, o = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  const size = 8192, buf = new Float32Array(size);
  const t60 = o.t60 ?? 5;
  const g = Math.pow(0.001, 1 / (f0 * t60));
  const P = SR / f0;
  let lp = 0;
  const bright = o.bright ?? 0.42;
  for (let i = 0; i < Math.ceil(P) + 2; i++) {
    lp += (rnd() * 2 - 1 - lp) * bright;
    buf[i] = lp;
  }
  let w = Math.ceil(P) + 2, prev = 0;
  const body1 = biquad('peak', 210, 1.2, 5), body2 = biquad('peak', 520, 1.4, 3), tone = biquad('lp', o.lp ?? 2600, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let f = f0;
    if (o.slideTo) {
      const k = Math.min(1, Math.max(0, (t - (o.slideAt ?? 0.35)) / (o.slideTime ?? 0.28)));
      f = f0 * Math.pow(o.slideTo / f0, k * k * (3 - 2 * k));
    }
    if (t > 0.3) f *= 1 + (o.vib ?? 0.0035) * Math.sin(2 * Math.PI * 4.8 * t) * Math.min(1, (t - 0.3) / 0.6);
    let rp = w - SR / f;
    while (rp < 0) rp += size;
    const i0 = Math.floor(rp), fr = rp - i0;
    const a = buf[i0 % size], b = buf[(i0 + 1) % size];
    const x = a + (b - a) * fr;
    const y = g * 0.5 * (x + prev);
    prev = x;
    buf[w % size] = y;
    w++;
    let v = tone(body2(body1(y)));
    if (i < SR * 0.012) v += (rnd() * 2 - 1) * 0.12 * (1 - i / (SR * 0.012)); // 指甲触弦的声音
    const rel = Math.min(1, (n - i) / (SR * 0.3));
    out[i] = v * rel;
  }
  return out;
}

// 泛音：清亮的纯音
function harm(f, dur = 3.2) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / 1.3);
    out[i] = env * (Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(2 * Math.PI * 2 * f * t + 0.4) + 0.06 * Math.sin(2 * Math.PI * 3 * f * t));
  }
  return out;
}

// 不和谐泛音叠加：梵钟、磬
function partials(f, list, dur, beat) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (const [ratio, amp, decay] of list) {
    for (const d of [-beat, beat]) {
      const fr = f * ratio + d, ph = rnd() * 6.28;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        out[i] += 0.5 * amp * Math.exp(-t / decay) * Math.min(1, t / 0.003) * Math.sin(2 * Math.PI * fr * t + ph);
      }
    }
  }
  return out;
}
function templeBell() {
  const out = partials(108, [[0.5, 0.15, 7], [1, 0.85, 5.5], [1.19, 0.55, 5.5], [1.5, 0.35, 4.5], [2, 0.42, 3.6], [2.52, 0.22, 2.6], [2.66, 0.18, 2.4], [3.01, 0.12, 2], [4.17, 0.07, 1.3], [5.43, 0.05, 0.9]], 11, 0.35);
  const bpf = biquad('bp', 420, 1.2);
  for (let i = 0; i < SR * 0.06; i++) out[i] += bpf((rnd() * 2 - 1) * (1 - i / (SR * 0.06))) * 1.2; // 撞木碰钟的木声
  return out;
}
function qing() {
  return partials(587, [[1, 1, 4.5], [2.76, 0.45, 2.2], [5.4, 0.2, 1.1], [8.93, 0.08, 0.6]], 6, 1.1);
}
function moktak() {
  const n = Math.round(0.35 * SR), out = new Float32Array(n);
  const bp = biquad('bp', 3200, 1.5);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const drop = 1 - 0.04 * Math.min(1, t / 0.05);
    out[i] = Math.exp(-t / 0.085) * Math.sin(2 * Math.PI * 540 * drop * t) + 0.45 * Math.exp(-t / 0.045) * Math.sin(2 * Math.PI * 1170 * t) + 0.4 * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 310 * t);
    if (t < 0.004) out[i] += bp(rnd() * 2 - 1) * 0.8;
  }
  return out;
}
function tick() {
  const n = Math.round(0.03 * SR), out = new Float32Array(n);
  const bp = biquad('bp', 2200, 2);
  for (let i = 0; i < n; i++) out[i] = bp(rnd() * 2 - 1) * Math.exp(-i / (SR * 0.006));
  return out;
}
function bird() {
  const n = Math.round(0.5 * SR), out = new Float32Array(n);
  let ph = 0;
  const notes = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR, k = Math.floor(t / 0.11), lt = t - k * 0.11;
    if (k >= notes || lt > 0.07) continue;
    const f = 3100 + 1300 * (lt / 0.07) + 300 * Math.sin(lt * 140);
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.sin((Math.PI * lt) / 0.07);
  }
  return out;
}
// 低声齐诵的「嗡」：几个人声锯齿波经过元音共振峰
function chant(dur) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  const voices = [98, 98.6, 97.3, 146.8, 147.5].map((f) => ({ f, ph: rnd() * 6.28 }));
  const forms = [biquad('bp', 460, 6), biquad('bp', 820, 7), biquad('bp', 2700, 8)];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (const v of voices) {
      v.ph += (2 * Math.PI * v.f * (1 + 0.002 * Math.sin(t * 3.1 + v.f))) / SR;
      for (let h = 1; h <= 24; h++) s += Math.sin(v.ph * h) / h;
    }
    const y = forms[0](s) * 1.0 + forms[1](s) * 0.55 + forms[2](s) * 0.12;
    const env = Math.min(1, t / 1.6) * Math.min(1, (dur - t) / 1.6);
    out[i] = y * env * 0.05;
  }
  return out;
}

// —— 编排 ——
const N = { D2: 73.42, A2: 110, B2: 123.47, D3: 146.83, E3: 164.81, Fs3: 185, A3: 220, B3: 246.94, D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440, B4: 493.88, D5: 587.33 };
const play = (time, note, gain = 0.5, o = {}, pan = 0) => add(qin(N[note], o.dur ?? 5, o), time, gain, pan, 0.35);

// 片头
play(0.12, 'D3', 0.55, { t60: 6, dur: 6 }, -0.1);
play(0.14, 'A2', 0.3, { t60: 6, dur: 6 }, 0.1);
{
  const chars = [...PROMPT_LINES.join('')];
  chars.forEach((_, i) => add(tick(), EVENTS.titleType.from + i * EVENTS.titleType.perChar, 0.05, 0.2, 0.1));
}
add(harm(N.A4 * 2), EVENTS.titleReveal, 0.18, 0.2, 0.5);
play(EVENTS.titleReveal, 'D4', 0.42, { t60: 5 }, -0.1);
add(qing(), EVENTS.titleSeal, 0.3, 0.25, 0.45);

// 山门、银杏林（清晨）
const g = at('gate');
const phrase1 = [[0.2, 'A3'], [0.95, 'D4'], [1.7, 'E4', { slideTo: N.Fs4, slideAt: 0.32 }], [2.8, 'A4'], [3.55, 'Fs4'], [4.3, 'E4'], [5.05, 'D4', { t60: 6, dur: 6 }]];
for (const [dt, note, o] of phrase1) play(g + dt, note, 0.48, o ?? {}, (rnd() - 0.5) * 0.4);
play(g + 0.2, 'D2', 0.32, { t60: 7, dur: 7, lp: 1400 });
play(g + 3.2, 'A2', 0.26, { t60: 6, dur: 6, lp: 1400 });
const gr = at('grove');
[[0.8, 'D5'], [1.55, 'A4'], [2.3, 'B4'], [3.05, 'Fs4']].forEach(([dt, note], i) => add(harm(N[note]), gr + dt, 0.2, i % 2 ? 0.3 : -0.3, 0.55));
for (const dt of [0.4, 1.6, 2.9, 3.7]) add(bird(), gr + dt, 0.035, rnd() - 0.5, 0.4);

// 石桥、院子（白天）
const b = at('bridge');
[[0.1, 'D4'], [0.85, 'E4'], [1.6, 'Fs4'], [2.35, 'A4', { slideTo: N.B4, slideAt: 0.3 }], [3.45, 'A4'], [4.2, 'Fs4']].forEach(([dt, note, o]) => play(b + dt, note, 0.46, o ?? {}, (rnd() - 0.5) * 0.4));
play(b + 0.1, 'D2', 0.3, { t60: 7, dur: 7, lp: 1400 });
const c = at('court');
[[0.3, 'E4'], [1.05, 'D4'], [1.8, 'B3'], [2.55, 'A3', { t60: 6, dur: 6 }], [3.7, 'D4']].forEach(([dt, note, o]) => play(c + dt, note, 0.46, o ?? {}, (rnd() - 0.5) * 0.4));
play(c + 0.3, 'B2', 0.26, { t60: 6, dur: 6, lp: 1400 });
play(c + 2.55, 'D2', 0.3, { t60: 7, dur: 7, lp: 1400 });

// 上香
const inc = at('incense');
add(harm(N.A4), inc + 0.8, 0.2, -0.2, 0.6);
add(harm(N.D5), inc + 1.9, 0.18, 0.2, 0.6);
play(inc + 2.9, 'D4', 0.34, { t60: 6, dur: 6 });

// 大殿：万籁俱寂，只剩低低的齐诵
const h = at('hall');
play(h + 0.1, 'D2', 0.32, { t60: 8, dur: 8, lp: 1200 });
add(chant(6.2), h + 0.2, 1.0, 0, 0.5);

// 钟、木鱼
add(templeBell(), at('bell') + EVENTS.bellHit, 0.3, -0.1, 0.5);
for (const dt of EVENTS.moktak) add(moktak(), at('moktak') + dt + EVENTS.moktakDelay, 0.42, 0.1, 0.25);

// 夜
const nt = at('night');
[[0.3, 'A3'], [1.05, 'D4'], [1.8, 'Fs4'], [2.55, 'E4', { slideTo: N.D4, slideAt: 0.4, slideTime: 0.4 }]].forEach(([dt, note, o]) => play(nt + dt, note, 0.42, o ?? {}, (rnd() - 0.5) * 0.4));
play(nt + 0.3, 'D2', 0.28, { t60: 7, dur: 7, lp: 1300 });
{
  // 虫鸣
  const n = Math.round(4.2 * SR), cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pulse = Math.max(0, Math.sin(2 * Math.PI * 28 * t)) * (Math.sin(2 * Math.PI * 0.9 * t) > 0.2 ? 1 : 0);
    cr[i] = Math.sin(2 * Math.PI * 4400 * t) * pulse * Math.min(1, t / 0.5) * Math.min(1, (4.2 - t) / 0.5);
  }
  add(cr, nt, 0.012, 0.5, 0.3);
}

// 片尾
const e = at('end');
['D3', 'A3', 'D4', 'Fs4'].forEach((note, i) => play(e + 0.2 + i * 0.12, note, 0.38, { t60: 6, dur: 4.4 }, -0.3 + i * 0.2));
add(qing(), e + EVENTS.endSeal, 0.3, 0.2, 0.45);
add(harm(N.D5), e + 2.4, 0.16, -0.2, 0.6);

// 风声底：贯穿全片，大殿里压低
{
  // 山风：带通噪声缓缓起伏，不要低频轰鸣
  const bl = biquad('bp', 650, 0.6), br2 = biquad('bp', 820, 0.6), hl = biquad('hp', 180, 0.7), hr = biquad('hp', 180, 0.7);
  for (let i = 0; i < LEN; i++) {
    const t = i / SR;
    const inside = t > h && t < at('night') ? 0.3 : 1;
    const amp = (0.55 + 0.45 * Math.sin(t * 0.41) * Math.sin(t * 0.17 + 1)) * inside * 0.022;
    L[i] += hl(bl(rnd() * 2 - 1)) * amp;
    R[i] += hr(br2(rnd() * 2 - 1)) * amp;
  }
}

// —— 混响（Freeverb）——
function freeverb(input, spread) {
  const k = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((l) => ({ buf: new Float32Array(Math.round((l + spread) * k)), i: 0, store: 0 }));
  const aps = [556, 441, 341, 225].map((l) => ({ buf: new Float32Array(Math.round((l + spread) * k)), i: 0 }));
  const fb = 0.86, damp = 0.3, out = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    const x = input[n] * 0.015;
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * fb;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = s + b * 0.5;
      s = b - s;
      a.i = (a.i + 1) % a.buf.length;
    }
    out[n] = s;
  }
  return out;
}
const wl = freeverb(SEND, 0), wr = freeverb(SEND, 23);

// —— 混音、限幅、淡入淡出、写 WAV ——
let peak = 0;
const mix = new Float32Array(LEN * 2);
const hpL = biquad('hp', 45, 0.7), hpR = biquad('hp', 45, 0.7);
for (let i = 0; i < LEN; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.05) * Math.min(1, (TOTAL - t) / 1.4);
  const l = Math.tanh(hpL(L[i] + wl[i] * 2.2) * 1.1) * Math.max(0, fade);
  const r = Math.tanh(hpR(R[i] + wr[i] * 2.2) * 1.1) * Math.max(0, fade);
  mix[i * 2] = l;
  mix[i * 2 + 1] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const norm = 0.89 / (peak || 1);
const data = Buffer.alloc(LEN * 4);
for (let i = 0; i < LEN * 2; i++) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(mix[i] * norm * 32767))), i * 2);
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
console.log(`写出 ${outPath}：${TOTAL.toFixed(2)} 秒，峰值归一化系数 ${norm.toFixed(2)}`);
