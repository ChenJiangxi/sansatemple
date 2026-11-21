// 场景布局与行走规则。大殿坐北朝南（朝 +Z），玩家从南边山门沿参道进来。
// 单位：米。小和尚约 1.3 米高。

export const HALL = {
  // 石台基
  baseX0: -17.5, baseX1: 17.5, baseZ0: -25.5, baseZ1: -1.5, baseH: 1.2,
  // 前台阶
  stepX0: -5, stepX1: 5, stepZ0: -1.5, stepZ1: 2,
  // 柱网：正面七开间，进深四间。明间最宽（5.6 m），次间、梢间、尽间依次收窄（4.2 / 3.8 / 3.2 m）
  colX: [-14, -10.8, -7, -2.8, 2.8, 7, 10.8, 14],
  colZFront: -4,
  colZBack: -22.5,
  colZSide: [-8.6, -13.25, -17.9],
  colH: 5.8,
  // 内墙
  wallX: 14,
  backZ: -22.5,
  // 佛坛
  altarX0: -10.5, altarX1: 10.5, altarZ0: -22.3, altarZ1: -19.2, altarH: 0.95,
  // 供桌（上面有香炉和蜡烛）
  tableX0: -1.7, tableX1: 1.7, tableZ0: -18.5, tableZ1: -17.45, tableH: 0.82,
};

// 佛前上香时站的位置
export const ALTAR_SPOT = { x: 0, z: -16.75 };
export const ALTAR_BURNER = { x: 0, z: HALL.tableZ1 - 0.32 };

export const COURT = { x0: -44, x1: 44, z0: -50, z1: 68, gateX: 3.2 };
// 山门台基：高 base 米；门洞那一间（|x| < hx）往院里伸到 z0，开着的两扇门落在上面；往院里下两级踏步，宽 ±stepHX、进深 run
export const GATE = { base: 0.3, hx: 3.75, z0: COURT.z1 - 3.25, stepHX: 2.3, run: 0.6 };

// 放生池在中轴线上，参道从石拱桥上过
export const POND = { x: 0, z: 52, rx: 11, rz: 5.2 };
export const BRIDGE = { x0: -1.8, x1: 1.8, z0: 52 - 5.2 - 1.4, z1: 52 + 5.2 + 1.4, h: 1.15 };

// 院中的大香炉
export const INCENSE = { x: 0, z: 7, r: 1.2 };

// 双塔：七层，约 18 米高，塔顶高过大殿屋脊（能登上去看云海）
export const PAGODAS: { x: number; z: number; s: number }[] = [
  { x: -10, z: 15, s: 2.1 },
  { x: 10, z: 15, s: 2.1 },
];

// 两侧的配殿（不可进入）
export const SIDE_HALLS: { x: number; z: number; w: number; d: number; yaw: number }[] = [
  { x: -29, z: -4, w: 9, d: 17, yaw: Math.PI / 2 },
  { x: 29, z: -4, w: 9, d: 17, yaw: -Math.PI / 2 },
];

// 藏经阁：大殿正后方，两层，门朝大殿（本地坐标和配殿一样：x 沿面阔，z 朝殿门为正）
export const LIBRARY = { x: 0, z: -41, w: 9, d: 19, yaw: 0 };
// 两座配殿 + 藏经阁：共用一套殿门、解锁和殿内行走
export const HALLS = [...SIDE_HALLS, LIBRARY];
// 藏经阁里三张经案（本地 x）和经案的本地 z；人坐在经案后面（朝殿门那一侧）、面朝经橱
export const LIB_DESKS = [-4.6, 0, 4.6];
export const LIB_DESK_Z = 0.1;
export const LIB_SEAT_Z = LIB_DESK_Z + 0.82;

// 钟楼（左）；右边原来的鼓楼 2026-11-19 去掉了
export const BELL = { x: -24, z: 27, size: 6.4, platform: 0.22 };

export const SPAWN = { x: 0, z: 38, yaw: Math.PI };

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
      list.push({ id: `c${i++}`, kind: 'cushion', x, z, y: HALL.baseH + 0.18, yaw: Math.PI, approachX: x, approachZ: z + 0.85 });
    }
  }
  return list;
})();

// 长椅：每张两个座位
const BENCH_DEFS = [
  { x: -14.8, z: 49.5, yaw: Math.PI * 0.5 },
  { x: -14.8, z: 55, yaw: Math.PI * 0.5 },
  { x: 14.8, z: 49.5, yaw: -Math.PI * 0.5 },
  { x: 14.8, z: 55, yaw: -Math.PI * 0.5 },
  { x: -34, z: 14, yaw: Math.PI * 0.5 },
  { x: 34, z: 14, yaw: -Math.PI * 0.5 },
  { x: -15, z: 38, yaw: Math.PI * 0.5 },
];
export const BENCHES = BENCH_DEFS;
// 东边银杏下一张石凳，常住僧人读经、歇脚用（不进玩家座位表）
export const NPC_BENCHES = [{ x: 7.6, z: 29.4, yaw: -Math.PI * 0.75 }];
export function benchSeat(b: { x: number; z: number; yaw: number }, off: number) {
  const x = b.x + Math.cos(b.yaw) * off, z = b.z - Math.sin(b.yaw) * off;
  return { x, z, yaw: b.yaw, ax: x + Math.sin(b.yaw) * 0.9, az: z + Math.cos(b.yaw) * 0.9 };
}
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

// 半山咖啡：东院一座三开间的茶寮，前脸朝西（朝放生池和参道），厅前一片木平台（露台）。
// 本地坐标：x 沿面阔（世界 +z 方向），z 朝前为正（世界 -x 方向）。
// 厅：x ±hw、z ±hd；露台：z 从 hd 到 deck；地面都垫高 base。吧台在后墙前（z 从 bar-0.6 到 bar），吧台里再垫高 inner。
export const CAFE = { x: 38.4, z: 48.5, yaw: -Math.PI / 2, base: 0.15, inner: 0.2, hw: 5.5, hd: 3.2, deck: 8.4, bar: -1.0, colH: 3.2 };
export function cafeWorld(lx: number, lz: number) {
  const c = Math.cos(CAFE.yaw), s = Math.sin(CAFE.yaw);
  return { x: CAFE.x + lx * c + lz * s, z: CAFE.z - lx * s + lz * c };
}
export function cafeLocal(x: number, z: number) {
  const c = Math.cos(CAFE.yaw), s = Math.sin(CAFE.yaw);
  const dx = x - CAFE.x, dz = z - CAFE.z;
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}
export const CAFE_STAND = cafeWorld(0, -0.15); // 点单、取咖啡时站的位置（吧台前）
export const CAFE_BIN = cafeWorld(4.95, 7.85); // 空杯回收桶：露台右前角
export const CAFE_BIN_STAND = cafeWorld(4.0, 7.85);
export const CAFE_FLAG = cafeWorld(-5.15, 8.15); // 布幌子的竹竿：露台左前角
export const CAFE_MENU = cafeWorld(1.9, 9.0); // 菜单木牌：露台入口旁
// 半山夜场（静音蹦迪）：露台中间、两排伞桌之间那条过道就是舞池（本地坐标）。
// 舞池前沿左边一张 DJ 台（台面朝着咖啡馆），前沿两角各一根竹竿，和前檐两根柱子之间拉串灯
export const DISCO = { lx0: -1.6, lx1: 1.6, lz0: 3.45, lz1: 8.3, boothX0: -1.55, boothX1: -0.45, boothZ0: 7.85, boothZ1: 8.35, poleX: 1.75, poleZ: 8.28 };
export function onDanceFloor(x: number, z: number) {
  const { lx, lz } = cafeLocal(x, z);
  return lx > DISCO.lx0 && lx < DISCO.lx1 && lz > DISCO.lz0 && lz < DISCO.lz1;
}
// 露台四张伞桌、厅里两侧窗边各一张；每张两只圆凳，坐下面朝桌子，从前面（露台一侧）走过去坐
export const CAFE_TABLE_LOCAL: [number, number][] = [[-3.0, 5.0], [3.0, 5.0], [-3.0, 7.3], [3.0, 7.3], [-4.2, 1.2], [4.2, 1.2]];
export const CAFE_TABLES = CAFE_TABLE_LOCAL.map(([lx, lz]) => cafeWorld(lx, lz));
export const CAFE_SEATS: Seat[] = CAFE_TABLE_LOCAL.flatMap(([tx, tz], ti) =>
  [-1, 1].map((sx, si) => {
    const p = cafeWorld(tx + sx * 0.75, tz), a = cafeWorld(tx + sx * 0.75, tz + 0.8);
    return { id: `k${ti * 2 + si}`, kind: 'bench' as const, x: p.x, z: p.z, y: 0.46, yaw: sx < 0 ? 0 : Math.PI, approachX: a.x, approachZ: a.z };
  })
);
// 柱子（本地）：前后两排各四根，两山墙中间各一根
export const CAFE_COLS: [number, number][] = [
  ...[-5.2, -1.8, 1.8, 5.2].flatMap((x) => [[x, 2.9], [x, -2.9]] as [number, number][]),
  [-5.2, 0], [5.2, 0],
];

// 祈福灯廊：西院（和东边的咖啡摊对称），南北向一条廊，两排高木杆，杆间拉绳挂灯笼。
// 玩家在灯廊东边的祈福台写心愿，挂到绳上的空位。杆的 x 和一排排的 z：
export const WISH_ALLEY = { xE: -24.8, xW: -29.2, zs: [43, 46.6, 50.2, 53.8, 57.4, 61], h: 4.4 };
export const WISH_DESK = { x: -22.7, z: 52, yaw: Math.PI / 2 }; // 祈福台，台面朝东（朝参道）
export const WISH_DESK_STAND = { x: -21.6, z: 52 };
// 柿饼架：灯廊北头，东西向一排木架挂着一串串柿子
export const PERSIMMON = { x: -27, z: 39.4, len: 3.2 };
export const PERSIMMON_STAND = { x: -27, z: 40.7 };
// 从参道分出去的两条石板小路：东边到咖啡摊，西边到灯廊（只是铺地，不挡路）
export const STONE_PATHS: { x: number; z: number }[][] = [
  [{ x: 3.4, z: 43.2 }, { x: 9, z: 42.9 }, { x: 13.5, z: 42.7 }, { x: 19, z: 43.4 }, { x: 24, z: 45.4 }, { x: 29.0, z: 47.8 }],
  [{ x: -3.4, z: 43.2 }, { x: -9, z: 42.9 }, { x: -13.5, z: 42.6 }, { x: -18.6, z: 43.6 }, { x: -21, z: 47.5 }, { x: -21.4, z: 51.6 }],
];

// 围炉煮茶：半山咖啡北边那棵大枫树下，一张放宽的明式茶几，中间架着火钵，四把露营椅对着茶几四条边（座位 t0–t3，面朝炉子）
export const TEA = { x: 31.0, z: 57.8, half: 0.61 };
export const TEA_SEATS: Seat[] = [0, 1, 2, 3].map((i) => {
  const a = (i * Math.PI) / 2;
  const r = 1.12, ra = 1.85;
  const x = TEA.x + Math.sin(a) * r, z = TEA.z + Math.cos(a) * r;
  return { id: `t${i}`, kind: 'bench' as const, x, z, y: 0.42, yaw: a + Math.PI, approachX: TEA.x + Math.sin(a) * ra, approachZ: TEA.z + Math.cos(a) * ra };
});
export const ALL_SEATS: Seat[] = [...CUSHIONS, ...BENCH_SEATS, ...CAFE_SEATS, ...TEA_SEATS];
export const SEAT_BY_ID = new Map(ALL_SEATS.map((s) => [s.id, s]));

// 院中的树（大多是银杏，少数枫树），坐标 + 大小
export const MAPLES: [number, number, number][] = [
  [-19, 4, 1.2], [-22, 17, 1.25], [-37, 26, 1.1], [-18, 42, 1.1], [-33, 54, 1.2], [-21, 63, 1.0],
  [19, 4, 1.2], [21, 17, 1.25], [37, 26, 1.1], [18, 42, 1.1], [33.5, 58.5, 1.2], [21, 63, 1.0],
  [-9, 31, 0.9], [9, 31, 0.9],
  [-24, -27, 1.35], [24, -28, 1.35], [-38, -14, 1.2], [38, -16, 1.2], [-38, 4, 1.05], [38, 6, 1.05],
  // 原来鼓楼的位置（2026-11-19 去掉鼓楼），种一棵大银杏，和西边的钟楼相对
  [24, 27, 1.3],
];

export const PINES: [number, number, number][] = [
  [-34, -30, 1.4], [33, -31, 1.5], [-8, -31, 1.6], [9, -32, 1.5], [-40, 38, 1.3], [40, 34, 1.35], [-40, 62, 1.25], [41, 64, 1.3],
];

export const ROCKS: [number, number, number][] = [
  [-13, 44, 0.8], [13.5, 45, 0.7], [-38.4, 44.5, 0.8], [38.6, 40.5, 0.75], [-14.5, 12, 0.6], [14.5, 11, 0.6],
];


// 配殿前、通往钟楼的石灯（夜里点亮，照亮寺院两侧）
export const SIDE_LAMPS: [number, number][] = [
  [-20.6, -11], [-20.6, -4], [-20.6, 3], [-20.6, 10], [-20.6, 17],
  [20.6, -11], [20.6, -4], [20.6, 3], [20.6, 10], [20.6, 17],
  // 通往钟楼的小路两旁（东边原来通鼓楼的那两盏随鼓楼一起去掉了）
  [-11.5, 29.4], [-16.5, 29.4],
  // 放生池两侧石凳旁
  [-17, 52.2], [17, 52.2], [-16, 45.5], [16, 45.5],
  // 藏经阁台阶两旁
  [-3.4, -34.2], [3.4, -34.2],
];

// 放生池边的河灯台（放河灯）与观音殿前的签筒（求签）：桌子位置、玩家站的位置和朝向
export const LANTERN_STAND = { x: -7.7, z: 46.0, standX: -6.15, standZ: 46.75, yaw: 0 };
export const FORTUNE = { x: -22.4, z: -1.0, standX: -21.25, standZ: -1.0, yaw: -Math.PI / 2 };

// 地上的方形纸灯
export const GROUND_LAMPS: [number, number][] = [
  [-5.8, 2.6], [5.8, 2.6], [-12, 2.6], [12, 2.6], [-3.4, 10.5], [3.4, 10.5],
  [-2.9, 44.6], [2.9, 44.6], [-2.9, 59.6], [2.9, 59.6], [3.8, 65], [-3.8, 65],
];

type Circle = { x: number; z: number; r: number };
type Box = { x0: number; x1: number; z0: number; z1: number };

const circles: Circle[] = [];
const boxes: Box[] = [];

for (const [x, z, s] of MAPLES) circles.push({ x, z, r: 0.45 * s });
// 围炉的茶几
boxes.push({ x0: TEA.x - TEA.half, x1: TEA.x + TEA.half, z0: TEA.z - TEA.half, z1: TEA.z + TEA.half });
for (const [x, z, s] of PINES) circles.push({ x, z, r: 0.5 * s });
for (const [x, z, s] of ROCKS) circles.push({ x, z, r: 0.9 * s });
for (const sx of [-1, 1]) for (const z of [11, 22, 33, 43.5]) circles.push({ x: sx * 2.75, z, r: 0.28 });
for (const [x, z] of GROUND_LAMPS) circles.push({ x, z, r: 0.25 });
for (const b of NPC_BENCHES) for (const off of [-0.6, 0.6]) circles.push({ ...benchSeat(b, off), r: 0.42 });
for (const [x, z] of SIDE_LAMPS) circles.push({ x, z, r: 0.38 });
boxes.push({ x0: LANTERN_STAND.x - 0.5, x1: LANTERN_STAND.x + 0.5, z0: LANTERN_STAND.z - 0.33, z1: LANTERN_STAND.z + 0.33 });
boxes.push({ x0: FORTUNE.x - 0.38, x1: FORTUNE.x + 0.38, z0: FORTUNE.z - 0.38, z1: FORTUNE.z + 0.38 });
circles.push({ x: INCENSE.x, z: INCENSE.z, r: INCENSE.r });
// 咖啡馆：后墙、两山墙、吧台和吧台里面进不去；柱子、桌子、竹盆、竹竿、菜单牌、回收桶
{
  const box = (lx0: number, lz0: number, lx1: number, lz1: number) => {
    const a = cafeWorld(lx0, lz0), b = cafeWorld(lx1, lz1);
    boxes.push({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) });
  };
  box(-CAFE.hw, -CAFE.hd, CAFE.hw, CAFE.bar); // 后墙到吧台前沿
  box(-CAFE.hw, -CAFE.hd, -CAFE.hw + 0.3, 2.6); // 左山墙
  box(CAFE.hw - 0.3, -CAFE.hd, CAFE.hw, 2.6); // 右山墙
  for (const [lx, lz] of CAFE_COLS) circles.push({ ...cafeWorld(lx, lz), r: 0.17 });
  for (const tb of CAFE_TABLES) circles.push({ ...tb, r: 0.5 });
  for (const sx of [-1, 1]) circles.push({ ...cafeWorld(sx * 5.0, 3.75), r: 0.32 });
  circles.push({ ...CAFE_FLAG, r: 0.16 }, { ...CAFE_MENU, r: 0.42 }, { ...CAFE_BIN, r: 0.44 });
  box(DISCO.boothX0, DISCO.boothZ0, DISCO.boothX1, DISCO.boothZ1);
  for (const sx of [-1, 1]) circles.push({ ...cafeWorld(sx * DISCO.poleX, DISCO.poleZ), r: 0.12 });
}
// 灯廊的木杆、祈福台、柿饼架
for (const x of [WISH_ALLEY.xE, WISH_ALLEY.xW]) for (const z of WISH_ALLEY.zs) circles.push({ x, z, r: 0.16 });
boxes.push({ x0: WISH_DESK.x - 0.36, x1: WISH_DESK.x + 0.36, z0: WISH_DESK.z - 0.8, z1: WISH_DESK.z + 0.8 });
boxes.push({ x0: PERSIMMON.x - PERSIMMON.len / 2 - 0.15, x1: PERSIMMON.x + PERSIMMON.len / 2 + 0.15, z0: PERSIMMON.z - 0.45, z1: PERSIMMON.z + 0.45 });
// 石拱桥两头的抱鼓石
for (const x of [BRIDGE.x0 + 0.1, BRIDGE.x1 - 0.1]) for (const z of [BRIDGE.z0 - 0.42, BRIDGE.z1 + 0.42]) circles.push({ x, z, r: 0.38 });
// 山门两扇大门往院里开着（门扇近似成一个窄长方形）
for (const s of [-1, 1]) {
  const hx = s * (COURT.gateX - 0.12);
  const tipX = hx - s * Math.cos(1.25) * (COURT.gateX - 0.2), tipZ = COURT.z1 - 0.12 - Math.sin(1.25) * (COURT.gateX - 0.2);
  boxes.push({ x0: Math.min(hx, tipX) - 0.1, x1: Math.max(hx, tipX) + 0.1, z0: tipZ, z1: COURT.z1 });
}
// 山门台基伸进院里那块的两侧边和垂带：只能从正中的踏步上去
for (const s of [-1, 1]) boxes.push({ x0: Math.min(s * GATE.stepHX, s * GATE.hx), x1: Math.max(s * GATE.stepHX, s * GATE.hx), z0: GATE.z0 - GATE.run, z1: COURT.z1 });
for (const p of PAGODAS) {
  circles.push({ x: p.x, z: p.z, r: 1.65 * p.s });
  // 塔门前的三级石阶（朝中轴线），两个碰撞圆盖住台阶宽度
  const dir = p.x < 0 ? 1 : -1;
  for (const dz of [-0.5, 0.5]) circles.push({ x: p.x + dir * 2.37 * 0.75 * p.s, z: p.z + dz, r: 0.55 });
}
// 香炉两旁的烛台架
for (const sx of [-1, 1]) boxes.push({ x0: INCENSE.x + sx * 2.6 - 0.85, x1: INCENSE.x + sx * 2.6 + 0.85, z0: INCENSE.z - 0.7, z1: INCENSE.z - 0.1 });
for (const x of HALL.colX) circles.push({ x, z: HALL.colZFront, r: 0.4 });
// 钟楼：四根柱子和中间的钟
for (const T of [BELL]) {
  const h = T.size / 2 - 0.4;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) circles.push({ x: T.x + sx * h, z: T.z + sz * h, r: 0.38 });
  circles.push({ x: T.x, z: T.z, r: 1.35 });
}
// 正面格扇门：中间三间开着，两侧各两间关着
boxes.push({ x0: -HALL.wallX - 0.2, x1: HALL.colX[2] + 0.2, z0: HALL.colZFront - 0.18, z1: HALL.colZFront + 0.18 });
boxes.push({ x0: HALL.colX[5] - 0.2, x1: HALL.wallX + 0.2, z0: HALL.colZFront - 0.18, z1: HALL.colZFront + 0.18 });
// 大殿侧墙、后墙、佛坛、供桌
boxes.push({ x0: -HALL.wallX - 0.25, x1: -HALL.wallX + 0.2, z0: HALL.backZ - 0.2, z1: HALL.colZFront - 0.45 });
boxes.push({ x0: HALL.wallX - 0.2, x1: HALL.wallX + 0.25, z0: HALL.backZ - 0.2, z1: HALL.colZFront - 0.45 });
boxes.push({ x0: -HALL.wallX, x1: HALL.wallX, z0: HALL.backZ - 0.3, z1: HALL.backZ + 0.25 });
boxes.push({ x0: HALL.altarX0 - 0.15, x1: HALL.altarX1 + 0.15, z0: HALL.altarZ0, z1: HALL.altarZ1 + 0.2 });
boxes.push({ x0: HALL.tableX0, x1: HALL.tableX1, z0: HALL.tableZ0, z1: HALL.tableZ1 });
// 配殿：没解锁时整座不可进入；解锁后只挡墙、柱子、佛坛和灯架，台阶和殿内可以走
export const sideHallOpen = [false, false, false];
// 配殿的本地坐标：x 沿面阔，z 朝殿门为正；尺寸和 buildings.ts 的 sideHall 一致
export function hallLocal(i: number, x: number, z: number) {
  const s = HALLS[i];
  const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return { lx: dx * c - dz * n, lz: dx * n + dz * c };
}
export function hallWorld(i: number, lx: number, lz: number) {
  const s = HALLS[i];
  const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return { x: s.x + lx * c + lz * n, z: s.z - lx * n + lz * c };
}
export const SH = (i: number) => {
  const s = HALLS[i];
  const L = s.d, D = s.w;
  return { L, D, base: 0.6, hx: L / 2 - 0.4, hz: D / 2 - 0.4, px: L / 2 + 0.8, pz: D / 2 + 0.8 };
};
export function setSideHallOpen(i: number, open: boolean) {
  if (sideHallOpen[i] === open) return;
  sideHallOpen[i] = open;
  walk = null; // 寻路网格重算
}
function sideHallBlocked(i: number, x: number, z: number) {
  const { lx, lz } = hallLocal(i, x, z);
  const d = SH(i);
  if (Math.abs(lx) > d.px + 0.6 + R || Math.abs(lz) > d.pz + 0.6 + R) return false;
  if (!sideHallOpen[i]) return Math.abs(lx) < d.px + R && Math.abs(lz) < d.pz + R;
  const t = 0.15 + R;
  if (Math.abs(lz + d.hz) < t && Math.abs(lx) < d.hx + t) return true; // 后墙
  if (Math.abs(Math.abs(lx) - d.hx) < t && Math.abs(lz) < d.hz + t) return true; // 两侧墙
  if (Math.abs(lz - d.hz) < 0.08 + R && Math.abs(lx) < d.hx + t) {
    // 正面格扇门：只有正中两间开着
    const bay = d.hx / 2;
    const gap = Math.abs(lx) > 0.3 + R && Math.abs(lx) < bay - 0.3 - R;
    if (!gap) return true;
  }
  for (const cx of [-d.hx, -d.hx / 2, 0, d.hx / 2, d.hx])
    for (const cz of [-d.hz, d.hz]) if ((lx - cx) ** 2 + (lz - cz) ** 2 < (0.27 + R) ** 2) return true;
  if (i === 2) {
    // 藏经阁：后墙一排经橱、两侧墙后半段的经橱、三张经案
    if (lz < -d.hz + 0.95 + R) return true;
    if (Math.abs(lx) > d.hx - 0.85 - R && lz < 0.6 + R) return true;
    for (const dx of LIB_DESKS) if (Math.abs(lx - dx) < 0.78 + R && Math.abs(lz - LIB_DESK_Z) < 0.32 + R) return true;
    return false;
  }
  if (Math.abs(lx) < 2.4 + R && lz < -d.hz + 2.55 + R) return true; // 佛坛与供桌
  if (i === 1 && lx > -6.7 - R && lx < -3.5 + R && lz < -d.hz + 1.7 + R) return true; // 长明灯架
  return false;
}
// 配殿台基与台阶的高度（只在开放时可走上去）
function sideHallHeight(x: number, z: number) {
  for (let i = 0; i < HALLS.length; i++) {
    if (!sideHallOpen[i]) continue;
    const { lx, lz } = hallLocal(i, x, z);
    const d = SH(i);
    if (Math.abs(lx) <= d.px && Math.abs(lz) <= d.pz) return d.base;
    if (Math.abs(lx) < 1.6 && lz > d.pz && lz < d.pz + 1.2) return d.base * (1 - (lz - d.pz) / 1.2);
  }
  return -1;
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
  for (const T of [BELL]) {
    const b = T.size / 2 + 0.6;
    if (Math.abs(x - T.x) < b && Math.abs(z - T.z) < b) return T.platform;
  }
  // 山门台基和往院里下的踏步
  if (Math.abs(x) < GATE.hx && z > GATE.z0 && z < COURT.z1 + 1.2) return GATE.base;
  if (Math.abs(x) < GATE.stepHX && z > GATE.z0 - GATE.run && z <= GATE.z0) return (GATE.base * (z - GATE.z0 + GATE.run)) / GATE.run;
  // 石拱桥
  if (x > BRIDGE.x0 && x < BRIDGE.x1 && z > BRIDGE.z0 && z < BRIDGE.z1) return BRIDGE.h * Math.sin(((z - BRIDGE.z0) / (BRIDGE.z1 - BRIDGE.z0)) * Math.PI);
  const sh = sideHallHeight(x, z);
  if (sh >= 0) return sh;
  // 咖啡馆的厅和露台；吧台里面（只有咖啡师父站得进去）再高一级
  {
    const { lx, lz } = cafeLocal(x, z);
    if (Math.abs(lx) < CAFE.hw && lz > -CAFE.hd && lz < CAFE.deck) return CAFE.base + (lz < CAFE.bar - 0.6 && Math.abs(lx) < 4.0 ? CAFE.inner : 0);
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
  const onBridge = x > BRIDGE.x0 + 0.25 && x < BRIDGE.x1 - 0.25 && z > BRIDGE.z0 && z < BRIDGE.z1;
  if (!onBridge && inPond(x, z, 0.35)) return true;
  // 桥两侧的栏杆
  if (z > BRIDGE.z0 && z < BRIDGE.z1 && ((x > BRIDGE.x0 - 0.3 && x < BRIDGE.x0 + 0.25) || (x > BRIDGE.x1 - 0.25 && x < BRIDGE.x1 + 0.3))) return true;
  for (const c of circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = c.r + R;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  for (const b of boxes) {
    if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R) return true;
  }
  for (let i = 0; i < HALLS.length; i++) if (sideHallBlocked(i, x, z)) return true;
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

// 两点之间能不能直线走过去：中线和左右各偏 0.15 米的两条线都要走得通，
// 这样到达路径点时有十几厘米的偏差也不会擦着台阶边角卡住
export function lineClear(ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az);
  if (d < 1e-6) return true;
  const nx = (-(bz - az) / d) * 0.15, nz = ((bx - ax) / d) * 0.15;
  return lineCore(ax, az, bx, bz) && lineCore(ax + nx, az + nz, bx + nx, bz + nz) && lineCore(ax - nx, az - nz, bx - nx, bz - nz);
}

function lineCore(ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / 0.08));
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
