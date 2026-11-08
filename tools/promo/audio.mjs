// 宣传片配乐：全部用代码合成（不调用任何音乐生成模型）
// 72 拍/分、16 小节的完整编曲：古筝分解和弦（Karplus-Strong 拨弦）、笛子旋律、弦乐铺底、古琴低音、
// 堂鼓与木鱼的节奏、殿内低声齐诵和碰铃，加上梵钟、木鱼、磬、风声、鸟鸣；时间轴与画面共用 timeline.mjs
// 用法：node tools/promo/audio.mjs 输出.wav
import fs from 'node:fs';
import { SHOTS, EVENTS, TOTAL, PROMPT_LINES, BEAT, BAR, DOWNBEAT, CUT } from './timeline.mjs';

const SR = 48000;
const LEN = Math.ceil((TOTAL + 0.2) * SR);
const L = new Float32Array(LEN), R = new Float32Array(LEN), SEND = new Float32Array(LEN);
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const at = (id) => SHOTS.find((s) => s.id === id)?.start;
const has = (id) => at(id) !== undefined;
const EXPLAIN = CUT === 'explainer'; // 讲解视频：配乐垫在口播底下，旋律压低

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
        out[i] += 0.5 * amp * Math.exp(-t / decay) * Math.min(1, t / 0.003, (dur - t) / 1.5) * Math.sin(2 * Math.PI * fr * t + ph);
      }
    }
  }
  return out;
}
function templeBell() {
  const out = partials(108, [[0.5, 0.05, 4], [1, 0.75, 3.0], [1.19, 0.55, 3.0], [1.5, 0.35, 3.2], [2, 0.42, 2.8], [2.52, 0.22, 2.2], [2.66, 0.18, 2], [3.01, 0.12, 1.7], [4.17, 0.07, 1.1], [5.43, 0.05, 0.8]], 7, 0.35);
  const bpf = biquad('bp', 420, 1.2);
  for (let i = 0; i < SR * 0.06; i++) out[i] += bpf((rnd() * 2 - 1) * (1 - i / (SR * 0.06))) * 1.2; // 撞木碰钟的木声
  // 去掉最低的轰鸣，免得盖住后面的音乐
  const hp1 = biquad('hp', 95, 0.7), hp2 = biquad('hp', 95, 0.7);
  for (let i = 0; i < out.length; i++) out[i] = hp2(hp1(out[i]));
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
  const voices = [146.8, 147.4, 146.1, 110, 110.5].map((f) => ({ f, ph: rnd() * 6.28 }));
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

// —— 新加的乐器 ——
// 古筝：比古琴亮、短
const zheng = (f, gain, time, pan = 0) => add(qin(f, 2.6, { bright: 0.62, t60: 2.2, lp: 5200, vib: 0.002 }), time, gain, pan, 0.32);
// 笛子：正弦为主加少量泛音、气声和揉音，音头从上一个音滑过来
function dizi(f, dur, fromF = 0) {
  const n = Math.round((dur + 0.15) * SR), out = new Float32Array(n);
  const breath = biquad('bp', f * 2, 2.5);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let fr = fromF && t < 0.07 ? fromF + (f - fromF) * (t / 0.07) : f;
    if (t > 0.25) fr *= 1 + 0.006 * Math.sin(2 * Math.PI * 5.4 * t) * Math.min(1, (t - 0.25) / 0.4);
    ph += (2 * Math.PI * fr) / SR;
    const env = Math.min(1, t / 0.05) * (0.85 + 0.15 * Math.exp(-t / 0.4)) * Math.min(1, Math.max(0, (dur + 0.15 - t) / 0.15));
    const tone = Math.sin(ph) + 0.32 * Math.sin(2 * ph + 0.3) + 0.11 * Math.sin(3 * ph) + 0.04 * Math.sin(4 * ph);
    const air = breath(rnd() * 2 - 1) * (0.25 + (t < 0.04 ? 1.2 : 0));
    out[i] = env * (tone * 0.8 + air * 0.35);
  }
  return out;
}
// 弦乐铺底：几根略微走音的锯齿波，低通后慢起慢收
function pad(freqs, dur) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  const oscs = freqs.flatMap((f) => [0.996, 1, 1.004].map((d) => ({ f: f * d, ph: rnd() })));
  const lp1 = biquad('lp', 1100, 0.7), lp2 = biquad('lp', 1400, 0.6);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const o of oscs) {
      o.ph += o.f / SR;
      if (o.ph >= 1) o.ph -= 1;
      v += o.ph * 2 - 1;
    }
    const env = Math.min(1, t / 0.9) * Math.min(1, Math.max(0, (dur - t) / 1.1));
    out[i] = lp2(lp1(v / oscs.length)) * env;
  }
  return out;
}
function drum() {
  const n = Math.round(0.6 * SR), out = new Float32Array(n);
  const lp = biquad('lp', 900, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (82 + 70 * Math.exp(-t / 0.05))) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.28) + (t < 0.012 ? lp(rnd() * 2 - 1) * 0.6 : 0);
  }
  return out;
}
function woodblock() {
  const n = Math.round(0.2 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t / 0.04) * Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.exp(-t / 0.025) * Math.sin(2 * Math.PI * 1840 * t);
  }
  return out;
}
const pengling = () => partials(2620, [[1, 1, 1.3], [2.42, 0.4, 0.6], [4.1, 0.15, 0.3]], 2, 2.5);

// —— 编排：按镜头分段，整段对齐 72 拍/分的小节 ——
const N = {
  E2: 82.41, G2: 98, A2: 110, B2: 123.47, D2: 73.42, D3: 146.83, E3: 164.81, Fs3: 185, G3: 196, A3: 220, B3: 246.94,
  D4: 293.66, E4: 329.63, Fs4: 369.99, G4: 392, A4: 440, B4: 493.88, D5: 587.33, E5: 659.26, Fs5: 739.99, A5: 880,
};
const play = (time, note, gain = 0.5, o = {}, pan = 0) => add(qin(N[note], o.dur ?? 5, o), time, gain, pan, 0.35);
const barT = (k) => DOWNBEAT + k * BAR;
const barAt = (t) => Math.max(0, Math.ceil((t - DOWNBEAT) / BAR - 0.2));
const END = at('end') ?? at('eEnd');
const LAST = barAt(END); // 收束和弦落在片尾这一小节
const HALL0 = at('hallEnter') ?? at('hallFront'), HALL1 = at('rosary') ?? at('bell');
const SEC = {
  dawn: [0, barAt(at('pond'))],
  day: [barAt(at('pond')), barAt(at('hallFront'))],
  hall: [barAt(at('hallFront')), barAt(at('bell'))],
  dusk: [barAt(at('bell')), barAt(at('nightSide'))],
  night: [barAt(at('nightSide')), LAST],
};
const secOf = (k) => Object.keys(SEC).find((n) => k >= SEC[n][0] && k < SEC[n][1]) ?? 'end';
const CH = {
  D: { pad: ['D3', 'A3', 'E4', 'Fs4'], arp: ['D3', 'A3', 'D4', 'E4', 'Fs4', 'E4', 'D4', 'A3'], bass: 'D2' },
  Bm: { pad: ['B2', 'Fs3', 'A3', 'D4'], arp: ['B2', 'Fs3', 'B3', 'D4', 'E4', 'D4', 'B3', 'Fs3'], bass: 'B2' },
  G: { pad: ['G2', 'D3', 'B3', 'E4'], arp: ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3'], bass: 'G2' },
  A: { pad: ['A2', 'E3', 'A3', 'D4'], arp: ['A2', 'E3', 'A3', 'B3', 'E4', 'B3', 'A3', 'E3'], bass: 'A2' },
};
const CYCLE = ['D', 'Bm', 'G', 'A'];
const chordOf = (k) => (k >= LAST ? 'D' : CYCLE[k % 4]);
const PAD_GAIN = { dawn: 0.06, day: 0.075, hall: 0.085, dusk: 0.07, night: 0.06, end: 0.07 };
for (let k = 0; k <= LAST; k++) {
  const c = CH[chordOf(k)], t0 = barT(k), sec = secOf(k);
  add(pad(c.pad.map((n) => N[n]), k === LAST ? 5 : BAR + 1.2), t0 - 0.15, k === 0 ? 0.045 : PAD_GAIN[sec], 0, 0.4);
  if (k >= 1 && k < LAST) play(t0, c.bass, sec === 'dusk' ? 0.16 : 0.22, { t60: 4, dur: 4.5, lp: 1300 }, 0);
  // 古筝：清晨、白天、夜里八分音符；殿内四分音符；黄昏只在木鱼那几小节轻轻弹
  if (k === LAST) continue;
  let step = 1, g = 0.13;
  if (k === 0) g = 0.08;
  else if (sec === 'hall') (step = 2), (g = 0.1);
  else if (sec === 'dusk') (step = 2), (g = 0.07);
  else if (sec === 'night') g = 0.1;
  c.arp.forEach((n, i) => {
    if (i % step) return;
    zheng(N[n], i === 0 ? g * 1.3 : g, t0 + i * (BEAT / 2), ((i % 4) - 1.5) * 0.25);
  });
}
// 收束：片尾一个分解和弦
['D3', 'A3', 'D4', 'Fs4', 'A4'].forEach((note, i) => play(barT(LAST) + i * 0.1, note, 0.28, { t60: 6, dur: 4 }, -0.3 + i * 0.15));
// 古筝刮奏：白天、殿内、夜里开头
for (const k of [SEC.day[0], SEC.hall[0], SEC.night[0]]) {
  const run = ['D4', 'E4', 'Fs4', 'A4', 'B4', 'D5', 'E5', 'Fs5', 'A5'];
  run.forEach((n, i) => zheng(N[n], 0.07 + i * 0.006, barT(k) - 0.42 + i * 0.05, -0.4 + i * 0.1));
}

// 笛子旋律：每段四小节，[小节, 拍, 音, 拍数]
const PH = {
  P1: [[0, 0, 'A4', 2], [0, 2, 'B4', 1], [0, 3, 'A4', 1], [1, 0, 'Fs4', 2], [1, 2, 'E4', 1], [1, 3, 'D4', 1], [2, 0, 'E4', 1.5], [2, 1.5, 'Fs4', 0.5], [2, 2, 'A4', 1], [2, 3, 'B4', 1], [3, 0, 'A4', 3], [3, 3, 'Fs4', 1]],
  P2: [[0, 0, 'D5', 2], [0, 2, 'B4', 1], [0, 3, 'A4', 1], [1, 0, 'B4', 1.5], [1, 1.5, 'D5', 0.5], [1, 2, 'E5', 2], [2, 0, 'D5', 1], [2, 1, 'B4', 1], [2, 2, 'A4', 1], [2, 3, 'Fs4', 1], [3, 0, 'E4', 2], [3, 2, 'Fs4', 1], [3, 3, 'A4', 1]],
  P1b: [[0, 0, 'A4', 1], [0, 1, 'D5', 1], [0, 2, 'B4', 1], [0, 3, 'A4', 1], [1, 0, 'Fs4', 2], [1, 2, 'A4', 1], [1, 3, 'E4', 1], [2, 0, 'D4', 1], [2, 1, 'E4', 1], [2, 2, 'Fs4', 1], [2, 3, 'A4', 1], [3, 0, 'B4', 3], [3, 3, 'A4', 1]],
  P2b: [[0, 0, 'E5', 2], [0, 2, 'D5', 1], [0, 3, 'B4', 1], [1, 0, 'A4', 1.5], [1, 1.5, 'B4', 0.5], [1, 2, 'D5', 2], [2, 0, 'B4', 1], [2, 1, 'A4', 1], [2, 2, 'Fs4', 1], [2, 3, 'E4', 1], [3, 0, 'D4', 4]],
  P5: [[0, 0, 'Fs5', 1.5], [0, 1.5, 'E5', 0.5], [0, 2, 'D5', 2], [1, 0, 'B4', 1], [1, 1, 'D5', 1], [1, 2, 'E5', 2], [2, 0, 'A5', 2], [2, 2, 'Fs5', 1], [2, 3, 'E5', 1], [3, 0, 'D5', 4]],
  P3: [[0, 0, 'Fs5', 2], [0, 2, 'E5', 1], [0, 3, 'D5', 1], [1, 0, 'B4', 2], [1, 2, 'D5', 2], [2, 0, 'A4', 3], [2, 3, 'B4', 0.5], [2, 3.5, 'A4', 0.5], [3, 0, 'Fs4', 4]],
  P3b: [[0, 0, 'D5', 2], [0, 2, 'E5', 2], [1, 0, 'Fs5', 3], [1, 3, 'E5', 1], [2, 0, 'D5', 2], [2, 2, 'B4', 2], [3, 0, 'A4', 4]],
  P5b: [[0, 0, 'B4', 2], [0, 2, 'A4', 1], [0, 3, 'Fs4', 1], [1, 0, 'E4', 2], [1, 2, 'Fs4', 2], [2, 0, 'A4', 3], [2, 3, 'B4', 1], [3, 0, 'A4', 4]],
  P4: [[0, 0, 'A4', 2], [0, 2, 'Fs4', 2], [1, 0, 'E4', 1.5], [1, 1.5, 'D4', 0.5], [1, 2, 'E4', 2], [2, 0, 'Fs4', 2], [2, 2, 'A4', 1], [2, 3, 'B4', 1], [3, 0, 'A4', 4]],
  P6: [[0, 0, 'E4', 2], [0, 2, 'Fs4', 1], [0, 3, 'A4', 1], [1, 0, 'B4', 2], [1, 2, 'A4', 1], [1, 3, 'Fs4', 1]],
};
// 旋律从哪个镜头开始；与上一段不重叠，也不跨进下一个大段
PH.P7 = [[0, 0, 'D5', 2], [0, 2, 'B4', 1], [0, 3, 'A4', 1], [1, 0, 'Fs4', 4]]; // 两小节，殿内
const SCHEDULES = {
  short34: [['gate', 'P1'], ['court', 'P5'], ['buddha', 'P7'], ['nightSide', 'P6']],
};
const SCHEDULE = SCHEDULES[CUT] ?? [['gate', 'P1'], ['leaves', 'P2'], ['bridge', 'P1b'], ['sideHall', 'P2b'], ['ding', 'P5'], ['hallEnter', 'P3'], ['buddha', 'P3b'], ['altar', 'P5b'], ['nightSide', 'P4'], ['night', 'P6']];
{
  let free = 1, prevF = 0, prevEnd = -9;
  const placed = [];
  for (const [shot, name] of SCHEDULE) {
    if (!has(shot)) continue;
    const k0 = Math.max(barAt(at(shot)), free);
    const bars = Math.max(...PH[name].map((n) => n[0])) + 1;
    const sec = secOf(k0);
    // 旋律不进黄昏钟鼓那几小节，也不越过片尾；放不下就跳过
    const blocked = (k) => (k >= SEC.dusk[0] && k < SEC.dusk[1]) || k >= LAST;
    if ([...Array(bars).keys()].some((i) => blocked(k0 + i))) continue;
    placed.push(`${name}@${k0}`);
    for (const [bar, beat, note, len] of PH[name]) {
      const t0 = barT(k0 + bar) + beat * BEAT, f = N[note];
      const legato = Math.abs(t0 - prevEnd) < 0.05;
      add(dizi(f, len * BEAT - 0.04, legato ? prevF : 0), t0, (sec === 'night' ? 0.17 : 0.2) * (EXPLAIN ? 0.45 : 1), 0.08, 0.45);
      prevF = f;
      prevEnd = t0 + len * BEAT;
    }
    free = k0 + bars;
  }
  // 最后一个音落在片尾
  add(dizi(N.D4, BEAT * 4.5, prevF), barT(LAST), 0.17 * (EXPLAIN ? 0.45 : 1), 0.08, 0.5);
  console.log('旋律：' + placed.join(' '));
}

// 节奏：院子里堂鼓 + 木鱼；殿内木鱼每拍轻敲、碰铃，「万籁此俱寂」那两个镜头全部停下
const quiet = [at('rows') ?? -1, at('buddha') ?? -1];
for (let k = 1; k < LAST; k++) {
  const sec = secOf(k);
  for (let b = 0; b < 4; b++) {
    const t0 = barT(k) + b * BEAT;
    if (sec === 'day' && t0 >= (at('court') ?? 0)) {
      if (b === 0) add(drum(), t0, 0.2, 0, 0.2);
      if (b === 2) add(drum(), t0, 0.12, 0, 0.2);
      if (b === 1 || b === 3) add(woodblock(), t0, 0.06, 0.3, 0.2);
    } else if (sec === 'hall' && t0 >= HALL0 && !(t0 >= quiet[0] && t0 < quiet[1]) && t0 < HALL1) {
      if (b === 0) add(drum(), t0, 0.1, 0, 0.25);
      add(woodblock(), t0, 0.045, 0.3, 0.25);
      if (b === 0) add(pengling(), t0, 0.05, -0.3, 0.5);
    }
  }
}

// 片头
play(0.12, 'D3', 0.45, { t60: 6, dur: 6 }, -0.1);
play(0.14, 'A2', 0.25, { t60: 6, dur: 6 }, 0.1);
{
  const chars = [...PROMPT_LINES.join('')];
  const t0 = EXPLAIN ? at('ePrompt') ?? 0 : 0;
  chars.forEach((_, i) => add(tick(), t0 + EVENTS.titleType.from + i * EVENTS.titleType.perChar, 0.05, 0.2, 0.1));
}
add(harm(N.A5), EVENTS.titleReveal, 0.14, 0.2, 0.5);
add(qing(), EVENTS.titleSeal, 0.26, 0.25, 0.45);

// 清晨的鸟
for (const [shot, dts] of [['grove', [0.4, 1.6, 2.9]], ['leaves', [0.8, 2.4]], ['pond', [1.2]]]) if (has(shot)) for (const dt of dts) add(bird(), at(shot) + dt, 0.03, rnd() - 0.5, 0.4);
// 殿内低声齐诵：从进殿到撞钟前
add(chant(at('bell') - HALL0 + 0.6), HALL0, EXPLAIN ? 0.7 : 1.1, 0, 0.5);
// 念珠一颗颗拨过的轻响
for (const dt of EVENTS.rosary) add(woodblock(), at('rosary') + dt, 0.025, 0.2, 0.2);
// 黄昏：钟、鼓、木鱼
add(templeBell(), at('bell') + EVENTS.bellHit, 0.2, -0.1, 0.25);
for (const dt of EVENTS.drum) add(drum(), at('drum') + dt + EVENTS.drumDelay, 0.5, 0.15, 0.35);
for (const dt of EVENTS.moktak) add(moktak(), at('moktak') + dt + EVENTS.moktakDelay, 0.34, 0.1, 0.25);
// 夜里的虫鸣
{
  const t0 = at('nightSide'), dur = END + 1 - t0;
  const n = Math.round(dur * SR), cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pulse = Math.max(0, Math.sin(2 * Math.PI * 28 * t)) * (Math.sin(2 * Math.PI * 0.9 * t) > 0.2 ? 1 : 0);
    cr[i] = Math.sin(2 * Math.PI * 4400 * t) * pulse * Math.min(1, t / 0.8) * Math.min(1, (dur - t) / 0.8);
  }
  add(cr, t0, 0.01, 0.5, 0.3);
}
// 片尾：磬、泛音
add(qing(), END + EVENTS.endSeal, 0.24, 0.2, 0.45);
add(harm(N.D5 * 2), END + 2.6, 0.1, -0.2, 0.6);

// 风声底：贯穿全片，很轻
{
  const bl = biquad('bp', 650, 0.6), br2 = biquad('bp', 820, 0.6), hl = biquad('hp', 180, 0.7), hr = biquad('hp', 180, 0.7);
  for (let i = 0; i < LEN; i++) {
    const t = i / SR;
    const amp = (0.55 + 0.45 * Math.sin(t * 0.41) * Math.sin(t * 0.17 + 1)) * 0.012;
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
