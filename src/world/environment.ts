// 天空、光照、昼夜、远山与地面
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { Look } from './post';
import { rng } from '../textures';
import { pbr, loadTexture } from './pbr';
import { HALL, COURT, POND, BELL, SIDE_HALLS, BRIDGE, LIBRARY, MAPLES, PINES } from '../layout';

export type TimeMode = 'auto' | 'dawn' | 'day' | 'dusk' | 'night';

interface Preset {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fog: THREE.Color;
  sun: THREE.Color;
  sunI: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
  elev: number; // 太阳高度角
  azim: number;
  lantern: number; // 灯笼发光强度
  exposure: number;
  stars: number;
  envI: number; // 环境反射强度
  bgI: number; // 背景照片亮度
  // 后期调色：泛光强度与门槛、冷暖、饱和度、对比度、暗部抬升、暗角
  bloom: number;
  thr: number;
  tint: THREE.Color;
  sat: number;
  con: number;
  lift: number;
  vig: number;
  // 写实天空（Preetham 大气散射）：天空里的太阳高度可以和打光的太阳不同（夜里天空的太阳在地平线下，打光用月光）
  skyElev: number;
  turb: number;
  ray: number;
  mie: number;
  gain: number; // 天空整体亮度
  cloud: number; // 云量
}

const C = (h: string) => new THREE.Color(h);
const PRESETS: Record<Exclude<TimeMode, 'auto'>, Preset> = {
  dawn: { skyTop: C('#7b8fb5'), skyHorizon: C('#f2c6a0'), fog: C('#b8a08a'), sun: C('#ffc58f'), sunI: 1.6, hemiSky: C('#b9c4dc'), hemiGround: C('#6b5a48'), hemiI: 0.9, elev: 0.18, azim: 1.9, lantern: 0.9, exposure: 1.0, stars: 0.1, envI: 0.35, bgI: 0.7, bloom: 0.38, thr: 1.5, tint: C('#fff1e0'), sat: 1.06, con: 1.04, lift: 0.03, vig: 0.32, skyElev: 0.06, turb: 5, ray: 2.2, mie: 0.006, gain: 1.0, cloud: 0.35 },
  day: { skyTop: C('#7fa6cf'), skyHorizon: C('#dfe7e6'), fog: C('#a39686'), sun: C('#fff1dc'), sunI: 2.9, hemiSky: C('#cfe0ef'), hemiGround: C('#7a6a50'), hemiI: 1.05, elev: 0.85, azim: 2.4, lantern: 0.25, exposure: 1.0, stars: 0, envI: 0.55, bgI: 1.0, bloom: 0.22, thr: 2.8, tint: C('#fff7ec'), sat: 1.08, con: 1.05, lift: 0.0, vig: 0.26, skyElev: 0.62, turb: 3.2, ray: 1.2, mie: 0.004, gain: 0.85, cloud: 0.4 },
  dusk: { skyTop: C('#4b5a86'), skyHorizon: C('#f0a070'), fog: C('#8a6a58'), sun: C('#ff9a5a'), sunI: 1.5, hemiSky: C('#9c8fb0'), hemiGround: C('#4e3d33'), hemiI: 0.75, elev: 0.12, azim: 3.9, lantern: 1.3, exposure: 1.05, stars: 0.15, envI: 0.25, bgI: 0.45, bloom: 0.36, thr: 1.7, tint: C('#ffe6d2'), sat: 1.1, con: 1.06, lift: 0.03, vig: 0.36, skyElev: 0.03, turb: 7, ray: 2.6, mie: 0.007, gain: 1.0, cloud: 0.42 },
  night: { skyTop: C('#0b1328'), skyHorizon: C('#2a3550'), fog: C('#141a24'), sun: C('#9fb4ff'), sunI: 1.15, hemiSky: C('#4a5c96'), hemiGround: C('#26201a'), hemiI: 0.7, elev: 0.7, azim: 4.2, lantern: 2.4, exposure: 1.2, stars: 1, envI: 0.05, bgI: 0.07, bloom: 0.55, thr: 1.45, tint: C('#e4ecff'), sat: 1.02, con: 1.03, lift: 0.09, vig: 0.38, skyElev: -0.16, turb: 2, ray: 0.6, mie: 0.003, gain: 0.6, cloud: 0.25 },
};

function presetForHour(h: number): Preset {
  // 在相邻两个时段之间平滑过渡
  const keys: [number, Exclude<TimeMode, 'auto'>][] = [
    [0, 'night'], [4.5, 'night'], [6, 'dawn'], [8, 'day'], [16.5, 'day'], [18.3, 'dusk'], [19.8, 'night'], [24, 'night'],
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, a] = keys[i];
    const [h1, b] = keys[i + 1];
    if (h >= h0 && h <= h1) return lerpPreset(PRESETS[a], PRESETS[b], (h - h0) / (h1 - h0 || 1));
  }
  return PRESETS.day;
}

function lerpPreset(a: Preset, b: Preset, t: number): Preset {
  const s = t * t * (3 - 2 * t);
  const lc = (x: THREE.Color, y: THREE.Color) => x.clone().lerp(y, s);
  const ln = (x: number, y: number) => x + (y - x) * s;
  return {
    skyTop: lc(a.skyTop, b.skyTop), skyHorizon: lc(a.skyHorizon, b.skyHorizon), fog: lc(a.fog, b.fog), sun: lc(a.sun, b.sun),
    sunI: ln(a.sunI, b.sunI), hemiSky: lc(a.hemiSky, b.hemiSky), hemiGround: lc(a.hemiGround, b.hemiGround), hemiI: ln(a.hemiI, b.hemiI),
    elev: ln(a.elev, b.elev), azim: ln(a.azim, b.azim), lantern: ln(a.lantern, b.lantern), exposure: ln(a.exposure, b.exposure), stars: ln(a.stars, b.stars), envI: ln(a.envI, b.envI), bgI: ln(a.bgI, b.bgI),
    bloom: ln(a.bloom, b.bloom), thr: ln(a.thr, b.thr), tint: lc(a.tint, b.tint), sat: ln(a.sat, b.sat), con: ln(a.con, b.con), lift: ln(a.lift, b.lift), vig: ln(a.vig, b.vig),
    skyElev: ln(a.skyElev, b.skyElev), turb: ln(a.turb, b.turb), ray: ln(a.ray, b.ray), mie: ln(a.mie, b.mie), gain: ln(a.gain, b.gain), cloud: ln(a.cloud, b.cloud),
  };
}

export class Environment {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh; // 夜空的星星（叠在写实天空上）
  skyMat: THREE.ShaderMaterial;
  private atmo: Sky; // 画面里看到的天空
  private envSky: Sky; // 只用来生成环境光的天空（不画太阳圆盘，免得反射里出现亮点）
  private envScene = new THREE.Scene();
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envSun = new THREE.Vector3(0, -2, 0);
  private time = 0;
  lanternLevel = 0.3;
  look!: Look;
  onLook?: (l: Look) => void;
  mode: TimeMode = 'auto';
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private current!: Preset;
  private sunDir = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.hemi = new THREE.HemisphereLight('#cfe0ef', '#7a6a50', 1);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 200;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(0, 0, 2);
    scene.add(this.sun, this.sun.target);

    // 写实天空：Preetham 大气散射，自带会飘的云；输出前乘一个亮度系数，免得白天天空曝光过度
    const mkSky = () => {
      const sky = new Sky();
      const m = sky.material as THREE.ShaderMaterial;
      m.uniforms.uGain = { value: 1 };
      m.fragmentShader = m.fragmentShader
        .replace('void main() {', 'uniform float uGain;\nvoid main() {')
        .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * uGain, 1.0 );');
      sky.scale.setScalar(800);
      sky.frustumCulled = false;
      return sky;
    };
    this.atmo = mkSky();
    this.atmo.renderOrder = -10;
    scene.add(this.atmo);
    this.envSky = mkSky();
    (this.envSky.material as THREE.ShaderMaterial).uniforms.showSunDisc.value = 0;
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.background = null;

    // 夜空：星星和一点深蓝的底色，叠加在写实天空上
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#0b1430') },
        horizon: { value: new THREE.Color('#1e2a48') },
        stars: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform float stars;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 col = mix(horizon, top, pow(smoothstep(-0.05, 0.75, h), 0.7)) * stars;
          if (stars > 0.0 && d.y > 0.03) {
            vec3 q = floor(d * 420.0);
            float r = hash(q);
            float st = step(0.9968, r) * (0.5 + 0.5 * hash(q + 7.0));
            col += vec3(0.9, 0.95, 1.0) * st * stars * smoothstep(0.03, 0.35, d.y);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -9;
    scene.add(this.sky);
    void loadTexture;

    scene.fog = new THREE.Fog('#cfd8d3', 70, 760);
    this.apply(presetForHour(12));
  }

  setMode(m: TimeMode) {
    this.mode = m;
    this.update();
  }

  // 指定钟点（0–24，带小数）：宣传片里一路从清晨走到入夜，天色连续变化
  setHour(h: number) {
    this.apply(presetForHour(((h % 24) + 24) % 24));
  }

  update() {
    let p: Preset;
    if (this.mode === 'auto') {
      const d = new Date();
      p = presetForHour(d.getHours() + d.getMinutes() / 60);
    } else p = PRESETS[this.mode];
    this.apply(p);
  }

  private apply(p: Preset) {
    this.current = p;
    const dir = new THREE.Vector3(Math.cos(p.azim) * Math.cos(p.elev), Math.sin(p.elev), Math.sin(p.azim) * Math.cos(p.elev));
    this.sunDir.copy(dir);
    this.sun.position.copy(dir.clone().multiplyScalar(90)).add(this.sun.target.position);
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunI;
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiI;
    (this.scene.fog as THREE.Fog).color.copy(p.fog);
    this.skyMat.uniforms.stars.value = p.stars;
    // 天空里的太阳：方位和打光的太阳一致，高度单独给
    const sd = new THREE.Vector3(Math.cos(p.azim) * Math.cos(p.skyElev), Math.sin(p.skyElev), Math.sin(p.azim) * Math.cos(p.skyElev));
    for (const sky of [this.atmo, this.envSky]) {
      const u = (sky.material as THREE.ShaderMaterial).uniforms;
      u.sunPosition.value.copy(sd);
      u.turbidity.value = p.turb;
      u.rayleigh.value = p.ray;
      u.mieCoefficient.value = p.mie;
      u.mieDirectionalG.value = 0.82;
      u.uGain.value = p.gain;
      u.cloudCoverage.value = p.cloud;
      u.cloudDensity.value = 0.45;
      u.cloudElevation.value = 0.55;
    }
    // 环境光从天空生成：太阳挪动明显时才重算（一次几毫秒）
    if (sd.distanceTo(this.envSun) > 0.03) {
      this.envSun.copy(sd);
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
      this.scene.environment = rt.texture;
      this.envRT?.dispose();
      this.envRT = rt;
    }
    this.renderer.toneMappingExposure = p.exposure;
    this.lanternLevel = p.lantern;
    this.scene.environmentIntensity = p.envI;
    this.look = { bloom: p.bloom, threshold: p.thr, tint: p.tint.clone(), sat: p.sat, contrast: p.con, lift: p.lift, vignette: p.vig };
    this.onLook?.(this.look);
  }

  // 云慢慢飘
  tick(dt: number, camPos: THREE.Vector3) {
    this.time += dt;
    (this.atmo.material as THREE.ShaderMaterial).uniforms.time.value = this.time;
    this.atmo.position.copy(camPos);
    this.sky.position.copy(camPos);
  }

  // 阴影范围跟着玩家走（按阴影贴图的像素对齐，避免移动时阴影闪烁）
  follow(x: number, z: number) {
    const step = 72 / this.sun.shadow.mapSize.x;
    const sx = Math.round(x / step) * step;
    const sz = Math.round(z / step) * step;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.copy(this.sunDir).multiplyScalar(90).add(this.sun.target.position);
  }

  get isDark() {
    return this.current.lantern > 1;
  }
}

// 远山林冠的细碎明暗：平铺在山体顶点色上，近看不至于是一整片平色
function canopyTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, S, S);
  const r = rng(91);
  for (let i = 0; i < 1600; i++) {
    const x = r() * S, y = r() * S, rad = 2 + r() * 9;
    const v = Math.floor(120 + r() * 135);
    g.fillStyle = `rgba(${v},${v},${v},0.55)`;
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        g.beginPath();
        g.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
        g.fill();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 地面：院子里平整，外面是起伏的秋山
// 院子地面像天天有人扫：开阔处的落叶只剩零星几片，树冠底下、墙根、角落才积着叶子。
// 地面贴图是「泥地上一层落叶」，落叶颜色鲜艳、泥地发灰，按饱和度认出叶子；不该有叶子的地方把它换成泥地色
function sweptGround(mat: THREE.MeshStandardMaterial) {
  const N = 32;
  const trees = [...MAPLES.map(([x, z, s]) => new THREE.Vector3(x, z, 5.2 * s)), ...PINES.map(([x, z, s]) => new THREE.Vector3(x, z, 3.2 * s))].slice(0, N);
  while (trees.length < N) trees.push(new THREE.Vector3(9999, 9999, 0));
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTrees = { value: trees };
    sh.uniforms.uCourtR = { value: new THREE.Vector4(COURT.x0, COURT.z0, COURT.x1, COURT.z1) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGw = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vGw;
        uniform vec3 uTrees[${N}];
        uniform vec4 uCourtR;
        float gH(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
        float gN(vec2 p) {
          vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
          return mix(mix(gH(i), gH(i + vec2(1.0, 0.0)), u.x), mix(gH(i + vec2(0.0, 1.0)), gH(i + vec2(1.0, 1.0)), u.x), u.y);
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          // 哪里该有落叶：树冠下（越靠树干越多）、墙根三米内，再用噪声打散；开阔处保留一成
          float m = 0.1;
          for (int i = 0; i < ${N}; i++) {
            float d = distance(vGw, uTrees[i].xy);
            m = max(m, smoothstep(uTrees[i].z, uTrees[i].z * 0.3, d));
          }
          float dw = min(min(vGw.x - uCourtR.x, uCourtR.z - vGw.x), min(vGw.y - uCourtR.y, uCourtR.w - vGw.y));
          m = max(m, smoothstep(3.5, 0.6, dw));
          float n = gN(vGw * 0.33) * 0.65 + gN(vGw * 1.7) * 0.35;
          m = clamp(m * mix(0.45, 1.35, n), 0.0, 1.0);
          // 叶子：颜色饱和；泥地：偏灰褐
          vec3 c = diffuseColor.rgb;
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float sat = (mx - mn) / max(mx, 1e-4);
          float leaf = smoothstep(0.62, 0.82, sat);
          vec3 earth = diffuse * vec3(0.24, 0.188, 0.142) * (0.86 + 0.28 * gN(vGw * 4.3)) * (0.92 + 0.16 * gN(vGw * 0.6));
          diffuseColor.rgb = mix(c, earth, leaf * (1.0 - m));
        }`
      );
  };
  mat.customProgramCacheKey = () => 'swept-ground';
}

export function buildTerrain(scene: THREE.Scene) {
  const group = new THREE.Group();

  // 院子地面
  const groundMat = pbr('ground', { metersPerTile: 3.2, color: '#c8bcae' });
  sweptGround(groundMat);
  // 地面挖出莲池的洞（Shape 的 y 对应世界的 -z）
  const GM = 2.5;
  const gx0 = COURT.x0 - GM, gx1 = COURT.x1 + GM, gz0 = COURT.z0 - GM, gz1 = COURT.z1 + GM;
  const shape = new THREE.Shape();
  shape.moveTo(gx0, -gz0);
  shape.lineTo(gx1, -gz0);
  shape.lineTo(gx1, -gz1);
  shape.lineTo(gx0, -gz1);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absellipse(POND.x, -POND.z, POND.rx + 0.05, POND.rz + 0.05, 0, Math.PI * 2, false, 0);
  shape.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(shape, 64);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'walkable';
  group.add(ground);

  // 石板路：山门 → 大殿台阶，一条支路通往莲池
  const pathMat = pbr('path', { metersPerTile: 2.8, color: '#c9c4bc' });
  let layer = 0;
  const addPath = (x0: number, z0: number, x1: number, z1: number, w: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const geo = new THREE.PlaneGeometry(w, len);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w + x0 * 0.37, uv.getY(i) * len + z0 * 0.37);
    const mesh = new THREE.Mesh(geo, pathMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(x1 - x0, z1 - z0);
    // 每条路略高一点点，交叠处不闪
    mesh.position.set((x0 + x1) / 2, 0.012 + layer++ * 0.0025, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    mesh.name = 'walkable';
    group.add(mesh);
  };
  // 大殿前的小广场（最底层）
  {
    const geo = new THREE.PlaneGeometry(26, 8);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 26, uv.getY(i) * 8);
    const plaza = new THREE.Mesh(geo, pathMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.01, 5.6);
    plaza.receiveShadow = true;
    plaza.name = 'walkable';
    group.add(plaza);
  }
  // 中轴参道：山门 → 石拱桥 → 大殿台阶（桥上不铺路面）
  addPath(0, COURT.z1 + 2, 0, BRIDGE.z1, 4.2);
  addPath(0, BRIDGE.z0, 0, HALL.stepZ1 - 0.1, 4.2);
  // 通往钟楼（东边原来的鼓楼 2026-11-19 去掉了，那里种了一棵银杏）
  addPath(-2, BELL.z + 0.5, BELL.x + BELL.size / 2 + 0.6, BELL.z + 0.5, 2.4);
  // 放生池两岸的小路
  for (const sx of [-1, 1]) addPath(sx * 2.2, BRIDGE.z0 - 0.6, sx * (POND.rx + 2.5), POND.z, 2.0);
  // 大殿前横向的路，连到两侧配殿
  for (const sh of SIDE_HALLS) addPath(0, 3.2, sh.x - Math.sign(sh.x) * (sh.w / 2 + 1.4), 3.2, 2.6);
  for (const sh of SIDE_HALLS) addPath(sh.x - Math.sign(sh.x) * (sh.w / 2 + 1.4), 3.2, sh.x - Math.sign(sh.x) * (sh.w / 2 + 1.4), sh.z, 2.6);
  // 绕过大殿两侧到后院，再到藏经阁台阶前
  for (const sx of [-1, 1]) addPath(sx * 19.2, 3.2, sx * 19.2, -28.6, 1.8);
  addPath(-19.2, -28.6, 19.2, -28.6, 2.2);
  addPath(0, -28.6, 0, LIBRARY.z + LIBRARY.w / 2 + 2.0, 2.8);

  // 远处的山：院墙外先是缓坡和林子，往外抬成几百米外的高山（大殿背后最高）
  const size = 1000;
  const seg = 250;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const r = rng(5);
  const noiseSeeds = Array.from({ length: 6 }, () => [r() * 100, r() * 100, 0.004 + r() * 0.03] as const);
  const noise = (x: number, z: number) => {
    let v = 0;
    for (const [ox, oz, f] of noiseSeeds) v += Math.sin((x + ox) * f * 6.1) * Math.cos((z + oz) * f * 5.3) / (f * 60);
    return v;
  };
  // 山脊：几层「1 - |sin|」叠出尖的山脊线，再按方向旋转打散
  const ridgeLayers = Array.from({ length: 5 }, (_, i) => ({ f: 0.006 * Math.pow(1.9, i), a: Math.pow(0.5, i), ang: r() * Math.PI, ph: r() * 100 }));
  const ridged = (x: number, z: number) => {
    let v = 0;
    for (const L of ridgeLayers) {
      const u = x * Math.cos(L.ang) + z * Math.sin(L.ang), w = -x * Math.sin(L.ang) + z * Math.cos(L.ang);
      const n = 1 - Math.abs(Math.sin(u * L.f + L.ph) * Math.cos(w * L.f * 0.7 + L.ph * 0.3));
      v += n * n * L.a;
    }
    return v / 1.6;
  };
  const forest = [new THREE.Color('#2f3d26'), new THREE.Color('#4a4a26'), new THREE.Color('#6b3e22'), new THREE.Color('#8a6a2c'), new THREE.Color('#3a4a2c')];
  const rock = new THREE.Color('#6e6a62');
  const tmp = new THREE.Color();
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // 院子是一个矩形，用到矩形的距离
    const dx = Math.max(0, Math.abs(x) - (COURT.x1 + GM + 0.5));
    const dz = Math.max(0, z < 0 ? -z - (-COURT.z0 + GM + 0.5) : z - (COURT.z1 + GM + 0.5));
    const d = Math.hypot(dx, dz);
    // 院子里的地形压低到地面以下，避免穿出地面和池底
    const insideCourt = Math.abs(x) < COURT.x1 + GM && z > COURT.z0 - GM && z < COURT.z1 + GM;
    let h = insideCourt ? -1.2 : -0.05;
    if (d > 0) {
      const ramp = Math.min(1, d / 60);
      const backBoost = z < 0 ? 1.6 : 0.8; // 大殿背后的山更高
      h = Math.pow(ramp, 1.6) * (9 * backBoost) + noise(x, z) * ramp * 2.5 + d * 0.02;
      // 高山：离院子四十米外开始升起，三百米外到最高
      const m = THREE.MathUtils.smoothstep(d, 40, 320);
      h += ridged(x, z) * m * (z < 0 ? 210 : 120) * (0.6 + 0.4 * Math.abs(Math.sin(Math.atan2(z, x) * 1.5 + 0.7)));
      h = Math.max(h, -0.05);
    }
    pos.setY(i, h - 0.06);
    heights[i] = h;
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heights[i];
    // 坡上是秋天的林子（青、黄、赭色块状交错），陡坡和山顶露出岩石
    const n = (Math.sin(x * 0.05 + Math.cos(z * 0.04) * 2) * Math.cos(z * 0.06 - x * 0.02) + 1) / 2;
    const n2 = (Math.sin(x * 0.17 + 1.3) * Math.sin(z * 0.15 + 0.4) + 1) / 2;
    tmp.copy(forest[Math.floor(n * 4.99)]).lerp(forest[Math.floor(n2 * 4.99)], 0.35);
    const slope = 1 - nrm.getY(i);
    const rocky = THREE.MathUtils.smoothstep(slope, 0.32, 0.55) + THREE.MathUtils.smoothstep(h, 150, 230);
    tmp.lerp(rock, Math.min(1, rocky));
    const dCourt = Math.max(Math.abs(x) - COURT.x1 - GM, z < 0 ? COURT.z0 - GM - z : z - COURT.z1 - GM);
    if (dCourt < 3) tmp.set('#8f8470');
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  {
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size, uv.getY(i) * size);
  }
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: canopyTexture() });
  terrainMat.map!.repeat.set(1 / 9, 1 / 9);
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // 地形高度（给山坡上种树用）
  const heightAt = (x: number, z: number) => {
    const fx = (x + size / 2) / size * seg, fz = (z + size / 2) / size * seg;
    const ix = Math.max(0, Math.min(seg - 1, Math.floor(fx))), iz = Math.max(0, Math.min(seg - 1, Math.floor(fz)));
    const a = heights[iz * (seg + 1) + ix], b = heights[iz * (seg + 1) + ix + 1], c = heights[(iz + 1) * (seg + 1) + ix], d2 = heights[(iz + 1) * (seg + 1) + ix + 1];
    const tx = fx - ix, tz = fz - iz;
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d2 * tx) * tz;
  };
  scene.add(group);
  return { ground, group, heightAt, size };
}
