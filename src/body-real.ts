// 真实比例的僧人身体（身高约 1.68 米）：长到脚踝的海青、带袖兜的宽袖、能弯的手肘和膝盖，
// 头用 Lee Perry-Smith 的人头扫描（CC BY 3.0，见 credits.html），贴图上把胡茬淡化成剃净的样子。
// 关节层级和 Q 版一样（hips → torso → arms / head，hips → legs），所以原有的动作姿势都能直接用。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const REAL = true;
export const R = {
  hip: 0.88, // 站立时胯的高度
  neck: 0.545, // 上身坐标里脖子根的高度
  shoulder: { x: 0.178, y: 0.47 },
  upper: 0.28, // 上臂
  fore: 0.255, // 前臂到手腕
  thigh: 0.43,
  shin: 0.42,
};

const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)))!;
function xf(g: THREE.BufferGeometry, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(...scale));
  return g.applyMatrix4(m);
}
const lerpProfile = (P: [number, number][], y: number) => {
  if (y <= P[0][1]) return P[0][0];
  for (let i = 0; i < P.length - 1; i++) {
    const [r0, y0] = P[i], [r1, y1] = P[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return P[P.length - 1][0];
};

// 上衣（挂在上身，原点在胯）：胸背略宽，前后压扁
const TOP: [number, number][] = [[0.172, -0.1], [0.17, 0.05], [0.18, 0.2], [0.19, 0.33], [0.192, 0.43], [0.17, 0.48], [0.115, 0.525], [0.062, 0.55]];
export const TOP_Z = 0.66;
export const topR = (y: number) => lerpProfile(TOP, y);
// 下摆（挂在胯上）：从腰往下渐宽，垂到脚踝
const SKIRT: [number, number][] = [[0.316, -0.845], [0.31, -0.8], [0.282, -0.62], [0.248, -0.4], [0.212, -0.16], [0.188, -0.02], [0.176, 0.08]];
export const SKIRT_Z = 0.8;
const skirtR = (y: number) => lerpProfile(SKIRT, y);
// 袈裟上沿：左肩最高，右腋下最低（φ 从正前方起算，+x 是人物的左边）
const kasayaTop = (phi: number) => 0.27 + 0.24 * Math.pow((1 + Math.sin(phi)) / 2, 1.6);

// 竖褶：越往下越深
function folds(g: THREE.BufferGeometry, yTop: number, span: number, amp: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const phi = Math.atan2(x, z);
    const t = Math.min(1, Math.max(0, (yTop - y) / span)) ** 1.3;
    const k = 1 + t * (amp * Math.sin(11 * phi + 0.4) + amp * 0.45 * Math.sin(23 * phi + 1.3));
    p.setXYZ(i, x * k, y + t * 0.01 * Math.sin(11 * phi), z * k);
  }
  g.computeVertexNormals();
  return g;
}
const ys = (y0: number, y1: number, n: number) => Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);

export function buildRealGeo() {
  // 腿：大腿裤管与袍同色，小腿白绑腿，深色布鞋（原点在膝/胯关节，向 -y 长）
  const thigh = xf(new THREE.CylinderGeometry(0.072, 0.062, R.thigh, 12), [0, -R.thigh / 2, 0]);
  const shin = merge([
    xf(new THREE.CylinderGeometry(0.056, 0.046, R.shin - 0.04, 12), [0, -(R.shin - 0.04) / 2, 0]),
    xf(new THREE.SphereGeometry(0.058, 12, 8), [0, 0, 0]),
  ]);
  const shoe = merge([
    xf(new THREE.SphereGeometry(1, 16, 10), [0, -R.shin + 0.035, 0.035], [0.05, 0.038, 0.125]),
    xf(new THREE.CylinderGeometry(0.048, 0.05, 0.02, 14), [0, -R.shin + 0.01, 0.03], [1, 1, 2.3]),
  ]);

  // 下摆与上衣
  const skirt = folds(new THREE.LatheGeometry(ys(-0.845, 0.08, 16).map((y) => new THREE.Vector2(skirtR(y), y)), 64), 0.0, 0.85, 0.035);
  skirt.scale(1, 1, SKIRT_Z);
  const top = new THREE.LatheGeometry(ys(-0.1, 0.55, 14).map((y) => new THREE.Vector2(topR(y), y)), 48);
  top.scale(1, 1, TOP_Z);
  for (const g of [skirt, top]) {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3);
  }

  // 交领：从左肩斜到右腰，深色缘边；领口露一道白护领
  const surf = (x: number, y: number, out: number) => {
    const r = topR(y) + out;
    return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * TOP_Z);
  };
  const lapel = (from: [number, number], to: [number, number], out: number, r: number) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      pts.push(surf(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, out));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false);
  };
  const collar = merge([lapel([0.06, 0.54], [-0.15, 0.12], 0.004, 0.016), lapel([-0.06, 0.54], [0.0, 0.42], 0.004, 0.014), xf(new THREE.TorusGeometry(0.074, 0.016, 8, 24), [0, 0.548, 0], [1, 1, 0.9], [Math.PI / 2, 0, 0])]);
  const inner = merge([xf(new THREE.TorusGeometry(0.066, 0.012, 8, 24), [0, 0.56, 0.004], [1, 1, 0.92], [Math.PI / 2, 0, 0]), lapel([0.03, 0.555], [-0.03, 0.49], 0.003, 0.01)]);

  // 袈裟：上身一圈（上沿斜）+ 下摆一圈，田相贴图
  const wrap = (y0: number, top: (phi: number) => number, rad: (y: number) => number, zs: number, out: number, rows: number) => {
    const SEG = 64;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const phi = (i / SEG) * Math.PI * 2;
      const t = top(phi);
      for (let j = 0; j <= rows; j++) {
        const y = y0 + ((t - y0) * j) / rows;
        const r = rad(y) + out;
        pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r * zs);
        uv.push((i / SEG) * 2, j / rows);
      }
    }
    for (let i = 0; i < SEG; i++)
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j, b = (i + 1) * (rows + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const kasaya = wrap(-0.09, kasayaTop, topR, TOP_Z, 0.01, 12);
  const skirtKasaya = folds(wrap(-0.6, () => 0.07, skirtR, SKIRT_Z, 0.01, 10), 0.0, 0.62, 0.03);
  // 钩环：左胸前的金环
  const phiR = 0.6, yR = kasayaTop(phiR) - 0.05, rR = topR(yR) + 0.02;
  const ring = xf(new THREE.TorusGeometry(0.03, 0.008, 8, 18), [Math.sin(phiR) * rR, yR, Math.cos(phiR) * rR * TOP_Z], [1, 1, 1], [0, phiR, 0]);
  const shoulderCap = xf(new THREE.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, 0.005, 0]);

  // 颈上念珠：绕颈后、垂到胸前
  const malaPts: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * Math.PI * 2;
    const y = 0.545 - 0.26 * Math.pow((1 + Math.cos(phi)) / 2, 3);
    const r = topR(y) + 0.02;
    malaPts.push(new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r * TOP_Z + 0.006));
  }
  const malaCurve = new THREE.CatmullRomCurve3(malaPts, true);
  const malaParts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 40; k++) {
    const p = malaCurve.getPointAt(0.03 + (k / 39) * 0.94);
    malaParts.push(xf(new THREE.SphereGeometry(0.0095, 8, 6), [p.x, p.y, p.z]));
  }
  const g0 = malaCurve.getPointAt(0);
  malaParts.push(xf(new THREE.SphereGeometry(0.015, 10, 8), [g0.x, g0.y - 0.003, g0.z + 0.004]));
  malaParts.push(xf(new THREE.ConeGeometry(0.011, 0.05, 8), [g0.x, g0.y - 0.045, g0.z + 0.006]));
  const mala = merge(malaParts);

  // 袖子：上臂一段筒袖；前臂一段宽袖，下侧垂成袖兜（双手交叠在身前时兜在下面）
  const upperSleeve = merge([
    xf(new THREE.CylinderGeometry(0.062, 0.078, R.upper, 18, 3, true), [0, -R.upper / 2, 0]),
    xf(new THREE.SphereGeometry(0.066, 16, 10), [0, -0.005, 0], [1, 0.9, 1]),
  ]);
  const bell = new THREE.CylinderGeometry(0.08, 0.135, R.fore - 0.02, 28, 8, true);
  {
    const p = bell.attributes.position as THREE.BufferAttribute;
    const h = R.fore - 0.02;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i), x = p.getX(i);
      const t = (h / 2 - y) / h; // 0 在肘，1 在袖口
      const down = Math.max(0, -z / 0.135);
      p.setXYZ(i, x, y - h / 2 - t * t * 0.05 * down, z - t * t * 0.17 * down);
    }
    bell.computeVertexNormals();
  }
  const foreSleeve = bell;

  // 手：手掌、四指并拢略弯、拇指（原点在手腕，向 -y）
  const hand = (sx: number) =>
    merge([
      xf(new THREE.SphereGeometry(1, 14, 10), [0, -0.045, 0], [0.038, 0.055, 0.019]),
      xf(new THREE.CapsuleGeometry(0.016, 0.06, 4, 8), [0, -0.105, 0.006], [1.9, 1, 0.9], [0.25, 0, 0]),
      xf(new THREE.CapsuleGeometry(0.011, 0.04, 4, 8), [-sx * 0.032, -0.05, 0.018], [1, 1, 1], [0.5, 0, sx * 0.6]),
    ]);
  return { thigh, shin, shoe, skirt, top, collar, inner, kasaya, skirtKasaya, ring, shoulderCap, mala, upperSleeve, foreSleeve, handL: hand(1), handR: hand(-1) };
}

// —— 头：只下载一次，所有僧人共用 ——
let headP: Promise<{ geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }> | null = null;
export function loadHead() {
  headP ??= (async () => {
    const base = new URL('models/head/', document.baseURI).toString();
    const [gltf, col, nor] = await Promise.all([
      new GLTFLoader().loadAsync(base + 'LeePerrySmith.glb'),
      new THREE.TextureLoader().loadAsync(base + 'Map-COL.jpg'),
      new THREE.TextureLoader().loadAsync(base + 'Infinite-Level_02_Tangent_SmoothUV.jpg'),
    ]);
    let src: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !src) src = o as THREE.Mesh;
    });
    let geometry = (src as unknown as THREE.Mesh).geometry.clone();
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    // 扫描连着一截胸口和肩膀：按高度切片找脖子最细处，切掉它以下的部分（埋进领口）
    const pa = geometry.attributes.position as THREE.BufferAttribute;
    const H0 = bb.max.y - bb.min.y;
    const N = 40;
    const width = new Array(N).fill(0);
    for (let i = 0; i < pa.count; i++) {
      const k = Math.min(N - 1, Math.floor(((pa.getY(i) - bb.min.y) / H0) * N));
      width[k] = Math.max(width[k], Math.abs(pa.getX(i) - (bb.min.x + bb.max.x) / 2));
    }
    let neckK = 4;
    for (let k = 4; k < N * 0.55; k++) if (width[k] < width[neckK]) neckK = k;
    const neckY = bb.min.y + ((neckK + 0.5) / N) * H0;
    const cutY = neckY - H0 * 0.05;
    {
      const src2 = geometry.index ? geometry.toNonIndexed() : geometry;
      const P = src2.attributes.position as THREE.BufferAttribute;
      const keep: number[] = [];
      for (let t = 0; t < P.count; t += 3) if (Math.min(P.getY(t), P.getY(t + 1), P.getY(t + 2)) > cutY) keep.push(t);
      const out = new THREE.BufferGeometry();
      for (const name of Object.keys(src2.attributes)) {
        const A = src2.attributes[name] as THREE.BufferAttribute;
        const arr = new Float32Array(keep.length * 3 * A.itemSize);
        keep.forEach((t, j) => {
          for (let v = 0; v < 3; v++) for (let c = 0; c < A.itemSize; c++) arr[(j * 3 + v) * A.itemSize + c] = A.array[(t + v) * A.itemSize + c];
        });
        out.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
      }
      geometry = out;
    }
    // 头顶到脖子最细处约 26 厘米；脖子最细处放在原点
    const s = 0.26 / (bb.max.y - neckY);
    geometry.translate(-(bb.min.x + bb.max.x) / 2, -neckY, -(bb.min.z + bb.max.z) / 2);
    geometry.scale(s, s, s);
    geometry.computeBoundingSphere();
    // 剃净的脸：把下半张脸的胡茬用肤色盖淡，再整体略提一点暖色
    const img = col.image as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const W = c.width / 1024;
    const grd = g.createRadialGradient(512 * W, 560 * W, 40 * W, 512 * W, 560 * W, 270 * W);
    grd.addColorStop(0, 'rgba(222,178,152,0.72)');
    grd.addColorStop(0.65, 'rgba(222,178,152,0.55)');
    grd.addColorStop(1, 'rgba(222,178,152,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgb(255,238,224)';
    g.fillRect(0, 0, c.width, c.height);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.flipY = false;
    map.anisotropy = 4;
    nor.flipY = false;
    const material = new THREE.MeshStandardMaterial({ map, normalMap: nor, roughness: 0.52 });
    return { geometry, material };
  })();
  return headP;
}
