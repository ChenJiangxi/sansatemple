// 木鱼与念珠的特写层：独立的一块透明画布，叠在模糊后的主场景上
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rng } from './textures';

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

// —— 木鱼 ——
export class MoktakView {
  scene: THREE.Scene;
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private body: THREE.Group;
  private mallet: THREE.Group;
  private hit = 0;
  private wobble = 0;
  private t = 0;

  constructor(env: THREE.Texture) {
    this.scene = baseScene(env, 0.7);
    const wood = new THREE.MeshPhysicalMaterial({ map: woodGrain(5, '#a65a2c', '#5b2a12'), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#24120a', roughness: 0.9 });
    const root = new THREE.Group();
    root.scale.setScalar(0.62);
    root.position.y = 0.1;
    this.scene.add(root);
    this.body = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), wood);
    shell.scale.set(1.08, 0.9, 0.98);
    this.body.add(shell);
    // 鱼口：正面一道横向的深缝
    const slit = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 10, 64, Math.PI * 0.82), dark);
    slit.rotation.order = 'YXZ';
    slit.rotation.set(Math.PI / 2, -Math.PI * 0.09, 0);
    slit.scale.set(1.075, 0.97, 1);
    slit.position.y = -0.12;
    this.body.add(slit);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.035, 8, 64, Math.PI * 0.82), wood);
    lip.rotation.copy(slit.rotation);
    lip.scale.copy(slit.scale);
    lip.position.y = -0.03;
    this.body.add(lip);
    // 把手
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.12, 16, 32, Math.PI * 1.3), wood);
    handle.position.set(0.55, 0.72, -0.25);
    handle.rotation.set(0.15, 0.4, -0.4);
    this.body.add(handle);
    this.body.rotation.set(0.12, -0.3, 0);
    root.add(this.body);

    // 木槌
    this.mallet = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.4, 16), wood);
    stick.rotation.z = Math.PI / 2;
    stick.position.x = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), wood);
    this.mallet.add(stick, head);
    this.mallet.position.set(0.1, -1.1, 0.9);
    this.mallet.rotation.set(0, 0.35, 0.3);
    root.add(this.mallet);

    this.camera.position.set(0, 0.5, 7.2);
    this.camera.lookAt(0, 0.28, 0);
  }

  strike() {
    this.hit = 1;
    this.wobble = 1;
  }

  update(dt: number) {
    this.t += dt;
    this.hit = Math.max(0, this.hit - dt * 7);
    this.wobble = Math.max(0, this.wobble - dt * 5);
    const k = Math.sin(this.hit * Math.PI);
    this.mallet.rotation.z = 0.3 + k * 0.55;
    this.mallet.position.y = -1.1 + k * 0.15;
    const s = 1 - Math.sin(this.wobble * Math.PI) * 0.025;
    this.body.scale.set(1 / s, s, 1 / s);
    this.body.position.y = Math.sin(this.t * 1.2) * 0.02 + 0.25;
  }
}

// —— 念珠 ——
export class RosaryView {
  scene: THREE.Scene;
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private beads: THREE.Mesh[] = [];
  private guru: THREE.Group;
  private loop: THREE.Group;
  private N = 30;
  private a = 0.95; // 前后方向的半径
  private b = 1.9; // 上下方向的半径
  offset = 0; // 已经拨动的距离（以珠子为单位）
  velocity = 0;
  private dragging = false;
  counted = 0;
  onBead?: (total: number) => void;

  constructor(env: THREE.Texture) {
    this.scene = baseScene(env);
    this.loop = new THREE.Group();
    this.loop.rotation.y = -1.18;
    this.scene.add(this.loop);
    const mats = [0, 1, 2].map(
      (i) => new THREE.MeshPhysicalMaterial({ map: woodGrain(30 + i, ['#d98a4e', '#cf7f45', '#e0965a'][i], '#8a4520'), roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 })
    );
    const geo = new THREE.SphereGeometry(0.168, 32, 20);
    for (let i = 0; i < this.N; i++) {
      const m = new THREE.Mesh(geo, mats[i % 3]);
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      this.loop.add(m);
      this.beads.push(m);
    }
    // 绳子
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const th = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(th) * this.a, Math.cos(th) * this.b, 0));
    }
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.018, 6, true), new THREE.MeshStandardMaterial({ color: '#7a3a1c', roughness: 0.8 }));
    this.loop.add(cord);
    // 母珠与流苏（固定在底部）
    this.guru = new THREE.Group();
    const big = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 20), new THREE.MeshPhysicalMaterial({ map: woodGrain(41, '#a5532a', '#5a2410'), roughness: 0.35, clearcoat: 0.6 }));
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#b8452f', roughness: 0.9, side: THREE.DoubleSide }));
    tassel.position.y = -0.48;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), tassel.material);
    knot.position.y = -0.2;
    this.guru.add(big, knot, tassel);
    this.guru.position.set(0, -this.b - 0.2, 0);
    this.loop.add(this.guru);

    this.loop.position.y = 0.32;
    this.camera.position.set(0, 0, 10.4);
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
  private target: number | null = null;

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
        // 停下时吸附到整颗珠子
        const snap = Math.round(this.offset);
        this.offset += (snap - this.offset) * Math.min(1, dt * 10);
        this.velocity = 0;
      }
      this.check();
    }
    const step = (Math.PI * 2) / this.N;
    for (let i = 0; i < this.N; i++) {
      // 从底部的母珠开始排；靠近镜头的右侧一列随手指向下滑
      const th = Math.PI + (i + 0.5) * step + this.offset * step;
      const m = this.beads[i];
      m.position.set(Math.sin(th) * this.a, Math.cos(th) * this.b, 0);
      m.rotation.x = -this.offset * 0.6 + i;
    }
  }
}
