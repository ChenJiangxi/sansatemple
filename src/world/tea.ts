// 围炉煮茶：半山咖啡北边大枫树下。
// 一张放宽的明式茶几（Poly Haven，CC0），中间一只青花火钵（GiyoP，CC BY 4.0），钵上平放一块铁烤盘（scrumpy26，CC BY 4.0），
// 盘中间一把铁壶（toomuchtea，CC BY 4.0）冒着热气，四周烤着橘子、柿子、栗子；茶几一角一套青瓷茶具（alc.72，CC BY 4.0）；
// 四把露营椅（lpfeffer，CC BY 4.0）对着茶几四条边。火钵里透出一点炭火光，天黑以后更亮。
// 坐下的人可以自己往烤盘上放东西烤，烤好了吃掉（这一部分只在自己这边）。
import * as THREE from 'three';
import { TEA, TEA_SEATS } from '../layout';
import { loadProp } from './glb';

export type RoastKind = 'orange' | 'persimmon' | 'chestnut';
export const ROAST_KINDS: RoastKind[] = ['orange', 'persimmon', 'chestnut'];
export const ROAST_SECONDS = 8;

const TABLE_TOP = 0.5;
const TABLE_SCALE = 1.45;
const BRASERO_H = 0.32;
const PLATE_Y = TABLE_TOP + BRASERO_H; // 烤盘底面
const PLATE_T = 0.038;
// 烤盘上能放东西的位置（相对茶几中心）；中间是铁壶
const SLOTS: [number, number][] = [[-0.12, -0.22], [0.12, -0.22], [-0.13, 0.21], [0.13, 0.21], [-0.15, 0.0], [0.15, 0.0]];

export interface TeaBuild {
  group: THREE.Group;
  interactives: THREE.Object3D[];
  update(dt: number, night: number): void;
  // 放一个上去烤，返回位置编号；满了返回 -1
  roast(kind: RoastKind): number;
  // 烤好的拿走（吃掉）
  take(slot: number): void;
  ready(slot: number): boolean;
}

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  r.addColorStop(0, 'rgba(255,255,255,0.85)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// 烤的东西：橘子（带一点果蒂）、柿子（扁圆、四瓣绿萼）、栗子（尖头、一小块浅色底）
function roastMesh(kind: RoastKind) {
  const g = new THREE.Group();
  if (kind === 'orange') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), new THREE.MeshStandardMaterial({ color: '#e8862a', roughness: 0.55 }));
    body.scale.y = 0.92;
    body.position.y = 0.033;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.01, 6), new THREE.MeshStandardMaterial({ color: '#4f5a2a' }));
    stem.position.y = 0.068;
    g.add(body, stem);
  } else if (kind === 'persimmon') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), new THREE.MeshStandardMaterial({ color: '#e0601e', roughness: 0.4 }));
    body.scale.y = 0.72;
    body.position.y = 0.029;
    const calyx = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.008, 4), new THREE.MeshStandardMaterial({ color: '#5d6b2c', roughness: 0.8 }));
    calyx.position.y = 0.058;
    g.add(body, calyx);
  } else {
    const prof = [[0, 0], [0.018, 0.002], [0.024, 0.012], [0.02, 0.026], [0.008, 0.036], [0, 0.04]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), new THREE.MeshStandardMaterial({ color: '#6b3a1c', roughness: 0.35 }));
    body.scale.z = 0.7;
    body.rotation.z = 0.25;
    g.add(body);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

export function buildTea(scene: THREE.Scene): TeaBuild {
  const group = new THREE.Group();
  group.position.set(TEA.x, 0, TEA.z);
  scene.add(group);
  const interactives: THREE.Object3D[] = [];

  // 先放看不见的点击区（模型还没下载完也能点）：每把椅子一个，茶几一个（点茶几就走到最近的空位）
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const s of TEA_SEATS) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.0, 0.75), hitMat);
    h.position.set(s.x - TEA.x, 0.5, s.z - TEA.z);
    h.userData.interact = { type: 'seat', id: s.id };
    group.add(h);
    interactives.push(h);
  }
  const tableHit = new THREE.Mesh(new THREE.BoxGeometry(TEA.half * 2, 1.0, TEA.half * 2), hitMat);
  tableHit.position.y = 0.5;
  tableHit.userData.interact = { type: 'tea' };
  group.add(tableHit);
  interactives.push(tableHit);

  // 模型
  loadProp('tea_table').then((o) => {
    o.scale.set(TABLE_SCALE, 1, TABLE_SCALE);
    group.add(o);
  });
  loadProp('brasero').then((o) => {
    o.position.y = TABLE_TOP;
    group.add(o);
  });
  loadProp('grill').then((o) => {
    // 原模型竖着立在 XY 平面里：放平
    o.rotation.x = -Math.PI / 2;
    // 转平以后厚度方向在 y 上，中心对着火钵口
    o.position.set(0, PLATE_Y + PLATE_T / 2, 0.3175);
    group.add(o);
  });
  const kettle = new THREE.Group();
  kettle.position.set(0, PLATE_Y + PLATE_T, 0);
  kettle.rotation.y = Math.PI * 0.75;
  group.add(kettle);
  loadProp('tetsubin').then((o) => kettle.add(o));
  loadProp('teaset').then((o) => {
    o.position.set(0.37, TABLE_TOP, 0.37);
    o.rotation.y = Math.PI * 0.25;
    group.add(o);
  });
  for (const s of TEA_SEATS) {
    loadProp('camp_chair').then((o) => {
      // 椅子面朝 -z；朝向座位的 yaw 减半圈
      o.scale.setScalar(1.1);
      o.position.set(s.x - TEA.x, 0, s.z - TEA.z);
      o.rotation.y = s.yaw - Math.PI;
      group.add(o);
    });
  }

  // 炭火光：白天几乎看不出，天黑以后照亮围坐的人
  const glow = new THREE.PointLight('#ff8a3c', 0, 4.5, 1.6);
  glow.position.set(0, PLATE_Y + 0.05, 0);
  group.add(glow);

  // 壶嘴的热气
  const puffMat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0.5 });
  const puffs = Array.from({ length: 10 }, (_, i) => {
    const sp = new THREE.Sprite(puffMat.clone());
    sp.userData.t = i / 10;
    group.add(sp);
    return sp;
  });

  // 烤盘上：一直有几个在烤（大家的），坐下的人自己再放
  type Item = { kind: RoastKind; obj: THREE.Group; t: number; mine: boolean };
  const items: (Item | null)[] = SLOTS.map(() => null);
  const put = (slot: number, kind: RoastKind, mine: boolean, t = 0) => {
    const obj = roastMesh(kind);
    obj.position.set(SLOTS[slot][0], PLATE_Y + PLATE_T, SLOTS[slot][1]);
    obj.rotation.y = slot * 1.7;
    group.add(obj);
    items[slot] = { kind, obj, t, mine };
  };
  put(4, 'orange', false, ROAST_SECONDS);
  put(1, 'chestnut', false, ROAST_SECONDS);
  put(3, 'persimmon', false, ROAST_SECONDS);
  // 越烤越深：颜色往焦褐色走
  const raw = new THREE.Color(), done = new THREE.Color('#4a2a14');
  const tint = (it: Item) => {
    const k = Math.min(1, it.t / ROAST_SECONDS) * 0.45;
    it.obj.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !m.color) return;
      if (!m.userData.raw) m.userData.raw = m.color.getHex();
      raw.setHex(m.userData.raw);
      m.color.copy(raw).lerp(done, k);
    });
  };
  for (const it of items) if (it) tint(it);

  let time = 0;
  return {
    group,
    interactives,
    update(dt, night) {
      time += dt;
      // 炭火一明一暗
      const flick = 0.85 + 0.15 * Math.sin(time * 7.3) * Math.sin(time * 3.1 + 1);
      glow.intensity = (0.15 + 2.6 * night) * flick;
      for (const sp of puffs) {
        let u = (sp.userData.t as number) + dt / 2.6;
        if (u > 1) u -= 1;
        sp.userData.t = u;
        const sx = Math.sin(time * 0.7 + u * 5) * 0.03;
        // 壶嘴转到了左后方（-x、+z）
        sp.position.set(-0.09 + sx - u * 0.03, PLATE_Y + PLATE_T + 0.16 + u * 0.55, 0.09 + u * 0.03);
        sp.scale.setScalar(0.06 + u * 0.22);
        (sp.material as THREE.SpriteMaterial).opacity = 0.42 * Math.sin(u * Math.PI);
      }
      for (const it of items) {
        if (!it || it.t >= ROAST_SECONDS) continue;
        it.t += dt;
        tint(it);
      }
    },
    roast(kind) {
      // 优先放空位；没有空位就把一个不是自己的、已经烤好的拿掉
      let slot = items.findIndex((x) => !x);
      if (slot < 0) slot = items.findIndex((x) => x && !x.mine);
      if (slot < 0) return -1;
      const old = items[slot];
      if (old) group.remove(old.obj);
      put(slot, kind, true);
      return slot;
    },
    ready(slot) {
      const it = items[slot];
      return !!it && it.mine && it.t >= ROAST_SECONDS;
    },
    take(slot) {
      const it = items[slot];
      if (!it) return;
      group.remove(it.obj);
      items[slot] = null;
    },
  };
}
