// 宣传片的分镜表：画面（promo.ts）和配乐（audio.mjs）共用这一份时间轴
// 竖屏 1080×1920，30 帧/秒；相邻两个镜头叠化 XF 秒；配乐 72 拍/分，从标题写出的那一刻起拍
export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const XF = 0.5;
export const BPM = 72;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DOWNBEAT = 1.75;

// 诗句出自唐·常建《题破山寺后禅院》；殿内几个镜头用名目做字幕
export const SHOTS = [
  { id: 'title', dur: 4.4 },
  { id: 'gate', dur: 4.8, time: 'dawn', line: '清晨入古寺' },
  { id: 'grove', dur: 3.8, time: 'dawn', line: '初日照高林' },
  { id: 'bridge', dur: 4.2, time: 'day', line: '潭影空人心' },
  { id: 'court', dur: 4.4, time: 'day', line: '禅房花木深' },
  { id: 'incense', dur: 3.6, time: 'day', line: '心香一瓣' },
  { id: 'hallEnter', dur: 4.4, time: 'day', line: '大雄宝殿' },
  { id: 'rows', dur: 4.6, time: 'day', line: '万籁此俱寂' },
  { id: 'buddha', dur: 4.0, time: 'day', line: '释迦牟尼佛' },
  { id: 'triad', dur: 3.4, time: 'day', line: '一佛二弟子' },
  { id: 'altar', dur: 3.4, time: 'day', line: '香花灯烛' },
  { id: 'bowClose', dur: 3.6, time: 'day', line: '五体投地' },
  { id: 'bell', dur: 3.0, time: 'day', line: '但余钟磬音' },
  { id: 'moktak', dur: 3.0, time: 'day' },
  { id: 'night', dur: 4.0, time: 'night', line: '灯火照禅心' },
  { id: 'end', dur: 4.2 },
];

// 每个镜头在成片里的起点（秒）
let t = 0;
for (const s of SHOTS) {
  s.start = t;
  t += s.dur - XF;
}
export const TOTAL = t + XF;
const startOf = (id) => SHOTS.find((s) => s.id === id).start;
// 成片时间 → 最近的下一拍
const nextBeat = (time) => DOWNBEAT + Math.ceil((time - DOWNBEAT) / BEAT - 1e-6) * BEAT;

// 镜头内的事件时刻（镜头内秒数）：画面在这些时刻做动作，配乐在同一时刻发声
const MOKTAK_DELAY = 0.07; // 木槌落下到碰到木鱼
const STRIKER_DELAY = 1.05; // 撞木开始摆到碰到钟
const bellHit = nextBeat(startOf('bell') + 1.2) - startOf('bell');
const moktak = [];
for (let b = nextBeat(startOf('moktak') + 0.25); b < startOf('moktak') + 2.75; b += BEAT / 2) moktak.push(b - startOf('moktak') - MOKTAK_DELAY);
export const EVENTS = {
  titleType: { from: 0.35, perChar: 0.075 },
  titleReveal: DOWNBEAT,
  titleSeal: 2.9,
  bellStrike: bellHit - STRIKER_DELAY,
  bellHit,
  moktak,
  moktakDelay: MOKTAK_DELAY,
  endSeal: 1.6,
};

export const PROMPT_LINES = ['https://sansatemple.com/', '帮我复刻这个游戏'];
