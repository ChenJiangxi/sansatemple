// 配殿（观音殿、地藏殿）与钟楼、鼓楼：朱红柱、格扇门、彩画梁、带鸱吻的屋顶
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIDE_HALLS, BELL, DRUM } from '../layout';
import { plaqueTexture } from '../textures';
import { worldBox, mesh, lathe } from './util';
import { buildTempleBell } from './bronze';
import { buildRoof, beamRing, chineseMats, meterUV } from './hall';

const plaqueNames = ['觀音殿', '地藏殿'];

function plaqueMesh(text: string, width: number) {
  const M = chineseMats();
  const n = [...text].length;
  const h = width * (340 / (260 * n + 140));
  return mesh(new THREE.BoxGeometry(width, h, 0.12), [M.gold, M.gold, M.gold, M.gold, new THREE.MeshStandardMaterial({ map: plaqueTexture(text), roughness: 0.5, metalness: 0.2 }), M.redDark]);
}

function sideHall(def: (typeof SIDE_HALLS)[number], idx: number) {
  const M = chineseMats();
  const g = new THREE.Group();
  const L = def.d; // 面阔（本地 x）
  const D = def.w; // 进深（本地 z）
  const base = 0.6;
  const colH = 4.2;
  const plat = mesh(worldBox(L + 1.6, base, D + 1.6, 1), [M.marbleSide, M.marbleSide, M.marble, M.marble, M.marbleSide, M.marbleSide]);
  plat.position.y = base / 2;
  g.add(plat);
  for (let k = 0; k < 2; k++) {
    const s = mesh(worldBox(3.2, (base * (k + 1)) / 2, 0.6 * (2 - k), 1), M.marble);
    s.position.set(0, (base * (k + 1)) / 4, D / 2 + 0.8 + 0.3 * (2 - k));
    g.add(s);
  }
  const hx = L / 2 - 0.4;
  const hz = D / 2 - 0.4;
  const colTop = base + colH;
  const colGeo = meterUV(new THREE.CylinderGeometry(0.24, 0.27, colH, 16), 1.6, colH);
  for (const x of [-hx, -hx / 2, 0, hx / 2, hx])
    for (const z of [-hz, hz]) {
      const c = mesh(colGeo, M.red);
      c.position.set(x, base + colH / 2, z);
      g.add(c);
    }
  // 正面四间格扇门
  const bay = hx / 2;
  const leaves: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const cx = -hx + bay / 2 + i * bay;
    for (let k = 0; k < 4; k++) {
      const w = (bay - 0.4) / 4;
      const leaf = new THREE.BoxGeometry(w - 0.03, colH - 1.0, 0.1);
      leaf.translate(cx - (bay - 0.4) / 2 + w * (k + 0.5), base + (colH - 1.0) / 2, hz);
      leaves.push(leaf);
    }
    const tw = new THREE.BoxGeometry(bay - 0.4, 0.6, 0.1);
    tw.translate(cx, colTop - 0.65, hz);
    leaves.push(tw);
  }
  g.add(mesh(mergeGeometries(leaves), M.geshan));
  const back = mesh(worldBox(hx * 2, colH, 0.3, 1), M.redWall);
  back.position.set(0, base + colH / 2, -hz);
  g.add(back);
  for (const sx of [-1, 1]) {
    const w = mesh(worldBox(0.3, colH, hz * 2, 1), M.redWall);
    w.position.set(sx * hx, base + colH / 2, 0);
    g.add(w);
  }
  const fill = mesh(new THREE.BoxGeometry(hx * 2 + 0.2, 0.9, hz * 2 + 0.2), M.green);
  fill.position.y = colTop + 0.6;
  g.add(fill);
  beamRing(g, 0, 0, hx, hz, colTop, M, 1.0);
  g.add(buildRoof({ cx: 0, cz: 0, W: hx + 2.2, D: hz + 2.2, rx: hx * 0.55, eaveY: colTop + 1.2, ridgeY: colTop + 4.4, lift: 0.9, ornate: true }));
  const plaque = plaqueMesh(plaqueNames[idx % 2], 2.6);
  plaque.position.set(0, colTop - 0.05, hz + 0.32);
  plaque.rotation.x = -0.08;
  g.add(plaque);
  g.position.set(def.x, 0, def.z);
  g.rotation.y = def.yaw;
  return g;
}

export interface StrikeBuild {
  interactives: THREE.Object3D[];
  strike(): void;
  update(dt: number): void;
  standX: number;
  standZ: number;
  standYaw: number;
}

// 钟鼓楼的亭子：台基、四根红柱、彩画梁、带鸱吻的四坡顶、匾额
function pavilion(T: { x: number; z: number; size: number; platform: number }, name: string, group: THREE.Group) {
  const M = chineseMats();
  const g = new THREE.Group();
  const S = T.size;
  const base = T.platform;
  const plat = mesh(worldBox(S + 1.2, base, S + 1.2, 1), [M.marbleSide, M.marbleSide, M.marble, M.marble, M.marbleSide, M.marbleSide]);
  plat.position.y = base / 2;
  plat.name = 'walkable';
  g.add(plat);
  const colH = 4.8;
  const h = S / 2 - 0.4;
  const colTop = base + colH;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = mesh(meterUV(new THREE.CylinderGeometry(0.25, 0.29, colH, 16), 1.7, colH), M.red);
    c.position.set(sx * h, base + colH / 2, sz * h);
    g.add(c);
    const p = mesh(lathe([[0, 0], [0.45, 0], [0.45, 0.05], [0.36, 0.16], [0, 0.16]], 16), M.marble);
    p.position.set(sx * h, base, sz * h);
    g.add(p);
  }
  beamRing(g, 0, 0, h, h, colTop, M, 0.9, false);
  g.add(buildRoof({ cx: 0, cz: 0, W: h + 1.9, D: h + 1.9, rx: 0.9, eaveY: colTop + 1.2, ridgeY: colTop + 3.8, lift: 0.95, ornate: true }));
  const plaque = plaqueMesh(name, 1.7);
  plaque.position.set(0, colTop - 0.1, h + 0.3);
  g.add(plaque);
  g.position.set(T.x, 0, T.z);
  group.add(g);
  return { g, colTop };
}

function bellTower(group: THREE.Group): StrikeBuild {
  const { g, colTop } = pavilion(BELL, '鐘樓', group);
  const M = chineseMats();
  const hanger = mesh(worldBox(BELL.size - 0.8, 0.34, 0.34, 1), M.red);
  hanger.position.set(0, colTop - 0.5, 0);
  g.add(hanger);
  // 梵钟：波浪钟口、莲瓣、四区佛号铭文、莲花撞座、蒲牢钮，青铜带铜锈
  const bronze = new THREE.MeshStandardMaterial({ color: '#4f5a48', metalness: 0.85, roughness: 0.42 });
  const bell = buildTempleBell();
  bell.position.set(0, colTop - 1.2, 0);
  g.add(bell);
  const chain = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), bronze);
  chain.position.set(0, colTop - 0.92, 0);
  g.add(chain);
  // 撞木
  const logPivot = new THREE.Group();
  logPivot.position.set(-1.25, colTop - 0.5, 0);
  const log = mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.0, 12), M.red);
  log.rotation.z = Math.PI / 2;
  log.position.set(-0.9, -2.27, 0);
  logPivot.add(log);
  const ropeMat = new THREE.LineBasicMaterial({ color: '#c9302a' });
  for (const x of [-1.6, -0.2]) logPivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -2.27, 0)]), ropeMat));
  g.add(logPivot);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 2.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(-0.8, colTop - 2.2, 0);
  hit.userData.interact = { type: 'bell' };
  g.add(hit);

  let swing = 0;
  let sway = 0;
  let phase = 0;
  return {
    interactives: [hit],
    standX: BELL.x - 2.6,
    standZ: BELL.z + 1.0,
    standYaw: Math.PI / 2,
    strike() {
      swing = 1;
    },
    update(dt) {
      if (swing > 0) {
        swing = Math.max(0, swing - dt * 0.9);
        const t = 1 - swing;
        logPivot.rotation.z = t < 0.45 ? -Math.sin((t / 0.45) * Math.PI * 0.5) * 0.35 : -0.35 + Math.sin(((t - 0.45) / 0.55) * Math.PI * 0.5) * 0.47;
        if (t > 0.98 && sway <= 0) sway = 1;
      } else logPivot.rotation.z *= Math.pow(0.1, dt);
      if (sway > 0) {
        sway = Math.max(0, sway - dt * 0.12);
        phase += dt * 3.2;
        bell.rotation.z = Math.sin(phase) * 0.025 * sway;
      }
    },
  };
}

function drumTower(group: THREE.Group): StrikeBuild {
  const { g } = pavilion(DRUM, '鼓樓', group);
  const M = chineseMats();
  // 大鼓：红色鼓身、一圈金色鼓钉，鼓面朝左右，架在红木鼓架上
  const drum = new THREE.Group();
  const body = mesh(lathe([[0, -0.62], [0.95, -0.62], [1.1, -0.3], [1.15, 0], [1.1, 0.3], [0.95, 0.62], [0, 0.62]], 36), M.red);
  body.rotation.z = Math.PI / 2;
  drum.add(body);
  const headMat = new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 0.7 });
  for (const s of [-1, 1]) {
    const head = mesh(new THREE.CircleGeometry(0.94, 32), headMat);
    head.rotation.y = (s * Math.PI) / 2;
    head.position.x = s * 0.625;
    drum.add(head);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const nail = mesh(new THREE.SphereGeometry(0.035, 6, 4), M.gold, false);
      nail.position.set(s * 0.56, Math.cos(a) * 0.98, Math.sin(a) * 0.98);
      drum.add(nail);
    }
  }
  drum.position.set(0, DRUM.platform + 1.55, 0);
  g.add(drum);
  const frame: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    for (const sx of [-0.5, 0.5]) {
      const leg = worldBox(0.12, 1.7, 0.12, 1);
      leg.translate(sx, DRUM.platform + 0.85, sz * 0.95);
      frame.push(leg);
    }
    const bar = worldBox(1.2, 0.12, 0.12, 1);
    bar.translate(0, DRUM.platform + 1.2, sz * 0.95);
    frame.push(bar);
  }
  g.add(mesh(mergeGeometries(frame), M.redDark));
  // 鼓槌
  const stickPivot = new THREE.Group();
  stickPivot.position.set(1.15, DRUM.platform + 1.55, 0.25);
  const stick = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 8), M.redDark);
  stick.rotation.z = Math.PI / 2;
  stick.position.x = 0.35;
  stickPivot.add(stick);
  g.add(stickPivot);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, DRUM.platform + 1.4, 0);
  hit.userData.interact = { type: 'drum' };
  g.add(hit);
  let t = 0;
  let shake = 0;
  return {
    interactives: [hit],
    standX: DRUM.x + 1.9,
    standZ: DRUM.z + 0.3,
    standYaw: -Math.PI / 2,
    strike() {
      t = 1;
    },
    update(dt) {
      if (t > 0) {
        t = Math.max(0, t - dt * 1.6);
        const k = 1 - t;
        stickPivot.rotation.y = k < 0.5 ? -k * 1.4 : -(1 - k) * 1.4;
        if (k > 0.48 && shake <= 0) shake = 1;
      }
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 2);
        drum.position.x = Math.sin(shake * 40) * 0.01 * shake;
      }
    },
  };
}

export function buildBuildings(scene: THREE.Scene) {
  const group = new THREE.Group();
  SIDE_HALLS.forEach((d, i) => group.add(sideHall(d, i)));
  const bell = bellTower(group);
  const drum = drumTower(group);
  scene.add(group);
  return { group, bell, drum };
}
