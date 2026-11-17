// 本地存档：寺游印谱（十二处印）、功德簿（各种功课的累计次数）、今天求到的签。都存在 localStorage。
export type SealId = 'gate' | 'bow' | 'incense' | 'bell' | 'drum' | 'moktak' | 'beads' | 'sit' | 'bridge' | 'koi' | 'lantern' | 'fortune';
export type MeritKey = 'bow' | 'incense' | 'moktak' | 'beads' | 'bell' | 'drum' | 'lantern' | 'koi' | 'visits' | 'service' | 'sutra';

// 印文用繁体，和寺里的匾额一致
export const SEALS: { id: SealId; text: string }[] = [
  { id: 'gate', text: '入山' },
  { id: 'bow', text: '禮佛' },
  { id: 'incense', text: '心香' },
  { id: 'bell', text: '晨鐘' },
  { id: 'drum', text: '暮鼓' },
  { id: 'moktak', text: '木魚' },
  { id: 'beads', text: '百八' },
  { id: 'sit', text: '靜坐' },
  { id: 'bridge', text: '渡橋' },
  { id: 'koi', text: '觀魚' },
  { id: 'lantern', text: '河燈' },
  { id: 'fortune', text: '靈籤' },
];

interface Save {
  seals: Partial<Record<SealId, number>>; // 盖印的时间（毫秒）
  merit: Partial<Record<MeritKey, number>>;
  fortune?: { day: string; n: number };
  lastVisit?: string;
  points?: number; // 累计功德点
  quests?: { day: string; state: Record<string, QuestSave> };
  daily?: { day: string; c: Record<string, number>; got: string[] }; // 今天各种功课的次数、已领的功课奖励
  reading?: Record<string, ReadSave>; // 经藏：每部经读到哪一页、读完几遍
}
export interface ReadSave {
  last: number; // 上次读到第几页（下次从这里接着读）
  seen: number[]; // 这一遍已经读过的页
  times: number; // 读完几遍
  total?: number; // 一共几页（第一次打开时记下，经藏列表画进度条用）
  day?: string; // 今天读过、给过功德的页
  paid?: number[];
}

// 今日功课：每天本地零点重置。做到 need 次自动给 reward 功德；全部做完再加 DAILY_BONUS
export const DAILY: { id: string; need: number; reward: number; lv?: number }[] = [
  { id: 'bow', need: 10, reward: 8 },
  { id: 'incense', need: 1, reward: 5 },
  { id: 'moktak', need: 30, reward: 6 },
  { id: 'beads', need: 108, reward: 8 },
  { id: 'read', need: 3, reward: 6 },
  { id: 'sutra', need: 5, reward: 6, lv: 3 }, // 藏经阁开放（比丘）以后才有
];
export const DAILY_BONUS = 20;
export interface QuestSave {
  phase: 'active' | 'ready' | 'done'; // 接了、做完待回禀、已回禀
  got: number[]; // 已完成的目标编号
}

// 修行等级：按累计功德点升，名牌上显示称号
export const LEVELS: { at: number; key: string }[] = [
  { at: 0, key: 'lv0' },
  { at: 60, key: 'lv1' },
  { at: 200, key: 'lv2' },
  { at: 500, key: 'lv3' },
  { at: 1200, key: 'lv4' },
  { at: 3000, key: 'lv5' },
  { at: 8000, key: 'lv6' },
];

// 各处地方几级开放（LEVELS 的下标）：观音殿、地藏殿、藏经阁、登塔
export const PLACE_LEVEL = { guanyin: 1, dizang: 2, library: 3, pagoda: 4 } as const;

const KEY = 'sansa.progress';
let data: Save = { seals: {}, merit: {} };
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (raw && typeof raw === 'object') data = { seals: raw.seals || {}, merit: raw.merit || {}, fortune: raw.fortune, lastVisit: raw.lastVisit, points: raw.points || 0, quests: raw.quests, daily: raw.daily, reading: raw.reading || {} };
} catch {
  /* 存档坏了就从头开始 */
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式下存不了，不影响游玩 */
  }
}

// 本地日期（不是 UTC），过了本地午夜才算新的一天
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const progress = {
  has(id: SealId) {
    return !!data.seals[id];
  },
  // 盖印；第一次盖返回 true
  stamp(id: SealId) {
    if (data.seals[id]) return false;
    data.seals[id] = Date.now();
    save();
    return true;
  },
  when(id: SealId) {
    return data.seals[id] ?? 0;
  },
  count() {
    return SEALS.filter((s) => data.seals[s.id]).length;
  },
  add(k: MeritKey, n = 1) {
    data.merit[k] = (data.merit[k] || 0) + n;
    tickDaily(k, n);
    save();
  },
  // 今天做了几次（功课进度）
  today(k: string) {
    return data.daily && data.daily.day === today() ? data.daily.c[k] || 0 : 0;
  },
  tick(k: string, n = 1) {
    tickDaily(k, n);
    save();
  },
  // 功课做满了、还没领的：返回这些功课（调用方给功德、放提示），并记为已领
  claimDaily(lv: number): { id: string; reward: number }[] {
    const d = dailyState();
    const out: { id: string; reward: number }[] = [];
    for (const q of DAILY) {
      if ((q.lv ?? 0) > lv || d.got.includes(q.id) || (d.c[q.id] || 0) < q.need) continue;
      d.got.push(q.id);
      out.push({ id: q.id, reward: q.reward });
    }
    const all = DAILY.filter((q) => (q.lv ?? 0) <= lv);
    if (out.length && !d.got.includes('all') && all.every((q) => d.got.includes(q.id))) {
      d.got.push('all');
      out.push({ id: 'all', reward: DAILY_BONUS });
    }
    if (out.length) save();
    return out;
  },
  dailyGot(id: string) {
    return data.daily && data.daily.day === today() ? data.daily.got.includes(id) : false;
  },
  // 经藏：每部经的阅读进度
  reading(id: string): ReadSave {
    data.reading ??= {};
    return (data.reading[id] ??= { last: 0, seen: [], times: 0 });
  },
  saveReading() {
    save();
  },
  merit(k: MeritKey) {
    return data.merit[k] || 0;
  },
  // 每天第一次进寺记一次
  visit() {
    const d = today();
    if (data.lastVisit === d) return;
    data.lastVisit = d;
    data.merit.visits = (data.merit.visits || 0) + 1;
    save();
  },
  fortuneToday(): number | null {
    return data.fortune && data.fortune.day === today() ? data.fortune.n : null;
  },
  setFortune(n: number) {
    data.fortune = { day: today(), n };
    save();
  },
  // 功德点：返回加分前后的等级，升级时调用方放提示
  points() {
    return data.points || 0;
  },
  addPoints(n: number) {
    const before = levelOf(data.points || 0);
    data.points = (data.points || 0) + n;
    save();
    return { before, after: levelOf(data.points) };
  },
  // 今天的寺务（每天本地零点重置）
  quest(id: string): QuestSave | null {
    if (!data.quests || data.quests.day !== today()) return null;
    return data.quests.state[id] ?? null;
  },
  setQuest(id: string, q: QuestSave) {
    if (!data.quests || data.quests.day !== today()) data.quests = { day: today(), state: {} };
    data.quests.state[id] = q;
    save();
  },
};

function dailyState() {
  if (!data.daily || data.daily.day !== today()) data.daily = { day: today(), c: {}, got: [] };
  return data.daily;
}
function tickDaily(k: string, n: number) {
  const d = dailyState();
  d.c[k] = (d.c[k] || 0) + n;
}

export function levelOf(points: number) {
  let i = 0;
  while (i < LEVELS.length - 1 && points >= LEVELS[i + 1].at) i++;
  return i;
}
