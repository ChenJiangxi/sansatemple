// 半山夜场（静音蹦迪）：咖啡露台中间那条过道是舞池。
// 前檐两根柱子和舞池前沿两根竹竿之间拉五道串灯（暖白灯泡，天黑亮），舞池地上四团彩色光斑跟着 124 拍一闪一闪、慢慢游走；
// 舞池前沿左边一张木箱 DJ 台：两台黑胶唱机（唱片转）、一台小调音台，四颗小灯是四个台的颜色，正面一块「半山夜场」霓虹字。
// 音乐只在耳机里（radio.ts 的 disco 台），场子本身是安静的。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CAFE, DISCO } from '../layout';
import { STATION_GLOW } from '../monk';
import { bambooTexture } from './shrines';
import { mesh } from './util';

export interface DiscoBuild {
  setLevel(level: number): void;
  update(dt: number, time: number): void;
}

const BPM = 124;
const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)))!;

function spotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 霓虹字：透明底，粉色细管加一圈光晕
function neonTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.font = '600 92px "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#ff4fd8';
  for (const [blur, col] of [[28, 'rgba(255,79,216,0.9)'], [12, 'rgba(255,140,230,1)'], [0, '#ffe6fa']] as [number, string][]) {
    g.shadowBlur = blur;
    g.fillStyle = col;
    g.fillText(text, 256, 84);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 从 a 到 b 的一道下垂的线（中间垂 sag 米），取 n+1 个点
function sagCurve(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 24) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0)));
  }
  return new THREE.CatmullRomCurve3(pts);
}

export function buildDisco(scene: THREE.Scene): DiscoBuild {
  const g = new THREE.Group();
  g.position.set(CAFE.x, 0, CAFE.z);
  g.rotation.y = CAFE.yaw;
  scene.add(g);
  const b = CAFE.base;
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const black = std({ color: '#1c1a19', roughness: 0.45 });
  const wood = std({ color: '#7a5436', roughness: 0.7 });
  const darkWood = std({ color: '#4a3020', roughness: 0.72 });

  // —— 竹竿：插在圆角石墩里，竿头一个小木帽 ——
  const poleH = 3.05;
  const bamboo = std({ map: bambooTexture(), roughness: 0.55 });
  const stone = std({ color: '#9a978f', roughness: 0.85 });
  const cane: THREE.BufferGeometry[] = [];
  const knots: THREE.BufferGeometry[] = [];
  const feet: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * DISCO.poleX, z = DISCO.poleZ;
    cane.push(new THREE.CylinderGeometry(0.03, 0.038, poleH, 10).translate(x, b + poleH / 2, z));
    for (let y = 0.55; y < poleH - 0.1; y += 0.46) knots.push(new THREE.TorusGeometry(0.037 - (y / poleH) * 0.007, 0.004, 5, 14).rotateX(Math.PI / 2).translate(x, b + y, z));
    knots.push(new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, b + poleH, z));
    feet.push(new RoundedBoxGeometry(0.28, 0.16, 0.28, 2, 0.03).translate(x, b + 0.08, z));
  }
  g.add(mesh(merge(cane), bamboo), mesh(merge(knots), bamboo), mesh(merge(feet), stone));

  // —— 串灯：前檐两根柱子（本地 x=±1.8，z=2.9）和两根竹竿之间拉五道：两边各一道、交叉两道、前面一道 ——
  const eaveY = b + 3.0, poleTop = b + poleH - 0.06;
  const L0 = new THREE.Vector3(-1.8, eaveY, 3.05), R0 = new THREE.Vector3(1.8, eaveY, 3.05);
  const L1 = new THREE.Vector3(-DISCO.poleX, poleTop, DISCO.poleZ), R1 = new THREE.Vector3(DISCO.poleX, poleTop, DISCO.poleZ);
  const runs: [THREE.Vector3, THREE.Vector3, number][] = [
    [L0, L1, 0.42],
    [R0, R1, 0.42],
    [L0, R1, 0.5],
    [R0, L1, 0.62],
    [L1, R1, 0.3],
  ];
  const wires: THREE.BufferGeometry[] = [];
  const bulbAt: THREE.Vector3[] = [];
  for (const [a, c, sag] of runs) {
    const curve = sagCurve(a, c, sag);
    wires.push(new THREE.TubeGeometry(curve, 32, 0.006, 4, false));
    const len = curve.getLength();
    const n = Math.floor(len / 0.42);
    for (let k = 1; k < n; k++) bulbAt.push(curve.getPointAt(k / n));
  }
  g.add(mesh(merge(wires), black, false));
  const bulbMat = std({ color: '#fff1d6', emissive: '#ffc777', emissiveIntensity: 0.15, roughness: 0.3 });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 10, 8).scale(1, 1.25, 1), bulbMat, bulbAt.length);
  const sockets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.011, 0.013, 0.035, 8), black, bulbAt.length);
  const m4 = new THREE.Matrix4();
  bulbAt.forEach((p, i) => {
    bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y - 0.062, p.z));
    sockets.setMatrixAt(i, m4.makeTranslation(p.x, p.y - 0.022, p.z));
  });
  g.add(bulbs, sockets);

  // —— 舞池地上的彩色光斑 ——
  const spotTex = spotTexture();
  const spotGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  const spots = ['#ff4fd8', '#4fd8ff', '#ffb347', '#8a6bff'].map((col, i) => {
    const m = new THREE.Mesh(
      spotGeo,
      new THREE.MeshBasicMaterial({ map: spotTex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 - i })
    );
    m.position.y = b + 0.012;
    m.renderOrder = 2;
    m.visible = false;
    g.add(m);
    return m;
  });

  // —— DJ 台：木箱台身（四角包黑边）、台面，上面两台唱机一台调音台；台面朝咖啡馆（本地 -z） ——
  const bx = (DISCO.boothX0 + DISCO.boothX1) / 2, bz = (DISCO.boothZ0 + DISCO.boothZ1) / 2;
  const bw = DISCO.boothX1 - DISCO.boothX0, bd = DISCO.boothZ1 - DISCO.boothZ0, bh = 0.92;
  const booth = new THREE.Group();
  booth.position.set(bx, b, bz);
  g.add(booth);
  booth.add(mesh(new RoundedBoxGeometry(bw, bh, bd, 2, 0.02).translate(0, bh / 2, 0), wood));
  // 木箱的横板缝和四角的黑包角
  const seams: THREE.BufferGeometry[] = [];
  for (const y of [0.3, 0.6]) seams.push(new THREE.BoxGeometry(bw + 0.004, 0.012, bd + 0.004).translate(0, y, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) seams.push(new THREE.BoxGeometry(0.05, bh, 0.05).translate(sx * (bw / 2 - 0.02), bh / 2, sz * (bd / 2 - 0.02)));
  booth.add(mesh(merge(seams), darkWood));
  const top = mesh(new RoundedBoxGeometry(bw + 0.08, 0.04, bd + 0.08, 2, 0.012).translate(0, bh + 0.02, 0), darkWood);
  booth.add(top);
  const deckY = bh + 0.04;
  const records: THREE.Mesh[] = [];
  const recTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#141313';
    x.beginPath();
    x.arc(64, 64, 64, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let r = 26; r < 62; r += 3) {
      x.beginPath();
      x.arc(64, 64, r, 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = '#e8572f';
    x.beginPath();
    x.arc(64, 64, 20, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#f6e7c8';
    x.fillRect(58, 50, 12, 4);
    const t = new THREE.CanvasTexture(x.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const recMat = std({ map: recTex, roughness: 0.35 });
  const deckParts: THREE.BufferGeometry[] = [];
  const steel = std({ color: '#c9c9c4', metalness: 0.9, roughness: 0.3 });
  const arms: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 0.34;
    deckParts.push(new RoundedBoxGeometry(0.34, 0.05, 0.3, 2, 0.01).translate(x, deckY + 0.025, 0));
    const rec = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.008, 32).rotateY(Math.PI), recMat, false);
    rec.position.set(x - 0.03, deckY + 0.055, 0);
    booth.add(rec);
    records.push(rec);
    // 唱臂：一根细管斜搭到唱片边上
    arms.push(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8).translate(x + 0.12, deckY + 0.065, 0.09));
    arms.push(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6).rotateX(Math.PI / 2).rotateY(0.45).translate(x + 0.08, deckY + 0.075, 0.0));
  }
  // 调音台：中间一块，上面两排旋钮
  deckParts.push(new RoundedBoxGeometry(0.2, 0.06, 0.26, 2, 0.01).translate(0, deckY + 0.03, 0));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) arms.push(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 8).translate(-0.05 + c * 0.05, deckY + 0.067, -0.07 + r * 0.06));
  booth.add(mesh(merge(deckParts), black), mesh(merge(arms), steel, false));
  // 四颗小灯：四个台的颜色，跟着拍子轮流亮
  const leds = ['lofi', 'disco', 'rain', 'qin'].map((st, i) => {
    const col = STATION_GLOW[st];
    const m = mesh(new THREE.BoxGeometry(0.022, 0.008, 0.012), std({ color: col, emissive: col, emissiveIntensity: 0.6 }), false);
    m.position.set(-0.06 + i * 0.04, deckY + 0.062, 0.085);
    booth.add(m);
    return m.material as THREE.MeshStandardMaterial;
  });
  // 正面（朝咖啡馆那面）一块霓虹字
  const neonTex = neonTexture('半山夜场');
  const neonMat = new THREE.MeshStandardMaterial({ map: neonTex, emissive: '#ffffff', emissiveMap: neonTex, emissiveIntensity: 0.4, transparent: true, depthWrite: false, roughness: 0.5 });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), neonMat);
  neon.position.set(0, 0.52, -bd / 2 - 0.012);
  neon.rotation.y = Math.PI;
  booth.add(neon);

  let night = 0;
  return {
    setLevel(level) {
      night = Math.min(1, Math.max(0, (level - 0.6) / 1.8));
      bulbMat.emissiveIntensity = 0.15 + night * 2.4;
      neonMat.emissiveIntensity = 0.4 + night * 1.6;
      for (const s of spots) s.visible = night > 0.05;
    },
    update(dt, time) {
      const beats = (time * BPM) / 60;
      const ph = beats - Math.floor(beats);
      const hit = Math.pow(Math.max(0, Math.cos(ph * Math.PI * 2)), 2);
      const off = Math.pow(Math.max(0, Math.cos((ph - 0.5) * Math.PI * 2)), 2);
      const cx = (DISCO.lx0 + DISCO.lx1) / 2, cz = (DISCO.lz0 + DISCO.lz1) / 2 - 0.3;
      spots.forEach((s, i) => {
        if (!s.visible) return;
        s.position.x = cx + Math.sin(time * 0.37 + i * 1.7) * 0.9;
        s.position.z = cz + Math.sin(time * 0.29 + i * 2.3) * 1.7;
        s.scale.setScalar(0.85 + 0.25 * Math.sin(time * 0.5 + i));
        (s.material as THREE.MeshBasicMaterial).opacity = night * (0.18 + 0.5 * (i % 2 ? off : hit));
      });
      for (const r of records) r.rotation.y -= dt * 3.5;
      const lit = Math.floor(beats) % 4;
      leds.forEach((m, i) => (m.emissiveIntensity = i === lit ? 2.2 : 0.35));
    },
  };
}
