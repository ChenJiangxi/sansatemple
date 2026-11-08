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
  { id: 'title', dur: 5.0 },
  // 清晨
  { id: 'gate', dur: 5.0, time: 'dawn', line: '清晨入古寺' },
  { id: 'plaque', dur: 3.6, time: 'dawn' },
  { id: 'grove', dur: 4.5, time: 'dawn', line: '初日照高林' },
  { id: 'leaves', dur: 4.0, time: 'dawn' },
  // 白天·院子
  { id: 'pond', dur: 4.5, time: 'day', line: '潭影空人心' },
  { id: 'bridge', dur: 4.5, time: 'day', line: '曲径通幽处' },
  { id: 'court', dur: 5.0, time: 'day', line: '禅房花木深' },
  { id: 'pagoda', dur: 4.5, time: 'day', line: '八角七层塔' },
  { id: 'sideHall', dur: 4.5, time: 'day', line: '观音殿' },
  { id: 'bench', dur: 4.0, time: 'day', line: '坐看云起时' },
  { id: 'incense', dur: 4.5, time: 'day', line: '心香一瓣' },
  { id: 'ding', dur: 4.5, time: 'day', line: '青铜宝鼎' },
  // 大雄宝殿
  { id: 'hallFront', dur: 4.5, time: 'day', line: '大雄宝殿' },
  { id: 'hallEnter', dur: 4.5, time: 'day' },
  { id: 'rows', dur: 4.5, time: 'day', line: '万籁此俱寂' },
  { id: 'ceiling', dur: 4.5, time: 'day', line: '华盖经幡' },
  { id: 'buddha', dur: 4.5, time: 'day', line: '释迦牟尼佛' },
  { id: 'triad', dur: 4.0, time: 'day', line: '一佛二弟子' },
  { id: 'wall', dur: 4.0, time: 'day', line: '千佛壁' },
  { id: 'altar', dur: 4.0, time: 'day', line: '香花灯烛' },
  { id: 'bowClose', dur: 4.5, time: 'day', line: '五体投地' },
  { id: 'rosary', dur: 4.0, time: 'day', line: '百八念珠' },
  // 黄昏·钟鼓
  { id: 'bell', dur: 4.0, time: 'dusk', line: '但余钟磬音' },
  { id: 'drum', dur: 4.0, time: 'dusk', line: '晨钟暮鼓' },
  { id: 'moktak', dur: 3.5, time: 'dusk' },
  // 夜
  { id: 'nightSide', dur: 4.5, time: 'night', line: '灯火照禅心' },
  { id: 'nightPagoda', dur: 4.0, time: 'night' },
  { id: 'night', dur: 5.0, time: 'night' },
  { id: 'crowd', dur: 4.5, time: 'night', line: '五十人同坐一殿' },
  { id: 'end', dur: 4.5 },
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
for (let b = nextBeat(startOf('moktak') + 0.25); b < startOf('moktak') + 3.2; b += BEAT / 2) moktak.push(b - startOf('moktak') - MOKTAK_DELAY);
// 鼓：鼓槌抬起到打中约 0.32 秒
const DRUM_DELAY = 0.32;
const drum = [];
for (let b = nextBeat(startOf('drum') + 0.5); b < startOf('drum') + 3.6; b += BEAT) drum.push(b - startOf('drum') - DRUM_DELAY);
// 念珠：每半拍拨一颗
const rosary = [];
for (let b = nextBeat(startOf('rosary') + 0.3); b < startOf('rosary') + 3.7; b += BEAT / 2) rosary.push(b - startOf('rosary'));
export const EVENTS = {
  titleType: { from: 0.35, perChar: 0.14 },
  titleReveal: DOWNBEAT,
  titleSeal: 2.9,
  bellStrike: bellHit - STRIKER_DELAY,
  bellHit,
  moktak,
  moktakDelay: MOKTAK_DELAY,
  drum,
  drumDelay: DRUM_DELAY,
  rosary,
  endSeal: 1.6,
};

// 画面里不出现任何网址：那一句话只留后半句
export const PROMPT_LINES = ['帮我复刻这个游戏'];
