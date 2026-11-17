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
}
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
  if (raw && typeof raw === 'object') data = { seals: raw.seals || {}, merit: raw.merit || {}, fortune: raw.fortune, lastVisit: raw.lastVisit, points: raw.points || 0, quests: raw.quests };
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

export function levelOf(points: number) {
  let i = 0;
  while (i < LEVELS.length - 1 && points >= LEVELS[i + 1].at) i++;
  return i;
}
