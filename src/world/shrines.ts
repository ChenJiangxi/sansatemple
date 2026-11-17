// 两处小陈设：放生池边的河灯台（摆着一摞莲花灯，竖牌「河燈」），观音殿前的签筒桌（竹签筒，竖牌「求籤」）
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANTERN_STAND, FORTUNE, heightAt } from '../layout';
import { plaqueTexture, altarClothTexture } from '../textures';
import { chineseMats } from './hall';
import { lotusGeometry } from './pond';
import { mesh } from './util';

function sign(text: string) {
  const tex = plaqueTexture(text, true);
  const h = 0.62, w = h * (300 / (250 * [...text].length + 140));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  return m;
}

// 小方桌：桌面 + 四条腿 + 桌围（和大殿供桌同一种做旧的土黄缎子，垂下来有褶）
let clothTex: THREE.Texture | null = null;
function table(w: number, d: number, h: number) {
  const M = chineseMats();
  const g = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(w, 0.05, d), M.red);
  top.position.y = h;
  g.add(top);
  const legs: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) legs.push(new THREE.BoxGeometry(0.05, h, 0.05).translate((sx * (w - 0.08)) / 2, h / 2, (sz * (d - 0.08)) / 2));
  g.add(mesh(mergeGeometries(legs)!, M.redDark));
  const ch = h * 0.55;
  const geo = new THREE.PlaneGeometry(w + 0.02, ch, 24, 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / (w + 0.02)) * Math.PI * 10) * 0.008 * (0.3 + 0.7 * (ch / 2 - p.getY(i)) / ch));
  geo.computeVertexNormals();
  const cloth = mesh(geo, new THREE.MeshStandardMaterial({ map: (clothTex ??= altarClothTexture()), roughness: 0.85, side: THREE.DoubleSide }));
  cloth.position.set(0, h - h * 0.3, d / 2 + 0.02);
  g.add(cloth);
  return g;
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
    const s = sign('河燈');
    s.position.set(-0.62, 0.95, 0.05);
    g.add(s);
    const post = mesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), chineseMats().redDark);
    post.position.set(-0.62, 0.5, 0.0);
    g.add(post);
    g.position.set(LANTERN_STAND.x, heightAt(LANTERN_STAND.x, LANTERN_STAND.z), LANTERN_STAND.z);
    g.rotation.y = 0.15;
    g.traverse((o) => (o.userData.interact = { type: 'lantern' }));
    scene.add(g);
    interactives.push(g);
  }

  // —— 签筒桌 ——
  {
    const g = table(0.72, 0.72, 0.78);
    const bamboo = new THREE.MeshStandardMaterial({ color: '#b98a4a', roughness: 0.6 });
    const tube = mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.3, 20, 1, true), bamboo);
    tube.position.y = 0.95;
    g.add(tube);
    const ring = mesh(new THREE.TorusGeometry(0.085, 0.01, 6, 20), chineseMats().red);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.02;
    g.add(ring);
    const sticks: THREE.BufferGeometry[] = [];
    const tips: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4, r = 0.02 + (i % 4) * 0.014, h = 0.36 + (i % 5) * 0.012;
      const st = new THREE.BoxGeometry(0.012, h, 0.004).rotateZ((Math.cos(a) * r) * 1.2).rotateX(-(Math.sin(a) * r) * 1.2);
      st.translate(Math.cos(a) * r, 0.82 + h / 2, Math.sin(a) * r);
      sticks.push(st.toNonIndexed());
      tips.push(new THREE.BoxGeometry(0.013, 0.04, 0.005).translate(Math.cos(a) * r * 1.6, 0.82 + h - 0.01, Math.sin(a) * r * 1.6).toNonIndexed());
    }
    g.add(mesh(mergeGeometries(sticks)!, new THREE.MeshStandardMaterial({ color: '#d8bf8a', roughness: 0.7 })));
    g.add(mesh(mergeGeometries(tips)!, chineseMats().red));
    const s = sign('求籤');
    s.position.set(0, 1.25, -0.3);
    g.add(s);
    g.position.set(FORTUNE.x, heightAt(FORTUNE.x, FORTUNE.z), FORTUNE.z);
    g.rotation.y = Math.PI / 2; // 桌子正面朝向院子（+x）
    g.traverse((o) => (o.userData.interact = { type: 'fortune' }));
    scene.add(g);
    interactives.push(g);
  }

  return { interactives };
}
