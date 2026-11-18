// 山寺咖啡：东院放生池边的一座小茶寮。朱红柱、灰瓦四坡顶、檐下一块「山寺咖啡」金匾；
// 木柜台上一台咖啡机、磨豆机、手冲壶和一摞纸杯，后墙木架上摆着豆罐；
// 柜台前立一块菜单木牌，旁边竹竿挑着「咖啡」布幌子，檐角挂一盏纸灯笼（夜里亮）；
// 右手边一只木桶收空杯，前面两张小圆桌各配两只圆凳（可以坐）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAFE, CAFE_TABLES, CAFE_SEATS, cafeWorld } from '../layout';
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
    g.fillText('山寺咖啡', 256, 100);
    g.fillStyle = 'rgba(239,227,196,0.5)';
    g.fillRect(150, 150, 212, 2);
    g.fillStyle = '#efe3c4';
    g.font = `46px ${KAI}`;
    ['般若拿鐵', '菩提美式', '上岸冷萃', '桂花拿鐵', '放下 · 低因'].forEach((s, i) => g.fillText(s, 256, 232 + i * 92));
    g.fillStyle = 'rgba(239,227,196,0.7)';
    g.font = `34px ${KAI}`;
    g.fillText('— 隨 喜 —', 256, 712);
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


// 大纸杯回收桶的杯套：牛皮纸色，一圈印「山寺咖啡」和「空杯回收 · 惜福」，中间一方小红印
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
      g.fillText('山寺咖啡', x, 100);
      g.font = `40px ${KAI}`;
      g.fillStyle = '#3d2a1f';
      g.fillText('空杯回收 · 惜福', x, 180);
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

export function buildCafe(scene: THREE.Scene): CafeBuild {
  const M = chineseMats();
  const g = new THREE.Group();
  g.position.set(CAFE.x, 0, CAFE.z);
  g.rotation.y = CAFE.yaw;
  scene.add(g);
  const interactives: THREE.Object3D[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const b = CAFE.base;

  // 台基：青灰条石
  const platTop = pbr('granite', { metersPerTile: 1.1, color: new THREE.Color().setRGB(2.6, 2.5, 2.35) });
  const platSide = pbr('granite', { metersPerTile: 0.9, color: new THREE.Color().setRGB(2.2, 2.12, 1.98) });
  aged(platTop, 0.1, 0.28);
  aged(platSide, 0.1, 0.32);
  const plat = mesh(worldBox(CAFE.hw * 2, b, CAFE.hd * 2, 1), [platSide, platSide, platTop, platTop, platSide, platSide]);
  plat.position.y = b / 2;
  g.add(plat);

  // 四根朱红柱、柱础，檐下一圈枋
  const colH = 2.5, px = 2.05, pz = 1.35;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = mesh(meterUV(new THREE.CylinderGeometry(0.1, 0.115, colH, 14), 0.7, colH), M.red);
    c.position.set(sx * px, b + colH / 2, sz * pz);
    const base = mesh(lathe([[0, 0], [0.19, 0], [0.19, 0.04], [0.15, 0.1], [0, 0.1]], 14), M.marble);
    base.position.set(sx * px, b, sz * pz);
    g.add(c, base);
  }
  const top = b + colH;
  for (const sz of [-1, 1]) {
    const beam = mesh(new THREE.BoxGeometry(px * 2 + 0.3, 0.2, 0.16), M.red);
    beam.position.set(0, top - 0.1, sz * pz);
    const band = mesh(new THREE.BoxGeometry(px * 2 + 0.1, 0.12, 0.17), M.caihua);
    band.position.set(0, top - 0.28, sz * pz);
    g.add(beam, band);
  }
  for (const sx of [-1, 1]) {
    const beam = mesh(new THREE.BoxGeometry(0.16, 0.2, pz * 2 + 0.3), M.red);
    beam.position.set(sx * px, top - 0.1, 0);
    g.add(beam);
  }
  // 屋顶：buildRoof 的脊、吻兽是按大殿的尺寸做的，这里按两倍大造好再缩一半，脊和瓦都跟着变秀气
  {
    const R = 2;
    const roof = buildRoof({ cx: 0, cz: 0, W: (px + 0.75) * R, D: (pz + 0.7) * R, rx: 1.1 * R, eaveY: (top + 0.12) * R, ridgeY: (top + 1.1) * R, lift: 0.3 * R });
    roof.scale.setScalar(1 / R);
    g.add(roof);
  }
  // 金匾
  {
    const w = 1.5, h = w * (340 / (260 * 4 + 140));
    const plaque = mesh(new THREE.BoxGeometry(w, h, 0.08), [M.gold, M.gold, M.gold, M.gold, std({ map: plaqueTexture('山寺咖啡'), roughness: 0.5, metalness: 0.2 }), M.redDark]);
    plaque.position.set(0, top - 0.55, pz + 0.1);
    g.add(plaque);
  }

  // 柜台里铺一层木踏板，师父站高一点，从外面看得见上半身
  const deck = mesh(new THREE.BoxGeometry(px * 2 - 0.1, CAFE.inner, 1.7), std({ color: '#5e4330', roughness: 0.8 }));
  deck.position.set(0, b + CAFE.inner / 2, -0.4);
  g.add(deck);
  // 后墙：木板墙和三层木架（豆罐、杯子、一盆小松）
  const darkWood = std({ color: '#4a3020', roughness: 0.72 });
  const wood = std({ color: '#6e4a30', roughness: 0.66 });
  const walnut = std({ color: '#3b281c', roughness: 0.45 });
  const wall = mesh(new THREE.BoxGeometry(px * 2, colH - 0.25, 0.08), darkWood);
  wall.position.set(0, b + (colH - 0.25) / 2, -pz + 0.04);
  g.add(wall);
  const glass = std({ color: '#e8f2f2', transparent: true, opacity: 0.35, roughness: 0.08, depthWrite: false });
  const beans = std({ color: '#3a2216', roughness: 0.9 });
  const paperCup = std({ color: '#f2eee6', roughness: 0.8 });
  for (const [k, y] of [0.95, 1.4, 1.85].entries()) {
    const shelf = mesh(new THREE.BoxGeometry(px * 2 - 0.3, 0.04, 0.3), wood);
    shelf.position.set(0, b + y, -pz + 0.22);
    g.add(shelf);
    for (let i = 0; i < 6; i++) {
      const x = -1.55 + i * 0.62 + (k % 2) * 0.2;
      if (k === 1 && i % 2) {
        // 一摞纸杯
        const stack = mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.2, 14), paperCup);
        stack.position.set(x, b + y + 0.12, -pz + 0.22);
        g.add(stack);
        continue;
      }
      const jar = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), glass);
      jar.position.set(x, b + y + 0.12, -pz + 0.22);
      const fill = mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.13, 12), beans);
      fill.position.set(x, b + y + 0.088, -pz + 0.22);
      const cap = mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.03, 14), wood);
      cap.position.set(x, b + y + 0.235, -pz + 0.22);
      g.add(fill, jar, cap);
    }
  }

  // 柜台：竖条木板的台身，深胡桃木台面
  // 柜台比真柜台矮一些：Q 版小和尚只有一米三，太高就只露个头顶
  const cz = 0.82, cd = 0.6, ch = 0.8;
  const counter = mesh(new THREE.BoxGeometry(3.5, ch, cd), wood);
  counter.position.set(0, b + ch / 2, cz);
  g.add(counter);
  {
    const slats: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 22; i++) {
      const s = new THREE.BoxGeometry(0.11, ch - 0.12, 0.025);
      s.translate(-1.68 + i * 0.16, b + ch / 2 - 0.02, cz + cd / 2 + 0.012);
      slats.push(s);
    }
    g.add(mesh(mergeGeometries(slats), darkWood));
  }
  const slab = mesh(new THREE.BoxGeometry(3.7, 0.06, cd + 0.16), walnut);
  slab.position.set(0, b + ch + 0.03, cz + 0.04);
  g.add(slab);
  const T = b + ch + 0.06; // 台面高

  // 咖啡机：不锈钢机身、黄铜顶条和压力表，两只小杯
  const steel = std({ color: '#c9c9c4', metalness: 0.9, roughness: 0.28 });
  const brass = std({ color: '#b98a42', metalness: 0.9, roughness: 0.32 });
  const black = std({ color: '#1e1c1a', roughness: 0.5 });
  const mach = new THREE.Group();
  const bodyM = mesh(new THREE.BoxGeometry(0.62, 0.42, 0.44), steel);
  bodyM.position.y = 0.21;
  const rail = mesh(new THREE.BoxGeometry(0.64, 0.03, 0.46), brass);
  rail.position.y = 0.435;
  const feet = mesh(new THREE.BoxGeometry(0.58, 0.04, 0.4), black);
  feet.position.y = 0.02;
  const gauge = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 18), brass);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0, 0.3, 0.225);
  const face = mesh(new THREE.CircleGeometry(0.036, 18), std({ color: '#f1ece0', roughness: 0.4 }));
  face.position.set(0, 0.3, 0.236);
  // 冲煮头和手柄朝里（朝师父那边）
  for (const sx of [-1, 1]) {
    const head = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 14), steel);
    head.position.set(sx * 0.15, 0.14, -0.25);
    const handle = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), black);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(sx * 0.15, 0.12, -0.36);
    const cup = mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.05, 12), paperCup);
    cup.position.set(sx * 0.15, 0.07, -0.25);
    mach.add(head, handle, cup);
  }
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.05, 12), std({ color: '#f4efe6', roughness: 0.3 }));
    c.position.set(-0.18 + i * 0.12, 0.475, 0);
    mach.add(c);
  }
  mach.add(bodyM, rail, feet, gauge, face);
  mach.position.set(-0.95, T, cz - 0.02);
  g.add(mach);
  // 磨豆机
  const grinder = new THREE.Group();
  const gb = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.22), black);
  gb.position.y = 0.15;
  const hopper = mesh(new THREE.CylinderGeometry(0.085, 0.04, 0.18, 16, 1, true), glass);
  hopper.position.y = 0.39;
  const hb = mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.1, 14), beans);
  hb.position.y = 0.35;
  grinder.add(gb, hb, hopper);
  grinder.position.set(-0.4, T, cz - 0.05);
  g.add(grinder);
  // 手冲：玻璃分享壶、白瓷滤杯、细嘴铜壶
  const pour = new THREE.Group();
  const server = mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.13, 18, 1, true), glass);
  server.position.y = 0.065;
  const brew = mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.05, 16), std({ color: '#4a2a18', roughness: 0.15 }));
  brew.position.y = 0.03;
  const dripper = mesh(new THREE.CylinderGeometry(0.075, 0.03, 0.08, 18), std({ color: '#f3f0ea', roughness: 0.3 }));
  dripper.position.y = 0.17;
  const kettle = new THREE.Group();
  const kb = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 18), std({ color: '#b06a3c', metalness: 0.85, roughness: 0.3 }));
  kb.position.y = 0.06;
  const spout = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 0.03, 0), new THREE.Vector3(0.12, 0.08, 0), new THREE.Vector3(0.15, 0.17, 0), new THREE.Vector3(0.2, 0.18, 0)]), 12, 0.008, 6), kb.material);
  const kh = mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 14, Math.PI), black);
  kh.position.set(-0.06, 0.08, 0);
  kh.rotation.z = Math.PI / 2;
  kettle.add(kb, spout, kh);
  kettle.position.set(0.24, 0, 0);
  kettle.rotation.y = Math.PI * 0.85;
  pour.add(brew, server, dripper, kettle);
  pour.position.set(0.25, T, cz);
  g.add(pour);
  // 一摞纸杯、杯盖，一只小竹篮装糖包，一盆小松
  for (const [x, n] of [[0.95, 7], [1.08, 5]] as [number, number][]) {
    const st = mesh(new THREE.CylinderGeometry(0.045, 0.034, 0.1 + n * 0.018, 14), paperCup);
    st.position.set(x, T + (0.1 + n * 0.018) / 2, cz + 0.1);
    g.add(st);
  }
  const basket = mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.07, 14), std({ color: '#b08a52', roughness: 0.9 }));
  basket.position.set(1.32, T + 0.035, cz + 0.08);
  g.add(basket);
  const pot = mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.11, 16), std({ color: '#5d6e74', roughness: 0.35 }));
  pot.position.set(1.55, T + 0.055, cz - 0.08);
  const pine = mesh(new THREE.SphereGeometry(0.13, 10, 8), std({ color: '#3d5a34', roughness: 0.9 }));
  pine.scale.set(1.3, 0.7, 1);
  pine.position.set(1.55, T + 0.24, cz - 0.08);
  const trunk = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.16, 6), std({ color: '#4a3424' }));
  trunk.position.set(1.55, T + 0.15, cz - 0.08);
  trunk.rotation.z = 0.3;
  g.add(pot, trunk, pine);

  // 点单的点击范围：柜台、台面上的东西、匾
  const hit = new THREE.Mesh(new THREE.BoxGeometry(CAFE.hw * 2, top + 0.2, CAFE.hd * 2 + 0.3), hitMat);
  hit.position.set(0, (top + 0.2) / 2, 0.1);
  hit.userData.interact = { type: 'cafe' };
  g.add(hit);
  interactives.push(hit);

  // 纸灯笼：挂在前檐右角
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#f3e3c2', roughness: 0.8, emissive: '#ffbf6a', emissiveIntensity: 0 });
  const lantern = new THREE.Group();
  const lb = mesh(new THREE.SphereGeometry(0.17, 16, 12), lanternMat, false);
  lb.scale.set(1, 1.25, 1);
  const cap1 = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 12), black);
  cap1.position.y = 0.22;
  const cap2 = cap1.clone();
  cap2.position.y = -0.22;
  const cord = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4), black, false);
  cord.position.y = 0.38;
  const tassel = mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.16, 8), std({ color: '#9e2a1e', roughness: 0.9 }));
  tassel.position.y = -0.32;
  lantern.add(lb, cap1, cap2, cord, tassel);
  lantern.position.set(px + 0.25, top - 0.6, pz + 0.25);
  g.add(lantern);

  // 菜单木牌（A 字架），立在柜台前左手边
  const menu = new THREE.Group();
  const menuTex = menuTexture();
  const menuMat = std({ map: menuTex, roughness: 0.8, emissive: '#ffffff', emissiveIntensity: 0, emissiveMap: menuTex });
  for (const s of [1, -1]) {
    const board = mesh(new THREE.BoxGeometry(0.62, 0.98, 0.03), s > 0 ? [darkWood, darkWood, darkWood, darkWood, menuMat, darkWood] : darkWood);
    board.position.set(0, 0.52, s * 0.13);
    board.rotation.x = -s * 0.2;
    menu.add(board);
  }
  const mw = cafeWorld(1.75, 2.35);
  menu.position.set(mw.x, 0, mw.z);
  menu.rotation.y = CAFE.yaw + 0.35; // 略朝西南，从山门、参道过来一眼看得到
  scene.add(menu);
  const menuHit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), hitMat);
  menuHit.position.y = 0.55;
  menuHit.userData.interact = { type: 'cafe' };
  menu.add(menuHit);
  interactives.push(menuHit);

  // 布幌子：竹竿、横杆，布随风轻轻摆
  const bamboo = std({ color: '#b39a5c', roughness: 0.6 });
  const fw = cafeWorld(-2.75, 1.45);
  const flagG = new THREE.Group();
  flagG.position.set(fw.x, 0, fw.z);
  // 横杆朝北挑出去，布面朝西（朝参道）
  flagG.rotation.y = Math.PI / 2;
  const pole = mesh(new THREE.CylinderGeometry(0.032, 0.04, 3.6, 8), bamboo);
  pole.position.y = 1.8;
  const bar = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 6), bamboo);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0.36, 3.42, 0);
  const cloth = new THREE.Group();
  cloth.position.set(0.38, 3.4, 0);
  const clothM = mesh(new THREE.PlaneGeometry(0.6, 1.5, 1, 6).translate(0, -0.75, 0), std({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.95 }));
  clothM.rotation.y = Math.PI;
  cloth.add(clothM);
  flagG.add(pole, bar, cloth);
  scene.add(flagG);

  // 空杯回收桶：一只半人高的大纸杯（院子里一眼就认得出），牛皮纸杯套上印「山寺咖啡 · 空杯回收」，黑杯盖上开一道投杯口
  const bw = cafeWorld(2.95, 1.35);
  const bin = new THREE.Group();
  bin.position.set(bw.x, 0, bw.z);
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
  bin.add(cupBody, sleeve, cupLid, slot);
  const binHit = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.2, 10), hitMat);
  binHit.position.y = 0.6;
  binHit.userData.interact = { type: 'cafeBin' };
  bin.add(binHit);
  interactives.push(binHit);
  scene.add(bin);

  // 两张小圆桌、四只圆凳
  const tableMat = std({ color: '#6b4a32', roughness: 0.55 });
  for (const tb of CAFE_TABLES) {
    const tg = new THREE.Group();
    tg.position.set(tb.x, 0, tb.z);
    const topM = mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.045, 28), tableMat);
    topM.position.y = 0.74;
    const leg = mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.72, 10), darkWood);
    leg.position.y = 0.36;
    const foot = mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.04, 18), darkWood);
    foot.position.y = 0.02;
    // 桌上一只小花瓶插一枝桂花
    const vase = mesh(lathe([[0, 0], [0.035, 0], [0.045, 0.05], [0.02, 0.12], [0.024, 0.14], [0, 0.14]], 12), std({ color: '#a9c2b0', roughness: 0.3 }));
    vase.position.set(0.12, 0.765, -0.08);
    const sprig = mesh(new THREE.SphereGeometry(0.05, 8, 6), std({ color: '#e7b84a', roughness: 0.8 }));
    sprig.scale.set(1, 1.4, 1);
    sprig.position.set(0.12, 0.96, -0.08);
    tg.add(topM, leg, foot, vase, sprig);
    scene.add(tg);
  }
  for (const s of CAFE_SEATS) {
    const sg = new THREE.Group();
    sg.position.set(s.x, 0, s.z);
    const seat = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 20), tableMat);
    seat.position.y = 0.435;
    const legs: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const l = new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6);
      l.rotateZ(Math.cos(a) * 0.12);
      l.rotateX(-Math.sin(a) * 0.12);
      l.translate(Math.cos(a) * 0.12, 0.21, Math.sin(a) * 0.12);
      legs.push(l);
    }
    sg.add(seat, mesh(mergeGeometries(legs), darkWood));
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8), hitMat);
    sh.position.y = 0.45;
    sh.userData.interact = { type: 'seat', id: s.id };
    sg.add(sh);
    interactives.push(sh);
    scene.add(sg);
  }

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
      menuMat.emissiveIntensity = level * 0.05;
    },
    update(dt, time) {
      brewing += (want - brewing) * Math.min(1, dt * 2);
      for (const p of puffs) {
        p.t = (p.t + dt * 0.45) % 1;
        const k = p.t;
        p.s.position.set(-0.95 + Math.sin(k * 6 + p.t * 20) * 0.04, T + 0.5 + k * 0.6, cz - 0.15);
        p.s.scale.setScalar(0.12 + k * 0.32);
        (p.s.material as THREE.SpriteMaterial).opacity = brewing * Math.sin(k * Math.PI) * 0.45;
      }
      cloth.rotation.x = Math.sin(time * 0.9) * 0.05 + Math.sin(time * 2.3) * 0.02;
      cloth.rotation.z = Math.sin(time * 0.7 + 1) * 0.03;
      lantern.rotation.z = Math.sin(time * 0.8) * 0.03;
    },
  };
}
