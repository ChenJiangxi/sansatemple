// Q 版小和尚：几何体拼成，动作用关节旋转做程序动画
import * as THREE from 'three';
import { kasayaTexture } from './textures';

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
}

const ZERO: Pose = { drop: 0, legL: 0, legR: 0, legSpread: 0, torso: 0, head: 0, armLp: 0, armRp: 0, armLy: 0, armRy: 0, armLr: 0, armRr: 0, bob: 0 };

const HAP: Partial<Pose> = { armLp: -1.32, armRp: -1.32, armLy: -0.95, armRy: 0.95 };

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
  [2.6, mk({ drop: KNEEL_DROP - 0.02, legL: 1.5, legR: 1.5, torso: 1.25, head: 0.35, armLp: -0.9, armRp: -0.9, armLy: -0.15, armRy: 0.15 })],
  [3.4, mk({ drop: KNEEL_DROP - 0.02, legL: 1.5, legR: 1.5, torso: 1.3, head: 0.4, armLp: -1.2, armRp: -1.2, armLy: -0.1, armRy: 0.1 })],
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
const INC_HOLD: Partial<Pose> = { armLp: -1.18, armRp: -1.18, armLy: -0.8, armRy: 0.8 };
const INC_KEYS: [number, Pose, [number, number, number]][] = [
  // 时间, 姿势, 香在上身坐标系里的位置
  [0, mk({}), [0, 0.12, 0.18]],
  [0.8, mk({ ...INC_HOLD }), [0, 0.2, 0.22]],
  [1.5, mk({ armLp: -1.75, armRp: -1.75, armLy: -0.72, armRy: 0.72, head: 0.12 }), [0, 0.36, 0.16]],
  [2.7, mk({ armLp: -0.95, armRp: -0.95, armLy: -0.55, armRy: 0.55, torso: 0.55, head: 0.35 }), [0, 0.1, 0.36]],
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

// 汉传僧装：黄色海青（宽袖、交领右衽），外披红褐色福田袈裟，白绑腿，深色罗汉鞋
const ROBE = '#d8ab55';
const ROBE_DARK = '#f1ebdd';
const COLLAR = '#6a3a22';
const SKIN = '#efb487';
const SHOE = '#3b2a20';

let sharedMats: Record<string, THREE.Material> | null = null;
function mats() {
  if (!sharedMats) {
    sharedMats = {
      robe: new THREE.MeshStandardMaterial({ color: ROBE, roughness: 0.85 }),
      robeDark: new THREE.MeshStandardMaterial({ color: ROBE_DARK, roughness: 0.9 }),
      kasaya: new THREE.MeshStandardMaterial({ map: kasayaTexture(), roughness: 0.8, side: THREE.DoubleSide }),
      collar: new THREE.MeshStandardMaterial({ color: COLLAR, roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 }),
      shoe: new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.7 }),
      face: new THREE.MeshBasicMaterial({ color: '#4a3226' }),
      blush: new THREE.MeshBasicMaterial({ color: '#f08f80', transparent: true, opacity: 0.45 }),
      shadow: new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }),
      moktak: new THREE.MeshStandardMaterial({ color: '#a4592a', roughness: 0.45 }),
      bead: new THREE.MeshStandardMaterial({ color: '#8a4a26', roughness: 0.4 }),
    };
  }
  return sharedMats;
}

export class Monk {
  root = new THREE.Group();
  private hips = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private torso = new THREE.Group();
  private headG = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private moktakProp: THREE.Group;
  private beadsProp: THREE.Group;
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
    const S = (o: THREE.Mesh) => {
      o.castShadow = true;
      o.receiveShadow = false;
      return o;
    };

    this.hips.position.y = HIP;
    this.root.add(this.hips);

    // 腿
    for (const [g, sx] of [[this.legL, 1], [this.legR, -1]] as [THREE.Group, number][]) {
      g.position.set(sx * 0.1, 0, 0);
      g.rotation.order = 'YXZ';
      const leg = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.14, 4, 10), M.robeDark));
      leg.position.y = -0.14;
      const foot = S(new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), M.shoe));
      foot.scale.set(1, 0.6, 1.4);
      foot.position.set(0, -0.29, 0.035);
      g.add(leg, foot);
      this.hips.add(g);
    }

    // 上身：裙摆状的僧袍
    this.hips.add(this.torso);
    const robeGeo = new THREE.LatheGeometry(
      [[0.0, -0.08], [0.25, -0.08], [0.27, -0.02], [0.24, 0.12], [0.2, 0.28], [0.17, 0.36], [0.1, 0.4], [0, 0.41]].map(([x, y]) => new THREE.Vector2(x, y)),
      28
    );
    const robe = S(new THREE.Mesh(robeGeo, M.robe));
    robe.scale.set(1, 1, 0.86);
    this.torso.add(robe);
    // 袈裟：斜披在左肩的一片黄色
    const kasayaGeo = new THREE.CylinderGeometry(0.236, 0.278, 0.34, 24, 1, true, Math.PI * 0.15, Math.PI * 1.05);
    const kasaya = S(new THREE.Mesh(kasayaGeo, M.kasaya));
    kasaya.scale.set(1, 1, 0.88);
    kasaya.position.set(0, 0.08, 0);
    kasaya.rotation.set(0, 0.35, 0.18);
    this.torso.add(kasaya);
    const strap = S(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 20, Math.PI), M.kasaya));
    strap.position.set(0.04, 0.26, 0);
    strap.rotation.set(0, Math.PI / 2, 0.5);
    strap.scale.set(1, 1, 0.9);
    this.torso.add(strap);
    const robeR = (y: number) => {
      const prof: [number, number][] = [[0.27, -0.02], [0.24, 0.12], [0.2, 0.28], [0.17, 0.36], [0.1, 0.4]];
      for (let i = 0; i < prof.length - 1; i++) {
        const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
        if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      }
      return 0.2;
    };
    const lapel = (from: [number, number], to: [number, number]) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const x = from[0] + (to[0] - from[0]) * t;
        const y = from[1] + (to[1] - from[1]) * t;
        const rr = robeR(y);
        const z = Math.sqrt(Math.max(0, rr * rr - x * x)) * 0.86 + 0.006;
        pts.push(new THREE.Vector3(x, y, z));
      }
      return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.018, 5, false), M.collar);
    };
    this.torso.add(lapel([0.06, 0.38], [-0.16, 0.14]));
    this.torso.add(lapel([-0.06, 0.38], [0.0, 0.3]));
    const neckband = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16), M.collar);
    neckband.rotation.x = Math.PI / 2;
    neckband.position.y = 0.385;
    this.torso.add(neckband);

    // 头
    this.headG.position.y = 0.4;
    this.torso.add(this.headG);
    const head = S(new THREE.Mesh(new THREE.SphereGeometry(0.29, 28, 20), M.skin));
    head.scale.set(1, 0.95, 0.97);
    head.position.y = 0.25;
    this.headG.add(head);
    for (const sx of [-1, 1]) {
      const ear = S(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.skin));
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(sx * 0.285, 0.23, 0);
      this.headG.add(ear);
      // 闭着的眼睛：弯弯的弧线
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 4, 10, Math.PI), M.face);
      eye.position.set(sx * 0.1, 0.22, 0.266);
      eye.rotation.set(0.15, sx * 0.3, Math.PI);
      this.headG.add(eye);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.036, 12), M.blush);
      blush.position.set(sx * 0.17, 0.16, 0.214);
      blush.rotation.y = sx * 0.66;
      this.headG.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 4, 10, Math.PI), M.face);
    mouth.position.set(0, 0.13, 0.26);
    mouth.rotation.set(0.25, 0, Math.PI);
    this.headG.add(mouth);

    // 手臂
    for (const [g, sx] of [[this.armL, 1], [this.armR, -1]] as [THREE.Group, number][]) {
      g.position.set(sx * 0.19, 0.31, 0);
      g.rotation.order = 'YXZ';
      const sleeve = S(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.115, 0.24, 12, 1, true), M.robe));
      sleeve.position.y = -0.12;
      (sleeve.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      const shoulder = S(new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), M.robe));
      g.add(shoulder);
      const hand = S(new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M.skin));
      hand.position.y = -0.255;
      g.add(sleeve, hand);
      this.torso.add(g);
    }

    // 手里的木鱼与念珠（只在对应动作时显示）
    this.moktakProp = new THREE.Group();
    const mk1 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), M.moktak);
    mk1.scale.set(1, 0.85, 0.9);
    this.moktakProp.add(mk1);
    this.moktakProp.position.set(0, -0.27, 0.02);
    this.moktakProp.visible = false;
    this.armL.add(this.moktakProp);
    this.beadsProp = new THREE.Group();
    const bgeo = new THREE.SphereGeometry(0.014, 6, 4);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const b = new THREE.Mesh(bgeo, M.bead);
      b.position.set(Math.cos(a) * 0.06, -0.06 + Math.sin(a) * 0.08, 0);
      this.beadsProp.add(b);
    }
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
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), M.shadow);
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
    this.beadsProp.visible = this.action === 'rosary';
    this.incenseProp.visible = this.action === 'incense' && this.actionTime < INCENSE_PLANT_TIME;

    switch (this.action) {
      case 'walk': {
        this.walkPhase += dt * (5 + this.speed * 2.6);
        const s = Math.sin(this.walkPhase);
        const amp = Math.min(1, this.speed / 2);
        target = mk({ legL: s * 0.55 * amp, legR: -s * 0.55 * amp, armLp: -s * 0.4 * amp, armRp: s * 0.4 * amp, armLr: 0.12, armRr: -0.12, bob: Math.abs(Math.cos(this.walkPhase)) * 0.035 * amp, torso: 0.05 });
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
        target = mk({ drop: -(HIP - 0.16), legL: -1.45, legR: -1.45, legSpread: 0.75, armLp: -0.55, armRp: -0.55, armLy: -0.55, armRy: 0.55, head: 0.18, bob: br });
        break;
      }
      case 'bench':
        target = mk({ drop: 0.46 - HIP + 0.03, legL: -1.35, legR: -1.35, armLp: -0.6, armRp: -0.6, armLy: -0.45, armRy: 0.45, head: 0.1, bob: Math.sin(t * 1.1) * 0.006 });
        break;
      case 'moktak': {
        this.tap = Math.max(0, this.tap - dt * 6);
        target = mk({ armLp: -1.0, armLy: -0.45, armRp: -1.15 + this.tap * 0.5, armRy: 0.5, head: 0.2, torso: 0.06 });
        rate = 20;
        break;
      }
      case 'rosary':
        target = mk({ armLp: -1.05, armRp: -1.1, armLy: -0.7, armRy: 0.75, head: 0.28, torso: 0.05, bob: Math.sin(t * 1.4) * 0.006 });
        break;
      default:
        target = mk({ bob: Math.sin(t * 1.6) * 0.008, armLr: 0.08, armRr: -0.08 });
    }

    const k = 1 - Math.exp(-rate * dt);
    this.pose = lerpPose(this.pose, target, k);
    const p = this.pose;
    this.hips.position.y = HIP + p.drop + p.bob;
    this.legL.rotation.set(p.legL, -p.legSpread, 0);
    this.legR.rotation.set(p.legR, p.legSpread, 0);
    this.torso.rotation.x = p.torso;
    this.headG.rotation.x = p.head;
    this.armL.rotation.set(p.armLp, p.armLy, p.armLr);
    this.armR.rotation.set(p.armRp, p.armRy, p.armRr);
  }
}
