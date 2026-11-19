// 西院的祈福灯廊、灯廊北头的柿饼架、两条通往咖啡摊和灯廊的石板小路，前院零零散散的草丛和野花。
// 灯廊：两排高木杆，杆间拉绳，挂满各色灯笼；访客挂上的那盏下面吊一张写着心愿的纸签（自己的是金色的）。
// 没人挂的位置由寺里挂上素灯笼，廊子什么时候看都是满的。夜里灯笼亮起来。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WISH_ALLEY, WISH_DESK, PERSIMMON, STONE_PATHS, COURT, CAFE, blocked, inPond } from '../layout';
import { plaqueTexture } from '../textures';
import { mesh } from './util';
import { chineseMats, aged } from './hall';
import { pbr } from './pbr';

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
function ribbedLantern(r: number, h: number, ribs: number, seg: number, rows: number) {
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

export function buildGarden(scene: THREE.Scene, o: { lite: boolean }): GardenBuild {
  const M = chineseMats();
  const group = new THREE.Group();
  scene.add(group);
  const interactives: THREE.Object3D[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...p });
  const darkWood = std({ color: '#3b2a1f', roughness: 0.75 });
  const wood = std({ color: '#6a4a30', roughness: 0.7 });
  const cordMat = std({ color: '#2a201a', roughness: 0.9 });

  // —— 灯廊：木杆、杆头的小帽、绳子 ——
  const A = WISH_ALLEY;
  const postGeo: THREE.BufferGeometry[] = [];
  const capGeo: THREE.BufferGeometry[] = [];
  for (const x of [A.xE, A.xW])
    for (const z of A.zs) {
      postGeo.push(new THREE.BoxGeometry(0.15, A.h, 0.15).translate(x, A.h / 2, z));
      capGeo.push(new THREE.ConeGeometry(0.16, 0.16, 4).rotateY(Math.PI / 4).translate(x, A.h + 0.08, z));
      capGeo.push(new THREE.BoxGeometry(0.24, 0.05, 0.24).translate(x, A.h - 0.02, z));
    }
  const posts = mesh(mergeGeometries(postGeo), darkWood);
  posts.userData.interact = { type: 'wishDesk' };
  group.add(posts, mesh(mergeGeometries(capGeo), darkWood));
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
  group.add(mesh(mergeGeometries(wires), cordMat, false));

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
  const tagMat = new THREE.MeshStandardMaterial({ map: tagSkin(), roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0 });
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

  // —— 祈福台：木案，上面一摞叠好的纸灯笼、一叠纸签、笔筒、砚台；旁边立一块「祈福燈廊」木牌 ——
  const desk = new THREE.Group();
  desk.position.set(WISH_DESK.x, 0, WISH_DESK.z);
  desk.rotation.y = WISH_DESK.yaw;
  const top = mesh(new THREE.BoxGeometry(1.6, 0.06, 0.62), wood);
  top.position.y = 0.8;
  desk.add(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(new THREE.BoxGeometry(0.07, 0.77, 0.07), darkWood);
    leg.position.set(sx * 0.72, 0.385, sz * 0.25);
    desk.add(leg);
  }
  const apron = mesh(new THREE.BoxGeometry(1.5, 0.12, 0.02), darkWood);
  apron.position.set(0, 0.72, 0.3);
  desk.add(apron);
  // 叠好的纸灯笼：扁扁的一摞，各色
  LANTERN_COLORS.forEach((c, k) => {
    const flat = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 16), std({ color: c, roughness: 0.85 }));
    flat.position.set(-0.45 + (k % 3) * 0.06, 0.85 + Math.floor(k / 1) * 0.036, -0.05 + (k % 2) * 0.03);
    desk.add(flat);
  });
  const paper = std({ color: '#f3ede0', roughness: 0.95 });
  const stack = mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), paper);
  stack.position.set(0.12, 0.855, 0.05);
  const brushPot = mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.15, 14), std({ color: '#3f5a52', roughness: 0.35 }));
  brushPot.position.set(0.5, 0.905, -0.12);
  desk.add(stack, brushPot);
  for (let k = 0; k < 3; k++) {
    const brush = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), std({ color: '#b39a5c' }));
    brush.position.set(0.5 + (k - 1) * 0.02, 1.0, -0.12);
    brush.rotation.z = (k - 1) * 0.15;
    desk.add(brush);
  }
  const inkstone = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.22), std({ color: '#24221f', roughness: 0.4 }));
  inkstone.position.set(0.32, 0.845, 0.1);
  desk.add(inkstone);
  // 竖牌
  {
    const tex = plaqueTexture('祈福燈廊', true);
    const w = 0.34, h = w * ((250 * 4 + 140) / 300);
    const board = mesh(new THREE.BoxGeometry(w, h, 0.06), [M.gold, M.gold, M.gold, M.gold, std({ map: tex, roughness: 0.5, metalness: 0.2 }), M.redDark]);
    board.position.set(-0.98, 0.6 + h / 2, 0.08);
    const pole = mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), darkWood);
    pole.position.set(-0.98, 0.31, 0.04);
    desk.add(board, pole);
  }
  const deskHit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 1.0), hitMat);
  deskHit.position.set(-0.2, 1.1, 0);
  deskHit.userData.interact = { type: 'wishDesk' };
  desk.add(deskHit);
  interactives.push(deskHit);
  group.add(desk);

  // —— 柿饼架：两头 A 字木腿，顶上一根横梁，挂一串串柿子；地上一只竹篮装着新摘的 ——
  const P = PERSIMMON;
  const rack = new THREE.Group();
  rack.position.set(P.x, 0, P.z);
  const rackH = 2.0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.035, 0.045, rackH + 0.15, 7), wood);
      leg.position.set(sx * P.len / 2, rackH / 2, sz * 0.24);
      leg.rotation.x = sz * 0.13;
      rack.add(leg);
    }
  }
  for (const rz of [-0.12, 0.12]) {
    const beam = mesh(new THREE.CylinderGeometry(0.04, 0.04, P.len + 0.4, 8), wood);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, rackH, rz);
    rack.add(beam);
  }
  // 顶上搭一溜竹帘挡雨
  const roof = mesh(new THREE.BoxGeometry(P.len + 0.7, 0.03, 0.9), std({ color: '#9c8556', roughness: 0.95 }));
  roof.position.y = rackH + 0.2;
  roof.rotation.x = 0.08;
  rack.add(roof);
  const fruitGeo = new THREE.SphereGeometry(0.075, 12, 8);
  fruitGeo.scale(1, 0.78, 1);
  const fruitMat = std({ color: '#e0661c', roughness: 0.45 });
  const dried = std({ color: '#b5501c', roughness: 0.6 });
  const calyxGeo = new THREE.CylinderGeometry(0.035, 0.02, 0.018, 4);
  const strings = 12, per = 8, rows = [-0.12, 0.12];
  const fruits = new THREE.InstancedMesh(fruitGeo, dried, strings * per * rows.length);
  const calyx = new THREE.InstancedMesh(calyxGeo, std({ color: '#3d4a24' }), strings * per * rows.length);
  const strGeo: THREE.BufferGeometry[] = [];
  const Rp = rand(5);
  let n = 0;
  for (const [ri, rz] of rows.entries())
    for (let s = 0; s < strings; s++) {
      const x = -P.len / 2 + 0.18 + ((s + ri * 0.5) / strings) * (P.len - 0.36);
      const len = per - (s + ri) % 3;
      strGeo.push(new THREE.CylinderGeometry(0.003, 0.003, len * 0.17 + 0.05, 3).translate(x, rackH - (len * 0.17) / 2, rz));
      for (let k = 0; k < per; k++) {
        const y = rackH - 0.1 - k * 0.17;
        // 短的那几串少挂两个
        const sc = k < len ? 0.85 + Rp() * 0.25 : 0.0001;
        mtx.compose(new THREE.Vector3(x + (Rp() - 0.5) * 0.02, y, rz + (Rp() - 0.5) * 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Rp() * 6, (Rp() - 0.5) * 0.3)), new THREE.Vector3(1, 1, 1).multiplyScalar(sc));
        fruits.setMatrixAt(n, mtx);
        mtx.compose(new THREE.Vector3(x, y + 0.06, rz), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1).multiplyScalar(k < len ? 1 : 0.0001));
        calyx.setMatrixAt(n, mtx);
        n++;
      }
    }
  fruits.castShadow = true;
  rack.add(fruits, calyx, mesh(mergeGeometries(strGeo), cordMat, false));
  // 竹篮和新柿子
  const basket = mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.24, 16, 1, true), std({ color: '#b08a52', roughness: 0.95, side: THREE.DoubleSide }));
  basket.position.set(P.len / 2 + 0.55, 0.12, 0.25);
  rack.add(basket);
  for (let k = 0; k < 9; k++) {
    const f = mesh(fruitGeo, fruitMat);
    f.scale.setScalar(1.25);
    f.position.set(P.len / 2 + 0.55 + Math.cos(k * 2.4) * 0.14 * (k % 3) * 0.6, 0.2 + (k > 5 ? 0.06 : 0), 0.25 + Math.sin(k * 2.4) * 0.14 * (k % 3) * 0.6);
    rack.add(f);
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

  // —— 石板小路：不规则的青石板，一块接一块 ——
  {
    const slab = pbr('granite', { metersPerTile: 1.0, color: new THREE.Color().setRGB(2.3, 2.25, 2.15) });
    aged(slab, 0.1, 0.3);
    const geo = new THREE.CylinderGeometry(1, 1, 1, 7);
    const list: THREE.Matrix4[] = [];
    const Rs = rand(31);
    for (const path of STONE_PATHS) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const L = Math.hypot(b.x - a.x, b.z - a.z);
        const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
        const steps = Math.max(1, Math.round(L / 0.78));
        for (let k = 0; k < steps; k++) {
          const t = (k + Rs() * 0.2) / steps;
          const side = (k % 2 ? 1 : -1) * (0.12 + Rs() * 0.12);
          const r = 0.3 + Rs() * 0.1;
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(a.x + (b.x - a.x) * t + nx * side, 0.012, a.z + (b.z - a.z) * t + nz * side),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Rs() * 6.28, 0)),
            new THREE.Vector3(r * (1 + Rs() * 0.25), 0.05, r)
          );
          list.push(m);
        }
      }
    }
    const stones = new THREE.InstancedMesh(geo, slab, list.length);
    list.forEach((m, i) => stones.setMatrixAt(i, m));
    stones.receiveShadow = true;
    group.add(stones);
  }

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
