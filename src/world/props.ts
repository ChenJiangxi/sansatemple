// 院中陈设（汉传佛寺）：红灯笼与宫灯、八角七层楼阁塔、铜鼎香炉与烛台架、石凳、
// 黄色寺墙、三开间山门、放生池上的石拱桥
import * as THREE from 'three';
import { ribbedLantern } from './garden';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { HALL, COURT, INCENSE, PAGODAS, BENCHES, NPC_BENCHES, BENCH_SEATS, GROUND_LAMPS, BRIDGE } from '../layout';
import { plaqueTexture, rng, geshanTexture } from '../textures';
import { mesh, worldBox, lathe } from './util';
import { buildRoof, buildPolyEave, beamRing, chineseMats, meterUV, aged, addTileRuns, type SlopeFn } from './hall';
import { IncenseSpot, type IncenseView } from './incense';
import { pbr } from './pbr';
import { buildDing } from './bronze';
import { buildNightLights } from './nightlights';

// 按法线朝向把 UV 投到真实尺寸（米），石材贴图在倒圆的石板上不拉伸
function boxUV(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position as THREE.BufferAttribute, n = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else if (ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return geo;
}

// 四面同一条线脚的石块：prof 是 [高度, 内收]，每层是比外框（半宽 hx、半深 hz）缩进的矩形，
// 层层相连成四个侧面；平面着色，线脚的棱角分明。顶面加盖，底面贴地不画
function carvedBlock(hx: number, hz: number, prof: [number, number][]) {
  const pos: number[] = [], uv: number[] = [];
  const ring = (y: number, k: number) => [[-(hx - k), y, hz - k], [hx - k, y, hz - k], [hx - k, y, -(hz - k)], [-(hx - k), y, -(hz - k)]];
  const along = (v: number[], s: number) => (s % 2 === 0 ? v[0] : v[2]);
  for (let j = 0; j < prof.length - 1; j++) {
    const a = ring(...prof[j]), b = ring(...prof[j + 1]);
    for (let s = 0; s < 4; s++) {
      const s1 = (s + 1) % 4;
      for (const v of [a[s], a[s1], b[s1], a[s], b[s1], b[s]]) {
        pos.push(...v);
        uv.push(along(v, s), v[1]);
      }
    }
  }
  const t = ring(...prof[prof.length - 1]);
  for (const v of [t[0], t[1], t[2], t[0], t[2], t[3]]) {
    pos.push(...v);
    uv.push(v[0], v[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export interface PropsBuild {
  interactives: THREE.Object3D[];
  setLanternLevel(level: number): void;
  setIncense(list: IncenseView[]): void;
  update(dt: number, t: number): void;
}

// 灯笼的发光颜色跟着实例颜色走
function glowMaterial(base: THREE.MeshStandardMaterialParameters) {
  const mat = new THREE.MeshStandardMaterial({ ...base, emissive: '#ffffff', emissiveIntensity: 0.3 });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'
    );
  };
  return mat;
}

// 红灯笼的绸面（白底，颜色交给每盏灯的实例颜色）：细细的绸纹，十六道竹骨的阴影，上下收口处颜色加深、各一道金边，
// 前后各一个圆框里的「福」
function lanternTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 256);
  // 绸纹：横竖极细的线
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = `rgba(0,0,0,${0.025 + ((y * 7) % 5) * 0.004})`;
    g.fillRect(0, y, 512, 1);
  }
  for (let x = 0; x < 512; x += 3) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(x, 0, 1, 256);
  }
  // 竹骨：一道深线，两侧淡影
  for (let x = 0; x < 512; x += 32) {
    const gr = g.createLinearGradient(x - 10, 0, x + 10, 0);
    gr.addColorStop(0, 'rgba(60,10,5,0)');
    gr.addColorStop(0.5, 'rgba(60,10,5,0.28)');
    gr.addColorStop(1, 'rgba(60,10,5,0)');
    g.fillStyle = gr;
    g.fillRect(x - 10, 0, 20, 256);
    g.fillStyle = 'rgba(50,10,5,0.4)';
    g.fillRect(x - 1, 0, 2, 256);
  }
  // 上下收口：颜色加深，各一道金边
  const band = g.createLinearGradient(0, 0, 0, 256);
  band.addColorStop(0, 'rgba(40,5,0,0.55)');
  band.addColorStop(0.16, 'rgba(0,0,0,0)');
  band.addColorStop(0.84, 'rgba(0,0,0,0)');
  band.addColorStop(1, 'rgba(40,5,0,0.55)');
  g.fillStyle = band;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(255,214,120,0.95)';
  g.fillRect(0, 26, 512, 5);
  g.fillRect(0, 225, 512, 5);
  // 福
  for (const cx of [128, 384]) {
    g.strokeStyle = 'rgba(255,214,120,0.95)';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(cx, 128, 50, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, 128, 58, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,214,120,0.98)';
    g.font = '700 66px "Songti SC","STSong","Noto Serif CJK SC",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('福', cx, 132);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 宫灯的绢面：黄绢，上下一道红边，中间一朵淡淡的莲花（一张贴图绕六面）
function silkTexture() {
  const W = 768, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2d79a';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,250,230,0.25)' : 'rgba(170,120,50,0.08)';
    g.fillRect(Math.random() * W, Math.random() * H, 2, 1);
  }
  g.fillStyle = '#b3261e';
  g.fillRect(0, 0, W, 10);
  g.fillRect(0, H - 10, W, 10);
  for (let k = 0; k < 6; k++) {
    const cx = (k + 0.5) * (W / 6), cy = H * 0.56;
    g.fillStyle = 'rgba(200,80,60,0.55)';
    for (let p = 0; p < 5; p++) {
      const a = Math.PI + (p / 4) * Math.PI;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 12, 13, 6, a, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(60,110,70,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 34, cy + 22);
    g.quadraticCurveTo(cx, cy + 10, cx + 34, cy + 22);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// 山门大门：朱红漆面，九路金色门钉，正中一对兽面铺首衔环
function gateDoorTexture() {
  const W = 256, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8f2014';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,170,140,0.05)' : 'rgba(40,0,0,0.08)';
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 4 + Math.random() * 18);
  }
  g.strokeStyle = 'rgba(40,6,2,0.6)';
  g.lineWidth = 4;
  g.strokeRect(6, 6, W - 12, H - 12);
  const stud = (x: number, y: number, r: number) => {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, '#fff0b8');
    gr.addColorStop(0.45, '#d9a64a');
    gr.addColorStop(1, '#6a4612');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  for (let row = 0; row < 9; row++) for (let col = 0; col < 5; col++) stud(30 + col * 49, 40 + row * 52, 9);
  // 铺首：兽面圆盘衔一个环（门缝那一侧）
  const cx = W - 34, cy = H * 0.52;
  stud(cx, cy, 22);
  g.strokeStyle = '#c9963e';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, cy + 30, 22, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildProps(scene: THREE.Scene): PropsBuild {
  const M = chineseMats();
  const group = new THREE.Group();
  const r = rng(202);
  const interactives: THREE.Object3D[] = [];
  // 花岗岩贴图本身很暗（均值约 78/255），乘一个大于 1 的颜色提到青灰石的亮度；再做旧：一块块深浅、往下淌的雨痕
  const stoneMat = pbr('granite', { metersPerTile: 1.5, color: new THREE.Color().setRGB(2.45, 2.37, 2.22) });
  aged(stoneMat, 0.12, 0.32);
  const stoneClone = (side?: THREE.Side) => {
    const m = pbr('granite', { metersPerTile: 1.5, color: new THREE.Color().setRGB(2.45, 2.37, 2.22) });
    if (side !== undefined) m.side = side;
    aged(m, 0.12, 0.32);
    return m;
  };

  // —— 红灯笼：参道两侧各四根灯杆拉灯绳，大殿屋檐下每间一盏大的 ——
  type L = { p: THREE.Vector3; s: number; cord?: number; red?: boolean };
  const lanterns: L[] = [];
  const poleZ = [11, 22, 33, 43.5];
  const poleH = 4.1;
  // 灯杆：方石座 + 八角石鼓，朱漆八棱木杆箍三道金环，杆头金色覆莲托一颗宝珠（2026-11-19 原来是一根细红圆杆）
  const poleStone: THREE.BufferGeometry[] = [];
  const poleRed: THREE.BufferGeometry[] = [];
  const poleGold: THREE.BufferGeometry[] = [];
  const cords: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 2.75;
    for (const z of poleZ) {
      poleStone.push(new THREE.BoxGeometry(0.44, 0.12, 0.44).translate(x, 0.06, z));
      poleStone.push(lathe([[0.17, 0.12], [0.19, 0.16], [0.19, 0.27], [0.15, 0.31], [0.11, 0.34], [0, 0.34]], 8).rotateY(Math.PI / 8).translate(x, 0, z));
      poleRed.push(meterUV(new THREE.CylinderGeometry(0.072, 0.084, poleH - 0.34, 8), 0.45, poleH).translate(x, 0.34 + (poleH - 0.34) / 2, z));
      for (const y of [0.52, 2.3, poleH - 0.24]) poleGold.push(new THREE.CylinderGeometry(0.094, 0.094, 0.045, 8).translate(x, y, z));
      poleGold.push(lathe([[0.085, 0], [0.11, 0.025], [0.1, 0.05], [0.06, 0.1], [0.045, 0.13]], 16).translate(x, poleH, z));
      poleGold.push(new THREE.SphereGeometry(0.06, 14, 10).translate(x, poleH + 0.19, z));
    }
    for (let i = 0; i < poleZ.length - 1; i++) {
      const za = poleZ[i], zb = poleZ[i + 1];
      const y0 = poleH - 0.12;
      const sag = 0.5;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 24; k++) {
        const tt = k / 24;
        pts.push(new THREE.Vector3(x, y0 - Math.sin(tt * Math.PI) * sag, za + (zb - za) * tt));
      }
      cords.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 4, false));
      for (let k = 1; k < 7; k++) {
        const tt = k / 7;
        lanterns.push({ p: new THREE.Vector3(x, y0 - Math.sin(tt * Math.PI) * sag - 0.45, za + (zb - za) * tt), s: 0.8 });
      }
    }
  }
  group.add(mesh(mergeGeometries(poleStone.map((g) => g.toNonIndexed()))!, stoneMat));
  group.add(mesh(mergeGeometries(poleRed)!, M.red));
  group.add(mesh(mergeGeometries(poleGold.map((g) => (g.index ? g.toNonIndexed() : g)))!, M.gold));
  for (let i = 0; i < HALL.colX.length - 1; i++) {
    const x = (HALL.colX[i] + HALL.colX[i + 1]) / 2;
    lanterns.push({ p: new THREE.Vector3(x, HALL.baseH + HALL.colH - 0.9, HALL.colZFront + 1.2), s: 1.9 });
  }
  // 配殿檐下、钟楼四角的灯笼：位置由夜灯模块给出，造型和参道的一样，只是大一圈、吊绳长
  const night = buildNightLights(scene);
  for (const p of night.lanterns) lanterns.push({ p, s: 1.3, cord: 1.05, red: true });
  const ltex = lanternTexture();
  const lanternMat = glowMaterial({ map: ltex, emissiveMap: ltex, roughness: 0.55 });
  // 瓜棱形：16 道竹骨处往里收，骨与骨之间鼓出来（和祈福灯廊的纸灯同一个生成函数）
  const lanternGeo = ribbedLantern(0.205, 0.17, 16, 48, 16);
  const lm = new THREE.InstancedMesh(lanternGeo, lanternMat, lanterns.length);
  // 上下金帽（带一道边）和流苏上方的小金环，合成一个几何体
  const capTop = lathe([[0, 0], [0.112, 0], [0.118, 0.012], [0.104, 0.028], [0.07, 0.042], [0.03, 0.05], [0, 0.05]], 20);
  const capGeo = mergeGeometries([
    capTop.clone().translate(0, 0.162, 0),
    capTop.clone().rotateX(Math.PI).translate(0, -0.162, 0),
    new THREE.TorusGeometry(0.018, 0.006, 6, 14).rotateX(Math.PI / 2).translate(0, -0.235, 0),
  ].map((g) => (g.index ? g.toNonIndexed() : g)))!;
  const caps = new THREE.InstancedMesh(capGeo, M.gold, lanterns.length);
  // 流苏：一小截绳、一个结、下面一束散开的穗
  const tasselGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.005, 0.005, 0.05, 5).translate(0, -0.2, 0),
    new THREE.SphereGeometry(0.024, 10, 8).translate(0, -0.235, 0),
    new THREE.CylinderGeometry(0.014, 0.04, 0.22, 12, 1, true).translate(0, -0.365, 0),
  ].map((g) => (g.index ? g.toNonIndexed() : g)))!;
  const tassels = new THREE.InstancedMesh(tasselGeo, new THREE.MeshStandardMaterial({ color: '#a8231a', roughness: 0.85, side: THREE.DoubleSide }), lanterns.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  lanterns.forEach((L, i) => {
    const sc = new THREE.Vector3(L.s, L.s, L.s);
    m4.compose(L.p, q, sc);
    lm.setMatrixAt(i, m4);
    const roll = r();
    lm.setColorAt(i, new THREE.Color(L.red || roll > 0.12 ? '#d8361a' : '#e0a030'));
    caps.setMatrixAt(i, m4);
    tassels.setMatrixAt(i, m4);
    const len = L.cord ?? 0.45 - 0.19 * L.s;
    if (len > 0.02) cords.push(new THREE.CylinderGeometry(0.006, 0.006, len, 4).translate(L.p.x, L.p.y + 0.19 * L.s + len / 2, L.p.z));
  });
  group.add(lm, caps, tassels);
  group.add(mesh(mergeGeometries(cords.map((g) => (g.index ? g.toNonIndexed() : g)))!, new THREE.MeshStandardMaterial({ color: '#3a2420', roughness: 0.9 }), false));
  const pathLights = [new THREE.PointLight('#ff9a6a', 0, 14, 1.5), new THREE.PointLight('#ff9a6a', 0, 14, 1.5)];
  pathLights[0].position.set(0, 3.4, 18);
  pathLights[1].position.set(0, 3.4, 36);
  group.add(...pathLights);

  // —— 宫灯：六角红框、黄绢灯罩，立在矮红柱上 ——
  // 六根红框柱夹着六面画了纹样的黄绢，上下两圈框、顶上六角攒尖加一颗宝珠，六个角各垂一条红穗
  const silk = new THREE.MeshStandardMaterial({ map: silkTexture(), color: '#ffffff', roughness: 0.85, emissive: '#ffcf80', emissiveIntensity: 0.2, emissiveMap: null, side: THREE.DoubleSide });
  const lampFrame: THREE.BufferGeometry[] = [];
  const lampSilk: THREE.BufferGeometry[] = [];
  const lampTassel: THREE.BufferGeometry[] = [];
  for (const [x, z] of GROUND_LAMPS) {
    const post = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 8);
    post.translate(x, 0.45, z);
    lampFrame.push(post);
    const shade = new THREE.CylinderGeometry(0.22, 0.22, 0.42, 6, 1, true);
    shade.translate(x, 0.9 + 0.21, z);
    lampSilk.push(shade);
    for (const [y, r, h] of [[0.9, 0.26, 0.05], [1.32, 0.26, 0.05], [0.86, 0.17, 0.05]] as [number, number, number][]) {
      const ring = new THREE.CylinderGeometry(r, r, h, 6);
      ring.translate(x, y, z);
      lampFrame.push(ring);
    }
    for (let k = 0; k < 6; k++) {
      // 六角柱体的角在 (sin, cos) 的 k·60° 处
      const a = (k / 6) * Math.PI * 2;
      const cx = x + Math.sin(a) * 0.235, cz = z + Math.cos(a) * 0.235;
      lampFrame.push(new THREE.BoxGeometry(0.035, 0.44, 0.035).translate(cx, 1.11, cz));
      const ox = x + Math.sin(a) * 0.3, oz = z + Math.cos(a) * 0.3;
      lampFrame.push(new THREE.BoxGeometry(0.03, 0.03, 0.09).rotateY(a).translate(ox, 1.43, oz));
      lampTassel.push(new THREE.ConeGeometry(0.025, 0.16, 6).translate(ox, 1.33, oz));
    }
    const top = new THREE.ConeGeometry(0.28, 0.16, 6);
    top.translate(x, 1.42, z);
    lampFrame.push(top);
    lampFrame.push(new THREE.SphereGeometry(0.045, 10, 8).translate(x, 1.53, z));
  }
  group.add(mesh(mergeGeometries(lampFrame.map((g) => g.toNonIndexed())), M.red));
  group.add(mesh(mergeGeometries(lampSilk), silk, false));
  group.add(mesh(mergeGeometries(lampTassel.map((g) => g.toNonIndexed())), new THREE.MeshStandardMaterial({ color: '#b3201a', roughness: 0.8 }), false));

  // —— 八角七层楼阁塔：每层塔身 + 一圈出檐，顶上塔刹 ——
  const towerMat = pbr('plaster', { metersPerTile: 1.6, color: '#d8cfbf' });
  const pagodaLampMat = new THREE.MeshStandardMaterial({ color: '#d63a22', roughness: 0.6, emissive: '#ff6a2a', emissiveIntensity: 0.1 });
  const pagodaLampGeo = new THREE.SphereGeometry(0.075, 10, 8).scale(1, 1.3, 1);
  const doorMat = new THREE.MeshStandardMaterial({ map: geshanTexture(), roughness: 0.7 });
  // 塔身的窗：只取格扇门上半截的菱花格心
  const winTex = geshanTexture();
  winTex.repeat.set(1, 0.62);
  winTex.offset.set(0, 0.36);
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.75 });
  const chainMat = new THREE.MeshStandardMaterial({ color: '#2e2a26', metalness: 0.6, roughness: 0.55 });
  // 塔檐下的彩画额枋：大殿彩画贴图绕一圈，横向重复几次
  const bandTex = (M.caihua as THREE.MeshStandardMaterial).map!.clone();
  bandTex.wrapS = THREE.RepeatWrapping;
  bandTex.repeat.set(4, 1);
  bandTex.needsUpdate = true;
  const bandMat = new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.75 });
  for (const [pi, P] of PAGODAS.entries()) {
    const g = new THREE.Group();
    const lampAt: THREE.Vector3[] = [];
    const bands: THREE.BufferGeometry[] = [];
    const units: THREE.BufferGeometry[] = [];
    // 塔整体转 22.5°，让八角塔的一面正对中轴线；塔门开在这一面，门前三级石阶
    const doorSide = P.x < 0 ? 0 : 2; // 下面开窗的四个方向里，朝中轴线的那一个
    const doorTh = (P.x < 0 ? Math.PI / 2 : -Math.PI / 2) - Math.PI / 8; // 塔的本地朝向（sin, cos）
    const baseG = mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.7, 8), stoneMat);
    baseG.position.y = 0.35;
    g.add(baseG);
    let y = 0.7;
    for (let k = 0; k < 7; k++) {
      const rr = 1.3 * (1 - k * 0.075);
      const hh = k === 0 ? 1.7 : 1.05 - k * 0.04;
      const body = mesh(new THREE.CylinderGeometry(rr, rr, hh, 8), towerMat);
      body.position.y = y + hh / 2;
      g.add(body);
      for (let d = 0; d < 4; d++) {
        if (k === 0 && d === doorSide) continue;
        const a = (d / 4) * Math.PI * 2 + Math.PI / 8;
        const win = mesh(new THREE.PlaneGeometry(rr * 0.45, hh * 0.55), winMat, false);
        win.position.set(Math.cos(a) * (rr * 0.93), y + hh * 0.48, Math.sin(a) * (rr * 0.93));
        win.lookAt(win.position.x * 2, win.position.y, win.position.z * 2);
        g.add(win);
      }
      y += hh;
      // 塔檐：八个坡面的真屋檐，铺筒瓦、转角起翘（原来是一个光滑的八棱锥台）
      for (let c = 0; c < 8; c++) {
        const th = (c / 8) * Math.PI * 2;
        lampAt.push(new THREE.Vector3(Math.sin(th) * rr * 1.5, y - 0.18, Math.cos(th) * rr * 1.5));
      }
      g.add(buildPolyEave({ sides: 8, rOut: rr * 1.62, rIn: rr * 0.98, yOut: y - 0.04, yIn: y + 0.3, lift: 0.2 }));
      // 檐下：一圈彩画额枋，上面每面两朵斗拱（坐斗 + 横拱），托着屋檐
      bands.push(new THREE.CylinderGeometry(rr * 1.04, rr * 1.02, 0.16, 8).translate(0, y - 0.12, 0));
      for (let c = 0; c < 16; c++) {
        const th = Math.PI / 16 + (c * Math.PI) / 8;
        const sx = Math.sin(th), sz = Math.cos(th);
        units.push(new THREE.BoxGeometry(0.08, 0.12, 0.2).rotateY(th).translate(sx * rr * 1.13, y - 0.12, sz * rr * 1.13));
        units.push(new THREE.BoxGeometry(0.26, 0.045, 0.06).rotateY(th).translate(sx * rr * 1.2, y - 0.085, sz * rr * 1.2));
        for (const e of [-1, 1]) units.push(new THREE.BoxGeometry(0.055, 0.05, 0.07).rotateY(th).translate(sx * rr * 1.2 + Math.cos(th) * e * 0.11, y - 0.045, sz * rr * 1.2 - Math.sin(th) * e * 0.11));
      }
      y += 0.26;
    }
    g.add(mesh(mergeGeometries(bands.map((b) => b.toNonIndexed()))!, bandMat, false));
    g.add(mesh(mergeGeometries(units.map((b) => b.toNonIndexed()))!, M.green, false));
    // 塔刹：刹座 → 覆钵 → 九重相轮（往上渐小）→ 宝盖（下挂八个小铃）→ 仰月、宝珠；宝盖向顶层八个檐角各垂一条铁链
    const spire = new THREE.Group();
    const sp: THREE.BufferGeometry[] = [];
    sp.push(lathe([[0, 0], [0.44, 0], [0.44, 0.07], [0.35, 0.11], [0.35, 0.19], [0.41, 0.23], [0.41, 0.28], [0, 0.28]], 16));
    sp.push(lathe([[0, 0.28], [0.37, 0.28], [0.39, 0.36], [0.35, 0.48], [0.25, 0.58], [0.1, 0.63], [0, 0.64]], 16));
    sp.push(new THREE.CylinderGeometry(0.045, 0.05, 1.8, 8).translate(0, 1.5, 0));
    for (let k = 0; k < 9; k++) {
      const r = 0.27 - k * 0.016;
      sp.push(new THREE.CylinderGeometry(r, r, 0.05, 18).translate(0, 0.74 + k * 0.12, 0));
    }
    const capY = 1.9;
    sp.push(new THREE.ConeGeometry(0.34, 0.13, 16, 1, true).translate(0, capY + 0.065, 0));
    sp.push(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16).translate(0, capY, 0));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      sp.push(new THREE.ConeGeometry(0.03, 0.07, 8).translate(Math.sin(a) * 0.32, capY - 0.06, Math.cos(a) * 0.32));
    }
    sp.push(new THREE.TorusGeometry(0.11, 0.022, 6, 16, Math.PI).rotateZ(Math.PI).translate(0, capY + 0.32, 0));
    sp.push(lathe([[0, 0], [0.06, 0], [0.1, 0.06], [0.08, 0.13], [0.04, 0.16], [0.08, 0.21], [0.09, 0.27], [0.05, 0.33], [0, 0.35]], 14).translate(0, capY + 0.38, 0));
    spire.add(mesh(mergeGeometries(sp.map((x) => (x.index ? x.toNonIndexed() : x)))!, M.gold));
    spire.position.y = y;
    g.add(spire);
    {
      // 铁链：从宝盖边沿垂到顶层屋檐的八个角，中间略往下坠
      const rrTop = 1.3 * (1 - 6 * 0.075);
      const eaveY = y - 0.26 + 0.1 - 0.16 + 0.12;
      const chains: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const A = new THREE.Vector3(Math.sin(a) * 0.32, y + capY, Math.cos(a) * 0.32);
        const B = new THREE.Vector3(Math.sin(a) * rrTop * 1.5, eaveY, Math.cos(a) * rrTop * 1.5);
        const C = A.clone().lerp(B, 0.5);
        C.y -= 0.35;
        chains.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, C, B), 14, 0.012, 4, false));
      }
      g.add(mesh(mergeGeometries(chains)!, chainMat, false));
    }
    {
      const lamps = new THREE.InstancedMesh(pagodaLampGeo, pagodaLampMat, lampAt.length);
      const m4 = new THREE.Matrix4();
      lampAt.forEach((p, i) => lamps.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
      g.add(lamps);
    }
    // 塔门：两扇格扇门，外面一圈朱红门框
    {
      const ap = 1.3 * Math.cos(Math.PI / 8) + 0.01;
      const ox = Math.sin(doorTh), oz = Math.cos(doorTh);
      const tx = Math.cos(doorTh), tz = -Math.sin(doorTh);
      for (const side of [-1, 1]) {
        const leaf = mesh(new THREE.PlaneGeometry(0.4, 1.25), doorMat, false);
        leaf.position.set(ox * ap + tx * side * 0.205, 0.7 + 0.625, oz * ap + tz * side * 0.205);
        leaf.rotation.y = doorTh;
        g.add(leaf);
      }
      const frame = new THREE.Group();
      for (const [w, h, x, y] of [[0.08, 1.38, -0.45, 0.69], [0.08, 1.38, 0.45, 0.69], [0.98, 0.1, 0, 1.33]] as [number, number, number, number][]) {
        const b = mesh(worldBox(w, h, 0.06, 1), M.red, false);
        b.position.set(x, 0.7 + y, 0);
        frame.add(b);
      }
      frame.position.set(ox * ap, 0, oz * ap);
      frame.rotation.y = doorTh;
      g.add(frame);
      // 门前石阶：从塔基外沿往外三级
      for (let st = 0; st < 3; st++) {
        const h = 0.7 * (3 - st) / 3;
        const step = mesh(worldBox(1.3, h, 0.2, 1), stoneMat);
        const r = 2.12 + st * 0.2;
        step.position.set(ox * r, h / 2, oz * r);
        step.rotation.y = doorTh;
        g.add(step);
      }
    }
    g.rotation.y = Math.PI / 8;
    g.scale.setScalar(P.s * 0.75);
    g.position.set(P.x, 0, P.z);
    g.traverse((o) => (o.userData.interact = { type: 'pagoda', i: pi }));
    interactives.push(g);
    group.add(g);
  }

  // —— 院中铜鼎香炉：青铜三足鼎（立耳、扉棱、兽面足、铭文），立在八角石座上；两旁是阶梯烛台 ——
  const ding = buildDing({ front: '靜山禪寺', back: '風調雨順', base: true, stoneMat, stubs: 80 });
  const burner = ding.group;
  burner.position.set(INCENSE.x, 0.18, INCENSE.z);
  burner.traverse((o) => (o.userData.interact = { type: 'incense' }));
  group.add(burner);
  interactives.push(burner);
  const yardIncense = new IncenseSpot(group, INCENSE.x, 0.18 + ding.ashY, INCENSE.z, 0.68, 24, 0.45);
  const flames: THREE.Mesh[] = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.3, 0.55) });
  const candleMat = new THREE.MeshStandardMaterial({ color: '#b3201a', roughness: 0.45, emissive: '#3a0805', emissiveIntensity: 0.5 });
  const waxMat = new THREE.MeshStandardMaterial({ color: '#d0392c', roughness: 0.35, emissive: '#3a0805', emissiveIntensity: 0.4 });
  // 烛台架：旧黄铜，被烟熏得发暗
  const ironMat = new THREE.MeshStandardMaterial({ color: '#6a5232', metalness: 0.7, roughness: 0.48 });
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,214,140,0.9)');
    grd.addColorStop(0.35, 'rgba(255,170,80,0.35)');
    grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const sx of [-1, 1]) {
    // 三层阶梯式铜烛台：每层一道接蜡的铜槽，红烛高低错落，烛泪挂在烛身上
    const rack = new THREE.Group();
    const frame: THREE.BufferGeometry[] = [];
    for (const lx of [-0.86, 0.86]) {
      const side = new THREE.Shape();
      side.moveTo(-0.3, 0);
      side.lineTo(0.3, 0);
      side.lineTo(0.3, 0.12);
      side.lineTo(0.18, 0.78);
      side.lineTo(0.02, 0.98);
      side.lineTo(-0.14, 1.18);
      side.lineTo(-0.3, 1.2);
      side.closePath();
      const eg = new THREE.ExtrudeGeometry(side, { depth: 0.04, bevelEnabled: false });
      eg.rotateY(-Math.PI / 2);
      eg.translate(lx + 0.02, 0, 0);
      frame.push(eg.toNonIndexed());
    }
    const tiers = [
      { y: 0.76, z: 0.17 },
      { y: 0.96, z: 0.0 },
      { y: 1.16, z: -0.17 },
    ];
    for (const t of tiers) {
      frame.push(new THREE.BoxGeometry(1.72, 0.035, 0.2).translate(0, t.y, t.z).toNonIndexed());
      frame.push(new THREE.BoxGeometry(1.72, 0.07, 0.02).translate(0, t.y + 0.02, t.z + 0.1).toNonIndexed());
    }
    rack.add(mesh(mergeGeometries(frame)!, ironMat));
    const trays: THREE.BufferGeometry[] = [];
    const candles: THREE.BufferGeometry[] = [];
    const drips: THREE.BufferGeometry[] = [];
    tiers.forEach((t, ti) => {
      trays.push(new THREE.BoxGeometry(1.66, 0.012, 0.17).translate(0, t.y + 0.024, t.z).toNonIndexed());
      for (let k = 0; k < 8; k++) {
        const h = 0.1 + r() * 0.22 - ti * 0.02;
        const x = -0.72 + k * 0.205 + (r() - 0.5) * 0.04;
        const z = t.z + (r() - 0.5) * 0.06;
        const y0 = t.y + 0.03;
        candles.push(new THREE.CylinderGeometry(0.026, 0.028, h, 10).translate(x, y0 + h / 2, z).toNonIndexed());
        // 顶上一圈熔开的蜡，身上两三道烛泪
        drips.push(new THREE.TorusGeometry(0.024, 0.007, 5, 12).rotateX(Math.PI / 2).translate(x, y0 + h - 0.004, z).toNonIndexed());
        for (let d = 0; d < 2; d++) {
          const a = r() * Math.PI * 2, dl = 0.03 + r() * 0.06;
          drips.push(new THREE.CapsuleGeometry(0.006, dl, 3, 5).translate(x + Math.cos(a) * 0.027, y0 + h - dl / 2 - 0.01, z + Math.sin(a) * 0.027).toNonIndexed());
        }
        drips.push(new THREE.CylinderGeometry(0.04, 0.045, 0.008, 10).translate(x, y0 + 0.004, z).toNonIndexed());
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), flameMat);
        fl.scale.set(1, 2.2, 1);
        fl.position.set(x, y0 + h + 0.035, z);
        rack.add(fl);
        flames.push(fl);
        const glow = new THREE.Sprite(glowMat);
        glow.scale.setScalar(0.16);
        glow.position.copy(fl.position);
        rack.add(glow);
      }
    });
    rack.add(mesh(mergeGeometries(trays)!, M.bronze, false));
    rack.add(mesh(mergeGeometries(candles)!, candleMat, false));
    rack.add(mesh(mergeGeometries(drips)!, waxMat, false));
    rack.position.set(INCENSE.x + sx * 2.6, 0, INCENSE.z - 0.4);
    group.add(rack);
  }

  // —— 石凳：一块倒了圆角的石板，架在两只整块雕出的须弥座凳脚上；所有石凳合成一个网格 ——
  {
    const slab = new RoundedBoxGeometry(2.2, 0.11, 0.5, 3, 0.03).toNonIndexed();
    boxUV(slab);
    slab.translate(0, 0.415, 0);
    // 凳脚轮廓 [高度, 比外框内收]：圭脚、下枭、束腰、上枭、上枋，上枋顶到石板底 0.36
    const legProf: [number, number][] = [
      [0, 0], [0.05, 0], [0.05, 0.014], [0.064, 0.02], [0.078, 0.031], [0.094, 0.041], [0.11, 0.047], [0.11, 0.056],
      [0.25, 0.056], [0.25, 0.047], [0.266, 0.041], [0.282, 0.031], [0.296, 0.02], [0.31, 0.014], [0.31, 0], [0.36, 0],
    ];
    const leg = carvedBlock(0.17, 0.23, legProf);
    const parts: THREE.BufferGeometry[] = [];
    const m4 = new THREE.Matrix4();
    for (const b of [...BENCHES, ...NPC_BENCHES]) {
      m4.makeRotationY(b.yaw).setPosition(b.x, 0, b.z);
      parts.push(slab.clone().applyMatrix4(m4));
      for (const lx of [-0.78, 0.78]) parts.push(leg.clone().translate(lx, 0, 0).applyMatrix4(m4));
    }
    group.add(mesh(mergeGeometries(parts)!, stoneMat));
  }
  for (const s of BENCH_SEATS) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 0.75), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.x, 0.45, s.z);
    hit.rotation.y = s.yaw;
    hit.userData.interact = { type: 'seat', id: s.id };
    group.add(hit);
    interactives.push(hit);
  }

  // —— 放生池上的石拱桥（带白石栏杆）——
  {
    const len = BRIDGE.z1 - BRIDGE.z0;
    const w = BRIDGE.x1 - BRIDGE.x0;
    const seg = 24;
    const deck: number[] = [];
    const idx: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const z = BRIDGE.z0 + t * len;
      const y = BRIDGE.h * Math.sin(t * Math.PI);
      deck.push(BRIDGE.x0, y + 0.02, z, BRIDGE.x1, y + 0.02, z);
      uv.push(0, t * len, w, t * len);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(deck, 3));
    dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    dg.setIndex(idx);
    dg.computeVertexNormals();
    const deckMat = stoneClone(THREE.DoubleSide);
    const deckMesh = mesh(dg, deckMat);
    deckMesh.name = 'walkable';
    group.add(deckMesh);
    const sideMat = stoneClone(THREE.DoubleSide);
    // 桥洞半径不能高过桥面（原来的半圆顶到了桥面上方）
    const archR = Math.min(len * 0.18, BRIDGE.h + 0.8 - 0.4);
    for (const x of [BRIDGE.x0, BRIDGE.x1]) {
      const s = new THREE.Shape();
      s.moveTo(0, -0.8);
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        s.lineTo(t * len, BRIDGE.h * Math.sin(t * Math.PI) + 0.02);
      }
      s.lineTo(len, -0.8);
      s.closePath();
      const hole = new THREE.Path();
      hole.absarc(len / 2, -0.8, archR, 0, Math.PI, false);
      hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ShapeGeometry(s, 24);
      g.rotateY(-Math.PI / 2);
      const side = mesh(g, sideMat);
      side.position.set(x, 0, BRIDGE.z0);
      group.add(side);
      // 拱券：桥洞外沿一圈券石，略凸出桥身
      const ring = new THREE.RingGeometry(archR, archR + 0.3, 32, 1, 0, Math.PI);
      ring.rotateY(-Math.PI / 2);
      const arch = mesh(ring, M.marbleSide, false);
      arch.position.set(x + (x < 0 ? -0.03 : 0.03), -0.8, BRIDGE.z0 + len / 2);
      arch.material = (M.marbleSide as THREE.MeshStandardMaterial).clone();
      (arch.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      group.add(arch);
    }
    // 白石栏杆，和大殿台基上的一样：莲花柱头的望柱、地栿、浮雕栏板、宝瓶、圆扶手；栏板顺着桥拱倾斜。两头各一对抱鼓石
    const rail: THREE.BufferGeometry[] = [];
    const panels: THREE.BufferGeometry[] = [];
    const lotusHead = lathe([[0, 0], [0.11, 0], [0.115, 0.03], [0.09, 0.055], [0.12, 0.09], [0.125, 0.12], [0.1, 0.155], [0.115, 0.18], [0.08, 0.235], [0.045, 0.27], [0, 0.29]], 12);
    const vase = lathe([[0, 0], [0.045, 0], [0.035, 0.025], [0.058, 0.09], [0.062, 0.13], [0.04, 0.19], [0.028, 0.225], [0.045, 0.25], [0.05, 0.27], [0, 0.27]], 10);
    const N = 8;
    const yAt = (t: number) => BRIDGE.h * Math.sin(t * Math.PI);
    const clean = (g: THREE.BufferGeometry) => {
      const x = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
      return x;
    };
    for (const x of [BRIDGE.x0 + 0.1, BRIDGE.x1 - 0.1]) {
      for (let i = 0; i <= N; i++) {
        const t = i / N, z = BRIDGE.z0 + t * len, y = yAt(t);
        const p = worldBox(0.18, 0.78, 0.18, 1);
        p.translate(x, y + 0.39, z);
        rail.push(p);
        const collar = worldBox(0.22, 0.05, 0.22, 1);
        collar.translate(x, y + 0.8, z);
        rail.push(collar);
        rail.push(lotusHead.clone().translate(x, y + 0.82, z));
        if (i === N) continue;
        const t2 = (i + 1) / N, zb = BRIDGE.z0 + t2 * len, y2 = yAt(t2);
        const segLen = Math.hypot(zb - z, y2 - y), th = Math.atan2(y2 - y, zb - z);
        const my = (y + y2) / 2, mz = (z + zb) / 2;
        const along = (g: THREE.BufferGeometry, lift: number) => g.rotateX(-th).translate(x, my + lift, mz);
        rail.push(along(worldBox(0.2, 0.08, segLen - 0.16, 1), 0.04));
        panels.push(along(new THREE.BoxGeometry(0.09, 0.34, segLen - 0.2), 0.27));
        rail.push(along(worldBox(0.13, 0.04, segLen - 0.18, 1), 0.46));
        for (const f of [0.3, 0.7]) {
          const tf = t + (t2 - t) * f;
          rail.push(vase.clone().translate(x, yAt(tf) + 0.48, BRIDGE.z0 + tf * len));
        }
        const bar = new THREE.CylinderGeometry(0.045, 0.045, segLen - 0.18, 10);
        bar.rotateX(Math.PI / 2 - th);
        bar.translate(x, my + 0.75, mz);
        rail.push(bar);
      }
      // 抱鼓石：桥头栏杆末端的一块石座，上面立一面圆鼓，朝外
      for (const [z, dir] of [[BRIDGE.z0 - 0.42, -1], [BRIDGE.z1 + 0.42, 1]] as [number, number][]) {
        const base = worldBox(0.2, 0.32, 0.72, 1);
        base.translate(x, 0.16, z);
        rail.push(base);
        const drum = new THREE.CylinderGeometry(0.27, 0.27, 0.16, 24).rotateZ(Math.PI / 2);
        drum.translate(x, 0.32 + 0.24, z + dir * 0.06);
        rail.push(drum);
        const curl = new THREE.TorusGeometry(0.1, 0.035, 8, 16).rotateY(Math.PI / 2);
        curl.translate(x, 0.4, z - dir * 0.24);
        rail.push(curl);
      }
    }
    group.add(mesh(mergeGeometries(rail.map(clean))!, M.marble));
    group.add(mesh(mergeGeometries(panels.map(clean))!, M.relief));
  }

  // —— 黄色寺墙（灰瓦顶）——
  // 墙：下面一段乱石砌的墙基（下碱），上面黄墙身，墙顶两道砖檐、两坡灰瓦的墙帽和一道正脊
  const wallMat = pbr('plaster', { metersPerTile: 2.6, color: '#d9a548' });
  // 墙身：雨痕和斑驳比原来重一些，看得出是多年的老墙
  aged(wallMat, 0.08, 0.4);
  const baseMat = pbr('stonewall', { metersPerTile: 1.6, color: '#c9c1b2' });
  aged(baseMat, 0.1, 0.25);
  const capMat = pbr('roof', { metersPerTile: 1.2, color: '#6e7270' });
  const brickMat = new THREE.MeshStandardMaterial({ color: '#6a6c68', roughness: 0.9 });
  const addWall = (xa: number, za: number, xb: number, zb: number) => {
    const len = Math.hypot(xb - xa, zb - za);
    const ang = Math.atan2(zb - za, xb - xa);
    const put = (m: THREE.Mesh, y: number, rx = 0, dz = 0) => {
      // dz：往墙的一侧偏（墙的法线方向）
      m.position.set((xa + xb) / 2 - Math.sin(ang) * dz, y, (za + zb) / 2 + Math.cos(ang) * dz);
      m.rotation.set(rx, -ang, 0, 'YXZ');
      group.add(m);
    };
    put(mesh(worldBox(len, 0.85, 0.62, 1), baseMat), 0.425);
    put(mesh(worldBox(len, 1.45, 0.5, 1), wallMat), 0.85 + 0.725);
    put(mesh(worldBox(len, 0.1, 0.62, 1), brickMat), 2.35);
    put(mesh(worldBox(len, 0.08, 0.74, 1), brickMat), 2.44);
    // 两坡瓦面：各一块薄板往外斜下去，出檐盖过砖檐
    const slope = Math.atan2(0.26, 0.46);
    for (const s of [-1, 1]) put(mesh(worldBox(len, 0.05, 0.56, 1), capMat), 2.62, s * slope, s * 0.24);
    const ridge = mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8).rotateZ(Math.PI / 2), brickMat);
    put(ridge, 2.76);
    // 墙帽两坡铺真筒瓦，檐口一排瓦当（和殿顶同一套做法）
    const tiles = new THREE.Group();
    const half = len / 2;
    const face = (sgn: number): SlopeFn => (u, v) => [u * half, 2.5 + 0.27 * v, sgn * 0.5 * (1 - v), u * half, v * 0.56];
    addTileRuns(tiles, [[face(1), () => half], [face(-1), () => half]]);
    tiles.position.set((xa + xb) / 2, 0, (za + zb) / 2);
    tiles.rotation.y = -ang;
    group.add(tiles);
  };
  // 圆形花窗（冰裂纹），墙两面各一扇：砖色窗框 + 深色窗芯；离殿阁、茶寮、山门太近的墙段不开
  const latticeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2f302d';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#a9a69c';
    g.lineWidth = 7;
    g.lineCap = 'round';
    const R = rng(77);
    // 冰裂纹：从几处散开的折线
    const pts: [number, number][] = [];
    for (let i = 0; i < 26; i++) pts.push([R() * 256, R() * 256]);
    for (const [x, y] of pts) {
      let best: [number, number][] = pts.filter((p) => p[0] !== x || p[1] !== y).sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y)).slice(0, 3);
      for (const [bx, by] of best) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(bx, by);
        g.stroke();
      }
      best = [];
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const winSpots: { x: number; z: number; yaw: number }[] = [];
  const winAlong = (xa: number, za: number, xb: number, zb: number, skip: (x: number, z: number) => boolean) => {
    const len = Math.hypot(xb - xa, zb - za);
    const n = Math.floor(len / 12);
    for (let i = 1; i < n; i++) {
      const tt = i / n;
      const x = xa + (xb - xa) * tt, z = za + (zb - za) * tt;
      if (!skip(x, z)) winSpots.push({ x, z, yaw: -Math.atan2(zb - za, xb - xa) });
    }
  };

  const { x0, x1, z0, z1, gateX } = COURT;
  addWall(x0, z0, x1, z0);
  addWall(x0, z0, x0, z1);
  addWall(x1, z0, x1, z1);
  addWall(x0, z1, -gateX - 2.4, z1);
  addWall(gateX + 2.4, z1, x1, z1);
  winAlong(x0, z0, x1, z0, (x) => Math.abs(x) < 9);
  winAlong(x0, z0, x0, z1, (_, z) => Math.abs(z - (-4)) < 11);
  winAlong(x1, z0, x1, z1, (_, z) => Math.abs(z - (-4)) < 11 || (z > 40 && z < 58));
  winAlong(x0, z1, -gateX - 2.4, z1, (x) => x > -10);
  winAlong(gateX + 2.4, z1, x1, z1, (x) => x < 10);
  {
    const frame = new THREE.InstancedMesh(new THREE.RingGeometry(0.46, 0.56, 40), new THREE.MeshStandardMaterial({ color: '#7d7a72', roughness: 0.85 }), winSpots.length * 2);
    const core = new THREE.InstancedMesh(new THREE.CircleGeometry(0.46, 40), new THREE.MeshStandardMaterial({ map: latticeTex, roughness: 0.9 }), winSpots.length * 2);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3();
    winSpots.forEach((w, i) => {
      for (const side of [0, 1]) {
        const yaw = w.yaw + (side ? Math.PI : 0);
        qq.setFromEuler(new THREE.Euler(0, yaw, 0));
        // 墙身厚 0.5，花窗贴在两面外 1 厘米
        pp.set(w.x + Math.sin(yaw) * 0.262, 1.6, w.z + Math.cos(yaw) * 0.262);
        m4.compose(pp, qq, one);
        frame.setMatrixAt(i * 2 + side, m4);
        core.setMatrixAt(i * 2 + side, m4);
      }
    });
    frame.receiveShadow = core.receiveShadow = true;
    group.add(frame, core);
  }

  // —— 山门：三开间，朱红柱，彩画梁，带鸱吻的屋顶，挂寺名匾 ——
  {
    const g = new THREE.Group();
    const xs = [-gateX - 2.2, -gateX, gateX, gateX + 2.2];
    const colH = 4.6;
    for (const x of xs) {
      const c = mesh(meterUV(new THREE.CylinderGeometry(0.27, 0.3, colH, 16), 1.8, colH), M.red);
      c.position.set(x, colH / 2, z1);
      g.add(c);
      const p = mesh(lathe([[0, 0], [0.48, 0], [0.48, 0.06], [0.38, 0.2], [0, 0.2]], 16), M.marble);
      p.position.set(x, 0, z1);
      g.add(p);
    }
    for (const s of [-1, 1]) {
      const w = mesh(worldBox(1.8, colH - 0.3, 0.4, 1), M.redWall);
      w.position.set(s * (gateX + 1.1), (colH - 0.3) / 2, z1);
      g.add(w);
    }
    beamRing(g, 0, z1, gateX + 2.2, 0.6, colH, M, 0.9, false);
    // 中间一对朱漆大门：门钉九路、铺首衔环，往院里开着；门轴下垫门枕石
    // 一扇门铺一整张门面贴图；右扇左右镜像，让两边的铺首都靠在门缝一侧
    const doorTex = gateDoorTexture();
    const doorW = gateX - 0.2, doorH = colH - 0.45;
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * (gateX - 0.12), 0, z1 - 0.12);
      const tex = doorTex.clone();
      if (s > 0) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1;
      }
      tex.needsUpdate = true;
      const leaf = mesh(new THREE.BoxGeometry(doorW, doorH, 0.12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
      leaf.position.set(-s * doorW / 2, doorH / 2, 0);
      pivot.add(leaf);
      pivot.rotation.y = s * -1.25;
      g.add(pivot);
      const pier = mesh(worldBox(0.36, 0.38, 0.9, 1), stoneMat);
      pier.position.set(s * (gateX - 0.12), 0.19, z1);
      g.add(pier);
    }
    g.add(buildRoof({ cx: 0, cz: z1, W: gateX + 4.0, D: 2.4, rx: gateX + 1.2, eaveY: colH + 1.15, ridgeY: colH + 3.0, lift: 0.7, ornate: true }));
    const pw = 3.6;
    const ph = pw * (340 / (260 * 4 + 140));
    const plaque = mesh(new THREE.BoxGeometry(pw, ph, 0.12), [M.gold, M.gold, M.gold, M.gold, new THREE.MeshStandardMaterial({ map: plaqueTexture('靜山禪寺'), roughness: 0.5, metalness: 0.2 }), M.redDark]);
    plaque.position.set(0, colH - 0.75, z1 + 0.3);
    g.add(plaque);
    // 院里那一面：「解脫門」（山门即三解脱门）
    const pw2 = 2.8;
    const inner = mesh(new THREE.BoxGeometry(pw2, pw2 * (340 / (260 * 3 + 140)), 0.12), [M.gold, M.gold, M.gold, M.gold, new THREE.MeshStandardMaterial({ map: plaqueTexture('解脫門'), roughness: 0.5, metalness: 0.2 }), M.redDark]);
    inner.position.set(0, colH - 0.75, z1 - 0.3);
    inner.rotation.y = Math.PI;
    g.add(inner);
    group.add(g);
  }

  scene.add(group);

  return {
    interactives,
    setLanternLevel(level) {
      night.setLevel(level);
      pagodaLampMat.emissiveIntensity = 0.1 + Math.max(0, (level - 0.6) / 1.8) * 1.3;
      // 夜里不要太亮：太亮了灯笼中心发白，和红光叠在一起看着像粉色
      lanternMat.emissiveIntensity = 0.25 + level * 0.42;
      silk.emissiveIntensity = 0.12 + Math.min(level, 2.4) * 0.38;
      for (const l of pathLights) l.intensity = Math.max(0, level - 0.8) * 7;
    },
    setIncense(list) {
      yardIncense.set(list);
    },
    update(dt, t) {
      yardIncense.update(dt, t);
      for (const [i, f] of flames.entries()) f.scale.set(1, 2.2 + Math.sin(t * 9 + i * 1.7) * 0.3, 1);
    },
  };
}
