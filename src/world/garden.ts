// 西院的祈福灯廊、灯廊北头的柿饼架，前院零零散散的草丛和野花（原来的石板踏脚小路在院子铺青砖后去掉了）。
// 灯廊：两排高木杆，杆间拉绳，挂满各色灯笼；访客挂上的那盏下面吊一张写着心愿的纸签（自己的是金色的）。
// 没人挂的位置由寺里挂上素灯笼，廊子什么时候看都是满的。夜里灯笼亮起来。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WISH_ALLEY, WISH_DESK, PERSIMMON, STONE_PATHS, COURT, CAFE, blocked, inPond } from '../layout';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mesh, lathe, grainUV } from './util';
import { chineseMats, fruitGeometry } from './hall';
import { pbr } from './pbr';
import { paint } from './lotus';
import { standSign, bambooTexture } from './shrines';

export const LANTERN_COLORS = ['#b83a2a', '#d4a043', '#5a8c7c', '#eadfc8', '#cf8e88', '#4d6890'];

export interface WishLanternView {
  hook: number;
  color: number; // LANTERN_COLORS 的下标
  tag: 0 | 1 | 2; // 0 没有纸签（寺里挂的），1 访客的心愿，2 自己的
}
export interface Hook {
  x: number;
  y: number; // 挂点（绳上）的高度
  z: number;
  stand: { x: number; z: number }; // 挂灯时人站的地方
}
export interface GardenBuild {
  interactives: THREE.Object3D[];
  hooks: Hook[];
  setLanterns(list: WishLanternView[]): void;
  rise(hook: number, from: THREE.Vector3): void; // 新挂的灯从手里慢慢升到绳上
  setLanternLevel(level: number): void;
  update(dt: number, t: number): void;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 灯笼的发光颜色跟着实例颜色走
function glowMaterial(base: THREE.MeshStandardMaterialParameters) {
  const mat = new THREE.MeshStandardMaterial({ ...base, emissive: '#ffcf8f', emissiveIntensity: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'
    );
  };
  return mat;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 灯笼纸面：竖向的竹骨，上下两道深一点的边
// 灯笼纸面：皮纸的纤维和深浅、十六道竹骨的阴影、上下收口处颜色加深（染色交给每盏灯的实例颜色）
function lanternSkin() {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 256);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // 纸的纤维：细短的浅深线
    for (let k = 0; k < 2600; k++) {
      g.strokeStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.025 + rnd() * 0.04})` : `rgba(255,255,255,${0.05 + rnd() * 0.08})`;
      g.lineWidth = 0.6 + rnd() * 0.8;
      const x = rnd() * 512, y = rnd() * 256, a = rnd() * Math.PI, l = 3 + rnd() * 9;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // 大块的深浅（手工染纸不匀）
    for (let k = 0; k < 40; k++) {
      const x = rnd() * 512, y = rnd() * 256, r = 20 + rnd() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${0.03 + rnd() * 0.04})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 竹骨：每道一条细深线，两边各一道淡影
    for (let k = 0; k < 16; k++) {
      const x = k * 32;
      g.fillStyle = 'rgba(40,20,10,0.32)';
      g.fillRect(x - 1, 0, 2, 256);
      g.fillStyle = 'rgba(40,20,10,0.08)';
      g.fillRect(x - 5, 0, 10, 256);
    }
    const band = g.createLinearGradient(0, 0, 0, 256);
    band.addColorStop(0, 'rgba(30,10,5,0.4)');
    band.addColorStop(0.14, 'rgba(0,0,0,0)');
    band.addColorStop(0.86, 'rgba(0,0,0,0)');
    band.addColorStop(1, 'rgba(30,10,5,0.4)');
    g.fillStyle = band;
    g.fillRect(0, 0, 512, 256);
  });
}
// 瓜棱灯身：半径 r、半高 h，ribs 道竹骨，seg 圈分段、rows 行
export function ribbedLantern(r: number, h: number, ribs: number, seg: number, rows: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const y = -h + 2 * h * v;
    // 轮廓：中间最鼓，上下收到木托的半径
    const prof = 0.36 + 0.64 * Math.sin(Math.PI * (0.06 + 0.88 * v));
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const rib = 1 - 0.07 * Math.pow(Math.abs(Math.cos((th * ribs) / 2)), 6);
      const rr = r * prof * rib;
      pos.push(Math.cos(th) * rr, y, Math.sin(th) * rr);
      uv.push(i / seg, v);
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
// 纸签：竖条，写几道墨痕（远看像字）
function tagSkin() {
  return canvasTex(64, 160, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 160);
    g.fillStyle = 'rgba(40,30,20,0.75)';
    for (let k = 0; k < 6; k++) g.fillRect(26 + (k % 2) * 2, 18 + k * 21, 12, 9);
    g.fillStyle = 'rgba(170,40,30,0.8)';
    g.fillRect(24, 140, 16, 12);
  });
}
// 草：一簇细叶，透明底
function grassSkin() {
  return canvasTex(128, 128, (g) => {
    const R = rand(7);
    for (let k = 0; k < 26; k++) {
      const x0 = 30 + R() * 68, lean = (R() - 0.5) * 60, h = 60 + R() * 64;
      g.strokeStyle = `hsl(${60 + R() * 30}, ${12 + R() * 14}%, ${58 + R() * 26}%)`;
      g.lineWidth = 2.5 + R() * 2.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0, 128);
      g.quadraticCurveTo(x0 + lean * 0.3, 128 - h * 0.6, x0 + lean, 128 - h);
      g.stroke();
    }
  });
}
// 波斯菊、小雏菊：几朵花和茎
function flowerSkin(kind: 'cosmos' | 'daisy') {
  return canvasTex(128, 128, (g) => {
    const R = rand(kind === 'cosmos' ? 11 : 23);
    for (let k = 0; k < 5; k++) {
      const x = 22 + R() * 84, y = 30 + R() * 50, r = kind === 'cosmos' ? 11 + R() * 5 : 7 + R() * 3;
      g.strokeStyle = '#4f6b34';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (R() - 0.5) * 16, 100, x + (R() - 0.5) * 10, 128);
      g.stroke();
      const petals = kind === 'cosmos' ? 8 : 12;
      const col = kind === 'cosmos' ? ['#e58fb0', '#f2b8cf', '#d36a96', '#f5f0f2'][Math.floor(R() * 4)] : '#f7f4ec';
      g.fillStyle = col;
      for (let p = 0; p < petals; p++) {
        const a = (p / petals) * Math.PI * 2;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.beginPath();
        g.ellipse(r * 0.55, 0, r * 0.5, r * (kind === 'cosmos' ? 0.32 : 0.18), 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.fillStyle = kind === 'cosmos' ? '#e9b93c' : '#f0c43a';
      g.beginPath();
      g.arc(x, y, r * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// 牙头：贴在腿边、牙条下面的一块小花牙，上沿平、外沿一道内凹的弧收到腿上。dir 朝哪边伸，s 是大小
function spandrel(dir: number, s: number) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(dir * 0.1 * s, 0);
  sh.bezierCurveTo(dir * 0.07 * s, -0.004 * s, dir * 0.035 * s, -0.02 * s, dir * 0.02 * s, -0.05 * s);
  sh.quadraticCurveTo(dir * 0.008 * s, -0.075 * s, 0, -0.085 * s);
  sh.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false, curveSegments: 6 });
}

export function buildGarden(scene: THREE.Scene, o: { lite: boolean }): GardenBuild {
  const M = chineseMats();
  const group = new THREE.Group();
  scene.add(group);
  const interactives: THREE.Object3D[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...p });
  const darkWood = std({ color: '#3b2a1f', roughness: 0.75 });
  const cordMat = std({ color: '#2a201a', roughness: 0.9 });

  // —— 灯廊：木杆、杆头的小帽、绳子 ——
  // 每根杆：古镜式石柱础，八棱木杆，杆头一个斗、一顶四角攒尖小帽和铜宝珠；拉绳的三处各缠一圈麻绳
  const A = WISH_ALLEY;
  const flat = (g: THREE.BufferGeometry) => {
    const n = g.toNonIndexed();
    n.computeVertexNormals();
    return n;
  };
  const baseGeo = lathe([[0, 0], [0.165, 0], [0.165, 0.05], [0.15, 0.075], [0.12, 0.1], [0.095, 0.112], [0, 0.112]], 16);
  const shaftGeo = grainUV(flat(new THREE.CylinderGeometry(0.066, 0.074, A.h - 0.1, 8).rotateY(Math.PI / 8).translate(0, 0.1 + (A.h - 0.1) / 2, 0)), 'y');
  const douGeo = flat(new THREE.CylinderGeometry(0.14, 0.105, 0.07, 4).rotateY(Math.PI / 4).translate(0, A.h + 0.035, 0));
  const hatGeo = flat(lathe([[0, 0], [0.2, 0], [0.24, 0.022], [0.17, 0.05], [0.11, 0.085], [0.065, 0.125], [0.035, 0.16], [0, 0.185]], 4).rotateY(Math.PI / 4).translate(0, A.h + 0.07, 0));
  const pearlGeo = lathe([[0, 0], [0.03, 0], [0.03, 0.012], [0.018, 0.02], [0.03, 0.04], [0.033, 0.055], [0.022, 0.075], [0, 0.09]], 12).translate(0, A.h + 0.245, 0);
  const baseG: THREE.BufferGeometry[] = [], shaftG: THREE.BufferGeometry[] = [], capG: THREE.BufferGeometry[] = [], pearlG: THREE.BufferGeometry[] = [], wraps: THREE.BufferGeometry[] = [];
  for (const x of [A.xE, A.xW])
    for (const z of A.zs) {
      baseG.push(baseGeo.clone().translate(x, 0, z));
      shaftG.push(shaftGeo.clone().translate(x, 0, z));
      capG.push(douGeo.clone().translate(x, 0, z), hatGeo.clone().translate(x, 0, z));
      pearlG.push(pearlGeo.clone().translate(x, 0, z));
      for (const dy of [0.55, 0.85, 1.2]) wraps.push(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 10).translate(x, A.h - dy, z));
    }
  const posts = mesh(mergeGeometries(shaftG)!, pbr('wood', { metersPerTile: 1.2, color: '#6e5442' }));
  posts.userData.interact = { type: 'wishDesk' };
  group.add(
    posts,
    mesh(mergeGeometries(baseG)!, pbr('granite', { metersPerTile: 0.6, color: new THREE.Color().setRGB(2.3, 2.2, 2.05) })),
    mesh(mergeGeometries(capG)!, darkWood),
    mesh(mergeGeometries(pearlG)!, M.gold)
  );
  interactives.push(posts);

  const hooks: Hook[] = [];
  const wires: THREE.BufferGeometry[] = [];
  const wire = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag: number, n: number, ts: number[], stand: (t: number) => { x: number; z: number }) => {
    const pts: THREE.Vector3[] = [];
    const at = (t: number) => new THREE.Vector3(ax + (bx - ax) * t, ay + (by - ay) * t - sag * 4 * t * (1 - t), az + (bz - az) * t);
    for (let k = 0; k <= n; k++) pts.push(at(k / n));
    wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.009, 4, false));
    for (const t of ts) {
      const p = at(t);
      hooks.push({ x: p.x, y: p.y, z: p.z, stand: stand(t) });
    }
  };
  // 横跨廊子的绳：每排一根，挂八盏
  const across = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => k / 9);
  for (const z of A.zs) wire(A.xW, A.h - 0.55, z, A.xE, A.h - 0.55, z, 0.3, 12, across, (t) => ({ x: A.xW + (A.xE - A.xW) * t, z: z + 0.7 }));
  // 每两排之间再拉两根交叉的斜绳，各挂六盏：抬头是一片灯的顶棚
  const diag = [1, 2, 3, 4, 5, 6].map((k) => k / 7);
  for (let i = 0; i < A.zs.length - 1; i++) {
    const z0 = A.zs[i], z1 = A.zs[i + 1];
    for (const [xa, xb] of [[A.xW, A.xE], [A.xE, A.xW]])
      wire(xa, A.h - 0.85, z0, xb, A.h - 0.85, z1, 0.34, 14, diag, (t) => ({ x: xa + (xb - xa) * t + 0.45, z: z0 + (z1 - z0) * t }));
  }
  // 顺着廊子两边的绳：每段挂四盏
  for (const [side, x] of [[1, A.xE], [-1, A.xW]] as [number, number][])
    for (let i = 0; i < A.zs.length - 1; i++)
      wire(x, A.h - 1.2, A.zs[i], x, A.h - 1.2, A.zs[i + 1], 0.34, 10, [0.2, 0.4, 0.6, 0.8], (t) => ({ x: x - side * 0.7, z: A.zs[i] + (A.zs[i + 1] - A.zs[i]) * t }));
  group.add(mesh(mergeGeometries([...wires, ...wraps]), cordMat, false));

  // —— 灯笼：灯身、上下木帽、吊绳、纸签，都用实例化（一盏灯一个实例） ——
  const H = hooks.length;
  // 灯身：十六道竹骨处往里收、骨与骨之间鼓出来（瓜棱形），上下收口
  const bodyGeo = ribbedLantern(0.225, 0.24, 16, 48, 18);
  const skin = lanternSkin();
  // 夜里亮起来时纸纹和竹骨也透出来，不是一片平涂的亮色
  const bodyMat = glowMaterial({ map: skin, emissiveMap: skin, roughness: 0.92, side: THREE.DoubleSide });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, H);
  // 上下木托，各镶一道细金边
  const capGold = new THREE.MeshStandardMaterial({ color: '#c9a04f', metalness: 0.7, roughness: 0.4 });
  const caps = new THREE.InstancedMesh(
    mergeGeometries(
      [
        mergeGeometries([new THREE.CylinderGeometry(0.075, 0.095, 0.05, 16).translate(0, 0.245, 0), new THREE.CylinderGeometry(0.095, 0.075, 0.05, 16).translate(0, -0.245, 0)]),
        mergeGeometries([new THREE.TorusGeometry(0.097, 0.007, 6, 24).rotateX(Math.PI / 2).translate(0, 0.222, 0), new THREE.TorusGeometry(0.097, 0.007, 6, 24).rotateX(Math.PI / 2).translate(0, -0.222, 0)]),
      ],
      true
    ),
    [darkWood, capGold],
    H
  );
  const cords = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4).translate(0, -0.5, 0), cordMat, H);
  const tagTex = tagSkin();
  const tagMat = new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0 });
  const tags = new THREE.InstancedMesh(mergeGeometries([new THREE.PlaneGeometry(0.095, 0.25).translate(0, -0.125, 0), new THREE.PlaneGeometry(0.095, 0.25).translate(0, -0.125, 0).rotateY(Math.PI / 2)]), tagMat, H);
  bodies.castShadow = caps.castShadow = true;
  for (const m of [bodies, caps, cords, tags]) {
    m.frustumCulled = false;
    group.add(m);
  }
  bodies.userData.interact = { type: 'wishLantern', ids: hooks.map((_, i) => i) };
  interactives.push(bodies);
  const R0 = rand(99);
  const phase = hooks.map(() => R0() * 6.28);
  const decoColor = hooks.map(() => Math.floor(R0() * LANTERN_COLORS.length));
  let view: (WishLanternView | null)[] = hooks.map(() => null);
  const colors = LANTERN_COLORS.map((c) => new THREE.Color(c));
  const white = new THREE.Color('#f6f1e4'), gold = new THREE.Color('#f0c25a');
  const applyColors = () => {
    for (let i = 0; i < H; i++) {
      const v = view[i];
      bodies.setColorAt(i, colors[v ? v.color : decoColor[i]]);
      tags.setColorAt(i, v?.tag === 2 ? gold : white);
    }
    bodies.instanceColor!.needsUpdate = true;
    tags.instanceColor!.needsUpdate = true;
  };
  applyColors();
  // 正在升起的新灯：从手里（世界坐标）到挂点，用 1.8 秒
  const rising = new Map<number, { from: THREE.Vector3; t: number }>();
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  const off = new THREE.Vector3();
  const CORD = 0.18;
  const place = (t: number, dt: number) => {
    for (let i = 0; i < H; i++) {
      const h = hooks[i];
      let px = h.x, py = h.y, pz = h.z, cordLen = CORD;
      const r = rising.get(i);
      if (r) {
        r.t += dt / 1.8;
        const k = Math.min(1, r.t), s = k * k * (3 - 2 * k);
        px = r.from.x + (h.x - r.from.x) * s;
        pz = r.from.z + (h.z - r.from.z) * s;
        py = r.from.y + CORD + 0.24 + (h.y - (r.from.y + CORD + 0.24)) * s;
        cordLen = CORD * s + 0.001;
        if (k >= 1) rising.delete(i);
      }
      e.set(Math.cos(t * 0.7 + phase[i]) * 0.035, 0, Math.sin(t * 0.9 + phase[i]) * 0.05);
      q.setFromEuler(e);
      pos.set(px, py, pz);
      // 吊绳
      sc.set(1, cordLen, 1);
      mtx.compose(pos, q, sc);
      cords.setMatrixAt(i, mtx);
      // 灯身和木帽：挂点往下吊绳长 + 半个灯身
      off.set(0, -cordLen - 0.24, 0).applyQuaternion(q).add(pos);
      mtx.compose(off, q, one);
      bodies.setMatrixAt(i, mtx);
      caps.setMatrixAt(i, mtx);
      // 纸签：灯底下再吊一小截；寺里挂的没有纸签
      off.set(0, -cordLen - 0.53, 0).applyQuaternion(q).add(pos);
      sc.setScalar(view[i]?.tag ? 1 : 0.0001);
      mtx.compose(off, q, sc);
      tags.setMatrixAt(i, mtx);
    }
    for (const m of [bodies, caps, cords, tags]) m.instanceMatrix.needsUpdate = true;
  };
  place(0, 0);
  bodies.computeBoundingSphere();

  // —— 祈福台：明式平头案（圆腿、夹头榫的牙条和牙头、两侧双枨）。案上两摞叠好的纸灯笼、一盘纸签、砚台和墨、笔筒；
  //    左头立「祈福燈廊」立牌，和河灯台、签筒桌的立牌同一式样 ——
  const desk = new THREE.Group();
  desk.position.set(WISH_DESK.x, 0, WISH_DESK.z);
  desk.rotation.y = WISH_DESK.yaw;
  const Y = 0.82; // 案面高
  {
    const deskWood = pbr('wood', { metersPerTile: 0.8, color: '#a07a58' });
    deskWood.roughness = 0.6;
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, axis: 'x' | 'y' | 'z') => parts.push(grainUV(g.index ? g.toNonIndexed() : g, axis));
    add(new RoundedBoxGeometry(1.6, 0.045, 0.62, 2, 0.012).translate(0, Y - 0.0225, 0), 'x');
    const lx = 0.66, lz = 0.22;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.022, 0.025, Y - 0.04, 12).translate(sx * lx, (Y - 0.04) / 2, sz * lz), 'y');
      for (const y of [0.16, 0.27]) add(new THREE.CylinderGeometry(0.012, 0.012, lz * 2, 8).rotateX(Math.PI / 2).translate(sx * lx, y, 0), 'z');
    }
    // 牙条前后各一根，两头出腿；每条腿两边各一个牙头，里侧大、外侧小
    for (const sz of [-1, 1]) {
      add(new THREE.BoxGeometry(lx * 2 + 0.16, 0.05, 0.016).translate(0, Y - 0.07, sz * lz), 'x');
      for (const sx of [-1, 1])
        for (const [dir, s] of [[-sx, 1], [sx, 0.55]] as [number, number][]) add(spandrel(dir, s).translate(sx * lx + dir * 0.02, Y - 0.095, sz * lz - 0.008), 'x');
    }
    desk.add(mesh(mergeGeometries(parts)!, deskWood));
  }
  // 叠好的纸灯笼：上下木圈压着折起来的皮纸，侧面一道道褶；一盏一个实例、一个颜色
  {
    const prof: [number, number][] = [[0, 0], [0.072, 0], [0.078, 0.005]];
    for (let k = 0; k <= 8; k++) prof.push([k % 2 ? 0.14 : 0.152, 0.008 + k * 0.0045]);
    prof.push([0.078, 0.047], [0.072, 0.052], [0, 0.052]);
    const woodC = new THREE.Color('#4a3527'), paperC = new THREE.Color('#ffffff');
    const geo = paint(lathe(prof, 32), (x, _y, z) => (Math.hypot(x, z) < 0.08 ? woodC : paperC));
    const spots: [number, number, number][] = [[-0.56, -0.1, 0], [-0.56, -0.1, 1], [-0.56, -0.1, 2], [-0.3, -0.05, 0], [-0.3, -0.05, 1]];
    const folded = new THREE.InstancedMesh(geo, std({ map: skin, vertexColors: true, roughness: 0.88 }), spots.length);
    const pick = [0, 3, 1, 4, 5];
    spots.forEach(([x, z, k], i) => {
      mtx.compose(new THREE.Vector3(x + (i % 2) * 0.01, Y + k * 0.052, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.3), one);
      folded.setMatrixAt(i, mtx);
      folded.setColorAt(i, colors[pick[i]]);
    });
    folded.castShadow = folded.receiveShadow = true;
    desk.add(folded);
  }
  // 一盘空白纸签：朱漆托盘，纸签散开着
  {
    const tray: THREE.BufferGeometry[] = [new RoundedBoxGeometry(0.34, 0.014, 0.2, 2, 0.004).translate(0, 0.007, 0)];
    for (const sz of [-1, 1]) tray.push(new THREE.BoxGeometry(0.34, 0.022, 0.012).translate(0, 0.011, sz * 0.094));
    for (const sx of [-1, 1]) tray.push(new THREE.BoxGeometry(0.012, 0.022, 0.2).translate(sx * 0.164, 0.011, 0));
    const t = mesh(mergeGeometries(tray.map((g) => g.toNonIndexed()))!, M.redDark);
    t.position.set(0.02, Y, 0.06);
    const tg: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++)
      tg.push(new THREE.PlaneGeometry(0.095, 0.25).rotateX(-Math.PI / 2).rotateY(Math.PI / 2 + (k - 2) * 0.12).translate((k - 2) * 0.012, 0.016 + k * 0.0012, (k % 2) * 0.01));
    t.add(mesh(mergeGeometries(tg)!, std({ map: tagTex, roughness: 0.9 }), false));
    desk.add(t);
  }
  // 砚台和墨：长方砚，砚头一汪墨；一锭墨搁在旁边
  {
    const ink = new THREE.Group();
    ink.position.set(0.3, Y, 0.1);
    ink.rotation.y = 0.12;
    ink.add(
      mesh(new RoundedBoxGeometry(0.13, 0.026, 0.19, 2, 0.006).translate(0, 0.013, 0), std({ color: '#2d2b29', roughness: 0.55 })),
      mesh(new THREE.CircleGeometry(1, 24).scale(0.045, 0.028, 1).rotateX(-Math.PI / 2).translate(0, 0.0265, -0.055), std({ color: '#0c0b0b', roughness: 0.08 }), false),
      mesh(new THREE.BoxGeometry(0.02, 0.013, 0.075).rotateY(0.5).translate(0.095, 0.0065, 0.02), std({ color: '#171515', roughness: 0.5 }))
    );
    desk.add(ink);
  }
  // 笔筒和毛笔：青瓷笔筒，四支笔笔头朝上，两支蘸过墨
  {
    const pot = mesh(lathe([[0, 0], [0.052, 0], [0.056, 0.004], [0.054, 0.13], [0.058, 0.14], [0.058, 0.147], [0.05, 0.147], [0.048, 0.012], [0, 0.012]], 24), std({ color: '#3f5a52', roughness: 0.3 }));
    pot.position.set(0.52, Y, -0.14);
    const handle = new THREE.Color('#b39a5c'), inked = new THREE.Color('#2b2621'), newHair = new THREE.Color('#e4d9c2');
    const bs: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + 0.4, tilt = 0.1 + (k % 2) * 0.06, len = 0.19 + (k % 3) * 0.02;
      const hair = k < 2 ? inked : newHair;
      const b = [
        paint(new THREE.CylinderGeometry(0.0045, 0.005, len, 6).translate(0, len / 2 + 0.012, 0), () => handle),
        paint(lathe([[0, 0], [0.0062, 0], [0.0082, 0.009], [0.0075, 0.022], [0.004, 0.036], [0, 0.046]], 8).translate(0, len + 0.012, 0), () => hair),
      ].map((g) => {
        const n = g.toNonIndexed();
        n.deleteAttribute('uv');
        return n;
      });
      bs.push(mergeGeometries(b)!.rotateZ(tilt).rotateY(a).translate(Math.cos(a) * 0.015, 0, Math.sin(a) * 0.015));
    }
    pot.add(mesh(mergeGeometries(bs)!, std({ vertexColors: true, roughness: 0.6 })));
    desk.add(pot);
  }
  const deskSign = standSign('祈福燈廊', 0.3);
  deskSign.scale.setScalar(2);
  deskSign.position.set(-0.98, 0, 0.08);
  desk.add(deskSign);
  const deskHit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 1.0), hitMat);
  deskHit.position.set(-0.2, 1.1, 0);
  deskHit.userData.interact = { type: 'wishDesk' };
  desk.add(deskHit);
  interactives.push(deskHit);
  group.add(desk);

  // —— 柿饼架：两头各一副交叉的竹腿（A 字，叉口麻绳捆住），一根竹竿架在叉口上，下面前后两道横档；
  //    竿上吊一串串正在晾的柿子，顶上搭一溜人字形竹帘挡雨；地上一只竹篮装着新摘的 ——
  const P = PERSIMMON;
  const rack = new THREE.Group();
  rack.position.set(P.x, 0, P.z);
  const rackH = 2.0; // 竹竿底下的高度（两腿交叉处）
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  {
    const bambooTex = bambooTexture();
    bambooTex.repeat.set(2, 1);
    const poles: THREE.BufferGeometry[] = [];
    const ties: THREE.BufferGeometry[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    // 一根竹子：从 a 到 b、半径 r，每 0.42 米一道竹节
    const bamboo = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
      const d = b.clone().sub(a), L = d.length();
      const qq = new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize());
      const put = (g: THREE.BufferGeometry, t: number) => g.applyQuaternion(qq).translate(a.x + d.x * t, a.y + d.y * t, a.z + d.z * t);
      poles.push(put(new THREE.CylinderGeometry(r, r, L, 10, 1), 0.5));
      for (let s = 0.3; s < L - 0.1; s += 0.42) poles.push(put(new THREE.TorusGeometry(r * 1.02, r * 0.16, 4, 12).rotateX(Math.PI / 2), s / L));
    };
    for (const sx of [-1, 1]) {
      const x = (sx * P.len) / 2;
      // 两条腿在 rackH 处交叉，叉口往上再出一小截
      for (const s of [-1, 1]) bamboo(V(x + s * 0.03, 0, s * 0.5), V(x + s * 0.03, rackH + 0.17, -s * 0.0425), 0.03);
      ties.push(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 10).rotateZ(Math.PI / 2).translate(x, rackH, 0));
    }
    bamboo(V(-P.len / 2 - 0.25, rackH + 0.035, 0), V(P.len / 2 + 0.25, rackH + 0.035, 0), 0.035);
    for (const s of [-1, 1]) bamboo(V(-P.len / 2 - 0.12, 0.4, s * 0.4), V(P.len / 2 + 0.12, 0.4, s * 0.4), 0.022);
    rack.add(mesh(mergeGeometries(poles)!, std({ map: bambooTex, color: '#d6c39c', roughness: 0.6 })), mesh(mergeGeometries(ties)!, cordMat));
    // 人字形竹帘：竹篾顺着坡往下，三道麻绳编住
    const blind = canvasTex(256, 64, (g) => {
      g.fillStyle = '#a88d5c';
      g.fillRect(0, 0, 256, 64);
      const R = rand(31);
      for (let x = 0; x < 256; x += 4) {
        g.fillStyle = `rgba(${R() < 0.5 ? '60,40,20' : '255,235,190'},${0.08 + R() * 0.12})`;
        g.fillRect(x, 0, 3, 64);
        g.fillStyle = 'rgba(50,35,20,0.45)';
        g.fillRect(x + 3, 0, 1, 64);
      }
      g.fillStyle = 'rgba(55,40,25,0.8)';
      for (const y of [9, 31, 53]) g.fillRect(0, y, 256, 2);
    });
    blind.wrapS = THREE.RepeatWrapping;
    blind.repeat.set((P.len + 0.7) / 0.25, 1);
    const ridge = rackH + 0.2;
    const slope = [-1, 1].map((s) => new THREE.PlaneGeometry(P.len + 0.7, 0.5).rotateX(-s * Math.acos(0.28)).translate(0, ridge - 0.07, s * 0.24));
    rack.add(mesh(mergeGeometries(slope)!, std({ map: blind, roughness: 0.95, side: THREE.DoubleSide })));
  }
  // 晾着的柿子（原点在果柄顶上，果子往下吊）：尖底长圆、捏出的皱褶、颜色发暗；顶上干萼、果柄和拴绳的一小截 T 形枝
  const driedGeo = (() => {
    const body = lathe([[0, -0.135], [0.012, -0.132], [0.028, -0.118], [0.042, -0.095], [0.05, -0.068], [0.052, -0.045], [0.048, -0.025], [0.036, -0.012], [0.018, -0.006], [0, -0.005]], 18);
    const p = body.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const c1 = new THREE.Color('#b4561f'), c2 = new THREE.Color('#6a2c12'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(x, z);
      const w = Math.sin(5 * th + y * 70) * 0.6 + Math.sin(9 * th - y * 110) * 0.4;
      const k = 1 + 0.06 * w;
      p.setXYZ(i, x * k * 1.08, y, z * k * 0.88);
      c.copy(c1).lerp(c2, Math.min(1, Math.max(0, 0.3 - w * 0.3 + (-y - 0.07) * 3)));
      col.set([c.r, c.g, c.b], i * 3);
    }
    body.setAttribute('color', new THREE.BufferAttribute(col, 3));
    body.computeVertexNormals();
    const calyx = new THREE.Shape();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2, rr = 0.01 + 0.014 * Math.pow(Math.abs(Math.cos(a * 2)), 1.5);
      if (i === 0) calyx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else calyx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const stem = new THREE.Color('#3e3018');
    const parts = [
      body,
      paint(new THREE.ShapeGeometry(calyx, 1).rotateX(-Math.PI / 2).translate(0, -0.004, 0), () => new THREE.Color('#4a3d1e')),
      paint(new THREE.CylinderGeometry(0.003, 0.0035, 0.024, 5).translate(0, 0.008, 0), () => stem),
      paint(new THREE.CylinderGeometry(0.0025, 0.0025, 0.035, 4).rotateZ(Math.PI / 2).translate(0, 0.019, 0), () => stem),
    ].map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute('uv');
      return n;
    });
    return mergeGeometries(parts)!;
  })();
  const strings = 12, per = 8, rows = [-0.045, 0.045], gap = 0.18, top = rackH + 0.035;
  const fruits = new THREE.InstancedMesh(driedGeo, std({ vertexColors: true, roughness: 0.5 }), strings * per * rows.length);
  const strGeo: THREE.BufferGeometry[] = [];
  const Rp = rand(5);
  let n = 0;
  for (const [ri, rz] of rows.entries())
    for (let s = 0; s < strings; s++) {
      const x = -P.len / 2 + 0.18 + ((s + ri * 0.5) / strings) * (P.len - 0.36);
      const len = per - ((s + ri) % 3);
      const low = rackH - 0.06 - (len - 1) * gap;
      strGeo.push(new THREE.CylinderGeometry(0.003, 0.003, top - low, 3).translate(x, (top + low) / 2, rz));
      for (let k = 0; k < per; k++) {
        // 短的那几串少挂一两个
        const sc = k < len ? 0.88 + Rp() * 0.22 : 0.0001;
        mtx.compose(V(x + (Rp() - 0.5) * 0.015, rackH - 0.06 - k * gap, rz), new THREE.Quaternion().setFromEuler(new THREE.Euler((Rp() - 0.5) * 0.12, Rp() * 6.28, (Rp() - 0.5) * 0.12)), V(sc, sc, sc));
        fruits.setMatrixAt(n, mtx);
        fruits.setColorAt(n, new THREE.Color().setScalar(0.82 + Rp() * 0.26));
        n++;
      }
    }
  fruits.castShadow = true;
  rack.add(fruits, mesh(mergeGeometries(strGeo)!, cordMat, false));
  // 竹篮：篾片编的斜壁圆篮，卷边、提梁；里面八个新摘的柿子
  {
    const weave = canvasTex(256, 128, (g) => {
      g.fillStyle = '#8a6a3c';
      g.fillRect(0, 0, 256, 128);
      for (let r = 0; r < 16; r++)
        for (let c = 0; c < 16; c++) {
          const x = c * 16, y = r * 8;
          const gr = g.createLinearGradient(0, y, 0, y + 8);
          gr.addColorStop(0, '#9c7a46');
          gr.addColorStop(0.5, '#c9a46a');
          gr.addColorStop(1, '#8a6a3c');
          g.fillStyle = gr;
          g.fillRect(x, y + 1, 16, 6);
          // 竖篾一格压在横篾上、一格钻到底下
          if ((r + c) % 2 === 0) {
            const gv = g.createLinearGradient(x + 5, 0, x + 11, 0);
            gv.addColorStop(0, '#a07c48');
            gv.addColorStop(0.5, '#d2ae74');
            gv.addColorStop(1, '#a07c48');
            g.fillStyle = gv;
            g.fillRect(x + 5, y, 6, 8);
          }
        }
    });
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
    const body = lathe([[0, 0], [0.2, 0], [0.215, 0.012], [0.27, 0.16], [0.283, 0.215], [0.272, 0.222], [0.258, 0.17], [0.205, 0.032], [0, 0.032]], 32);
    const bp = body.attributes.position as THREE.BufferAttribute, buv = body.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) buv.setXY(i, buv.getX(i) * 10, bp.getY(i) * 6);
    const basket = mesh(
      mergeGeometries([body, new THREE.TorusGeometry(0.278, 0.013, 6, 40).rotateX(Math.PI / 2).translate(0, 0.218, 0), new THREE.TorusGeometry(0.27, 0.011, 6, 24, Math.PI).translate(0, 0.218, 0)])!,
      std({ map: weave, roughness: 0.9 })
    );
    basket.position.set(P.len / 2 + 0.55, 0, 0.25);
    basket.rotation.y = 0.6;
    const fresh = fruitGeometry('persimmon');
    const spots: [number, number, number][] = [];
    for (let k = 0; k < 5; k++) spots.push([Math.cos(k * 1.2566) * 0.135, 0.034, Math.sin(k * 1.2566) * 0.135]);
    for (let k = 0; k < 3; k++) spots.push([Math.cos(k * 2.094 + 0.6) * 0.08, 0.085, Math.sin(k * 2.094 + 0.6) * 0.08]);
    basket.add(mesh(mergeGeometries(spots.map(([x, y, z], k) => fresh.clone().scale(1.25, 1.25, 1.25).rotateX(((k % 3) - 1) * 0.15).rotateY(k * 2.3).translate(x, y, z)))!, std({ vertexColors: true, roughness: 0.4 })));
    rack.add(basket);
  }
  // 小木牌「柿柿如意」
  {
    const tex = canvasTex(256, 96, (g) => {
      g.fillStyle = '#d9c7a3';
      g.fillRect(0, 0, 256, 96);
      g.strokeStyle = 'rgba(80,50,30,0.5)';
      g.lineWidth = 4;
      g.strokeRect(5, 5, 246, 86);
      g.fillStyle = '#3a2618';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '600 50px "Kaiti TC", "Kaiti SC", STKaiti, KaiTi, serif';
      g.fillText('柿柿如意', 128, 50);
    });
    const sign = mesh(new THREE.BoxGeometry(0.5, 0.19, 0.02), [darkWood, darkWood, darkWood, darkWood, std({ map: tex, roughness: 0.85 }), darkWood]);
    sign.position.set(-P.len / 2 - 0.4, 0.95, 0.3);
    const stick = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), darkWood);
    stick.position.set(-P.len / 2 - 0.4, 0.45, 0.29);
    rack.add(sign, stick);
  }
  const rackHit = new THREE.Mesh(new THREE.BoxGeometry(P.len + 1.6, 2.3, 1.1), hitMat);
  rackHit.position.y = 1.1;
  rackHit.userData.interact = { type: 'persimmon' };
  rack.add(rackHit);
  interactives.push(rackHit);
  group.add(rack);

  // （原来这里沿 STONE_PATHS 铺六角踏脚石；2026-11-19 院子改铺青砖后去掉了，STONE_PATHS 只用来让草丛避开小路）

  // —— 草丛与野花：前院两侧、墙根、树下、小路边，一丛一丛 ——
  {
    const onPath = (x: number, z: number) => {
      for (const path of STONE_PATHS)
        for (let i = 0; i < path.length - 1; i++) {
          const a = path[i], b = path[i + 1];
          const L2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
          const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / L2));
          if (Math.hypot(x - (a.x + (b.x - a.x) * t), z - (a.z + (b.z - a.z) * t)) < 0.75) return true;
        }
      return false;
    };
    // 能长草的地方：前院、东西两侧的空地；避开参道、池子、殿台、东西两处设施、挡路的东西
    const free = (x: number, z: number) => {
      if (Math.abs(x) < 4.2 || z < -48 || z > COURT.z1 - 1.2 || Math.abs(x) > COURT.x1 - 1.2) return false;
      if (z < 33 && Math.abs(x) < 21) return false;
      if (inPond(x, z, 1.4) || onPath(x, z) || blocked(x, z)) return false;
      if (x > CAFE.x - CAFE.deck - 1.2 && x < CAFE.x + CAFE.hd + 1.2 && Math.abs(z - CAFE.z) < CAFE.hw + 1.2) return false;
      if (x > WISH_ALLEY.xW - 0.6 && x < WISH_ALLEY.xE + 0.6 && z > WISH_ALLEY.zs[0] - 0.6 && z < WISH_ALLEY.zs[WISH_ALLEY.zs.length - 1] + 0.6) return false;
      return true;
    };
    const Rg = rand(17);
    const grassM: THREE.Matrix4[] = [];
    const grassC: THREE.Color[] = [];
    const flowerM: [THREE.Matrix4[], THREE.Matrix4[]] = [[], []];
    const clusters = o.lite ? 70 : 140;
    let tries = 0;
    for (let c = 0; c < clusters && tries < 4000; tries++) {
      const cx = (Rg() * 2 - 1) * (COURT.x1 - 2), cz = -46 + Rg() * (COURT.z1 + 44);
      if (!free(cx, cz)) continue;
      c++;
      const nT = 3 + Math.floor(Rg() * 6);
      for (let k = 0; k < nT; k++) {
        const x = cx + (Rg() - 0.5) * 1.6, z = cz + (Rg() - 0.5) * 1.6;
        if (!free(x, z)) continue;
        const s = 0.28 + Rg() * 0.3;
        grassM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Rg() * 3.14, 0)), new THREE.Vector3(s * 1.3, s, s * 1.3)));
        grassC.push(new THREE.Color().setHSL(0.11 + Rg() * 0.1, 0.32 + Rg() * 0.18, 0.4 + Rg() * 0.14));
      }
      // 三丛里有一丛开花：前院多些波斯菊，墙根多些小雏菊
      if (Rg() < 0.34 && cz > 30) {
        const kind = Rg() < 0.65 ? 0 : 1;
        for (let k = 0; k < 2 + Math.floor(Rg() * 3); k++) {
          const x = cx + (Rg() - 0.5) * 1.1, z = cz + (Rg() - 0.5) * 1.1;
          if (!free(x, z)) continue;
          const s = 0.36 + Rg() * 0.16;
          flowerM[kind].push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Rg() * 3.14, 0)), new THREE.Vector3(s, s, s)));
        }
      }
    }
    // 两片交叉的竖面，底边贴地
    const cross = mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2)]);
    const gMat = new THREE.MeshStandardMaterial({ map: grassSkin(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 });
    const grass = new THREE.InstancedMesh(cross, gMat, grassM.length);
    grassM.forEach((m, i) => {
      grass.setMatrixAt(i, m);
      grass.setColorAt(i, grassC[i]);
    });
    grass.receiveShadow = true;
    group.add(grass);
    (['cosmos', 'daisy'] as const).forEach((kind, ki) => {
      const list = flowerM[ki];
      if (!list.length) return;
      const fm = new THREE.InstancedMesh(cross, new THREE.MeshStandardMaterial({ map: flowerSkin(kind), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }), list.length);
      list.forEach((m, i) => fm.setMatrixAt(i, m));
      group.add(fm);
    });
  }

  let tAcc = 0;
  return {
    interactives,
    hooks,
    setLanterns(list) {
      view = hooks.map(() => null);
      for (const v of list) if (v.hook >= 0 && v.hook < H) view[v.hook] = v;
      applyColors();
    },
    rise(hook, from) {
      rising.set(hook, { from: from.clone(), t: 0 });
    },
    setLanternLevel(level) {
      bodyMat.emissiveIntensity = level * 0.85;
      tagMat.emissiveIntensity = level * 0.25;
    },
    update(dt, t) {
      // 灯笼轻轻晃：每两帧更新一次（新灯升起时每帧都更新）
      tAcc += dt;
      if (tAcc < 0.033 && !rising.size) return;
      place(t, tAcc);
      tAcc = 0;
    },
  };
}
