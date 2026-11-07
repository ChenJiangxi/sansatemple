// 配殿与钟楼
import * as THREE from 'three';
import { SIDE_HALLS, BELL } from '../layout';
import { latticeTexture, plaqueTexture } from '../textures';
import { pbr } from './pbr';
import { worldBox, mesh, lathe } from './util';
import { buildRoof } from './hall';

const plaqueNames = ['殿王冥', '堂香心'];

function sideHall(def: (typeof SIDE_HALLS)[number], idx: number, mats: Record<string, THREE.Material>) {
  const g = new THREE.Group();
  const L = def.d; // 面阔（本地 x）
  const D = def.w; // 进深（本地 z）
  const base = 0.6;
  const colH = 4.2;
  const plat = mesh(worldBox(L + 1.6, base, D + 1.6, 1), [mats.side, mats.side, mats.top, mats.top, mats.side, mats.side]);
  plat.position.y = base / 2;
  g.add(plat);
  // 台阶
  for (let k = 0; k < 2; k++) {
    const s = mesh(worldBox(3.2, base * (k + 1) / 2, 0.6 * (2 - k), 1), mats.top);
    s.position.set(0, (base * (k + 1)) / 4, D / 2 + 0.8 + 0.3 * (2 - k));
    g.add(s);
  }
  const hx = L / 2 - 0.4;
  const hz = D / 2 - 0.4;
  const colTop = base + colH;
  const colGeo = new THREE.CylinderGeometry(0.22, 0.25, colH, 14);
  const xs = [-hx, -hx / 2, 0, hx / 2, hx];
  for (const x of xs)
    for (const z of [-hz, hz]) {
      const c = mesh(colGeo, mats.col);
      c.position.set(x, base + colH / 2, z);
      g.add(c);
    }
  for (const z of [-hz / 3, hz / 3])
    for (const x of [-hx, hx]) {
      const c = mesh(colGeo, mats.col);
      c.position.set(x, base + colH / 2, z);
      g.add(c);
    }
  // 正面：下段白墙、上面一排格子门
  const bay = hx / 2;
  for (let i = 0; i < 4; i++) {
    const cx = -hx + bay / 2 + i * bay;
    const door = mesh(new THREE.BoxGeometry(bay - 0.36, colH - 1.3, 0.12), mats.lattice);
    door.position.set(cx, base + 0.6 + (colH - 1.3) / 2, hz);
    const uv = door.geometry.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 2);
    g.add(door);
    const low = mesh(worldBox(bay - 0.36, 0.6, 0.16, 1), mats.plaster);
    low.position.set(cx, base + 0.3, hz);
    g.add(low);
  }
  // 侧墙与后墙
  const back = mesh(worldBox(hx * 2, colH, 0.22, 1), mats.plaster);
  back.position.set(0, base + colH / 2, -hz);
  g.add(back);
  for (const sx of [-1, 1]) {
    const w = mesh(worldBox(0.22, colH, hz * 2, 1), mats.plaster);
    w.position.set(sx * hx, base + colH / 2, 0);
    g.add(w);
  }
  // 门楣以上的墙板与梁
  const top = mesh(worldBox(hx * 2, 0.7, 0.16, 1), mats.plaster);
  top.position.set(0, colTop - 0.35, hz);
  g.add(top);
  for (const z of [-hz, hz]) {
    const geo = new THREE.BoxGeometry(hx * 2 + 0.6, 0.42, 0.34);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (hx * 2) / 3.4);
    const b = mesh(geo, mats.dc);
    b.position.set(0, colTop + 0.15, z);
    g.add(b);
  }
  for (const x of [-hx, hx]) {
    const geo = new THREE.BoxGeometry(0.34, 0.42, hz * 2 + 0.6);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (hz * 2) / 3.4);
    const b = mesh(geo, mats.dc);
    b.position.set(x, colTop + 0.15, 0);
    g.add(b);
  }
  const fill = mesh(new THREE.BoxGeometry(hx * 2 + 0.2, 0.7, hz * 2 + 0.2), mats.band);
  fill.position.y = colTop + 0.65;
  g.add(fill);
  const roof = buildRoof({ cx: 0, cz: 0, W: hx + 2.1, D: hz + 2.1, rx: hx * 0.55, eaveY: colTop + 0.55, ridgeY: colTop + 3.6, lift: 0.7 });
  g.add(roof);
  const plaque = mesh(new THREE.BoxGeometry(2.2, 0.74, 0.08), [mats.trim, mats.trim, mats.trim, mats.trim, new THREE.MeshStandardMaterial({ map: plaqueTexture(plaqueNames[idx % 2]), roughness: 0.6 }), mats.trim]);
  plaque.position.set(0, colTop + 0.6, hz + 0.32);
  plaque.rotation.x = -0.1;
  g.add(plaque);
  g.position.set(def.x, 0, def.z);
  g.rotation.y = def.yaw;
  return g;
}

export interface BellBuild {
  interactives: THREE.Object3D[];
  strike(): void;
  update(dt: number): void;
  standX: number;
  standZ: number;
  standYaw: number;
}

function bellPavilion(mats: Record<string, THREE.Material>, group: THREE.Group): BellBuild {
  const g = new THREE.Group();
  const S = BELL.size;
  const base = BELL.platform;
  const plat = mesh(worldBox(S + 1.2, base, S + 1.2, 1), [mats.side, mats.side, mats.top, mats.top, mats.side, mats.side]);
  plat.position.y = base / 2;
  plat.name = 'walkable';
  g.add(plat);
  const colH = 4.8;
  const h = S / 2 - 0.4;
  const colTop = base + colH;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = mesh(new THREE.CylinderGeometry(0.24, 0.28, colH, 14), mats.col);
    c.position.set(sx * h, base + colH / 2, sz * h);
    g.add(c);
    const p = mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.18, 12), mats.top);
    p.position.set(sx * h, base + 0.09, sz * h);
    g.add(p);
  }
  for (const z of [-h, h]) {
    const geo = new THREE.BoxGeometry(h * 2 + 0.6, 0.4, 0.32);
    const b = mesh(geo, mats.dc);
    b.position.set(0, colTop, z);
    g.add(b);
  }
  for (const x of [-h, h]) {
    const b = mesh(new THREE.BoxGeometry(0.32, 0.4, h * 2 + 0.6), mats.dc);
    b.position.set(x, colTop, 0);
    g.add(b);
  }
  // 挂钟的横梁
  const hanger = mesh(new THREE.BoxGeometry(h * 2, 0.34, 0.34), mats.col);
  hanger.position.set(0, colTop - 0.5, 0);
  g.add(hanger);
  const roof = buildRoof({ cx: 0, cz: 0, W: h + 1.9, D: h + 1.9, rx: 0.5, eaveY: colTop + 0.45, ridgeY: colTop + 2.9, lift: 0.75 });
  g.add(roof);

  // 梵钟
  const bronze = new THREE.MeshStandardMaterial({ color: '#56604c', metalness: 0.85, roughness: 0.42 });
  const bell = new THREE.Group();
  const prof: [number, number][] = [[0, 0.02], [0.88, 0], [0.92, 0.12], [0.86, 0.5], [0.78, 1.2], [0.72, 1.8], [0.62, 2.12], [0.4, 2.25], [0, 2.28]];
  const body = mesh(lathe(prof.map(([r, y]) => [r, y - 2.28]), 40), bronze);
  bell.add(body);
  for (const y of [-2.05, -1.6, -0.6, -0.25]) {
    const ring = mesh(new THREE.TorusGeometry(y < -1 ? 0.9 : 0.66, 0.035, 8, 48), bronze);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    bell.add(ring);
  }
  // 乳头状的小凸起
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const n = mesh(new THREE.SphereGeometry(0.04, 6, 4), bronze, false);
        const aa = a + (c - 1) * 0.12;
        const y = -0.5 - r * 0.14;
        const rr = 0.7 + r * 0.02;
        n.position.set(Math.cos(aa) * rr, y, Math.sin(aa) * rr);
        bell.add(n);
      }
  }
  const hook = mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 16), bronze);
  hook.position.y = 0.12;
  bell.add(hook);
  bell.position.set(0, colTop - 1.2, 0);
  g.add(bell);
  const chain = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), bronze);
  chain.position.set(0, colTop - 0.92, 0);
  g.add(chain);

  // 撞木：用绳子吊着的一根圆木
  const logPivot = new THREE.Group();
  logPivot.position.set(-1.25, colTop - 0.5, 0);
  const log = mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.0, 12), mats.log);
  log.rotation.z = Math.PI / 2;
  log.position.set(-0.9, -2.27, 0);
  logPivot.add(log);
  const ropeMat = new THREE.LineBasicMaterial({ color: '#4a3a2a' });
  for (const x of [-1.6, -0.2]) {
    const pts = [new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -2.27, 0)];
    logPivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));
  }
  g.add(logPivot);

  // 方便点中的透明区域
  const hit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 2.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(-0.8, colTop - 2.2, 0);
  hit.userData.interact = { type: 'bell' };
  g.add(hit);

  g.position.set(BELL.x, 0, BELL.z);
  group.add(g);

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
        // 先往后拉，再撞向钟
        const t = 1 - swing;
        const a = t < 0.45 ? -Math.sin((t / 0.45) * Math.PI * 0.5) * 0.35 : -0.35 + Math.sin(((t - 0.45) / 0.55) * Math.PI * 0.5) * 0.47;
        logPivot.rotation.z = a;
        if (t > 0.98 && sway <= 0) {
          sway = 1;
        }
      } else logPivot.rotation.z *= Math.pow(0.1, dt);
      if (sway > 0) {
        sway = Math.max(0, sway - dt * 0.12);
        phase += dt * 3.2;
        bell.rotation.z = Math.sin(phase) * 0.025 * sway;
      }
    },
  };
}

export function buildBuildings(scene: THREE.Scene) {
  const group = new THREE.Group();
  const mats: Record<string, THREE.Material> = {
    top: pbr('granite', { metersPerTile: 2.4, color: '#a9a49a' }),
    side: pbr('stonewall', { metersPerTile: 3, color: '#b0aaa0' }),
    col: pbr('wood', { metersPerTile: 1.8, color: '#6e5a4c', rotate: true }),
    log: pbr('wood', { metersPerTile: 1.2, color: '#8a7462' }),
    plaster: pbr('plaster', { metersPerTile: 2.5, color: '#e6dfd2' }),
    lattice: new THREE.MeshStandardMaterial({ map: latticeTexture(), roughness: 0.9, emissive: '#f4ead2', emissiveIntensity: 0.12 }),
    dc: pbr('wood', { metersPerTile: 2.2, color: '#5e4c40' }),
    band: pbr('plaster', { metersPerTile: 2.5, color: '#ddd5c6' }),
    trim: new THREE.MeshStandardMaterial({ color: '#b08d4a', metalness: 0.6, roughness: 0.4 }),
  };
  SIDE_HALLS.forEach((d, i) => group.add(sideHall(d, i, mats)));
  const bell = bellPavilion(mats, group);
  scene.add(group);
  return { group, bell };
}
