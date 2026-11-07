// 所有声音都用 Web Audio 实时合成：风声、鸟鸣、木鱼、念珠、铃、梵钟和念佛
type Bus = 'ambient' | 'effects' | 'chant';

const VOL_KEY = 'sansa.volumes';

export class AudioEngine {
  ctx: AudioContext | null = null;
  enabled = false;
  chanting = false;
  volumes: Record<Bus, number> = { ambient: 0.7, effects: 0.8, chant: 0.6 };
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private birdTimer = 0;
  private bellTimer = 0;
  private chantNodes: { stop(): void } | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(VOL_KEY) || 'null');
      if (saved) Object.assign(this.volumes, saved);
    } catch {
      /* 使用默认音量 */
    }
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }

  private init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.buses = {
      ambient: ctx.createGain(),
      effects: ctx.createGain(),
      chant: ctx.createGain(),
    };
    for (const k of Object.keys(this.buses) as Bus[]) {
      this.buses[k].gain.value = this.volumes[k];
      this.buses[k].connect(this.master);
    }
    // 混响：用衰减的噪声做脉冲响应，模拟山间与殿堂的空间感
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.5;
    this.reverbSend.connect(this.reverb).connect(this.master);
    // 噪声素材
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nd.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // 偏低频的棕噪声
      nd[i] = last * 3.5 + w * 0.04;
    }
    this.startAmbient();
  }

  async enable() {
    this.init();
    const ctx = this.ctx!;
    if (ctx.state !== 'running') await ctx.resume();
    this.enabled = true;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
    this.scheduleBirds();
    if (!this.bellTimer) {
      setTimeout(() => this.templeBell(), 600);
      this.bellTimer = window.setInterval(() => this.enabled && this.templeBell(), 1000 * 60 * 4);
    }
    this.emit();
  }

  disable() {
    if (!this.ctx) return;
    this.enabled = false;
    const ctx = this.ctx;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    if (this.chanting) this.stopChant();
    window.clearTimeout(this.birdTimer);
    setTimeout(() => {
      if (!this.enabled) ctx.suspend();
    }, 800);
    this.emit();
  }

  // 切到别的标签页时整体暂停
  async pauseForHidden(hidden: boolean) {
    if (!this.ctx || !this.enabled) return;
    if (hidden) await this.ctx.suspend();
    else await this.ctx.resume();
  }

  setVolume(bus: Bus, v: number) {
    this.volumes[bus] = v;
    localStorage.setItem(VOL_KEY, JSON.stringify(this.volumes));
    if (this.ctx) this.buses[bus].gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private noiseSource(loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  private startAmbient() {
    const ctx = this.ctx!;
    // 风：低通噪声，频率和音量缓慢起伏
    const wind = this.noiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.32;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 220;
    lfo.connect(lfoG).connect(lp.frequency);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.043;
    const lfo2G = ctx.createGain();
    lfo2G.gain.value = 0.16;
    lfo2.connect(lfo2G).connect(wg.gain);
    wind.connect(lp).connect(wg).connect(this.buses.ambient);
    // 树叶沙沙声
    const leaves = this.noiseSource(true);
    leaves.playbackRate.value = 1.7;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const lg = ctx.createGain();
    lg.gain.value = 0.0;
    const lfo3 = ctx.createOscillator();
    lfo3.frequency.value = 0.11;
    const lfo3G = ctx.createGain();
    lfo3G.gain.value = 0.05;
    lfo3.connect(lfo3G).connect(lg.gain);
    leaves.connect(hp).connect(lg).connect(this.buses.ambient);
    const now = ctx.currentTime;
    for (const n of [wind, leaves, lfo, lfo2, lfo3]) n.start(now);
  }

  private scheduleBirds() {
    window.clearTimeout(this.birdTimer);
    const next = 2500 + Math.random() * 7000;
    this.birdTimer = window.setTimeout(() => {
      if (!this.enabled) return;
      this.bird();
      this.scheduleBirds();
    }, next);
  }

  private bird() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    pan.connect(this.buses.ambient);
    g.connect(pan);
    const send = ctx.createGain();
    send.gain.value = 0.25;
    g.connect(send).connect(this.reverbSend);
    const kind = Math.floor(Math.random() * 3);
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1800;
    let t = t0;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const dur = kind === 0 ? 0.09 : kind === 1 ? 0.16 : 0.06;
      const f0 = base * (kind === 1 ? 1 : 0.9 + Math.random() * 0.25);
      const f1 = kind === 1 ? f0 * 0.7 : f0 * (1.2 + Math.random() * 0.3);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.06, t + 0.012);
      og.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur + (kind === 2 ? 0.03 : 0.07 + Math.random() * 0.08);
    }
    g.gain.setValueAtTime(1, t0);
  }

  // 木鱼：空心木头的短促“笃”声
  moktak(bus: Bus = 'effects', when = 0, gain = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = when || ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = gain;
    out.connect(this.buses[bus]);
    const send = ctx.createGain();
    send.gain.value = 0.22;
    out.connect(send).connect(this.reverbSend);
    const pitch = 1 + (Math.random() - 0.5) * 0.03;
    for (const [f, a, d] of [[612, 0.55, 0.13], [1290, 0.22, 0.06], [2010, 0.08, 0.035]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * pitch * 1.06, t);
      o.frequency.exponentialRampToValueAtTime(f * pitch, t + 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0005, t + d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + d + 0.05);
    }
    const n = this.noiseSource();
    n.playbackRate.value = 6;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    n.connect(bp).connect(ng).connect(out);
    n.start(t, Math.random() * 3, 0.05);
  }

  // 念珠相碰的“嗒”声
  bead() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(this.buses.effects);
    for (let k = 0; k < 2; k++) {
      const tt = t + k * (0.018 + Math.random() * 0.012);
      const o = ctx.createOscillator();
      o.frequency.value = 1900 + Math.random() * 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12 / (k + 1), tt);
      g.gain.exponentialRampToValueAtTime(0.0004, tt + 0.035);
      o.connect(g).connect(out);
      o.start(tt);
      o.stop(tt + 0.05);
      const n = this.noiseSource();
      n.playbackRate.value = 8;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3600 + Math.random() * 800;
      bp.Q.value = 2.5;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5 / (k + 1), tt);
      ng.gain.exponentialRampToValueAtTime(0.0005, tt + 0.018);
      n.connect(bp).connect(ng).connect(out);
      n.start(tt, Math.random() * 3, 0.04);
    }
  }

  // 磬 / 颂钵：礼拜额头触地、上香时的清亮余音
  bell(gain = 0.5) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = gain;
    out.connect(this.buses.effects);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    out.connect(send).connect(this.reverbSend);
    const f0 = 523;
    const partials: [number, number, number][] = [[1, 0.5, 5], [1.003, 0.35, 5.5], [2.71, 0.22, 3.2], [5.15, 0.09, 1.8], [8.4, 0.04, 1]];
    for (const [r, a, d] of partials) {
      const o = ctx.createOscillator();
      o.frequency.value = f0 * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0003, t + d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  // 梵钟：低沉悠长，带“嗡——嗡——”的拍频
  templeBell(gain = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.32 * gain;
    out.connect(this.buses.ambient);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    out.connect(send).connect(this.reverbSend);
    const f0 = 82;
    const parts: [number, number, number][] = [[0.5, 0.5, 16], [0.503, 0.4, 16], [1, 0.6, 12], [1.006, 0.5, 12], [1.19, 0.25, 9], [1.5, 0.22, 7], [2.0, 0.18, 6], [2.52, 0.1, 4.5], [2.98, 0.08, 3.5], [4.1, 0.05, 2.5]];
    for (const [r, a, d] of parts) {
      const o = ctx.createOscillator();
      o.frequency.value = f0 * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0004, t + d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + d + 0.2);
    }
    const n = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(lp).connect(ng).connect(out);
    n.start(t, 0, 0.3);
  }

  // 鼓：低沉的一声“咚”，带一点皮面的噪声
  drum(gain = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.9 * gain;
    out.connect(this.buses.ambient);
    const send = ctx.createGain();
    send.gain.value = 0.7;
    out.connect(send).connect(this.reverbSend);
    for (const [f0, f1, a, d] of [[92, 58, 0.9, 1.6], [150, 96, 0.35, 0.7], [230, 160, 0.15, 0.35]] as const) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0005, t + d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + d + 0.1);
    }
    const n = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(lp).connect(ng).connect(out);
    n.start(t, Math.random() * 3, 0.25);
  }

  // 念佛：共振峰合成的男声齐诵“南无阿弥陀佛”，配木鱼
  startChant() {
    if (!this.enabled || !this.ctx || this.chanting) return;
    const ctx = this.ctx;
    this.chanting = true;
    const voiceOut = ctx.createGain();
    voiceOut.gain.value = 0;
    const bus = ctx.createGain();
    bus.gain.value = 0.0;
    bus.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    bus.connect(this.buses.chant);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    bus.connect(send).connect(this.reverbSend);

    const oscs: OscillatorNode[] = [];
    const sum = ctx.createGain();
    sum.gain.value = 0.25;
    const detunes = [0, 7, -6, -1200];
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6;
    const vibG = ctx.createGain();
    vibG.gain.value = 0.9;
    vib.connect(vibG);
    for (const dt of detunes) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 110;
      o.detune.value = dt;
      vibG.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.value = dt === -1200 ? 0.5 : 0.35;
      o.connect(g).connect(sum);
      oscs.push(o);
    }
    const formants = [0, 1, 2].map((i) => {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = [6, 9, 12][i];
      f.frequency.value = [730, 1090, 2440][i];
      const g = ctx.createGain();
      g.gain.value = [1.0, 0.55, 0.28][i];
      sum.connect(f).connect(g).connect(voiceOut);
      return f;
    });
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;
    voiceOut.connect(lowpass).connect(bus);
    const now = ctx.currentTime;
    vib.start(now);
    oscs.forEach((o) => o.start(now));

    const V: Record<string, [number, number, number]> = {
      a: [760, 1200, 2600], o: [520, 860, 2450], e: [480, 1150, 2500], u: [340, 820, 2300], i: [290, 2200, 3000], n: [280, 1300, 2600], m: [260, 1000, 2400],
    };
    // 南无阿弥陀佛（nā mó ē mí tuó fó），按普通话发音；最后一个字拖长、音高回落
    const syl: { c: string; v: string; p: number; end?: string }[] = [
      { c: 'n', v: 'a', p: 1 }, { c: 'm', v: 'o', p: 1 }, { c: '', v: 'e', p: 1.122 }, { c: 'm', v: 'i', p: 1.122 },
      { c: 't', v: 'u', p: 1, end: 'o' }, { c: 'f', v: 'o', p: 0.891 },
    ];
    const beat = 0.48;
    let nextTime = now + 0.6;
    let idx = 0;
    let phrase = 0;
    const setF = (vals: [number, number, number], at: number, tc: number) => {
      formants.forEach((f, i) => f.frequency.setTargetAtTime(vals[i], at, tc));
    };
    const scheduleAhead = () => {
      while (nextTime < ctx.currentTime + 0.8) {
        if (idx >= syl.length) {
          // 句尾留一拍换气
          voiceOut.gain.setTargetAtTime(0.0, nextTime - 0.05, 0.06);
          this.moktak('chant', nextTime, 0.5);
          nextTime += beat;
          idx = 0;
          phrase++;
          continue;
        }
        const s = syl[idx];
        const t = nextTime;
        const base = 110 * (phrase % 4 === 3 && idx === 5 ? 0.84 : 1);
        oscs.forEach((o) => o.frequency.setTargetAtTime(base * s.p, t, 0.04));
        if (s.c === 'n' || s.c === 'm') {
          voiceOut.gain.setTargetAtTime(0.35, t, 0.02);
          setF(V[s.c], t, 0.01);
          setF(V[s.v], t + 0.08, 0.03);
          voiceOut.gain.setTargetAtTime(1, t + 0.08, 0.03);
        } else if (s.c === 'f') {
          // f：先一小段气声，再接元音
          voiceOut.gain.setTargetAtTime(0.05, t - 0.03, 0.01);
          const n = this.noiseSource();
          n.playbackRate.value = 4;
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 2500;
          const ng = ctx.createGain();
          ng.gain.setValueAtTime(0.0, t - 0.06);
          ng.gain.linearRampToValueAtTime(0.05, t - 0.02);
          ng.gain.linearRampToValueAtTime(0.0, t + 0.04);
          n.connect(hp).connect(ng).connect(bus);
          n.start(t - 0.06, Math.random() * 3, 0.12);
          setF(V[s.v], t, 0.01);
          voiceOut.gain.setTargetAtTime(1, t + 0.04, 0.02);
        } else if (s.c === 't' || s.c === 'b') {
          voiceOut.gain.setTargetAtTime(0.02, t - 0.03, 0.01);
          setF(V[s.v], t, 0.01);
          voiceOut.gain.setTargetAtTime(1, t + 0.03, 0.02);
        } else {
          setF(V[s.v], t, 0.03);
          voiceOut.gain.setTargetAtTime(1, t, 0.03);
        }
        if (s.end) setF(V[s.end], t + beat * 0.35, 0.05);
        this.moktak('chant', t, 0.45);
        nextTime += beat;
        idx++;
      }
    };
    scheduleAhead();
    const timer = window.setInterval(scheduleAhead, 120);
    this.chantNodes = {
      stop: () => {
        window.clearInterval(timer);
        const t = ctx.currentTime;
        bus.gain.cancelScheduledValues(t);
        bus.gain.setTargetAtTime(0, t, 0.25);
        setTimeout(() => {
          oscs.forEach((o) => o.stop());
          vib.stop();
          bus.disconnect();
        }, 1500);
      },
    };
    this.emit();
  }

  stopChant() {
    if (!this.chanting) return;
    this.chanting = false;
    this.chantNodes?.stop();
    this.chantNodes = null;
    this.emit();
  }
}

export const audio = new AudioEngine();
