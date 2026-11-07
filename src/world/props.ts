// 院中陈设（汉传佛寺）：红灯笼与宫灯、八角七层楼阁塔、铜鼎香炉与烛台架、石凳、
// 黄色寺墙、三开间山门、放生池上的石拱桥
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALL, COURT, INCENSE, PAGODAS, STONE_LANTERNS, BENCHES, BENCH_SEATS, GROUND_LAMPS, BRIDGE } from '../layout';
import { plaqueTexture, rng } from '../textures';
import { mesh, worldBox, lathe } from './util';
import { buildRoof, beamRing, chineseMats, meterUV } from './hall';
import { IncenseSpot, type IncenseView } from './incense';
import { pbr } from './pbr';
import { buildDing } from './bronze';
import { buildNightLights } from './nightlights';

export interface PropsBuild {
  interactives: THREE.Object3D[];
  setLanternLevel(level: number): void;
  setIncense(list: IncenseView[]): void;
  update(dt: number, t: number): void;
}

// 灯笼的发光颜色跟着实例颜色走
function glowMaterial(base: THREE.MeshStandardMaterialParameters) {
  const mat = new THREE.MeshStandardMaterial({ ...base, emissive: '#ffffff', emissiveIntensity: 0.3 });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'
    );
  };
  return mat;
}

function lanternTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(120,40,30,0.35)';
  for (let x = 0; x < 256; x += 21) g.fillRect(x, 0, 3, 128);
  g.strokeStyle = 'rgba(240,200,90,0.9)';
  g.lineWidth = 5;
  for (const cx of [64, 192]) {
    g.beginPath();
    g.arc(cx, 64, 26, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(240,200,90,0.95)';
    g.font = '700 34px "Songti SC","STSong","Noto Serif CJK SC",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('福', cx, 66);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildProps(scene: THREE.Scene): PropsBuild {
  const M = chineseMats();
  const group = new THREE.Group();
  const r = rng(202);
  const interactives: THREE.Object3D[] = [];
  const stoneMat = pbr('granite', { metersPerTile: 1.5, color: '#c9c4ba' });

  // —— 红灯笼：参道两侧的灯绳、大殿屋檐下每间一盏大的、灯柱上各一盏 ——
  type L = { p: THREE.Vector3; s: number };
  const lanterns: L[] = [];
  const wireMat = new THREE.LineBasicMaterial({ color: '#3a2e26' });
  const poleZ = [11, 17.5, 24, 30.5, 37, 43.5];
  for (const sx of [-1, 1]) {
    const x = sx * 2.75;
    for (const z of poleZ) {
      const pole = mesh(meterUV(new THREE.CylinderGeometry(0.06, 0.07, 3.9, 8), 0.4, 3.9), M.red);
      pole.position.set(x, 1.95, z);
      group.add(pole);
    }
    for (let i = 0; i < poleZ.length - 1; i++) {
      const za = poleZ[i], zb = poleZ[i + 1];
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 16; k++) {
        const tt = k / 16;
        pts.push(new THREE.Vector3(x, 3.85 - Math.sin(tt * Math.PI) * 0.25, za + (zb - za) * tt));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      for (let k = 1; k < 5; k++) {
        const tt = k / 5;
        lanterns.push({ p: new THREE.Vector3(x, 3.85 - Math.sin(tt * Math.PI) * 0.25 - 0.45, za + (zb - za) * tt), s: 0.8 });
      }
    }
  }
  for (let i = 0; i < HALL.colX.length - 1; i++) {
    const x = (HALL.colX[i] + HALL.colX[i + 1]) / 2;
    lanterns.push({ p: new THREE.Vector3(x, HALL.baseH + HALL.colH - 0.9, HALL.colZFront + 1.2), s: 1.9 });
  }
  for (const [x, z] of STONE_LANTERNS) {
    const post = mesh(meterUV(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), 0.5, 2.6), M.red);
    post.position.set(x, 1.3, z);
    group.add(post);
    const arm = mesh(worldBox(0.7, 0.08, 0.08, 1), M.redDark);
    arm.position.set(x - Math.sign(x) * 0.3, 2.55, z);
    group.add(arm);
    lanterns.push({ p: new THREE.Vector3(x - Math.sign(x) * 0.55, 2.1, z), s: 1.1 });
  }
  const lanternMat = glowMaterial({ map: lanternTexture(), roughness: 0.6 });
  const lanternGeo = new THREE.SphereGeometry(0.2, 16, 12);
  lanternGeo.scale(1, 0.85, 1);
  const lm = new THREE.InstancedMesh(lanternGeo, lanternMat, lanterns.length);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), M.gold, lanterns.length * 2);
  const tassels = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, 0.035, 0.26, 6), new THREE.MeshStandardMaterial({ color: '#b51f18', roughness: 0.8 }), lanterns.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const strings: number[] = [];
  lanterns.forEach((L, i) => {
    const sc = new THREE.Vector3(L.s, L.s, L.s);
    m4.compose(L.p, q, sc);
    lm.setMatrixAt(i, m4);
    lm.setColorAt(i, new THREE.Color(r() > 0.12 ? '#d42a1c' : '#e0a030'));
    m4.compose(L.p.clone().add(new THREE.Vector3(0, 0.17 * L.s, 0)), q, sc);
    caps.setMatrixAt(i * 2, m4);
    m4.compose(L.p.clone().add(new THREE.Vector3(0, -0.17 * L.s, 0)), q, sc);
    caps.setMatrixAt(i * 2 + 1, m4);
    m4.compose(L.p.clone().add(new THREE.Vector3(0, -0.32 * L.s, 0)), q, sc);
    tassels.setMatrixAt(i, m4);
    strings.push(L.p.x, L.p.y + 0.19 * L.s, L.p.z, L.p.x, L.p.y + 0.45, L.p.z);
  });
  group.add(lm, caps, tassels);
  const stringGeo = new THREE.BufferGeometry();
  stringGeo.setAttribute('position', new THREE.Float32BufferAttribute(strings, 3));
  group.add(new THREE.LineSegments(stringGeo, wireMat));
  const pathLights = [new THREE.PointLight('#ff9a6a', 0, 14, 1.5), new THREE.PointLight('#ff9a6a', 0, 14, 1.5)];
  pathLights[0].position.set(0, 3.4, 18);
  pathLights[1].position.set(0, 3.4, 36);
  group.add(...pathLights);

  // —— 宫灯：六角红框、黄绢灯罩，立在矮红柱上 ——
  const silk = new THREE.MeshStandardMaterial({ color: '#f2d79a', roughness: 0.85, emissive: '#ffcf80', emissiveIntensity: 0.2, side: THREE.DoubleSide });
  const lampFrame: THREE.BufferGeometry[] = [];
  const lampSilk: THREE.BufferGeometry[] = [];
  for (const [x, z] of GROUND_LAMPS) {
    const post = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 8);
    post.translate(x, 0.45, z);
    lampFrame.push(post);
    const shade = new THREE.CylinderGeometry(0.22, 0.22, 0.42, 6, 1, true);
    shade.translate(x, 0.9 + 0.21, z);
    lampSilk.push(shade);
    for (const y of [0.9, 1.32]) {
      const ring = new THREE.CylinderGeometry(0.26, 0.26, 0.05, 6);
      ring.translate(x, y, z);
      lampFrame.push(ring);
    }
    const top = new THREE.ConeGeometry(0.28, 0.16, 6);
    top.translate(x, 1.42, z);
    lampFrame.push(top);
  }
  group.add(mesh(mergeGeometries(lampFrame.map((g) => g.toNonIndexed())), M.red));
  group.add(mesh(mergeGeometries(lampSilk), silk, false));

  // —— 八角七层楼阁塔：每层塔身 + 一圈出檐，顶上塔刹 ——
  const towerMat = pbr('plaster', { metersPerTile: 1.6, color: '#d8cfbf' });
  const towerRoof = pbr('roof', { metersPerTile: 1.2, color: '#6e7270' });
  const pagodaLampMat = new THREE.MeshStandardMaterial({ color: '#d63a22', roughness: 0.6, emissive: '#ff6a2a', emissiveIntensity: 0.1 });
  const pagodaLampGeo = new THREE.SphereGeometry(0.075, 10, 8).scale(1, 1.3, 1);
  for (const P of PAGODAS) {
    const g = new THREE.Group();
    const lampAt: THREE.Vector3[] = [];
    const baseG = mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.7, 8), stoneMat);
    baseG.position.y = 0.35;
    g.add(baseG);
    let y = 0.7;
    for (let k = 0; k < 7; k++) {
      const rr = 1.3 * (1 - k * 0.075);
      const hh = k === 0 ? 1.7 : 1.05 - k * 0.04;
      const body = mesh(new THREE.CylinderGeometry(rr, rr, hh, 8), towerMat);
      body.position.y = y + hh / 2;
      g.add(body);
      for (let d = 0; d < 4; d++) {
        const a = (d / 4) * Math.PI * 2 + Math.PI / 8;
        const win = mesh(new THREE.PlaneGeometry(rr * 0.45, hh * 0.55), M.redDark, false);
        win.position.set(Math.cos(a) * (rr * 0.93), y + hh * 0.48, Math.sin(a) * (rr * 0.93));
        win.lookAt(win.position.x * 2, win.position.y, win.position.z * 2);
        g.add(win);
      }
      y += hh;
      const eave = new THREE.CylinderGeometry(rr * 0.9, rr * 1.55, 0.32, 8, 1);
      const pos = eave.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < 0) {
          const ang = Math.atan2(pos.getZ(i), pos.getX(i));
          const corner = Math.abs(Math.cos(((ang - Math.PI / 8) * 8) / 2));
          pos.setY(i, pos.getY(i) + corner * 0.12);
        }
      }
      eave.computeVertexNormals();
      for (let c = 0; c < 8; c++) {
        const th = (c / 8) * Math.PI * 2;
        lampAt.push(new THREE.Vector3(Math.sin(th) * rr * 1.48, y - 0.2, Math.cos(th) * rr * 1.48));
      }
      const em = mesh(eave, towerRoof);
      em.position.y = y + 0.1;
      g.add(em);
      const bracket = mesh(new THREE.CylinderGeometry(rr * 1.05, rr, 0.16, 8), M.red);
      bracket.position.y = y - 0.06;
      g.add(bracket);
      y += 0.26;
    }
    const spire = new THREE.Group();
    spire.add(mesh(lathe([[0, 0], [0.45, 0], [0.42, 0.25], [0, 0.32]], 12), M.gold));
    for (let k = 0; k < 7; k++) {
      const ring = mesh(new THREE.TorusGeometry(0.2 - k * 0.012, 0.04, 6, 16), M.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.45 + k * 0.16;
      spire.add(ring);
    }
    const pole = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6), M.gold);
    pole.position.y = 1.0;
    spire.add(pole);
    const pearl = mesh(new THREE.SphereGeometry(0.14, 12, 10), M.gold);
    pearl.position.y = 1.85;
    spire.add(pearl);
    spire.position.y = y;
    g.add(spire);
    {
      const lamps = new THREE.InstancedMesh(pagodaLampGeo, pagodaLampMat, lampAt.length);
      const m4 = new THREE.Matrix4();
      lampAt.forEach((p, i) => lamps.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
      g.add(lamps);
    }
    g.scale.setScalar(P.s * 0.75);
    g.position.set(P.x, 0, P.z);
    group.add(g);
  }

  // —— 院中铜鼎香炉：青铜三足鼎（立耳、扉棱、兽面足、铭文），立在八角石座上；两旁是阶梯烛台 ——
  const ding = buildDing({ front: '靜山禪寺', back: '風調雨順', base: true, stoneMat, stubs: 80 });
  const burner = ding.group;
  burner.position.set(INCENSE.x, 0.18, INCENSE.z);
  burner.traverse((o) => (o.userData.interact = { type: 'incense' }));
  group.add(burner);
  interactives.push(burner);
  const yardIncense = new IncenseSpot(group, INCENSE.x, 0.18 + ding.ashY, INCENSE.z, 0.68, 24, 0.45);
  const flames: THREE.Mesh[] = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd27e' });
  const candleMat = new THREE.MeshStandardMaterial({ color: '#b3201a', roughness: 0.45, emissive: '#3a0805', emissiveIntensity: 0.5 });
  const waxMat = new THREE.MeshStandardMaterial({ color: '#d0392c', roughness: 0.35, emissive: '#3a0805', emissiveIntensity: 0.4 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#2a2420', metalness: 0.55, roughness: 0.55 });
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,214,140,0.9)');
    grd.addColorStop(0.35, 'rgba(255,170,80,0.35)');
    grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const sx of [-1, 1]) {
    // 三层阶梯式铁烛台：每层一道接蜡的铜槽，红烛高低错落，烛泪挂在烛身上
    const rack = new THREE.Group();
    const frame: THREE.BufferGeometry[] = [];
    for (const lx of [-0.86, 0.86]) {
      const side = new THREE.Shape();
      side.moveTo(-0.3, 0);
      side.lineTo(0.3, 0);
      side.lineTo(0.3, 0.12);
      side.lineTo(0.18, 0.78);
      side.lineTo(0.02, 0.98);
      side.lineTo(-0.14, 1.18);
      side.lineTo(-0.3, 1.2);
      side.closePath();
      const eg = new THREE.ExtrudeGeometry(side, { depth: 0.04, bevelEnabled: false });
      eg.rotateY(-Math.PI / 2);
      eg.translate(lx + 0.02, 0, 0);
      frame.push(eg.toNonIndexed());
    }
    const tiers = [
      { y: 0.76, z: 0.17 },
      { y: 0.96, z: 0.0 },
      { y: 1.16, z: -0.17 },
    ];
    for (const t of tiers) {
      frame.push(new THREE.BoxGeometry(1.72, 0.035, 0.2).translate(0, t.y, t.z).toNonIndexed());
      frame.push(new THREE.BoxGeometry(1.72, 0.07, 0.02).translate(0, t.y + 0.02, t.z + 0.1).toNonIndexed());
    }
    rack.add(mesh(mergeGeometries(frame)!, ironMat));
    const trays: THREE.BufferGeometry[] = [];
    const candles: THREE.BufferGeometry[] = [];
    const drips: THREE.BufferGeometry[] = [];
    tiers.forEach((t, ti) => {
      trays.push(new THREE.BoxGeometry(1.66, 0.012, 0.17).translate(0, t.y + 0.024, t.z).toNonIndexed());
      for (let k = 0; k < 8; k++) {
        const h = 0.1 + r() * 0.22 - ti * 0.02;
        const x = -0.72 + k * 0.205 + (r() - 0.5) * 0.04;
        const z = t.z + (r() - 0.5) * 0.06;
        const y0 = t.y + 0.03;
        candles.push(new THREE.CylinderGeometry(0.026, 0.028, h, 10).translate(x, y0 + h / 2, z).toNonIndexed());
        // 顶上一圈熔开的蜡，身上两三道烛泪
        drips.push(new THREE.TorusGeometry(0.024, 0.007, 5, 12).rotateX(Math.PI / 2).translate(x, y0 + h - 0.004, z).toNonIndexed());
        for (let d = 0; d < 2; d++) {
          const a = r() * Math.PI * 2, dl = 0.03 + r() * 0.06;
          drips.push(new THREE.CapsuleGeometry(0.006, dl, 3, 5).translate(x + Math.cos(a) * 0.027, y0 + h - dl / 2 - 0.01, z + Math.sin(a) * 0.027).toNonIndexed());
        }
        drips.push(new THREE.CylinderGeometry(0.04, 0.045, 0.008, 10).translate(x, y0 + 0.004, z).toNonIndexed());
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), flameMat);
        fl.scale.set(1, 2.2, 1);
        fl.position.set(x, y0 + h + 0.035, z);
        rack.add(fl);
        flames.push(fl);
        const glow = new THREE.Sprite(glowMat);
        glow.scale.setScalar(0.16);
        glow.position.copy(fl.position);
        rack.add(glow);
      }
    });
    rack.add(mesh(mergeGeometries(trays)!, M.bronze, false));
    rack.add(mesh(mergeGeometries(candles)!, candleMat, false));
    rack.add(mesh(mergeGeometries(drips)!, waxMat, false));
    rack.position.set(INCENSE.x + sx * 2.6, 0, INCENSE.z - 0.4);
    group.add(rack);
  }

  // —— 石凳 ——
  for (const b of BENCHES) {
    const g = new THREE.Group();
    const top = mesh(worldBox(2.2, 0.14, 0.55, 1), stoneMat);
    top.position.y = 0.4;
    g.add(top);
    for (const lx of [-0.8, 0.8]) {
      const leg = mesh(worldBox(0.3, 0.34, 0.45, 1), stoneMat);
      leg.position.set(lx, 0.17, 0);
      g.add(leg);
    }
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.yaw;
    group.add(g);
  }
  for (const s of BENCH_SEATS) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 0.75), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.x, 0.45, s.z);
    hit.rotation.y = s.yaw;
    hit.userData.interact = { type: 'seat', id: s.id };
    group.add(hit);
    interactives.push(hit);
  }

  // —— 放生池上的石拱桥（带白石栏杆）——
  {
    const len = BRIDGE.z1 - BRIDGE.z0;
    const w = BRIDGE.x1 - BRIDGE.x0;
    const seg = 24;
    const deck: number[] = [];
    const idx: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const z = BRIDGE.z0 + t * len;
      const y = BRIDGE.h * Math.sin(t * Math.PI);
      deck.push(BRIDGE.x0, y + 0.02, z, BRIDGE.x1, y + 0.02, z);
      uv.push(0, t * len, w, t * len);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(deck, 3));
    dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    dg.setIndex(idx);
    dg.computeVertexNormals();
    const deckMat = stoneMat.clone();
    deckMat.side = THREE.DoubleSide;
    const deckMesh = mesh(dg, deckMat);
    deckMesh.name = 'walkable';
    group.add(deckMesh);
    const sideMat = stoneMat.clone();
    sideMat.side = THREE.DoubleSide;
    for (const x of [BRIDGE.x0, BRIDGE.x1]) {
      const s = new THREE.Shape();
      s.moveTo(0, -0.8);
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        s.lineTo(t * len, BRIDGE.h * Math.sin(t * Math.PI) + 0.02);
      }
      s.lineTo(len, -0.8);
      s.closePath();
      const hole = new THREE.Path();
      hole.absarc(len / 2, -0.8, len * 0.18, 0, Math.PI, false);
      hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ShapeGeometry(s, 24);
      g.rotateY(-Math.PI / 2);
      const side = mesh(g, sideMat);
      side.position.set(x, 0, BRIDGE.z0);
      group.add(side);
    }
    const rail: THREE.BufferGeometry[] = [];
    for (const x of [BRIDGE.x0 + 0.08, BRIDGE.x1 - 0.08]) {
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const z = BRIDGE.z0 + t * len;
        const y = BRIDGE.h * Math.sin(t * Math.PI);
        const p = worldBox(0.16, 0.85, 0.16, 1);
        p.translate(x, y + 0.42, z);
        rail.push(p);
        if (i < 8) {
          const t2 = (i + 1) / 8;
          const zb = BRIDGE.z0 + t2 * len;
          const y2 = BRIDGE.h * Math.sin(t2 * Math.PI);
          const segLen = Math.hypot(zb - z, y2 - y);
          const bar = worldBox(0.1, 0.45, segLen, 1);
          bar.rotateX(-Math.atan2(y2 - y, zb - z));
          bar.translate(x, (y + y2) / 2 + 0.35, (z + zb) / 2);
          rail.push(bar);
        }
      }
    }
    group.add(mesh(mergeGeometries(rail), stoneMat));
  }

  // —— 黄色寺墙（灰瓦顶）——
  const wallMat = pbr('plaster', { metersPerTile: 2.6, color: '#d9a548' });
  const capMat = pbr('roof', { metersPerTile: 1.6, color: '#6e7270' });
  const addWall = (xa: number, za: number, xb: number, zb: number) => {
    const len = Math.hypot(xb - xa, zb - za);
    const ang = Math.atan2(zb - za, xb - xa);
    const w = mesh(worldBox(len, 2.2, 0.5, 1), wallMat);
    w.position.set((xa + xb) / 2, 1.1, (za + zb) / 2);
    w.rotation.y = -ang;
    group.add(w);
    const foot = mesh(worldBox(len, 0.4, 0.6, 1), stoneMat);
    foot.position.set((xa + xb) / 2, 0.2, (za + zb) / 2);
    foot.rotation.y = -ang;
    group.add(foot);
    const capGeo = new THREE.CylinderGeometry(0.6, 0.6, len, 3, 1);
    capGeo.rotateZ(Math.PI / 2);
    const cuv = capGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 2, cuv.getY(i) * len);
    const cap = mesh(capGeo, capMat);
    cap.scale.set(1, 0.42, 1);
    cap.position.set((xa + xb) / 2, 2.35, (za + zb) / 2);
    cap.rotation.y = -ang;
    group.add(cap);
  };
  const { x0, x1, z0, z1, gateX } = COURT;
  addWall(x0, z0, x1, z0);
  addWall(x0, z0, x0, z1);
  addWall(x1, z0, x1, z1);
  addWall(x0, z1, -gateX - 2.4, z1);
  addWall(gateX + 2.4, z1, x1, z1);

  // —— 山门：三开间，朱红柱，彩画梁，带鸱吻的屋顶，挂寺名匾 ——
  {
    const g = new THREE.Group();
    const xs = [-gateX - 2.2, -gateX, gateX, gateX + 2.2];
    const colH = 4.6;
    for (const x of xs) {
      const c = mesh(meterUV(new THREE.CylinderGeometry(0.27, 0.3, colH, 16), 1.8, colH), M.red);
      c.position.set(x, colH / 2, z1);
      g.add(c);
      const p = mesh(lathe([[0, 0], [0.48, 0], [0.48, 0.06], [0.38, 0.2], [0, 0.2]], 16), M.marble);
      p.position.set(x, 0, z1);
      g.add(p);
    }
    for (const s of [-1, 1]) {
      const w = mesh(worldBox(1.8, colH - 0.3, 0.4, 1), M.redWall);
      w.position.set(s * (gateX + 1.1), (colH - 0.3) / 2, z1);
      g.add(w);
    }
    beamRing(g, 0, z1, gateX + 2.2, 0.6, colH, M, 0.9, false);
    g.add(buildRoof({ cx: 0, cz: z1, W: gateX + 4.0, D: 2.4, rx: gateX + 1.2, eaveY: colH + 1.15, ridgeY: colH + 3.0, lift: 0.7, ornate: true }));
    const pw = 3.6;
    const ph = pw * (340 / (260 * 4 + 140));
    const plaque = mesh(new THREE.BoxGeometry(pw, ph, 0.12), [M.gold, M.gold, M.gold, M.gold, new THREE.MeshStandardMaterial({ map: plaqueTexture('靜山禪寺'), roughness: 0.5, metalness: 0.2 }), M.redDark]);
    plaque.position.set(0, colH - 0.75, z1 + 0.3);
    g.add(plaque);
    group.add(g);
  }

  scene.add(group);
  const night = buildNightLights(scene);

  return {
    interactives,
    setLanternLevel(level) {
      night.setLevel(level);
      pagodaLampMat.emissiveIntensity = 0.1 + Math.max(0, (level - 0.6) / 1.8) * 2.4;
      lanternMat.emissiveIntensity = 0.25 + level * 0.9;
      silk.emissiveIntensity = 0.15 + level * 0.8;
      for (const l of pathLights) l.intensity = Math.max(0, level - 0.8) * 7;
    },
    setIncense(list) {
      yardIncense.set(list);
    },
    update(dt, t) {
      yardIncense.update(dt, t);
      for (const [i, f] of flames.entries()) f.scale.set(1, 2.2 + Math.sin(t * 9 + i * 1.7) * 0.3, 1);
    },
  };
}
