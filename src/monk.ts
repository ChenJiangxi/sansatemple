// Q 版小和尚：几何体拼成，动作用关节旋转做程序动画
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';


export type Action = 'idle' | 'walk' | 'bow' | 'hapjang' | 'sit' | 'bench' | 'moktak' | 'rosary' | 'incense';

interface Pose {
  drop: number; // 胯部下沉
  legL: number; legR: number; // 腿前后摆（负数向前）
  legSpread: number; // 盘腿时两腿向内收的角度
  torso: number; // 上身前倾
  head: number; // 低头
  armLp: number; armRp: number; // 手臂前举
  armLy: number; armRy: number; // 手臂向内收
  armLr: number; armRr: number; // 手臂外展
  bob: number;
  sway: number; // 走路时下摆左右摆
  wrist: number; // 手腕弯曲（合十时让指尖朝上）
}

// 默认站姿：双手交叠放在腹前，宽袖垂在身前
const ZERO: Pose = { drop: 0, legL: 0, legR: 0, legSpread: 0, torso: 0, head: 0, armLp: -1.0, armRp: -1.0, armLy: -0.7, armRy: 0.7, armLr: 0, armRr: 0, bob: 0, sway: 0, wrist: -0.35 };

const HAP: Partial<Pose> = { armLp: -1.32, armRp: -1.32, armLy: -0.85, armRy: 0.85, wrist: -1.65 };

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const o = { ...a };
  for (const k in o) (o as any)[k] = (a as any)[k] + ((b as any)[k] - (a as any)[k]) * t;
  return o;
}

function mk(p: Partial<Pose>): Pose {
  return { ...ZERO, ...p };
}

const ease = (t: number) => t * t * (3 - 2 * t);

// 一次礼拜（站立合掌 → 跪下 → 伏地 → 起身）的时间轴，单位秒
export const BOW_DURATION = 5.6;
const HIP = 0.34;
const KNEEL_DROP = -(HIP - 0.1);
const BOW_KEYS: [number, Pose][] = [
  [0, mk({})],
  [0.5, mk({ ...HAP })],
  [1.0, mk({ ...HAP, torso: 0.15, head: 0.15 })],
  [1.8, mk({ ...HAP, drop: KNEEL_DROP, legL: 1.5, legR: 1.5, torso: 0.1 })],
  [2.6, mk({ drop: KNEEL_DROP - 0.02, legL: 1.5, legR: 1.5, torso: 1.25, head: 0.35, armLp: -0.9, armRp: -0.9, armLy: -0.15, armRy: 0.15, wrist: 0 })],
  [3.4, mk({ drop: KNEEL_DROP - 0.02, legL: 1.5, legR: 1.5, torso: 1.3, head: 0.4, armLp: -1.2, armRp: -1.2, armLy: -0.1, armRy: 0.1, wrist: 0 })],
  [4.2, mk({ ...HAP, drop: KNEEL_DROP, legL: 1.5, legR: 1.5, torso: 0.1 })],
  [5.0, mk({ ...HAP, torso: 0.1 })],
  [5.6, mk({})],
];
export const BOW_TOUCH_TIME = 2.9; // 额头触地的时刻（播放铃声）

function bowPose(t: number): Pose {
  for (let i = 0; i < BOW_KEYS.length - 1; i++) {
    const [t0, p0] = BOW_KEYS[i];
    const [t1, p1] = BOW_KEYS[i + 1];
    if (t >= t0 && t <= t1) return lerpPose(p0, p1, ease((t - t0) / (t1 - t0)));
  }
  return mk({});
}

export const HAPJANG_DURATION = 2.4;
function hapjangPose(t: number): Pose {
  if (t < 0.4) return lerpPose(mk({}), mk(HAP), ease(t / 0.4));
  if (t < 1.1) return lerpPose(mk(HAP), mk({ ...HAP, torso: 0.5, head: 0.25 }), ease((t - 0.4) / 0.7));
  if (t < 1.8) return lerpPose(mk({ ...HAP, torso: 0.5, head: 0.25 }), mk(HAP), ease((t - 1.1) / 0.7));
  return lerpPose(mk(HAP), mk({}), ease(Math.min(1, (t - 1.8) / 0.6)));
}

// 上香（双手持香 → 举到额前 → 俯身插香 → 合掌问讯）的时间轴
export const INCENSE_DURATION = 6.0;
export const INCENSE_PLANT_TIME = 2.75;
const INC_HOLD: Partial<Pose> = { armLp: -1.18, armRp: -1.18, armLy: -0.75, armRy: 0.75, wrist: -1.2 };
const INC_KEYS: [number, Pose, [number, number, number]][] = [
  // 时间, 姿势, 香在上身坐标系里的位置
  [0, mk({}), [0, 0.12, 0.18]],
  [0.8, mk({ ...INC_HOLD }), [0, 0.2, 0.22]],
  [1.5, mk({ armLp: -1.75, armRp: -1.75, armLy: -0.7, armRy: 0.7, head: 0.12, wrist: -1.3 }), [0, 0.36, 0.16]],
  [2.7, mk({ armLp: -0.95, armRp: -0.95, armLy: -0.55, armRy: 0.55, torso: 0.55, head: 0.35, wrist: -0.8 }), [0, 0.1, 0.36]],
  [3.3, mk({ ...HAP }), [0, 0.1, 0.36]],
  [4.1, mk({ ...HAP, torso: 0.5, head: 0.25 }), [0, 0.1, 0.36]],
  [4.9, mk({ ...HAP }), [0, 0.1, 0.36]],
  [6.0, mk({}), [0, 0.1, 0.36]],
];
function incensePose(t: number): { pose: Pose; prop: [number, number, number] } {
  for (let i = 0; i < INC_KEYS.length - 1; i++) {
    const [t0, p0, a0] = INC_KEYS[i];
    const [t1, p1, a1] = INC_KEYS[i + 1];
    if (t >= t0 && t <= t1) {
      const k = ease((t - t0) / (t1 - t0));
      return { pose: lerpPose(p0, p1, k), prop: [a0[0] + (a1[0] - a0[0]) * k, a0[1] + (a1[1] - a0[1]) * k, a0[2] + (a1[2] - a0[2]) * k] };
    }
  }
  return { pose: mk({}), prop: [0, 0.1, 0.36] };
}

// 汉传僧装：黄色海青（宽袖、交领右衽、长及脚面），外披红褐色福田袈裟（搭左肩、斜过右腋，左胸有钩环），
// 颈挂念珠，白绑腿，深色僧鞋
const ROBE = '#d8ab55';
const LINING = '#8e6a32';
const LEGGING = '#f1ebdd';
const COLLAR = '#5a3020';
const SKIN = '#efb487';
const SCALP = '#cfa58d'; // 剃过的头顶，比脸色略青
const SHOE = '#3b2a20';

// 福田衣：一条条竖向布块，每条再分成长短两截、上下错开（田相），缝线细而暗，上下有一道缘边
function fieldRobeTexture() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a3420';
  g.fillRect(0, 0, W, H);
  const strips = 7, sw = W / strips;
  const seam = (x0: number, y0: number, x1: number, y1: number) => {
    g.strokeStyle = 'rgba(70,22,10,0.85)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.strokeStyle = 'rgba(196,110,70,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0 + 2, y0 + 2);
    g.lineTo(x1 + 2, y1 + 2);
    g.stroke();
  };
  for (let i = 0; i < strips; i++) {
    const x = i * sw;
    // 每块布颜色略有深浅
    g.fillStyle = `rgba(${i % 2 ? '120,40,20' : '160,70,40'},0.12)`;
    g.fillRect(x, 0, sw, H);
    seam(x, 0, x, H);
    const cuts = i % 2 ? [0.36, 0.7] : [0.28, 0.6];
    for (const f of cuts) seam(x, H * f, x + sw, H * f);
  }
  // 布纹
  for (let k = 0; k < 2500; k++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,200,160,0.05)' : 'rgba(40,10,0,0.06)';
    g.fillRect(Math.random() * W, Math.random() * H, 2, 1);
  }
  // 缘：上下边一道暗金色的边
  for (const y of [0, H - 16]) {
    g.fillStyle = '#a8743a';
    g.fillRect(0, y, W, 16);
    g.fillStyle = 'rgba(60,20,8,0.6)';
    g.fillRect(0, y === 0 ? 16 : H - 18, W, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let sharedMats: Record<string, THREE.Material> | null = null;
function mats() {
  if (!sharedMats) {
    sharedMats = {
      robe: new THREE.MeshPhysicalMaterial({ color: ROBE, roughness: 0.82, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color('#fff0c4') }),
      lining: new THREE.MeshStandardMaterial({ color: LINING, roughness: 0.9, side: THREE.BackSide }),
      legging: new THREE.MeshStandardMaterial({ color: LEGGING, roughness: 0.9 }),
      kasaya: new THREE.MeshPhysicalMaterial({ map: fieldRobeTexture(), roughness: 0.78, sheen: 0.45, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffb898'), side: THREE.DoubleSide }),
      collar: new THREE.MeshStandardMaterial({ color: COLLAR, roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 }),
      headSkin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
      shoe: new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.7 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d9ab52', metalness: 0.8, roughness: 0.3 }),
      face: new THREE.MeshBasicMaterial({ color: '#4a3226' }),
      blush: new THREE.MeshBasicMaterial({ color: '#f08f80', transparent: true, opacity: 0.45, depthWrite: false }),
      shadow: new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }),
      moktak: new THREE.MeshStandardMaterial({ color: '#8c2616', roughness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1c0b06', roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.6 }),
      bead: new THREE.MeshStandardMaterial({ color: '#4a2212', roughness: 0.35 }),
    };
  }
  return sharedMats;
}

// —— 形体尺寸 ——
// 上身（随 torso 前倾）：车削出来的上衣，前后压扁
const ROBE_PROFILE: [number, number][] = [[0.21, -0.08], [0.225, -0.02], [0.21, 0.1], [0.185, 0.22], [0.165, 0.3], [0.13, 0.36], [0.075, 0.4]];
const RZ = 0.84;
function robeR(y: number) {
  const P = ROBE_PROFILE;
  if (y <= P[0][1]) return P[0][0];
  for (let i = 0; i < P.length - 1; i++) {
    const [r0, y0] = P[i], [r1, y1] = P[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0.1;
}
// 袈裟上沿：左肩最高，右腋下最低（φ 从正前方起算，+x 是人物的左边）
const kasayaTop = (phi: number) => 0.2 + 0.17 * Math.pow((1 + Math.sin(phi)) / 2, 1.6);
// 下摆（挂在胯上，跪坐时压扁）
const SKIRT: [number, number][] = [[0.274, -0.235], [0.268, -0.2], [0.25, -0.12], [0.228, -0.03], [0.2, 0.04]];
// 下摆的竖褶：越往下越明显
function folds(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const phi = Math.atan2(x, z);
    const t = Math.min(1, Math.max(0, (0.04 - y) / 0.275)) ** 1.4;
    const k = 1 + t * (0.045 * Math.sin(9 * phi) + 0.018 * Math.sin(17 * phi + 1.3));
    p.setXYZ(i, x * k, y + t * 0.006 * Math.sin(9 * phi), z * k);
  }
  g.computeVertexNormals();
  return g;
}
// 头：略扁的球
const HEAD_C = new THREE.Vector3(0, 0.24, 0);
const HEAD_R = new THREE.Vector3(0.28, 0.27, 0.272);
const cheek = (y: number) => {
  const dy = y - HEAD_C.y;
  return dy >= 0 ? 1 : 1 + 0.05 * Math.sin(Math.min(1, -dy / 0.2) * Math.PI * 0.5);
};

const Z = new THREE.Vector3(0, 0, 1);
function xf(g: THREE.BufferGeometry, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(...scale));
  return g.applyMatrix4(m);
}
// 贴在头表面上的小部件（五官）
function onHead(g: THREE.BufferGeometry, x: number, y: number, lift: number, rotZ = 0, scale: [number, number, number] = [1, 1, 1]) {
  const dx = x / HEAD_R.x, dy = (y - HEAD_C.y) / HEAD_R.y;
  const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)) * HEAD_R.z;
  const n = new THREE.Vector3(x / HEAD_R.x ** 2, (y - HEAD_C.y) / HEAD_R.y ** 2, z / HEAD_R.z ** 2).normalize();
  const p = new THREE.Vector3(x * cheek(y), y, z * cheek(y)).addScaledVector(n, lift);
  const q = new THREE.Quaternion().setFromUnitVectors(Z, n).multiply(new THREE.Quaternion().setFromAxisAngle(Z, rotZ));
  return g.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(...scale)));
}
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs)!;
function tube(pts: THREE.Vector3[], r: number, closed = false) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(8, pts.length * 2), r, 5, closed);
}

// 所有小和尚共用同一套几何体
let sharedGeo: ReturnType<typeof buildGeo> | null = null;
function buildGeo() {
  // 腿与鞋（鞋头微微上翘）
  const leg = xf(new THREE.CapsuleGeometry(0.08, 0.14, 4, 10), [0, -0.14, 0]);
  const shoe = merge([
    xf(new THREE.SphereGeometry(0.085, 14, 10), [0, -0.29, 0.04], [0.95, 0.56, 1.45]),
    xf(new THREE.SphereGeometry(0.032, 10, 8), [0, -0.268, 0.15], [1, 0.85, 1.25], [-0.5, 0, 0]),
  ]);

  // 下摆
  const skirtR = (y: number) => {
    for (let i = 0; i < SKIRT.length - 1; i++) {
      const [r0, y0] = SKIRT[i], [r1, y1] = SKIRT[i + 1];
      if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return SKIRT[SKIRT.length - 1][0];
  };
  const ys = (y0: number, y1: number, n: number) => Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
  const skirt = folds(new THREE.LatheGeometry(ys(-0.235, 0.04, 12).map((y) => new THREE.Vector2(skirtR(y), y)), 54));
  skirt.scale(1, 1, 0.9);
  const skirtKasaya = folds(new THREE.LatheGeometry(ys(-0.15, 0.04, 8).map((y) => new THREE.Vector2(skirtR(y) + 0.007, y)), 54));
  skirtKasaya.scale(1, 1, 0.9);
  const su = skirtKasaya.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < su.count; i++) su.setX(i, su.getX(i) * 2);

  // 上衣
  const robe = new THREE.LatheGeometry([[0, -0.08], ...ROBE_PROFILE, [0, 0.41]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  robe.scale(1, 1, RZ);

  // 袈裟：绕身一圈，上沿从左肩斜到右腋下
  const SEG = 48, ROWS = 8, Y0 = -0.07;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const phi = (i / SEG) * Math.PI * 2;
    const top = kasayaTop(phi);
    for (let j = 0; j <= ROWS; j++) {
      const y = Y0 + ((top - Y0) * j) / ROWS;
      const r = robeR(y) + 0.008;
      pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r * RZ);
      uv.push((i / SEG) * 2, j / ROWS);
    }
  }
  for (let i = 0; i < SEG; i++)
    for (let j = 0; j < ROWS; j++) {
      const a = i * (ROWS + 1) + j, b = (i + 1) * (ROWS + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const kasaya = new THREE.BufferGeometry();
  kasaya.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  kasaya.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  kasaya.setIndex(idx);
  kasaya.computeVertexNormals();

  // 交领（深色）+ 袈裟上沿的缘边
  const surf = (x: number, y: number, out: number) => {
    const r = robeR(y) + out;
    return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * RZ);
  };
  const lapel = (from: [number, number], to: [number, number], out: number, r: number) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push(surf(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, out));
    }
    return tube(pts, r);
  };
  const edgePts: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * Math.PI * 2;
    const y = kasayaTop(phi);
    const r = robeR(y) + 0.012;
    edgePts.push(new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r * RZ));
  }
  const collar = merge([
    lapel([0.07, 0.385], [-0.16, 0.15], 0.006, 0.02),
    lapel([-0.07, 0.385], [0.0, 0.3], 0.006, 0.02),
    xf(new THREE.TorusGeometry(0.1, 0.02, 6, 20), [0, 0.38, 0], [1, 1, 1], [Math.PI / 2, 0, 0]),
    tube(edgePts, 0.011, true),
  ]);
  // 白色护领：露在领口
  const inner = merge([
    xf(new THREE.TorusGeometry(0.086, 0.016, 6, 20), [0, 0.4, 0], [1, 1, 1], [Math.PI / 2, 0, 0]),
    lapel([0.035, 0.392], [-0.025, 0.335], 0.004, 0.013),
  ]);

  // 钩环：左胸前的金环
  const phiR = 0.55, yR = kasayaTop(phiR) - 0.04, rR = robeR(yR) + 0.022;
  const ring = xf(new THREE.TorusGeometry(0.028, 0.008, 8, 18), [Math.sin(phiR) * rR, yR, Math.cos(phiR) * rR * RZ], [1, 1, 1], [0, phiR, 0]);

  // 颈上的念珠：绕颈后、垂到胸前，24 颗 + 一颗大的佛头和小穗
  const malaPts: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * Math.PI * 2;
    const y = 0.395 - 0.22 * Math.pow((1 + Math.cos(phi)) / 2, 4);
    const r = robeR(y) + 0.026;
    malaPts.push(new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r * RZ + 0.004));
  }
  const malaCurve = new THREE.CatmullRomCurve3(malaPts, true);
  const malaParts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 24; k++) {
    const u = 0.04 + (k / 23) * 0.92;
    const p = malaCurve.getPointAt(u);
    malaParts.push(xf(new THREE.SphereGeometry(0.013, 8, 6), [p.x, p.y, p.z]));
  }
  const g0 = malaCurve.getPointAt(0);
  malaParts.push(xf(new THREE.SphereGeometry(0.02, 10, 8), [g0.x, g0.y - 0.004, g0.z + 0.004]));
  malaParts.push(xf(new THREE.ConeGeometry(0.014, 0.05, 8), [g0.x, g0.y - 0.05, g0.z + 0.006]));
  const mala = merge(malaParts);

  // 头：脸、耳朵（耳垂较长）、鼻子并成一块
  const ears: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    ears.push(xf(new THREE.SphereGeometry(0.06, 14, 10), [sx * 0.268, 0.215, -0.015], [0.55, 1.15, 0.8], [0, sx * 0.35, 0]));
    ears.push(xf(new THREE.SphereGeometry(0.036, 10, 8), [sx * 0.281, 0.135, 0.004], [0.6, 1, 0.85]));
  }
  const skull = xf(new THREE.SphereGeometry(0.28, 36, 26), [HEAD_C.x, HEAD_C.y, HEAD_C.z], [1, HEAD_R.y / 0.28, HEAD_R.z / 0.28]);
  {
    const sp = skull.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const k = cheek(sp.getY(i));
      sp.setX(i, sp.getX(i) * k);
      sp.setZ(i, sp.getZ(i) * k);
    }
    skull.computeVertexNormals();
  }
  const head = merge([
    skull,
    ...ears,
    onHead(new THREE.SphereGeometry(0.021, 10, 8), 0, 0.172, -0.006, 0, [1, 0.8, 0.75]),
  ]);
  // 剃过的头顶比脸色略青：按顶点渐变上色，发际线是柔和过渡，不是一道硬边
  {
    const skin = new THREE.Color(SKIN), scalp = new THREE.Color(SCALP), c = new THREE.Color();
    const axis = new THREE.Vector3(0, Math.cos(0.45), -Math.sin(0.45));
    const hp = head.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(hp.count * 3);
    const v = new THREE.Vector3();
    const edge = Math.cos(Math.PI * 0.42);
    for (let i = 0; i < hp.count; i++) {
      v.fromBufferAttribute(hp, i).sub(HEAD_C).normalize();
      const f = THREE.MathUtils.smoothstep(v.dot(axis), edge - 0.12, edge + 0.2);
      c.copy(skin).lerp(scalp, f);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    head.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  // 五官：闭着的弯眼、细眉、微笑
  const faceParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    faceParts.push(onHead(new THREE.TorusGeometry(0.04, 0.008, 4, 12, Math.PI * 0.7), sx * 0.096, 0.235, 0.003, Math.PI * 1.15));
    faceParts.push(onHead(new THREE.TorusGeometry(0.05, 0.0062, 4, 10, Math.PI * 0.5), sx * 0.1, 0.25, 0.004, Math.PI * 0.25 + sx * 0.12));
  }
  faceParts.push(onHead(new THREE.TorusGeometry(0.03, 0.007, 4, 10, Math.PI * 0.6), 0, 0.152, 0.003, Math.PI * 1.2));
  const face = merge(faceParts);
  const blush = merge([-1, 1].map((sx) => onHead(new THREE.CircleGeometry(0.038, 14), sx * 0.165, 0.165, 0.004)));

  // 宽大的袖子：袖口外张，靠背后的一侧更长，抬手时像垂下的袖兜
  const sleeve = new THREE.CylinderGeometry(0.062, 0.13, 0.25, 20, 4, true);
  const sp = sleeve.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i), z = sp.getZ(i);
    const t = (0.125 - y) / 0.25;
    const back = Math.max(0, -z / 0.13);
    sp.setY(i, y - 0.125 - t * t * 0.085 * back);
    sp.setZ(i, z - t * t * 0.035 * back);
  }
  sleeve.computeVertexNormals();
  const sleeveOuter = merge([sleeve.clone(), new THREE.SphereGeometry(0.066, 14, 10)]);
  const shoulderCap = new THREE.SphereGeometry(0.077, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  // 手：连指手套状，以手腕为轴（挂在手臂 y=-0.25 处），拇指朝前、朝身体内侧
  const hand = (sx: number) =>
    merge([
      xf(new THREE.SphereGeometry(0.05, 14, 10), [0, -0.03, 0], [0.75, 1.15, 0.85]),
      xf(new THREE.SphereGeometry(0.021, 8, 6), [-sx * 0.03, -0.005, 0.024], [1, 1.3, 1]),
    ]);

  // 手里拿的：木鱼、木槌、念珠
  const moktak = xf(new THREE.SphereGeometry(0.07, 16, 12), [0, 0, 0], [1.15, 0.8, 0.95]);
  const moktakSlit = xf(new THREE.TorusGeometry(0.075, 0.009, 6, 20, Math.PI * 0.8), [0, -0.012, 0], [1.13, 0.95, 1], [Math.PI / 2, Math.PI * 0.1, 0]);
  const mallet = merge([xf(new THREE.CylinderGeometry(0.008, 0.009, 0.17, 6), [0, -0.33, 0.02]), xf(new THREE.SphereGeometry(0.024, 10, 8), [0, -0.415, 0.02])]);
  const beads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    beads.push(xf(new THREE.SphereGeometry(0.014, 6, 4), [Math.cos(a) * 0.06, -0.06 + Math.sin(a) * 0.08, 0]));
  }
  const handBeads = merge(beads);

  return { leg, shoe, skirt, skirtKasaya, robe, kasaya, collar, inner, ring, mala, head, face, blush, sleeve, sleeveOuter, shoulderCap, handL: hand(1), handR: hand(-1), moktak, moktakSlit, mallet, handBeads };
}
function geo() {
  return (sharedGeo ??= buildGeo());
}

export class Monk {
  root = new THREE.Group();
  private hips = new THREE.Group();
  private skirt = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private torso = new THREE.Group();
  private headG = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private handL = new THREE.Group();
  private handR = new THREE.Group();
  private moktakProp: THREE.Group;
  private malletProp: THREE.Mesh;
  private beadsProp: THREE.Mesh;
  private incenseProp: THREE.Group;
  private planted = false;
  onIncensePlant?: () => void;
  private pose: Pose = mk({});
  private walkPhase = Math.random() * 6;
  private tap = 0;
  action: Action = 'idle';
  actionTime = 0;
  speed = 0;
  onBowTouch?: () => void;
  onBowDone?: () => void;
  private lastBowCycle = -1;
  private touchedThisCycle = false;

  constructor() {
    const M = mats();
    const G = geo();
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
      const o = new THREE.Mesh(g, m);
      o.castShadow = shadow;
      return o;
    };

    this.hips.position.y = HIP;
    this.root.add(this.hips);

    // 腿：白绑腿 + 僧鞋
    for (const [g, sx] of [[this.legL, 1], [this.legR, -1]] as [THREE.Group, number][]) {
      g.position.set(sx * 0.1, 0, 0);
      g.rotation.order = 'YXZ';
      g.add(mesh(G.leg, M.legging), mesh(G.shoe, M.shoe));
      this.hips.add(g);
    }

    // 下摆：海青长到脚面，袈裟盖到小腿
    this.skirt.add(mesh(G.skirt, M.robe), mesh(G.skirtKasaya, M.kasaya));
    this.hips.add(this.skirt);

    // 上身
    this.hips.add(this.torso);
    this.torso.add(mesh(G.robe, M.robe), mesh(G.kasaya, M.kasaya), mesh(G.collar, M.collar, false), mesh(G.inner, M.legging, false), mesh(G.ring, M.gold, false), mesh(G.mala, M.bead, false));

    // 头
    this.headG.position.y = 0.42;
    this.torso.add(this.headG);
    this.headG.add(mesh(G.head, M.headSkin), mesh(G.face, M.face, false));
    const blush = mesh(G.blush, M.blush, false);
    blush.renderOrder = 2;
    this.headG.add(blush);

    // 手臂：宽袖（外黄里深）+ 手；左肩上搭着袈裟
    for (const [g, sx] of [[this.armL, 1], [this.armR, -1]] as [THREE.Group, number][]) {
      g.position.set(sx * 0.2, 0.3, 0);
      g.rotation.order = 'YXZ';
      const h = sx > 0 ? this.handL : this.handR;
      h.position.y = -0.25;
      h.add(mesh(sx > 0 ? G.handL : G.handR, M.skin));
      g.add(mesh(G.sleeveOuter, M.robe), mesh(G.sleeve, M.lining, false), h);
      this.torso.add(g);
    }
    this.armL.add(mesh(G.shoulderCap, M.kasaya));

    // 手里的木鱼、木槌与念珠（只在对应动作时显示）
    this.moktakProp = new THREE.Group();
    this.moktakProp.add(mesh(G.moktak, M.moktak), mesh(G.moktakSlit, M.dark, false));
    this.moktakProp.position.set(0, -0.3, 0.03);
    this.moktakProp.visible = false;
    this.armL.add(this.moktakProp);
    this.malletProp = mesh(G.mallet, M.wood, false);
    this.malletProp.visible = false;
    this.armR.add(this.malletProp);
    this.beadsProp = mesh(G.handBeads, M.bead, false);
    this.beadsProp.position.set(0, -0.27, 0.03);
    this.beadsProp.visible = false;
    this.armR.add(this.beadsProp);

    // 手里的两支香（上香时显示）
    this.incenseProp = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: '#7a3f22', roughness: 0.8 });
    const emberMat = new THREE.MeshBasicMaterial({ color: '#ff8a40' });
    for (const dx of [-0.018, 0.018]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 5), stickMat);
      st.position.set(dx, 0.17, 0);
      const em = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), emberMat);
      em.position.set(dx, 0.385, 0);
      this.incenseProp.add(st, em);
    }
    this.incenseProp.visible = false;
    this.torso.add(this.incenseProp);

    // 脚下的圆形软阴影（让角色不显得飘）
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), M.shadow);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    blob.renderOrder = 1;
    this.root.add(blob);
  }

  setAction(a: Action) {
    if (a === this.action) return;
    this.action = a;
    this.actionTime = 0;
    this.lastBowCycle = -1;
    this.touchedThisCycle = false;
    this.planted = false;
  }

  strike() {
    this.tap = 1;
  }

  update(dt: number) {
    this.actionTime += dt;
    const t = this.actionTime;
    let target: Pose;
    let rate = 10;

    this.moktakProp.visible = this.action === 'moktak';
    this.malletProp.visible = this.action === 'moktak';
    this.beadsProp.visible = this.action === 'rosary';
    this.incenseProp.visible = this.action === 'incense' && this.actionTime < INCENSE_PLANT_TIME;

    switch (this.action) {
      case 'walk': {
        this.walkPhase += dt * (5 + this.speed * 2.6);
        const s = Math.sin(this.walkPhase);
        const amp = Math.min(1, this.speed / 2);
        // 走路时双手仍交叠在身前，只随步子轻轻晃
        target = mk({ legL: s * 0.55 * amp, legR: -s * 0.55 * amp, armLp: -1.0 + s * 0.07 * amp, armRp: -1.0 - s * 0.07 * amp, bob: Math.abs(Math.cos(this.walkPhase)) * 0.035 * amp, torso: 0.05, sway: s * 0.045 * amp });
        rate = 14;
        break;
      }
      case 'bow': {
        const cycle = Math.floor(t / BOW_DURATION);
        const ct = t - cycle * BOW_DURATION;
        if (cycle !== this.lastBowCycle) {
          if (this.lastBowCycle >= 0) this.onBowDone?.();
          this.lastBowCycle = cycle;
          this.touchedThisCycle = false;
        }
        if (!this.touchedThisCycle && ct >= BOW_TOUCH_TIME) {
          this.touchedThisCycle = true;
          this.onBowTouch?.();
        }
        target = bowPose(ct);
        rate = 18;
        break;
      }
      case 'hapjang':
        target = hapjangPose(Math.min(t, HAPJANG_DURATION));
        rate = 16;
        break;
      case 'incense': {
        const r = incensePose(Math.min(t, INCENSE_DURATION));
        target = r.pose;
        this.incenseProp.position.set(...r.prop);
        // 香始终竖直：抵消上身的前倾
        this.incenseProp.rotation.x = -this.pose.torso;
        if (!this.planted && t >= INCENSE_PLANT_TIME) {
          this.planted = true;
          this.onIncensePlant?.();
        }
        rate = 14;
        break;
      }
      case 'sit': {
        // 盘腿打坐，双手放在腿上
        const br = Math.sin(t * 1.1) * 0.01;
        target = mk({ drop: -(HIP - 0.16), legL: -1.45, legR: -1.45, legSpread: 0.75, armLp: -0.8, armRp: -0.8, armLy: -0.62, armRy: 0.62, wrist: -0.6, head: 0.18, bob: br });
        break;
      }
      case 'bench':
        target = mk({ drop: 0.46 - HIP + 0.03, legL: -1.35, legR: -1.35, armLp: -0.8, armRp: -0.8, armLy: -0.62, armRy: 0.62, wrist: -0.6, head: 0.1, bob: Math.sin(t * 1.1) * 0.006 });
        break;
      case 'moktak': {
        this.tap = Math.max(0, this.tap - dt * 6);
        target = mk({ armLp: -1.0, armLy: -0.45, armRp: -1.15 + this.tap * 0.5, armRy: 0.5, wrist: 0, head: 0.2, torso: 0.06 });
        rate = 20;
        break;
      }
      case 'rosary':
        target = mk({ armLp: -1.05, armRp: -1.1, armLy: -0.7, armRy: 0.75, wrist: -0.4, head: 0.28, torso: 0.05, bob: Math.sin(t * 1.4) * 0.006 });
        break;
      default:
        target = mk({ bob: Math.sin(t * 1.6) * 0.008 });
    }

    const k = 1 - Math.exp(-rate * dt);
    this.pose = lerpPose(this.pose, target, k);
    const p = this.pose;
    const hipY = HIP + p.drop + p.bob;
    this.hips.position.y = hipY;
    // 下摆随胯部高度压扁（跪下、坐下时不穿进地面），腿向前伸时也收起来
    const fwd = Math.min(1, Math.max(0, (-(p.legL + p.legR) / 2 - 0.6) / 0.8));
    this.skirt.scale.y = Math.min(1, Math.max(0.18, hipY / HIP)) * (1 - 0.7 * fwd);
    this.skirt.rotation.z = p.sway;
    this.legL.rotation.set(p.legL, -p.legSpread, 0);
    this.legR.rotation.set(p.legR, p.legSpread, 0);
    this.torso.rotation.x = p.torso;
    this.headG.rotation.x = p.head;
    this.armL.rotation.set(p.armLp, p.armLy, p.armLr);
    this.armR.rotation.set(p.armRp, p.armRy, p.armRr);
    this.handL.rotation.x = p.wrist;
    this.handR.rotation.x = p.wrist;
  }
}
