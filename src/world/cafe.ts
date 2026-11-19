// 半山咖啡：东院一座三开间的茶寮。朱红柱、灰瓦四坡顶，檐下「半山咖啡」金匾，两根中柱挂一副对联；
// 厅里后墙前一整排吧台：咖啡机、两台磨豆机、手冲架、点心柜、一摞摞纸杯，墙上三块菜单牌、木架上一排豆罐；
// 两侧山墙开格子窗，窗边各一张小桌。厅前一片木平台，四张小圆桌各撑一把油纸伞；
// 平台角上竹竿挑着「咖啡」布幌子、一只半人高的大纸杯收空杯，入口旁立菜单木牌；前檐挂一排纸灯笼，夜里亮。
import * as THREE from 'three';
import { loadProp } from './glb';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAFE, CAFE_TABLE_LOCAL, CAFE_SEATS, CAFE_COLS, cafeWorld } from '../layout';
import { plaqueTexture } from '../textures';
import { mesh, worldBox, lathe } from './util';
import { buildRoof, chineseMats, meterUV, aged } from './hall';
import { pbr } from './pbr';

export interface CafeBuild {
  interactives: THREE.Object3D[];
  setBrewing(on: boolean): void;
  setLanternLevel(level: number): void;
  update(dt: number, t: number): void;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}
const KAI = '"Kaiti TC", "Kaiti SC", "STKaiti", "BiauKai", "KaiTi", serif';

// 菜单木牌：深色木板，米白字，下面一方朱印
function menuTexture() {
  return canvasTex(512, 800, (g) => {
    const bg = g.createLinearGradient(0, 0, 512, 800);
    bg.addColorStop(0, '#3a2a1f');
    bg.addColorStop(1, '#2c1f17');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 800);
    for (let k = 0; k < 90; k++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '120,90,60'},${0.08 + Math.random() * 0.1})`;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const y = Math.random() * 800;
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + (Math.random() - 0.5) * 20, 340, y + (Math.random() - 0.5) * 20, 512, y + (Math.random() - 0.5) * 14);
      g.stroke();
    }
    g.strokeStyle = 'rgba(232,214,170,0.55)';
    g.lineWidth = 3;
    g.strokeRect(22, 22, 468, 756);
    g.fillStyle = '#efe3c4';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 64px ${KAI}`;
    g.fillText('半山咖啡', 256, 100);
    g.fillStyle = 'rgba(239,227,196,0.5)';
    g.fillRect(150, 150, 212, 2);
    g.fillStyle = '#efe3c4';
    g.font = `46px ${KAI}`;
    ['山霧拿鐵', '清醒美式', '上岸冷萃', '桂花拿鐵', '放下 · 低因'].forEach((s, i) => g.fillText(s, 256, 232 + i * 92));
    g.fillStyle = 'rgba(239,227,196,0.7)';
    g.font = `34px ${KAI}`;
    g.fillText('— 一 杯 三 口 —', 256, 712);
  });
}

// 布幌子：米白粗布，朱红宽边，竖写「咖啡」
function flagTexture() {
  return canvasTex(256, 640, (g) => {
    g.fillStyle = '#efe6d2';
    g.fillRect(0, 0, 256, 640);
    for (let k = 0; k < 1400; k++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.3)';
      g.fillRect(Math.random() * 256, Math.random() * 640, 1, 2 + Math.random() * 4);
    }
    g.fillStyle = '#9e2a1e';
    g.fillRect(0, 0, 256, 26);
    g.fillRect(0, 0, 18, 640);
    g.fillRect(238, 0, 18, 640);
    // 下摆的三角牙子
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(k * 64, 600);
      g.lineTo(k * 64 + 32, 640);
      g.lineTo(k * 64 + 64, 600);
      g.fill();
    }
    g.fillRect(0, 590, 256, 12);
    g.fillStyle = '#1d1712';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 150px ${KAI}`;
    g.fillText('咖', 128, 190);
    g.fillText('啡', 128, 390);
  });
}


// 大纸杯回收桶的杯套：牛皮纸色，一圈印「半山咖啡」和「空杯回收 · 下次再来」，中间一方小红印
function binSleeveTexture() {
  const tx = canvasTex(1024, 256, (g) => {
    g.fillStyle = '#b98a5a';
    g.fillRect(0, 0, 1024, 256);
    for (let k = 0; k < 1600; k++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.12)';
      g.fillRect(Math.random() * 1024, Math.random() * 256, 1 + Math.random() * 5, 1);
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const x of [256, 768]) {
      g.fillStyle = '#2e2018';
      g.font = `700 78px ${KAI}`;
      g.fillText('半山咖啡', x, 100);
      g.font = `40px ${KAI}`;
      g.fillStyle = '#3d2a1f';
      g.fillText('空杯回收 · 下次再来', x, 180);
    }
    g.fillStyle = '#a8261c';
    for (const x of [512, 0, 1024]) g.fillRect(x - 22, 106, 44, 44);
  });
  tx.wrapS = THREE.RepeatWrapping;
  return tx;
}

// 热气：一团柔和的白
function puffTexture() {
  return canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });
}

// 墙上的菜单牌：深色木板、米白字，标题下一道细线
function boardTexture(title: string, lines: string[]) {
  return canvasTex(512, 640, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 640);
    bg.addColorStop(0, '#33251b');
    bg.addColorStop(1, '#271b14');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 640);
    g.strokeStyle = 'rgba(232,214,170,0.45)';
    g.lineWidth = 3;
    g.strokeRect(18, 18, 476, 604);
    g.fillStyle = '#efe3c4';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 58px ${KAI}`;
    g.fillText(title, 256, 92);
    g.fillStyle = 'rgba(239,227,196,0.5)';
    g.fillRect(166, 142, 180, 2);
    g.fillStyle = '#efe3c4';
    g.font = `44px ${KAI}`;
    const gap = Math.min(92, 440 / lines.length);
    lines.forEach((s, i) => g.fillText(s, 256, 205 + i * gap));
  });
}
// 柱上的对联：深色木板，金字竖写
function coupletTexture(text: string) {
  const chars = [...text];
  return canvasTex(128, 110 * chars.length + 60, (g) => {
    g.fillStyle = '#2f2219';
    g.fillRect(0, 0, 128, 110 * chars.length + 60);
    g.strokeStyle = 'rgba(216,184,106,0.6)';
    g.lineWidth = 4;
    g.strokeRect(8, 8, 112, 110 * chars.length + 44);
    g.fillStyle = '#dcbd70';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 84px ${KAI}`;
    chars.forEach((ch, i) => g.fillText(ch, 64, 85 + i * 110));
  });
}
// 油纸伞面：一种底色，一圈圈伞骨和描边
function parasolTexture(color: string) {
  return canvasTex(512, 128, (g) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 512, 128);
    const sh = g.createLinearGradient(0, 0, 0, 128);
    sh.addColorStop(0, 'rgba(255,255,255,0.12)');
    sh.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = sh;
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = 'rgba(40,20,10,0.35)';
    g.lineWidth = 2;
    for (let k = 0; k < 24; k++) {
      g.beginPath();
      g.moveTo((k * 512) / 24, 0);
      g.lineTo((k * 512) / 24, 128);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,240,210,0.55)';
    g.fillRect(0, 104, 512, 6);
    g.fillRect(0, 30, 512, 3);
  });
}
// 平台的木地板：一条条木板，接缝深一点
function plankTexture() {
  const t = canvasTex(256, 256, (g) => {
    for (let k = 0; k < 8; k++) {
      const l = 36 + Math.random() * 10;
      g.fillStyle = `hsl(26, ${30 + Math.random() * 10}%, ${l}%)`;
      g.fillRect(0, k * 32, 256, 32);
      for (let n = 0; n < 30; n++) {
        g.fillStyle = 'rgba(40,20,10,0.08)';
        g.fillRect(Math.random() * 256, k * 32 + Math.random() * 30, 20 + Math.random() * 60, 1);
      }
      g.fillStyle = 'rgba(30,15,8,0.55)';
      g.fillRect(0, k * 32, 256, 2);
      g.fillRect(((k * 97) % 200) + 20, k * 32, 2, 32);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCafe(scene: THREE.Scene): CafeBuild {
  const M = chineseMats();
  const g = new THREE.Group();
  g.position.set(CAFE.x, 0, CAFE.z);
  g.rotation.y = CAFE.yaw;
  scene.add(g);
  const interactives: THREE.Object3D[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const b = CAFE.base, HW = CAFE.hw, HD = CAFE.hd, colH = CAFE.colH;
  const darkWood = std({ color: '#4a3020', roughness: 0.72 });
  const wood = std({ color: '#6e4a30', roughness: 0.66 });
  const walnut = std({ color: '#3b281c', roughness: 0.45 });
  const black = std({ color: '#1e1c1a', roughness: 0.5 });
  const steel = std({ color: '#c9c9c4', metalness: 0.9, roughness: 0.28 });
  const brass = std({ color: '#b98a42', metalness: 0.9, roughness: 0.32 });
  const glass = std({ color: '#e8f2f2', transparent: true, opacity: 0.3, roughness: 0.08, depthWrite: false });
  const beans = std({ color: '#3a2216', roughness: 0.9 });
  const paperCup = std({ color: '#f2eee6', roughness: 0.8 });

  // —— 厅的台基（青灰条石）和平台（木地板） ——
  const platTop = pbr('granite', { metersPerTile: 1.1, color: new THREE.Color().setRGB(2.6, 2.5, 2.35) });
  const platSide = pbr('granite', { metersPerTile: 0.9, color: new THREE.Color().setRGB(2.2, 2.12, 1.98) });
  aged(platTop, 0.1, 0.28);
  aged(platSide, 0.1, 0.32);
  const plat = mesh(worldBox(HW * 2, b, HD * 2, 1), [platSide, platSide, platTop, platTop, platSide, platSide]);
  plat.position.y = b / 2;
  g.add(plat);
  const deckLen = CAFE.deck - HD;
  const plank = plankTexture();
  plank.repeat.set((HW * 2) / 2.2, deckLen / 2.2);
  const deckTop = std({ map: plank, roughness: 0.8 });
  const deck = mesh(new THREE.BoxGeometry(HW * 2, b, deckLen), [darkWood, darkWood, deckTop, darkWood, darkWood, darkWood]);
  deck.position.set(0, b / 2, HD + deckLen / 2);
  g.add(deck);
  // 平台两侧的矮木栏
  for (const sx of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(0.08, 0.06, deckLen - 1.2), wood);
    rail.position.set(sx * (HW - 0.06), b + 0.62, HD + deckLen / 2 - 0.3);
    g.add(rail);
    for (let k = 0; k <= 4; k++) {
      const post = mesh(new THREE.BoxGeometry(0.08, 0.64, 0.08), darkWood);
      post.position.set(sx * (HW - 0.06), b + 0.32, HD + 0.3 + (k / 4) * (deckLen - 1.2));
      g.add(post);
    }
  }
  // 吧台里的木踏板
  const innerD = CAFE.bar - 0.6 + HD; // 从后墙到吧台背面
  const inner = mesh(new THREE.BoxGeometry(8.0, CAFE.inner, innerD), std({ color: '#5e4330', roughness: 0.8 }));
  inner.position.set(0, b + CAFE.inner / 2, -HD + innerD / 2);
  g.add(inner);

  // —— 柱、枋、屋顶、匾、对联 ——
  for (const [x, z] of CAFE_COLS) {
    const c = mesh(meterUV(new THREE.CylinderGeometry(0.13, 0.15, colH, 14), 0.9, colH), M.red);
    c.position.set(x, b + colH / 2, z);
    const base = mesh(lathe([[0, 0], [0.24, 0], [0.24, 0.05], [0.19, 0.12], [0, 0.12]], 14), M.marble);
    base.position.set(x, b, z);
    g.add(c, base);
  }
  const top = b + colH;
  for (const z of [-2.9, 2.9]) {
    const beam = mesh(new THREE.BoxGeometry(10.8, 0.26, 0.2), M.red);
    beam.position.set(0, top - 0.13, z);
    const band = mesh(new THREE.BoxGeometry(10.5, 0.16, 0.21), M.caihua);
    band.position.set(0, top - 0.36, z);
    g.add(beam, band);
  }
  for (const x of [-5.2, 5.2]) {
    const beam = mesh(new THREE.BoxGeometry(0.2, 0.26, 6.2), M.red);
    beam.position.set(x, top - 0.13, 0);
    g.add(beam);
  }
  // 厅里的天花：木板
  const ceil = mesh(new THREE.BoxGeometry(10.6, 0.06, 6.0), std({ color: '#5a3c28', roughness: 0.8, side: THREE.DoubleSide }));
  ceil.position.set(0, top + 0.02, 0);
  g.add(ceil);
  {
    const R = 2;
    const roof = buildRoof({ cx: 0, cz: 0, W: 6.3 * R, D: 4.0 * R, rx: 3.4 * R, eaveY: (top + 0.12) * R, ridgeY: (top + 1.75) * R, lift: 0.4 * R });
    roof.scale.setScalar(1 / R);
    g.add(roof);
  }
  {
    const w = 2.3, h = w * (340 / (260 * 4 + 140));
    const plaque = mesh(new THREE.BoxGeometry(w, h, 0.1), [M.gold, M.gold, M.gold, M.gold, std({ map: plaqueTexture('半山咖啡'), roughness: 0.5, metalness: 0.2 }), M.redDark]);
    plaque.position.set(0, top - 0.3, 3.08);
    g.add(plaque);
  }
  // 中间两根前柱上一副对联
  ([[-1.8, '一盞清香消俗慮'], [1.8, '半窗山色入詩心']] as [number, string][]).forEach(([x, text]) => {
    const tex = coupletTexture(text);
    const h = 0.22 * ((110 * 7 + 60) / 128);
    const board = mesh(new THREE.BoxGeometry(0.22, h, 0.04), [darkWood, darkWood, darkWood, darkWood, std({ map: tex, roughness: 0.5 }), darkWood]);
    board.position.set(x, b + 0.75 + h / 2, 2.9 + 0.16);
    g.add(board);
  });

  // —— 后墙、两山墙（下半实墙、上半格子窗） ——
  const wallMat = std({ color: '#d9cdb4', roughness: 0.9 });
  const back = mesh(new THREE.BoxGeometry(10.4, colH, 0.14), [wallMat, wallMat, wallMat, wallMat, darkWood, wallMat]);
  back.position.set(0, b + colH / 2, -HD + 0.2);
  g.add(back);
  const lattice = M.geshan as THREE.MeshStandardMaterial;
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [[-2.9, 0], [0, 2.9]]) {
      const len = z1 - z0 - 0.26, zc = (z0 + z1) / 2;
      const low = mesh(new THREE.BoxGeometry(0.12, 0.85, len), wallMat);
      low.position.set(sx * 5.2, b + 0.425, zc);
      const win = mesh(new THREE.BoxGeometry(0.06, 1.55, len), lattice);
      win.position.set(sx * 5.2, b + 0.85 + 0.775, zc);
      const sill = mesh(new THREE.BoxGeometry(0.2, 0.06, len), darkWood);
      sill.position.set(sx * 5.2, b + 0.88, zc);
      const head = mesh(new THREE.BoxGeometry(0.12, colH - 2.4, len), wallMat);
      head.position.set(sx * 5.2, b + 2.4 + (colH - 2.4) / 2, zc);
      g.add(low, win, sill, head);
    }
  }
  // 后墙上：三层木架摆豆罐、杯子；架子上方三块菜单牌
  for (const [k, y] of [0.92].entries()) {
    const shelf = mesh(new THREE.BoxGeometry(7.6, 0.04, 0.3), wood);
    shelf.position.set(0, b + CAFE.inner + y, -HD + 0.42);
    g.add(shelf);
    for (let i = 0; i < 12; i++) {
      const x = -3.5 + i * 0.64 + (k % 2) * 0.2;
      if ((i + k) % 3 === 1) {
        const stack = mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.22, 14), paperCup);
        stack.position.set(x, b + CAFE.inner + y + 0.13, -HD + 0.42);
        g.add(stack);
        continue;
      }
      const jar = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 14), glass);
      jar.position.set(x, b + CAFE.inner + y + 0.13, -HD + 0.42);
      const fill = mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.14, 12), beans);
      fill.position.set(x, b + CAFE.inner + y + 0.095, -HD + 0.42);
      const cap = mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.03, 14), wood);
      cap.position.set(x, b + CAFE.inner + y + 0.255, -HD + 0.42);
      g.add(fill, jar, cap);
    }
  }
  const boards: THREE.MeshStandardMaterial[] = [];
  ([
    [-2.6, '咖 啡', ['山霧拿鐵', '清醒美式', '上岸冷萃', '桂花拿鐵', '放下 · 低因']],
    [0, '手沖 · 雲南豆', ['保山小粒', '普洱日曬', '德宏蜜處理']],
    [2.6, '茶 點', ['桂花糕', '素月餅', '棗泥酥', '柿餅']],
  ] as [number, string, string[]][]).forEach(([x, title, lines]) => {
    const tex = boardTexture(title, lines);
    const mat = std({ map: tex, roughness: 0.8, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
    boards.push(mat);
    const board = mesh(new THREE.BoxGeometry(1.45, 1.0, 0.05), [darkWood, darkWood, darkWood, darkWood, mat, darkWood]);
    board.position.set(x, b + CAFE.inner + 1.98, -HD + 0.32);
    board.rotation.x = -0.08;
    g.add(board);
  });

  // —— 吧台：竖条木板台身、胡桃木台面，七米六长 ——
  const bz = CAFE.bar - 0.3, ch = 0.85, cl = 7.6;
  const counter = mesh(new THREE.BoxGeometry(cl, ch, 0.6), wood);
  counter.position.set(0, b + ch / 2, bz);
  g.add(counter);
  {
    const slats: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 46; i++) slats.push(new THREE.BoxGeometry(0.12, ch - 0.12, 0.025).translate(-cl / 2 + 0.1 + i * 0.163, b + ch / 2 - 0.02, bz + 0.312));
    g.add(mesh(mergeGeometries(slats), darkWood));
  }
  const slab = mesh(new THREE.BoxGeometry(cl + 0.1, 0.06, 0.76), walnut);
  slab.position.set(0, b + ch + 0.03, bz + 0.04);
  g.add(slab);
  const T = b + ch + 0.06;

  // 咖啡机（冲煮头朝师父）
  const machine = (x: number) => {
    const mach = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(0.72, 0.44, 0.46), steel);
    body.position.y = 0.22;
    const rail = mesh(new THREE.BoxGeometry(0.74, 0.03, 0.48), brass);
    rail.position.y = 0.455;
    const gauge = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 18), brass);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0, 0.31, 0.235);
    for (const sx of [-1, 1]) {
      const head = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 14), steel);
      head.position.set(sx * 0.18, 0.15, -0.26);
      const handle = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), black);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(sx * 0.18, 0.13, -0.37);
      mach.add(head, handle);
    }
    for (let i = 0; i < 4; i++) {
      const c = mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.05, 12), std({ color: '#f4efe6', roughness: 0.3 }));
      c.position.set(-0.24 + i * 0.16, 0.495, 0);
      mach.add(c);
    }
    mach.add(body, rail, gauge);
    mach.position.set(x, T, bz - 0.02);
    g.add(mach);
    return mach;
  };
  const machG = machine(-2.1);
  // 两台磨豆机
  const grindG = new THREE.Group();
  for (const x of [-1.25, -0.95]) {
    const gb = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.22), black);
    gb.position.set(x, T + 0.15, bz - 0.06);
    const hopper = mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.18, 16, 1, true), glass);
    hopper.position.set(x, T + 0.39, bz - 0.06);
    const hb = mesh(new THREE.CylinderGeometry(0.066, 0.04, 0.1, 14), beans);
    hb.position.set(x, T + 0.35, bz - 0.06);
    grindG.add(gb, hb, hopper);
  }
  g.add(grindG);
  // 模型下载好以后换成精细的：青绿色双头意式咖啡机和配套磨豆机（Lanzaman，CC BY 4.0），冲煮头朝师父
  loadProp('coffee_machine').then((o) => {
    o.rotation.y = Math.PI;
    o.position.set(-2.1, T, bz - 0.02);
    g.remove(machG);
    g.add(o);
  });
  Promise.all([loadProp('grinder'), loadProp('grinder')]).then(([a, c]) => {
    for (const [o, x] of [[a, -1.3], [c, -0.98]] as [THREE.Object3D, number][]) {
      o.rotation.y = Math.PI;
      o.position.set(x, T, bz - 0.06);
      g.add(o);
    }
    g.remove(grindG);
  });
  // 手冲架：一条木架上三只白瓷滤杯，下面三只玻璃壶；旁边一把细嘴铜壶
  {
    const stand = mesh(new THREE.BoxGeometry(0.9, 0.03, 0.18), darkWood);
    stand.position.set(0.3, T + 0.24, bz);
    g.add(stand);
    for (const sx of [-1, 1]) {
      const leg = mesh(new THREE.BoxGeometry(0.03, 0.24, 0.16), darkWood);
      leg.position.set(0.3 + sx * 0.43, T + 0.12, bz);
      g.add(leg);
    }
    for (let k = 0; k < 3; k++) {
      const x = 0.02 + k * 0.28;
      const dripper = mesh(new THREE.CylinderGeometry(0.07, 0.03, 0.08, 18), std({ color: '#f3f0ea', roughness: 0.3 }));
      dripper.position.set(x, T + 0.29, bz);
      const server = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 16, 1, true), glass);
      server.position.set(x, T + 0.06, bz);
      const brew = mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.04 + k * 0.015, 14), std({ color: '#4a2a18', roughness: 0.15 }));
      brew.position.set(x, T + 0.025, bz);
      g.add(dripper, server, brew);
    }
    const kb = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 18), std({ color: '#b06a3c', metalness: 0.85, roughness: 0.3 }));
    kb.position.set(0.95, T + 0.06, bz + 0.05);
    const spout = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 0.03, 0), new THREE.Vector3(0.12, 0.08, 0), new THREE.Vector3(0.15, 0.17, 0), new THREE.Vector3(0.2, 0.18, 0)]), 12, 0.008, 6), kb.material);
    spout.position.set(0.95, T, bz + 0.05);
    spout.rotation.y = Math.PI;
    g.add(kb, spout);
  }
  // 点心柜：玻璃罩里两层，桂花糕（黄方块）、素月饼（棕圆饼）、柿饼（橙扁圆）
  {
    const cx = 2.0;
    const caseG = mesh(new THREE.BoxGeometry(1.1, 0.46, 0.5), glass);
    caseG.position.set(cx, T + 0.23, bz);
    const frame = mesh(new THREE.BoxGeometry(1.12, 0.03, 0.52), darkWood);
    frame.position.set(cx, T + 0.47, bz);
    const mid = mesh(new THREE.BoxGeometry(1.06, 0.015, 0.46), std({ color: '#f1ece2', roughness: 0.4 }));
    mid.position.set(cx, T + 0.22, bz);
    g.add(mid, frame, caseG);
    const cake = std({ color: '#e7c35a', roughness: 0.6 });
    const moon = std({ color: '#a8652e', roughness: 0.55 });
    const kaki = std({ color: '#c85a1c', roughness: 0.5 });
    for (let k = 0; k < 5; k++) {
      const c1 = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), cake);
      c1.position.set(cx - 0.4 + k * 0.2, T + 0.255, bz - 0.08);
      const c2 = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), k % 2 ? moon : kaki);
      c2.position.set(cx - 0.4 + k * 0.2, T + 0.035, bz + 0.06);
      g.add(c1, c2);
    }
  }
  // 纸杯、杯盖、「隨喜」小木箱、一盆小松
  for (const [x, n] of [[2.95, 8], [3.1, 6]] as [number, number][]) {
    const st = mesh(new THREE.CylinderGeometry(0.045, 0.034, 0.1 + n * 0.018, 14), paperCup);
    st.position.set(x, T + (0.1 + n * 0.018) / 2, bz + 0.12);
    g.add(st);
  }
  {
    const box = mesh(new THREE.BoxGeometry(0.22, 0.16, 0.16), std({ color: '#8e2a1e', roughness: 0.55 }));
    box.position.set(3.45, T + 0.08, bz + 0.1);
    g.add(box);
    const pot = mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.11, 16), std({ color: '#5d6e74', roughness: 0.35 }));
    pot.position.set(-3.4, T + 0.055, bz - 0.05);
    const pine = mesh(new THREE.SphereGeometry(0.14, 10, 8), std({ color: '#3d5a34', roughness: 0.9 }));
    pine.scale.set(1.3, 0.7, 1);
    pine.position.set(-3.4, T + 0.25, bz - 0.05);
    g.add(pot, pine);
  }
  // 吧台上方三盏竹编吊灯
  const lampMat = new THREE.MeshStandardMaterial({ color: '#c9a66a', roughness: 0.85, emissive: '#ffc77a', emissiveIntensity: 0, side: THREE.DoubleSide });
  for (const x of [-2.4, 0, 2.4]) {
    const shade = mesh(new THREE.CylinderGeometry(0.12, 0.28, 0.26, 18, 1, true), lampMat, false);
    shade.position.set(x, top - 0.42, bz + 0.25);
    const cord = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), black, false);
    cord.position.set(x, top - 0.15, bz + 0.25);
    g.add(shade, cord);
  }

  // 夜里厅里亮一盏暖光（白天关着）
  const warm = new THREE.PointLight('#ffb878', 0, 11, 1.6);
  warm.position.set(0, top - 0.6, -0.4);
  g.add(warm);

  // 点单的点击范围：吧台、墙上的菜单牌，还有前檐（远处点房子也能去）
  const hit = new THREE.Mesh(new THREE.BoxGeometry(8.0, colH, 1.6), hitMat);
  hit.position.set(0, b + colH / 2, -HD + 0.8 + 0.6);
  hit.userData.interact = { type: 'cafe' };
  const eaveHit = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 1.4, 1.8, 1.4), hitMat);
  eaveHit.position.set(0, top + 0.5, HD + 0.2);
  eaveHit.userData.interact = { type: 'cafe' };
  g.add(hit, eaveHit);
  interactives.push(hit, eaveHit);

  // 前檐一排纸灯笼（夜里亮）
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#f3e3c2', roughness: 0.8, emissive: '#ffbf6a', emissiveIntensity: 0 });
  const lanterns: THREE.Group[] = [];
  for (const x of [-3.5, 0, 3.5, -5.2, 5.2]) {
    const lantern = new THREE.Group();
    const lb = mesh(new THREE.SphereGeometry(0.18, 16, 12), lanternMat, false);
    lb.scale.set(1, 1.25, 1);
    const cap1 = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 12), black);
    cap1.position.y = 0.23;
    const cap2 = cap1.clone();
    cap2.position.y = -0.23;
    const cord = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4), black, false);
    cord.position.y = 0.38;
    const tassel = mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.16, 8), std({ color: '#9e2a1e', roughness: 0.9 }));
    tassel.position.y = -0.33;
    lantern.add(lb, cap1, cap2, cord, tassel);
    lantern.position.set(x, top - 0.75, Math.abs(x) > 5 ? 3.35 : 3.2);
    g.add(lantern);
    lanterns.push(lantern);
  }

  // 厅前两角各一只竹盆
  const bambooMat = std({ color: '#5f7d3e', roughness: 0.7 });
  const leafMat = std({ color: '#6f9a48', roughness: 0.8, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const pot = mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), darkWood);
    pot.position.set(sx * 5.0, b + 0.225, 3.75);
    g.add(pot);
    for (let k = 0; k < 5; k++) {
      const hgt = 1.6 + (k % 3) * 0.35;
      const stem = mesh(new THREE.CylinderGeometry(0.018, 0.022, hgt, 6), bambooMat);
      stem.position.set(sx * 5.0 + Math.cos(k * 1.3) * 0.12, b + 0.45 + hgt / 2, 3.75 + Math.sin(k * 1.3) * 0.12);
      stem.rotation.z = Math.cos(k * 2.1) * 0.08;
      g.add(stem);
      for (let n = 0; n < 4; n++) {
        const leaf = mesh(new THREE.PlaneGeometry(0.06, 0.32), leafMat, false);
        leaf.position.set(stem.position.x + Math.cos(n * 1.7 + k) * 0.14, b + 0.45 + hgt * (0.55 + n * 0.12), stem.position.z + Math.sin(n * 1.7 + k) * 0.14);
        leaf.rotation.set(0.9, n * 1.7 + k, 0.4);
        g.add(leaf);
      }
    }
  }

  // —— 桌、凳、油纸伞：露台四张撑伞，厅里两张不撑 ——
  // 桌凳用木纹材质（Poly Haven 的旧木柜贴图），染成胡桃色
  const tableMat = pbr('wood', { metersPerTile: 0.8, color: '#a8805e' });
  tableMat.roughness = 0.6;
  const legWood = pbr('wood', { metersPerTile: 0.6, color: '#6e4e36' });
  // 小圆桌：桌面上沿圆角、下沿收一道（2026-11-19 原来是一块圆饼加一根圆棍）
  const tableTopGeo = lathe([[0, 0], [0.4, 0], [0.44, 0.012], [0.462, 0.03], [0.465, 0.045], [0.455, 0.056], [0, 0.056]], 40);
  const pedestalGeo = lathe([[0.075, 0], [0.07, 0.04], [0.045, 0.08], [0.04, 0.32], [0.05, 0.36], [0.04, 0.4], [0.036, 0.62], [0.06, 0.66], [0.07, 0.69], [0, 0.69]], 16);
  const feetGeo = (() => {
    const fs: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0.2, 0.08, 0), new THREE.Vector3(0.3, 0.012, 0));
      fs.push(new THREE.TubeGeometry(curve, 12, 0.022, 6, false).rotateY(a));
      fs.push(new THREE.SphereGeometry(0.026, 8, 6).translate(0.3, 0.015, 0).rotateY(a));
    }
    return mergeGeometries(fs.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  })();
  const umbrellaColors = ['#b8432f', '#d0953b', '#3f5f7a', '#a8432f'];
  CAFE_TABLE_LOCAL.forEach(([tx, tz], i) => {
    const tg = new THREE.Group();
    tg.position.set(tx, b, tz);
    const topM = mesh(tableTopGeo, tableMat);
    topM.position.y = 0.705;
    const leg = mesh(pedestalGeo, legWood);
    leg.position.y = 0.02;
    const foot = mesh(feetGeo, legWood);
    const vase = mesh(lathe([[0, 0], [0.035, 0], [0.045, 0.05], [0.02, 0.12], [0.024, 0.14], [0, 0.14]], 12), std({ color: '#a9c2b0', roughness: 0.3 }));
    vase.position.set(0.12, 0.765, -0.08);
    const sprig = mesh(new THREE.SphereGeometry(0.05, 8, 6), std({ color: '#e7b84a', roughness: 0.8 }));
    sprig.scale.set(1, 1.4, 1);
    sprig.position.set(0.12, 0.96, -0.08);
    tg.add(topM, leg, foot, vase, sprig);
    if (tz > HD) {
      // 油纸伞：先用一顶简单的浅锥占位，模型（Milight 的红色梅花油纸伞，CC BY 4.0）下载好以后换上。
      // 原模型是手持的伞，放大到伞面 2.4 米时伞沿只有 1.36 米高，所以整体抬高 0.7 米，伞柄从桌面中间穿出
      const place = new THREE.Group();
      tg.add(place);
      loadProp('parasol').then((o) => {
        // 油纸伞迎着太阳会透光：伞面加一点用自身贴图的自发光，从伞下看不发暗
        o.traverse((m) => {
          const mm = m as THREE.Mesh;
          if (!mm.isMesh) return;
          const mat = (mm.material as THREE.MeshStandardMaterial).clone();
          mat.emissive = new THREE.Color('#ffffff');
          mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.42;
          mm.material = mat;
        });
        o.position.y = 0.7;
        o.rotation.y = i * 1.3;
        tg.remove(place);
        tg.add(o);
      });
      const pole = mesh(new THREE.CylinderGeometry(0.02, 0.025, 2.35, 8), std({ color: '#7a5a32', roughness: 0.6 }));
      pole.position.y = 1.18;
      const tex = parasolTexture(umbrellaColors[i % umbrellaColors.length]);
      const canopy = mesh(new THREE.ConeGeometry(1.25, 0.42, 24, 1, true), std({ map: tex, roughness: 0.75, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.06 }));
      canopy.position.y = 2.3;
      const tip = mesh(new THREE.SphereGeometry(0.04, 8, 6), darkWood);
      tip.position.y = 2.53;
      place.add(pole, canopy, tip);
    }
    g.add(tg);
  });
  // 圆凳：凳面中间微凹、边缘倒角；三条车削的腿往外撇，中间一圈横撑（原来是一块圆饼加三根细棍）
  const stoolSeatGeo = lathe([[0, 0.034], [0.12, 0.03], [0.175, 0.038], [0.195, 0.032], [0.2, 0.016], [0.19, 0.002], [0.16, 0], [0, 0]], 32);
  const stoolLegsGeo = (() => {
    const ls: THREE.BufferGeometry[] = [];
    const legProfile = lathe([[0.016, 0], [0.019, 0.05], [0.017, 0.2], [0.021, 0.3], [0.018, 0.41], [0, 0.41]], 8);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const l = legProfile.clone();
      l.rotateZ(0.13);
      l.translate(0.16, 0, 0);
      l.rotateY(a);
      ls.push(l);
    }
    ls.push(new THREE.TorusGeometry(0.135, 0.009, 6, 24).rotateX(Math.PI / 2).translate(0, 0.16, 0));
    return mergeGeometries(ls.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  })();
  for (const s of CAFE_SEATS) {
    const sg = new THREE.Group();
    sg.position.set(s.x, b, s.z);
    const seat = mesh(stoolSeatGeo, tableMat);
    seat.position.y = 0.41;
    sg.add(seat, mesh(stoolLegsGeo, legWood));
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8), hitMat);
    sh.position.y = 0.45;
    sh.userData.interact = { type: 'seat', id: s.id };
    sg.add(sh);
    interactives.push(sh);
    scene.add(sg);
  }

  // —— 入口旁的菜单木牌（A 字架） ——
  const menu = new THREE.Group();
  const menuTex = menuTexture();
  const menuMat = std({ map: menuTex, roughness: 0.8, emissive: '#ffffff', emissiveIntensity: 0, emissiveMap: menuTex });
  // 两扇木框夹着黑板，四条腿着地，顶上一根合页轴（原来是两块斜靠的木板）
  for (const s of [1, -1]) {
    const leaf = new THREE.Group();
    leaf.position.set(0, 1.08, 0);
    leaf.rotation.x = -s * 0.2;
    const panel = mesh(new THREE.BoxGeometry(0.54, 0.8, 0.018), s > 0 ? [darkWood, darkWood, darkWood, darkWood, menuMat, darkWood] : darkWood);
    panel.position.set(0, -0.5, s * 0.004);
    leaf.add(panel);
    const frameParts: THREE.BufferGeometry[] = [];
    for (const x of [-0.29, 0.29]) frameParts.push(new THREE.BoxGeometry(0.05, 1.08, 0.04).translate(x, -0.54, 0));
    for (const y of [-0.08, -0.92]) frameParts.push(new THREE.BoxGeometry(0.58, 0.05, 0.04).translate(0, y, 0));
    leaf.add(mesh(mergeGeometries(frameParts)!, legWood));
    menu.add(leaf);
  }
  const hinge = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.64, 10).rotateZ(Math.PI / 2), std({ color: '#3a3430', metalness: 0.6, roughness: 0.4 }));
  hinge.position.y = 1.08;
  menu.add(hinge);
  const mw = cafeWorld(1.9, 9.0);
  menu.position.set(mw.x, 0, mw.z);
  menu.rotation.y = CAFE.yaw + 0.25;
  scene.add(menu);
  const menuHit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), hitMat);
  menuHit.position.y = 0.55;
  menuHit.userData.interact = { type: 'cafe' };
  menu.add(menuHit);
  interactives.push(menuHit);

  // —— 布幌子：平台左前角的竹竿，横杆朝外挑，布面朝西 ——
  const bamboo = std({ color: '#b39a5c', roughness: 0.6 });
  const fw = cafeWorld(-5.15, 8.15);
  const flagG = new THREE.Group();
  flagG.position.set(fw.x, b, fw.z);
  flagG.rotation.y = Math.PI / 2;
  const pole = mesh(new THREE.CylinderGeometry(0.035, 0.045, 4.2, 8), bamboo);
  pole.position.y = 2.1;
  const bar = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.86, 6), bamboo);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0.4, 4.0, 0);
  const cloth = new THREE.Group();
  cloth.position.set(0.42, 3.98, 0);
  const clothM = mesh(new THREE.PlaneGeometry(0.7, 1.75, 1, 6).translate(0, -0.875, 0), std({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.95 }));
  clothM.rotation.y = Math.PI;
  cloth.add(clothM);
  flagG.add(pole, bar, cloth);
  scene.add(flagG);

  // —— 空杯回收桶：平台右前角一只半人高的大纸杯 ——
  const bw = cafeWorld(4.95, 7.85);
  const bin = new THREE.Group();
  bin.position.set(bw.x, b, bw.z);
  bin.rotation.y = CAFE.yaw;
  const cupH = 1.0;
  const cupBody = mesh(new THREE.CylinderGeometry(0.4, 0.3, cupH, 28), std({ color: '#f3f0e8', roughness: 0.7 }));
  cupBody.position.y = cupH / 2;
  const sleeve = mesh(new THREE.CylinderGeometry(0.39, 0.345, 0.4, 28, 1, true), std({ map: binSleeveTexture(), roughness: 0.85 }));
  sleeve.position.y = cupH * 0.52;
  sleeve.scale.setScalar(1.012);
  const cupLid = mesh(lathe([[0, 0.07], [0.3, 0.07], [0.34, 0.04], [0.42, 0.03], [0.42, 0], [0.4, -0.02]], 28), std({ color: '#2b2521', roughness: 0.4 }));
  cupLid.position.y = cupH;
  const slot = mesh(new THREE.BoxGeometry(0.22, 0.02, 0.09), std({ color: '#0e0c0b' }));
  slot.position.set(0, cupH + 0.072, 0.12);
  const rim = mesh(new THREE.TorusGeometry(0.4, 0.014, 8, 40).rotateX(Math.PI / 2), std({ color: '#f6f3ec', roughness: 0.6 }));
  rim.position.y = cupH - 0.004;
  bin.add(cupBody, sleeve, cupLid, slot, rim);
  const binHit = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.2, 10), hitMat);
  binHit.position.y = 0.6;
  binHit.userData.interact = { type: 'cafeBin' };
  bin.add(binHit);
  interactives.push(binHit);
  scene.add(bin);

  // 做咖啡时机器上冒热气
  const puffMat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0 });
  const puffs: { s: THREE.Sprite; t: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(puffMat.clone());
    s.scale.setScalar(0.18);
    g.add(s);
    puffs.push({ s, t: i / 6 });
  }
  let brewing = 0;
  let want = 0;
  return {
    interactives,
    setBrewing(on) {
      want = on ? 1 : 0;
    },
    setLanternLevel(level) {
      lanternMat.emissiveIntensity = level * 1.6;
      lampMat.emissiveIntensity = level * 1.4;
      warm.intensity = level * 22;
      menuMat.emissiveIntensity = level * 0.05;
      for (const m of boards) m.emissiveIntensity = 0.04 + level * 0.12;
    },
    update(dt, time) {
      brewing += (want - brewing) * Math.min(1, dt * 2);
      for (const p of puffs) {
        p.t = (p.t + dt * 0.45) % 1;
        const k = p.t;
        p.s.position.set(-2.1 + Math.sin(k * 6 + p.t * 20) * 0.04, T + 0.55 + k * 0.6, bz - 0.15);
        p.s.scale.setScalar(0.12 + k * 0.32);
        (p.s.material as THREE.SpriteMaterial).opacity = brewing * Math.sin(k * Math.PI) * 0.45;
      }
      cloth.rotation.x = Math.sin(time * 0.9) * 0.05 + Math.sin(time * 2.3) * 0.02;
      cloth.rotation.z = Math.sin(time * 0.7 + 1) * 0.03;
      lanterns.forEach((l, i) => (l.rotation.z = Math.sin(time * 0.8 + i) * 0.03));
    },
  };
}
