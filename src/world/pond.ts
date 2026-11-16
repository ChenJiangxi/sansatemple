// 放生池：会倒映寺院的水面（半分辨率的镜面相机 + 菲涅尔 + 细浪 + 一圈圈波纹）、水下的锦鲤、
// 撒下的鱼食、漂在水上的莲花河灯（玩家放的灯按种子算轨迹，同房间的人看到的位置一致），
// 以及夜里寺里自己放的几盏常亮河灯。
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { POND } from '../layout';

export const WATER_Y = -0.16;
const MAX_RIP = 24;

export interface LanternItem {
  id: string;
  seed: number; // 0..1
  start: number; // 毫秒（服务器时钟）
  until: number;
  mine: boolean;
}

const WaterShader = {
  name: 'PondWater',
  uniforms: {
    color: { value: null as THREE.Color | null },
    tDiffuse: { value: null as THREE.Texture | null },
    textureMatrix: { value: null as THREE.Matrix4 | null },
    uTime: { value: 0 },
    uRip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4(0, 0, -100, 0)) },
    uDeep: { value: new THREE.Color('#123029') },
    uShallow: { value: new THREE.Color('#2f5a4c') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(1, 1, 1) },
    uNight: { value: 0 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUvR;
    varying vec3 vWorld;
    void main() {
      vUvR = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uNight;
    uniform vec4 uRip[${MAX_RIP}];
    uniform vec3 uDeep, uShallow, uSunDir, uSunCol;
    varying vec4 vUvR;
    varying vec3 vWorld;
    void main() {
      vec2 p = vWorld.xz;
      // 细浪：几组方向不同的正弦波，叠成水面的斜率
      vec2 s = vec2(0.0);
      s += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 2.1 + uTime * 0.9) * 0.018;
      s += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 3.3 + uTime * 1.3) * 0.012;
      s += vec2(0.95, -0.3) * cos(dot(p, vec2(0.95, -0.3)) * 5.7 - uTime * 1.7) * 0.008;
      s += vec2(-0.2, -0.98) * cos(dot(p, vec2(-0.2, -0.98)) * 9.1 + uTime * 2.3) * 0.005;
      // 波纹：每个涟漪是一圈向外扩散、慢慢变弱的环
      for (int i = 0; i < ${MAX_RIP}; i++) {
        vec4 r = uRip[i];
        float age = uTime - r.z;
        if (age < 0.0 || age > 4.0) continue;
        vec2 d = p - r.xy;
        float dist = length(d) + 1e-4;
        float front = 0.05 + age * 0.75;
        float x = (dist - front) / (0.09 + age * 0.05);
        float env = exp(-x * x) * exp(-age * 1.1) * r.w;
        s += (d / dist) * env * sin(x * 3.2) * 0.22;
      }
      vec3 N = normalize(vec3(-s.x, 1.0, -s.y));
      vec3 V = normalize(cameraPosition - vWorld);
      float ndv = clamp(dot(N, V), 0.0, 1.0);
      float F = mix(0.1, 0.96, pow(1.0 - ndv, 3.2));
      vec2 uv = vUvR.xy / vUvR.w + s * 0.35;
      vec3 refl = texture2D(tDiffuse, uv).rgb * 0.88;
      float dist = length(cameraPosition - vWorld);
      vec3 body = mix(uDeep, uShallow, pow(ndv, 1.5) * smoothstep(40.0, 6.0, dist));
      body *= mix(1.0, 0.25, uNight);
      vec3 c = mix(body, refl, F);
      // 太阳在水面的亮斑
      vec3 H = normalize(uSunDir + V);
      c += uSunCol * pow(max(dot(N, H), 0.0), 600.0) * 0.45;
      float a = mix(0.62, 1.0, F);
      gl_FragColor = vec4(c, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

// —— 锦鲤 ——
// 花色贴图：一行一个品种，共 8 行。横向 u 从鼻尖到尾柄，纵向 v 绕身体一圈：
// 行的上下边是腹部，中线是背脊，1/3、2/3 处是两侧（眼睛画在这里）。
const KOI_ROWS = 8;
const KOI_KINDS: { fin: string }[] = [
  { fin: '#f4efe6' }, // 红白
  { fin: '#f4efe6' }, // 大正三色
  { fin: '#5a514c' }, // 昭和三色
  { fin: '#f3c24e' }, // 山吹黄金
  { fin: '#f4efe6' }, // 丹顶
  { fin: '#ff9640' }, // 橙黄金
  { fin: '#e79a74' }, // 浅黄
  { fin: '#f4efe6' }, // 红白（另一种斑）
];
function koiTexture() {
  const W = 256, H = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H * KOI_ROWS;
  const g = c.getContext('2d')!;
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const RED = '#e2471c', BLACK = '#1d1a19', WHITE = '#f6f2ea';
  const blob = (y0: number, x: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y0 + 32 + (rnd() - 0.5) * 6, rx, ry, (rnd() - 0.5) * 0.3, 0, Math.PI * 2);
    g.fill();
  };
  const scales = (y0: number, alpha: number, edge = 'rgba(0,0,0,') => {
    g.strokeStyle = `${edge}${alpha})`;
    g.lineWidth = 1;
    for (let x = 60; x < 236; x += 9)
      for (let y = 4; y < 60; y += 6) {
        g.beginPath();
        g.ellipse(x + ((y / 6) % 2) * 4.5, y0 + y, 6, 3.2, 0, -Math.PI / 2, Math.PI / 2);
        g.stroke();
      }
  };
  for (let k = 0; k < KOI_ROWS; k++) {
    const y0 = k * H;
    g.save();
    g.beginPath();
    g.rect(0, y0, W, H);
    g.clip();
    const base = k === 2 ? BLACK : k === 3 ? '#f0b93a' : k === 5 ? '#ff8a2a' : k === 6 ? '#7d93a3' : WHITE;
    g.fillStyle = base;
    g.fillRect(0, y0, W, H);
    if (k === 0 || k === 7) {
      // 红白：头顶一块红，背上两三段红斑
      blob(y0, 24, 18, 12, RED);
      const n = k === 0 ? 3 : 2;
      for (let i = 0; i < n; i++) blob(y0, 70 + i * (k === 0 ? 55 : 75) + rnd() * 12, 22 + rnd() * 14, 13 + rnd() * 6, RED);
    } else if (k === 1) {
      blob(y0, 26, 17, 11, RED);
      blob(y0, 92, 30, 15, RED);
      blob(y0, 170, 22, 12, RED);
      for (let i = 0; i < 7; i++) blob(y0, 70 + rnd() * 150, 4 + rnd() * 5, 3 + rnd() * 4, BLACK);
    } else if (k === 2) {
      // 昭和：黑底，红斑和白斑交错
      for (let i = 0; i < 3; i++) blob(y0, 30 + i * 70 + rnd() * 10, 20 + rnd() * 10, 12 + rnd() * 5, RED);
      for (let i = 0; i < 3; i++) blob(y0, 60 + i * 62 + rnd() * 10, 12 + rnd() * 8, 8 + rnd() * 4, WHITE);
    } else if (k === 4) {
      // 丹顶：头顶一个红圆
      g.fillStyle = RED;
      g.beginPath();
      g.ellipse(30, y0 + 32, 13, 9, 0, 0, Math.PI * 2);
      g.fill();
    } else if (k === 6) {
      // 浅黄：青灰背、网状鳞、两侧到腹部是橙红
      const grd = g.createLinearGradient(0, y0, 0, y0 + H);
      grd.addColorStop(0, '#ee7b3a');
      grd.addColorStop(0.22, '#e98a54');
      grd.addColorStop(0.32, 'rgba(125,147,163,0)');
      grd.addColorStop(0.68, 'rgba(125,147,163,0)');
      grd.addColorStop(0.78, '#e98a54');
      grd.addColorStop(1, '#ee7b3a');
      g.fillStyle = grd;
      g.fillRect(0, y0, W, H);
      scales(y0, 0.45, 'rgba(232,240,246,');
    }
    // 黄金类有一层亮鳞，其他品种只有很淡的鳞纹
    if (k === 3 || k === 5) scales(y0, 0.35, 'rgba(255,248,214,');
    else if (k !== 6) scales(y0, 0.07);
    // 腹部偏白偏亮，背脊略深
    const sh = g.createLinearGradient(0, y0, 0, y0 + H);
    sh.addColorStop(0, 'rgba(255,255,255,0.35)');
    sh.addColorStop(0.3, 'rgba(255,255,255,0)');
    sh.addColorStop(0.5, 'rgba(0,0,0,0.08)');
    sh.addColorStop(0.7, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(255,255,255,0.35)');
    g.fillStyle = sh;
    g.fillRect(0, y0, W, H);
    // 眼睛：两侧偏上，深色瞳孔加一点高光
    for (const ey of [21, 43]) {
      g.fillStyle = '#e8d6a0';
      g.beginPath();
      g.ellipse(24, y0 + ey, 6.5, 2.4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#121010';
      g.beginPath();
      g.ellipse(24, y0 + ey, 4.6, 1.8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(22.5, y0 + ey - 0.5, 1.4, 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 4;
  return t;
}

// 鳍的贴图：横向从鳍根到鳍缘，越往外越透明；纵向一条条鳍条
function finTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 128, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.92)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  grd.addColorStop(0.92, 'rgba(255,255,255,0.32)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 4; y < 128; y += 9) g.fillRect(0, y, 128, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const KOI_NOSE = 0.22, KOI_TAIL = -0.17;
// 身体半宽：头圆钝，前三成最宽，往后收到细细的尾柄
function koiWidth(t: number) {
  let w = t < 0.3 ? 0.068 * Math.pow(Math.sin((t / 0.3) * Math.PI * 0.5), 0.55) : 0.068 * (1 - 0.8 * Math.pow((t - 0.3) / 0.7, 1.5));
  if (t > 0.94) w *= (1 - t) / 0.06;
  return w;
}
function koiGeometry() {
  const N = 22, S = 16;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const z = KOI_NOSE + (KOI_TAIL - KOI_NOSE) * t;
    const w = koiWidth(t);
    const h = w * 0.85;
    const yc = 0.008 * Math.sin(Math.PI * t);
    for (let j = 0; j <= S; j++) {
      const v = j / S;
      const a = v * Math.PI * 2 - Math.PI / 2;
      const sy = Math.sin(a);
      pos.push(Math.cos(a) * w, yc + sy * h * (sy < 0 ? 0.78 : 1), z);
      uv.push(t, v);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < S; j++) {
      const a = i * (S + 1) + j, b = a + S + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 扇形的鳍：从 root 出发，沿 dir 方向、在 dir 与 side 张成的面里展开 ±spread 弧度；
// len(k) 给出第 k 条鳍条的长度（0..1 的位置），droop 让鳍缘往下垂一点
function fan(root: THREE.Vector3, dir: THREE.Vector3, side: THREE.Vector3, spread: number, len: (s: number) => number, droop = 0) {
  const K = 10, M = 4;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const d = new THREE.Vector3();
  for (let k = 0; k <= K; k++) {
    const s = k / K;
    const ang = (s - 0.5) * 2 * spread;
    d.copy(dir).multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang));
    const L = len(s);
    for (let m = 0; m <= M; m++) {
      const f = m / M;
      pos.push(root.x + d.x * L * f, root.y + d.y * L * f - droop * f * f, root.z + d.z * L * f);
      uv.push(f, s);
    }
  }
  for (let k = 0; k < K; k++)
    for (let m = 0; m < M; m++) {
      const a = k * (M + 1) + m, b = a + M + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}
function koiFinGeometry() {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: THREE.BufferGeometry[] = [];
  // 尾鳍：两瓣，中间短、两边长，像燕尾
  parts.push(fan(V(0, 0.004, KOI_TAIL + 0.012), V(0, 0, -1), V(1, 0, 0), 0.62, (s) => 0.12 + 0.07 * Math.pow(Math.abs(s - 0.5) * 2, 1.4), 0.006));
  for (const sx of [-1, 1]) {
    // 胸鳍：圆扇形，向外、向后、略向下
    parts.push(fan(V(sx * 0.05, -0.022, 0.1), V(sx * 0.72, -0.22, -0.66).normalize(), V(0, 0, -1).cross(V(sx, 0, 0)).cross(V(sx * 0.72, -0.22, -0.66).normalize()).normalize(), 0.55, (s) => 0.072 * (0.55 + 0.45 * Math.sin(Math.PI * s)), 0.008));
    // 腹鳍：小一些
    parts.push(fan(V(sx * 0.028, -0.034, -0.03), V(sx * 0.5, -0.35, -0.79).normalize(), V(0, 0, -1).cross(V(sx, 0, 0)).cross(V(sx * 0.5, -0.35, -0.79).normalize()).normalize(), 0.45, (s) => 0.04 * (0.6 + 0.4 * Math.sin(Math.PI * s)), 0.004));
  }
  // 背鳍：沿背脊的一道低鳍，前高后低
  {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = 0.36 + (i / n) * 0.36;
      const z = KOI_NOSE + (KOI_TAIL - KOI_NOSE) * t;
      const y = 0.008 * Math.sin(Math.PI * t) + koiWidth(t) * 0.85 - 0.004;
      const hgt = 0.034 * (1 - (i / n) * 0.6) * Math.sin(Math.min(1, (i + 1) / 2) * Math.PI * 0.5);
      pos.push(0, y, z, 0, y + hgt, z - 0.012);
      uv.push(0, i / n, 1, i / n);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts)!;
}

// 游动时身体后段左右摆，越靠尾巴摆得越大；身体和鳍用同一段代码，鳍跟着身体走
function koiWag(sh: THREE.WebGLProgramParametersWithUniforms, timeU: { value: number }, row: boolean) {
  sh.uniforms.uTime = timeU;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;\nattribute float aSwim;\nattribute float aKind;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float along = clamp((0.14 - transformed.z) / 0.48, 0.0, 1.0);
      float wag = sin(uTime * (4.5 + aSwim * 6.0) + aPhase - transformed.z * 8.0) * (0.018 + 0.05 * aSwim) * along * along;
      transformed.x += wag;`
    );
  if (row)
    sh.vertexShader = sh.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      #ifdef USE_MAP
      vMapUv.y = (aKind + 0.04 + vMapUv.y * 0.92) / ${KOI_ROWS.toFixed(1)};
      #endif`
    );
}

// 莲花河灯：两层花瓣（花瓣根部白、尖上粉）+ 托底的荷叶
export function lotusGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const petal = (len: number, wid: number, tilt: number, yaw: number, y: number) => {
    const g = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(wid, len, wid * 0.45);
    g.rotateX(-Math.PI / 2 + tilt);
    g.translate(0, y, 0);
    g.rotateY(yaw);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const tip = Math.min(1, Math.hypot(p.getX(i), p.getZ(i)) / len);
      const c = new THREE.Color('#fbf3ee').lerp(new THREE.Color('#e9849a'), tip * tip);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.toNonIndexed();
  };
  for (let k = 0; k < 8; k++) parts.push(petal(0.13, 0.05, 0.55, (k / 8) * Math.PI * 2, 0.02));
  for (let k = 0; k < 6; k++) parts.push(petal(0.1, 0.042, 0.9, (k / 6) * Math.PI * 2 + 0.3, 0.035));
  const leaf = new THREE.CylinderGeometry(0.2, 0.18, 0.02, 20).toNonIndexed();
  const lc = new Float32Array(leaf.attributes.position.count * 3);
  for (let i = 0; i < leaf.attributes.position.count; i++) lc.set([0.2, 0.36, 0.17], i * 3);
  leaf.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  parts.push(leaf);
  parts.forEach((g) => g.deleteAttribute('uv'));
  return mergeGeometries(parts)!;
}

function radialTexture(stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const inside = (x: number, z: number, k: number) => ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < k * k;

export function buildPond(scene: THREE.Scene, opts: { isTouch: boolean; lanternFrom: { x: number; z: number } }) {
  const group = new THREE.Group();

  // —— 水面 ——
  const geo = new THREE.CircleGeometry(1, 72);
  geo.scale(POND.rx, POND.rz, 1);
  const res = opts.isTouch ? 0.4 : 0.5;
  const water = new Reflector(geo, {
    shader: WaterShader,
    textureWidth: Math.min(1280, Math.round(innerWidth * devicePixelRatio * res)),
    textureHeight: Math.min(800, Math.round(innerHeight * devicePixelRatio * res)),
    clipBias: 0.003,
    multisample: 0,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, WATER_Y, POND.z);
  water.renderOrder = 1;
  const wmat = water.material as THREE.ShaderMaterial;
  wmat.transparent = true;
  wmat.depthWrite = false;
  water.userData.interact = { type: 'pond' };
  // 离池子很远时不再画倒影（省一次整场景渲染）；手机上隔一帧更新一次
  const baseBefore = water.onBeforeRender;
  let frame = 0;
  water.onBeforeRender = function (renderer, sc, camera, ...rest) {
    frame++;
    const d = camera.position.distanceTo(water.position);
    if (d > 75) return;
    if (opts.isTouch && frame % 2 === 1) return;
    (baseBefore as any).call(this, renderer, sc, camera, ...rest);
  };
  group.add(water);
  const U = wmat.uniforms;
  let ripI = 0;
  let time = 0;
  function ripple(x: number, z: number, amp = 1) {
    (U.uRip.value as THREE.Vector4[])[ripI].set(x, z, time, amp);
    ripI = (ripI + 1) % MAX_RIP;
  }

  // —— 锦鲤 ——
  const KOI = 16;
  const kgeo = koiGeometry();
  const fgeo = koiFinGeometry();
  const aPhase = new THREE.InstancedBufferAttribute(new Float32Array(KOI), 1);
  const aSwim = new THREE.InstancedBufferAttribute(new Float32Array(KOI), 1);
  const aKind = new THREE.InstancedBufferAttribute(new Float32Array(KOI), 1);
  for (const g of [kgeo, fgeo]) {
    g.setAttribute('aPhase', aPhase);
    g.setAttribute('aSwim', aSwim);
    g.setAttribute('aKind', aKind);
  }
  const timeU = { value: 0 };
  const kmat = new THREE.MeshStandardMaterial({ map: koiTexture(), roughness: 0.36, metalness: 0.08 });
  kmat.onBeforeCompile = (sh) => koiWag(sh, timeU, true);
  kmat.customProgramCacheKey = () => 'koi-body';
  const fmat = new THREE.MeshStandardMaterial({ map: finTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.5 });
  fmat.onBeforeCompile = (sh) => koiWag(sh, timeU, false);
  fmat.customProgramCacheKey = () => 'koi-fin';
  const koi = new THREE.InstancedMesh(kgeo, kmat, KOI);
  const fins = new THREE.InstancedMesh(fgeo, fmat, KOI);
  // 红白最多，其次三色、昭和、黄金、丹顶、橙、浅黄
  const kinds = [0, 7, 1, 0, 2, 3, 0, 4, 1, 5, 7, 6, 0, 2, 3, 1];
  const fish = Array.from({ length: KOI }, (_, i) => {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.7;
    aPhase.setX(i, Math.random() * 6.28);
    aKind.setX(i, kinds[i % kinds.length]);
    fins.setColorAt(i, new THREE.Color(KOI_KINDS[kinds[i % kinds.length]].fin));
    return {
      x: POND.x + Math.cos(a) * POND.rx * d,
      z: POND.z + Math.sin(a) * POND.rz * d,
      h: Math.random() * 6.28,
      v: 0.25,
      tx: 0,
      tz: 0,
      wait: 0,
      size: 0.8 + Math.random() * 0.5,
      depth: -0.3 - Math.random() * 0.1,
      bob: Math.random() * 6,
    };
  });
  koi.frustumCulled = fins.frustumCulled = false;
  koi.castShadow = false;
  group.add(koi, fins);

  // —— 鱼食：浮在水面的小颗粒 ——
  const FOOD = 40;
  const foodGeo = new THREE.BufferGeometry();
  const foodPos = new Float32Array(FOOD * 3).fill(-999);
  foodGeo.setAttribute('position', new THREE.BufferAttribute(foodPos, 3));
  const food = new THREE.Points(foodGeo, new THREE.PointsMaterial({ color: '#8a5a2c', size: 0.045, sizeAttenuation: true }));
  food.frustumCulled = false;
  group.add(food);
  const pellets = Array.from({ length: FOOD }, () => ({ x: 0, z: 0, life: 0, alive: false }));
  let pelletI = 0;
  let lastFeed = -100;
  function feed(x: number, z: number) {
    for (let k = 0; k < 12; k++) {
      const P = pellets[pelletI];
      pelletI = (pelletI + 1) % FOOD;
      let px = x + (Math.random() - 0.5) * 0.9, pz = z + (Math.random() - 0.5) * 0.6;
      if (!inside(px, pz, 0.92)) [px, pz] = [x, z];
      Object.assign(P, { x: px, z: pz, life: 25, alive: true });
      if (k % 4 === 0) ripple(px, pz, 0.5);
    }
    lastFeed = time;
  }

  // —— 河灯 ——
  const MAXL = 40;
  const lotus = new THREE.InstancedMesh(lotusGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: '#ffb27a', emissiveIntensity: 0.05 }), MAXL);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 0.7) });
  const flame = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6).scale(1, 1.8, 1), flameMat, MAXL);
  const poolMat = new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(255,190,110,0.9)'], [0.4, 'rgba(255,150,70,0.35)'], [1, 'rgba(255,120,50,0)']]),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), poolMat, MAXL);
  pool.renderOrder = 3;
  const haloGeo = new THREE.BufferGeometry();
  const haloPos = new Float32Array(MAXL * 3).fill(-999);
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const haloMat = new THREE.PointsMaterial({
    size: 1.1,
    map: radialTexture([[0, 'rgba(255,214,150,1)'], [0.25, 'rgba(255,170,90,0.45)'], [1, 'rgba(255,140,60,0)']]),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const halo = new THREE.Points(haloGeo, haloMat);
  for (const m of [lotus, flame, pool, halo]) {
    m.frustumCulled = false;
    group.add(m);
  }
  lotus.castShadow = false;
  // 放灯的地方在岸上的哪个角度：所有河灯都从这里漂出去
  const fromA = Math.atan2((opts.lanternFrom.z - POND.z) / POND.rz, (opts.lanternFrom.x - POND.x) / POND.rx);
  let items: LanternItem[] = [];
  let clockOffset = 0; // 服务器时间 - 本地时间
  // 寺里自己放的灯：只在黄昏和夜里出现，按固定种子循环漂
  const templeLamps: LanternItem[] = Array.from({ length: 7 }, (_, i) => ({ id: 'temple' + i, seed: (i * 0.618) % 1, start: -i * 85000, until: Infinity, mine: false }));
  let night = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function lanternAt(it: LanternItem, nowMs: number, out: THREE.Vector3) {
    const loop = it.until === Infinity;
    let age = (nowMs - it.start) / 1000;
    if (loop) age = ((age % 640) + 640) % 640 + 60;
    const dir = it.seed < 0.5 ? 1 : -1;
    const th = (loop ? it.seed * 6.28 : fromA) + dir * age * (0.009 + it.seed * 0.008);
    const f = 0.93 - 0.3 * THREE.MathUtils.smoothstep(age, 0, 45) + 0.1 * Math.sin(age * 0.045 + it.seed * 40);
    out.set(POND.x + Math.cos(th) * POND.rx * f, WATER_Y + 0.02 + Math.sin(age * 1.3 + it.seed * 9) * 0.008, POND.z + Math.sin(th) * POND.rz * f);
    return age;
  }

  scene.add(group);

  return {
    water,
    ripple,
    feed,
    setLanterns(list: LanternItem[], serverNow: number) {
      clockOffset = serverNow - Date.now();
      items = list;
    },
    // 新放的灯在岸边落水的那一刻，给一圈涟漪
    lanternDrop() {
      ripple(opts.lanternFrom.x + (POND.x - opts.lanternFrom.x) * 0.08, opts.lanternFrom.z + (POND.z - opts.lanternFrom.z) * 0.12, 1.2);
    },
    update(dt: number, t: number, level: number, sunDir: THREE.Vector3, sunCol: THREE.Color) {
      time = t;
      timeU.value = t;
      U.uTime.value = t;
      night = THREE.MathUtils.clamp((level - 0.6) / 1.6, 0, 1);
      U.uNight.value = night * 0.7;
      (U.uSunDir.value as THREE.Vector3).copy(sunDir);
      (U.uSunCol.value as THREE.Color).copy(sunCol);

      // 鱼食
      let anyFood = false;
      for (let i = 0; i < FOOD; i++) {
        const P = pellets[i];
        if (P.alive) {
          P.life -= dt;
          if (P.life <= 0) P.alive = false;
          else anyFood = true;
        }
        foodPos[i * 3] = P.alive ? P.x : -999;
        foodPos[i * 3 + 1] = WATER_Y + 0.012;
        foodPos[i * 3 + 2] = P.alive ? P.z : -999;
      }
      foodGeo.attributes.position.needsUpdate = true;

      // 锦鲤：平时慢慢游荡；附近有鱼食就加速游过去，吃到时水面起一圈涟漪
      for (let i = 0; i < KOI; i++) {
        const k = fish[i];
        let want = 0.22 + 0.06 * Math.sin(t * 0.3 + i);
        let target: (typeof pellets)[number] | null = null;
        if (anyFood) {
          let best = 49;
          for (const P of pellets) {
            if (!P.alive) continue;
            const d2 = (P.x - k.x) ** 2 + (P.z - k.z) ** 2;
            if (d2 < best) {
              best = d2;
              target = P;
            }
          }
        }
        if (target) {
          k.tx = target.x;
          k.tz = target.z;
          want = 0.85;
          if ((target.x - k.x) ** 2 + (target.z - k.z) ** 2 < 0.03) {
            target.alive = false;
            ripple(k.x + Math.sin(k.h) * 0.2, k.z + Math.cos(k.h) * 0.2, 0.7);
          }
        } else {
          k.wait -= dt;
          const reached = (k.tx - k.x) ** 2 + (k.tz - k.z) ** 2 < 0.4;
          if (k.wait <= 0 || reached) {
            const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.78;
            k.tx = POND.x + Math.cos(a) * POND.rx * d;
            k.tz = POND.z + Math.sin(a) * POND.rz * d;
            k.wait = 6 + Math.random() * 8;
          }
          // 偶尔浮上来吸一口气
          if (Math.random() < dt * 0.012) ripple(k.x + Math.sin(k.h) * 0.25, k.z + Math.cos(k.h) * 0.25, 0.35);
        }
        if (!inside(k.x, k.z, 0.86)) {
          k.tx = POND.x;
          k.tz = POND.z;
        }
        const desired = Math.atan2(k.tx - k.x, k.tz - k.z);
        let dh = desired - k.h;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        k.h += THREE.MathUtils.clamp(dh, -1.6 * dt, 1.6 * dt) * (target ? 2 : 1);
        k.v += (want - k.v) * Math.min(1, dt * 1.5);
        // 彼此让开一点
        for (let j = 0; j < KOI; j++) {
          if (j === i) continue;
          const o = fish[j];
          const dx = k.x - o.x, dz = k.z - o.z, d2 = dx * dx + dz * dz;
          if (d2 < 0.16 && d2 > 1e-6) {
            k.x += (dx / Math.sqrt(d2)) * 0.15 * dt;
            k.z += (dz / Math.sqrt(d2)) * 0.15 * dt;
          }
        }
        k.x += Math.sin(k.h) * k.v * dt;
        k.z += Math.cos(k.h) * k.v * dt;
        k.bob += dt;
        aSwim.setX(i, Math.min(1, k.v));
        pos.set(k.x, k.depth + (target ? 0.12 : 0) + Math.sin(k.bob * 0.7) * 0.02, k.z);
        q.setFromAxisAngle(up, k.h);
        sc.setScalar(k.size);
        m4.compose(pos, q, sc);
        koi.setMatrixAt(i, m4);
        fins.setMatrixAt(i, m4);
      }
      koi.instanceMatrix.needsUpdate = true;
      fins.instanceMatrix.needsUpdate = true;
      aSwim.needsUpdate = true;

      // 河灯
      const now = Date.now() + clockOffset;
      const list = night > 0.15 ? [...items, ...templeLamps] : items;
      let n = 0;
      for (const it of list) {
        if (n >= MAXL) break;
        if (it.until !== Infinity && now > it.until) continue;
        const age = lanternAt(it, now, pos);
        let s = it.until === Infinity ? Math.min(1, night * 1.5) : THREE.MathUtils.clamp(age / 1.2, 0, 1) * THREE.MathUtils.clamp((it.until - now) / 8000, 0, 1);
        s = Math.max(0.001, s);
        q.setFromAxisAngle(up, age * 0.08 + it.seed * 6);
        sc.setScalar(s);
        lotus.setMatrixAt(n, m4.compose(pos, q, sc));
        const fy = pos.y;
        pos.y = fy + 0.07 * s;
        const flick = 1 + Math.sin(t * 9.1 + it.seed * 30) * 0.06 + Math.sin(t * 13.7 + it.seed * 11) * 0.04;
        sc.set(s * flick, s * flick, s * flick);
        flame.setMatrixAt(n, m4.compose(pos, q, sc));
        haloPos[n * 3] = pos.x;
        haloPos[n * 3 + 1] = pos.y + 0.02;
        haloPos[n * 3 + 2] = pos.z;
        pos.y = WATER_Y + 0.012;
        sc.setScalar(s * (0.8 + night * 0.6));
        pool.setMatrixAt(n, m4.compose(pos, q, sc));
        n++;
      }
      for (const m of [lotus, flame, pool]) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
      }
      for (let i = n; i < MAXL; i++) haloPos[i * 3 + 1] = -999;
      haloGeo.attributes.position.needsUpdate = true;
      haloMat.opacity = 0.25 + night * 0.75;
      poolMat.opacity = 0.15 + night * 0.85;
    },
    // 有没有刚撒过鱼食（给印谱判断用）
    get feeding() {
      return time - lastFeed < 2;
    },
  };
}
