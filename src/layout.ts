// 场景布局与行走规则。大殿坐北朝南（朝 +Z），玩家从南边山门进来。
export const HALL = {
  // 石台基
  baseX0: -11, baseX1: 11, baseZ0: -16.5, baseZ1: -2, baseH: 0.9,
  // 前台阶
  stepX0: -3.6, stepX1: 3.6, stepZ0: -2, stepZ1: 0.6,
  // 柱网
  colX: [-9, -5.4, -1.8, 1.8, 5.4, 9],
  colZFront: -3.4,
  colZBack: -15.2,
  colH: 4.3,
  // 内墙
  wallX: 9,
  backZ: -15.2,
  // 佛坛
  altarX0: -5.6, altarX1: 5.6, altarZ0: -14.9, altarZ1: -12.9, altarH: 1.0,
};

export const COURT = { x0: -27, x1: 27, z0: -24, z1: 31, gateX: 2.6 };

export const POND = { x: 16, z: 9, rx: 6.2, rz: 4.4 };

export const INCENSE = { x: 0, z: 4.2, r: 0.85 };

export const PAGODA = { x: -8, z: 6.5, r: 1.45 };

export const SPAWN = { x: 0, z: 22, yaw: Math.PI };

export interface Seat {
  id: string;
  kind: 'cushion' | 'bench';
  x: number;
  z: number;
  y: number;
  yaw: number; // 坐下后面朝的方向（世界 yaw，0 = 朝 +Z）
  approachX: number;
  approachZ: number;
}

// 法堂里的蒲团：7 列 × 4 排，全部面向佛像（-Z 方向，yaw = π）
export const CUSHIONS: Seat[] = (() => {
  const xs = [-6.6, -4.4, -2.2, 0, 2.2, 4.4, 6.6];
  const zs = [-10.6, -8.5, -6.4, -4.6];
  const list: Seat[] = [];
  let i = 0;
  for (const z of zs) {
    for (const x of xs) {
      list.push({ id: `c${i++}`, kind: 'cushion', x, z, y: HALL.baseH + 0.07, yaw: Math.PI, approachX: x, approachZ: z + 0.9 });
    }
  }
  return list;
})();

// 长椅：每张两个座位
const BENCH_DEFS = [
  { x: 11.5, z: 17.2, yaw: Math.PI * 0.82 },
  { x: 20.8, z: 16.8, yaw: Math.PI * 1.15 },
  { x: -15.5, z: 13.5, yaw: Math.PI * 0.62 },
  { x: -18.5, z: -6, yaw: Math.PI * 0.5 },
];
export const BENCHES = BENCH_DEFS;
export const BENCH_SEATS: Seat[] = BENCH_DEFS.flatMap((b, bi) =>
  [-0.55, 0.55].map((off, si) => {
    const cx = b.x + Math.cos(b.yaw) * off;
    const cz = b.z - Math.sin(b.yaw) * off;
    return {
      id: `b${bi}-${si}`,
      kind: 'bench' as const,
      x: cx,
      z: cz,
      y: 0.46,
      yaw: b.yaw,
      approachX: cx + Math.sin(b.yaw) * 0.9,
      approachZ: cz + Math.cos(b.yaw) * 0.9,
    };
  })
);

export const ALL_SEATS: Seat[] = [...CUSHIONS, ...BENCH_SEATS];
export const SEAT_BY_ID = new Map(ALL_SEATS.map((s) => [s.id, s]));

export const MAPLES: [number, number, number][] = [
  [-13, 1, 1.05], [-18.5, -10, 1.2], [-21, 8, 1.1], [-10.5, 19, 0.95], [-21.5, 23, 1.15],
  [13, -1, 1.0], [22, 3, 1.2], [23.5, 22, 1.05], [7.5, 25, 0.9], [-15, -20, 1.25],
  [15, -19.5, 1.2], [-6, 26.5, 0.85], [24, -12, 1.1], [-24.5, -2, 1.0],
];

export const PINES: [number, number, number][] = [
  [-23, -19, 1.3], [22, -21, 1.4], [-25, 15, 1.2], [25, 11, 1.3], [-4, -21, 1.5], [6, -22, 1.35],
];

export const ROCKS: [number, number, number][] = [
  [10.5, 6.2, 0.8], [21.6, 12.4, 0.65], [11, 12.6, 0.55], [-11, 10, 0.6], [4.5, 12, 0.45], [-4, 14, 0.5],
];

export const STONE_LANTERNS: [number, number][] = [[-2.9, 9], [2.9, 9], [-2.9, 17], [2.9, 17]];

type Circle = { x: number; z: number; r: number };
type Box = { x0: number; x1: number; z0: number; z1: number };

const circles: Circle[] = [];
const boxes: Box[] = [];

for (const [x, z, s] of MAPLES) circles.push({ x, z, r: 0.45 * s });
for (const [x, z, s] of PINES) circles.push({ x, z, r: 0.5 * s });
for (const [x, z, s] of ROCKS) circles.push({ x, z, r: 0.9 * s });
for (const [x, z] of STONE_LANTERNS) circles.push({ x, z, r: 0.42 });
circles.push({ x: INCENSE.x, z: INCENSE.z, r: INCENSE.r });
circles.push({ x: PAGODA.x, z: PAGODA.z, r: PAGODA.r });
for (const x of HALL.colX) {
  circles.push({ x, z: HALL.colZFront, r: 0.36 });
}
// 大殿侧墙与后墙
boxes.push({ x0: -HALL.wallX - 0.25, x1: -HALL.wallX + 0.2, z0: HALL.backZ - 0.2, z1: HALL.colZFront - 0.4 });
boxes.push({ x0: HALL.wallX - 0.2, x1: HALL.wallX + 0.25, z0: HALL.backZ - 0.2, z1: HALL.colZFront - 0.4 });
boxes.push({ x0: -HALL.wallX, x1: HALL.wallX, z0: HALL.backZ - 0.3, z1: HALL.backZ + 0.25 });
boxes.push({ x0: HALL.altarX0 - 0.15, x1: HALL.altarX1 + 0.15, z0: HALL.altarZ0, z1: HALL.altarZ1 + 0.2 });
// 长椅（每个座位一个碰撞圆，坐下时直接吸附过去）
for (const s of BENCH_SEATS) circles.push({ x: s.x - Math.sin(s.yaw) * 0.1, z: s.z - Math.cos(s.yaw) * 0.1, r: 0.36 });

export function heightAt(x: number, z: number): number {
  const h = HALL;
  if (x > h.baseX0 && x < h.baseX1 && z > h.baseZ0 && z < h.baseZ1) return h.baseH;
  if (x > h.stepX0 && x < h.stepX1 && z >= h.stepZ0 && z < h.stepZ1) {
    const t = (z - h.stepZ0) / (h.stepZ1 - h.stepZ0);
    return h.baseH * (1 - t);
  }
  return 0;
}

export function inPond(x: number, z: number, margin = 0): boolean {
  const dx = (x - POND.x) / (POND.rx + margin);
  const dz = (z - POND.z) / (POND.rz + margin);
  return dx * dx + dz * dz < 1;
}

const R = 0.28; // 小和尚的碰撞半径

export function blocked(x: number, z: number): boolean {
  if (x < COURT.x0 + 1 || x > COURT.x1 - 1 || z < COURT.z0 + 1 || z > COURT.z1 - 0.8) return true;
  if (inPond(x, z, 0.35)) return true;
  for (const c of circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = c.r + R;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  for (const b of boxes) {
    if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R) return true;
  }
  return false;
}

// 能否从 a 走到 b：不能撞东西，也不能直接跨上台基（只能走台阶）
export function canStep(ax: number, az: number, bx: number, bz: number): boolean {
  if (blocked(bx, bz)) return false;
  const ha = heightAt(ax, az);
  const hb = heightAt(bx, bz);
  if (Math.abs(ha - hb) > 0.25) return false;
  // 台基边缘留一点余量，避免贴着边缘悬空
  const h = HALL;
  const onBase = (x: number, z: number) => x > h.baseX0 && x < h.baseX1 && z > h.baseZ0 && z < h.baseZ1;
  const nearEdge = (x: number, z: number) =>
    !onBase(x, z) &&
    x > h.baseX0 - R && x < h.baseX1 + R && z > h.baseZ0 - R && z < h.baseZ1 + R &&
    !(x > h.stepX0 + R && x < h.stepX1 - R && z > h.stepZ0 - 0.01);
  if (nearEdge(bx, bz)) return false;
  return true;
}

export function onPlatform(x: number, z: number) {
  const h = HALL;
  return x > h.baseX0 && x < h.baseX1 && z > h.baseZ0 && z < h.stepZ0 + 0.01;
}

// 点到点的路线：上下台基时经过台阶
export function planRoute(fx: number, fz: number, tx: number, tz: number): { x: number; z: number }[] {
  const fromUp = onPlatform(fx, fz);
  const toUp = onPlatform(tx, tz);
  const route: { x: number; z: number }[] = [];
  const stepX = Math.max(HALL.stepX0 + 0.6, Math.min(HALL.stepX1 - 0.6, (fx + tx) / 2));
  if (!fromUp && toUp) {
    route.push({ x: stepX, z: HALL.stepZ1 + 0.7 });
    route.push({ x: stepX, z: HALL.stepZ0 - 0.7 });
  } else if (fromUp && !toUp) {
    route.push({ x: stepX, z: HALL.stepZ0 - 0.7 });
    route.push({ x: stepX, z: HALL.stepZ1 + 0.7 });
  }
  route.push({ x: tx, z: tz });
  return route;
}
