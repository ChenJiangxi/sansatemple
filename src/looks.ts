// 衣钵：修行等级解锁的僧袍（海青 + 袈裟配色）和念珠。选好的存在本地，联机时随状态发给别人。
import { levelOf } from './progress';

export interface RobeLook {
  id: string;
  lv: number; // 几级解锁（对应 LEVELS 的下标）
  robe: string; // 海青
  sheen: string;
  lining: string; // 袖里
  kasaya: { base: string; seam: string; light: string; border: string }; // 袈裟：底色、缝线暗色、缝线亮边、缘边
}
export interface BeadLook {
  id: string;
  lv: number;
  color: string;
  rough: number;
}

export const ROBES: RobeLook[] = [
  { id: 'ochre', lv: 0, robe: '#d8ab55', sheen: '#fff0c4', lining: '#8e6a32', kasaya: { base: '#8a3420', seam: 'rgba(70,22,10,0.85)', light: 'rgba(196,110,70,0.45)', border: '#a8743a' } },
  { id: 'gray', lv: 1, robe: '#7c776d', sheen: '#d8d4ca', lining: '#4e4a44', kasaya: { base: '#6a4a30', seam: 'rgba(40,26,14,0.85)', light: 'rgba(170,130,90,0.4)', border: '#8a6a44' } },
  { id: 'saffron', lv: 3, robe: '#d8ab55', sheen: '#fff0c4', lining: '#8e6a32', kasaya: { base: '#c98a2a', seam: 'rgba(110,60,10,0.8)', light: 'rgba(255,220,150,0.45)', border: '#8a3420' } },
  { id: 'crimson', lv: 4, robe: '#d2a24e', sheen: '#ffe8b8', lining: '#7e5a2a', kasaya: { base: '#9a2418', seam: 'rgba(222,178,96,0.9)', light: 'rgba(255,230,170,0.35)', border: '#d2a24e' } },
  { id: 'tea', lv: 5, robe: '#8a6a48', sheen: '#e8d2b0', lining: '#4e3a26', kasaya: { base: '#5a3e28', seam: 'rgba(30,18,8,0.85)', light: 'rgba(170,130,90,0.4)', border: '#a88452' } },
  { id: 'violet', lv: 6, robe: '#cfa04e', sheen: '#ffe8b8', lining: '#6e4a2a', kasaya: { base: '#4e2446', seam: 'rgba(226,186,104,0.95)', light: 'rgba(255,236,180,0.4)', border: '#e0b45a' } },
];

export const BEADS: BeadLook[] = [
  { id: 'sandal', lv: 0, color: '#4a2212', rough: 0.35 },
  { id: 'bodhi', lv: 2, color: '#b88a52', rough: 0.55 },
  { id: 'starmoon', lv: 3, color: '#e6d8b8', rough: 0.4 },
  { id: 'amber', lv: 5, color: '#d9902a', rough: 0.2 },
  { id: 'coral', lv: 6, color: '#b8322a', rough: 0.28 },
];

const KEY = 'sansa.look';
export interface Look {
  robe: string;
  beads: string;
}
export function savedLook(points: number): Look {
  const lv = levelOf(points);
  let raw: Partial<Look> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    /* 坏了就用默认 */
  }
  const robe = ROBES.find((r) => r.id === raw.robe && r.lv <= lv) ?? ROBES[0];
  const beads = BEADS.find((b) => b.id === raw.beads && b.lv <= lv) ?? BEADS[0];
  return { robe: robe.id, beads: beads.id };
}
export function saveLook(l: Look) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* 存不了也不影响 */
  }
}

// 联机时发出去的一小段文字：僧袍.念珠.等级
export function lookCode(l: Look, lv: number) {
  return `${l.robe}.${l.beads}.${lv}`;
}
export function parseLook(code: string | undefined): (Look & { lv: number }) | null {
  const m = /^([a-z]{2,10})\.([a-z]{2,10})\.([0-6])$/.exec(code ?? '');
  if (!m) return null;
  const robe = ROBES.find((r) => r.id === m[1]) ?? ROBES[0];
  const beads = BEADS.find((b) => b.id === m[2]) ?? BEADS[0];
  return { robe: robe.id, beads: beads.id, lv: Number(m[3]) };
}
