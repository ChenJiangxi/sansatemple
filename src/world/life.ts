// 院里的小生灵：夜里池边、树下、配殿前的萤火虫，白天高空盘旋的燕子，池边和银杏下的粉蝶。
// 萤火虫的运动和明灭全在着色器里算；燕子、蝴蝶加起来 24 只，CPU 只算位置朝向，扇翅在着色器里。
import * as THREE from 'three';
import { MAPLES, POND, SIDE_HALLS } from '../layout';
import { rng } from '../textures';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// —— 萤火虫 ——
const FF_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSpeed;
attribute float aSize;
uniform float uTime;
uniform float uScale;
uniform float uAlpha;
varying float vB;
void main() {
  float t = uTime * aSpeed;
  float r = 0.3 + 0.9 * fract(aPhase * 7.13);
  vec3 p = position;
  // 几组正弦叠加，绕着原位慢慢兜圈
  p.x += r * (0.7 * sin(t * 0.71 + aPhase) + 0.3 * sin(t * 1.33 + aPhase * 2.1));
  p.z += r * (0.7 * cos(t * 0.59 + aPhase * 1.7) + 0.3 * sin(t * 1.07 + aPhase * 3.3));
  p.y += 0.2 * sin(t * 0.83 + aPhase * 2.7) + 0.08 * sin(t * 1.9 + aPhase);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  // 各自 2–5 秒一明一灭
  float period = 2.0 + 3.0 * fract(aPhase * 3.71);
  float c = fract(uTime / period + aPhase * 0.159);
  float blink = smoothstep(0.0, 0.22, c) * (1.0 - smoothstep(0.4, 0.75, c));
  // 45 米外随雾淡去
  vB = blink * uAlpha * (1.0 - smoothstep(45.0, 100.0, depth));
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(depth, 0.05), 1.5, 14.0);
  if (vB < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FF_FRAG = /* glsl */ `
varying float vB;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  float a = (exp(-r2 * 7.0) + 0.18 * exp(-r2 * 2.0)) * max(0.0, 1.0 - r2) * vB;
  if (a < 0.003) discard;
  // 分量大于 1，交给泛光去晕开
  gl_FragColor = vec4(1.6, 1.9, 0.7, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function buildFireflies() {
  const r = rng(4242);
  const pos: number[] = [], phase: number[] = [], speed: number[] = [], size: number[] = [];
  const add = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    phase.push(r() * 100);
    speed.push(0.35 + r() * 0.5);
    size.push(0.05 + r() * 0.06);
  };
  // 放生池岸边，贴着水面
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, k = 0.85 + r() * 0.4;
    add(POND.x + Math.cos(a) * POND.rx * k, 0.45 + r() * 0.9, POND.z + Math.sin(a) * POND.rz * k);
  }
  // 树冠下，离地不高
  for (let i = 0; i < 110; i++) {
    const [x, z] = MAPLES[Math.floor(r() * MAPLES.length)];
    const a = r() * Math.PI * 2, d = 0.6 + r() * 2.6;
    add(x + Math.cos(a) * d, 0.65 + r() * 1.6, z + Math.sin(a) * d);
  }
  // 两座配殿门前
  for (let i = 0; i < 60; i++) {
    const s = SIDE_HALLS[i % SIDE_HALLS.length];
    const out = s.w / 2 + 1 + r() * 3.5, lat = (r() - 0.5) * s.d;
    const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
    add(s.x + sy * out + cy * lat, 0.6 + r() * 1.6, s.z + cy * out - sy * lat);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speed, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uAlpha: { value: 0 } },
    vertexShader: FF_VERT,
    fragmentShader: FF_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  pts.visible = false;
  // 每次绘制前按当前画布高度和视角换算「米 → 像素」
  const buf = new THREE.Vector2();
  pts.onBeforeRender = (renderer, _scene, camera) => {
    const rt = renderer.getRenderTarget();
    const h = rt ? rt.height : renderer.getDrawingBufferSize(buf).y;
    mat.uniforms.uScale.value = h * 0.5 * camera.projectionMatrix.elements[5];
  };
  return { pts, mat };
}

// —— 会扇翅的小飞禽：aWing = 1 的顶点绕身体轴（z 轴）上下转 ——
const flapTime = { value: 0 };

type V3 = [number, number, number];

// body、wing 都是三角形顶点列表（每 3 个一个三角形），机翼只给 +x 一侧，自动镜像
function flyerGeo(body: V3[], wing: V3[]) {
  const p: number[] = [], w: number[] = [];
  for (const v of body) p.push(...v), w.push(0);
  for (const v of wing) p.push(...v), w.push(1);
  for (let i = 0; i < wing.length; i += 3) {
    for (const v of [wing[i], wing[i + 2], wing[i + 1]]) p.push(-v[0], v[1], v[2]), w.push(1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(w, 1));
  g.computeVertexNormals();
  return g;
}

const fan = (c: V3, ring: V3[]) => ring.slice(1).flatMap((v, i) => [c, ring[i], v]);

// frac：一个周期里扇翅所占比例（其余时间滑翔）；bias：翅膀平时上扬的角度
function flapMat(color: string, frac: number, bias: number) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide, transparent: true });
  const u = { uFlapFrac: { value: frac }, uFlapBias: { value: bias } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = flapTime;
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uFlapFrac;
        uniform float uFlapBias;
        attribute vec4 aFlap; // 相位、角频率、幅度、扇翅+滑翔周期
        attribute float aWing;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float fCyc = fract(uTime / aFlap.w + aFlap.x);
        float fOn = smoothstep(0.0, 0.08, fCyc) * (1.0 - smoothstep(uFlapFrac - 0.08, uFlapFrac, fCyc));
        float fAng = (uFlapBias + aFlap.z * fOn * sin(uTime * aFlap.y + aFlap.x * 50.0)) * aWing * sign(position.x);
        mat2 fRot = mat2(cos(fAng), sin(fAng), -sin(fAng), cos(fAng));
        objectNormal.xy = fRot * objectNormal.xy;`
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xy = fRot * transformed.xy;');
  };
  return mat;
}

function flyerMesh(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, flap: (i: number) => [number, number, number, number]) {
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set(flap(i), i * 4);
  geo.setAttribute('aFlap', new THREE.InstancedBufferAttribute(a, 4));
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  return m;
}

// 燕子：机头朝 +z，翼展约 0.52 米，后掠翅膀、叉尾
const birdGeo = () =>
  flyerGeo(
    ((): V3[] => {
      const N: V3 = [0, 0, 0.13], B: V3 = [0, 0, -0.1], L: V3 = [0.028, 0, 0], R: V3 = [-0.028, 0, 0];
      const T: V3 = [0, 0.026, 0.01], D: V3 = [0, -0.022, 0.01];
      return [N, L, T, N, T, R, B, T, L, B, R, T, N, D, L, N, R, D, B, L, D, B, D, R,
        [0, 0, -0.08], [0.036, 0, -0.21], [0.008, 0, -0.1], [0, 0, -0.08], [-0.008, 0, -0.1], [-0.036, 0, -0.21]];
    })(),
    [[0.02, 0, 0.045], [0.13, 0, 0.02], [0.02, 0, -0.035], [0.02, 0, -0.035], [0.13, 0, 0.02], [0.26, 0, -0.07]]
  );

// 蝴蝶：翼展约 0.15 米
const butterflyGeo = () =>
  flyerGeo(
    [[0, 0, 0.03], [0.006, 0, 0], [0, 0.006, 0], [0, 0, 0.03], [0, 0.006, 0], [-0.006, 0, 0],
      [0, 0, -0.035], [0, 0.006, 0], [0.006, 0, 0], [0, 0, -0.035], [-0.006, 0, 0], [0, 0.006, 0]],
    fan([0.004, 0, 0], [[0.004, 0, 0.02], [0.04, 0, 0.045], [0.075, 0, 0.03], [0.07, 0, 0], [0.045, 0, -0.02], [0.055, 0, -0.045], [0.025, 0, -0.05], [0.004, 0, -0.015]])
  );

// 两群燕子：绕中心兜大圈（椭圆、半径随时间缓慢伸缩）
const FLOCKS = [
  { n: 9, cx: 0, cz: 20, r: 25, dr: 4, y: 20, w: 0.34 },
  { n: 7, cx: -8, cz: 40, r: 21, dr: 3, y: 19, w: -0.4 },
];

export function buildLife(scene: THREE.Scene) {
  const r = rng(9157);
  const ff = buildFireflies();
  scene.add(ff.pts);

  // —— 燕子 ——
  const NB = FLOCKS[0].n + FLOCKS[1].n;
  const bFlock = new Uint8Array(NB), bPh = new Float32Array(NB), bDr = new Float32Array(NB), bDy = new Float32Array(NB), bWob = new Float32Array(NB);
  for (let i = 0, k = 0; k < FLOCKS.length; k++)
    for (let j = 0; j < FLOCKS[k].n; j++, i++) {
      bFlock[i] = k;
      bPh[i] = j * 0.07 + r() * 0.08;
      bDr[i] = (r() - 0.5) * 3;
      bDy[i] = (r() - 0.5) * 3;
      bWob[i] = r() * 6.28;
    }
  const birdMat = flapMat('#3d3531', 0.6, 0.1);
  const birds = flyerMesh(birdGeo(), birdMat, NB, () => [r() * 10, (4.5 + r() * 1.5) * Math.PI * 2, 0.7 + r() * 0.15, 2.5 + r() * 2]);
  scene.add(birds);
  const birdPos = (i: number, t: number, out: THREE.Vector3) => {
    const f = FLOCKS[bFlock[i]], k = bFlock[i] * 2.1;
    const a = f.w * t + bPh[i];
    const rad = f.r + f.dr * Math.sin(0.07 * t + k) + bDr[i] + 0.8 * Math.sin(0.6 * t + bWob[i]);
    out.set(
      f.cx + 3 * Math.sin(0.05 * t + k) + rad * Math.cos(a),
      f.y + 2.5 * Math.sin(0.09 * t + k) + bDy[i] + 0.35 * Math.sin(1.3 * t + bWob[i] * 2),
      f.cz + rad * 0.82 * Math.sin(a)
    );
  };

  // —— 蝴蝶：池边三只，银杏下五只（nature.ts 里 MAPLES 下标 i % 4 !== 3 的是银杏） ——
  const anchors: [number, number][] = [0.5, 2.4, 4.0].map((a) => [POND.x + Math.cos(a) * (POND.rx + 0.6), POND.z + Math.sin(a) * (POND.rz + 0.6)]);
  for (const i of [12, 13, 9, 1, 6]) {
    const [x, z] = MAPLES[i];
    anchors.push([x - Math.sign(x) * 1.6, z]);
  }
  const NF = anchors.length;
  const fPh = Float32Array.from(anchors, () => r() * 6.28);
  const bfMat = flapMat('#ffffff', 0.85, 0.55);
  const flies = flyerMesh(butterflyGeo(), bfMat, NF, () => [r() * 10, (6.5 + r() * 2) * Math.PI * 2, 0.65, 1.6 + r() * 1.5]);
  const bfPal = ['#f4e9a8', '#f7f4ea', '#efe0a0'].map((c) => new THREE.Color(c));
  for (let i = 0; i < NF; i++) flies.setColorAt(i, bfPal[i % bfPal.length]);
  scene.add(flies);
  const flyPos = (i: number, t: number, out: THREE.Vector3) => {
    const p = fPh[i];
    out.set(
      anchors[i][0] + 1.4 * Math.sin(0.37 * t + p) + 0.45 * Math.sin(1.9 * t + 2.3 * p),
      1.4 + 0.7 * Math.sin(0.5 * t + p) + 0.25 * Math.sin(2.7 * t + 1.3 * p),
      anchors[i][1] + 1.4 * Math.sin(0.29 * t + 1.7 * p + 1) + 0.45 * Math.cos(2.3 * t + p)
    );
  };

  // 逐帧复用的临时对象
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const e = new THREE.Euler(0, 0, 0, 'YXZ'), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  // 按前后两帧位置定朝向：偏航、俯仰，再加上侧倾
  const place = (mesh: THREE.InstancedMesh, i: number, roll: number) => {
    const vx = p1.x - p0.x, vy = p1.y - p0.y, vz = p1.z - p0.z;
    e.set(-Math.atan2(vy, Math.hypot(vx, vz)), Math.atan2(vx, vz), roll);
    q.setFromEuler(e);
    m.compose(p0, q, one);
    mesh.setMatrixAt(i, m);
  };

  let lv = -1;
  return {
    // level：环境给出的灯笼亮度（白天约 0.25，黎明 0.9，黄昏 1.3，夜里 2.4）。
    // 手动切换时段时 level 会跳变，这里自己缓几秒，萤火虫和燕子慢慢出现、消失
    update(dt: number, t: number, level: number, camPos: THREE.Vector3) {
      lv = lv < 0 ? level : lv + (level - lv) * (1 - Math.exp(-dt * 0.8));
      level = lv;
      flapTime.value = t;
      const night = smooth(0.9, 2.0, level);
      ff.mat.uniforms.uTime.value = t;
      ff.mat.uniforms.uAlpha.value = night;
      ff.pts.visible = night > 0.003;

      const day = 1 - smooth(1.1, 1.55, level);
      birdMat.opacity = bfMat.opacity = day;
      birds.visible = flies.visible = day > 0.01;
      if (!birds.visible) return;
      for (let i = 0; i < NB; i++) {
        birdPos(i, t, p0);
        birdPos(i, t + 0.05, p1);
        // 顺时针、逆时针盘旋，向圈内侧倾
        place(birds, i, Math.sign(FLOCKS[bFlock[i]].w) * (0.38 + 0.1 * Math.sin(0.8 * t + bWob[i])));
      }
      birds.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < NF; i++) {
        flyPos(i, t, p0);
        flyPos(i, t + 0.05, p1);
        place(flies, i, 0.2 * Math.sin(3.1 * t + fPh[i]));
      }
      flies.instanceMatrix.needsUpdate = true;
    },
  };
}
