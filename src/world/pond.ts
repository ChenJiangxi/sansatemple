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

// 锦鲤的花色：白底上随机几块红斑，实例颜色再整体染色（白 → 红白锦鲤，金 → 黄金锦鲤）
function koiTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f1e6';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#e2461f';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.ellipse(Math.random() * 128, 10 + Math.random() * 44, 8 + Math.random() * 16, 6 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function koiGeometry() {
  // 身子：拉长的椭球，头朝 +z；尾鳍：两片薄三角；胸鳍：两片小三角
  const body = new THREE.SphereGeometry(1, 16, 10);
  body.scale(0.075, 0.05, 0.27);
  const fin = (pts: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pts.length / 3) * 2).fill(0.5), 2));
    g.computeVertexNormals();
    return g;
  };
  const tail = fin([0, 0, -0.24, -0.11, 0.02, -0.42, 0.11, 0.02, -0.42, 0, 0, -0.24, 0.11, 0.02, -0.42, -0.11, 0.02, -0.42]);
  const pec = fin([0.05, -0.02, 0.08, 0.16, -0.03, 0.0, 0.05, -0.02, 0.0, -0.05, -0.02, 0.08, -0.05, -0.02, 0.0, -0.16, -0.03, 0.0]);
  return mergeGeometries([body.toNonIndexed(), tail, pec])!;
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
  const aPhase = new THREE.InstancedBufferAttribute(new Float32Array(KOI), 1);
  const aSwim = new THREE.InstancedBufferAttribute(new Float32Array(KOI), 1);
  kgeo.setAttribute('aPhase', aPhase);
  kgeo.setAttribute('aSwim', aSwim);
  const timeU = { value: 0 };
  const kmat = new THREE.MeshStandardMaterial({ map: koiTexture(), roughness: 0.45, metalness: 0.05 });
  kmat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;\nattribute float aSwim;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float along = clamp((0.12 - transformed.z) / 0.54, 0.0, 1.0);
        transformed.x += sin(uTime * (5.0 + aSwim * 6.0) + aPhase - transformed.z * 9.0) * (0.02 + 0.05 * aSwim) * along * along;`
      );
  };
  const koi = new THREE.InstancedMesh(kgeo, kmat, KOI);
  const palette = ['#ffffff', '#ffffff', '#ffffff', '#f0a43a', '#ff9a50', '#2b2622', '#f7d58a'].map((c) => new THREE.Color(c));
  const fish = Array.from({ length: KOI }, (_, i) => {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.7;
    aPhase.setX(i, Math.random() * 6.28);
    koi.setColorAt(i, palette[i % palette.length]);
    return {
      x: POND.x + Math.cos(a) * POND.rx * d,
      z: POND.z + Math.sin(a) * POND.rz * d,
      h: Math.random() * 6.28,
      v: 0.25,
      tx: 0,
      tz: 0,
      wait: 0,
      size: 0.75 + Math.random() * 0.55,
      depth: -0.34 - Math.random() * 0.12,
      bob: Math.random() * 6,
    };
  });
  koi.frustumCulled = false;
  group.add(koi);

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
        koi.setMatrixAt(i, m4.compose(pos, q, sc));
      }
      koi.instanceMatrix.needsUpdate = true;
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
