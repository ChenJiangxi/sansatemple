// 院中陈设：莲花灯、石灯、石塔、香炉与香烟、长椅、围墙、山门
import * as THREE from 'three';
import { HALL, COURT, INCENSE, PAGODAS, STONE_LANTERNS, BENCHES, BENCH_SEATS, GROUND_LAMPS } from '../layout';
import { IncenseSpot, type IncenseView } from './incense';
import { pbr } from './pbr';
import { stoneTexture, woodTexture, roofTexture, lanternTexture, rng } from '../textures';
import { mesh, worldBox, lathe } from './util';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { buildRoof } from './hall';

const LANTERN_COLORS = ['#f4a3b5', '#f7c1a0', '#fbe3b0', '#f6f0e6', '#f29aa8', '#e9b5d2'];

export interface PropsBuild {
  interactives: THREE.Object3D[];
  setLanternLevel(level: number): void;
  setIncense(list: IncenseView[]): void;
  update(dt: number, t: number): void;
}

function makeLanternMaterial() {
  const mat = new THREE.MeshStandardMaterial({ map: lanternTexture('#ffffff'), roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.3 });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'
    );
  };
  return mat;
}

export function buildProps(scene: THREE.Scene): PropsBuild {
  const group = new THREE.Group();
  const r = rng(202);
  const interactives: THREE.Object3D[] = [];
  const stoneMat = pbr('granite', { metersPerTile: 1.5, color: '#b7b2a8' });
  const woodMat = pbr('wood', { metersPerTile: 1.2, color: '#8a7462' });
  const darkWood = pbr('wood', { metersPerTile: 1.2, color: '#4a3b31' });
  const redWood = pbr('wood', { metersPerTile: 1.6, color: '#5a463a', rotate: true });

  // —— 莲花灯：沿参道两侧的灯绳 + 屋檐下一排 + 殿内几盏 ——
  const lanternPos: THREE.Vector3[] = [];
  const wireMat = new THREE.LineBasicMaterial({ color: '#3a2e26' });
  const poleZ = [11, 17.5, 24, 30.5, 37, 43.5, 50, 56.5, 63];
  for (const sx of [-1, 1]) {
    const x = sx * 2.75;
    for (const z of poleZ) {
      const pole = mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.9, 8), darkWood);
      pole.position.set(x, 1.95, z);
      group.add(pole);
    }
    // 灯绳（略有下垂）
    for (let i = 0; i < poleZ.length - 1; i++) {
      const z0 = poleZ[i], z1 = poleZ[i + 1];
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 16; k++) {
        const tt = k / 16;
        pts.push(new THREE.Vector3(x, 3.85 - Math.sin(tt * Math.PI) * 0.28, z0 + (z1 - z0) * tt));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      for (let k = 1; k < 8; k++) {
        const tt = k / 8;
        lanternPos.push(new THREE.Vector3(x, 3.85 - Math.sin(tt * Math.PI) * 0.28 - 0.36, z0 + (z1 - z0) * tt));
      }
    }
  }
  // 屋檐下
  for (let x = -HALL.wallX - 0.6; x <= HALL.wallX + 0.61; x += 0.9) lanternPos.push(new THREE.Vector3(x, HALL.baseH + HALL.colH - 0.7 + Math.sin(x) * 0.05, HALL.colZFront + 0.7));
  // 殿内
  for (const x of [-11, -7, -3.5, 3.5, 7, 11]) for (const z of [-6.5, -10.5, -14]) lanternPos.push(new THREE.Vector3(x, HALL.baseH + HALL.colH - 0.1, z));

  const lanternMat = makeLanternMaterial();
  const lanternGeo = new THREE.SphereGeometry(0.15, 14, 10);
  lanternGeo.scale(1, 0.85, 1);
  const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, lanternPos.length);
  const tassels = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.018, 0.12, 5), new THREE.MeshStandardMaterial({ color: '#d8c07a', roughness: 0.8 }), lanternPos.length);
  const strings: number[] = [];
  const m4 = new THREE.Matrix4();
  lanternPos.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y, p.z);
    lanterns.setMatrixAt(i, m4);
    lanterns.setColorAt(i, new THREE.Color(LANTERN_COLORS[Math.floor(r() * LANTERN_COLORS.length)]));
    m4.makeTranslation(p.x, p.y - 0.18, p.z);
    tassels.setMatrixAt(i, m4);
    strings.push(p.x, p.y + 0.13, p.z, p.x, p.y + 0.36, p.z);
  });
  lanterns.castShadow = false;
  group.add(lanterns, tassels);
  const stringGeo = new THREE.BufferGeometry();
  stringGeo.setAttribute('position', new THREE.Float32BufferAttribute(strings, 3));
  group.add(new THREE.LineSegments(stringGeo, wireMat));

  const pathLights = [new THREE.PointLight('#ffb07a', 0, 12, 1.5), new THREE.PointLight('#ffb07a', 0, 12, 1.5)];
  pathLights[0].position.set(0, 3.4, 16);
  pathLights[1].position.set(0, 3.4, 40);
  group.add(...pathLights);

  // —— 地上的方形纸灯（木框 + 白纸，夜里发光）——
  const paperGlow = new THREE.MeshStandardMaterial({ color: '#f2ead8', roughness: 0.9, emissive: '#ffd9a0', emissiveIntensity: 0.2 });
  const lampFrame: THREE.BufferGeometry[] = [];
  const lampPaper: THREE.BufferGeometry[] = [];
  const LAMPS = GROUND_LAMPS;

  for (const [x, z] of LAMPS) {
    const post = worldBox(0.1, 0.55, 0.1, 1);
    post.translate(x, 0.275, z);
    lampFrame.push(post);
    const box = worldBox(0.34, 0.46, 0.34, 1);
    box.translate(x, 0.55 + 0.23, z);
    lampPaper.push(box);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bar = worldBox(0.04, 0.5, 0.04, 1);
      bar.translate(x + dx * 0.17, 0.55 + 0.25, z + dz * 0.17);
      lampFrame.push(bar);
    }
    const cap = worldBox(0.46, 0.06, 0.46, 1);
    cap.translate(x, 1.05, z);
    lampFrame.push(cap);
  }
  group.add(mesh(mergeGeometries(lampFrame), darkWood));
  const paperMesh = mesh(mergeGeometries(lampPaper), paperGlow, false);
  group.add(paperMesh);

  // —— 石灯 ——
  const fireMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', emissive: '#ffb066', emissiveIntensity: 0.3 });
  for (const [x, z] of STONE_LANTERNS) {
    const g = new THREE.Group();
    const base = mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 8), stoneMat);
    base.position.y = 0.11;
    const pillar = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.9, 8), stoneMat);
    pillar.position.y = 0.67;
    const tray = mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.14, 8), stoneMat);
    tray.position.y = 1.18;
    const box = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8), fireMat);
    box.position.y = 1.44;
    const cap = mesh(new THREE.ConeGeometry(0.42, 0.24, 8), stoneMat);
    cap.position.y = 1.75;
    const knob = mesh(new THREE.SphereGeometry(0.08, 8, 6), stoneMat);
    knob.position.y = 1.92;
    g.add(base, pillar, tray, box, cap, knob);
    g.position.set(x, 0, z);
    group.add(g);
  }

  // —— 双塔（三层石塔）——
  const pm = pbr('granite', { metersPerTile: 1.6, color: '#b3ada2' });
  for (const P of PAGODAS) {
    const g = new THREE.Group();
    let y = 0;
    const tier = (w: number, h: number) => {
      const b = mesh(worldBox(w, h, w, 1), pm);
      b.position.y = y + h / 2;
      g.add(b);
      y += h;
    };
    tier(2.5, 0.35);
    tier(2.1, 0.55);
    tier(1.8, 0.12);
    const bodyW = [1.0, 0.82, 0.68];
    const bodyH = [0.9, 0.5, 0.42];
    for (let k = 0; k < 3; k++) {
      tier(bodyW[k], bodyH[k]);
      const roofW = bodyW[k] + 0.95;
      const geo = new THREE.BoxGeometry(roofW, 0.16, roofW, 4, 1, 4);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const ax = Math.abs(pos.getX(i)) / (roofW / 2), az = Math.abs(pos.getZ(i)) / (roofW / 2);
        pos.setY(i, pos.getY(i) + Math.pow(ax * az, 3) * 0.12);
      }
      geo.computeVertexNormals();
      const rm = mesh(geo, pm);
      rm.position.y = y + 0.08;
      g.add(rm);
      const steps = mesh(new THREE.BoxGeometry(bodyW[k] + 0.4, 0.1, bodyW[k] + 0.4), pm);
      steps.position.y = y - 0.02;
      g.add(steps);
      y += 0.16;
    }
    const fin = mesh(lathe([[0.12, 0], [0.14, 0.1], [0.06, 0.2], [0.12, 0.32], [0.05, 0.45], [0.09, 0.55], [0.03, 0.75], [0, 0.8]], 12), pm);
    fin.position.y = y;
    g.add(fin);
    g.scale.setScalar(P.s);
    g.position.set(P.x, 0, P.z);
    group.add(g);
  }

  // —— 香炉 ——
  const bronze = new THREE.MeshStandardMaterial({ color: '#5a4a32', metalness: 0.8, roughness: 0.45 });
  const burner = new THREE.Group();
  const bowl = mesh(lathe([[0, 0.45], [0.55, 0.45], [0.72, 0.6], [0.78, 0.85], [0.74, 1.0], [0.82, 1.06], [0.78, 1.1], [0, 1.0]], 32), bronze);
  burner.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.55, 8), bronze);
    leg.position.set(Math.cos(a) * 0.45, 0.27, Math.sin(a) * 0.45);
    burner.add(leg);
  }
  for (const s of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI), bronze);
    handle.position.set(s * 0.72, 1.1, 0);
    handle.rotation.y = Math.PI / 2;
    burner.add(handle);
  }
  const sand = mesh(new THREE.CircleGeometry(0.72, 32), new THREE.MeshStandardMaterial({ color: '#8f8676', roughness: 1 }), false);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 1.02;
  burner.add(sand);
  const pedestal = mesh(worldBox(1.6, 0.18, 1.6, 1.5), stoneMat);
  pedestal.position.y = -0.09;
  burner.add(pedestal);
  burner.position.set(INCENSE.x, 0.18, INCENSE.z);
  burner.traverse((o) => {
    o.userData.interact = { type: 'incense' };
  });
  group.add(burner);
  interactives.push(burner);

  // 香和烟
  const yardIncense = new IncenseSpot(group, INCENSE.x, 0.18 + 1.02, INCENSE.z, 0.72, 24, 0.45);

  // —— 长椅 ——
  for (const b of BENCHES) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const slat = mesh(new THREE.BoxGeometry(2.3, 0.05, 0.11), woodMat);
      slat.position.set(0, 0.44, -0.18 + k * 0.13);
      g.add(slat);
    }
    for (let k = 0; k < 3; k++) {
      const back = mesh(new THREE.BoxGeometry(2.3, 0.08, 0.04), woodMat);
      back.position.set(0, 0.62 + k * 0.15, -0.3);
      back.rotation.x = -0.12;
      g.add(back);
    }
    for (const lx of [-0.98, 0.98]) {
      const leg = mesh(new THREE.BoxGeometry(0.08, 0.44, 0.48), darkWood);
      leg.position.set(lx, 0.22, -0.02);
      g.add(leg);
      const post = mesh(new THREE.BoxGeometry(0.07, 0.55, 0.06), darkWood);
      post.position.set(lx, 0.7, -0.31);
      g.add(post);
    }
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.yaw;
    group.add(g);
  }
  for (const s of BENCH_SEATS) {
    // 透明点击区，方便点中座位
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 0.75), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.x, 0.45, s.z);
    hit.rotation.y = s.yaw;
    hit.userData.interact = { type: 'seat', id: s.id };
    group.add(hit);
    interactives.push(hit);
  }

  // —— 围墙（石墙 + 瓦顶）——
  const wallStone = pbr('stonewall', { metersPerTile: 2.6, color: '#b5afa4' });
  const capMat = pbr('roof', { metersPerTile: 1.6, color: '#8a8c8a' });
  const addWall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    const w = mesh(worldBox(len, 1.25, 0.5, 1), wallStone);
    w.position.set((x0 + x1) / 2, 0.62, (z0 + z1) / 2);
    w.rotation.y = -ang;
    group.add(w);
    const capGeo = new THREE.CylinderGeometry(0.55, 0.55, len, 3, 1);
    capGeo.rotateZ(Math.PI / 2);
    const uv = capGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 2);
    const cap = mesh(capGeo, capMat);
    cap.scale.set(1, 0.45, 1);
    cap.position.set((x0 + x1) / 2, 1.38, (z0 + z1) / 2);
    cap.rotation.y = -ang;
    group.add(cap);
  };
  const { x0, x1, z0, z1, gateX } = COURT;
  addWall(x0, z0, x1, z0);
  addWall(x0, z0, x0, z1);
  addWall(x1, z0, x1, z1);
  addWall(x0, z1, -gateX - 0.4, z1);
  addWall(gateX + 0.4, z1, x1, z1);

  // —— 山门 ——
  {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const c = mesh(new THREE.CylinderGeometry(0.24, 0.27, 3.6, 16), redWood);
      c.position.set(s * gateX, 1.8, z1);
      g.add(c);
      const p = mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.25, 12), stoneMat);
      p.position.set(s * gateX, 0.12, z1);
      g.add(p);
    }
    const beam = mesh(new THREE.BoxGeometry(gateX * 2 + 0.8, 0.4, 0.36), new THREE.MeshStandardMaterial({ color: '#2f6b5b' }));
    beam.position.set(0, 3.5, z1);
    g.add(beam);
    const roof = buildRoof({ cx: 0, cz: z1, W: gateX + 1.5, D: 1.5, rx: gateX - 0.2, eaveY: 3.85, ridgeY: 5.0, lift: 0.35 });
    g.add(roof);
    group.add(g);
  }

  scene.add(group);

  let lanternLevel = 0.3;
  return {
    interactives,
    setLanternLevel(level) {
      lanternLevel = level;
      lanternMat.emissiveIntensity = level;
      fireMat.emissiveIntensity = 0.2 + level * 0.8;
      paperGlow.emissiveIntensity = 0.15 + level * 0.9;
      for (const l of pathLights) l.intensity = Math.max(0, level - 0.8) * 6;
    },
    setIncense(list) {
      yardIncense.set(list);
    },
    update(dt, t) {
      void lanternLevel;
      yardIncense.update(dt, t);
    },
  };
}
