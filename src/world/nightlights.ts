// 寺院两侧的夜间灯火：配殿门窗透出暖光、檐下红灯笼、钟鼓楼四角灯笼、配殿前一排石灯，
// 以及地上的一圈圈光晕。大多用自发光和贴地光晕来「假装」照亮，只给两座配殿各配一盏真实点光源，手机也跑得动。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIDE_HALLS, SIDE_LAMPS, BELL, DRUM } from '../layout';
import { chineseMats } from './hall';
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

// 红灯笼：椭圆灯身、上下金色箍、下垂流苏，顶上一根吊绳
function lanternGeos(hang: number) {
  const body = new THREE.LatheGeometry(
    [[0.0, -0.25], [0.12, -0.24], [0.22, -0.17], [0.27, -0.05], [0.27, 0.05], [0.22, 0.17], [0.12, 0.24], [0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y)),
    16
  );
  const gold = mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.13, 0.06, 12).translate(0, 0.27, 0),
    new THREE.CylinderGeometry(0.13, 0.12, 0.06, 12).translate(0, -0.27, 0),
    new THREE.CylinderGeometry(0.008, 0.008, hang, 4).translate(0, 0.3 + hang / 2, 0),
  ].map((g) => g.toNonIndexed()))!;
  const tassel = new THREE.ConeGeometry(0.06, 0.26, 8).rotateX(Math.PI).translate(0, -0.43, 0);
  return { body, gold, tassel };
}

export function buildNightLights(scene: THREE.Scene) {
  const group = new THREE.Group();
  const M = chineseMats();
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#c8281c', roughness: 0.6, emissive: '#ff4a20', emissiveIntensity: 0.15 });
  const lampLightMat = new THREE.MeshStandardMaterial({ color: '#f3dfb5', roughness: 0.8, emissive: '#ffbe6a', emissiveIntensity: 0.1 });
  const tasselMat = new THREE.MeshStandardMaterial({ color: '#b3201a', roughness: 0.8 });
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
  const L = lanternGeos(1.0);
  const lantern = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(L.body, lanternMat), new THREE.Mesh(L.gold, M.gold), new THREE.Mesh(L.tassel, tasselMat));
    g.position.set(x, y, z);
    parent.add(g);
    glow(parent, x, y, z, 1.6);
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

  // —— 钟楼、鼓楼：四角檐下各挂一盏 ——
  for (const T of [BELL, DRUM]) {
    const g = new THREE.Group();
    g.position.set(T.x, 0, T.z);
    const r = T.size / 2 - 0.4 + 0.75;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lantern(g, sx * r, T.platform + 4.8 - 0.35, sz * r);
    pool(g, 0, 0, 5.2);
    group.add(g);
  }

  // —— 配殿前、通往钟鼓楼的一排石灯 ——
  const stone = pbr('granite', { metersPerTile: 0.9, color: '#b8b2a6' });
  const parts: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  for (const [x, z] of SIDE_LAMPS) {
    const at = (gg: THREE.BufferGeometry, y: number) => gg.translate(x, y, z).toNonIndexed();
    parts.push(at(new THREE.BoxGeometry(0.56, 0.14, 0.56), 0.07));
    parts.push(at(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 8), 0.45));
    parts.push(at(new THREE.BoxGeometry(0.46, 0.08, 0.46), 0.8));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(at(new THREE.BoxGeometry(0.07, 0.34, 0.07).translate(sx * 0.16, 0, sz * 0.16), 1.01));
    parts.push(at(new THREE.BoxGeometry(0.5, 0.04, 0.5), 1.19));
    parts.push(at(new THREE.ConeGeometry(0.42, 0.24, 4).rotateY(Math.PI / 4), 1.32));
    parts.push(at(new THREE.SphereGeometry(0.06, 8, 6), 1.47));
    lights.push(at(new THREE.BoxGeometry(0.27, 0.3, 0.27), 1.01));
    glow(group, x, 1.02, z, 1.3);
    pool(group, x, z, 3.1);
  }
  const lampStone = new THREE.Mesh(mergeGeometries(parts)!, stone);
  lampStone.castShadow = lampStone.receiveShadow = true;
  group.add(lampStone, new THREE.Mesh(mergeGeometries(lights)!, lampLightMat));

  scene.add(group);
  return {
    // level：环境给出的灯笼亮度（白天约 0.25，黄昏 1.3，夜里 2.4）
    setLevel(level: number) {
      const n = Math.min(1, Math.max(0, (level - 0.6) / 1.8));
      lanternMat.emissiveIntensity = 0.15 + n * 1.8;
      lampLightMat.emissiveIntensity = 0.1 + n * 2.2;
      geshan.emissiveIntensity = n * 0.75;
      glowMat.opacity = n * 0.85;
      poolMat.opacity = n * 0.7;
      for (const l of hallLights) l.intensity = n * 30;
    },
  };
}
