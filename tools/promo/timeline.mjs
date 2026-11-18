// 宣传片的分镜表：画面（promo.ts）、配乐（audio.mjs）、拼接（assemble.mjs）共用
// 三个版本，用 cut 参数选择（浏览器里是 ?cut=，Node 里是 CUT 环境变量）：
//   vertical  竖屏 9:16，2 分钟宣传片（默认）
//   short34   竖屏 3:4，约 1 分钟的短视频
//   explainer 横屏 16:9 讲解视频，克隆音口播 + 字幕，镜头时长跟着口播走
//   features  竖屏 9:16 功能介绍，约 2 分钟：一天里走一遍寺院，每个镜头一个功能，节奏放慢（每个 7～9 秒），底部字幕写功能名和玩法
//   news      竖屏 9:16「山寺上新」，约 1 分半：咖啡馆、祈福灯廊、柿饼架、键盘抄经；配乐 100 拍/分钟、有鼓点（不要太舒缓），
//             镜头仍然慢（每个 3 小节 = 7.2 秒），每个镜头的起点都落在小节线上，画面里的动作卡在拍子上
// 画面里不出现任何网址
import { SEGMENTS } from './explainer-script.mjs';
import { VOICE_TIMING } from './explainer-voice.mjs';

export const CUT =
  (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cut') : globalThis.process?.env?.CUT) || 'vertical';
const SIZES = { vertical: [1080, 1920], short34: [1080, 1440], explainer: [1920, 1080], features: [1080, 1920], news: [1080, 1920] };
export const [W, H] = SIZES[CUT] ?? SIZES.vertical;
export const FPS = 30;
export const XF = 0.5;
const NEWS = CUT === 'news';
export const BPM = NEWS ? 100 : 72;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DOWNBEAT = NEWS ? 0 : 1.75;

// 每个镜头的时段和字幕（诗句出自唐·常建《题破山寺后禅院》，「坐看云起时」出自王维《终南别业》）
const DEF = {
  title: {},
  gate: { time: 'dawn', line: '清晨入古寺' },
  plaque: { time: 'dawn' },
  grove: { time: 'dawn', line: '初日照高林' },
  leaves: { time: 'dawn' },
  pond: { time: 'day', line: '潭影空人心' },
  bridge: { time: 'day', line: '曲径通幽处' },
  court: { time: 'day', line: '禅房花木深' },
  pagoda: { time: 'day', line: '八角七层塔' },
  sideHall: { time: 'day', line: '观音殿' },
  bench: { time: 'day', line: '坐看云起时' },
  incense: { time: 'day', line: '心香一瓣' },
  ding: { time: 'day', line: '青铜宝鼎' },
  hallFront: { time: 'day', line: '大雄宝殿' },
  hallEnter: { time: 'day' },
  rows: { time: 'day', line: '万籁此俱寂' },
  ceiling: { time: 'day', line: '华盖经幡' },
  buddha: { time: 'day', line: '释迦牟尼佛' },
  triad: { time: 'day', line: '一佛二弟子' },
  wall: { time: 'day', line: '千佛壁' },
  altar: { time: 'day', line: '香花灯烛' },
  bowClose: { time: 'day', line: '五体投地' },
  rosary: { time: 'day', line: '百八念珠' },
  bell: { time: 'dusk', line: '但余钟磬音' },
  drum: { time: 'dusk', line: '晨钟暮鼓' },
  moktak: { time: 'dusk' },
  nightSide: { time: 'night', line: '灯火照禅心' },
  nightPagoda: { time: 'night' },
  night: { time: 'night' },
  crowd: { time: 'night', line: '五十人同坐一殿' },
  end: {},
  // 讲解视频专用：横屏片头、那一句话、片尾、线上实拍截图
  eTitle: {},
  ePrompt: {},
  eEnd: {},
  uiRooms: {},
  uiBow: {},
  // 功能介绍专用
  fTitle: {},
  quest: { time: 'day' },
  uiPractice: {},
  looks: { time: 'day' },
  guanyin: { time: 'day' },
  library: { time: 'day' },
  copy: {},
  uiReader: {},
  tower: { time: 'day' },
  fEnd: {},
  // 山寺上新
  nTitle: {},
  nCafe: { time: 'day' },
  nTerrace: { time: 'day' },
  nBar: { time: 'day' },
  nMenu: {},
  nTreat: { time: 'day' },
  nAlley: { time: 'day' },
  nHang: { time: 'day' },
  nWish: {},
  nPersimmon: { time: 'day' },
  nSutra: { time: 'day' },
  nNight: { time: 'night' },
  nEnd: {},
};
// 山寺上新：每个镜头底部的字幕
const NEWS_TEXT = {
  nCafe: ['山寺咖啡', '东院新开一间茶寮，咖啡师父现做'],
  nTerrace: ['露台 · 油纸伞', '撑伞的小桌，晒着太阳坐一会儿'],
  nBar: ['五款特调', '般若拿铁 · 上岸冷萃 · 桂花拿铁'],
  nMenu: ['点一杯', '一杯分三口喝，喝完放进大纸杯'],
  nTreat: ['请人喝一杯', '端着满杯点别人，双手递过去'],
  nAlley: ['祈福灯廊', '一百多盏灯，每盏下面一张心愿'],
  nHang: ['挂一盏灯', '写一句心愿，灯自己升到绳上'],
  nWish: ['七种心愿', '平安 · 上岸 · 健康 · 暴富 · 脱单'],
  nPersimmon: ['柿柿如意', '柿饼架前合十，得一句好彩头'],
  nSutra: ['键盘抄经', '电脑上用输入法打字，打对一个落一个墨字'],
  nNight: ['入夜', '灯廊和茶寮的灯，一盏盏亮起来'],
};
// 功能介绍里换时段的镜头：黄昏撞钟的特写逆光，钟正面一片黑，改用白天的光（配乐仍按黄昏那一段走）
const FEATURE_TIME = { bell: 'day' };
// 功能介绍：每个镜头底部的字幕（功能名、一句玩法）
const FEATURE_TEXT = {
  gate: ['一座在线古寺', '打开网页就能进山门，五十人同在一寺'],
  incense: ['上香', '点香炉，人会走过去，亲手插上一炷香'],
  quest: ['寺务', '头上有「！」的僧人会请你帮忙：扫落叶、浇树'],
  uiPractice: ['修行进度', '功德攒够就升一级；每天六项功课，做满有奖励'],
  looks: ['衣钵', '每升一级，开放新的僧袍和念珠'],
  guanyin: ['解锁殿堂', '修行到「行者」，观音殿的门为你打开'],
  library: ['藏经阁', '修行到「比丘」开放，里面能抄经、读经'],
  copy: ['抄经', '照着灰色的楷字描《心经》，描得准功德多'],
  uiReader: ['读经', '六部经书，繁简可切换，慢慢读，记下读过几遍'],
  tower: ['登塔看云海', '修行到「法师」，可以登上塔顶看云海'],
  rows: ['大殿礼佛', '整点共修，满殿的人一起礼拜'],
  rosary: ['拨念珠', '一颗一颗拨，满一百零八颗记一圈'],
  bell: ['撞钟', '按住蓄力，在金色区间松手，钟声最洪亮'],
  moktak: ['敲木鱼', '跟着拍子敲，敲准是「妙」，连击功德更多'],
  night: ['入夜', '灯笼一盏盏亮起，夜里的寺院另有一番样子'],
};
// 讲解视频里，殿堂器物的名目做小字幕（不放诗句，免得和口播打架）
const EXPLAIN_LINE = {
  plaque: '山门', pond: '放生池', pagoda: '八角七层塔', hallFront: '大雄宝殿', triad: '一佛二弟子', wall: '千佛壁', ceiling: '井口天花',
  ding: '青铜宝鼎', buddha: '释迦牟尼佛', bowClose: '五体投地', incense: '上香', moktak: '木鱼', rosary: '百八念珠', bell: '撞钟', drum: '击鼓',
  grove: '清晨', sideHall: '白天', nightSide: '入夜', nightPagoda: '塔灯',
};

const LISTS = {
  vertical: [
    ['title', 5.0], ['gate', 5.0], ['plaque', 3.6], ['grove', 4.5], ['leaves', 4.0], ['pond', 4.5], ['bridge', 4.5], ['court', 5.0],
    ['pagoda', 4.5], ['sideHall', 4.5], ['bench', 4.0], ['incense', 4.5], ['ding', 4.5], ['hallFront', 4.5], ['hallEnter', 4.5],
    ['rows', 4.5], ['ceiling', 4.5], ['buddha', 4.5], ['triad', 4.0], ['wall', 4.0], ['altar', 4.0], ['bowClose', 4.5], ['rosary', 4.0],
    ['bell', 4.0], ['drum', 4.0], ['moktak', 3.5], ['nightSide', 4.5], ['nightPagoda', 4.0], ['night', 5.0], ['crowd', 4.5], ['end', 4.5],
  ],
  features: [
    ['fTitle', 6.0], ['gate', 8.0], ['incense', 8.0], ['quest', 8.0], ['uiPractice', 8.0], ['looks', 8.0], ['guanyin', 8.5], ['library', 8.0],
    ['copy', 8.5], ['uiReader', 8.0], ['tower', 9.0], ['rows', 8.0], ['rosary', 7.5], ['bell', 8.0], ['moktak', 8.5], ['night', 8.0], ['fEnd', 6.5],
  ],
  // 每个镜头多 0.5 秒叠化，起点正好落在小节线上（片头 2 小节、其余 3 小节）
  news: [
    ['nTitle', 5.3], ['nCafe', 7.7], ['nTerrace', 7.7], ['nBar', 7.7], ['nMenu', 7.7], ['nTreat', 7.7], ['nAlley', 7.7],
    ['nHang', 7.7], ['nWish', 7.7], ['nPersimmon', 7.7], ['nSutra', 7.7], ['nNight', 7.7], ['nEnd', 5.5],
  ],
  short34: [
    ['title', 4.6], ['gate', 4.0], ['grove', 3.6], ['pond', 3.8], ['court', 4.0], ['ding', 3.8], ['hallFront', 4.0], ['rows', 4.0],
    ['buddha', 4.0], ['triad', 3.6], ['bowClose', 4.0], ['bell', 3.6], ['drum', 3.6], ['moktak', 3.2], ['nightSide', 4.0], ['nightPagoda', 3.6],
    ['crowd', 4.0], ['end', 4.2],
  ],
};

// 讲解视频：每段口播配一组镜头，镜头平分这段的时长；段与段之间留一点气口
const LEAD = 0.8, GAP = 0.55, TAIL = 3.2;
export const VOICE = [];
export const SUBS = [];
function explainerList() {
  const list = [];
  let t = LEAD;
  SEGMENTS.forEach((seg, si) => {
    const v = VOICE_TIMING[seg.id];
    const dur = v?.dur ?? [...seg.text].length / 4;
    VOICE.push({ id: seg.id, start: t });
    for (const l of v?.lines ?? []) SUBS.push({ text: l.text, t0: t + l.t0, t1: t + l.t1 });
    const span = dur + GAP + (si === SEGMENTS.length - 1 ? TAIL : 0);
    const n = seg.shots.length;
    seg.shots.forEach((id, k) => {
      const extra = si === 0 && k === 0 ? LEAD : 0;
      list.push([id, span / n + XF + extra]);
    });
    t += span;
  });
  return list;
}

const list = CUT === 'explainer' ? explainerList() : LISTS[CUT] ?? LISTS.vertical;
export const SHOTS = list.map(([id, dur]) => ({
  id,
  dur,
  ...DEF[id],
  ...(CUT === 'explainer' ? { line: EXPLAIN_LINE[id] } : {}),
  ...(CUT === 'features' ? { line: undefined, feature: FEATURE_TEXT[id], ...(FEATURE_TIME[id] ? { time: FEATURE_TIME[id] } : {}) } : {}),
  ...(NEWS ? { line: undefined, feature: NEWS_TEXT[id] } : {}),
}));

// 每个镜头在成片里的起点（秒）
let t = 0;
for (const s of SHOTS) {
  s.start = t;
  t += s.dur - XF;
}
export const TOTAL = t + XF;
const startOf = (id) => SHOTS.find((s) => s.id === id)?.start;
// 成片时间 → 最近的下一拍
const nextBeat = (time) => DOWNBEAT + Math.ceil((time - DOWNBEAT) / BEAT - 1e-6) * BEAT;
// 某个镜头里、从 from 到 to 秒之间按 step 排开的拍点（镜头内秒数）；镜头不在这一版里就返回空
function beatsIn(id, from, to, step, delay = 0) {
  const s = startOf(id);
  if (s === undefined) return [];
  const out = [];
  for (let b = nextBeat(s + from); b < s + to; b += step) out.push(b - s - delay);
  return out;
}
const durOf = (id) => SHOTS.find((s) => s.id === id)?.dur ?? 4;

// 镜头内的事件时刻（镜头内秒数）：画面在这些时刻做动作，配乐在同一时刻发声
const MOKTAK_DELAY = 0.07; // 木槌落下到碰到木鱼
const STRIKER_DELAY = 1.05; // 撞木开始摆到碰到钟
const DRUM_DELAY = 0.32; // 鼓槌抬起到打中
const bellStart = startOf('bell');
const bellHit = bellStart === undefined ? 1.3 : nextBeat(bellStart + 1.2) - bellStart;
export const EVENTS = {
  titleType: { from: 0.35, perChar: 0.14 },
  titleReveal: DOWNBEAT,
  titleSeal: 2.9,
  bellStrike: bellHit - STRIKER_DELAY,
  bellHit,
  moktak: beatsIn('moktak', 0.25, CUT === 'features' ? durOf('moktak') - 0.6 : Math.min(3.2, durOf('moktak') - 0.3), BEAT / 2, MOKTAK_DELAY),
  moktakDelay: MOKTAK_DELAY,
  drum: beatsIn('drum', 0.5, durOf('drum') - 0.4, BEAT, DRUM_DELAY),
  drumDelay: DRUM_DELAY,
  rosary: beatsIn('rosary', 0.3, durOf('rosary') - 0.3, BEAT / 2),
  endSeal: 1.6,
  // 山寺上新：镜头内的动作时刻都在拍子上（每拍 0.6 秒）
  nCupReady: 4.2, // 吧台：咖啡做好、端到手上
  nGive: 4.2, // 请人喝：杯子换到对方手上
  nHangStart: 0.8, // 挂灯：举灯（举起来 1.0 秒后灯离手）
  nHangRelease: 1.8, // 灯离手往上升（举灯后 1.2 秒）
  nPersimmon: 3.0, // 柿饼架前合十后飘出「柿柿如意」
  nInk: NEWS ? beatsIn('nSutra', 0.9, durOf('nSutra') - 1.0, BEAT) : [], // 键盘抄经：每拍上屏一组字
};

// 那一句话：画面里不出现任何网址，只留后半句
export const PROMPT_LINES = ['帮我复刻这个游戏'];
