// 放生池里的荷：浮在水面的圆荷叶（叶脉从中心放射、边缘微微起伏）、
// 几片高出水面的立叶、盛开的荷花（三层花瓣、莲蓬）和花苞，都用实例化网格画
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { POND } from '../layout';
import { rng } from '../textures';

const WATER = -0.16;

export function leafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, '#9fb86a');
  grd.addColorStop(0.12, '#6f9446');
  grd.addColorStop(0.75, '#58803a');
  grd.addColorStop(1, '#456b2e');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const r = rng(77);
  // 叶面上细小的明暗斑
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,220,0.05)' : 'rgba(20,40,10,0.06)';
    g.beginPath();
    g.arc(r() * 256, r() * 256, 1 + r() * 4, 0, Math.PI * 2);
    g.fill();
  }
  // 叶脉：从中心放射，到边上分叉
  g.strokeStyle = 'rgba(214,230,170,0.55)';
  g.lineCap = 'round';
  const N = 19;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 + r() * 0.08;
    const bend = (r() - 0.5) * 0.18;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(128, 128);
    const mx = 128 + Math.cos(a + bend) * 70, my = 128 + Math.sin(a + bend) * 70;
    const ex = 128 + Math.cos(a) * 124, ey = 128 + Math.sin(a) * 124;
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    g.lineWidth = 1.1;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
      g.lineTo(128 + Math.cos(a + s * 0.11) * 122, 128 + Math.sin(a + s * 0.11) * 122);
      g.stroke();
    }
  }
  g.fillStyle = '#c8d79a';
  g.beginPath();
  g.arc(128, 128, 6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 极坐标网格做的叶子：半径 1，cup 控制碗形，wave 控制边缘起伏
export function leafGeometry(seed: number, cup: number, wave: number) {
  const r = rng(seed);
  const R = 6, S = 40;
  const ph = r() * 6, ph2 = r() * 6;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  pos.push(0, 0, 0);
  uv.push(0.5, 0.5);
  for (let i = 1; i <= R; i++) {
    const t = i / R;
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const rr = t * (1 + 0.035 * Math.sin(a * 7 + ph) * t);
      const y = cup * t * t + wave * t * t * t * Math.sin(a * 5 + ph2);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uv.push(0.5 + Math.cos(a) * t * 0.5, 0.5 + Math.sin(a) * t * 0.5);
    }
  }
  for (let j = 0; j < S; j++) idx.push(0, 1 + ((j + 1) % S), 1 + j);
  for (let i = 1; i < R; i++) {
    const a0 = 1 + (i - 1) * S, a1 = 1 + i * S;
    for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S;
      idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function paint(g: THREE.BufferGeometry, f: (x: number, y: number, z: number) => THREE.Color) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = f(p.getX(i), p.getY(i), p.getZ(i));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// 一片花瓣：沿 +y 生长，宽在 x，两边向 +z 卷起（+z 是朝花心的一面）；根部乳白、尖上粉红
function petal(len: number, wid: number) {
  const U = 6, V = 9;
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= V; j++) {
    const v = j / V;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.min(0.98, v * 0.92 + 0.04)), 0.75) * (1 - 0.3 * v);
    for (let i = 0; i <= U; i++) {
      const u = (i / U) * 2 - 1;
      pos.push(u * w, v * len, u * u * wid * 0.55 - Math.sin(v * Math.PI) * wid * 0.25);
    }
  }
  for (let j = 0; j < V; j++)
    for (let i = 0; i < U; i++) {
      const a = j * (U + 1) + i, b = a + U + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const base = new THREE.Color('#fbf4ec'), tip = new THREE.Color('#e5718e');
  return paint(g, (_x, y) => base.clone().lerp(tip, Math.pow(Math.min(1, y / len), 1.8)));
}

export function flowerGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const ring = (n: number, len: number, wid: number, tilt: number, off: number, y: number) => {
    for (let k = 0; k < n; k++) {
      const g = petal(len, wid);
      g.rotateX(tilt);
      g.translate(0, y, -0.03);
      g.rotateY((k / n) * Math.PI * 2 + off);
      parts.push(g);
    }
  };
  // rotateX 负角让花瓣尖向 -z（花外侧）张开，卷起的一面朝上朝里，再绕 y 排一圈
  ring(9, 0.15, 0.06, -1.15, 0, 0.0);
  ring(8, 0.14, 0.055, -0.72, 0.35, 0.01);
  ring(6, 0.12, 0.05, -0.35, 0.1, 0.02);
  const pod = new THREE.CylinderGeometry(0.035, 0.028, 0.04, 14, 1);
  pod.translate(0, 0.045, 0);
  paint(pod, (_x, y) => new THREE.Color(y > 0.06 ? '#c9c45a' : '#d8b44a'));
  parts.push(pod.toNonIndexed());
  const stamen = new THREE.TorusGeometry(0.04, 0.012, 6, 18);
  stamen.rotateX(Math.PI / 2);
  stamen.translate(0, 0.03, 0);
  paint(stamen, () => new THREE.Color('#f0c43a'));
  parts.push(stamen.toNonIndexed());
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.4, 6, 1, true);
  stem.translate(0, -0.2, 0);
  paint(stem, () => new THREE.Color('#5d7a35'));
  parts.push(stem.toNonIndexed());
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    g.deleteAttribute('uv');
    return g;
  }))!;
}

export function budGeometry() {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.05 * (1 - t * 0.3), t * 0.16));
  }
  const g = new THREE.LatheGeometry(pts, 12);
  const base = new THREE.Color('#f3e2d6'), tip = new THREE.Color('#dc5d80');
  paint(g, (_x, y) => base.clone().lerp(tip, Math.pow(y / 0.16, 1.5)));
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.5, 6, 1, true);
  stem.translate(0, -0.25, 0);
  paint(stem, () => new THREE.Color('#5d7a35'));
  return mergeGeometries([g.toNonIndexed(), stem.toNonIndexed()].map((x) => {
    x.deleteAttribute('uv');
    return x;
  }))!;
}

export function buildLotus(group: THREE.Group) {
  const r = rng(4242);
  const inside = (x: number, z: number, k: number) => ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < k * k;
  // 叶子成丛长，避开中间的石拱桥
  const clumps: { x: number; z: number }[] = [];
  for (const [cx, cz] of [[-7.5, 50.5], [-4.6, 54.6], [6.8, 49.8], [5.2, 54.8], [-8.6, 54.2], [8.8, 53.6]]) clumps.push({ x: cx, z: cz });
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture(), roughness: 0.62, side: THREE.DoubleSide });
  const floatGeos = [1, 2, 3].map((k) => leafGeometry(k * 13, 0.03, 0.025));
  const standGeo = leafGeometry(91, 0.32, 0.06);
  const floatMeshes = floatGeos.map((g) => new THREE.InstancedMesh(g, leafMat, 16));
  floatMeshes.forEach((m) => {
    m.count = 0;
    m.receiveShadow = true;
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const tint = new THREE.Color();
  const leaves: { x: number; z: number; s: number }[] = [];
  for (const c of clumps) {
    const n = 6 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1.6;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (!inside(x, z, 0.86) || Math.abs(x) < 2.6) continue;
      const s = 0.22 + r() * 0.2;
      if (leaves.some((L) => Math.hypot(L.x - x, L.z - z) < (L.s + s) * 0.8)) continue;
      leaves.push({ x, z, s });
      const im = floatMeshes[leaves.length % 3];
      if (im.count >= 16) continue;
      e.set((r() - 0.5) * 0.06, r() * 6.28, (r() - 0.5) * 0.06);
      m4.compose(new THREE.Vector3(x, WATER + 0.012, z), q.setFromEuler(e), new THREE.Vector3(s, s, s));
      im.setMatrixAt(im.count, m4);
      im.setColorAt(im.count, tint.setHSL(0.24 + (r() - 0.5) * 0.05, 0.25 + r() * 0.2, 0.62 + r() * 0.2));
      im.count++;
    }
  }
  group.add(...floatMeshes);

  // 高出水面的立叶（碗形）和荷花、花苞
  const stand = new THREE.InstancedMesh(standGeo, leafMat, clumps.length * 2);
  const stemMat = new THREE.MeshStandardMaterial({ color: '#5a7634', roughness: 0.8 });
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.016, 1, 6, 1, true), stemMat, clumps.length * 2);
  stand.castShadow = true;
  const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, emissive: '#3a1a22', emissiveIntensity: 0.12 });
  const flowers = new THREE.InstancedMesh(flowerGeometry(), flowerMat, clumps.length);
  const buds = new THREE.InstancedMesh(budGeometry(), flowerMat, clumps.length);
  flowers.castShadow = buds.castShadow = true;
  clumps.forEach((c, i) => {
    for (let k = 0; k < 2; k++) {
      const a = r() * 6.28;
      const x = c.x + Math.cos(a) * (0.4 + r() * 0.7), z = c.z + Math.sin(a) * (0.4 + r() * 0.7);
      const h = 0.35 + r() * 0.45;
      const s = 0.26 + r() * 0.12;
      e.set((r() - 0.5) * 0.35, r() * 6.28, (r() - 0.5) * 0.35);
      m4.compose(new THREE.Vector3(x, WATER + h, z), q.setFromEuler(e), new THREE.Vector3(s, s, s));
      stand.setMatrixAt(i * 2 + k, m4);
      stand.setColorAt(i * 2 + k, tint.setHSL(0.25, 0.3, 0.7 + r() * 0.15));
      m4.compose(new THREE.Vector3(x, WATER + h / 2, z), q.identity(), new THREE.Vector3(1, h, 1));
      stems.setMatrixAt(i * 2 + k, m4);
    }
    const fx = c.x + (r() - 0.5) * 0.8, fz = c.z + (r() - 0.5) * 0.8;
    const fh = 0.28 + r() * 0.2;
    e.set((r() - 0.5) * 0.15, r() * 6.28, (r() - 0.5) * 0.15);
    const fs = 1.1 + r() * 0.4;
    m4.compose(new THREE.Vector3(fx, WATER + fh, fz), q.setFromEuler(e), new THREE.Vector3(fs, fs, fs));
    flowers.setMatrixAt(i, m4);
    const bx = c.x + (r() - 0.5) * 1.2, bz = c.z + (r() - 0.5) * 1.2;
    e.set((r() - 0.5) * 0.2, r() * 6.28, (r() - 0.5) * 0.2);
    m4.compose(new THREE.Vector3(bx, WATER + 0.3 + r() * 0.2, bz), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    buds.setMatrixAt(i, m4);
  });
  group.add(stand, stems, flowers, buds);
  return leaves;
}
