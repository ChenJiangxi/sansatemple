// 青铜器：带铜锈的贴图（颜色、法线、粗糙度/金属度都由同一张高度图算出），以及铜鼎香炉和梵钟的造型
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 云雷纹：方形回旋纹，一格一格排开
function leiwen(g: Ctx, x0: number, y0: number, w: number, h: number, cell: number) {
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.lineWidth = cell * 0.13;
  g.lineCap = 'square';
  for (let x = x0; x < x0 + w + cell; x += cell) {
    for (let y = y0; y < y0 + h; y += cell) {
      const flip = Math.round((x - x0) / cell) % 2 === 1;
      g.save();
      g.translate(x + cell / 2, y + cell / 2);
      if (flip) g.scale(-1, 1);
      g.beginPath();
      const s = cell * 0.42;
      g.moveTo(-s, s);
      g.lineTo(-s, -s);
      g.lineTo(s, -s);
      g.lineTo(s, s * 0.6);
      g.lineTo(-s * 0.55, s * 0.6);
      g.lineTo(-s * 0.55, -s * 0.5);
      g.lineTo(s * 0.5, -s * 0.5);
      g.lineTo(s * 0.5, s * 0.15);
      g.lineTo(-s * 0.1, s * 0.15);
      g.stroke();
      g.restore();
    }
  }
  g.restore();
}

// 蕉叶纹：一排三角形的叶片，叶脉一道
function jiaoye(g: Ctx, x0: number, w: number, yBase: number, hLeaf: number, n: number, up: boolean) {
  const lw = w / n;
  g.lineWidth = lw * 0.06;
  for (let i = 0; i < n; i++) {
    const cx = x0 + lw * (i + 0.5);
    const tip = up ? yBase - hLeaf : yBase + hLeaf;
    g.beginPath();
    g.moveTo(cx - lw * 0.42, yBase);
    g.quadraticCurveTo(cx - lw * 0.3, (yBase + tip) / 2, cx, tip);
    g.quadraticCurveTo(cx + lw * 0.3, (yBase + tip) / 2, cx + lw * 0.42, yBase);
    g.stroke();
    g.beginPath();
    g.moveTo(cx, yBase);
    g.lineTo(cx, tip);
    g.stroke();
  }
}

// 由高度图生成：颜色（铜色 + 凹处铜绿 + 凸处磨亮）、法线、粗糙度/金属度
function bronzeMaps(height: HTMLCanvasElement, seed: number, opts: { patina?: number; strength?: number } = {}) {
  const W = height.width, H = height.height;
  const hd = height.getContext('2d')!.getImageData(0, 0, W, H).data;
  const r = rng(seed);
  // 大块斑驳：几层低频噪声
  const blobs = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, rad: (0.04 + r() * 0.16) * W, v: r() }));
  const noise = new Float32Array(W * H);
  {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (const b of blobs) {
      const grd = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.rad);
      const v = Math.round(b.v * 255);
      grd.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
      grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grd;
      g.fillRect(b.x - b.rad, b.y - b.rad, b.rad * 2, b.rad * 2);
    }
    const nd = g.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) noise[i] = nd[i * 4] / 255 + (r() - 0.5) * 0.12;
  }
  const patina = opts.patina ?? 1;
  const strength = opts.strength ?? 2.2;
  const col = new ImageData(W, H), nor = new ImageData(W, H), mr = new ImageData(W, H);
  const hAt = (x: number, y: number) => hd[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, h = hAt(x, y), n = noise[i];
      // 凹处和斑驳处长铜绿，凸处被摸得发亮
      const green = Math.max(0, Math.min(1, (0.55 - h) * 1.6 + (n - 0.5) * 1.4)) * patina * 0.75;
      const shine = Math.max(0, h - 0.6) * 1.8;
      let cr = 78 + n * 26, cg = 60 + n * 18, cb = 38 + n * 10; // 暗铜
      cr += shine * 90;
      cg += shine * 66;
      cb += shine * 30;
      cr = cr * (1 - green) + 86 * green;
      cg = cg * (1 - green) + 118 * green;
      cb = cb * (1 - green) + 96 * green;
      col.data[i * 4] = cr;
      col.data[i * 4 + 1] = cg;
      col.data[i * 4 + 2] = cb;
      col.data[i * 4 + 3] = 255;
      const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * strength;
      const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      nor.data[i * 4] = (-dx / len) * 127 + 128;
      nor.data[i * 4 + 1] = (dy / len) * 127 + 128;
      nor.data[i * 4 + 2] = (1 / len) * 127 + 128;
      nor.data[i * 4 + 3] = 255;
      mr.data[i * 4] = 0;
      mr.data[i * 4 + 1] = (0.42 + green * 0.45 - shine * 0.15) * 255; // 粗糙度
      mr.data[i * 4 + 2] = (0.85 - green * 0.6) * 255; // 金属度
      mr.data[i * 4 + 3] = 255;
    }
  }
  const toTex = (img: ImageData, srgb: boolean) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d')!.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return new THREE.MeshStandardMaterial({ map: toTex(col, true), normalMap: toTex(nor, false), roughnessMap: toTex(mr, false), metalnessMap: toTex(mr, false), metalness: 1, roughness: 1, envMapIntensity: 1.1 });
}

// 小部件没有像样的 UV：按位置投影一套，让斑驳和铜绿落在表面上
function projectUV(geos: THREE.BufferGeometry[], k = 1.6) {
  return geos.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (p.getX(i) + p.getZ(i) * 0.7) * k;
      uv[i * 2 + 1] = p.getY(i) * k;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  });
}

// 没有纹样的青铜（足、耳、扉棱用）：只有斑驳和铜绿
let plainBronze: THREE.MeshStandardMaterial | null = null;
export function bronzePlain() {
  if (plainBronze) return plainBronze;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, 256, 256);
  const r = rng(7);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '40,40,40' : '200,200,200'},0.12)`;
    g.beginPath();
    g.arc(r() * 256, r() * 256, 2 + r() * 14, 0, Math.PI * 2);
    g.fill();
  }
  plainBronze = bronzeMaps(c, 11, { strength: 0.8 });
  return plainBronze;
}

// 鼎身的纹样高度图：颈部云雷纹带、腹部蕉叶纹与铭文框、底部素面
function dingHeight(front: string, back: string) {
  const W = 2048, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#787878';
  g.fillRect(0, 0, W, H);
  const yOf = (v: number) => (1 - v) * H; // v=0 鼎底，v=1 口沿
  // 凸起的弦纹
  g.fillStyle = '#c8c8c8';
  for (const v of [0.69, 0.84, 0.97]) g.fillRect(0, yOf(v) - 5, W, 10);
  // 颈部云雷纹
  g.strokeStyle = '#d2d2d2';
  leiwen(g, 0, yOf(0.96), W, yOf(0.85) - yOf(0.96), (yOf(0.85) - yOf(0.96)) / 1.0);
  // 腹部上方一圈倒垂的蕉叶纹
  g.strokeStyle = '#b8b8b8';
  jiaoye(g, 0, W, yOf(0.68), 70, 24, false);
  // 铭文框：正面、背面（背面跨过贴图接缝，左右各画一半）
  const panel = (cx: number, text: string) => {
    const pw = 300, ph = 120, cy = (yOf(0.6) + yOf(0.45)) / 2 + 10;
    g.fillStyle = '#5c5c5c';
    g.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
    g.strokeStyle = '#cfcfcf';
    g.lineWidth = 8;
    g.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph);
    g.fillStyle = '#d8d8d8';
    g.font = 'bold 66px "Songti SC","STSong","Noto Serif CJK SC",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(cx, cy);
    g.scale(1, 1.25);
    g.fillText(text, 0, 0);
    g.restore();
  };
  panel(W / 2, front);
  panel(0, back);
  panel(W, back);
  // 底部一圈素面加铸痕
  const r = rng(3);
  g.fillStyle = 'rgba(90,90,90,0.5)';
  for (let i = 0; i < 300; i++) g.fillRect(r() * W, yOf(0.3) + r() * (H - yOf(0.3)), 2 + r() * 6, 1 + r() * 3);
  return c;
}

export interface DingOpts {
  front: string;
  back: string;
  base?: boolean; // 下面带八角石座
  stoneMat?: THREE.Material;
  ashColor?: string;
  stubs?: number; // 灰面上残香的数量
}

// 铜鼎香炉（三足、两立耳、六道扉棱）。整体尺寸按院中大鼎：口径约 1.76 m，口沿高 1.25 m；
// 返回的 ashY 是香灰面的高度（局部坐标），外面按比例缩放即可放到供桌上
export function buildDing(o: DingOpts) {
  const group = new THREE.Group();
  const plain = bronzePlain();
  const bodyMat = bronzeMaps(dingHeight(o.front, o.back), 5);
  const Y0 = 0.42, Y1 = 1.25, ASH = 1.08;
  // 鼎身：外壁、口沿、内壁一次车出来
  const prof: [number, number][] = [
    [0.0, 0.4], [0.28, 0.41], [0.52, 0.47], [0.68, 0.58], [0.77, 0.72], [0.8, 0.86], [0.78, 0.98], [0.75, 1.03],
    [0.76, 1.08], [0.78, 1.15], [0.82, 1.19], [0.88, 1.22], [0.89, 1.245], [0.86, 1.26], [0.79, 1.255], [0.76, 1.22], [0.74, 1.15], [0.73, ASH - 0.02],
  ];
  const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96);
  {
    const uv = body.attributes.uv as THREE.BufferAttribute, p = body.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, Math.min(1, Math.max(0, (p.getY(i) - Y0) / (Y1 - Y0))));
  }
  const bodyMesh = new THREE.Mesh(body, bodyMat);
  bodyMesh.rotation.y = Math.PI; // 让贴图中线（正面铭文）朝 +z
  group.add(bodyMesh);
  const radiusAt = (y: number) => {
    for (let i = 0; i < 8; i++) {
      const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
      if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return 0.8;
  };

  const parts: THREE.BufferGeometry[] = [];
  // 扉棱：腹部六道带缺口的竖棱
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const sh = new THREE.Shape();
    const ys = [0.56, 0.64, 0.7, 0.76, 0.84, 0.9, 0.98];
    sh.moveTo(radiusAt(0.56) - 0.02, 0.56);
    ys.forEach((y, i) => sh.lineTo(radiusAt(y) + (i % 2 ? 0.025 : 0.045), y));
    sh.lineTo(radiusAt(0.98) - 0.02, 0.98);
    sh.closePath();
    const fin = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false });
    fin.translate(0, 0, -0.011);
    fin.rotateY(-a);
    parts.push(fin.toNonIndexed());
  }
  // 立耳：口沿上两只方形的「冂」，略向外撇
  for (const sx of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.24, 0);
    sh.lineTo(-0.24, 0.36);
    sh.lineTo(0.24, 0.36);
    sh.lineTo(0.24, 0);
    sh.lineTo(0.15, 0);
    sh.lineTo(0.15, 0.27);
    sh.lineTo(-0.15, 0.27);
    sh.lineTo(-0.15, 0);
    sh.closePath();
    const ear = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
    ear.translate(0, 0, -0.035);
    ear.rotateY(Math.PI / 2);
    ear.rotateZ(-sx * 0.1);
    ear.translate(sx * 0.82, 1.235, 0);
    parts.push(ear.toNonIndexed());
  }
  // 三足：上端兽面，中间收腰，下端马蹄
  const legProf: [number, number][] = [[0, 0], [0.14, 0], [0.145, 0.03], [0.11, 0.08], [0.075, 0.18], [0.072, 0.28], [0.09, 0.38], [0.125, 0.47], [0.14, 0.53], [0.12, 0.58], [0, 0.6]];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
    const leg = new THREE.LatheGeometry(legProf.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    // 下端向外撇
    const lp = leg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) lp.setX(i, lp.getX(i) + 0.08 * (1 - lp.getY(i) / 0.6) ** 2);
    leg.computeVertexNormals();
    // 兽面：外侧一块鼓起，两只眼、一道鼻梁、两只角
    const mask = new THREE.SphereGeometry(0.13, 16, 12);
    mask.scale(0.45, 0.85, 1);
    mask.translate(0.115, 0.47, 0);
    const eyes = [-1, 1].map((s) => new THREE.SphereGeometry(0.028, 10, 8).translate(0.17, 0.5, s * 0.055));
    const nose = new THREE.BoxGeometry(0.04, 0.12, 0.03).translate(0.17, 0.43, 0);
    const horns = [-1, 1].map((s) => new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI).rotateY(Math.PI / 2).translate(0.15, 0.56, s * 0.06));
    const merged = mergeGeometries([leg, mask, ...eyes, nose, ...horns].map((gg) => gg.toNonIndexed()))!;
    merged.rotateY(-a);
    merged.translate(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    parts.push(merged);
  }
  // 口沿下的一道绳纹箍
  parts.push(new THREE.TorusGeometry(0.775, 0.018, 8, 96).rotateX(Math.PI / 2).translate(0, 1.07, 0).toNonIndexed());
  const detail = new THREE.Mesh(mergeGeometries(projectUV(parts))!, plain);
  group.add(detail);

  // 香灰：略鼓的灰面，插着烧剩的残香
  const ash = new THREE.CircleGeometry(0.735, 48);
  {
    const ap = ash.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ap.count; i++) {
      const d = Math.hypot(ap.getX(i), ap.getY(i));
      ap.setZ(i, 0.035 * (1 - (d / 0.735) ** 2) + Math.sin(ap.getX(i) * 31) * Math.cos(ap.getY(i) * 27) * 0.004);
    }
    ash.rotateX(-Math.PI / 2);
    ash.translate(0, ASH, 0);
    ash.computeVertexNormals();
  }
  group.add(new THREE.Mesh(ash, new THREE.MeshStandardMaterial({ map: ashTexture(), color: o.ashColor ?? '#ffffff', roughness: 1 })));
  {
    const r = rng(9);
    const stubs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (o.stubs ?? 70); i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.66;
      const h = 0.025 + r() * 0.12;
      const st = new THREE.CylinderGeometry(0.0065, 0.0065, h, 5).toNonIndexed();
      // 下半截红褐色香脚，上端一点灰白的香灰
      const colors = new Float32Array(st.attributes.position.count * 3);
      const sp = st.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < sp.count; v++) {
        const top = sp.getY(v) > h / 2 - 0.01;
        const c = top ? [0.55, 0.53, 0.5] : [0.42, 0.14, 0.08];
        colors.set(c, v * 3);
      }
      st.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      st.rotateX((r() - 0.5) * 0.3);
      st.rotateZ((r() - 0.5) * 0.3);
      st.translate(Math.cos(a) * d, ASH + 0.02 + h / 2 - 0.01, Math.sin(a) * d);
      stubs.push(st);
    }
    group.add(new THREE.Mesh(mergeGeometries(stubs)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  }
  group.children.forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  // 八角须弥石座
  if (o.base && o.stoneMat) {
    const seg = (r: number, h: number, y: number) => {
      const g = new THREE.CylinderGeometry(r, r, h, 8);
      g.rotateY(Math.PI / 8);
      g.translate(0, y, 0);
      return g;
    };
    const base = mergeGeometries([seg(1.02, 0.07, -0.145), seg(0.94, 0.04, -0.095), seg(0.84, 0.07, -0.04), seg(0.92, 0.04, 0.01)].map((gg) => gg.toNonIndexed()))!;
    const bm = new THREE.Mesh(base, o.stoneMat);
    bm.position.y = -0.03;
    bm.castShadow = bm.receiveShadow = true;
    group.add(bm);
  }
  return { group, ashY: ASH + 0.02 };
}

let ashTex: THREE.Texture | null = null;
function ashTexture() {
  if (ashTex) return ashTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9b958b';
  g.fillRect(0, 0, 256, 256);
  const r = rng(21);
  for (let i = 0; i < 2400; i++) {
    const v = 120 + r() * 110;
    g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.5)`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 2);
  }
  // 烧焦的小黑点和掉落的香灰卷
  for (let i = 0; i < 90; i++) {
    g.fillStyle = r() < 0.6 ? 'rgba(40,32,26,0.55)' : 'rgba(225,220,210,0.7)';
    g.beginPath();
    g.arc(r() * 256, r() * 256, 1 + r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  ashTex = new THREE.CanvasTexture(c);
  ashTex.colorSpace = THREE.SRGBColorSpace;
  return ashTex;
}

// 梵钟的纹样：上下几道弦纹，钟身分四个区，区内竖写佛号，下方一圈莲瓣
function bellHeight() {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, W, H);
  const yOf = (v: number) => (1 - v) * H;
  g.fillStyle = '#cfcfcf';
  for (const v of [0.08, 0.12, 0.33, 0.37, 0.8, 0.84]) g.fillRect(0, yOf(v) - 6, W, 12);
  // 四根竖带把钟身分成四区
  for (let k = 0; k < 4; k++) g.fillRect((k / 4) * W - 7, yOf(0.8), 14, yOf(0.37) - yOf(0.8));
  // 区内铭文
  g.fillStyle = '#d4d4d4';
  g.font = 'bold 74px "Songti SC","STSong","Noto Serif CJK SC",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const texts = ['南無阿彌陀佛', '國泰民安', '風調雨順', '法輪常轉'];
  texts.forEach((t, k) => {
    const cx = ((k + 0.5) / 4) * W;
    const chars = [...t];
    const span = yOf(0.4) - yOf(0.78);
    chars.forEach((ch, i) => {
      g.save();
      g.translate(cx, yOf(0.78) + ((i + 0.5) / chars.length) * span);
      g.scale(1.15, 0.75);
      g.fillText(ch, 0, 0);
      g.restore();
    });
  });
  // 钟口上方一圈莲瓣
  g.strokeStyle = '#c4c4c4';
  g.lineWidth = 9;
  const n = 28, lw = W / n;
  for (let i = 0; i < n; i++) {
    const cx = lw * (i + 0.5);
    g.beginPath();
    g.moveTo(cx - lw * 0.45, yOf(0.33));
    g.quadraticCurveTo(cx - lw * 0.45, yOf(0.17), cx, yOf(0.14));
    g.quadraticCurveTo(cx + lw * 0.45, yOf(0.17), cx + lw * 0.45, yOf(0.33));
    g.stroke();
  }
  // 钟肩一圈云雷纹
  g.strokeStyle = '#c8c8c8';
  leiwen(g, 0, yOf(0.95), W, yOf(0.86) - yOf(0.95), yOf(0.86) - yOf(0.95));
  return c;
}

// 梵钟：波浪形的钟口、钟肩、蒲牢钮、两侧莲花撞座；钟顶在原点，向下 2.28 m
export function buildTempleBell() {
  const group = new THREE.Group();
  const prof: [number, number][] = [[0.9, 0.02], [0.97, 0.0], [1.0, 0.08], [0.96, 0.22], [0.86, 0.45], [0.8, 0.9], [0.78, 1.3], [0.74, 1.8], [0.66, 2.06], [0.5, 2.2], [0.3, 2.26], [0, 2.28]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y - 2.28)), 128, 0, Math.PI * 2);
  {
    const p = geo.attributes.position as THREE.BufferAttribute, uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 2.28;
      uv.setY(i, y / 2.28);
      // 钟口做成八瓣波浪
      if (y < 0.1) {
        const phi = Math.atan2(p.getX(i), p.getZ(i));
        p.setY(i, p.getY(i) + (0.1 - y) * 0.5 * Math.cos(phi * 8));
      }
    }
    geo.computeVertexNormals();
  }
  const mat = bronzeMaps(bellHeight(), 13, { patina: 1.2 });
  group.add(new THREE.Mesh(geo, mat));
  const plain = bronzePlain();
  const parts: THREE.BufferGeometry[] = [];
  // 两个莲花撞座（被撞木撞的位置，在钟身两侧）
  for (const s of [-1, 1]) {
    const seat = new THREE.CylinderGeometry(0.17, 0.19, 0.05, 24).rotateZ(Math.PI / 2).translate(s * 0.86, -1.88, 0);
    parts.push(seat.toNonIndexed());
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(new THREE.SphereGeometry(0.045, 8, 6).scale(0.5, 1, 1).translate(s * 0.885, -1.88 + Math.sin(a) * 0.11, Math.cos(a) * 0.11).toNonIndexed());
    }
  }
  // 蒲牢钮：双龙身拱成的环，两头龙首
  const arch = new THREE.TorusGeometry(0.26, 0.075, 12, 32, Math.PI);
  parts.push(arch.translate(0, 0.02, 0).toNonIndexed());
  for (const s of [-1, 1]) {
    parts.push(new THREE.SphereGeometry(0.11, 14, 10).scale(1.3, 0.8, 0.9).translate(s * 0.28, 0.03, 0).toNonIndexed());
    parts.push(new THREE.ConeGeometry(0.035, 0.12, 8).rotateZ(-s * 0.6).translate(s * 0.34, 0.13, 0.04).toNonIndexed());
  }
  const detail = new THREE.Mesh(mergeGeometries(projectUV(parts))!, plain);
  group.add(detail);
  group.children.forEach((m) => (m.castShadow = true));
  return group;
}
