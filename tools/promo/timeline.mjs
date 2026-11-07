// 宣传片的分镜表：画面（promo.ts）和配乐（audio.mjs）共用这一份时间轴
// 竖屏 1080×1920，30 帧/秒；相邻两个镜头叠化 XF 秒
export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const XF = 0.5;

// 诗句出自唐·常建《题破山寺后禅院》
export const SHOTS = [
  { id: 'title', dur: 4.4 },
  { id: 'gate', dur: 5.2, time: 'dawn', line: '清晨入古寺' },
  { id: 'grove', dur: 4.4, time: 'dawn', line: '初日照高林' },
  { id: 'bridge', dur: 4.8, time: 'day', line: '曲径通幽处' },
  { id: 'court', dur: 4.8, time: 'day', line: '禅房花木深' },
  { id: 'incense', dur: 4.0, time: 'day', line: '心香一瓣' },
  { id: 'hall', dur: 5.6, time: 'day', line: '万籁此俱寂' },
  { id: 'bell', dur: 3.0, time: 'day', line: '但余钟磬音' },
  { id: 'moktak', dur: 3.0, time: 'day' },
  { id: 'night', dur: 4.2, time: 'night', line: '灯火照禅心' },
  { id: 'end', dur: 4.2 },
];

// 每个镜头在成片里的起点（秒）
let t = 0;
for (const s of SHOTS) {
  s.start = t;
  t += s.dur - XF;
}
export const TOTAL = t + XF;

// 镜头内的事件时刻（镜头内秒数）：画面在这些时刻做动作，配乐在同一时刻发声
export const EVENTS = {
  titleType: { from: 0.35, perChar: 0.075 },
  titleReveal: 1.75,
  titleSeal: 2.9,
  bellStrike: 0.25, // 撞木开始摆
  bellHit: 1.3, // 撞木碰到钟
  moktak: [0.3, 0.85, 1.4, 1.95, 2.5], // 木槌开始落下
  moktakDelay: 0.07, // 落下到碰到木鱼
  endSeal: 1.6,
};

export const PROMPT_LINES = ['https://sansatemple.com/', '帮我复刻这个游戏'];
