// 大雄宝殿（汉传佛寺形制）：白石须弥座与栏杆、朱红柱、正面格扇门、青绿旋子彩画与斗栱、
// 重檐屋顶（鸱吻、脊兽、宝瓶）；殿内方砖地、千佛壁、井口天花、三尊金身佛与鎏金背光、
// 华盖与经幡、朱漆供桌（黄桌围、铜鼎香炉、红烛）、木鱼与铜磬、112 个圆蒲团
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALL, CUSHIONS, ALTAR_BURNER } from '../layout';
import { plaqueTexture, rng, caihuaTexture, cofferTexture, thousandBuddhaTexture, altarClothTexture, geshanTexture } from '../textures';
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
export function meterUV(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

// —— 共用材质 ——
let shared: Record<string, THREE.Material> | null = null;
export function chineseMats() {
  if (shared) return shared;
  const woodN = loadTexture('wood_normal.jpg', false).clone();
  woodN.repeat.set(0.6, 0.6);
  woodN.needsUpdate = true;
  const plasterN = loadTexture('plaster_normal.jpg', false).clone();
  plasterN.repeat.set(0.5, 0.5);
  plasterN.needsUpdate = true;
  const ch = caihuaTexture();
  ch.repeat.set(1 / 4, 1);
  shared = {
    red: new THREE.MeshStandardMaterial({ color: '#8e2417', roughness: 0.42, normalMap: woodN, normalScale: new THREE.Vector2(0.25, 0.25) }),
    redDark: new THREE.MeshStandardMaterial({ color: '#6a1a12', roughness: 0.5 }),
    caihua: new THREE.MeshStandardMaterial({ map: ch, roughness: 0.65 }),
    blue: new THREE.MeshStandardMaterial({ color: '#2b5684', roughness: 0.6 }),
    green: new THREE.MeshStandardMaterial({ color: '#2c6a5e', roughness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: '#c99a42', metalness: 0.85, roughness: 0.35 }),
    // 汉白玉：偏白、细腻，只借一点灰泥的法线做表面起伏
    marble: new THREE.MeshStandardMaterial({ color: '#ebe7df', roughness: 0.55, normalMap: plasterN, normalScale: new THREE.Vector2(0.4, 0.4) }),
    marbleSide: new THREE.MeshStandardMaterial({ color: '#e2ddd3', roughness: 0.6, normalMap: plasterN, normalScale: new THREE.Vector2(0.5, 0.5) }),
    redWall: pbr('plaster', { metersPerTile: 2.5, color: '#9a3324' }),
    geshan: new THREE.MeshStandardMaterial({ map: geshanTexture(), roughness: 0.55, emissive: '#f4e6c8', emissiveIntensity: 0.05 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#5b4a33', metalness: 0.85, roughness: 0.42 }),
  };
  return shared;
}

function rafterTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1d3f52';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = '#8e2417';
    g.fillRect(i * 32 + 5, 0, 22, 256);
    g.fillStyle = '#2b5684';
    g.fillRect(i * 32 + 5, 0, 22, 30);
    g.fillStyle = '#e8d9a8';
    g.beginPath();
    g.arc(i * 32 + 16, 14, 7, 0, Math.PI * 2);
    g.fill();
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
    g.fillStyle = '#5d605e';
    g.beginPath();
    g.arc(i * 32 + 16, 22, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#43464a';
    g.beginPath();
    g.moveTo(i * 32 + 4, 40);
    g.lineTo(i * 32 + 28, 40);
    g.lineTo(i * 32 + 16, 58);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 后壁：深红底上的金色云纹
function redGoldCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5c1710';
  g.fillRect(0, 0, 512, 512);
  const r = rng(21);
  for (let k = 0; k < 120; k++) {
    const x = r() * 512, y = r() * 512, s = 12 + r() * 24;
    g.strokeStyle = `rgba(214,168,80,${0.35 + r() * 0.3})`;
    g.lineWidth = 2 + r() * 2;
    for (let q = 0; q < 3; q++) {
      g.beginPath();
      g.arc(x + q * s * 0.9, y, s * (0.6 + q * 0.15), Math.PI, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(x + s, y + s * 0.3, s * 0.4, 0, Math.PI * 1.5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 经幡：一节节红黄绿相间的布筒
function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d')!;
  const cols = ['#c9302a', '#e0b23c', '#2f7a5c', '#e0b23c', '#c9302a', '#2b5684', '#e0b23c', '#c9302a'];
  cols.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, i * 64, 64, 64);
    g.fillStyle = 'rgba(255,230,150,0.7)';
    g.fillRect(0, i * 64, 64, 4);
    g.fillRect(0, i * 64 + 60, 64, 4);
  });
  const t = new THREE.CanvasTexture(c);
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
function getRoofMats() {
  if (!roofMats) {
    roofMats = {
      top: pbr('roof', { metersPerTile: 1.8, color: '#7d817f' }),
      under: new THREE.MeshStandardMaterial({ map: rafterTexture(), roughness: 0.85, side: THREE.BackSide }),
      skirt: new THREE.MeshStandardMaterial({ map: tileEndTexture(), roughness: 0.85, side: THREE.DoubleSide }),
      ridge: new THREE.MeshStandardMaterial({ color: '#36393a', roughness: 0.7 }),
    };
  }
  return roofMats;
}

// 鸱吻：正脊两端向内卷的龙尾
function chiwen(h: number, mat: THREE.Material) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.62 * h, 0);
  s.lineTo(0.58 * h, 0.35 * h);
  s.bezierCurveTo(0.6 * h, 0.75 * h, 0.4 * h, 1.0 * h, 0.08 * h, 1.0 * h);
  s.bezierCurveTo(-0.12 * h, 0.98 * h, -0.2 * h, 0.78 * h, -0.05 * h, 0.66 * h);
  s.bezierCurveTo(0.1 * h, 0.58 * h, 0.22 * h, 0.7 * h, 0.16 * h, 0.8 * h);
  s.bezierCurveTo(0.34 * h, 0.72 * h, 0.3 * h, 0.4 * h, 0.12 * h, 0.32 * h);
  s.lineTo(0, 0.3 * h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.28 * h, bevelEnabled: true, bevelThickness: 0.04 * h, bevelSize: 0.04 * h, bevelSegments: 2, curveSegments: 16 });
  geo.translate(-0.31 * h, 0, -0.14 * h);
  return mesh(geo, mat);
}

interface RoofOpts {
  cx: number; cz: number; W: number; D: number; rx: number; eaveY: number; ridgeY: number; lift: number;
  ornate?: boolean; // 鸱吻、脊兽、宝瓶
}

// 四面坡曲面屋顶，屋檐向外、屋角上翘；瓦面用照片贴图，UV 以米为单位
export function buildRoof(opts: RoofOpts) {
  const { cx, cz, W, D, rx, eaveY, ridgeY, lift } = opts;
  const yAt = (v: number, au: number) => eaveY + (ridgeY - eaveY) * Math.pow(v, 1.6) + lift * Math.pow(au, 5) * Math.pow(1 - v, 2.0);
  const outward = (au: number, v: number) => 1 + 0.05 * Math.pow(au, 3) * (1 - v);
  const M = getRoofMats();
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
  addSlopes(group, slopes, segU, segV, M);

  const ridge = mesh(new THREE.BoxGeometry(rx * 2 + 0.6, 0.55, 0.6), M.ridge);
  ridge.position.set(cx, ridgeY + 0.22, cz);
  group.add(ridge);
  const ridgeTop = mesh(new THREE.BoxGeometry(rx * 2 + 0.9, 0.14, 0.72), M.ridge);
  ridgeTop.position.set(cx, ridgeY + 0.55, cz);
  group.add(ridgeTop);
  const h = Math.max(0.9, (ridgeY - eaveY) * 0.42);
  for (const s of [-1, 1]) {
    if (opts.ornate) {
      const cw = chiwen(h, M.ridge);
      cw.position.set(cx + s * (rx + 0.25), ridgeY + 0.5, cz);
      cw.scale.x = -s;
      group.add(cw);
    } else {
      const orn = mesh(new THREE.BoxGeometry(0.42, 0.7, 0.6), M.ridge);
      orn.position.set(cx + s * (rx + 0.3), ridgeY + 0.5, cz);
      group.add(orn);
    }
  }
  if (opts.ornate) {
    // 正脊正中的宝瓶
    const gold = new THREE.MeshStandardMaterial({ color: '#c99a42', metalness: 0.8, roughness: 0.35 });
    const vase = mesh(lathe([[0, 0], [0.32, 0], [0.36, 0.12], [0.2, 0.3], [0.3, 0.55], [0.12, 0.8], [0.16, 0.9], [0.05, 1.25], [0, 1.3]], 16), gold);
    vase.position.set(cx, ridgeY + 0.62, cz);
    group.add(vase);
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const [x, y, z] = slopes[0](sx, k / 12);
      pts.push(new THREE.Vector3(x, y + 0.16, sz > 0 ? z : 2 * cz - z));
    }
    group.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.17, 6, false), M.ridge));
    if (opts.ornate) {
      // 戗脊上的一排小兽，最前面是骑凤仙人
      for (let k = 1; k <= 5; k++) {
        const p = pts[Math.min(pts.length - 1, k)];
        const beast = mesh(new THREE.SphereGeometry(0.13, 8, 6), M.ridge);
        beast.scale.set(1, 1.3, 1.2);
        beast.position.set(p.x, p.y + 0.24, p.z);
        group.add(beast);
      }
      const tip = mesh(new THREE.ConeGeometry(0.12, 0.45, 8), M.ridge);
      tip.position.copy(pts[0]).add(new THREE.Vector3(0, 0.3, 0));
      group.add(tip);
    } else {
      const tip = mesh(new THREE.SphereGeometry(0.2, 10, 8), M.ridge);
      tip.position.copy(pts[0]).add(new THREE.Vector3(0, 0.1, 0));
      group.add(tip);
    }
  }
  return group;
}

// 重檐的下檐：一圈从内墙斜出去的屋檐
export function buildSkirtRoof(o: { cx: number; cz: number; iW: number; iD: number; oW: number; oD: number; yIn: number; yOut: number; lift: number }) {
  const M = getRoofMats();
  const group = new THREE.Group();
  const segU = 36, segV = 6;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const y = (v: number, au: number) => lerp(o.yOut, o.yIn, Math.pow(v, 1.3)) + o.lift * Math.pow(au, 5) * Math.pow(1 - v, 1.6);
  const len = Math.hypot(o.oD - o.iD, o.yIn - o.yOut);
  const slopes: ((u: number, v: number) => [number, number, number, number, number])[] = [
    (u, v) => [o.cx + u * lerp(o.oW, o.iW, v), y(v, Math.abs(u)), o.cz + lerp(o.oD, o.iD, v), u * o.oW, v * len],
    (u, v) => [o.cx - u * lerp(o.oW, o.iW, v), y(v, Math.abs(u)), o.cz - lerp(o.oD, o.iD, v), u * o.oW, v * len],
    (u, v) => [o.cx + lerp(o.oW, o.iW, v), y(v, Math.abs(u)), o.cz - u * lerp(o.oD, o.iD, v), u * o.oD, v * len],
    (u, v) => [o.cx - lerp(o.oW, o.iW, v), y(v, Math.abs(u)), o.cz + u * lerp(o.oD, o.iD, v), u * o.oD, v * len],
  ];
  addSlopes(group, slopes, segU, segV, M);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const v = k / 6;
      pts.push(new THREE.Vector3(o.cx + sx * lerp(o.oW, o.iW, v), y(v, 1) + 0.14, o.cz + sz * lerp(o.oD, o.iD, v)));
    }
    group.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.15, 6, false), M.ridge));
  }
  return group;
}

function addSlopes(group: THREE.Group, slopes: ((u: number, v: number) => [number, number, number, number, number])[], segU: number, segV: number, M: ReturnType<typeof getRoofMats>) {
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
    if (n.getY(Math.floor(segU / 2) + (segU + 1) * Math.min(4, segV - 1)) < 0) {
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
}

// 一圈梁枋 + 斗栱（彩画梁、蓝色栱、绿色斗）
export function beamRing(group: THREE.Group, cx: number, cz: number, hw: number, hd: number, y: number, M = chineseMats(), spacing = 1.1, wall = true) {
  const ring = [
    { x: cx, z: cz + hd, len: hw * 2 + 0.9, alongX: true },
    { x: cx, z: cz - hd, len: hw * 2 + 0.9, alongX: true },
    { x: cx - hw, z: cz, len: hd * 2 + 0.9, alongX: false },
    { x: cx + hw, z: cz, len: hd * 2 + 0.9, alongX: false },
  ];
  const arms: THREE.BufferGeometry[] = [];
  const blocks: THREE.BufferGeometry[] = [];
  for (const b of ring) {
    const mk = (h: number, d: number) => (b.alongX ? worldBox(b.len, h, d, 1) : worldBox(d, h, b.len, 1));
    const beam1 = mesh(mk(0.62, 0.5), M.caihua);
    beam1.position.set(b.x, y - 0.31, b.z);
    group.add(beam1);
    const beam2 = mesh(mk(0.28, 0.62), M.caihua);
    beam2.position.set(b.x, y + 0.14, b.z);
    group.add(beam2);
    if (wall) {
      const wallPanel = mesh(mk(0.9, 0.16), M.green);
      wallPanel.position.set(b.x, y + 0.73, b.z);
      group.add(wallPanel);
    }
    const n = Math.floor(b.len / spacing);
    for (let i = 0; i <= n; i++) {
      const off = -b.len / 2 + 0.45 + (i * (b.len - 0.9)) / n;
      const bx = b.alongX ? b.x + off : b.x;
      const bz = b.alongX ? b.z : b.z + off;
      const arm = b.alongX ? worldBox(0.22, 0.2, 1.5, 1) : worldBox(1.5, 0.2, 0.22, 1);
      arm.translate(bx, y + 0.6, bz);
      const arm2 = b.alongX ? worldBox(0.8, 0.18, 0.24, 1) : worldBox(0.24, 0.18, 0.8, 1);
      arm2.translate(bx, y + 0.86, bz);
      arms.push(arm, arm2);
      for (const dy of [0.4, 0.74, 1.0]) {
        const blk = worldBox(0.34, 0.16, 0.34, 1);
        blk.translate(bx, y + dy, bz);
        blocks.push(blk);
      }
    }
  }
  group.add(mesh(mergeGeometries(arms), M.blue));
  group.add(mesh(mergeGeometries(blocks), M.green));
}

// 御路石上的云纹浮雕
function dragonSlabTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9d4ca';
  g.fillRect(0, 0, 256, 512);
  const r = rng(9);
  g.strokeStyle = 'rgba(120,112,100,0.6)';
  g.lineWidth = 4;
  for (let k = 0; k < 26; k++) {
    const x = 30 + r() * 196, y = 20 + r() * 472, s = 14 + r() * 18;
    for (let q = 0; q < 3; q++) {
      g.beginPath();
      g.arc(x + q * s * 0.8, y, s * (0.6 + q * 0.12), Math.PI, Math.PI * 2);
      g.stroke();
    }
  }
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(128, 10);
  for (let y = 10; y < 500; y += 20) g.lineTo(128 + Math.sin(y * 0.03) * 60, y);
  g.stroke();
  g.strokeStyle = 'rgba(90,84,74,0.8)';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 240, 496);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHall(scene: THREE.Scene): HallBuild {
  const H = HALL;
  const M = chineseMats();
  const group = new THREE.Group();
  const walkables: THREE.Object3D[] = [];
  const interactives: THREE.Object3D[] = [];
  const candleFlames: THREE.Mesh[] = [];
  const blockers: THREE.Object3D[] = [];

  const colTop = H.baseH + H.colH;
  const ceilY = colTop + 1.0;
  const cz = (H.colZFront + H.colZBack) / 2;
  const hd = (H.colZFront - H.colZBack) / 2;

  // —— 白石须弥座：下枋、束腰、上枋 ——
  const bw = H.baseX1 - H.baseX0;
  const bd = H.baseZ1 - H.baseZ0;
  const bx = (H.baseX0 + H.baseX1) / 2;
  const bz = (H.baseZ0 + H.baseZ1) / 2;
  const lower = mesh(worldBox(bw + 0.3, 0.32, bd + 0.3, 1), M.marbleSide);
  lower.position.set(bx, 0.16, bz);
  group.add(lower);
  const waist = mesh(worldBox(bw - 0.3, H.baseH - 0.6, bd - 0.3, 1), M.marbleSide);
  waist.position.set(bx, 0.32 + (H.baseH - 0.6) / 2, bz);
  group.add(waist);
  const base = mesh(worldBox(bw, 0.28, bd, 1), [M.marbleSide, M.marbleSide, M.marble, M.marble, M.marbleSide, M.marbleSide]);
  base.position.set(bx, H.baseH - 0.14, bz);
  base.name = 'walkable';
  group.add(base);
  walkables.push(base);
  const posts: THREE.BufferGeometry[] = [];
  for (let x = H.baseX0 + 0.4; x < H.baseX1; x += 1.6) {
    const g = worldBox(0.16, H.baseH - 0.6, 0.06, 1);
    g.translate(x, 0.32 + (H.baseH - 0.6) / 2, H.baseZ1 - 0.12);
    posts.push(g);
  }
  group.add(mesh(mergeGeometries(posts), M.marble));

  // 台阶：两侧踏步，正中一块御路石
  const steps = 5;
  const stepDepth = (H.stepZ1 - H.stepZ0) / steps;
  for (let k = 0; k < steps; k++) {
    const top = ((k + 1) / steps) * H.baseH;
    const z1 = H.stepZ1 - k * stepDepth;
    const s = mesh(worldBox(H.stepX1 - H.stepX0, top, z1 - H.stepZ0, 1), M.marble);
    s.position.set(0, top / 2, (H.stepZ0 + z1) / 2);
    s.name = 'walkable';
    group.add(s);
    walkables.push(s);
  }
  {
    const len = Math.hypot(H.stepZ1 - H.stepZ0, H.baseH);
    const slab = mesh(worldBox(2.2, 0.12, len, 1), new THREE.MeshStandardMaterial({ map: dragonSlabTexture(), roughness: 0.8 }), false);
    slab.position.set(0, H.baseH / 2 + 0.1, (H.stepZ0 + H.stepZ1) / 2);
    slab.rotation.x = Math.atan2(H.baseH, H.stepZ1 - H.stepZ0);
    group.add(slab);
  }
  // 白石栏杆：望柱 + 寻杖 + 栏板，正面台阶处断开
  const rail: THREE.BufferGeometry[] = [];
  const railY = H.baseH;
  const addRail = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.8));
    const ang = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      const p = worldBox(0.2, 1.05, 0.2, 1);
      p.translate(x, railY + 0.52, z);
      rail.push(p);
      const head = new THREE.SphereGeometry(0.13, 8, 6);
      head.translate(x, railY + 1.12, z);
      rail.push(head);
    }
    for (const [hh, t, yy] of [[0.1, 0.12, 0.86], [0.5, 0.08, 0.36]] as [number, number, number][]) {
      const g = worldBox(len, hh, t, 1);
      g.rotateY(-ang);
      g.translate((x0 + x1) / 2, railY + yy, (z0 + z1) / 2);
      rail.push(g);
    }
  };
  const e = 0.18;
  addRail(H.baseX0 + e, H.baseZ1 - e, H.stepX0 - 0.3, H.baseZ1 - e);
  addRail(H.stepX1 + 0.3, H.baseZ1 - e, H.baseX1 - e, H.baseZ1 - e);
  addRail(H.baseX0 + e, H.baseZ0 + e, H.baseX0 + e, H.baseZ1 - e);
  addRail(H.baseX1 - e, H.baseZ0 + e, H.baseX1 - e, H.baseZ1 - e);
  addRail(H.baseX0 + e, H.baseZ0 + e, H.baseX1 - e, H.baseZ0 + e);
  for (const sx of [H.stepX0 - 0.25, H.stepX1 + 0.25]) {
    const g = worldBox(0.5, 0.3, Math.hypot(H.stepZ1 - H.stepZ0, H.baseH), 1);
    g.rotateX(Math.atan2(H.baseH, H.stepZ1 - H.stepZ0));
    g.translate(sx, H.baseH / 2 + 0.15, (H.stepZ0 + H.stepZ1) / 2);
    rail.push(g);
  }
  // 几何体属性要一致才能合并：球体没有和盒子不同的属性，这里统一去掉索引外的差异
  group.add(mesh(mergeGeometries(rail.map((g) => (g.index ? g.toNonIndexed() : g))), M.marble));

  // —— 殿内方砖地（金砖）——
  const floorMat = pbr('granite', { metersPerTile: 1.3, color: '#6f6b66', roughness: 0.7 });
  const fw = H.wallX * 2 + 0.6;
  const fz0 = H.backZ;
  const fz1 = H.colZFront + 0.9;
  const floor = mesh(worldBox(fw, 0.06, fz1 - fz0, 1), floorMat, false);
  floor.position.set(0, H.baseH + 0.03, (fz0 + fz1) / 2);
  floor.name = 'walkable';
  group.add(floor);
  walkables.push(floor);

  // —— 朱红柱子与覆盆柱础 ——
  const colGeo = meterUV(new THREE.CylinderGeometry(0.37, 0.42, H.colH - 0.22, 24), 2.5, H.colH);
  const plinthGeo = lathe([[0, 0], [0.62, 0], [0.62, 0.06], [0.55, 0.14], [0.45, 0.22], [0, 0.22]], 24);
  const columns: [number, number][] = [];
  for (const x of H.colX) columns.push([x, H.colZFront], [x, H.colZBack]);
  for (const z of H.colZSide) columns.push([-H.wallX, z], [H.wallX, z]);
  for (const [x, z] of columns) {
    const p = mesh(plinthGeo, M.marble);
    p.position.set(x, H.baseH, z);
    group.add(p);
    const c = mesh(colGeo, M.red);
    c.position.set(x, H.baseH + 0.22 + (H.colH - 0.22) / 2, z);
    group.add(c);
    blockers.push(c);
  }

  // —— 梁枋与斗栱（下檐）——
  beamRing(group, 0, cz, H.wallX, hd, colTop, M);

  // —— 正面格扇门：中间三间敞开，两侧四间关着；门上是横披窗 ——
  const doorTop = colTop - 1.0;
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < H.colX.length - 1; i++) {
    const x0 = H.colX[i] + 0.38, x1 = H.colX[i + 1] - 0.38;
    const open = x1 < 6.5 && x0 > -6.5;
    const tw = new THREE.BoxGeometry(x1 - x0, 0.75, 0.1);
    tw.translate((x0 + x1) / 2, doorTop + 0.5, H.colZFront);
    gs.push(tw);
    if (open) continue;
    const leaves = 4;
    for (let k = 0; k < leaves; k++) {
      const w = (x1 - x0) / leaves;
      const leaf = new THREE.BoxGeometry(w - 0.04, doorTop - H.baseH - 0.05, 0.1);
      leaf.translate(x0 + w * (k + 0.5), H.baseH + (doorTop - H.baseH) / 2, H.colZFront);
      gs.push(leaf);
    }
  }
  const doors = mesh(mergeGeometries(gs), M.geshan);
  group.add(doors);
  blockers.push(doors);
  for (let i = 0; i < H.colX.length - 1; i++) {
    const x0 = H.colX[i] + 0.38, x1 = H.colX[i + 1] - 0.38;
    const top = mesh(worldBox(x1 - x0, 0.16, 0.22, 1), M.red);
    top.position.set((x0 + x1) / 2, doorTop + 0.08, H.colZFront);
    group.add(top);
  }

  // —— 侧墙与后墙：外面红墙，里面千佛壁 ——
  const wallZ0 = H.backZ + 0.2;
  const wallZ1 = H.colZFront - 0.45;
  const wallLen = wallZ1 - wallZ0;
  const wallCz = (wallZ0 + wallZ1) / 2;
  const tbTex = thousandBuddhaTexture();
  tbTex.repeat.set(wallLen / 3.2, (H.colH - 1.6) / 3.2);
  const tbMat = new THREE.MeshStandardMaterial({ map: tbTex, roughness: 0.75, emissive: '#ffffff', emissiveMap: tbTex, emissiveIntensity: 0.08 });
  for (const sx of [-1, 1]) {
    const x = sx * H.wallX;
    const w = mesh(worldBox(0.4, H.colH, wallLen, 1), M.redWall);
    w.position.set(x, H.baseH + H.colH / 2, wallCz);
    group.add(w);
    blockers.push(w);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, H.colH - 1.6), tbMat);
    inner.rotation.y = -sx * Math.PI / 2;
    inner.position.set(x - sx * 0.21, H.baseH + 0.9 + (H.colH - 1.6) / 2, wallCz);
    group.add(inner);
    const dado = mesh(worldBox(0.06, 0.8, wallLen, 1), M.redDark, false);
    dado.position.set(x - sx * 0.22, H.baseH + 0.4, wallCz);
    group.add(dado);
  }
  const back = mesh(worldBox(H.wallX * 2, ceilY - H.baseH, 0.4, 1), M.redWall);
  back.position.set(0, H.baseH + (ceilY - H.baseH) / 2, H.backZ);
  group.add(back);
  blockers.push(back);
  const cloudTex = redGoldCloudTexture();
  cloudTex.repeat.set(7, 2);
  const screenH = ceilY - H.baseH - H.altarH - 0.2;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(H.altarX1 - H.altarX0 + 1, screenH), new THREE.MeshStandardMaterial({ map: cloudTex, roughness: 0.7, emissive: '#2a0a06', emissiveIntensity: 0.4 }));
  screen.position.set(0, H.baseH + H.altarH + screenH / 2, H.colZBack + 0.5);
  group.add(screen);

  // —— 天花：井口天花 + 彩画大梁 ——
  const coffer = cofferTexture();
  coffer.repeat.set(1 / 1.6, 1 / 1.6);
  const ceil = new THREE.Mesh(worldBox(H.wallX * 2, 0.08, H.colZFront - H.colZBack, 1), new THREE.MeshStandardMaterial({ map: coffer, roughness: 0.8, emissive: '#ffffff', emissiveMap: coffer, emissiveIntensity: 0.06 }));
  ceil.position.set(0, ceilY + 0.04, cz);
  ceil.receiveShadow = true;
  group.add(ceil);
  for (const z of H.colZSide) {
    const b = mesh(worldBox(H.wallX * 2, 0.7, 0.55, 1), M.caihua, false);
    b.position.set(0, colTop + 0.35, z);
    group.add(b);
  }

  // —— 重檐屋顶：下檐一圈 + 上层墙身（挂匾）+ 上檐 ——
  const iW = H.wallX - 1.6;
  const iD = hd - 1.6;
  const lowRoof = buildSkirtRoof({ cx: 0, cz, iW, iD, oW: H.wallX + 3.1, oD: hd + 3.1, yIn: colTop + 1.75, yOut: colTop + 0.75, lift: 0.85 });
  group.add(lowRoof);
  blockers.push(lowRoof);
  const upperH = 2.3;
  const upperBase = colTop + 1.5;
  const upper = mesh(worldBox(iW * 2, upperH, iD * 2, 1), M.redWall);
  upper.position.set(0, upperBase + upperH / 2, cz);
  group.add(upper);
  blockers.push(upper);
  beamRing(group, 0, cz, iW, iD, upperBase + upperH, M, 1.1, false);
  const upRoof = buildRoof({ cx: 0, cz, W: iW + 2.6, D: iD + 2.6, rx: iW * 0.62, eaveY: upperBase + upperH + 0.75, ridgeY: upperBase + upperH + 5.2, lift: 1.15, ornate: true });
  group.add(upRoof);
  blockers.push(upRoof);

  // —— 匾额「大雄寶殿」：挂在上下檐之间，前面没有斗栱遮挡 ——
  const pw = 5.6, ph = pw * (340 / (260 * 4 + 140));
  const plaque = mesh(new THREE.BoxGeometry(pw, ph, 0.16), [M.gold, M.gold, M.gold, M.gold, new THREE.MeshStandardMaterial({ map: plaqueTexture('大雄寶殿'), roughness: 0.5, metalness: 0.2, emissive: '#1a1a1a', emissiveIntensity: 0.2 }), M.redDark]);
  plaque.position.set(0, upperBase + upperH * 0.5, cz + iD + 0.25);
  plaque.rotation.x = -0.08;
  group.add(plaque);

  // —— 佛坛：朱漆须弥座，金线 ——
  const aw = H.altarX1 - H.altarX0;
  const ad = H.altarZ1 - H.altarZ0;
  const az = (H.altarZ0 + H.altarZ1) / 2;
  const altar = mesh(worldBox(aw, H.altarH, ad, 1), M.red);
  altar.position.set(0, H.baseH + H.altarH / 2, az);
  group.add(altar);
  for (const yy of [0.06, H.altarH - 0.04]) {
    const t = mesh(worldBox(aw + 0.16, 0.1, ad + 0.16, 1), M.gold);
    t.position.set(0, H.baseH + yy, az);
    group.add(t);
  }
  for (let i = 0; i < 11; i++) {
    const p = mesh(new THREE.BoxGeometry(aw / 11 - 0.3, H.altarH - 0.4, 0.03), M.redDark, false);
    p.position.set(H.altarX0 + (i + 0.5) * (aw / 11), H.baseH + H.altarH / 2, H.altarZ1 + 0.012);
    group.add(p);
  }
  const altarTop = H.baseH + H.altarH;
  const statueSlots = [
    { x: 0, y: altarTop, z: az + 0.2, kind: 'main' as const },
    { x: -6.4, y: altarTop, z: az + 0.15, kind: 'left' as const },
    { x: 6.4, y: altarTop, z: az + 0.15, kind: 'right' as const },
  ];

  // 华盖：主尊头顶的八角宝盖，垂着流苏
  {
    const hg = new THREE.Group();
    hg.add(mesh(lathe([[0, 0.5], [0.5, 0.48], [1.4, 0.2], [1.6, 0], [0, 0]], 8), M.gold));
    const skirtTex = bannerTexture();
    const skirt = mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 8, 1, true), new THREE.MeshStandardMaterial({ map: skirtTex, side: THREE.DoubleSide, roughness: 0.7 }), false);
    skirt.position.y = -0.25;
    hg.add(skirt);
    const tasselMat = new THREE.MeshStandardMaterial({ color: '#c9302a', roughness: 0.8 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const tas = mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.9, 6), tasselMat, false);
      tas.position.set(Math.cos(a) * 1.62, -0.9, Math.sin(a) * 1.62);
      hg.add(tas);
    }
    const rod = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), M.gold, false);
    rod.position.y = 0.8;
    hg.add(rod);
    hg.position.set(0, ceilY - 1.0, az + 0.4);
    group.add(hg);
  }
  // 经幡：佛坛前左右各三条
  const banMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.8, side: THREE.DoubleSide });
  const fringeMat = new THREE.MeshStandardMaterial({ color: '#e0b23c', side: THREE.DoubleSide, roughness: 0.8 });
  for (const x of [-11.5, -8.6, -3.9, 3.9, 8.6, 11.5]) {
    const ban = mesh(new THREE.CylinderGeometry(0.26, 0.26, 3.0, 12, 1, true), banMat, false);
    ban.position.set(x, ceilY - 1.9, H.altarZ1 + 1.3);
    group.add(ban);
    const cap = mesh(new THREE.CylinderGeometry(0.06, 0.3, 0.2, 12), M.gold, false);
    cap.position.set(x, ceilY - 0.32, H.altarZ1 + 1.3);
    group.add(cap);
    const fringe = mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.3, 12, 1, true), fringeMat, false);
    fringe.position.set(x, ceilY - 3.55, H.altarZ1 + 1.3);
    group.add(fringe);
  }

  // —— 供桌：朱漆桌面，正面垂黄色桌围；桌上铜鼎香炉、红烛、花瓶、供果 ——
  const tw = H.tableX1 - H.tableX0;
  const td = H.tableZ1 - H.tableZ0;
  const tz = (H.tableZ0 + H.tableZ1) / 2;
  const tableTop = mesh(worldBox(tw + 0.2, 0.1, td + 0.15, 1), M.red);
  tableTop.position.set(0, H.baseH + H.tableH - 0.05, tz);
  group.add(tableTop);
  const tableBody = mesh(worldBox(tw, H.tableH - 0.1, td, 1), M.redDark);
  tableBody.position.set(0, H.baseH + (H.tableH - 0.1) / 2, tz);
  group.add(tableBody);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(tw + 0.1, H.tableH - 0.12), new THREE.MeshStandardMaterial({ map: altarClothTexture(), roughness: 0.75, side: THREE.DoubleSide }));
  cloth.position.set(0, H.baseH + (H.tableH - 0.12) / 2 + 0.01, H.tableZ1 + 0.02);
  group.add(cloth);
  const ttop = H.baseH + H.tableH;

  const pewter = new THREE.MeshStandardMaterial({ color: '#a88848', metalness: 0.8, roughness: 0.4 });
  const candleMat = new THREE.MeshStandardMaterial({ color: '#b3201a', roughness: 0.45, emissive: '#3a0805', emissiveIntensity: 0.4 });
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd28a' });
  const addCandle = (x: number, y: number, z: number, stand = 0.42, h = 0.3) => {
    const holder = mesh(lathe([[0, 0], [0.11, 0], [0.12, 0.04], [0.04, 0.1], [0.035, stand * 0.6], [0.09, stand * 0.66], [0.12, stand - 0.02], [0.11, stand], [0, stand]], 16), pewter);
    holder.position.set(x, y, z);
    group.add(holder);
    const candle = mesh(new THREE.CylinderGeometry(0.04, 0.045, h, 12), candleMat);
    candle.position.set(x, y + stand + h / 2, z);
    group.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), flameMat);
    flame.scale.set(1, 2.3, 1);
    flame.position.set(x, y + stand + h + 0.06, z);
    group.add(flame);
    candleFlames.push(flame);
  };
  for (const x of [-1.35, 1.35]) addCandle(x, ttop, tz - 0.12);
  for (const x of [-3.2, 3.2]) addCandle(x, altarTop, H.altarZ1 - 0.35, 0.7, 0.4);
  const lampGlass = new THREE.MeshStandardMaterial({ color: '#f2c86a', roughness: 0.2, transparent: true, opacity: 0.85, emissive: '#ffb44a', emissiveIntensity: 0.6 });
  for (const x of [-1.7, 1.7]) {
    const lamp = mesh(lathe([[0, 0], [0.06, 0], [0.04, 0.12], [0.16, 0.2], [0.18, 0.3], [0, 0.26]], 16), lampGlass, false);
    lamp.position.set(x, altarTop, H.altarZ1 - 0.35);
    group.add(lamp);
  }
  const vaseMat = new THREE.MeshPhysicalMaterial({ color: '#2f5f8f', roughness: 0.2, clearcoat: 0.9 });
  const lotusMat = new THREE.MeshStandardMaterial({ color: '#f0a8b8', roughness: 0.55 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f6a3a', roughness: 0.7, side: THREE.DoubleSide });
  for (const x of [-0.75, 0.75]) {
    const vase = mesh(lathe([[0, 0], [0.08, 0], [0.12, 0.08], [0.11, 0.2], [0.05, 0.3], [0.045, 0.36], [0.07, 0.4], [0, 0.4]], 20), vaseMat);
    vase.position.set(x, ttop, tz - 0.25);
    group.add(vase);
    const bud = mesh(new THREE.SphereGeometry(0.07, 10, 8), lotusMat, false);
    bud.scale.set(1, 1.4, 1);
    bud.position.set(x, ttop + 0.72, tz - 0.25);
    group.add(bud);
    const stem = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.34, 5), leafMat, false);
    stem.position.set(x, ttop + 0.55, tz - 0.25);
    group.add(stem);
    const leaf = mesh(new THREE.CircleGeometry(0.13, 12), leafMat, false);
    leaf.rotation.set(-1.1, 0, 0.4);
    leaf.position.set(x + 0.06, ttop + 0.5, tz - 0.2);
    group.add(leaf);
  }
  const plateMat = new THREE.MeshStandardMaterial({ color: '#e9e2d0', roughness: 0.4 });
  const fruitMats = ['#e08a2a', '#c43f2b', '#e2b23f'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  for (const [x, z, kind] of [[-1.05, tz + 0.22, 0], [1.05, tz + 0.22, 1]] as [number, number, number][]) {
    const plate = mesh(lathe([[0, 0], [0.07, 0], [0.06, 0.06], [0.18, 0.1], [0.19, 0.12], [0, 0.1]], 20), plateMat);
    plate.position.set(x, ttop, z);
    group.add(plate);
    for (let k = 0; k < 4; k++) {
      const f = mesh(new THREE.SphereGeometry(0.065, 12, 10), fruitMats[(k + kind) % 3]);
      const a = (k / 4) * Math.PI * 2;
      f.position.set(x + (k < 3 ? Math.cos(a) * 0.08 : 0), ttop + 0.16 + (k < 3 ? 0 : 0.1), z + (k < 3 ? Math.sin(a) * 0.08 : 0));
      group.add(f);
    }
  }
  // 铜鼎香炉：三足、两只立耳
  const burner = new THREE.Group();
  burner.add(mesh(lathe([[0, 0.08], [0.2, 0.08], [0.27, 0.14], [0.29, 0.24], [0.26, 0.31], [0.28, 0.33], [0, 0.31]], 32), M.bronze));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const leg = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 8), M.bronze);
    leg.position.set(Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17);
    burner.add(leg);
  }
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI), M.bronze);
    ear.position.set(sx * 0.2, 0.33, 0);
    burner.add(ear);
  }
  const ash = mesh(new THREE.CircleGeometry(0.25, 28), new THREE.MeshStandardMaterial({ color: '#b9b2a4', roughness: 1 }), false);
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.3;
  burner.add(ash);
  burner.position.set(ALTAR_BURNER.x, ttop, ALTAR_BURNER.z);
  burner.traverse((o) => (o.userData.interact = { type: 'altarIncense' }));
  group.add(burner);
  interactives.push(burner);
  const burnerHit = new THREE.Mesh(new THREE.BoxGeometry(tw, 1.2, td + 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  burnerHit.position.set(0, H.baseH + 0.6, tz + 0.3);
  burnerHit.userData.interact = { type: 'altarIncense' };
  group.add(burnerHit);
  interactives.push(burnerHit);
  const altarSandY = ttop + 0.3;

  // 木鱼（左）与铜磬（右），放在红架子上
  {
    const stand = mesh(worldBox(0.8, 0.45, 0.6, 1), M.red);
    stand.position.set(-3.1, H.baseH + 0.225, H.tableZ1 + 0.1);
    group.add(stand);
    const mk = mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#9a4a22', roughness: 0.35, clearcoat: 0.6 }));
    mk.scale.set(1.1, 0.85, 1);
    mk.position.set(-3.1, H.baseH + 0.45 + 0.27, H.tableZ1 + 0.1);
    group.add(mk);
    const slit = mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 32, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: '#2a140a' }));
    slit.rotation.set(Math.PI / 2, 0, Math.PI * 0.1);
    slit.scale.set(1.05, 0.95, 1);
    slit.position.set(-3.1, H.baseH + 0.45 + 0.24, H.tableZ1 + 0.1);
    group.add(slit);
    const stand2 = mesh(lathe([[0, 0], [0.3, 0], [0.3, 0.4], [0.26, 0.45], [0, 0.45]], 20), M.red);
    stand2.position.set(3.1, H.baseH, H.tableZ1 + 0.1);
    group.add(stand2);
    const pad = mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.1, 20), new THREE.MeshStandardMaterial({ color: '#c8952f', roughness: 0.9 }));
    pad.position.set(3.1, H.baseH + 0.5, H.tableZ1 + 0.1);
    group.add(pad);
    const qing = mesh(lathe([[0, 0], [0.12, 0], [0.24, 0.08], [0.32, 0.22], [0.34, 0.32], [0.31, 0.32], [0.29, 0.24], [0.2, 0.12], [0, 0.06]], 32), new THREE.MeshStandardMaterial({ color: '#7a5a2e', metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
    qing.position.set(3.1, H.baseH + 0.55, H.tableZ1 + 0.1);
    group.add(qing);
  }

  // —— 圆蒲团：一个实例化网格，点中时用 instanceId 找回座位 ——
  const cushionGeo = lathe([[0, 0], [0.3, 0], [0.33, 0.04], [0.33, 0.11], [0.29, 0.16], [0, 0.17]], 24);
  const cushionMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
  const cushions = new THREE.InstancedMesh(cushionGeo, cushionMat, CUSHIONS.length);
  const cA = new THREE.Color('#c08a2c');
  const cB = cA.clone().lerp(new THREE.Color('#9b3b24'), 0.18);
  const m4 = new THREE.Matrix4();
  CUSHIONS.forEach((c, i) => {
    m4.makeTranslation(c.x, H.baseH + 0.06, c.z + 0.18);
    cushions.setMatrixAt(i, m4);
    cushions.setColorAt(i, Math.floor(i / 16) % 2 === 0 ? cA : cB);
  });
  cushions.receiveShadow = true;
  cushions.castShadow = true;
  cushions.userData.interact = { type: 'seat', ids: CUSHIONS.map((c) => c.id) };
  group.add(cushions);
  interactives.push(cushions);

  // —— 殿内暖光 ——
  const interiorLights: THREE.PointLight[] = [];
  const l1 = new THREE.PointLight('#ffcf95', 46, 22, 1.5);
  l1.position.set(0, H.baseH + 4.6, H.tableZ1 + 2.2);
  group.add(l1);
  interiorLights.push(l1);
  for (const x of [-8, 8]) {
    const l = new THREE.PointLight('#ffd7a8', 20, 16, 1.6);
    l.position.set(x, H.baseH + 4.6, -10);
    group.add(l);
    interiorLights.push(l);
  }

  scene.add(group);
  return { group, walkables, interactives, candleFlames, interiorLights, blockers, altarSandY, statueSlots };
}
