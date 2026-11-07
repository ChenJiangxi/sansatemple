// 大殿：深色原木的柱梁、露明的梁架与椽子、两侧落地玻璃窗和上方的白纸格窗、
// 后墙的灵山会相图、低矮的深色木佛坛、佛前长条香案，以及 112 个蒲团
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALL, CUSHIONS, ALTAR_BURNER } from '../layout';
import { plaqueTexture, rng } from '../textures';
import { worldBox, mesh, lathe } from './util';
import { pbr, loadTexture } from './pbr';

export interface HallBuild {
  group: THREE.Group;
  walkables: THREE.Object3D[];
  interactives: THREE.Object3D[];
  candleFlames: THREE.Mesh[];
  interiorLights: THREE.PointLight[];
  blockers: THREE.Object3D[]; // 会挡住镜头的部分：柱、墙、屋顶
  altarSandY: number; // 佛前香炉灰面的高度
  statueSlots: { x: number; y: number; z: number; kind: 'main' | 'left' | 'right' }[];
}

// 圆柱等几何体的 UV 换成米
function meterUV(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

function rafterTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1e1712';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    const grad = g.createLinearGradient(i * 32, 0, i * 32 + 24, 0);
    grad.addColorStop(0, '#2c221b');
    grad.addColorStop(0.5, '#4a3b30');
    grad.addColorStop(1, '#2a2019');
    g.fillStyle = grad;
    g.fillRect(i * 32 + 4, 0, 22, 256);
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
  g.fillStyle = '#2f3131';
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = '#595c5b';
    g.beginPath();
    g.arc(i * 32 + 16, 24, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3f4241';
    g.beginPath();
    g.arc(i * 32 + 16, 24, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#1f2120';
  g.fillRect(0, 46, 256, 18);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 白色窗户纸 + 细木格
function paperLatticeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ece5d6';
  g.fillRect(0, 0, 256, 256);
  const r = rng(4);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(200,190,170,${r() * 0.15})`;
    g.fillRect(r() * 256, r() * 256, 2 + r() * 6, 2 + r() * 6);
  }
  g.strokeStyle = '#3b2f26';
  g.lineWidth = 4;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32, 256);
    g.stroke();
  }
  for (let j = 0; j <= 4; j++) {
    g.beginPath();
    g.moveTo(0, j * 64);
    g.lineTo(256, j * 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 佛画两侧的织锦云纹板
function cloudBrocadeTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b1a14';
  g.fillRect(0, 0, 512, 512);
  const r = rng(21);
  const cols = ['rgba(120,140,90,0.55)', 'rgba(160,70,50,0.5)', 'rgba(190,150,80,0.5)', 'rgba(90,110,100,0.5)'];
  for (let k = 0; k < 140; k++) {
    const x = r() * 512, y = r() * 512, s = 10 + r() * 26;
    g.strokeStyle = cols[Math.floor(r() * cols.length)];
    g.lineWidth = 2 + r() * 3;
    for (let q = 0; q < 3; q++) {
      g.beginPath();
      g.arc(x + q * s * 0.9, y, s * (0.6 + q * 0.15), Math.PI, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(x + s, y + s * 0.3, s * 0.4, 0, Math.PI * 1.5);
    g.stroke();
  }
  for (let k = 0; k < 40; k++) {
    g.fillStyle = 'rgba(200,160,90,0.35)';
    const x = r() * 512, y = r() * 512;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 6, 3, a, 0, Math.PI * 2);
      g.fill();
    }
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

let roofMats: { top: THREE.Material; under: THREE.Material; skirt: THREE.Material; ridge: THREE.Material } | null = null;

// 带翘角的屋顶：四面坡曲面，屋檐向外、屋角上翘；瓦面用照片贴图，UV 以米为单位
export function buildRoof(opts: { cx: number; cz: number; W: number; D: number; rx: number; eaveY: number; ridgeY: number; lift: number }) {
  const { cx, cz, W, D, rx, eaveY, ridgeY, lift } = opts;
  const yAt = (v: number, au: number) => eaveY + (ridgeY - eaveY) * Math.pow(v, 1.55) + lift * Math.pow(au, 5) * Math.pow(1 - v, 2.2);
  const outward = (au: number, v: number) => 1 + 0.035 * Math.pow(au, 3) * (1 - v);
  if (!roofMats) {
    roofMats = {
      top: pbr('roof', { metersPerTile: 2.2, color: '#9a9c9a' }),
      under: new THREE.MeshStandardMaterial({ map: rafterTexture(), roughness: 0.9, side: THREE.BackSide }),
      skirt: new THREE.MeshStandardMaterial({ map: tileEndTexture(), roughness: 0.9, side: THREE.DoubleSide }),
      ridge: new THREE.MeshStandardMaterial({ color: '#2c2e2e', roughness: 0.85 }),
    };
  }
  const M = roofMats;
  const group = new THREE.Group();
  const segU = 36, segV = 18;
  const slopeLen = Math.hypot(D, ridgeY - eaveY);
  const sideLen = Math.hypot(W - rx, ridgeY - eaveY);

  const slopes: ((u: number, v: number) => [number, number, number, number, number])[] = [
    (u, v) => { const o = outward(Math.abs(u), v); return [cx + (u * W + (u * rx - u * W) * v) * o, yAt(v, Math.abs(u)), cz + D * (1 - v) * o, u * W, v * slopeLen]; },
    (u, v) => { const o = outward(Math.abs(u), v); return [cx - (u * W + (u * rx - u * W) * v) * o, yAt(v, Math.abs(u)), cz - D * (1 - v) * o, u * W, v * slopeLen]; },
    (u, v) => { const o = outward(Math.abs(u), v); return [cx + (W + (rx - W) * v) * o, yAt(v, Math.abs(u)), cz - u * D * (1 - v) * o, u * D, v * sideLen]; },
    (u, v) => { const o = outward(Math.abs(u), v); return [cx - (W + (rx - W) * v) * o, yAt(v, Math.abs(u)), cz + u * D * (1 - v) * o, u * D, v * sideLen]; },
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
    const n = geo.attributes.normal as THREE.BufferAttribute;
    if (n.getY(Math.floor(segU / 2) + (segU + 1) * 4) < 0) {
      for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
      geo.setIndex(idx);
      geo.computeVertexNormals();
    }
    group.add(mesh(geo, M.top));
    const under = new THREE.Mesh(geo, M.under);
    under.receiveShadow = true;
    group.add(under);

    const sp: number[] = [];
    const su: number[] = [];
    const si: number[] = [];
    for (let i = 0; i <= segU; i++) {
      const [x, y, z, a] = fn(-1 + (2 * i) / segU, 0);
      sp.push(x, y + 0.05, z, x, y - 0.32, z);
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
    group.add(mesh(sg, M.skirt));
  }

  const ridge = mesh(new THREE.BoxGeometry(rx * 2 + 0.6, 0.46, 0.55), M.ridge);
  ridge.position.set(cx, ridgeY + 0.18, cz);
  group.add(ridge);
  const ridgeTop = mesh(new THREE.BoxGeometry(rx * 2 + 0.9, 0.12, 0.66), M.ridge);
  ridgeTop.position.set(cx, ridgeY + 0.46, cz);
  group.add(ridgeTop);
  for (const s of [-1, 1]) {
    const orn = mesh(new THREE.BoxGeometry(0.42, 1.0, 0.6), M.ridge);
    orn.position.set(cx + s * (rx + 0.35), ridgeY + 0.55, cz);
    orn.rotation.z = -s * 0.25;
    group.add(orn);
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const [x, y, z] = slopes[0](sx, k / 12);
      pts.push(new THREE.Vector3(x, y + 0.15, sz > 0 ? z : 2 * cz - z));
    }
    group.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 6, false), M.ridge));
    const tip = mesh(new THREE.SphereGeometry(0.2, 10, 8), M.ridge);
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

  const stoneTop = pbr('granite', { metersPerTile: 2.4, color: '#a9a49a' });
  const stoneSide = pbr('stonewall', { metersPerTile: 3.2, color: '#b0aaa0' });
  const colMat = pbr('wood', { metersPerTile: 1.8, color: '#6e5a4c', rotate: true });
  const beamMat = pbr('wood', { metersPerTile: 2.2, color: '#5e4c40' });
  const darkWood = pbr('wood', { metersPerTile: 1.4, color: '#3e3129' });
  const floorMat = pbr('floor', { metersPerTile: 2.6, color: '#7a6d62', roughness: 0.85 });
  const plasterMat = pbr('plaster', { metersPerTile: 2.5, color: '#e6dfd2' });
  const ceilMat = pbr('floor', { metersPerTile: 2.2, color: '#4c4038', side: THREE.DoubleSide });

  const colTop = H.baseH + H.colH;
  const ceilY = colTop + 1.0;

  // —— 台基与台阶 ——
  const bw = H.baseX1 - H.baseX0;
  const bd = H.baseZ1 - H.baseZ0;
  const base = mesh(worldBox(bw, H.baseH, bd, 1), [stoneSide, stoneSide, stoneTop, stoneTop, stoneSide, stoneSide]);
  base.position.set((H.baseX0 + H.baseX1) / 2, H.baseH / 2, (H.baseZ0 + H.baseZ1) / 2);
  base.name = 'walkable';
  group.add(base);
  walkables.push(base);
  const coping = mesh(worldBox(bw + 0.24, 0.12, bd + 0.24, 1), stoneTop);
  coping.position.set(base.position.x, H.baseH - 0.065, base.position.z);
  group.add(coping);
  const steps = 5;
  const stepDepth = (H.stepZ1 - H.stepZ0) / steps;
  for (let k = 0; k < steps; k++) {
    const top = ((k + 1) / steps) * H.baseH;
    const z1 = H.stepZ1 - k * stepDepth;
    const s = mesh(worldBox(H.stepX1 - H.stepX0, top, z1 - H.stepZ0, 1), stoneTop);
    s.position.set(0, top / 2, (H.stepZ0 + z1) / 2);
    s.name = 'walkable';
    group.add(s);
    walkables.push(s);
  }
  for (const sx of [H.stepX0 - 0.25, H.stepX1 + 0.25]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(H.stepZ1 - H.stepZ0 + 0.15, 0);
    shape.lineTo(H.stepZ1 - H.stepZ0 + 0.15, 0.3);
    shape.lineTo(0.25, H.baseH + 0.3);
    shape.lineTo(0, H.baseH + 0.3);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    const m = mesh(geo, stoneTop);
    m.rotation.y = -Math.PI / 2;
    m.position.set(sx - 0.25, 0, H.stepZ0);
    group.add(m);
  }

  // —— 殿内木地板（一直铺到前檐下）——
  const fw = H.wallX * 2 + 0.6;
  const fz0 = H.backZ;
  const fz1 = H.colZFront + 0.9;
  const floor = mesh(worldBox(fw, 0.06, fz1 - fz0, 1), floorMat, false);
  floor.position.set(0, H.baseH + 0.03, (fz0 + fz1) / 2);
  floor.name = 'walkable';
  group.add(floor);
  walkables.push(floor);

  // —— 柱子：方形础石上的粗原木柱 ——
  const colGeo = meterUV(new THREE.CylinderGeometry(0.38, 0.44, H.colH - 0.32, 24), 2.6, H.colH);
  const plinthGeo = worldBox(1.05, 0.32, 1.05, 1);
  const columns: [number, number][] = [];
  for (const x of H.colX) columns.push([x, H.colZFront], [x, H.colZBack]);
  for (const z of H.colZSide) columns.push([-H.wallX, z], [H.wallX, z]);
  for (const [x, z] of columns) {
    const p = mesh(plinthGeo, stoneTop);
    p.position.set(x, H.baseH + 0.16, z);
    group.add(p);
    const c = mesh(colGeo, colMat);
    c.position.set(x, H.baseH + 0.32 + (H.colH - 0.32) / 2, z);
    group.add(c);
    blockers.push(c);
    const cap = mesh(worldBox(0.95, 0.36, 0.95, 1), beamMat);
    cap.position.set(x, colTop + 0.48, z);
    group.add(cap);
  }

  // —— 梁枋：一圈两层的阑额与普拍，斗栱，拱眼壁 ——
  const ring = [
    { x: 0, z: H.colZFront, len: H.wallX * 2 + 0.9, alongX: true },
    { x: 0, z: H.colZBack, len: H.wallX * 2 + 0.9, alongX: true },
    { x: -H.wallX, z: (H.colZFront + H.colZBack) / 2, len: H.colZFront - H.colZBack + 0.9, alongX: false },
    { x: H.wallX, z: (H.colZFront + H.colZBack) / 2, len: H.colZFront - H.colZBack + 0.9, alongX: false },
  ];
  const bracketGeos: THREE.BufferGeometry[] = [];
  for (const b of ring) {
    const mk = (h: number, d: number) => (b.alongX ? worldBox(b.len, h, d, 1) : worldBox(d, h, b.len, 1));
    const beam1 = mesh(mk(0.62, 0.5), beamMat);
    beam1.position.set(b.x, colTop - 0.31, b.z);
    group.add(beam1);
    const beam2 = mesh(mk(0.3, 0.62), beamMat);
    beam2.position.set(b.x, colTop + 0.15, b.z);
    group.add(beam2);
    const wallPanel = mesh(mk(0.9, 0.16), plasterMat);
    wallPanel.position.set(b.x, colTop + 0.75, b.z);
    group.add(wallPanel);
    const n = Math.floor(b.len / 1.1);
    for (let i = 0; i <= n; i++) {
      const off = -b.len / 2 + 0.45 + (i * (b.len - 0.9)) / n;
      const bx = b.alongX ? b.x + off : b.x;
      const bz = b.alongX ? b.z : b.z + off;
      const arm = b.alongX ? worldBox(0.24, 0.22, 1.5, 1) : worldBox(1.5, 0.22, 0.24, 1);
      arm.translate(bx, colTop + 0.62, bz);
      const arm2 = b.alongX ? worldBox(0.7, 0.18, 0.26, 1) : worldBox(0.26, 0.18, 0.7, 1);
      arm2.translate(bx, colTop + 0.88, bz);
      const block = worldBox(0.34, 0.2, 0.34, 1);
      block.translate(bx, colTop + 1.02, bz);
      bracketGeos.push(arm, arm2, block);
    }
  }
  group.add(mesh(mergeGeometries(bracketGeos), beamMat));

  // —— 露明的梁架：三道大梁、檩条和密密的椽子，最上面是深色木板天花 ——
  const ceil = new THREE.Mesh(worldBox(H.wallX * 2, 0.08, H.colZFront - H.colZBack, 1), ceilMat);
  ceil.position.set(0, ceilY + 0.04, (H.colZFront + H.colZBack) / 2);
  ceil.receiveShadow = true;
  group.add(ceil);
  const frame: THREE.BufferGeometry[] = [];
  for (const z of H.colZSide) {
    const g = worldBox(H.wallX * 2, 0.7, 0.55, 1);
    g.translate(0, colTop + 0.35, z);
    frame.push(g);
    for (const x of [-H.wallX * 0.5, 0, H.wallX * 0.5]) {
      const post = worldBox(0.28, ceilY - colTop - 0.7, 0.28, 1);
      post.translate(x, colTop + 0.7 + (ceilY - colTop - 0.7) / 2, z);
      frame.push(post);
    }
  }
  for (const x of [-H.wallX * 0.5, 0, H.wallX * 0.5]) {
    const g = worldBox(0.34, 0.34, H.colZFront - H.colZBack, 1);
    g.translate(x, ceilY - 0.17, (H.colZFront + H.colZBack) / 2);
    frame.push(g);
  }
  for (let x = -H.wallX + 0.4; x < H.wallX; x += 0.72) {
    const g = worldBox(0.14, 0.16, H.colZFront - H.colZBack, 1);
    g.translate(x, ceilY - 0.42, (H.colZFront + H.colZBack) / 2);
    frame.push(g);
  }
  group.add(mesh(mergeGeometries(frame), beamMat, false));

  // —— 侧墙：深色护墙板、整面玻璃窗、上方一排白纸格窗 ——
  const glass = new THREE.MeshStandardMaterial({ color: '#cfd8d2', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const paperTex = paperLatticeTexture();
  const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9, emissive: '#f4ead2', emissiveIntensity: 0.18, side: THREE.DoubleSide });
  const wallZ0 = H.backZ + 0.2;
  const wallZ1 = H.colZFront - 0.45;
  const wallLen = wallZ1 - wallZ0;
  const wallCz = (wallZ0 + wallZ1) / 2;
  const winBottom = H.baseH + 0.75;
  const winTop = H.baseH + 3.9;
  const mullions: THREE.BufferGeometry[] = [];
  paperTex.repeat.set(wallLen / 2.4, 1);
  for (const sx of [-1, 1]) {
    const x = sx * H.wallX;
    const wain = mesh(worldBox(0.24, 0.75, wallLen, 1), darkWood);
    wain.position.set(x, H.baseH + 0.375, wallCz);
    group.add(wain);
    blockers.push(wain);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, winTop - winBottom), glass);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(x, (winBottom + winTop) / 2, wallCz);
    pane.renderOrder = 2;
    group.add(pane);
    const panes = Math.round(wallLen / 1.2);
    for (let k = 0; k <= panes; k++) {
      const g = worldBox(0.14, winTop - winBottom, 0.1, 1);
      g.translate(x, (winBottom + winTop) / 2, wallZ0 + (k * wallLen) / panes);
      mullions.push(g);
    }
    for (const y of [winBottom, winBottom + 2.3, winTop]) {
      const g = worldBox(0.16, 0.12, wallLen, 1);
      g.translate(x, y, wallCz);
      mullions.push(g);
    }
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, colTop - 0.62 - winTop), paperMat);
    paper.rotation.y = Math.PI / 2;
    paper.position.set(x, (winTop + colTop - 0.62) / 2, wallCz);
    group.add(paper);
    blockers.push(paper);
    const sill = worldBox(0.3, 0.14, wallLen, 1);
    sill.translate(x, winTop + 0.04, wallCz);
    mullions.push(sill);
  }
  group.add(mesh(mergeGeometries(mullions), darkWood));

  // —— 后墙：深色木墙板，中间挂灵山会相图，两侧织锦云纹 ——
  const back = mesh(worldBox(H.wallX * 2, H.colH, 0.3, 1), darkWood);
  back.position.set(0, H.baseH + H.colH / 2, H.backZ);
  group.add(back);
  blockers.push(back);
  const backUpper = mesh(worldBox(H.wallX * 2, ceilY - colTop, 0.2, 1), darkWood);
  backUpper.position.set(0, colTop + (ceilY - colTop) / 2, H.backZ);
  group.add(backUpper);
  const muralTex = loadTexture('mural.jpg');
  const mh = 5.55;
  const mw = mh * (2048 / 1734);
  const mz = H.colZBack + 0.56; // 挂在后排柱子前面
  const myC = H.baseH + H.altarH + 0.3 + mh / 2;
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshStandardMaterial({ map: muralTex, roughness: 0.85, emissive: '#ffffff', emissiveMap: muralTex, emissiveIntensity: 0.12 }));
  mural.position.set(0, myC, mz);
  group.add(mural);
  const frameMat = pbr('wood', { metersPerTile: 1.2, color: '#2e241e' });
  for (const [w, h, x, y] of [[mw + 0.5, 0.25, 0, myC + mh / 2 + 0.12], [mw + 0.5, 0.25, 0, myC - mh / 2 - 0.12], [0.25, mh, -mw / 2 - 0.12, myC], [0.25, mh, mw / 2 + 0.12, myC]] as [number, number, number, number][]) {
    const f = mesh(worldBox(w, h, 0.12, 1), frameMat, false);
    f.position.set(x, y, mz + 0.02);
    group.add(f);
  }
  const brocade = cloudBrocadeTexture();
  const bwid = 7.0;
  brocade.repeat.set(bwid / 3, (mh - 0.4) / 3);
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(bwid, mh - 0.4), new THREE.MeshStandardMaterial({ map: brocade, roughness: 0.85, emissive: '#2a1810', emissiveIntensity: 0.25 }));
    panel.position.set(s * (mw / 2 + 0.4 + bwid / 2), myC - 0.2, mz - 0.01);
    group.add(panel);
  }

  // —— 屋顶 ——
  const roof = buildRoof({ cx: 0, cz: (H.colZFront + H.colZBack) / 2, W: H.wallX + 3.3, D: (H.colZFront - H.colZBack) / 2 + 3.3, rx: H.wallX * 0.48, eaveY: colTop + 1.1, ridgeY: colTop + 6.2, lift: 1.25 });
  group.add(roof);
  blockers.push(roof);

  // —— 匾额 ——
  const trimMat = new THREE.MeshStandardMaterial({ color: '#b08d4a', metalness: 0.6, roughness: 0.4 });
  const plaque = mesh(new THREE.BoxGeometry(4.6, 1.5, 0.14), [trimMat, trimMat, trimMat, trimMat, new THREE.MeshStandardMaterial({ map: plaqueTexture('殿雄大'), roughness: 0.6, emissive: '#222', emissiveIntensity: 0.15 }), darkWood]);
  plaque.position.set(0, colTop + 0.62, H.colZFront + 0.42);
  plaque.rotation.x = -0.1;
  group.add(plaque);

  // —— 佛坛：低矮的深色木台，正面有内凹的格板，前面一级台阶 ——
  const aw = H.altarX1 - H.altarX0;
  const ad = H.altarZ1 - H.altarZ0;
  const az = (H.altarZ0 + H.altarZ1) / 2;
  const altar = mesh(worldBox(aw, H.altarH, ad, 1), darkWood);
  altar.position.set(0, H.baseH + H.altarH / 2, az);
  group.add(altar);
  const altarTopBoard = mesh(worldBox(aw + 0.2, 0.08, ad + 0.2, 1), beamMat);
  altarTopBoard.position.set(0, H.baseH + H.altarH + 0.04, az);
  group.add(altarTopBoard);
  const inset = new THREE.MeshStandardMaterial({ color: '#21190f', roughness: 0.7 });
  for (let i = 0; i < 9; i++) {
    const p = mesh(new THREE.BoxGeometry(aw / 9 - 0.3, H.altarH - 0.34, 0.03), inset, false);
    p.position.set(H.altarX0 + (i + 0.5) * (aw / 9), H.baseH + H.altarH / 2, H.altarZ1 + 0.012);
    group.add(p);
  }
  const stepBoard = mesh(worldBox(aw - 2, 0.36, 0.5, 1), darkWood);
  stepBoard.position.set(0, H.baseH + 0.18, H.altarZ1 + 0.25);
  group.add(stepBoard);

  const altarTop = H.baseH + H.altarH + 0.08;
  const statueSlots = [
    { x: 0, y: altarTop, z: az + 0.25, kind: 'main' as const },
    { x: -6.4, y: altarTop, z: az + 0.15, kind: 'left' as const },
    { x: 6.4, y: altarTop, z: az + 0.15, kind: 'right' as const },
  ];

  // 烛台与花瓶
  const brass = new THREE.MeshStandardMaterial({ color: '#b59045', metalness: 0.85, roughness: 0.35 });
  const candleMat = new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.5, emissive: '#3a2a10', emissiveIntensity: 0.2 });
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd28a' });
  const addCandle = (x: number, y: number, z: number, stand = 0.55) => {
    const holder = mesh(lathe([[0, 0], [0.12, 0], [0.12, 0.03], [0.03, 0.08], [0.025, stand - 0.05], [0.07, stand - 0.02], [0.07, stand], [0, stand]], 16), brass);
    holder.position.set(x, y, z);
    group.add(holder);
    const candle = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), candleMat);
    candle.position.set(x, y + stand + 0.11, z);
    group.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), flameMat);
    flame.scale.set(1, 2.3, 1);
    flame.position.set(x, y + stand + 0.27, z);
    group.add(flame);
    candleFlames.push(flame);
  };
  for (const x of [-3.0, 3.0]) addCandle(x, altarTop, H.altarZ1 - 0.3);
  const vaseMat = new THREE.MeshPhysicalMaterial({ color: '#6f8f86', roughness: 0.25, clearcoat: 0.8 });
  const petalMat = new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.6 });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4d5a3a', roughness: 0.8 });
  for (const x of [-9.4, 9.4]) {
    const vz = H.altarZ1 - 0.35;
    const vase = mesh(lathe([[0, 0], [0.12, 0], [0.18, 0.12], [0.17, 0.26], [0.07, 0.38], [0.06, 0.46], [0.09, 0.5], [0, 0.5]], 24), vaseMat);
    vase.position.set(x, altarTop, vz);
    group.add(vase);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const h = 0.45 + (k % 2) * 0.18;
      const stem = mesh(new THREE.CylinderGeometry(0.008, 0.01, h, 5), stemMat, false);
      stem.position.set(x + Math.cos(a) * 0.05, altarTop + 0.5 + h / 2, vz + Math.sin(a) * 0.05);
      stem.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
      group.add(stem);
      const bloom = mesh(new THREE.SphereGeometry(0.07, 10, 8), petalMat, false);
      bloom.position.set(x + Math.cos(a) * 0.14, altarTop + 0.5 + h, vz + Math.sin(a) * 0.14);
      group.add(bloom);
    }
  }
  // 供果
  const bowlMat = new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: 0.6, roughness: 0.4 });
  const fruitMats = ['#d8752a', '#c43f2b', '#e2b23f'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  for (const [x, kind] of [[-1.6, 0], [1.6, 1], [-4.6, 2], [4.6, 0]] as [number, number][]) {
    const bowl = mesh(lathe([[0, 0], [0.1, 0], [0.07, 0.1], [0.22, 0.17], [0.24, 0.2], [0, 0.18]], 20), bowlMat);
    bowl.position.set(x, H.baseH + 0.36, H.altarZ1 + 0.25);
    group.add(bowl);
    for (let k = 0; k < 4; k++) {
      const f = mesh(new THREE.SphereGeometry(0.075, 12, 10), fruitMats[(k + kind) % 3]);
      const a = (k / 4) * Math.PI * 2;
      f.position.set(x + (k < 3 ? Math.cos(a) * 0.09 : 0), H.baseH + 0.36 + 0.24 + (k < 3 ? 0 : 0.11), H.altarZ1 + 0.25 + (k < 3 ? Math.sin(a) * 0.09 : 0));
      group.add(f);
    }
  }

  // —— 佛前香案：一张低矮的长条木桌，近端放一只陶香炉 ——
  const tw = H.tableX1 - H.tableX0;
  const td = H.tableZ1 - H.tableZ0;
  const tz = (H.tableZ0 + H.tableZ1) / 2;
  const tableMat = pbr('wood', { metersPerTile: 1.6, color: '#4a3a30' });
  const tableTop = mesh(worldBox(tw, 0.07, td, 1), tableMat);
  tableTop.position.set(0, H.baseH + H.tableH - 0.035, tz);
  group.add(tableTop);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(worldBox(0.08, H.tableH - 0.07, 0.08, 1), tableMat);
    leg.position.set(sx * (tw / 2 - 0.08), H.baseH + (H.tableH - 0.07) / 2, tz + sz * (td / 2 - 0.1));
    group.add(leg);
  }
  const ttop = H.baseH + H.tableH;
  const ceramic = new THREE.MeshPhysicalMaterial({ color: '#8a6a44', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const burner = new THREE.Group();
  burner.add(mesh(lathe([[0, 0], [0.13, 0], [0.15, 0.02], [0.24, 0.08], [0.27, 0.16], [0.26, 0.2], [0.24, 0.2], [0, 0.18]], 32), ceramic));
  const ash = mesh(new THREE.CircleGeometry(0.235, 28), new THREE.MeshStandardMaterial({ color: '#c9c2b4', roughness: 1 }), false);
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.185;
  burner.add(ash);
  burner.position.set(ALTAR_BURNER.x, ttop, ALTAR_BURNER.z);
  burner.traverse((o) => (o.userData.interact = { type: 'altarIncense' }));
  group.add(burner);
  interactives.push(burner);
  for (const dz of [-0.75, -1.2]) addCandle(-0.32, ttop, ALTAR_BURNER.z + dz, 0.16);
  const burnerHit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, td + 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  burnerHit.position.set(0, H.baseH + 0.6, tz + 0.2);
  burnerHit.userData.interact = { type: 'altarIncense' };
  group.add(burnerHit);
  interactives.push(burnerHit);
  const altarSandY = ttop + 0.185;

  // —— 蒲团：一个实例化网格，点中时用 instanceId 找回座位 ——
  const cushionGeo = new RoundedBoxGeometry(0.82, 0.11, 0.98, 3, 0.04);
  const cushionMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
  const cushions = new THREE.InstancedMesh(cushionGeo, cushionMat, CUSHIONS.length);
  const cA = new THREE.Color('#3e3d38');
  const cB = new THREE.Color('#4a463d');
  const m4 = new THREE.Matrix4();
  CUSHIONS.forEach((c, i) => {
    m4.makeTranslation(c.x, H.baseH + 0.06 + 0.055, c.z + 0.1);
    cushions.setMatrixAt(i, m4);
    cushions.setColorAt(i, (i % 16) % 5 === 2 ? cB : cA);
  });
  cushions.receiveShadow = true;
  cushions.userData.interact = { type: 'seat', ids: CUSHIONS.map((c) => c.id) };
  group.add(cushions);
  interactives.push(cushions);

  // —— 殿内暖光 ——
  const interiorLights: THREE.PointLight[] = [];
  const l1 = new THREE.PointLight('#ffcf95', 40, 20, 1.5);
  l1.position.set(0, H.baseH + 4.4, H.tableZ1 + 1.8);
  group.add(l1);
  interiorLights.push(l1);
  for (const x of [-8, 8]) {
    const l = new THREE.PointLight('#ffd7a8', 14, 15, 1.6);
    l.position.set(x, H.baseH + 4.8, -11);
    group.add(l);
    interiorLights.push(l);
  }

  scene.add(group);
  return { group, walkables, interactives, candleFlames, interiorLights, blockers, altarSandY, statueSlots };
}
