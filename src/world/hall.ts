// 大殿：台基、台阶、柱网、梁枋、墙、屋顶、佛坛、三尊佛像与蒲团
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { HALL, CUSHIONS, ALTAR_BURNER } from '../layout';
import {
  stoneTexture, stoneBlockTexture, woodTexture, floorTexture, plasterTexture, roofTexture,
  dancheongTexture, latticeTexture, muralTexture, plaqueTexture,
} from '../textures';
import { worldBox, mesh, lathe } from './util';

export interface HallBuild {
  group: THREE.Group;
  walkables: THREE.Object3D[];
  interactives: THREE.Object3D[];
  candleFlames: THREE.Mesh[];
  interiorLights: THREE.PointLight[];
  blockers: THREE.Object3D[]; // 会挡住镜头的部分：柱、墙、屋顶
  altarSandY: number; // 佛前香炉沙面的高度
  statueSlots: { x: number; y: number; z: number; kind: 'main' | 'left' | 'right' }[];
}

function rafterTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2d3a33';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#5b3a2a';
    g.fillRect(i * 32 + 6, 0, 20, 128);
    g.fillStyle = '#3f7a64';
    g.fillRect(i * 32 + 6, 0, 20, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tileEndTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3c3c';
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = '#7b7e7c';
    g.beginPath();
    g.arc(i * 32 + 16, 22, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5c5f5e';
    g.beginPath();
    g.arc(i * 32 + 16, 22, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#2b2d2d';
  g.fillRect(0, 44, 256, 20);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cofferTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#244a3f';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const x = i * 128, y = j * 128;
      g.fillStyle = '#5d2a22';
      g.fillRect(x + 8, y + 8, 112, 112);
      g.fillStyle = '#2f6b5b';
      g.fillRect(x + 16, y + 16, 96, 96);
      g.fillStyle = '#c9583e';
      for (let p = 0; p < 8; p++) {
        const a = (p / 8) * Math.PI * 2;
        g.beginPath();
        g.ellipse(x + 64 + Math.cos(a) * 18, y + 64 + Math.sin(a) * 18, 14, 7, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#e8c56a';
      g.beginPath();
      g.arc(x + 64, y + 64, 9, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function lotusPedestal(mat: THREE.Material, r: number, h: number) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [r * 0.95, 0], [r, h * 0.12], [r * 0.7, h * 0.28], [r * 0.55, h * 0.5], [r * 0.75, h * 0.7], [r, h * 0.88], [r * 1.04, h], [0, h]], 40), mat));
  const petalGeo = new THREE.SphereGeometry(1, 12, 8);
  for (let ring = 0; ring < 2; ring++) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * (Math.PI / n);
      const p = mesh(petalGeo, mat);
      p.scale.set(r * 0.2, h * 0.22, r * 0.07);
      const rr = r * (0.92 - ring * 0.04);
      p.position.set(Math.cos(a) * rr, h * (0.82 - ring * 0.62), Math.sin(a) * rr);
      p.lookAt(0, p.position.y, 0);
      p.rotateX(ring === 0 ? -0.5 : 0.5);
      g.add(p);
    }
  }
  return g;
}

// 带翘角的歇山式屋顶（简化为庑殿式曲面，屋角上翘）
export function buildRoof(opts: { cx: number; cz: number; W: number; D: number; rx: number; eaveY: number; ridgeY: number; lift: number }) {
  const { cx, cz, W, D, rx, eaveY, ridgeY, lift } = opts;
  const yAt = (v: number, au: number) => eaveY + (ridgeY - eaveY) * Math.pow(v, 1.55) + lift * Math.pow(au, 5) * Math.pow(1 - v, 2.2);
  const outward = (au: number, v: number) => 1 + 0.035 * Math.pow(au, 3) * (1 - v); // 屋檐平面也向外弯
  const group = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.85, side: THREE.FrontSide });
  const underMat = new THREE.MeshStandardMaterial({ map: rafterTexture(), roughness: 0.9, side: THREE.BackSide });
  const skirtMat = new THREE.MeshStandardMaterial({ map: tileEndTexture(), roughness: 0.9, side: THREE.DoubleSide });
  const segU = 36, segV = 18;

  const slopes: ((u: number, v: number) => [number, number, number, number, number])[] = [
    (u, v) => { const o = outward(Math.abs(u), v); return [cx + (u * W + (u * rx - u * W) * v) * o, yAt(v, Math.abs(u)), cz + D * (1 - v) * o, u * W * 0.5, v * 4]; },
    (u, v) => { const o = outward(Math.abs(u), v); return [cx - (u * W + (u * rx - u * W) * v) * o, yAt(v, Math.abs(u)), cz - D * (1 - v) * o, u * W * 0.5, v * 4]; },
    (u, v) => { const o = outward(Math.abs(u), v); return [cx + (W + (rx - W) * v) * o, yAt(v, Math.abs(u)), cz - u * D * (1 - v) * o, u * D * 0.5, v * 4]; },
    (u, v) => { const o = outward(Math.abs(u), v); return [cx - (W + (rx - W) * v) * o, yAt(v, Math.abs(u)), cz + u * D * (1 - v) * o, u * D * 0.5, v * 4]; },
  ];

  for (const fn of slopes) {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= segV; j++)
      for (let i = 0; i <= segU; i++) {
        const [x, y, z, a, b] = fn(-1 + (2 * i) / segU, j / segV);
        pos.push(x, y, z);
        uv.push(a, b);
      }
    for (let j = 0; j < segV; j++)
      for (let i = 0; i < segU; i++) {
        const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // 统一让正面朝上
    const n = geo.attributes.normal as THREE.BufferAttribute;
    if (n.getY(Math.floor(segU / 2) + (segU + 1) * 4) < 0) {
      for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
      geo.setIndex(idx);
      geo.computeVertexNormals();
    }
    group.add(mesh(geo, topMat));
    const under = new THREE.Mesh(geo, underMat);
    under.receiveShadow = true;
    group.add(under);

    // 屋檐厚度与瓦当
    const sp: number[] = [];
    const su: number[] = [];
    const si: number[] = [];
    for (let i = 0; i <= segU; i++) {
      const [x, y, z, a] = fn(-1 + (2 * i) / segU, 0);
      sp.push(x, y + 0.05, z, x, y - 0.3, z);
      su.push(a * 0.9, 1, a * 0.9, 0);
    }
    for (let i = 0; i < segU; i++) {
      const a = i * 2;
      si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
    sg.setIndex(si);
    sg.computeVertexNormals();
    group.add(mesh(sg, skirtMat));
  }

  // 正脊与垂脊
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#3c3f3f', roughness: 0.8 });
  const ridge = mesh(new THREE.BoxGeometry(rx * 2 + 0.6, 0.42, 0.5), ridgeMat);
  ridge.position.set(cx, ridgeY + 0.16, cz);
  group.add(ridge);
  const ridgeTop = mesh(new THREE.BoxGeometry(rx * 2 + 0.9, 0.12, 0.62), ridgeMat);
  ridgeTop.position.set(cx, ridgeY + 0.42, cz);
  group.add(ridgeTop);
  for (const s of [-1, 1]) {
    const orn = mesh(new THREE.BoxGeometry(0.4, 0.9, 0.55), ridgeMat);
    orn.position.set(cx + s * (rx + 0.35), ridgeY + 0.5, cz);
    orn.rotation.z = -s * 0.25;
    group.add(orn);
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const v = k / 12;
      const [x, y, z] = slopes[0](sx, v);
      pts.push(new THREE.Vector3(x, y + 0.14, sz > 0 ? z : 2 * cz - z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    group.add(mesh(new THREE.TubeGeometry(curve, 24, 0.15, 6, false), ridgeMat));
    const tip = mesh(new THREE.SphereGeometry(0.2, 10, 8), ridgeMat);
    tip.position.copy(pts[0]).add(new THREE.Vector3(0, 0.1, 0));
    group.add(tip);
  }
  return group;
}

export function buildHall(scene: THREE.Scene): HallBuild {
  const H = HALL;
  const group = new THREE.Group();
  const walkables: THREE.Object3D[] = [];
  const interactives: THREE.Object3D[] = [];
  const candleFlames: THREE.Mesh[] = [];
  const blockers: THREE.Object3D[] = [];

  const stoneTop = stoneTexture(5, '#a39e92');
  const stoneSide = stoneBlockTexture();
  const stoneTopMat = new THREE.MeshStandardMaterial({ map: stoneTop, roughness: 0.9 });
  const stoneSideMat = new THREE.MeshStandardMaterial({ map: stoneSide, roughness: 0.92 });
  const colWood = woodTexture(3, ['#5c2c20', '#47201a', '#6e3829']);
  const colMat = new THREE.MeshStandardMaterial({ map: colWood, roughness: 0.75 });
  const dcTex = dancheongTexture();
  const dcMat = new THREE.MeshStandardMaterial({ map: dcTex, roughness: 0.8 });
  const plaster = plasterTexture();
  const plasterMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.62 });

  // 台基
  const bw = H.baseX1 - H.baseX0;
  const bd = H.baseZ1 - H.baseZ0;
  const base = mesh(worldBox(bw, H.baseH, bd, 3.2), [stoneSideMat, stoneSideMat, stoneTopMat, stoneTopMat, stoneSideMat, stoneSideMat]);
  base.position.set((H.baseX0 + H.baseX1) / 2, H.baseH / 2, (H.baseZ0 + H.baseZ1) / 2);
  base.name = 'walkable';
  group.add(base);
  walkables.push(base);
  // 台基压沿石
  const coping = mesh(worldBox(bw + 0.24, 0.1, bd + 0.24, 2), stoneTopMat);
  coping.position.set(base.position.x, H.baseH - 0.057, base.position.z);
  group.add(coping);

  // 台阶
  const steps = 4;
  const stepDepth = (H.stepZ1 - H.stepZ0) / steps;
  for (let k = 0; k < steps; k++) {
    const top = ((k + 1) / steps) * H.baseH;
    const z0 = H.stepZ0;
    const z1 = H.stepZ1 - k * stepDepth;
    const s = mesh(worldBox(H.stepX1 - H.stepX0, top, z1 - z0, 2.4), [stoneSideMat, stoneSideMat, stoneTopMat, stoneTopMat, stoneTopMat, stoneSideMat]);
    s.position.set(0, top / 2, (z0 + z1) / 2);
    s.name = 'walkable';
    group.add(s);
    walkables.push(s);
  }
  // 台阶两侧的扶石
  for (const sx of [H.stepX0 - 0.22, H.stepX1 + 0.22]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(H.stepZ1 - H.stepZ0 + 0.1, 0);
    shape.lineTo(H.stepZ1 - H.stepZ0 + 0.1, 0.28);
    shape.lineTo(0.2, H.baseH + 0.25);
    shape.lineTo(0, H.baseH + 0.25);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: false });
    const m = mesh(geo, stoneTopMat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(sx - 0.21, 0, H.stepZ0);
    group.add(m);
  }

  // 殿内木地板
  const fw = H.wallX * 2;
  const fd = H.colZFront - H.backZ + 0.6;
  const floor = mesh(new THREE.PlaneGeometry(fw, fd), floorMat, false);
  (floor.material as THREE.MeshStandardMaterial).map!.repeat.set(fw / 4, fd / 4);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, H.baseH + 0.006, (H.colZFront + 0.6 + H.backZ) / 2);
  floor.name = 'walkable';
  group.add(floor);
  walkables.push(floor);

  // 柱子与础石
  const colTop = H.baseH + H.colH;
  const colGeo = new THREE.CylinderGeometry(0.32, 0.37, H.colH, 20);
  const plinthGeo = new THREE.CylinderGeometry(0.5, 0.56, 0.18, 16);
  const columns: [number, number][] = [];
  for (const x of H.colX) columns.push([x, H.colZFront], [x, H.colZBack]);
  for (const z of H.colZSide) columns.push([-H.wallX, z], [H.wallX, z]);
  for (const [x, z] of columns) {
    const c = mesh(colGeo, colMat);
    c.position.set(x, H.baseH + H.colH / 2, z);
    group.add(c);
    blockers.push(c);
    const p = mesh(plinthGeo, stoneTopMat);
    p.position.set(x, H.baseH + 0.08, z);
    group.add(p);
  }

  // 梁枋（丹青彩画）+ 斗拱带
  const beamH = 0.5;
  const bandDefs: { x: number; z: number; len: number; alongX: boolean }[] = [
    { x: 0, z: H.colZFront, len: H.wallX * 2 + 0.7, alongX: true },
    { x: 0, z: H.colZBack, len: H.wallX * 2 + 0.7, alongX: true },
    { x: -H.wallX, z: (H.colZFront + H.colZBack) / 2, len: H.colZFront - H.colZBack + 0.7, alongX: false },
    { x: H.wallX, z: (H.colZFront + H.colZBack) / 2, len: H.colZFront - H.colZBack + 0.7, alongX: false },
  ];
  const bracketMatA = new THREE.MeshStandardMaterial({ color: '#2f6b5b', roughness: 0.8 });
  const bracketMatB = new THREE.MeshStandardMaterial({ color: '#a8473a', roughness: 0.8 });
  const bracketGeo = new THREE.BoxGeometry(0.26, 0.2, 0.9);
  const bracketGeo2 = new THREE.BoxGeometry(0.6, 0.16, 0.3);
  for (const b of bandDefs) {
    const geo = b.alongX ? new THREE.BoxGeometry(b.len, beamH, 0.42) : new THREE.BoxGeometry(0.42, beamH, b.len);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * b.len / 3.6);
    dcTex.wrapS = THREE.RepeatWrapping;
    const beam = mesh(geo, dcMat);
    beam.position.set(b.x, colTop - beamH / 2 + 0.02, b.z);
    group.add(beam);
    const beam2 = mesh(geo, dcMat);
    beam2.position.set(b.x, colTop + 0.32, b.z);
    beam2.scale.set(b.alongX ? 1 : 1.1, 0.6, b.alongX ? 1.1 : 1);
    group.add(beam2);
    // 斗拱
    const n = Math.floor(b.len / 0.9);
    for (let i = 0; i <= n; i++) {
      const off = -b.len / 2 + 0.35 + (i * (b.len - 0.7)) / n;
      const bx = b.alongX ? b.x + off : b.x;
      const bz = b.alongX ? b.z : b.z + off;
      const br = mesh(bracketGeo, i % 2 ? bracketMatA : bracketMatB);
      br.position.set(bx, colTop + 0.6, bz);
      if (!b.alongX) br.rotation.y = Math.PI / 2;
      group.add(br);
      const br2 = mesh(bracketGeo2, bracketMatA);
      br2.position.set(bx, colTop + 0.78, bz);
      if (!b.alongX) br2.rotation.y = Math.PI / 2;
      group.add(br2);
    }
    // 拱眼壁（遮住柱顶到屋檐的空隙）
    const wallGeo = b.alongX ? new THREE.BoxGeometry(b.len - 0.2, 1.0, 0.14) : new THREE.BoxGeometry(0.14, 1.0, b.len - 0.2);
    const pw = mesh(wallGeo, new THREE.MeshStandardMaterial({ color: '#2a5a4d', roughness: 0.9 }));
    pw.position.set(b.x, colTop + 0.85, b.z);
    group.add(pw);
  }
  // 殿内大梁
  for (const x of H.colX.slice(1, -1)) {
    const geo = new THREE.BoxGeometry(0.42, 0.55, H.colZFront - H.colZBack);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 3);
    const beam = mesh(geo, dcMat, false);
    beam.position.set(x, colTop + 0.5, (H.colZFront + H.colZBack) / 2);
    group.add(beam);
  }

  // 天花板（井口天花）
  const coffer = cofferTexture();
  coffer.repeat.set((H.wallX * 2) / 1.6, (H.colZFront - H.colZBack) / 1.6);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(H.wallX * 2, H.colZFront - H.colZBack), new THREE.MeshStandardMaterial({ map: coffer, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, colTop + 0.95, (H.colZFront + H.colZBack) / 2);
  group.add(ceil);

  // 侧墙：下段白墙、中段格子窗、上段白墙
  const lattice = latticeTexture();
  const latticeMat = new THREE.MeshStandardMaterial({ map: lattice, roughness: 0.9, emissive: new THREE.Color('#5a4a2a'), emissiveIntensity: 0.25 });
  const wallLen = H.colZFront - H.backZ - 0.4;
  const wallCz = (H.colZFront - 0.4 + H.backZ) / 2;
  for (const sx of [-1, 1]) {
    const x = sx * H.wallX;
    const lower = mesh(worldBox(0.24, 1.0, wallLen, 2), plasterMat);
    lower.position.set(x, H.baseH + 0.5, wallCz);
    group.add(lower);
    blockers.push(lower);
    const upper = mesh(worldBox(0.24, 0.7, wallLen, 2), plasterMat);
    upper.position.set(x, colTop - 0.35, wallCz);
    group.add(upper);
    blockers.push(upper);
    // 窗框
    const frame = mesh(new THREE.BoxGeometry(0.2, H.colH - 1.7, wallLen), latticeMat);
    frame.position.set(x, H.baseH + 1.0 + (H.colH - 1.7) / 2, wallCz);
    (frame.material as THREE.MeshStandardMaterial).map!.repeat.set(1, 1);
    // 让格子窗按块重复
    const fuv = frame.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < fuv.count; i++) fuv.setX(i, fuv.getX(i) * (wallLen / 1.3));
    group.add(frame);
    blockers.push(frame);
  }
  // 后墙：外侧白墙，内侧壁画
  const back = mesh(worldBox(H.wallX * 2, H.colH, 0.3, 2), plasterMat);
  back.position.set(0, H.baseH + H.colH / 2, H.backZ);
  group.add(back);
  blockers.push(back);
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(H.wallX * 2 - 0.6, H.colH - 0.3), new THREE.MeshStandardMaterial({ map: muralTexture(), roughness: 0.85, emissive: '#3a1a10', emissiveIntensity: 0.3 }));
  mural.position.set(0, H.baseH + H.colH / 2 + 0.1, H.backZ + 0.16);
  group.add(mural);

  // 屋顶
  const roof = buildRoof({ cx: 0, cz: (H.colZFront + H.colZBack) / 2, W: H.wallX + 3.3, D: (H.colZFront - H.colZBack) / 2 + 3.3, rx: H.wallX * 0.48, eaveY: colTop + 0.7, ridgeY: colTop + 5.8, lift: 1.25 });
  roof.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  group.add(roof);
  blockers.push(roof);

  // 匾额
  const plaque = mesh(new THREE.BoxGeometry(4.6, 1.5, 0.14), [
    new THREE.MeshStandardMaterial({ color: '#c9a85a' }), new THREE.MeshStandardMaterial({ color: '#c9a85a' }),
    new THREE.MeshStandardMaterial({ color: '#c9a85a' }), new THREE.MeshStandardMaterial({ color: '#c9a85a' }),
    new THREE.MeshStandardMaterial({ map: plaqueTexture('殿雄大'), roughness: 0.6, emissive: '#222', emissiveIntensity: 0.15 }),
    new THREE.MeshStandardMaterial({ color: '#3a2a20' }),
  ]);
  plaque.position.set(0, colTop + 1.05, H.colZFront + 0.36);
  plaque.rotation.x = -0.12;
  group.add(plaque);

  // 佛坛
  const altarMat = new THREE.MeshStandardMaterial({ color: '#7a2a20', roughness: 0.45 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#c99a45', metalness: 0.8, roughness: 0.35 });
  const aw = H.altarX1 - H.altarX0;
  const ad = H.altarZ1 - H.altarZ0;
  const altar = mesh(new THREE.BoxGeometry(aw, H.altarH, ad), altarMat);
  altar.position.set(0, H.baseH + H.altarH / 2, (H.altarZ0 + H.altarZ1) / 2);
  group.add(altar);
  for (const y of [0.08, H.altarH - 0.06]) {
    const trim = mesh(new THREE.BoxGeometry(aw + 0.12, 0.1, ad + 0.12), trimMat);
    trim.position.set(0, H.baseH + y, altar.position.z);
    group.add(trim);
  }
  // 佛坛正面的格子纹饰
  const panelMat = new THREE.MeshStandardMaterial({ color: '#2f6b5b', roughness: 0.6 });
  for (let i = 0; i < 11; i++) {
    const panel = mesh(new THREE.BoxGeometry(aw / 11 - 0.22, H.altarH - 0.42, 0.04), panelMat, false);
    panel.position.set(H.altarX0 + (i + 0.5) * (aw / 11), H.baseH + H.altarH / 2, H.altarZ1 + 0.01);
    group.add(panel);
  }

  // 三尊佛像的位置（模型由 statues.ts 放上去）
  const altarTop = H.baseH + H.altarH;
  const az = (H.altarZ0 + H.altarZ1) / 2;
  const statueSlots = [
    { x: 0, y: altarTop, z: az - 0.15, kind: 'main' as const },
    { x: -6.2, y: altarTop, z: az, kind: 'left' as const },
    { x: 6.2, y: altarTop, z: az, kind: 'right' as const },
  ];
  // 佛坛上的长明灯与花
  const candleMat = new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.5 });
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
  const addCandle = (x: number, y: number, z: number, h = 0.36) => {
    const holder = mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.4, 12), trimMat);
    holder.position.set(x, y + 0.2, z);
    group.add(holder);
    const candle = mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 12), candleMat);
    candle.position.set(x, y + 0.4 + h / 2, z);
    group.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), flameMat);
    flame.scale.set(1, 2.2, 1);
    flame.position.set(x, y + 0.4 + h + 0.07, z);
    group.add(flame);
    candleFlames.push(flame);
  };
  for (const x of [-9, -3.3, 3.3, 9]) addCandle(x, altarTop, H.altarZ1 - 0.35, 0.3);

  // 供桌：正中一只铜香炉，两侧蜡烛和供果
  const tw = H.tableX1 - H.tableX0;
  const td = H.tableZ1 - H.tableZ0;
  const tz = (H.tableZ0 + H.tableZ1) / 2;
  const table = mesh(new THREE.BoxGeometry(tw, H.tableH, td), altarMat);
  table.position.set(0, H.baseH + H.tableH / 2, tz);
  group.add(table);
  const tableTop = mesh(new THREE.BoxGeometry(tw + 0.16, 0.06, td + 0.16), trimMat);
  tableTop.position.set(0, H.baseH + H.tableH + 0.03, tz);
  group.add(tableTop);
  const cloth = mesh(new THREE.PlaneGeometry(tw * 0.62, H.tableH - 0.12), new THREE.MeshStandardMaterial({ color: '#c9a44a', roughness: 0.7, side: THREE.DoubleSide }), false);
  cloth.position.set(0, H.baseH + H.tableH / 2, H.tableZ1 + 0.012);
  group.add(cloth);
  const ttop = H.baseH + H.tableH + 0.06;
  for (const x of [-2.9, 2.9]) addCandle(x, ttop, tz);
  const bronze = new THREE.MeshStandardMaterial({ color: '#6b5432', metalness: 0.85, roughness: 0.38 });
  const burner = new THREE.Group();
  burner.add(mesh(lathe([[0, 0], [0.2, 0], [0.16, 0.08], [0.3, 0.14], [0.36, 0.3], [0.33, 0.4], [0.37, 0.43], [0, 0.4]], 32), bronze));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const leg = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 8), bronze);
    leg.position.set(Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2);
    burner.add(leg);
  }
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), bronze);
    ear.position.set(sx * 0.32, 0.45, 0);
    ear.rotation.y = Math.PI / 2;
    burner.add(ear);
  }
  const ash = mesh(new THREE.CircleGeometry(0.33, 24), new THREE.MeshStandardMaterial({ color: '#9a9284', roughness: 1 }), false);
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.41;
  burner.add(ash);
  burner.position.set(ALTAR_BURNER.x, ttop, ALTAR_BURNER.z);
  burner.traverse((o) => (o.userData.interact = { type: 'altarIncense' }));
  group.add(burner);
  interactives.push(burner);
  // 透明点击区：点供桌前方也算
  const burnerHit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  burnerHit.position.set(0, H.baseH + 0.9, tz + 0.2);
  burnerHit.userData.interact = { type: 'altarIncense' };
  group.add(burnerHit);
  interactives.push(burnerHit);
  const altarSandY = ttop + 0.41;
  const bowlMat = new THREE.MeshStandardMaterial({ color: '#b9924a', metalness: 0.7, roughness: 0.4 });
  const fruitMats = ['#d8752a', '#c43f2b', '#e2b23f'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  for (const [x, kind] of [[-1.6, 0], [1.6, 1], [-2.25, 2], [2.25, 0]] as [number, number][]) {
    const bowl = mesh(lathe([[0, 0], [0.12, 0], [0.08, 0.12], [0.24, 0.2], [0.26, 0.24], [0, 0.22]], 20), bowlMat);
    bowl.position.set(x, ttop, tz);
    group.add(bowl);
    for (let k = 0; k < 4; k++) {
      const f = mesh(new THREE.SphereGeometry(0.085, 12, 10), fruitMats[(k + kind) % 3]);
      const a = (k / 4) * Math.PI * 2;
      f.position.set(x + (k < 3 ? Math.cos(a) * 0.1 : 0), ttop + 0.28 + (k < 3 ? 0 : 0.12), tz + (k < 3 ? Math.sin(a) * 0.1 : 0));
      group.add(f);
    }
  }

  // 蒲团：一个实例化网格，点中时用 instanceId 找回座位
  const cushionGeo = new RoundedBoxGeometry(0.82, 0.12, 0.98, 3, 0.05);
  const cushionMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
  const cushions = new THREE.InstancedMesh(cushionGeo, cushionMat, CUSHIONS.length);
  const cA = new THREE.Color('#77735f');
  const cB = new THREE.Color('#6b5a3e');
  const m4 = new THREE.Matrix4();
  CUSHIONS.forEach((c, i) => {
    m4.makeTranslation(c.x, H.baseH + 0.06, c.z + 0.1);
    cushions.setMatrixAt(i, m4);
    cushions.setColorAt(i, (i % 16) % 5 === 2 ? cB : cA);
  });
  cushions.receiveShadow = true;
  cushions.userData.interact = { type: 'seat', ids: CUSHIONS.map((c) => c.id) };
  group.add(cushions);
  interactives.push(cushions);

  // 殿内暖光
  const interiorLights: THREE.PointLight[] = [];
  const l1 = new THREE.PointLight('#ffc98a', 46, 22, 1.5);
  l1.position.set(0, H.baseH + 4.6, H.tableZ1 + 2.5);
  group.add(l1);
  interiorLights.push(l1);
  for (const x of [-8, 8]) {
    const l = new THREE.PointLight('#ffd7a0', 18, 16, 1.6);
    l.position.set(x, H.baseH + 4.6, -10);
    group.add(l);
    interiorLights.push(l);
  }

  scene.add(group);
  return { group, walkables, interactives, candleFlames, interiorLights, blockers, altarSandY, statueSlots };
}
