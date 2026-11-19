// 宣传片的分镜表：画面（promo.ts）、配乐（audio.mjs）、拼接（assemble.mjs）共用
// 三个版本，用 cut 参数选择（浏览器里是 ?cut=，Node 里是 CUT 环境变量）：
//   vertical  竖屏 9:16，2 分钟宣传片（默认）
//   short34   竖屏 3:4，约 1 分钟的短视频
//   explainer 横屏 16:9 讲解视频，克隆音口播 + 字幕，镜头时长跟着口播走
//   features  竖屏 9:16 功能介绍，约 2 分钟：一天里走一遍寺院，每个镜头一个功能，节奏放慢（每个 7～9 秒），底部字幕写功能名和玩法
//   news      竖屏 9:16「山寺 · 修行」，约 1 分半：以修行为主（礼佛、上香、功课、抄经、读经、念珠、祈福、撞钟、木鱼），咖啡只一个镜头；
//             没有片头，直接进；配乐 100 拍/分钟、有鼓点（不要太舒缓），
//   walk      竖屏 9:16 走动长镜头版，约 3 分钟：每段都是跟着小和尚走的连贯镜头，段与段之间叠化——山门、过桥、晨钟 ‖ 上香、礼佛、
//             升过殿顶到藏经阁抄经 ‖ 午后茶寮喝咖啡、升高看日落、柿柿如意、祈福灯廊挂灯、入夜；天色连续变化；配乐同 news（WALK、MUSIC）
//   coffee    竖屏 9:16 小红书版，约 1 分 40 秒：只拍「半山咖啡」，不拍任何宗教内容（不跪拜、不上香、不诵经，字幕不用宗教词）——
//             走进咖啡馆、点单、咖啡师现做、请朋友喝一杯、伞下一口一口喝、空杯扔进大纸杯、分享卡、傍晚升高俯看、入夜；配乐同 news（COFFEE、MUSIC）
//
//             镜头仍然慢（每个 3 小节 = 7.2 秒），每个镜头的起点都落在小节线上，画面里的动作卡在拍子上
// 画面里不出现任何网址
import { SEGMENTS } from './explainer-script.mjs';
import { VOICE_TIMING } from './explainer-voice.mjs';

export const CUT =
  (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cut') : globalThis.process?.env?.CUT) || 'vertical';
const SIZES = { vertical: [1080, 1920], short34: [1080, 1440], explainer: [1920, 1080], features: [1080, 1920], news: [1080, 1920], walk: [1080, 1920], coffee: [1080, 1920] };
export const [W, H] = SIZES[CUT] ?? SIZES.vertical;
export const FPS = 30;
export const XF = 0.5;
const NEWS = CUT === 'news';
const WALKCUT = CUT === 'walk';
const COFFEECUT = CUT === 'coffee';
// 这几版都用明快的 100 拍配乐，成片从第一拍开始
const BEATY = NEWS || WALKCUT || COFFEECUT;
export const BPM = BEATY ? 100 : 72;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DOWNBEAT = BEATY ? 0 : 1.75;

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
// 山寺 · 修行：每个镜头底部的字幕（修行为主，咖啡只是修行间隙歇一歇）
const NEWS_TEXT = {
  rows: ['大殿礼佛', '整点共修，满殿的人一起礼拜'],
  incense: ['上香', '点香炉，亲手插上一炷香'],
  uiPractice: ['每日功课', '礼佛、上香、木鱼、念珠、读经、抄经，做满有功德'],
  uiReader: ['读经', '六部经书，繁简可切换，记下读过几遍'],
  rosary: ['拨念珠', '一颗一颗拨，满一百零八颗记一圈'],
  bell: ['撞钟', '按住蓄力，在金色区间松手，钟声最洪亮'],
  moktak: ['敲木鱼', '跟着拍子敲，敲准是「妙」，连击功德更多'],
  nCafe: ['山寺咖啡', '东院新开一间茶寮，咖啡师父现做'],
  nTerrace: ['露台 · 油纸伞', '撑伞的小桌，晒着太阳坐一会儿'],
  nBar: ['五款特调', '般若拿铁 · 上岸冷萃 · 桂花拿铁'],
  nMenu: ['点一杯', '一杯分三口喝，喝完放进大纸杯'],
  nTreat: ['请人喝一杯', '端着满杯点别人，双手递过去'],
  nAlley: ['祈福灯廊', '一百多盏灯，每盏下面一张心愿'],
  nHang: ['挂一盏灯', '写一句心愿，灯自己升到绳上'],
  nWish: ['七种心愿', '平安 · 上岸 · 健康 · 暴富 · 脱单'],
  nPersimmon: ['柿柿如意', '柿饼架前合十，得一句好彩头'],
  nSutra: ['抄经', '电脑上用输入法打字，打对一个落一个墨字'],
  nNight: ['入夜', '殿里和灯廊的灯，一盏盏亮起来'],
  nCafeRest: ['修行间隙', '东院茶寮喝杯咖啡，歇一歇再接着修'],
};
// 修行版里换时段的镜头：撞钟在黄昏逆光、钟正面一片黑，用白天的光
const NEWS_TIME = { bell: 'day', rows: 'day', incense: 'day', rosary: 'day' };
// 同一个镜头在修行版里换个字幕（咖啡馆外景当作「修行间隙」）
const NEWS_ALIAS = { nCafe: 'nCafeRest' };
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
  // 每个镜头多 0.5 秒叠化，起点正好落在小节线上（每个 3 小节）。用户 2026-11-18：不要片头，直接进；主要是修行，不是咖啡
  news: [
    ['rows', 7.7], ['incense', 7.7], ['uiPractice', 7.7], ['nSutra', 7.7], ['uiReader', 7.7], ['rosary', 7.7],
    ['nHang', 7.7], ['nCafe', 7.7], ['bell', 7.7], ['moktak', 7.7], ['nNight', 7.7], ['nEnd', 5.5],
  ],
  // 走动长镜头：只有这一个镜头，不要片头也不要片尾落款（用户 2026-11-19：「最后一页的山寺画面也不要」）；
  // 收尾停在入夜的灯廊，镜头慢慢升高、渐暗，配乐的收尾和弦与钟声在这里放完
  walk: [['walk', 183.1]],
  // 小红书版：只拍咖啡，一个镜头，段与段之间叠化（COFFEE.cuts）
  coffee: [['coffee', 100.0]],
  short34: [
    ['title', 4.6], ['gate', 4.0], ['grove', 3.6], ['pond', 3.8], ['court', 4.0], ['ding', 3.8], ['hallFront', 4.0], ['rows', 4.0],
    ['buddha', 4.0], ['triad', 3.6], ['bowClose', 4.0], ['bell', 3.6], ['drum', 3.6], ['moktak', 3.2], ['nightSide', 4.0], ['nightPagoda', 3.6],
    ['crowd', 4.0], ['end', 4.2],
  ],
};

// —— 走动长镜头的时间表（成片秒数）：每一段都是跟着小和尚走的连贯镜头，段与段之间可以叠化切过去（cuts，都在小节线上）。
// 修行是主线，中间到茶寮喝杯咖啡。动作都卡在拍子上：撞钟、插香、第一次叩首、每一组落墨、咖啡做好、喝一口、柿柿如意、灯离手 ——
const onBeat = (t) => Math.round(t / BEAT) * BEAT;
export const WALK = (() => {
  const bellHit = onBeat(32.4);
  const incensePlant = onBeat(43.4);
  const bowStart = onBeat(57.6) - 2.9; // 第一次额头触地在拍子上
  const cupReady = onBeat(114.6);
  const hangRelease = onBeat(159.2);
  const inks = [];
  for (let b = onBeat(91.2); b <= 99.7; b += BEAT) inks.push(b);
  return {
    cuts: [36.0, 103.2], // 叠化切换：撞完钟 → 上香；抄完经 → 午后的茶寮
    gate: [0.4, 14.0], // 进山门、过桥
    toBell: [14.0, 29.0],
    bellStrike: bellHit - 1.05,
    bellHit,
    incenseFrom: [4.6, 14.2],
    toIncense: [36.0, incensePlant - 2.75 - 0.15],
    incenseStart: incensePlant - 2.75,
    incensePlant,
    toHall: [46.6, bowStart - 0.35],
    bowStart,
    bowTouches: [bowStart + 2.9, bowStart + 8.5],
    bowEnd: bowStart + 11.2,
    walkOut: [bowStart + 11.6, 71.6],
    craneLib: [71.6, 87.0], // 镜头升过殿顶，落到藏经阁门口
    libTeleport: 77.4,
    libWalk: [79.0, 86.8],
    sit: 87.0,
    sheet: [89.8, 100.2],
    inks,
    sitEnd: 103.2,
    // 午后的茶寮：走上露台进厅、吧台前等咖啡、端着出来坐到伞下、喝两口
    cafeIn: [103.2, 111.6],
    brew: [111.6, cupReady],
    cupReady,
    toSeat: [117.6, 123.0],
    sipAt: [onBeat(124.8), onBeat(127.2)],
    aerial: [129.6, 143.4], // 从露台升起来看日落，转向西院
    persimmonTeleport: 134.4,
    toPersimmon: [143.4, 147.0],
    persimmonBow: 147.2,
    persimmonWord: onBeat(148.2),
    alleyWalk: [150.0, hangRelease - 1.0 - 0.2],
    hangStart: hangRelease - 1.0,
    hangRelease,
    nightWalk: [hangRelease + 4.6, 176.0],
    end: 177.6,
    fadeOut: [180.4, 183.0], // 渐暗到黑
    // 钟点：清晨 → 上午 → 正午；切到茶寮时是午后；看完日落入夜
    hours: [[0, 6.2], [14, 7.0], [36, 8.0], [46.6, 8.8], [71.6, 10.5], [87, 12.0], [103.1, 13.0], [103.3, 14.6], [129.6, 16.0], [140, 17.2], [150, 18.2], [160, 19.0], [168, 19.9], [177.6, 20.6]],
    caps: [
      [0.8, 6.6, '山门', '清晨，一个人走进山寺'],
      [7.6, 13.4, '放生池', '过石拱桥，池里锦鲤游'],
      [29.4, 35.4, '晨钟', '撞木一拉，钟声传遍山谷'],
      [37.0, 46.2, '上香', '院中大香炉，亲手插一炷香'],
      [bowStart + 0.4, bowStart + 11.0, '大殿礼佛', '在蒲团上跪下，五体投地'],
      [78.6, 86.6, '藏经阁', '修到「比丘」，殿后的经阁就开了'],
      [90.2, 100.2, '抄经', '电脑上用输入法打字，打对一个落一个墨字'],
      [104.0, 110.8, '山寺咖啡', '修行间隙，到东院茶寮喝一杯'],
      [111.8, 117.2, '咖啡师父现做', '般若拿铁 · 上岸冷萃 · 桂花拿铁'],
      [123.2, 129.4, '露台 · 油纸伞', '坐下来，一口一口慢慢喝'],
      [134.0, 141.4, '日暮', '一天的功课，慢慢做完'],
      [146.8, 151.6, '柿柿如意', '柿饼架前合十，得一句好彩头'],
      [152.4, 157.6, '祈福灯廊', '一百多盏灯，每盏下面一张心愿'],
      [hangRelease - 1.6, hangRelease + 4.4, '挂一盏灯', '写一句心愿，灯自己升到绳上'],
      [hangRelease + 5.6, 175.8, '入夜', '灯火都亮了，明天再来'],
    ],
  };
})();
// —— 小红书版（coffee）的时间表：只拍咖啡。用户 2026-11-19：「不拍宗教，你拍喝咖啡呢，然后咖啡店名得换一下」——
// 店名改成「半山咖啡」；画面里不跪拜、不上香、不诵经，没有「功德」，字幕不用宗教词。动作卡在拍子上：咖啡做好、递杯、每一口、空杯落桶
export const COFFEE = (() => {
  const cupReady = onBeat(30.0);
  const give = onBeat(41.4);
  return {
    cuts: [16.8, 24.0, 43.2, 55.2, 62.4, 69.6], // 点单界面 ‖ 回到吧台 ‖ 两人坐下喝 ‖ 回收桶旁 ‖ 分享卡 ‖ 日落
    approach: [0.4, 15.6], // 从石板小路走上露台、进厅、到吧台前
    menu: [16.8, 24.0], // 点单界面（实拍截图）
    brew: [24.0, cupReady],
    cupReady,
    toFriend: [33.6, 39.6], // 端着满杯走到朋友桌边
    offer: give - 1.0,
    give,
    sit: [43.2, 55.2], // 两人坐在伞下：主角三口，朋友两口
    sips: [onBeat(45.6), onBeat(49.2), onBeat(52.8)],
    friendSips: [onBeat(47.4), onBeat(51.0)],
    toBin: [55.8, 59.4],
    binOffer: onBeat(60.6) - 1.0,
    binDrop: onBeat(60.6),
    card: [62.4, 69.6], // 分享卡
    aerial: [69.6, 84.0], // 从露台升起来俯看整座咖啡馆，再落回门前，天色转暗
    night: [84.0, 100.0],
    nightSip: onBeat(90.0),
    end: 96.0,
    fadeOut: [97.2, 99.8],
    hours: [[0, 14.6], [62.4, 15.6], [69.6, 16.6], [78, 17.5], [84, 18.4], [90, 19.6], [100, 20.3]],
    caps: [
      [1.0, 7.4, '半山咖啡', '山里新开了一家咖啡馆'],
      [8.4, 14.8, '三开间 · 带露台', '吧台七米多，门口一只大纸杯'],
      [17.4, 23.4, '点一杯', '五款都是现做'],
      [24.6, 29.6, '咖啡师现做', '磨豆、萃取、打奶泡'],
      [34.4, 42.6, '请朋友喝一杯', '端着满杯走到 TA 身边，递过去'],
      [44.0, 50.8, '一杯三口', '坐在油纸伞下，慢慢喝'],
      [56.2, 61.8, '空杯回收', '喝完扔进门口的大纸杯'],
      [63.0, 69.0, '分享卡', '喝完生成一张，发给朋友'],
      [72.0, 80.4, '傍晚', '天慢慢暗下来，灯一盏盏亮了'],
      [86.0, 95.0, '入夜', '灯亮到很晚，夜里也有低因'],
    ],
  };
})();
// 配乐的段落：哪些时段鼓组收成半拍子、从哪里加笛子、哪里打镲、片尾在哪
export const MUSIC = WALKCUT
  ? { light: [[WALK.bowStart - 0.6, WALK.bowEnd + 0.6], [WALK.sit, WALK.sheet[1] + 1.0]], leadFrom: WALK.craneLib[0], crash: [...WALK.cuts, WALK.craneLib[0], WALK.aerial[0], WALK.alleyWalk[0], WALK.nightWalk[0]], end: WALK.end }
  : COFFEECUT
    ? { light: [COFFEE.sit], leadFrom: COFFEE.aerial[0], crash: [...COFFEE.cuts, COFFEE.night[0]], end: COFFEE.end }
    : null;

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
  ...(NEWS ? { line: undefined, feature: NEWS_TEXT[NEWS_ALIAS[id] ?? id], ...(NEWS_TIME[id] ? { time: NEWS_TIME[id] } : {}) } : {}),
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
// 修行版的撞钟落在镜头第 3 秒左右，前面留出按住蓄力的那一段
const bellHit = bellStart === undefined ? 1.3 : nextBeat(bellStart + (NEWS ? 2.9 : 1.2)) - bellStart;
export const EVENTS = {
  titleType: { from: 0.35, perChar: 0.14 },
  titleReveal: DOWNBEAT,
  titleSeal: 2.9,
  bellStrike: bellHit - STRIKER_DELAY,
  bellHit,
  // 修行版 100 拍/分钟：一拍敲一下（半拍太急）
  moktak: beatsIn('moktak', 0.25, CUT === 'features' || NEWS ? durOf('moktak') - 0.6 : Math.min(3.2, durOf('moktak') - 0.3), NEWS ? BEAT : BEAT / 2, MOKTAK_DELAY),
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
