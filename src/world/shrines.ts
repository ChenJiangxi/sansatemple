// 两处小陈设：放生池边的河灯台（摆着一摞莲花灯，竖牌「河燈」），观音殿前的签筒桌（竹签筒，竖牌「求籤」）
// 2026-11-20 细化：原来是方块桌面加四根方棍腿、一根棍子挑着一块平面牌子、一只光面圆筒。
// 现在桌子是明式小供桌（冰盘沿、牙条、马蹄足、底枨），牌子装进木框立在抱鼓座上，签筒是带竹节和朱漆箍的竹筒。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANTERN_STAND, FORTUNE, heightAt } from '../layout';
import { plaqueTexture, altarClothTexture } from '../textures';
import { chineseMats } from './hall';
import { lotusGeometry } from './pond';
import { mesh, lathe } from './util';

function sign(text: string) {
  const tex = plaqueTexture(text, true);
  const h = 0.62, w = h * (300 / (250 * [...text].length + 140));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  return { m, w, h };
}

// 立牌：牌面装进一圈木框，两根立柱落在一对抱鼓座上。legH 是牌面底边离地（或离桌面）的高度
function standSign(text: string, legH: number) {
  const M = chineseMats();
  const g = new THREE.Group();
  const { m, w, h } = sign(text);
  m.position.y = legH + h / 2;
  g.add(m);
  const f = 0.032, fd = 0.04;
  const frame: THREE.BufferGeometry[] = [];
  // 上下横框（上框两头略出头），两侧立柱从座子一直通到上框
  frame.push(new THREE.BoxGeometry(w + f * 2 + 0.05, f * 1.2, fd + 0.01).translate(0, legH + h + f * 0.6, 0));
  frame.push(new THREE.BoxGeometry(w, f, fd).translate(0, legH - f / 2, 0));
  for (const sx of [-1, 1]) frame.push(new THREE.BoxGeometry(f, legH + h, fd).translate(sx * (w / 2 + f / 2), (legH + h) / 2, 0));
  g.add(mesh(mergeGeometries(frame.map((x) => x.toNonIndexed()))!, M.redDark));
  // 抱鼓座：一块前后长的墩子，上面半个小圆鼓夹住立柱
  const feet: THREE.BufferGeometry[] = [];
  const fl = Math.min(0.26, 0.12 + legH * 0.2);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + f / 2);
    feet.push(new THREE.BoxGeometry(0.06, 0.035, fl).translate(x, 0.0175, 0));
    feet.push(new THREE.CylinderGeometry(0.05, 0.05, 0.055, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, 0.035, 0));
  }
  g.add(mesh(mergeGeometries(feet.map((x) => (x.index ? x.toNonIndexed() : x)))!, M.redDark));
  return g;
}

// 明式小供桌：冰盘沿桌面、四面牙条、马蹄足、离地一道底枨；正面垂桌围（和大殿供桌同一种做旧的土黄缎子，有褶）
let clothTex: THREE.Texture | null = null;
function table(w: number, d: number, h: number) {
  const M = chineseMats();
  const g = new THREE.Group();
  const lacquer: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  // 桌面：上面一块板，下面收进去一道斜边（冰盘沿）
  lacquer.push(new THREE.BoxGeometry(w, 0.03, d).translate(0, h - 0.015, 0));
  lacquer.push(new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 0.97, 0.022, 4, 1).rotateY(Math.PI / 4).scale(w, 1, d).translate(0, h - 0.041, 0));
  // 腿往里收一点；腿上端接牙条
  const lx = w / 2 - 0.06, lz = d / 2 - 0.06, s = 0.042;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    lacquer.push(new THREE.BoxGeometry(s, h - 0.09, s).translate(sx * lx, (h - 0.09) / 2 + 0.04, sz * lz));
    // 马蹄足：脚头往里勾，比腿略宽
    dark.push(new THREE.BoxGeometry(s + 0.012, 0.04, s + 0.012).translate(sx * (lx - 0.006), 0.02, sz * (lz - 0.006)));
  }
  // 牙条：四面一圈，下沿一道细圆线
  const ay = h - 0.085;
  for (const sz of [-1, 1]) {
    lacquer.push(new THREE.BoxGeometry(lx * 2 - s, 0.06, 0.018).translate(0, ay, sz * lz));
    dark.push(new THREE.CylinderGeometry(0.008, 0.008, lx * 2 - s, 6).rotateZ(Math.PI / 2).translate(0, ay - 0.032, sz * lz));
  }
  for (const sx of [-1, 1]) {
    lacquer.push(new THREE.BoxGeometry(0.018, 0.06, lz * 2 - s).translate(sx * lx, ay, 0));
    dark.push(new THREE.CylinderGeometry(0.008, 0.008, lz * 2 - s, 6).rotateX(Math.PI / 2).translate(sx * lx, ay - 0.032, 0));
  }
  // 底枨：两侧和后面各一根
  for (const sx of [-1, 1]) dark.push(new THREE.BoxGeometry(0.024, 0.024, lz * 2).translate(sx * lx, 0.13, 0));
  dark.push(new THREE.BoxGeometry(lx * 2, 0.024, 0.024).translate(0, 0.13, -lz));
  g.add(mesh(mergeGeometries(lacquer.map((x) => (x.index ? x.toNonIndexed() : x)))!, M.red));
  g.add(mesh(mergeGeometries(dark.map((x) => (x.index ? x.toNonIndexed() : x)))!, M.redDark));
  const ch = h * 0.55;
  const geo = new THREE.PlaneGeometry(w - 0.04, ch, 24, 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / (w + 0.02)) * Math.PI * 10) * 0.008 * (0.3 + 0.7 * (ch / 2 - p.getY(i)) / ch));
  geo.computeVertexNormals();
  const cloth = mesh(geo, new THREE.MeshStandardMaterial({ map: (clothTex ??= altarClothTexture()), roughness: 0.85, side: THREE.DoubleSide }));
  cloth.position.set(0, h - 0.055 - ch / 2, lz + 0.022);
  g.add(cloth);
  return g;
}

// 竹筒的皮：竖向细纤维，深浅不一，带一点点青
function bambooTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c29a58';
  g.fillRect(0, 0, 256, 128);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 160; i++) {
    const x = rnd() * 256;
    g.fillStyle = rnd() < 0.5 ? `rgba(90,60,20,${0.05 + rnd() * 0.12})` : `rgba(255,235,190,${0.05 + rnd() * 0.1})`;
    g.fillRect(x, 0, 0.6 + rnd() * 1.6, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildShrines(scene: THREE.Scene) {
  const interactives: THREE.Object3D[] = [];

  // —— 河灯台 ——
  {
    const g = table(1.0, 0.66, 0.72);
    const lotus = lotusGeometry();
    const lm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    const spots: [number, number, number][] = [[-0.25, 0, 0.75], [0.12, -0.1, 0.75], [0.28, 0.14, 0.75], [-0.05, 0.03, 0.83]];
    for (const [x, z, y] of spots) {
      const m = mesh(lotus, lm);
      m.position.set(x, y, z);
      m.rotation.y = x * 7;
      g.add(m);
    }
    const s = standSign('河燈', 0.64);
    s.position.set(-0.7, 0, 0.05);
    g.add(s);
    g.position.set(LANTERN_STAND.x, heightAt(LANTERN_STAND.x, LANTERN_STAND.z), LANTERN_STAND.z);
    g.rotation.y = 0.15;
    g.traverse((o) => (o.userData.interact = { type: 'lantern' }));
    scene.add(g);
    interactives.push(g);
  }

  // —— 签筒桌 ——
  {
    const g = table(0.72, 0.72, 0.78);
    // 竹签筒：竹筒壁有厚度，筒口一圈切面，中下部一道竹节；上下两道朱漆箍，立在一个矮木座上
    const top = 0.78;
    const bamboo = new THREE.MeshStandardMaterial({ map: bambooTexture(), roughness: 0.5 });
    const tube = mesh(lathe([[0.072, 0], [0.082, 0.004], [0.083, 0.11], [0.087, 0.118], [0.083, 0.126], [0.085, 0.3], [0.072, 0.3], [0.07, 0.03], [0, 0.03]], 28), bamboo);
    tube.position.y = top + 0.025;
    g.add(tube);
    const bands = mergeGeometries([
      new THREE.CylinderGeometry(0.089, 0.089, 0.03, 28, 1, true).translate(0, 0.265, 0),
      new THREE.CylinderGeometry(0.087, 0.087, 0.022, 28, 1, true).translate(0, 0.03, 0),
    ])!;
    const band = mesh(bands, chineseMats().red);
    band.position.y = top + 0.025;
    g.add(band);
    const seat = mesh(lathe([[0.11, 0], [0.115, 0.008], [0.105, 0.02], [0.095, 0.025], [0, 0.025]], 28), chineseMats().redDark);
    seat.position.y = top;
    g.add(seat);
    const sticks: THREE.BufferGeometry[] = [];
    const tips: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4, r = 0.02 + (i % 4) * 0.014, h = 0.36 + (i % 5) * 0.012;
      const st = new THREE.BoxGeometry(0.012, h, 0.004).rotateZ((Math.cos(a) * r) * 1.2).rotateX(-(Math.sin(a) * r) * 1.2);
      st.translate(Math.cos(a) * r, 0.84 + h / 2, Math.sin(a) * r);
      sticks.push(st.toNonIndexed());
      tips.push(new THREE.BoxGeometry(0.013, 0.04, 0.005).translate(Math.cos(a) * r * 1.6, 0.84 + h - 0.01, Math.sin(a) * r * 1.6).toNonIndexed());
    }
    g.add(mesh(mergeGeometries(sticks)!, new THREE.MeshStandardMaterial({ color: '#d8bf8a', roughness: 0.7 })));
    g.add(mesh(mergeGeometries(tips)!, chineseMats().red));
    const s = standSign('求籤', 0.13);
    s.position.set(0, 0.78, -0.27);
    g.add(s);
    g.position.set(FORTUNE.x, heightAt(FORTUNE.x, FORTUNE.z), FORTUNE.z);
    g.rotation.y = Math.PI / 2; // 桌子正面朝向院子（+x）
    g.traverse((o) => (o.userData.interact = { type: 'fortune' }));
    scene.add(g);
    interactives.push(g);
  }

  return { interactives };
}
