// 常住僧人与时刻表。所有动作都由「服务器时间」推算，同一房间的人看到的是同一场：
//   每小时 0 分：钟头撞钟三下 → 大众从两侧配殿走进大雄宝殿 → 1–5 分大殿共修（礼拜、木鱼、引磬、诵经）→ 散去
//   每小时 30 分：鼓头击鼓九下
// 平时各忙各的（也按服务器时间循环）：
//   扫地僧扫完一圈到银杏下石凳歇脚喝茶；知客僧迎客、收拾河灯台；
//   小沙弥甲提壶到池边打水，挨棵给树浇水；小沙弥乙从观音殿端茶给银杏下打坐的老和尚，
//   听老和尚讲几句，再去池边喂鱼、到石凳上读经；香灯师上香、擦香炉；维那巡殿；
//   钟头、鼓头扫楼、擦鼓；两位僧人拨着念珠绕塔。
import * as THREE from 'three';
import { Monk, GAITS, type Action, BOW_DURATION } from './monk';
import { planRoute, heightAt, SIDE_HALLS, SPAWN, HALL, ALTAR_SPOT, INCENSE, PAGODAS, LANTERN_STAND, NPC_BENCHES, benchSeat } from './layout';
import type { StrikeBuild } from './world/buildings';

export type Role = 'sweeper' | 'greeter' | 'elder' | 'xiangdeng' | 'weina' | 'bell' | 'drum' | 'walker' | 'novice' | 'assembly';
// 头顶写着的「在做什么」，对应 i18n 里的 act_*
export type Activity =
  | 'sweep' | 'rest' | 'read' | 'water' | 'fill' | 'bring' | 'serve' | 'tea' | 'teach' | 'listen' | 'incense'
  | 'wipe' | 'tidy' | 'patrol' | 'greet' | 'feed' | 'circle' | 'meditate' | 'stroll';

// 一小时里的时刻（秒）
export const SVC = { bell: [3, 11, 19], gather: 25, chant: 62, end: 300, gone: 348, drum: 1800 };
const DRUM_BEATS = 9;

type P = { x: number; z: number };

// —— 日常：一串「走到某处」「在原地做某事若干秒」的步骤，首尾都在岗位上，循环进行 ——
type Step =
  | { to: P; v?: number; gait?: Action; direct?: boolean; label?: Activity }
  | { stay: number; act: Action; yaw?: number; label?: Activity; say?: string; mark?: string };
interface Seg {
  t0: number;
  t1: number;
  path?: ReturnType<typeof polyline>;
  v: number;
  p: P;
  yaw: number;
  act: Action;
  label?: Activity;
  say?: string;
}
export interface RoutinePose {
  x: number;
  z: number;
  yaw: number;
  act: Action;
  v: number;
  seg: number;
  label?: Activity;
  say?: string;
}
type Program = { period: number; marks: Record<string, number>; at(t: number): RoutinePose };

function polyline(pts: P[]) {
  const segs: { a: P; b: P; l: number }[] = [];
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    segs.push({ a: pts[i - 1], b: pts[i], l });
    len += l;
  }
  return {
    len,
    at(d: number) {
      let r = Math.max(0, Math.min(len, d));
      for (const s of segs) {
        if (r <= s.l) {
          const k = s.l ? r / s.l : 0;
          return { x: s.a.x + (s.b.x - s.a.x) * k, z: s.a.z + (s.b.z - s.a.z) * k, yaw: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z) };
        }
        r -= s.l;
      }
      const s = segs[segs.length - 1];
      return { x: s.b.x, z: s.b.z, yaw: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z) };
    },
  };
}
const route = (pts: P[]) => {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) out.push(...planRoute(out[out.length - 1].x, out[out.length - 1].z, pts[i].x, pts[i].z));
  return out;
};

function program(start: P & { yaw: number }, steps: Step[]): Program {
  const segs: Seg[] = [];
  const marks: Record<string, number> = {};
  let t = 0;
  let cur: P = start;
  let yaw = start.yaw;
  for (const st of steps) {
    if ('to' in st) {
      const pts = st.direct ? [cur, st.to] : [cur, ...planRoute(cur.x, cur.z, st.to.x, st.to.z)];
      const path = polyline(pts.length > 1 ? pts : [cur, st.to]);
      const v = st.v ?? 0.8;
      const d = path.len / v;
      segs.push({ t0: t, t1: t + d, path, v, p: cur, yaw, act: st.gait ?? 'walk', label: st.label });
      t += d;
      cur = pts[pts.length - 1];
      if (path.len > 0.01) yaw = path.at(path.len).yaw;
    } else {
      if (st.yaw !== undefined) yaw = st.yaw;
      if (st.mark) marks[st.mark] = t;
      segs.push({ t0: t, t1: t + st.stay, v: 0, p: cur, yaw, act: st.act, label: st.label, say: st.say });
      t += st.stay;
    }
  }
  return {
    period: t,
    marks,
    at(tt: number): RoutinePose {
      let i = segs.findIndex((g) => tt < g.t1);
      if (i < 0) i = segs.length - 1;
      const s = segs[i];
      if (s.path) {
        const q = s.path.at((tt - s.t0) * s.v);
        return { x: q.x, z: q.z, yaw: q.yaw, act: s.act, v: s.v, seg: i, label: s.label };
      }
      return { x: s.p.x, z: s.p.z, yaw: s.yaw, act: s.act, v: 0, seg: i, label: s.label, say: s.say };
    },
  };
}
const via = (pts: P[], v: number, gait?: Action, label?: Activity): Step[] => pts.map((p) => ({ to: p, v, gait, label }));
// 到石凳上坐下 / 起身：先走到凳子前，再直走两步坐上去
const sitOn = (seat: ReturnType<typeof benchSeat>, v = 0.8): Step[] => [{ to: { x: seat.ax, z: seat.az }, v }, { to: seat, v: 0.5, direct: true }];
const standUp = (seat: ReturnType<typeof benchSeat>): Step => ({ to: { x: seat.ax, z: seat.az }, v: 0.5, direct: true });

interface Resident {
  id: number;
  role: Role;
  monk: Monk;
  post: P & { yaw: number; action: Action };
  prog?: Program;
  windows?: [number, number][]; // 日常只在一小时里的这些时段进行，其余时间守在岗位上
  offset?: number;
  lift?: number; // 坐在蒲团上时抬高
  seg: number;
  label?: Activity;
  route?: P[]; // 大众：从配殿门口到大殿的路线
  spot?: P;
  lastStrike: number; // 上次木鱼、钟、鼓的时刻（避免一秒里重复）
}

export interface ResidentsOpts {
  bell: StrikeBuild;
  drum: StrikeBuild;
  onBell(): void; // 钟头撞了一下（调用方放钟声）
  onDrum(): void;
  onQing(): void; // 维那敲引磬
  onFeed(x: number, z: number): void; // 僧人往池里撒了一把鱼食
}

export function buildResidents(scene: THREE.Scene, o: ResidentsOpts) {
  const list: Resident[] = [];
  const add = (role: Role, style: 'resident' | 'elder' | 'novice', post: Resident['post']) => {
    const monk = new Monk(style);
    monk.root.position.set(post.x, heightAt(post.x, post.z), post.z);
    monk.root.rotation.y = post.yaw;
    monk.setAction(post.action);
    const id = list.length;
    monk.root.traverse((m) => (m.userData.interact = { type: 'npc', role, id }));
    scene.add(monk.root);
    const r: Resident = { id, role, monk, post, lastStrike: -1, seg: -1 };
    // 喂鱼时撒向面前一米半的水面
    monk.onFeedToss = () => {
      const p = monk.root.position, a = monk.root.rotation.y;
      o.onFeed(p.x + Math.sin(a) * 1.6, p.z + Math.cos(a) * 1.6);
    };
    list.push(r);
    return r;
  };
  const at = (r: Resident) => ({ x: r.post.x, z: r.post.z, yaw: r.post.yaw });

  // 殿内：香灯师守木鱼，维那守引磬（都在佛前供桌两侧，面朝佛像）
  const fy = HALL.baseH;
  const xiangdeng = add('xiangdeng', 'resident', { x: -3.95, z: -16.55, yaw: Math.PI, action: 'idle' });
  const weina = add('weina', 'resident', { x: 3.95, z: -16.55, yaw: Math.PI, action: 'idle' });
  // 钟头、鼓头站在钟鼓旁
  const bellMonk = add('bell', 'resident', { x: o.bell.standX - 0.9, z: o.bell.standZ + 0.6, yaw: Math.PI / 2, action: 'idle' });
  const drumMonk = add('drum', 'resident', { x: o.drum.standX + 0.9, z: o.drum.standZ + 0.6, yaw: -Math.PI / 2, action: 'idle' });
  // 知客僧：站在新来的人进寺的地方旁边
  const greeter = add('greeter', 'resident', { x: SPAWN.x + 3.2, z: SPAWN.z - 1.0, yaw: -Math.PI / 2, action: 'idle' });
  // 老和尚：银杏树下打坐（垫一个蒲团）
  const elderPos = { x: -7.6, z: 29.6 };
  const elder = add('elder', 'elder', { ...elderPos, yaw: Math.PI * 0.75, action: 'sit' });
  elder.monk.seatKind = 'floor';
  elder.lift = 0.12;
  {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 24), new THREE.MeshStandardMaterial({ color: '#c8952f', roughness: 0.9 }));
    pad.position.set(elderPos.x, heightAt(elderPos.x, elderPos.z) + 0.07, elderPos.z + 0.3);
    pad.receiveShadow = true;
    scene.add(pad);
  }
  const sweeper = add('sweeper', 'resident', { x: -6.5, z: 14, yaw: 0, action: 'sweep' });
  const bench = NPC_BENCHES[0];
  const seatA = benchSeat(bench, -0.55), seatB = benchSeat(bench, 0.55);

  // —— 香灯师：佛前上香 → 出殿给院中大香炉上香、把香炉擦一遍 → 理一理两边烛台 → 回殿 ——
  xiangdeng.prog = program(at(xiangdeng), [
    { stay: 120, act: 'idle' },
    { to: ALTAR_SPOT, v: 0.7, label: 'incense' },
    { stay: 8, act: 'incense', yaw: Math.PI, label: 'incense' },
    { to: { x: INCENSE.x, z: INCENSE.z + 2.3 }, v: 0.85, label: 'incense' },
    { stay: 8, act: 'incense', yaw: Math.PI, label: 'incense' },
    { to: { x: INCENSE.x + 1.2, z: INCENSE.z + 1.9 }, v: 0.6, direct: true, label: 'wipe' },
    { stay: 12, act: 'wipe', yaw: Math.PI * 0.85, label: 'wipe', say: 'sayWipe' },
    { to: { x: INCENSE.x + 2.6, z: INCENSE.z + 1.4 }, v: 0.6, label: 'tidy' },
    { stay: 6, act: 'wipe', yaw: Math.PI, label: 'tidy' },
    { to: { x: INCENSE.x - 2.6, z: INCENSE.z + 1.4 }, v: 0.6, label: 'tidy' },
    { stay: 6, act: 'wipe', yaw: Math.PI, label: 'tidy' },
    { to: xiangdeng.post, v: 0.85 },
    { stay: 2, act: 'idle', yaw: Math.PI },
  ]);
  xiangdeng.windows = [[SVC.gone + 20, 3600 - 50]];

  // —— 维那：沿殿里东侧走到殿门口，站一会儿看看院子，再从西侧绕回来 ——
  weina.prog = program(at(weina), [
    { stay: 100, act: 'idle' },
    ...via([{ x: 9.5, z: -13 }, { x: 9.5, z: -6.5 }, { x: 2.2, z: -3.2 }], 0.6, 'walk', 'patrol'),
    { stay: 4, act: 'hapjang', yaw: 0, label: 'patrol' },
    { stay: 18, act: 'idle', yaw: 0, label: 'patrol' },
    ...via([{ x: -9.5, z: -6.5 }, { x: -9.5, z: -13 }, weina.post], 0.6, 'walk', 'patrol'),
    { stay: 2, act: 'idle', yaw: Math.PI },
  ]);
  weina.windows = [[SVC.gone + 50, 3600 - 60]];

  // —— 钟头、鼓头：在楼上转一圈扫两处地；鼓头再把鼓擦一擦 ——
  const towerRound = (r: Resident, cx: number, cz: number, sx: number, drum: boolean) =>
    program(at(r), [
      { stay: 50, act: 'idle' },
      { to: { x: cx, z: cz + 3.0 }, v: 0.6, label: 'sweep' },
      { stay: 12, act: 'sweep', yaw: (-sx * Math.PI) / 2, label: 'sweep' },
      { to: { x: cx - sx * 3.0, z: cz }, v: 0.6, label: 'sweep' },
      { stay: 12, act: 'sweep', yaw: Math.PI, label: 'sweep' },
      ...(drum ? ([{ to: { x: cx, z: cz + 1.8 }, v: 0.5, label: 'wipe' }, { stay: 14, act: 'wipe', yaw: Math.PI, label: 'wipe' }] as Step[]) : []),
      { to: { x: cx, z: cz - 3.0 }, v: 0.6 },
      { stay: 8, act: 'idle', yaw: Math.PI },
      { to: r.post, v: 0.6 },
      { stay: 2, act: 'idle', yaw: r.post.yaw },
    ]);
  bellMonk.prog = towerRound(bellMonk, o.bell.standX + 2.6, o.bell.standZ - 1.0, -1, false);
  bellMonk.windows = [[40, 3600 - 40]];
  drumMonk.prog = towerRound(drumMonk, o.drum.standX - 1.9, o.drum.standZ - 0.3, 1, true);
  drumMonk.windows = [[40, SVC.drum - 30], [SVC.drum + 40, 3600 - 20]];

  // —— 知客僧：在入口站一阵 → 到桥头朝山门合十 → 去河灯台把灯摆整齐 → 回来 ——
  const lanternYaw = Math.atan2(LANTERN_STAND.x - LANTERN_STAND.standX, LANTERN_STAND.z - LANTERN_STAND.standZ);
  greeter.prog = program(at(greeter), [
    { stay: 70, act: 'idle', label: 'greet' },
    { to: { x: SPAWN.x + 3.6, z: SPAWN.z + 5.6 }, v: 0.7, label: 'greet' },
    { stay: 3, act: 'hapjang', yaw: 0, label: 'greet' },
    { stay: 10, act: 'idle', yaw: 0, label: 'greet' },
    { to: { x: LANTERN_STAND.standX, z: LANTERN_STAND.standZ }, v: 0.7, label: 'tidy' },
    { stay: 12, act: 'wipe', yaw: lanternYaw, label: 'tidy', say: 'sayTidy' },
    { to: greeter.post, v: 0.7 },
    { stay: 1, act: 'idle', yaw: greeter.post.yaw, label: 'greet' },
  ]);

  // —— 小沙弥乙：观音殿端茶 → 奉给老和尚 → 坐下听讲 → 池边喂鱼 → 石凳读经 → 回观音殿 ——
  const westHall = SIDE_HALLS[0];
  const door = { x: westHall.x + 6.6, z: westHall.z, yaw: Math.PI / 2 };
  const ey = elder.post.yaw;
  const serveAt = { x: elderPos.x + Math.sin(ey) * 1.05, z: elderPos.z + Math.cos(ey) * 1.05 };
  const faceElder = ey + Math.PI;
  const feedSpot = { x: -4.2, z: 46.0 };
  const noviceB = add('novice', 'novice', { ...door, action: 'idle' });
  const noviceProg = program(door, [
    { stay: 25, act: 'idle' },
    { to: serveAt, v: 0.7, gait: 'tray', label: 'bring' },
    { stay: 4, act: 'serve', yaw: faceElder, label: 'serve', say: 'sayServe', mark: 'serve' },
    { stay: 64, act: 'sit', yaw: faceElder, label: 'listen' },
    { stay: 3, act: 'hapjang', yaw: faceElder, label: 'listen' },
    { to: feedSpot, v: 0.8 },
    { stay: 2.2, act: 'feed', yaw: 0, label: 'feed', say: 'sayFeed' },
    { stay: 2.2, act: 'feed', yaw: 0, label: 'feed' },
    { stay: 2.2, act: 'feed', yaw: 0, label: 'feed' },
    { stay: 8, act: 'idle', yaw: 0, label: 'feed' },
    ...sitOn(seatA),
    { stay: 50, act: 'read', yaw: bench.yaw, label: 'read', say: 'sayRead' },
    { stay: 50, act: 'read', yaw: bench.yaw, label: 'read', say: 'sayRead' },
    standUp(seatA),
    { to: door, v: 0.8 },
    { stay: 2, act: 'idle', yaw: door.yaw },
  ]);
  noviceB.prog = noviceProg;

  // —— 老和尚：和小沙弥乙同一个周期。打坐 → 接茶喝 → 讲几句 → 再坐一会儿 → 起身绕银杏散步 → 合十坐下 ——
  {
    const T = noviceProg.marks.serve + 2;
    const loopPts = [
      { x: elderPos.x - 1.8, z: elderPos.z + 1.6 }, { x: elderPos.x + 1.8, z: elderPos.z + 2.0 },
      { x: elderPos.x + 2.0, z: elderPos.z - 1.6 }, { x: elderPos.x - 1.6, z: elderPos.z - 1.8 }, elderPos,
    ];
    const head: Step[] = [
      { stay: T, act: 'sit', label: 'meditate' },
      { stay: 20, act: 'tea', label: 'tea' },
      { stay: 15, act: 'teach', label: 'teach', say: 'sayTeach' },
      { stay: 15, act: 'teach', label: 'teach', say: 'sayTeach' },
      { stay: 15, act: 'teach', label: 'teach', say: 'sayTeach' },
      { stay: 15, act: 'sit', label: 'meditate' },
      ...via(loopPts, 0.4, 'walk', 'stroll'),
      { stay: 3, act: 'hapjang', yaw: elder.post.yaw, label: 'stroll' },
    ];
    const used = program(at(elder), head).period;
    elder.prog = program(at(elder), [...head, { stay: Math.max(1, noviceProg.period - used), act: 'sit', yaw: elder.post.yaw, label: 'meditate' }]);
  }

  // —— 小沙弥甲：池边打水 → 提壶挨棵浇树（东边两棵、再回来打水、西边两棵）→ 站在池边歇一会儿 ——
  const fillE = { x: 4.6, z: 46.0 };
  const trees: { p: P; yaw: number }[] = [
    { p: { x: 9, z: 32.2 }, yaw: Math.PI },
    { p: { x: 17.0, z: 42.8 }, yaw: Math.atan2(1, -0.8) },
    { p: { x: -9.4, z: 32.2 }, yaw: Math.atan2(0.4, -1.2) },
    { p: { x: -17.0, z: 42.8 }, yaw: Math.atan2(-1, -0.8) },
  ];
  const noviceA = add('novice', 'novice', { ...fillE, yaw: 0, action: 'idle' });
  const water = (k: number): Step[] => [
    { to: trees[k].p, v: 0.55, gait: 'canwalk', label: 'water' },
    { stay: 10, act: 'water', yaw: trees[k].yaw, label: 'water', say: k % 2 ? undefined : 'sayWater' },
  ];
  noviceA.prog = program({ ...fillE, yaw: 0 }, [
    { stay: 6, act: 'fill', yaw: 0, label: 'fill', say: 'sayFill' },
    ...water(0),
    ...water(1),
    { to: fillE, v: 0.55, gait: 'canwalk', label: 'fill' },
    { stay: 6, act: 'fill', yaw: 0, label: 'fill' },
    ...water(2),
    ...water(3),
    { to: fillE, v: 0.6, gait: 'canwalk' },
    { stay: 20, act: 'idle', yaw: 0 },
  ]);
  noviceA.offset = 37;

  // —— 扫地僧：沿前院一圈，每到一处停下扫一会儿；扫完一圈到银杏下石凳歇脚喝茶 ——
  const sweepStops: P[] = [
    { x: -6.5, z: 14 }, { x: -12, z: 22 }, { x: -14, z: 34 }, { x: -6, z: 40 }, { x: 6.5, z: 40 },
    { x: 14, z: 33 }, { x: 12.5, z: 22 }, { x: 7, z: 13 }, { x: 0.5, z: 4.5 },
  ];
  sweeper.prog = program(at(sweeper), [
    ...sweepStops.slice(1).flatMap((p, i): Step[] => [
      { to: p, v: 0.75, label: 'sweep' },
      { stay: 9, act: 'sweep', label: 'sweep', say: i === 3 ? 'npcSweeper' : undefined },
    ]),
    ...sitOn(seatB, 0.75),
    { stay: 45, act: 'tea', yaw: bench.yaw, label: 'rest', say: 'sayRest' },
    standUp(seatB),
    { to: sweepStops[0], v: 0.75, label: 'sweep' },
    { stay: 9, act: 'sweep', label: 'sweep' },
  ]);

  // —— 绕塔：两位僧人拨着念珠各绕一座塔，塔始终在右手边，每绕一圈在塔前合十 ——
  for (const [i, pg] of PAGODAS.entries()) {
    const R = 3.3;
    const pts: P[] = [];
    for (let k = 1; k <= 16; k++) {
      const a = Math.PI / 2 + (k / 16) * Math.PI * 2;
      pts.push({ x: pg.x + Math.cos(a) * R, z: pg.z + Math.sin(a) * R });
    }
    const start = { x: pg.x, z: pg.z + R, yaw: Math.PI };
    const r = add('walker', 'resident', { ...start, action: 'idle' });
    r.prog = program(start, [{ stay: 4, act: 'hapjang', yaw: Math.PI, label: 'circle', say: 'sayCircle' }, ...via(pts, 0.45, 'beadwalk', 'circle')]);
    r.offset = i * 23;
  }

  // —— 大众：四位，两位从观音殿、两位从地藏殿走来，在供桌两侧跪拜 ——
  const spots: P[] = [{ x: -6.3, z: -16.9 }, { x: -5.0, z: -16.9 }, { x: 5.0, z: -16.9 }, { x: 6.3, z: -16.9 }];
  const assembly: Resident[] = spots.map((spot, i) => {
    const H = SIDE_HALLS[i < 2 ? 0 : 1];
    const sx = H.x < 0 ? 1 : -1;
    const dr = { x: H.x + sx * 5.2, z: H.z + (i % 2 ? 1.2 : -1.2) };
    const out = { x: H.x + sx * 6.6, z: dr.z };
    const pts = route([out, spot]);
    pts.unshift(dr);
    const r = add('assembly', 'resident', { x: dr.x, z: dr.z, yaw: 0, action: 'walk' });
    r.route = pts;
    r.spot = spot;
    r.monk.root.visible = false;
    return r;
  });
  const assemblyPaths = assembly.map((r) => polyline(r.route!));

  const tmp = new THREE.Vector3();
  let greetAt = -999;
  let greetWall = 0;
  let greetYaw = 0;
  // 按日常算出此刻的位置和动作；不在日常时段里就是 null（守在岗位上）
  // 调试：?routine=秒 把不分时段的日常统一拨到第几秒（再随时间往前走）
  let debugT: number | null = null;
  function routine(r: Resident, nowS: number, hourS: number): RoutinePose | null {
    if (!r.prog) return null;
    const P = r.prog.period;
    if (!r.windows) return r.prog.at(((((debugT ?? nowS) + (r.offset ?? 0)) % P) + P) % P);
    for (const [w0, w1] of r.windows) {
      if (hourS < w0 || hourS >= w1) continue;
      const k = hourS - w0;
      const n = Math.floor((w1 - w0) / P);
      return k < n * P ? r.prog.at(k % P) : null;
    }
    return null;
  }
  const turn = (m: Monk, yaw: number, k: number) => {
    m.root.rotation.y += Math.atan2(Math.sin(yaw - m.root.rotation.y), Math.cos(yaw - m.root.rotation.y)) * Math.min(1, k);
  };
  const SEATED: Action[] = ['sit', 'tea', 'teach', 'read'];
  const LEFTOVER: Action[] = ['sweep', 'wipe', 'read', 'tea', 'teach', 'water', 'fill', 'serve', 'feed', 'incense'];

  return {
    interactives: list.filter((r) => r.role !== 'assembly').map((r) => r.monk.root),
    list,
    // 当前处在时刻表的哪一段（给界面用）
    phase(s: number): { kind: 'idle' | 'soon' | 'bell' | 'gather' | 'chant' | 'disperse'; toStart: number } {
      if (s < SVC.gather) return { kind: 'bell', toStart: SVC.chant - s };
      if (s < SVC.chant) return { kind: 'gather', toStart: SVC.chant - s };
      if (s < SVC.end) return { kind: 'chant', toStart: 0 };
      if (s < SVC.gone) return { kind: 'disperse', toStart: 3600 - s + SVC.chant };
      const to = 3600 - s + SVC.chant;
      return { kind: to < 4 * 60 ? 'soon' : 'idle', toStart: to };
    },
    // 知客僧：玩家走近时转身合十（一分钟内只迎一次）
    greet(px: number, pz: number, now: number) {
      const g = greeter.monk.root.position;
      if (greeter.monk.action !== 'idle') return false;
      if (Math.hypot(px - g.x, pz - g.z) < 4.2 && now - greetAt > 60) {
        greetAt = now;
        greetWall = Date.now() / 1000;
        greetYaw = Math.atan2(px - g.x, pz - g.z);
        greeter.monk.setAction('hapjang');
        return true;
      }
      return false;
    },
    // 返回这一帧刚开始新一段、且带一句话的僧人（调用方决定要不要冒气泡）
    setDebugTime(t: number) {
      debugT = t;
    },
    update(dt: number, nowMs: number, camPos: THREE.Vector3, player: P): { id: number; key: string }[] {
      const said: { id: number; key: string }[] = [];
      if (debugT !== null) debugT += dt;
      const hourS = (nowMs / 1000) % 3600;
      const hourN = Math.floor(nowMs / 3600000);
      const nowS = nowMs / 1000;
      for (const r of list) {
        const m = r.monk;
        if (r.role === 'assembly') continue;
        const pose = routine(r, nowS, hourS);
        if (pose) {
          // 在走日常：位置、动作都由时刻算出；站着没事时，有人走近就转过来看看
          const lift = SEATED.includes(pose.act) && r.lift ? r.lift : 0;
          m.root.position.set(pose.x, heightAt(pose.x, pose.z) + lift, pose.z);
          let yaw = pose.yaw;
          const near = Math.hypot(player.x - pose.x, player.z - pose.z);
          if (pose.act === 'idle' && near < 3.2 && near > 0.3) yaw = Math.atan2(player.x - pose.x, player.z - pose.z);
          if (r.role === 'greeter' && Date.now() / 1000 - greetWall < 9 && pose.act === 'idle') yaw = greetYaw;
          const walking = GAITS.includes(pose.act);
          turn(m, yaw, dt * (walking ? 6 : SEATED.includes(pose.act) ? 8 : 3));
          m.speed = pose.v;
          const keepGreet = r.role === 'greeter' && m.action === 'hapjang' && m.actionTime < 2.4 && pose.act === 'idle';
          if (pose.seg !== r.seg) {
            // 进入新的一段：同一个动作也从头做（连撒几把鱼食、换一处浇水）
            if (r.seg >= 0 && pose.say) said.push({ id: r.id, key: pose.say });
            r.seg = pose.seg;
            if (!keepGreet) m.setAction(pose.act, !walking);
          } else if (m.action !== pose.act && !keepGreet) m.setAction(pose.act);
          r.label = pose.label;
          m.update(dt);
          continue;
        }
        r.seg = -1;
        r.label = undefined;
        m.root.position.set(r.post.x, heightAt(r.post.x, r.post.z) + (r.post.action === 'sit' && r.lift ? r.lift : 0), r.post.z);
        let yaw = r.post.yaw;
        const near = Math.hypot(player.x - r.post.x, player.z - r.post.z);
        if (m.action === 'idle' && near < 3.2 && near > 0.3 && r.role !== 'xiangdeng' && r.role !== 'weina') yaw = Math.atan2(player.x - r.post.x, player.z - r.post.z);
        turn(m, yaw, dt * 3);
        if (GAITS.includes(m.action) || LEFTOVER.includes(m.action)) m.setAction(r.post.action);
        // 殿内两位：共修时一位敲木鱼、一位合十
        if (r.role === 'xiangdeng' || r.role === 'weina') {
          const chanting = hourS >= SVC.chant && hourS < SVC.end;
          const want: Action = chanting && r.role === 'xiangdeng' ? 'moktak' : 'idle';
          if (m.action !== want && m.action !== 'hapjang') m.setAction(want);
          if (chanting && r.role === 'xiangdeng') {
            const beat = Math.floor(hourS / 1.1);
            if (beat !== r.lastStrike) {
              r.lastStrike = beat;
              m.strike();
            }
          }
          if (r.role === 'weina') {
            const q = Math.floor((hourS - SVC.chant) / 24);
            const hit = (hourS >= SVC.chant && hourS < SVC.end && q !== r.lastStrike) || (hourS >= SVC.end && hourS < SVC.end + 1 && r.lastStrike !== 999);
            if (hit) {
              r.lastStrike = hourS >= SVC.end ? 999 : q;
              m.setAction('hapjang');
              o.onQing();
            }
            if (hourS < SVC.chant) r.lastStrike = -1;
          }
        }
        // 钟头：每小时开头撞三下；鼓头：半点击鼓九下
        if (r.role === 'bell') {
          const i = SVC.bell.findIndex((b) => hourS >= b && hourS < b + 1);
          const key = hourN * 10 + i;
          if (i >= 0 && r.lastStrike !== key) {
            r.lastStrike = key;
            m.setAction('hapjang');
            o.bell.strike();
            o.onBell();
          }
        }
        if (r.role === 'drum') {
          const k = Math.floor((hourS - SVC.drum) / 1.5);
          if (k >= 0 && k < DRUM_BEATS && r.lastStrike !== hourN * 100 + k) {
            r.lastStrike = hourN * 100 + k;
            if (k === 0) m.setAction('hapjang');
            o.drum.strike();
            o.onDrum();
          }
        }
        if (m.action === 'hapjang' && m.actionTime > 2.4) m.setAction(r.post.action);
        m.update(dt);
      }

      // 大众：按时刻表走进来、跪拜、走回去；不在场时隐藏
      assembly.forEach((r, i) => {
        const m = r.monk;
        const path = assemblyPaths[i];
        let visible = true;
        if (hourS >= SVC.gather && hourS < SVC.chant) {
          const speed = Math.max(1.1, path.len / (SVC.chant - SVC.gather - 4));
          const p = path.at((hourS - SVC.gather) * speed);
          m.root.position.set(p.x, heightAt(p.x, p.z), p.z);
          m.root.rotation.y = p.yaw;
          m.speed = speed;
          if (m.action !== 'walk') m.setAction('walk');
          if ((hourS - SVC.gather) * speed >= path.len) {
            m.root.rotation.y = Math.PI;
            if (m.action !== 'hapjang') m.setAction('hapjang');
          }
        } else if (hourS >= SVC.chant && hourS < SVC.end) {
          m.root.position.set(r.spot!.x, fy, r.spot!.z);
          m.root.rotation.y = Math.PI;
          if (m.action !== 'bow') {
            m.setAction('bow');
            // 大家一起拜：按时刻表对齐每一拜的起点
            m.actionTime = (hourS - SVC.chant) % BOW_DURATION;
          }
        } else if (hourS >= SVC.end && hourS < SVC.gone) {
          const speed = Math.max(1.1, path.len / (SVC.gone - SVC.end - 6));
          const d = path.len - (hourS - SVC.end - 2) * speed;
          if (hourS - SVC.end < 2) {
            m.root.position.set(r.spot!.x, fy, r.spot!.z);
            if (m.action !== 'hapjang') m.setAction('hapjang');
          } else {
            const p = path.at(d);
            m.root.position.set(p.x, heightAt(p.x, p.z), p.z);
            m.root.rotation.y = p.yaw + Math.PI;
            m.speed = speed;
            if (m.action !== 'walk') m.setAction('walk');
            if (d <= 0) visible = false;
          }
        } else visible = false;
        m.root.visible = visible && m.root.position.distanceTo(camPos) < 70;
        if (m.root.visible) m.update(dt);
      });

      // 远处的人不画（省手机）
      for (const r of list) {
        if (r.role === 'assembly') continue;
        tmp.copy(r.monk.root.position);
        r.monk.root.visible = tmp.distanceTo(camPos) < 70;
      }
      return said;
    },
  };
}
