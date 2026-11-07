// 香：插在香炉沙面上的一根根线香，带火点和缓缓上升的细烟
import * as THREE from 'three';

export interface IncenseView {
  id: string;
  mine: boolean;
  remain: number; // 0..1
}

export class IncenseSpot {
  group = new THREE.Group();
  private sticks: { stick: THREE.Mesh; ember: THREE.Mesh }[] = [];
  private active: number[] = [];
  private parts: { x: number; y: number; z: number; age: number; life: number; seed: number }[];
  private sp: Float32Array;
  private sa: Float32Array;
  private ss: Float32Array;
  private geo: THREE.BufferGeometry;
  private acc = 0;
  private emberMat = new THREE.MeshBasicMaterial({ color: '#ff7a3a' });
  private stickMat = new THREE.MeshStandardMaterial({ color: '#8f4526', roughness: 0.8 });
  private myStickMat = new THREE.MeshStandardMaterial({ color: '#c07a34', roughness: 0.8 });

  constructor(scene: THREE.Object3D, cx: number, sandY: number, cz: number, radius: number, max = 24, stickLen = 0.5) {
    const stickGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 5);
    stickGeo.translate(0, 0.5, 0);
    const emberGeo = new THREE.SphereGeometry(0.014, 6, 4);
    for (let i = 0; i < max; i++) {
      const a = i * 2.399;
      const d = radius * (0.15 + Math.sqrt(i / max) * 0.75);
      const stick = new THREE.Mesh(stickGeo, this.stickMat);
      stick.position.set(cx + Math.cos(a) * d, sandY, cz + Math.sin(a) * d);
      stick.rotation.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
      stick.userData.len = stickLen;
      const ember = new THREE.Mesh(emberGeo, this.emberMat);
      stick.visible = ember.visible = false;
      this.group.add(stick, ember);
      this.sticks.push({ stick, ember });
    }
    const n = 220;
    this.geo = new THREE.BufferGeometry();
    this.sp = new Float32Array(n * 3);
    this.sa = new Float32Array(n);
    this.ss = new Float32Array(n);
    for (let i = 0; i < n; i++) this.sp[i * 3 + 1] = -100;
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.sp, 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.sa, 1));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.ss, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { color: { value: new THREE.Color('#e9e6df') }, scale: { value: 420 } },
      vertexShader: `attribute float alpha; attribute float size; varying float vA; uniform float scale;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(color, a); #include <colorspace_fragment> }`,
    });
    const pts = new THREE.Points(this.geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    this.parts = Array.from({ length: n }, () => ({ x: 0, y: -100, z: 0, age: 99, life: 1, seed: Math.random() * 10 }));
    scene.add(this.group);
  }

  set(list: IncenseView[]) {
    this.active = [];
    this.sticks.forEach((s, i) => {
      const item = list[i];
      if (!item) {
        s.stick.visible = s.ember.visible = false;
        return;
      }
      const len = s.stick.userData.len * (0.25 + 0.75 * Math.max(0, Math.min(1, item.remain)));
      s.stick.scale.set(1, len, 1);
      s.stick.material = item.mine ? this.myStickMat : this.stickMat;
      s.stick.visible = s.ember.visible = true;
      s.stick.updateMatrix();
      s.ember.position.copy(new THREE.Vector3(0, 1, 0).applyMatrix4(s.stick.matrix));
      this.active.push(i);
    });
  }

  update(dt: number, t: number) {
    if (this.active.length) {
      this.acc += dt * (8 + this.active.length * 5);
      while (this.acc > 1) {
        this.acc -= 1;
        const p = this.parts.find((q) => q.age >= q.life);
        if (!p) break;
        const s = this.sticks[this.active[Math.floor(Math.random() * this.active.length)]];
        p.x = s.ember.position.x;
        p.y = s.ember.position.y;
        p.z = s.ember.position.z;
        p.age = 0;
        p.life = 4 + Math.random() * 3;
        p.seed = Math.random() * 10;
      }
    }
    let any = false;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.age < p.life) {
        any = true;
        p.age += dt;
        const k = p.age / p.life;
        p.y += dt * (0.3 + k * 0.12);
        p.x += Math.sin(t * 0.9 + p.seed + p.age * 1.3) * dt * 0.08 * (0.3 + k) + dt * 0.03;
        p.z += Math.cos(t * 0.7 + p.seed * 1.7 + p.age) * dt * 0.06 * (0.3 + k);
        this.sp[i * 3] = p.x;
        this.sp[i * 3 + 1] = p.y;
        this.sp[i * 3 + 2] = p.z;
        this.sa[i] = Math.sin(Math.min(1, k) * Math.PI) * 0.17 * (1 - k * 0.5);
        this.ss[i] = 0.05 + k * 0.5;
      } else if (this.sa[i] !== 0) {
        this.sa[i] = 0;
        this.sp[i * 3 + 1] = -100;
        any = true;
      }
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.alpha.needsUpdate = true;
      this.geo.attributes.size.needsUpdate = true;
    }
    this.emberMat.color.setHSL(0.05, 1, 0.5 + Math.sin(t * 3) * 0.06);
  }
}
