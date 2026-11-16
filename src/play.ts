// 游戏层：飘字、木鱼节拍判定、撞钟蓄力、寺务（僧人请你帮忙）。
// 都是放松玩法：不会失败，只是做得准、做得好，功德多一些。
import * as THREE from 'three';
import { t, type Key } from './i18n';
import { mapleLeafTexture } from './textures';

// —— 飘字：从屏幕某点往上飘、慢慢淡出 ——
export function floatText(parent: HTMLElement, x: number, y: number, html: string, cls = '') {
  const e = document.createElement('div');
  e.className = `float-text ${cls}`;
  e.innerHTML = html;
  e.style.left = `${x}px`;
  e.style.top = `${y}px`;
  parent.appendChild(e);
  requestAnimationFrame(() => e.classList.add('go'));
  setTimeout(() => e.remove(), 1500);
}

// —— 木鱼节拍：跟着念佛的拍子敲，越准越好 ——
export type Grade = 'perfect' | 'good' | 'miss';
export class Rhythm {
  readonly period = 0.68; // 秒，约 88 拍每分
  private t0 = 0;
  combo = 0;
  best = 0;
  ring: HTMLElement;
  private on = false;
  constructor(parent: HTMLElement) {
    this.ring = document.createElement('div');
    this.ring.className = 'beat-ring';
    this.ring.hidden = true;
    parent.appendChild(this.ring);
  }
  start() {
    this.t0 = performance.now() / 1000;
    this.combo = 0;
    this.on = true;
    this.ring.hidden = false;
  }
  stop() {
    this.on = false;
    this.ring.hidden = true;
  }
  // 拍子的相位：0 正好在拍上，接近 1 就是下一拍之前
  phase(now = performance.now() / 1000) {
    return (((now - this.t0) / this.period) % 1 + 1) % 1;
  }
  // 下一拍还有多少毫秒（自动敲木鱼对齐用）
  untilBeat() {
    return (1 - this.phase()) * this.period * 1000;
  }
  update() {
    if (!this.on) return;
    const ph = this.phase();
    // 圆环从外往里收，正好收到木鱼上时就是拍点
    const s = 1 + 1.5 * (1 - ph);
    this.ring.style.transform = `translate(-50%, -50%) scale(${s.toFixed(3)})`;
    this.ring.style.opacity = (0.15 + 0.75 * ph * ph).toFixed(2);
  }
  hit(): { grade: Grade; points: number } {
    const ph = this.phase();
    const ms = Math.min(ph, 1 - ph) * this.period * 1000;
    const grade: Grade = ms < 80 ? 'perfect' : ms < 170 ? 'good' : 'miss';
    if (grade === 'miss') this.combo = 0;
    else this.combo++;
    this.best = Math.max(this.best, this.combo);
    const bonus = this.combo >= 30 ? 2 : this.combo >= 10 ? 1 : 0;
    const points = grade === 'perfect' ? 2 + bonus : grade === 'good' ? 1 + bonus : 0;
    this.ring.classList.remove('flash-perfect', 'flash-good');
    if (grade !== 'miss') {
      void this.ring.offsetWidth;
      this.ring.classList.add(grade === 'perfect' ? 'flash-perfect' : 'flash-good');
    }
    return { grade, points };
  }
}

// —— 撞钟：按住把撞木往后拉，力度来回摆，落在金色区间里松手最好 ——
export class Charge {
  private layer: HTMLElement;
  private fill: HTMLElement;
  private hint: HTMLElement;
  private holding = false;
  private time = 0;
  power = 0;
  active = false;
  static readonly ZONE: [number, number] = [0.78, 0.93];
  constructor(parent: HTMLElement, private hooks: { onRelease(q: number, power: number): void; onCancel(): void }) {
    this.layer = document.createElement('div');
    this.layer.className = 'charge-layer';
    this.layer.hidden = true;
    const meter = document.createElement('div');
    meter.className = 'charge-meter';
    const zone = document.createElement('div');
    zone.className = 'charge-zone';
    zone.style.left = `${Charge.ZONE[0] * 100}%`;
    zone.style.width = `${(Charge.ZONE[1] - Charge.ZONE[0]) * 100}%`;
    this.fill = document.createElement('div');
    this.fill.className = 'charge-fill';
    meter.append(zone, this.fill);
    this.hint = document.createElement('div');
    this.hint.className = 'charge-hint';
    const close = document.createElement('button');
    close.className = 'icon-btn small charge-close';
    close.innerHTML = '×';
    close.onpointerdown = (e) => e.stopPropagation();
    close.onclick = (e) => {
      e.stopPropagation();
      this.close();
      this.hooks.onCancel();
    };
    this.layer.append(meter, this.hint, close);
    parent.appendChild(this.layer);
    this.layer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.press();
    });
    this.layer.addEventListener('pointerup', () => this.release());
    this.layer.addEventListener('pointercancel', () => this.release());
    addEventListener('keydown', (e) => {
      if (!this.active || e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.press();
      }
      if (e.key === 'Escape') {
        this.close();
        this.hooks.onCancel();
      }
    });
    addEventListener('keyup', (e) => {
      if (this.active && (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e')) this.release();
    });
  }
  open() {
    this.active = true;
    this.holding = false;
    this.power = 0;
    this.time = 0;
    this.layer.hidden = false;
    this.hint.textContent = t('bellHold');
  }
  close() {
    this.active = false;
    this.holding = false;
    this.layer.hidden = true;
  }
  private press() {
    if (!this.active || this.holding) return;
    this.holding = true;
    this.time = 0;
    this.hint.textContent = t('bellRelease');
  }
  private release() {
    if (!this.active || !this.holding) return;
    this.holding = false;
    const p = this.power;
    const [a, b] = Charge.ZONE;
    const d = p < a ? a - p : p > b ? p - b : 0;
    const q = Math.max(0, 1 - d / 0.45);
    this.close();
    this.hooks.onRelease(q, p);
  }
  update(dt: number) {
    if (!this.active) return;
    if (this.holding) {
      this.time += dt;
      // 慢慢拉满，再松一点回来，来回摆
      this.power = (1 - Math.cos(this.time * 2.1)) / 2;
    } else this.power = Math.max(0, this.power - dt * 2);
    this.fill.style.width = `${(this.power * 100).toFixed(1)}%`;
    this.fill.classList.toggle('in-zone', this.power >= Charge.ZONE[0] && this.power <= Charge.ZONE[1]);
  }
}

// —— 寺务：僧人请你帮忙 ——
export interface QuestDef {
  id: 'sweep' | 'water';
  giver: number; // 请你帮忙的那位僧人的编号
  targets: { x: number; z: number; standX: number; standZ: number; yaw: number }[];
  action: 'sweep' | 'water';
  seconds: number;
  points: number; // 每个目标
  reward: number; // 回禀时
  icon: string;
}

// 一堆落叶：几十片叶子堆成小丘；扫掉时四散飘开
export function leafPile(x: number, z: number, seed: number) {
  const g = new THREE.Group();
  const tex = mapleLeafTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
  const N = 70;
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const cols = ['#e3b23a', '#d98b2c', '#c8502a', '#e8c64a', '#b8401f'].map((h) => new THREE.Color(h));
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const base: { p: THREE.Vector3; e: THREE.Euler }[] = [];
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.65;
    const h = (1 - d / 0.65) * 0.22 + rnd() * 0.04;
    p.set(Math.cos(a) * d, 0.02 + h, Math.sin(a) * d);
    const e = new THREE.Euler(-Math.PI / 2 + (rnd() - 0.5) * 0.9, rnd() * 6.28, (rnd() - 0.5) * 0.9);
    base.push({ p: p.clone(), e });
    m.compose(p, q.setFromEuler(e), s);
    im.setMatrixAt(i, m);
    im.setColorAt(i, cols[i % cols.length]);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  g.add(im);
  g.position.set(x, 0, z);
  // 扫：k 从 0 到 1，叶子往外飞、往上扬、再落下变淡
  let k = -1;
  const vel = base.map(() => new THREE.Vector3((rnd() - 0.5) * 3, 1 + rnd() * 1.5, (rnd() - 0.5) * 3));
  return {
    group: g,
    sweep() {
      if (k < 0) k = 0;
    },
    update(dt: number) {
      if (k < 0 || k > 1) return;
      k = Math.min(1.01, k + dt / 1.6);
      base.forEach((b, i) => {
        const v = vel[i];
        p.set(b.p.x + v.x * k, Math.max(0.02, b.p.y + v.y * k - 2.2 * k * k), b.p.z + v.z * k);
        const e2 = new THREE.Euler(b.e.x + k * 6 * (i % 2 ? 1 : -1), b.e.y + k * 3, b.e.z);
        m.compose(p, q.setFromEuler(e2), s.setScalar(1 - k * 0.6));
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      if (k > 1) g.visible = false;
    },
  };
}

// 树下待浇水的一圈：浅色细环；浇过之后变成一圈湿土
export function waterRing(x: number, z: number) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: '#f6e7b0', transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.03, z);
  const wet = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshStandardMaterial({ color: '#3a2a1c', transparent: true, opacity: 0, roughness: 0.4, depthWrite: false }));
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(x, 0.022, z);
  let w = -1;
  return {
    meshes: [ring, wet],
    water() {
      if (w < 0) w = 0;
    },
    update(dt: number, time: number) {
      if (w < 0) {
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(time * 3);
        return;
      }
      w = Math.min(1, w + dt / 2.5);
      ring.visible = false;
      (wet.material as THREE.MeshStandardMaterial).opacity = 0.45 * w;
    },
  };
}

export const questText = (k: string, vars?: Record<string, string | number>) => t(k as Key, vars);
