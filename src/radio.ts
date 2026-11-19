// 耳机电台：三个台，全部用 Web Audio 实时合成（不用录音、不调用任何音乐生成模型）。
//   lofi  山间 lo-fi：76 拍，电钢琴七和弦、软底鼓、轻军鼓、摇摆的踩镲、贝斯，偶尔一句五声音阶的小旋律，底下一层黑胶噪声
//   rain  雨天钢琴：一直下着的雨声，钢琴慢慢分解和弦，偶尔屋檐滴水
//   qin   古琴夜话：拨弦（Karplus–Strong 合成）走五声音阶，偶尔滑音，低音持续，远处几声虫鸣
// 拍子用 AudioContext 的时钟排：每 25 毫秒看一眼，把接下来 0.15 秒里的音符排进去
import type { AudioEngine } from './audio';
import { STATION_BPM } from './monk';

export type StationId = 'lofi' | 'rain' | 'qin';
export const STATIONS: StationId[] = ['lofi', 'rain', 'qin'];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Radio {
  station: StationId | null = null;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private tone: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private t0 = 0;
  private stepT = 0;
  private step = 0;
  private timer = 0;
  private beds: { stop(): void }[] = [];
  private ks = new Map<number, AudioBuffer>();
  private melody = 0;
  private listeners = new Set<() => void>();

  constructor(private audio: AudioEngine) {}

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }
  get on() {
    return this.station !== null;
  }
  // 从开播算起过了几拍（小和尚点头用）
  beats() {
    if (!this.ctx || !this.station) return 0;
    return Math.max(0, (this.ctx.currentTime - this.t0) * (STATION_BPM[this.station] / 60));
  }

  async start(id: StationId) {
    if (!this.audio.enabled) await this.audio.enable();
    const ctx = this.audio.ctx;
    const bus = this.audio.radioOut();
    if (!ctx || !bus) return;
    this.stopSound();
    this.ctx = ctx;
    this.station = id;
    // 整台的音色：lo-fi 收高频，其余稍亮；一点点回声
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = id === 'lofi' ? 3200 : id === 'rain' ? 6000 : 7000;
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = (60 / STATION_BPM[id]) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = id === 'lofi' ? 0.12 : 0.26;
    this.out.connect(this.tone).connect(bus);
    this.out.connect(this.delay);
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.tone);
    this.beds = [];
    if (id === 'lofi') this.beds.push(this.crackle());
    if (id === 'rain') this.beds.push(this.rainBed());
    if (id === 'qin') this.beds.push(this.drone());
    this.t0 = ctx.currentTime + 0.12;
    this.stepT = this.t0;
    this.step = 0;
    this.melody = 0;
    this.audio.duckForRadio(true);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 25);
    this.emit();
  }

  stop() {
    this.stopSound();
    this.station = null;
    this.audio.duckForRadio(false);
    this.emit();
  }

  private stopSound() {
    window.clearInterval(this.timer);
    this.timer = 0;
    const ctx = this.ctx, out = this.out;
    for (const b of this.beds) b.stop();
    this.beds = [];
    if (ctx && out) {
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => out.disconnect(), 900);
    }
    this.out = null;
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || !this.station || !this.out) return;
    const sixteenth = 60 / STATION_BPM[this.station] / 4;
    // 标签页被挂起回来以后，不补排已经过去的音符
    if (this.stepT < ctx.currentTime - 0.5) {
      const skip = Math.ceil((ctx.currentTime - this.stepT) / sixteenth);
      this.step += skip;
      this.stepT += skip * sixteenth;
    }
    while (this.stepT < ctx.currentTime + 0.15) {
      if (this.station === 'lofi') this.lofi(this.step, this.stepT, sixteenth);
      else if (this.station === 'rain') this.rain(this.step, this.stepT, sixteenth);
      else this.qin(this.step, this.stepT, sixteenth);
      this.step++;
      this.stepT += sixteenth;
    }
  }

  // —— 山间 lo-fi ——
  private lofi(step: number, t: number, s16: number) {
    const bar = Math.floor(step / 16), k = step % 16;
    const beat = s16 * 4;
    // 八分音符往后摇一点
    const sw = k % 4 === 2 ? s16 * 0.35 : 0;
    const chords = [
      [53, 57, 60, 64, 67], // Fmaj9
      [52, 55, 59, 62], // Em7
      [50, 53, 57, 60, 64], // Dm9
      [48, 52, 55, 59, 62], // Cmaj9
    ];
    const ch = chords[bar % 4];
    if (k === 0) ch.forEach((n, i) => this.keys(midi(n), t + i * 0.012, beat * 2.6, 0.11));
    if (k === 10 && bar % 2 === 1) ch.slice(1, 4).forEach((n, i) => this.keys(midi(n + 12), t + sw + i * 0.01, beat * 1.2, 0.06));
    // 贝斯
    if (k === 0) this.bass(midi(ch[0] - 12), t, beat * 1.6, 0.32);
    if (k === 11) this.bass(midi(ch[0] - 5), t + sw, beat * 0.8, 0.22);
    // 鼓
    if (k === 0 || k === 7 || (k === 10 && bar % 2 === 0)) this.kick(t + (k === 7 ? sw : 0), k === 0 ? 0.55 : 0.4);
    if (k === 4 || k === 12) this.snare(t, 0.22);
    if (k % 2 === 0) this.hat(t + sw, k % 4 === 0 ? 0.05 : 0.035 + Math.random() * 0.02);
    // 小旋律：每四小节的后两小节，八分音符上偶尔一个音
    if (bar % 4 >= 2 && k % 2 === 0 && Math.random() < 0.28) {
      const pent = [72, 74, 76, 79, 81, 84];
      this.melody = Math.max(0, Math.min(pent.length - 1, this.melody + (Math.random() < 0.5 ? -1 : 1)));
      this.pluck(midi(pent[this.melody]), t + sw, 0.9, 0.06);
    }
    // 黑胶的「噼啪」
    if (Math.random() < 0.06) this.click(t + Math.random() * s16);
  }

  // —— 雨天钢琴 ——
  private rain(step: number, t: number, s16: number) {
    const bar = Math.floor(step / 16), k = step % 16;
    const chords = [
      [48, 55, 59, 64, 67, 71], // Cmaj7
      [45, 52, 55, 60, 64, 67], // Am7
      [41, 48, 52, 57, 60, 64], // Fmaj7
      [43, 50, 55, 57, 62, 64], // G6/9
    ];
    const ch = chords[bar % 4];
    // 八分音符分解和弦，往上走再往下走，有的拍空着
    if (k % 2 === 0) {
      const order = [0, 2, 3, 4, 5, 4, 3, 2];
      const i = order[(k / 2) % 8];
      if (k === 0 || Math.random() < 0.72) this.piano(midi(ch[i]), t + (Math.random() - 0.5) * 0.012, k === 0 ? 0.13 : 0.08 + Math.random() * 0.03);
    }
    if (k === 0) this.piano(midi(ch[0] - 12), t, 0.1);
    // 屋檐滴水
    if (Math.random() < 0.035) this.drip(t + Math.random() * s16);
  }

  // —— 古琴夜话 ——
  private qin(step: number, t: number, s16: number) {
    const k = step % 16;
    const pent = [50, 52, 54, 57, 59, 62, 64, 66, 69]; // D 宫五声
    // 四分音符上落音，有时空一拍、有时连两个八分
    if (k % 4 === 0 && Math.random() < 0.72) {
      this.melody = Math.max(0, Math.min(pent.length - 1, this.melody + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      const n = pent[this.melody];
      this.qinNote(midi(n), t, 0.3, Math.random() < 0.18);
      if (Math.random() < 0.15) this.qinNote(midi(n + 12), t + 0.01, 0.08, false); // 泛音
      if (Math.random() < 0.2) {
        const n2 = pent[Math.max(0, this.melody - 1)];
        this.qinNote(midi(n2), t + s16 * 2, 0.2, false);
      }
    }
    if (Math.random() < 0.02) this.cricket(t + Math.random() * s16);
  }

  // —— 音色 ——
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + a + d);
  }
  // 电钢琴：正弦为主，加一点二次、三次谐波，音量慢慢颤
  private keys(f: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!, out = this.out!;
    const g = ctx.createGain();
    this.env(g, t, 0.012, v, dur);
    const trem = ctx.createGain();
    trem.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.2;
    const lg = ctx.createGain();
    lg.gain.value = 0.18;
    lfo.connect(lg).connect(trem.gain);
    for (const [m, a] of [[1, 1], [2, 0.18], [3, 0.06]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * m;
      o.detune.value = (Math.random() - 0.5) * 8;
      const og = ctx.createGain();
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    g.connect(trem).connect(out);
  }
  private piano(f: number, t: number, v: number) {
    const ctx = this.ctx!, out = this.out!;
    const g = ctx.createGain();
    this.env(g, t, 0.004, v, 2.8);
    for (const [m, a, d] of [[1, 1, 2.8], [2, 0.32, 1.2], [3, 0.12, 0.7], [4, 0.05, 0.4]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * m;
      const og = ctx.createGain();
      og.gain.setValueAtTime(a, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 3);
    }
    g.connect(out);
  }
  private pluck(f: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!, out = this.out!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    this.env(g, t, 0.006, v, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private bass(f: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!, out = this.out!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    this.env(g, t, 0.02, v, dur);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private kick(t: number, v: number) {
    const ctx = this.ctx!, out = this.out!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    const g = ctx.createGain();
    this.env(g, t, 0.003, v, 0.32);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.4);
  }
  private noiseHit(t: number, v: number, type: BiquadFilterType, f: number, q: number, dur: number) {
    const ctx = this.ctx!, out = this.out!;
    const n = ctx.createBufferSource();
    n.buffer = this.audio.noiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.002, v, dur);
    n.connect(bp).connect(g).connect(out);
    n.start(t, Math.random() * 3);
    n.stop(t + dur + 0.05);
  }
  private snare(t: number, v: number) {
    this.noiseHit(t, v, 'bandpass', 1800, 0.8, 0.18);
    const ctx = this.ctx!, out = this.out!;
    const o = ctx.createOscillator();
    o.frequency.value = 190;
    const g = ctx.createGain();
    this.env(g, t, 0.002, v * 0.35, 0.09);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.15);
  }
  private hat(t: number, v: number) {
    this.noiseHit(t, v * 3, 'highpass', 7000, 0.7, 0.045);
  }
  private click(t: number) {
    this.noiseHit(t, 0.05, 'highpass', 2500, 1, 0.012);
  }
  private drip(t: number) {
    const ctx = this.ctx!, out = this.out!;
    const o = ctx.createOscillator();
    const f = 1400 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05);
    const g = ctx.createGain();
    this.env(g, t, 0.002, 0.035, 0.08);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.12);
  }
  private cricket(t: number) {
    const ctx = this.ctx!, out = this.out!;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.frequency.value = 4300 + Math.random() * 200;
      const g = ctx.createGain();
      this.env(g, t + i * 0.07, 0.004, 0.012, 0.04);
      o.connect(g).connect(out);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.06);
    }
  }
  // 古琴：Karplus–Strong 拨弦（每个音高只算一次），偶尔往上滑一个全音
  private qinNote(f: number, t: number, v: number, slide: boolean) {
    const ctx = this.ctx!, out = this.out!;
    const key = Math.round(f * 10);
    let buf = this.ks.get(key);
    if (!buf) {
      const sr = ctx.sampleRate, len = Math.floor(sr * 3.2);
      buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const N = Math.max(2, Math.round(sr / f));
      const ring = new Float32Array(N);
      for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (1 - i / N);
      let p = 0;
      for (let i = 0; i < len; i++) {
        const a = ring[p], b = ring[(p + 1) % N];
        const y = 0.4985 * (a + b);
        ring[p] = y;
        d[i] = a;
        p = (p + 1) % N;
      }
      this.ks.set(key, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (slide) {
      src.playbackRate.setValueAtTime(1, t + 0.25);
      src.playbackRate.linearRampToValueAtTime(1.122, t + 0.6);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.value = v;
    src.connect(lp).connect(g).connect(out);
    src.start(t);
  }

  // —— 一直响着的底子 ——
  private loopNoise(type: BiquadFilterType, f: number, q: number, v: number) {
    const ctx = this.ctx!, out = this.out!;
    const n = ctx.createBufferSource();
    n.buffer = this.audio.noiseBuffer();
    n.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(v, ctx.currentTime, 1);
    n.connect(fl).connect(g).connect(out);
    n.start();
    return { stop: () => n.stop(ctx.currentTime + 0.3) };
  }
  private crackle() {
    return this.loopNoise('bandpass', 3800, 0.6, 0.05);
  }
  private rainBed() {
    const a = this.loopNoise('highpass', 900, 0.4, 0.22);
    const b = this.loopNoise('lowpass', 500, 0.5, 0.12);
    return { stop: () => (a.stop(), b.stop()) };
  }
  private drone() {
    const ctx = this.ctx!, out = this.out!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.05, ctx.currentTime, 2);
    const os = [midi(38), midi(45)].map((f) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(g);
      o.start();
      return o;
    });
    g.connect(out);
    const night = this.loopNoise('bandpass', 5200, 3, 0.012);
    return { stop: () => (os.forEach((o) => o.stop(ctx.currentTime + 0.3)), night.stop()) };
  }
}
