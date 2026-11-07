// 木鱼与念珠的特写层：独立的一块透明画布，叠在模糊后的主场景上
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rng } from './textures';
import * as BGU from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function woodGrain(seed: number, base: string, ring: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 256);
  const r = rng(seed);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = ring;
    g.globalAlpha = 0.12 + r() * 0.25;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    const y0 = r() * 256;
    for (let x = 0; x <= 512; x += 8) {
      const y = y0 + Math.sin(x * 0.012 + i) * 10 + Math.sin(x * 0.045 + i * 2) * 3;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class OverlayStage {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  env: THREE.Texture;
  active: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; update(dt: number): void } | null = null;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'overlay-canvas';
    parent.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    if (this.active) {
      this.active.camera.aspect = innerWidth / innerHeight;
      this.active.camera.updateProjectionMatrix();
    }
  }

  show(a: OverlayStage['active']) {
    this.active = a;
    this.canvas.classList.toggle('on', !!a);
    if (a) {
      a.camera.aspect = innerWidth / innerHeight;
      a.camera.updateProjectionMatrix();
    }
  }

  render(dt: number) {
    if (!this.active) return;
    this.active.update(dt);
    this.renderer.render(this.active.scene, this.active.camera);
  }
}

function baseScene(env: THREE.Texture, light = 1) {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.5 * light;
  const key = new THREE.DirectionalLight('#fff1dd', 2.6 * light);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight('#ffd9a8', 1.4);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim, new THREE.HemisphereLight('#fff5e8', '#5a4632', 0.7));
  return scene;
}

// —— 木鱼：寺院里的红漆大木鱼，金色鳞纹，正面一道鱼口，放在黄色木鱼垫上 ——
function moktakTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7c2414';
  g.fillRect(0, 0, 1024, 512);
  // 鳞纹：一排排错开的金色圆弧
  g.strokeStyle = 'rgba(226,178,84,0.75)';
  g.lineWidth = 4;
  const R = 30;
  for (let row = 0; row < 12; row++) {
    for (let k = -1; k < 1024 / (R * 2) + 1; k++) {
      const x = k * R * 2 + (row % 2) * R;
      const y = 120 + row * 26;
      g.beginPath();
      g.arc(x, y, R, Math.PI * 0.05, Math.PI * 0.95);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export class MoktakView {
  scene: THREE.Scene;
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private body: THREE.Group;
  private mallet: THREE.Group;
  private ripple: THREE.Mesh;
  private base = new THREE.Quaternion();
  private liftAxis = new THREE.Vector3();
  private strikeT = 1; // 0 → 1：一次敲击的进度
  private wobble = 0;
  private t = 0;

  constructor(env: THREE.Texture) {
    this.scene = baseScene(env, 0.75);
    const lacquer = new THREE.MeshPhysicalMaterial({ map: moktakTexture(), roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.18 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1c0b06', roughness: 0.9 });
    const gold = new THREE.MeshStandardMaterial({ color: '#d6a64c', metalness: 0.85, roughness: 0.3 });
    const root = new THREE.Group();
    root.scale.setScalar(0.62);
    this.scene.add(root);

    this.body = new THREE.Group();
    // 鱼身：圆鼓的鱼头，正面横刻一道深深的鱼口，底部略压平坐在垫子上
    const SX = 1.2, SY = 0.92, SZ = 1.05;
    const MOUTH_Y = -0.16, MOUTH_W = 0.085, MOUTH_D = 0.24, MOUTH_HALF = Math.PI * 0.4;
    const shellGeo = new THREE.SphereGeometry(1, 96, 128);
    const p = shellGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const az = Math.abs(Math.atan2(v.x, v.z)); // 0 = 正前方
      const front = THREE.MathUtils.smoothstep(MOUTH_HALF - az, 0, 0.25);
      const dy = (v.y - MOUTH_Y) / MOUTH_W;
      if (Math.abs(dy) < 1 && front > 0) {
        const k = 1 - MOUTH_D * front * Math.sqrt(1 - dy * dy);
        v.x *= k;
        v.z *= k;
      }
      if (v.y < -0.72) v.y = -0.72 + (v.y + 0.72) * 0.25;
      p.setXYZ(i, v.x * SX, v.y * SY, v.z * SZ);
    }
    shellGeo.computeVertexNormals();
    this.body.add(new THREE.Mesh(shellGeo, lacquer));
    // 鱼口深处是暗的
    const slit = new THREE.Mesh(new THREE.TorusGeometry(1 - MOUTH_D * 0.9, 0.05, 8, 64, MOUTH_HALF * 2), dark);
    slit.rotation.order = 'YXZ';
    slit.rotation.set(Math.PI / 2, 0, Math.PI / 2 - MOUTH_HALF);
    slit.scale.set(SX, SZ, 1);
    slit.position.y = MOUTH_Y * SY;
    this.body.add(slit);
    // 鱼口上下的金边
    for (const dy of [MOUTH_W * 1.25, -MOUTH_W * 1.25]) {
      const y = MOUTH_Y + dy;
      const r = Math.sqrt(1 - y * y) + 0.006;
      const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 6, 64, MOUTH_HALF * 2), gold);
      lip.rotation.copy(slit.rotation);
      lip.scale.set(SX, SZ, 1);
      lip.position.y = y * SY;
      this.body.add(lip);
    }
    // 鱼眼：鱼口两端上方一对浅浮雕的眼睛
    for (const sx of [-1, 1]) {
      const dir = new THREE.Vector3(sx * Math.sin(MOUTH_HALF * 0.82), 0.12, Math.cos(MOUTH_HALF * 0.82)).normalize();
      const at = new THREE.Vector3(dir.x * SX, dir.y * SY, dir.z * SZ);
      const out = new THREE.Vector3(dir.x / SX, dir.y / SY, dir.z / SZ).normalize();
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), lacquer);
      eye.scale.set(1, 1, 0.45);
      eye.position.copy(at);
      eye.lookAt(at.clone().add(out));
      this.body.add(eye);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 24), gold);
      rim.position.copy(at).addScaledVector(out, 0.01);
      rim.lookAt(rim.position.clone().add(out));
      this.body.add(rim);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), dark);
      pupil.scale.set(1, 1, 0.5);
      pupil.position.copy(at).addScaledVector(out, 0.05);
      this.body.add(pupil);
    }
    this.body.rotation.set(0.12, -0.28, 0);
    this.body.position.y = 0.16;
    root.add(this.body);

    // 木鱼垫：黄色锦缎圆垫
    const cushion = new THREE.Mesh(
      new THREE.LatheGeometry([[0, -0.62], [1.25, -0.62], [1.35, -0.55], [1.36, -0.42], [1.25, -0.36], [0, -0.38]].map(([x, y]) => new THREE.Vector2(x, y)), 48),
      new THREE.MeshStandardMaterial({ color: '#c8952f', roughness: 0.75 })
    );
    root.add(cushion);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(1.33, 0.03, 8, 64), new THREE.MeshStandardMaterial({ color: '#a8261a', roughness: 0.6 }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.5;
    root.add(trim);

    // 木槌：握柄在右上方，槌头落在木鱼顶前方
    const wood = new THREE.MeshPhysicalMaterial({ map: woodGrain(7, '#8a5a32', '#4a2a14'), roughness: 0.45, clearcoat: 0.3 });
    this.mallet = new THREE.Group();
    this.body.updateMatrix();
    const u = new THREE.Vector3(0.22, 0.82, 0.53).normalize();
    const n = new THREE.Vector3(u.x / SX, u.y / SY, u.z / SZ).normalize();
    const hit = new THREE.Vector3(u.x * SX, u.y * SY, u.z * SZ).addScaledVector(n, 0.19).applyMatrix4(this.body.matrix);
    const pivot = hit.clone().add(new THREE.Vector3(1.45, 0.3, 0.35));
    const dir = hit.clone().sub(pivot);
    const len = dir.length();
    dir.normalize();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, len, 16), wood);
    stick.rotation.z = Math.PI / 2;
    stick.position.x = -len / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), wood);
    head.position.x = -len;
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#a8261a', roughness: 0.7 }));
    wrap.rotation.z = Math.PI / 2;
    wrap.position.x = -0.18;
    this.mallet.add(stick, head, wrap);
    this.mallet.position.copy(pivot);
    this.base.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), dir);
    this.liftAxis.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    root.add(this.mallet);

    // 敲中时的一圈涟漪
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 48), new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const nW = n.clone().applyQuaternion(this.body.quaternion);
    this.ripple.position.copy(hit).addScaledVector(nW, -0.17);
    this.ripple.lookAt(this.ripple.position.clone().add(nW));
    root.add(this.ripple);

    this.camera.position.set(0, 0.95, 6.6);
    this.camera.lookAt(0, 0.12, 0);
    this.pose(0.3);
  }

  // 抬起角度：0 = 槌头贴在木鱼上
  private pose(lift: number) {
    const q = new THREE.Quaternion().setFromAxisAngle(this.liftAxis, lift);
    this.mallet.quaternion.copy(q).multiply(this.base);
  }

  strike() {
    this.strikeT = 0;
  }

  update(dt: number) {
    this.t += dt;
    const D = 0.34; // 一次敲击 0.34 秒：0.07 秒落下，之后弹回
    const REST = 0.3; // 静止时木槌抬起的角度
    let lift: number;
    if (this.strikeT < 1) {
      this.strikeT = Math.min(1, this.strikeT + dt / D);
      const k = this.strikeT;
      const down = 0.2;
      if (k < down) lift = REST * (1 - (k / down) * (k / down));
      else {
        if (this.wobble <= 0 && k >= down) this.wobble = 1;
        const u = (k - down) / (1 - down);
        lift = REST * (1 - Math.pow(1 - u, 3)) + Math.sin(u * Math.PI) * 0.05;
      }
    } else lift = REST + Math.sin(this.t * 1.6) * 0.012;
    this.pose(lift);
    // 木鱼被敲时轻轻一沉、一颤
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt * 5);
      const w = Math.sin((1 - this.wobble) * Math.PI * 3) * this.wobble;
      this.body.scale.set(1 + w * 0.012, 1 - w * 0.025, 1 + w * 0.012);
      const rm = this.ripple.material as THREE.MeshBasicMaterial;
      rm.opacity = this.wobble * 0.55;
      this.ripple.scale.setScalar(1 + (1 - this.wobble) * 2.5);
    } else this.body.scale.set(1, 1, 1);
  }
}

// —— 念珠：一百零八颗的一串，底部是佛头（三通）、佛塔和红色流苏；珠子从佛头的一侧出来、绕一圈回到另一侧 ——
export class RosaryView {
  scene: THREE.Scene;
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private beads: THREE.Mesh[] = [];
  private loop: THREE.Group;
  private N = 22;
  private a = 0.9; // 前后方向的半径
  private b = 1.8; // 上下方向的半径
  private gap = 0.6; // 底部给佛头留出的角度（弧度）
  private arcT: number[] = []; // 弧长 → 角度的对照表
  offset = 0; // 已经拨动的距离（以珠子为单位）
  velocity = 0;
  private dragging = false;
  counted = 0;
  onBead?: (total: number) => void;
  private target: number | null = null;

  constructor(env: THREE.Texture) {
    this.scene = baseScene(env);
    this.loop = new THREE.Group();
    this.loop.rotation.y = -1.18;
    this.scene.add(this.loop);
    const mats = [0, 1, 2].map(
      (i) => new THREE.MeshPhysicalMaterial({ map: woodGrain(30 + i, ['#a8552e', '#9a4b28', '#b25c32'][i], '#5a2410'), roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.3 })
    );
    const geo = new THREE.SphereGeometry(0.155, 32, 20);
    // 椭圆上按弧长等分：先累计弧长，再反查角度
    {
      const K = 600;
      const th0 = Math.PI + this.gap / 2, span = Math.PI * 2 - this.gap;
      const L = [0];
      for (let k = 1; k <= K; k++) {
        const t0 = th0 + ((k - 1) / K) * span, t1 = th0 + (k / K) * span;
        L.push(L[k - 1] + Math.hypot(this.a * (Math.sin(t1) - Math.sin(t0)), this.b * (Math.cos(t1) - Math.cos(t0))));
      }
      const total = L[K];
      let j = 0;
      for (let q = 0; q <= 240; q++) {
        const want = (q / 240) * total;
        while (j < K && L[j + 1] < want) j++;
        const f = j < K ? (want - L[j]) / Math.max(1e-9, L[j + 1] - L[j]) : 0;
        this.arcT.push(th0 + ((j + f) / K) * span);
      }
    }
    for (let i = 0; i < this.N; i++) {
      const m = new THREE.Mesh(geo, mats[i % 3]);
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      this.loop.add(m);
      this.beads.push(m);
    }
    // 穿珠的红绳：沿着整圈，两端收进佛头
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const th = Math.PI + this.gap * 0.35 + (i / 96) * (Math.PI * 2 - this.gap * 0.7);
      pts.push(new THREE.Vector3(Math.sin(th) * this.a, Math.cos(th) * this.b, 0));
    }
    const cordMat = new THREE.MeshStandardMaterial({ color: '#a8261a', roughness: 0.8 });
    this.loop.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.016, 6, false), cordMat));

    // 佛头、佛塔、结和流苏
    const guruMat = new THREE.MeshPhysicalMaterial({ map: woodGrain(41, '#6a2a14', '#2a0c04'), roughness: 0.3, clearcoat: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#d6a64c', metalness: 0.85, roughness: 0.3 });
    const g = new THREE.Group();
    const guru = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 20), guruMat);
    g.add(guru);
    const stupa = new THREE.Group();
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.16, 20), guruMat);
    s1.position.y = -0.34;
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), guruMat);
    s2.position.y = -0.46;
    const s3 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 16), guruMat);
    s3.position.y = -0.6;
    s3.rotation.x = Math.PI;
    stupa.add(s1, s2, s3);
    g.add(stupa);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 8, 16), goldMat);
    ringA.rotation.x = Math.PI / 2;
    ringA.position.y = -0.69;
    g.add(ringA);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), cordMat);
    knot.scale.set(1, 0.8, 1);
    knot.position.y = -0.78;
    g.add(knot);
    // 流苏：一束细丝
    const threads: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 40; k++) {
      const ang = (k / 40) * Math.PI * 2;
      const r0 = 0.03, r1 = 0.07 + Math.random() * 0.06;
      const len = 0.42 + Math.random() * 0.08;
      const th = new THREE.CylinderGeometry(0.008, 0.008, len, 3);
      const top = new THREE.Vector3(Math.cos(ang) * r0, -0.84, Math.sin(ang) * r0);
      const bot = new THREE.Vector3(Math.cos(ang) * r1, -0.84 - len, Math.sin(ang) * r1);
      const m4 = new THREE.Matrix4().compose(top.clone().add(bot).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize()), new THREE.Vector3(1, 1, 1));
      th.applyMatrix4(m4);
      threads.push(th);
    }
    const { mergeGeometries } = BGU;
    g.add(new THREE.Mesh(mergeGeometries(threads), cordMat));
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.018, 8, 16), goldMat);
    ringB.rotation.x = Math.PI / 2;
    ringB.position.y = -0.9;
    g.add(ringB);
    g.position.set(0, -this.b - 0.05, 0);
    this.loop.add(g);

    this.loop.position.y = 0.97;
    this.camera.position.set(0, 0, 11.6);
    this.camera.lookAt(0, -0.05, 0);
  }

  setDragging(d: boolean) {
    this.dragging = d;
  }

  // 拖动距离（像素）→ 珠子
  drag(dyPx: number) {
    const delta = dyPx / 52;
    this.offset += delta;
    this.velocity = delta * 60;
    this.check();
  }

  nudge(n: number) {
    this.velocity = 0;
    this.target = Math.round(this.offset) + n;
  }

  private check() {
    const f = Math.floor(this.offset + 0.5);
    if (f > this.counted) {
      const diff = f - this.counted;
      this.counted = f;
      for (let i = 0; i < diff; i++) this.onBead?.(1);
    }
  }

  update(dt: number) {
    if (!this.dragging) {
      if (this.target !== null) {
        this.offset += (this.target - this.offset) * Math.min(1, dt * 12);
        if (Math.abs(this.target - this.offset) < 0.002) {
          this.offset = this.target;
          this.target = null;
        }
      } else if (Math.abs(this.velocity) > 0.05) {
        this.offset += this.velocity * dt;
        this.velocity *= Math.pow(0.04, dt);
      } else {
        const snap = Math.round(this.offset);
        this.offset += (snap - this.offset) * Math.min(1, dt * 10);
        this.velocity = 0;
      }
      this.check();
    }
    // 珠子在佛头两侧之间的那段弧上按弧长等距排开；靠近佛头时缩小，像是穿进佛头里
    for (let i = 0; i < this.N; i++) {
      let s = (i + this.offset) % this.N;
      if (s < 0) s += this.N;
      const q = ((s + 0.5) / this.N) * 240;
      const q0 = Math.min(239, Math.floor(q));
      const th = this.arcT[q0] + (this.arcT[q0 + 1] - this.arcT[q0]) * (q - q0);
      const m = this.beads[i];
      m.position.set(Math.sin(th) * this.a, Math.cos(th) * this.b, 0);
      const edge = Math.min(s + 0.5, this.N - s - 0.5);
      const sc = Math.min(1, Math.max(0.001, edge / 0.7));
      m.scale.setScalar(sc * sc * (3 - 2 * sc));
      m.rotation.x = -this.offset * 0.6 + i;
    }
  }
}
