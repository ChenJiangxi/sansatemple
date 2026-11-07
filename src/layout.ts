// 场景布局与行走规则。大殿坐北朝南（朝 +Z），玩家从南边山门沿参道进来。
// 单位：米。小和尚约 1.3 米高。

export const HALL = {
  // 石台基
  baseX0: -17.5, baseX1: 17.5, baseZ0: -25.5, baseZ1: -1.5, baseH: 1.2,
  // 前台阶
  stepX0: -5, stepX1: 5, stepZ0: -1.5, stepZ1: 2,
  // 柱网：正面七开间，进深四间
  colX: [-14, -10, -6, -2, 2, 6, 10, 14],
  colZFront: -4,
  colZBack: -22.5,
  colZSide: [-8.6, -13.25, -17.9],
  colH: 5.8,
  // 内墙
  wallX: 14,
  backZ: -22.5,
  // 佛坛
  altarX0: -10, altarX1: 10, altarZ0: -22.3, altarZ1: -18.9, altarH: 1.25,
  // 供桌（上面有香炉和蜡烛）
  tableX0: -3.6, tableX1: 3.6, tableZ0: -18.4, tableZ1: -17.3, tableH: 0.95,
};

// 佛前上香时站的位置
export const ALTAR_SPOT = { x: 0, z: -16.4 };
export const ALTAR_BURNER = { x: 0, z: (HALL.tableZ0 + HALL.tableZ1) / 2 };

export const COURT = { x0: -44, x1: 44, z0: -36, z1: 68, gateX: 3.2 };

export const POND = { x: 25, z: 42, rx: 9.5, rz: 6.2 };

// 院中的大香炉
export const INCENSE = { x: 0, z: 7, r: 1.2 };

// 双塔
export const PAGODAS: { x: number; z: number; s: number }[] = [
  { x: -10, z: 15, s: 1.45 },
  { x: 10, z: 15, s: 1.45 },
];

// 两侧的配殿（不可进入）
export const SIDE_HALLS: { x: number; z: number; w: number; d: number; yaw: number }[] = [
  { x: -29, z: -4, w: 9, d: 17, yaw: Math.PI / 2 },
  { x: 29, z: -4, w: 9, d: 17, yaw: -Math.PI / 2 },
];

// 钟楼
export const BELL = { x: -25, z: 34, size: 6.4, platform: 0.22 };

export const SPAWN = { x: 0, z: 30, yaw: Math.PI };

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

// 法堂里的蒲团：中间留出走道，左右各 8 列，共 7 排 = 112 个，全部面向佛像（yaw = π）
export const CUSHION_ROWS = [-15.3, -13.75, -12.2, -10.65, -9.1, -7.55, -6.0];
export const CUSHION_COLS = (() => {
  const xs: number[] = [];
  for (let k = 7; k >= 0; k--) xs.push(-(1.7 + k * 1.55));
  for (let k = 0; k < 8; k++) xs.push(1.7 + k * 1.55);
  return xs;
})();
export const CUSHIONS: Seat[] = (() => {
  const list: Seat[] = [];
  let i = 0;
  for (const z of CUSHION_ROWS) {
    for (const x of CUSHION_COLS) {
      list.push({ id: `c${i++}`, kind: 'cushion', x, z, y: HALL.baseH + 0.07, yaw: Math.PI, approachX: x, approachZ: z + 0.85 });
    }
  }
  return list;
})();

// 长椅：每张两个座位
const BENCH_DEFS = [
  { x: 15.2, z: 47.5, yaw: Math.PI * 0.75 },
  { x: 25, z: 51.5, yaw: Math.PI },
  { x: 34.8, z: 47.5, yaw: Math.PI * 1.25 },
  { x: -15, z: 24, yaw: Math.PI * 0.5 },
  { x: -34, z: 14, yaw: Math.PI * 0.5 },
  { x: 34, z: 14, yaw: -Math.PI * 0.5 },
  { x: -12, z: 50, yaw: Math.PI * 0.5 },
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
  [-19, 4, 1.15], [-22, 18, 1.2], [-36, 24, 1.1], [-18, 40, 1.05], [-33, 52, 1.2], [-20, 60, 1.0],
  [19, 4, 1.1], [21, 20, 1.25], [37, 26, 1.1], [13, 34, 0.95], [36, 58, 1.15], [17, 61, 1.0],
  [-9, 30, 0.85], [9, 27, 0.85], [-8, 44, 0.9], [8, 52, 0.95],
  [-24, -27, 1.3], [24, -28, 1.3], [-38, -14, 1.2], [38, -16, 1.2], [-38, 4, 1.05], [38, 6, 1.0],
];

export const PINES: [number, number, number][] = [
  [-34, -30, 1.4], [33, -31, 1.5], [-8, -31, 1.6], [9, -32, 1.5], [-40, 38, 1.3], [40, 34, 1.35], [-40, 62, 1.25], [41, 64, 1.3],
];

export const ROCKS: [number, number, number][] = [
  [15, 36, 1.0], [34.5, 44, 0.8], [17, 49.5, 0.6], [-14.5, 12, 0.7], [6.5, 40, 0.55], [-6, 50, 0.6], [-30, 30, 0.7],
];

export const STONE_LANTERNS: [number, number][] = [
  [-3.9, 21], [3.9, 21], [-3.9, 33], [3.9, 33], [-3.9, 45], [3.9, 45], [-3.9, 57], [3.9, 57],
];

type Circle = { x: number; z: number; r: number };
type Box = { x0: number; x1: number; z0: number; z1: number };

const circles: Circle[] = [];
const boxes: Box[] = [];

for (const [x, z, s] of MAPLES) circles.push({ x, z, r: 0.45 * s });
for (const [x, z, s] of PINES) circles.push({ x, z, r: 0.5 * s });
for (const [x, z, s] of ROCKS) circles.push({ x, z, r: 0.9 * s });
for (const [x, z] of STONE_LANTERNS) circles.push({ x, z, r: 0.45 });
circles.push({ x: INCENSE.x, z: INCENSE.z, r: INCENSE.r });
for (const p of PAGODAS) circles.push({ x: p.x, z: p.z, r: 1.35 * p.s });
for (const x of HALL.colX) circles.push({ x, z: HALL.colZFront, r: 0.4 });
// 钟楼：四根柱子和钟
{
  const h = BELL.size / 2 - 0.4;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) circles.push({ x: BELL.x + sx * h, z: BELL.z + sz * h, r: 0.38 });
  circles.push({ x: BELL.x, z: BELL.z, r: 1.35 });
}
// 大殿侧墙、后墙、佛坛、供桌
boxes.push({ x0: -HALL.wallX - 0.25, x1: -HALL.wallX + 0.2, z0: HALL.backZ - 0.2, z1: HALL.colZFront - 0.45 });
boxes.push({ x0: HALL.wallX - 0.2, x1: HALL.wallX + 0.25, z0: HALL.backZ - 0.2, z1: HALL.colZFront - 0.45 });
boxes.push({ x0: -HALL.wallX, x1: HALL.wallX, z0: HALL.backZ - 0.3, z1: HALL.backZ + 0.25 });
boxes.push({ x0: HALL.altarX0 - 0.15, x1: HALL.altarX1 + 0.15, z0: HALL.altarZ0, z1: HALL.altarZ1 + 0.2 });
boxes.push({ x0: HALL.tableX0, x1: HALL.tableX1, z0: HALL.tableZ0, z1: HALL.tableZ1 });
// 配殿整体不可进入
for (const s of SIDE_HALLS) {
  const hw = (Math.abs(Math.sin(s.yaw)) > 0.5 ? s.d : s.w) / 2 + 0.6;
  const hd = (Math.abs(Math.sin(s.yaw)) > 0.5 ? s.w : s.d) / 2 + 0.6;
  boxes.push({ x0: s.x - hd, x1: s.x + hd, z0: s.z - hw, z1: s.z + hw });
}
// 长椅（每个座位一个碰撞圆，坐下时直接吸附过去）
for (const s of BENCH_SEATS) circles.push({ x: s.x - Math.sin(s.yaw) * 0.1, z: s.z - Math.cos(s.yaw) * 0.1, r: 0.36 });

export function heightAt(x: number, z: number): number {
  const h = HALL;
  if (x > h.baseX0 && x < h.baseX1 && z > h.baseZ0 && z < h.baseZ1) return h.baseH;
  if (x > h.stepX0 && x < h.stepX1 && z >= h.stepZ0 && z < h.stepZ1) {
    const t = (z - h.stepZ0) / (h.stepZ1 - h.stepZ0);
    return h.baseH * (1 - t);
  }
  const b = BELL.size / 2 + 0.6;
  if (Math.abs(x - BELL.x) < b && Math.abs(z - BELL.z) < b) return BELL.platform;
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

const onBase = (x: number, z: number) => x > HALL.baseX0 && x < HALL.baseX1 && z > HALL.baseZ0 && z < HALL.baseZ1;

// 能否从 a 走到 b：不能撞东西，也不能直接跨上台基（只能走台阶）
export function canStep(ax: number, az: number, bx: number, bz: number): boolean {
  if (blocked(bx, bz)) return false;
  const ha = heightAt(ax, az);
  const hb = heightAt(bx, bz);
  if (Math.abs(ha - hb) > 0.25) return false;
  const h = HALL;
  const nearEdge =
    !onBase(bx, bz) &&
    bx > h.baseX0 - R && bx < h.baseX1 + R && bz > h.baseZ0 - R && bz < h.baseZ1 + R &&
    !(bx > h.stepX0 + R && bx < h.stepX1 - R && bz > h.stepZ0 - 0.01);
  if (nearEdge) return false;
  return true;
}

export function onPlatform(x: number, z: number) {
  const h = HALL;
  return x > h.baseX0 && x < h.baseX1 && z > h.baseZ0 && z < h.stepZ0 + 0.01;
}

// —— 寻路：0.5 米一格的网格 A*，走不了的格子、跨不上去的高差都避开；蒲团所在的格子代价更高，尽量走过道 ——
const CELL = 0.5;
const GX0 = COURT.x0, GZ0 = COURT.z0;
const GW = Math.ceil((COURT.x1 - COURT.x0) / CELL);
const GH = Math.ceil((COURT.z1 - COURT.z0) / CELL);
let walk: Uint8Array | null = null;
let cost: Float32Array | null = null;

function buildGrid() {
  walk = new Uint8Array(GW * GH);
  cost = new Float32Array(GW * GH).fill(1);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const x = GX0 + (i + 0.5) * CELL;
      const z = GZ0 + (j + 0.5) * CELL;
      walk[j * GW + i] = blocked(x, z) ? 0 : 1;
    }
  for (const c of CUSHIONS) {
    for (let dz = -0.4; dz <= 0.6; dz += CELL)
      for (let dx = -0.4; dx <= 0.4; dx += CELL) {
        const i = Math.floor((c.x + dx - GX0) / CELL);
        const j = Math.floor((c.z + 0.1 + dz - GZ0) / CELL);
        if (i >= 0 && j >= 0 && i < GW && j < GH) cost[j * GW + i] = 4;
      }
  }
}

const cx = (i: number) => GX0 + (i + 0.5) * CELL;
const cz = (j: number) => GZ0 + (j + 0.5) * CELL;

// 两点之间能不能直线走过去（每 0.2 米检查一次）
export function lineClear(ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / 0.2));
  let px = ax, pz = az;
  for (let k = 1; k <= n; k++) {
    const x = ax + ((bx - ax) * k) / n;
    const z = az + ((bz - az) * k) / n;
    if (!canStep(px, pz, x, z)) return false;
    px = x;
    pz = z;
  }
  return true;
}

function nearestWalkable(i: number, j: number) {
  if (walk![j * GW + i]) return [i, j];
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < GW && jj < GH && walk![jj * GW + ii]) return [ii, jj];
      }
  return null;
}

export function planRoute(fx: number, fz: number, tx: number, tz: number): { x: number; z: number }[] {
  if (lineClear(fx, fz, tx, tz)) return [{ x: tx, z: tz }];
  if (!walk) buildGrid();
  const clampI = (v: number) => Math.max(0, Math.min(GW - 1, v));
  const clampJ = (v: number) => Math.max(0, Math.min(GH - 1, v));
  const s = nearestWalkable(clampI(Math.floor((fx - GX0) / CELL)), clampJ(Math.floor((fz - GZ0) / CELL)));
  const g = nearestWalkable(clampI(Math.floor((tx - GX0) / CELL)), clampJ(Math.floor((tz - GZ0) / CELL)));
  if (!s || !g) return [{ x: tx, z: tz }];
  const N = GW * GH;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const start = s[1] * GW + s[0];
  const goal = g[1] * GW + g[0];
  // 二叉堆
  const heap: number[] = [];
  const fScore = new Float32Array(N).fill(Infinity);
  const push = (n: number) => {
    heap.push(n);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fScore[heap[p]] <= fScore[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < heap.length && fScore[heap[l]] < fScore[heap[m]]) m = l;
        if (r < heap.length && fScore[heap[r]] < fScore[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const hx = g[0], hz = g[1];
  const h = (n: number) => Math.hypot((n % GW) - hx, Math.floor(n / GW) - hz);
  gScore[start] = 0;
  fScore[start] = h(start);
  push(start);
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false;
  let iter = 0;
  while (heap.length && iter++ < 120000) {
    const cur = pop();
    if (cur === goal) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % GW, cj = Math.floor(cur / GW);
    for (const [di, dj, w] of dirs) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const n = nj * GW + ni;
      if (!walk![n] || closed[n]) continue;
      // 斜着走时两侧也要能走，避免贴着角穿过去
      if (di && dj && (!walk![cj * GW + ni] || !walk![nj * GW + ci])) continue;
      if (!canStep(cx(ci), cz(cj), cx(ni), cz(nj))) continue;
      const ng = gScore[cur] + w * cost![n];
      if (ng < gScore[n]) {
        gScore[n] = ng;
        came[n] = cur;
        fScore[n] = ng + h(n);
        push(n);
      }
    }
  }
  if (!found) return [{ x: tx, z: tz }];
  const cells: { x: number; z: number }[] = [];
  for (let n = goal; n !== -1; n = came[n]) cells.push({ x: cx(n % GW), z: cz(Math.floor(n / GW)) });
  cells.reverse();
  cells.push({ x: tx, z: tz });
  // 拉直：能直线到达的点就跳过中间的格子（代价高的蒲团格子不跳过去）
  const out: { x: number; z: number }[] = [];
  let ax = fx, az = fz;
  let k = 0;
  while (k < cells.length) {
    // 往前推，直到出现挡住的点为止（多看 4 格，容许中间短暂被挡）
    let far = k;
    let misses = 0;
    for (let m = k; m < cells.length && misses < 4; m++) {
      if (lineClear(ax, az, cells[m].x, cells[m].z) && !crossesCushions(ax, az, cells[m].x, cells[m].z)) {
        far = m;
        misses = 0;
      } else misses++;
    }
    out.push(cells[far]);
    ax = cells[far].x;
    az = cells[far].z;
    k = far + 1;
  }
  return out;
}

function crossesCushions(ax: number, az: number, bx: number, bz: number) {
  if (!cost) return false;
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / 0.25));
  for (let k = 1; k < n; k++) {
    const x = ax + ((bx - ax) * k) / n;
    const z = az + ((bz - az) * k) / n;
    const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL);
    if (i >= 0 && j >= 0 && i < GW && j < GH && cost[j * GW + i] > 1) return true;
  }
  return false;
}
