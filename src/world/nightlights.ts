// 寺院两侧的夜间灯火：配殿门窗透出暖光、檐下红灯笼、钟楼四角灯笼、配殿前一排石灯，
// 以及地上的一圈圈光晕。檐下和钟楼的灯笼本身由 props.ts 和参道灯笼一起画（同一种瓜棱绸面灯），这里只给出位置和光晕。大多用自发光和贴地光晕来「假装」照亮，只给两座配殿各配一盏真实点光源，手机也跑得动。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIDE_HALLS, SIDE_LAMPS, BELL } from '../layout';
import { chineseMats, aged } from './hall';
import { pbr } from './pbr';

function radialTexture(stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildNightLights(scene: THREE.Scene) {
  const group = new THREE.Group();
  const M = chineseMats();
  const lampLightMat = new THREE.MeshStandardMaterial({ color: '#f3dfb5', roughness: 0.8, emissive: '#ffbe6a', emissiveIntensity: 0.1 });
  const glowMat = new THREE.SpriteMaterial({
    map: radialTexture([[0, 'rgba(255,214,150,1)'], [0.3, 'rgba(255,170,90,0.4)'], [1, 'rgba(255,140,60,0)']]),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(255,165,80,0.8)'], [0.45, 'rgba(240,120,50,0.3)'], [1, 'rgba(220,100,40,0)']]),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const poolGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  const pool = (parent: THREE.Object3D, x: number, z: number, rx: number, rz = rx) => {
    const m = new THREE.Mesh(poolGeo, poolMat);
    m.position.set(x, 0.04, z);
    m.scale.set(rx, 1, rz);
    m.renderOrder = 2;
    parent.add(m);
  };
  const glow = (parent: THREE.Object3D, x: number, y: number, z: number, s: number) => {
    const sp = new THREE.Sprite(glowMat);
    sp.position.set(x, y, z);
    sp.scale.setScalar(s);
    parent.add(sp);
  };
  // 灯笼只记下世界坐标（交给 props.ts 画），这里放光晕
  const lanterns: THREE.Vector3[] = [];
  const lantern = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    glow(parent, x, y, z, 1.6);
    parent.updateMatrixWorld(true);
    lanterns.push(new THREE.Vector3(x, y, z).applyMatrix4(parent.matrixWorld));
  };

  // —— 配殿：格扇门透出屋里的灯光、檐下四盏红灯笼、门前一盏暖色点光源 ——
  // 格扇门的纸面在夜里发光（大殿两侧关着的门也一起亮）
  const geshan = M.geshan as THREE.MeshStandardMaterial;
  geshan.emissive = new THREE.Color('#ffb060');
  geshan.emissiveMap = geshan.map;
  geshan.emissiveIntensity = 0;
  geshan.needsUpdate = true;
  const hallLights: THREE.PointLight[] = [];
  for (const def of SIDE_HALLS) {
    const g = new THREE.Group();
    g.position.set(def.x, 0, def.z);
    g.rotation.y = def.yaw;
    const hx = def.d / 2 - 0.4, hz = def.w / 2 - 0.4, colTop = 0.6 + 4.2;
    for (const x of [-hx * 0.75, -hx * 0.25, hx * 0.25, hx * 0.75]) lantern(g, x, colTop - 0.95, hz + 1.0);
    const pl = new THREE.PointLight('#ffb070', 0, 18, 1.6);
    pl.position.set(0, 3.2, hz + 3.6);
    g.add(pl);
    hallLights.push(pl);
    pool(g, 0, hz + 3.4, 7.5, 3.4);
    group.add(g);
  }

  // —— 钟楼：四角檐下各挂一盏 ——
  for (const T of [BELL]) {
    const g = new THREE.Group();
    g.position.set(T.x, 0, T.z);
    const r = T.size / 2 - 0.4 + 0.75;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lantern(g, sx * r, T.platform + 4.8 - 0.35, sz * r);
    pool(g, 0, 0, 5.2);
    group.add(g);
  }

  // —— 配殿前、通往钟楼的一排石灯 ——
  // 六角石灯：土衬、须弥座、灯柱、中台、六根小柱围着灯室、六角攒尖顶加宝珠
  const stone = pbr('granite', { metersPerTile: 0.9, color: new THREE.Color().setRGB(2.3, 2.22, 2.08) });
  aged(stone, 0.12, 0.3);
  const parts: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  for (const [x, z] of SIDE_LAMPS) {
    const at = (gg: THREE.BufferGeometry, y: number) => gg.translate(x, y, z).toNonIndexed();
    parts.push(at(new THREE.CylinderGeometry(0.3, 0.33, 0.12, 6), 0.06));
    parts.push(at(new THREE.CylinderGeometry(0.2, 0.27, 0.12, 6), 0.18));
    parts.push(at(new THREE.CylinderGeometry(0.09, 0.11, 0.56, 6), 0.52));
    parts.push(at(new THREE.CylinderGeometry(0.27, 0.15, 0.13, 6), 0.865));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      parts.push(at(new THREE.BoxGeometry(0.05, 0.3, 0.05).rotateY(-a).translate(Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19), 1.08));
    }
    parts.push(at(new THREE.CylinderGeometry(0.42, 0.4, 0.04, 6), 1.25));
    parts.push(at(new THREE.CylinderGeometry(0.05, 0.36, 0.2, 6), 1.37));
    parts.push(at(new THREE.CylinderGeometry(0.035, 0.05, 0.06, 6), 1.5));
    parts.push(at(new THREE.SphereGeometry(0.055, 8, 6), 1.57));
    lights.push(at(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 6), 1.08));
    glow(group, x, 1.02, z, 1.3);
    pool(group, x, z, 3.1);
  }
  const lampStone = new THREE.Mesh(mergeGeometries(parts)!, stone);
  lampStone.castShadow = lampStone.receiveShadow = true;
  group.add(lampStone, new THREE.Mesh(mergeGeometries(lights)!, lampLightMat));

  scene.add(group);
  return {
    lanterns,
    // level：环境给出的灯笼亮度（白天约 0.25，黄昏 1.3，夜里 2.4）
    setLevel(level: number) {
      const n = Math.min(1, Math.max(0, (level - 0.6) / 1.8));
      lampLightMat.emissiveIntensity = 0.1 + n * 1.1;
      geshan.emissiveIntensity = n * 0.75;
      glowMat.opacity = n * 0.85;
      poolMat.opacity = n * 0.7;
      for (const l of hallLights) l.intensity = n * 30;
    },
  };
}
