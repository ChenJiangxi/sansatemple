// 天空、光照、昼夜、远山与地面
import * as THREE from 'three';
import { groundTexture, pavingTexture, rng } from '../textures';
import { HALL, COURT, POND, BELL, SIDE_HALLS } from '../layout';

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
}

const C = (h: string) => new THREE.Color(h);
const PRESETS: Record<Exclude<TimeMode, 'auto'>, Preset> = {
  dawn: { skyTop: C('#7b8fb5'), skyHorizon: C('#f2c6a0'), fog: C('#d9c2ad'), sun: C('#ffc58f'), sunI: 1.6, hemiSky: C('#b9c4dc'), hemiGround: C('#6b5a48'), hemiI: 0.9, elev: 0.18, azim: 1.9, lantern: 0.9, exposure: 1.0, stars: 0.1, envI: 0.2 },
  day: { skyTop: C('#7fa6cf'), skyHorizon: C('#dfe7e6'), fog: C('#cfd8d3'), sun: C('#fff1dc'), sunI: 2.9, hemiSky: C('#cfe0ef'), hemiGround: C('#7a6a50'), hemiI: 1.05, elev: 0.85, azim: 2.4, lantern: 0.25, exposure: 1.0, stars: 0, envI: 0.3 },
  dusk: { skyTop: C('#4b5a86'), skyHorizon: C('#f0a070'), fog: C('#b98f78'), sun: C('#ff9a5a'), sunI: 1.5, hemiSky: C('#9c8fb0'), hemiGround: C('#4e3d33'), hemiI: 0.75, elev: 0.12, azim: 3.9, lantern: 1.3, exposure: 1.05, stars: 0.15, envI: 0.15 },
  night: { skyTop: C('#0b1328'), skyHorizon: C('#2a3550'), fog: C('#1d2638'), sun: C('#9fb4ff'), sunI: 0.55, hemiSky: C('#33405e'), hemiGround: C('#1a1714'), hemiI: 0.32, elev: 0.7, azim: 4.2, lantern: 2.4, exposure: 1.1, stars: 1, envI: 0.04 },
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
    elev: ln(a.elev, b.elev), azim: ln(a.azim, b.azim), lantern: ln(a.lantern, b.lantern), exposure: ln(a.exposure, b.exposure), stars: ln(a.stars, b.stars), envI: ln(a.envI, b.envI),
  };
}

export class Environment {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  lanternLevel = 0.3;
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

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color() },
        stars: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 col = mix(horizon, top, pow(smoothstep(-0.05, 0.75, h), 0.7));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 1.2);
          if (stars > 0.0 && d.y > 0.05) {
            vec3 q = floor(d * 380.0);
            float st = step(0.9965, hash(q));
            col += vec3(st) * stars * smoothstep(0.05, 0.4, d.y) * 0.9;
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    scene.fog = new THREE.Fog('#cfd8d3', 45, 330);
    this.apply(presetForHour(12));
  }

  setMode(m: TimeMode) {
    this.mode = m;
    this.update();
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
    this.skyMat.uniforms.top.value.copy(p.skyTop);
    this.skyMat.uniforms.horizon.value.copy(p.skyHorizon);
    this.skyMat.uniforms.sunDir.value.copy(dir);
    this.skyMat.uniforms.sunColor.value.copy(p.sun);
    this.skyMat.uniforms.stars.value = p.stars;
    this.renderer.toneMappingExposure = p.exposure;
    this.lanternLevel = p.lantern;
    this.scene.environmentIntensity = p.envI;
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

// 地面：院子里平整，外面是起伏的秋山
export function buildTerrain(scene: THREE.Scene) {
  const group = new THREE.Group();

  // 院子地面
  const gtex = groundTexture();
  const groundMat = new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.97 });
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
  gtex.repeat.set(1 / 2.4, 1 / 2.4);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'walkable';
  group.add(ground);

  // 石板路：山门 → 大殿台阶，一条支路通往莲池
  const ptex = pavingTexture();
  const pathMat = new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.92 });
  const addPath = (x0: number, z0: number, x1: number, z1: number, w: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const geo = new THREE.PlaneGeometry(w, len);
    const t = ptex.clone();
    t.repeat.set(w / 3.2, len / 3.2);
    t.needsUpdate = true;
    const m = pathMat.clone();
    m.map = t;
    const mesh = new THREE.Mesh(geo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(x1 - x0, z1 - z0);
    mesh.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    mesh.name = 'walkable';
    group.add(mesh);
  };
  addPath(0, COURT.z1 + 2, 0, HALL.stepZ1 - 0.1, 4.2);
  addPath(2, 38, POND.x - POND.rx - 0.2, POND.z + 1, 2.4);
  addPath(-2, 36, BELL.x + BELL.size / 2 + 0.6, BELL.z + 0.5, 2.4);
  // 大殿前横向的路，连到两侧配殿
  for (const sh of SIDE_HALLS) addPath(0, 3.2, sh.x - Math.sign(sh.x) * (sh.w / 2 + 1.4), 3.2, 2.6);
  for (const sh of SIDE_HALLS) addPath(sh.x - Math.sign(sh.x) * (sh.w / 2 + 1.4), 3.2, sh.x - Math.sign(sh.x) * (sh.w / 2 + 1.4), sh.z, 2.6);
  // 大殿前的小广场
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(26, 8), pathMat.clone());
  (plaza.material as THREE.MeshStandardMaterial).map = (() => {
    const t = ptex.clone();
    t.repeat.set(26 / 3.2, 8 / 3.2);
    t.needsUpdate = true;
    return t;
  })();
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.011, 5.6);
  plaza.receiveShadow = true;
  plaza.name = 'walkable';
  group.add(plaza);

  // 远处的山：中间留出平地，往外逐渐隆起
  const size = 900;
  const seg = 220;
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
  const cA = new THREE.Color('#4f5a33');
  const cB = new THREE.Color('#7a4528');
  const cC = new THREE.Color('#8a682e');
  const cD = new THREE.Color('#3f5233');
  const tmp = new THREE.Color();
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
      h = Math.pow(ramp, 1.4) * (26 * backBoost) + noise(x, z) * ramp * 9 + d * 0.06;
      h = Math.max(h, -0.05);
    }
    pos.setY(i, h - 0.06);
    const n = (Math.sin(x * 0.11) * Math.cos(z * 0.13) + 1) / 2;
    const n2 = (Math.sin(x * 0.031 + 2) * Math.cos(z * 0.027 + 1) + 1) / 2;
    tmp.copy(cA).lerp(cB, n * 0.8).lerp(cC, n2 * 0.4).lerp(cD, Math.min(1, h / 50) * 0.5);
    if (d < 2) tmp.set('#6d6047');
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
  terrain.receiveShadow = true;
  group.add(terrain);

  // 远山上的树：实例化的小树冠
  const treeGeo = new THREE.IcosahedronGeometry(1, 1);
  const treeMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const count = 2600;
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const palette = ['#6e3420', '#8f4a26', '#a8742e', '#4f5f30', '#3a4d2c', '#7a3e24', '#946128', '#5d4a2a'].map((h) => new THREE.Color(h));
  const ray = new THREE.Raycaster();
  let placed = 0;
  terrain.updateMatrixWorld();
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const a = r() * Math.PI * 2;
    const dist = 70 + Math.pow(r(), 0.7) * 200;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (Math.abs(x) < COURT.x1 + 14 && z > COURT.z0 - 10 && z < COURT.z1 + 14) continue;
    ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(terrain, false)[0];
    if (!hit) continue;
    const s = 1.3 + r() * 1.6;
    p.set(x, hit.point.y + s * 0.5, z);
    sc.set(s, s * (1.2 + r() * 0.7), s);
    q.setFromEuler(new THREE.Euler(0, r() * 6, 0));
    m.compose(p, q, sc);
    trees.setMatrixAt(placed, m);
    trees.setColorAt(placed, palette[Math.floor(r() * palette.length)]);
    placed++;
  }
  trees.count = placed;
  group.add(trees);

  scene.add(group);
  return { ground, group };
}
