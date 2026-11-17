// 画面后期：场景先画进 HDR 缓冲并算环境光遮蔽（墙角、檐下、物体接地处自然变暗）→ 泛光（只有灯笼、烛火、香头这类足够亮的东西会晕开）→ 色调映射 →
// 调色（饱和度、对比度、冷暖、暗部抬升）+ 暗角 + 一层静止的纸纹颗粒。
// 帧耗时长期偏高时自动降分辨率，再不行就关掉泛光；用户也可以在设置里直接选「流畅」。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { N8AOPass } from 'n8ao';

export type Quality = 'high' | 'low';

export interface Look {
  bloom: number; // 泛光强度
  threshold: number; // 多亮才开始晕开（线性亮度）
  tint: THREE.Color; // 冷暖
  sat: number;
  contrast: number;
  lift: number; // 暗部抬升
  vignette: number;
}

// 纸纹：低频斑驳 + 细纤维，平铺使用，不随时间变化（会动的颗粒在手机上看着像噪点）
function paperTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 128 + (Math.random() - 0.5) * 70;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.25;
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * S, y = Math.random() * S, a = Math.random() * Math.PI, l = 3 + Math.random() * 12;
    g.strokeStyle = Math.random() < 0.5 ? '#000' : '#fff';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tPaper: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uLift: { value: 0 },
    uVignette: { value: 0.3 },
    uGrain: { value: 0.0 },
    uSharp: { value: 0.3 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPaper;
    uniform vec2 uRes;
    uniform vec3 uTint;
    uniform float uSat, uContrast, uLift, uVignette, uGrain, uSharp;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // 轻微锐化：减去四邻的平均，抵消泛光、缩放带来的发虚
      vec2 px = 1.0 / uRes;
      vec3 nb = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb
              + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb;
      c = max(c + (c - nb * 0.25) * uSharp, 0.0);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      c *= uTint;
      c = c + uLift * (1.0 - c) * (1.0 - l);
      vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float r = length(p) / max(1.0, uRes.x / uRes.y) * 1.25;
      c *= 1.0 - uVignette * smoothstep(0.35, 1.05, r);
      float g = texture2D(tPaper, gl_FragCoord.xy / 256.0).r - 0.5;
      c += g * uGrain * (1.0 - 0.6 * l);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class PostFX {
  quality: Quality;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private ao: N8AOPass;
  private grade: ShaderPass;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private basePR = 1;
  private scale = 1;
  private minScale: number;
  private stage = 0; // 降档的档位：0 全开 → 1 遮蔽半分辨率 → 2 关遮蔽 → 3 关泛光 → 4 起降分辨率
  private maxStage: number;
  private isTouch: boolean;
  private plain: RenderPass;
  private frames: number[] = [];
  private acc = 0;
  private lastAdjust = 0;
  private w = 1;
  private h = 1;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, isTouch: boolean) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.isTouch = isTouch;
    // 分辨率最后才降，而且桌面最多降到八成（再低就糊了）
    this.minScale = isTouch ? 0.65 : 0.8;
    this.maxStage = 3 + Math.ceil(Math.log(this.minScale) / Math.log(0.85));
    const saved = localStorage.getItem('sansa.quality');
    this.quality = saved === 'low' ? 'low' : 'high';
    this.composer = new EffectComposer(renderer);
    // 环境光遮蔽代替普通的场景渲染：半径按米算，手机上用半分辨率
    const ao = new N8AOPass(scene, camera, innerWidth, innerHeight);
    ao.configuration.aoRadius = 1.6;
    ao.configuration.distanceFalloff = 1.0;
    ao.configuration.intensity = 2.6;
    ao.configuration.gammaCorrection = false;
    ao.configuration.halfRes = isTouch;
    ao.setQualityMode(isTouch ? 'Performance' : 'Medium');
    this.ao = ao;
    // 关掉遮蔽时改用普通的场景渲染
    this.plain = new RenderPass(scene, camera);
    this.plain.enabled = false;
    this.composer.addPass(this.plain);
    this.composer.addPass(ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 1.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    (this.grade.uniforms.tPaper as { value: THREE.Texture }).value = paperTexture();
    this.composer.addPass(this.grade);
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.w = w;
    this.h = h;
    this.basePR = pixelRatio;
    this.apply();
  }

  private apply() {
    const pr = this.basePR * this.scale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.w, this.h);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(this.w, this.h);
    (this.grade.uniforms.uRes.value as THREE.Vector2).set(this.w * pr, this.h * pr);
  }

  setQuality(q: Quality) {
    this.quality = q;
    localStorage.setItem('sansa.quality', q);
    this.setStage(0);
  }

  private setStage(n: number) {
    this.stage = Math.max(0, Math.min(this.maxStage, n));
    this.ao.configuration.halfRes = this.isTouch || this.stage >= 1;
    const aoOn = this.stage < 2;
    this.ao.enabled = aoOn;
    this.plain.enabled = !aoOn;
    this.bloom.enabled = this.stage < 3;
    this.scale = this.stage >= 4 ? Math.max(this.minScale, Math.pow(0.85, this.stage - 3)) : 1;
    this.apply();
  }

  // 调试用：当前帧时、档位、分辨率
  info() {
    const avg = this.frames.length ? this.frames.reduce((a, b) => a + b, 0) / this.frames.length : 0;
    return `${(avg * 1000).toFixed(1)} ms · 档 ${this.stage} · ×${(this.basePR * this.scale).toFixed(2)}`;
  }

  setLook(L: Look) {
    this.bloom.strength = L.bloom;
    this.bloom.threshold = L.threshold;
    const u = this.grade.uniforms;
    (u.uTint.value as THREE.Color).copy(L.tint);
    u.uSat.value = L.sat;
    u.uContrast.value = L.contrast;
    u.uLift.value = L.lift;
    u.uVignette.value = L.vignette;
  }

  // 按帧耗时调档：连续 2 秒平均超过 26 ms 就降一档（先省环境光遮蔽、再关泛光、最后才降分辨率）；
  // 之后 6 秒都很轻松（< 14 ms）再升回一档
  private govern(dt: number) {
    this.frames.push(dt);
    if (this.frames.length > 120) this.frames.shift();
    this.acc += dt;
    if (this.acc < 2 || this.frames.length < 60) return;
    this.acc = 0;
    const avg = this.frames.reduce((s, x) => s + x, 0) / this.frames.length;
    const now = performance.now();
    if (avg > 0.026 && this.stage < this.maxStage) {
      this.setStage(this.stage + 1);
      this.lastAdjust = now;
      this.frames.length = 0;
    } else if (avg < 0.014 && this.stage > 0 && now - this.lastAdjust > 6000) {
      this.setStage(this.stage - 1);
      this.lastAdjust = now;
      this.frames.length = 0;
    }
  }

  render(dt: number) {
    this.govern(dt);
    if (this.quality === 'low') {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render(dt);
  }
}
