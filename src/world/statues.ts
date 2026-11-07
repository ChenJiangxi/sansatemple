// 佛坛上的三尊像：中间主尊（高丽铁佛扫描）、两侧戴冠菩萨（彩绘木雕观音扫描），统一做成金身
// 模型来源见 README 的「素材来源」。加载失败时保留空佛坛，不影响其他功能。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { lotusPedestal } from './hall';
import { mesh } from './util';

interface Slot {
  x: number;
  y: number;
  z: number;
  kind: 'main' | 'left' | 'right';
}

// 背光（目前后墙挂了佛画，不再使用，保留以便以后换场景）
// 菩提叶形的木板，红底金边，中间一圈圈光环
function mandorlaTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 768;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a1c14';
  g.fillRect(0, 0, 512, 768);
  const rg = g.createRadialGradient(256, 420, 20, 256, 420, 360);
  rg.addColorStop(0, '#a8442a');
  rg.addColorStop(1, '#4a140e');
  g.fillStyle = rg;
  g.fillRect(0, 0, 512, 768);
  g.strokeStyle = '#e0b45a';
  for (const [r, w] of [[120, 6], [150, 3], [210, 5], [235, 2]] as [number, number][]) {
    g.lineWidth = w;
    g.beginPath();
    g.ellipse(256, r < 160 ? 230 : 430, r, r * (r < 160 ? 1 : 1.25), 0, 0, Math.PI * 2);
    g.stroke();
  }
  // 火焰纹
  g.fillStyle = 'rgba(230,180,90,0.55)';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const x = 256 + Math.cos(a) * 225;
    const y = 430 + Math.sin(a) * 285;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(-12, 0);
    g.quadraticCurveTo(-6, -24, 0, -40);
    g.quadraticCurveTo(6, -24, 12, 0);
    g.closePath();
    g.fill();
    g.restore();
  }
  // 小化佛
  g.fillStyle = 'rgba(235,195,110,0.8)';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.15 + (i / 6) * 0.7) + Math.PI;
    const x = 256 + Math.cos(a) * 175;
    const y = 400 + Math.sin(a) * 250;
    g.beginPath();
    g.arc(x, y - 10, 9, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(x, y + 8, 14, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mandorla(w: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 0.55, 0, w * 0.55, h * 0.55, w * 0.42, h * 0.72);
  s.bezierCurveTo(w * 0.3, h * 0.86, w * 0.08, h * 0.92, 0, h);
  s.bezierCurveTo(-w * 0.08, h * 0.92, -w * 0.3, h * 0.86, -w * 0.42, h * 0.72);
  s.bezierCurveTo(-w * 0.55, h * 0.55, -w * 0.55, 0, 0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.06, bevelSegments: 2, curveSegments: 32 });
  // 正面 UV：按形状包围盒铺满贴图
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w * 0.6) / (w * 1.2), pos.getY(i) / h);
  const face = new THREE.MeshStandardMaterial({ map: mandorlaTexture(), roughness: 0.6, emissive: '#3a140c', emissiveIntensity: 0.25 });
  const rim = new THREE.MeshStandardMaterial({ color: '#c9973f', metalness: 0.9, roughness: 0.35 });
  return mesh(geo, [face, rim], false);
}

export function placeStatues(group: THREE.Group, slots: Slot[], env: THREE.Texture) {
  const goldA = new THREE.MeshStandardMaterial({ color: '#d6a24a', metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.6 });
  const goldB = new THREE.MeshStandardMaterial({ color: '#cf9c4c', metalness: 1, roughness: 0.34, envMap: env, envMapIntensity: 1.5 });
  const pedestalMat = new THREE.MeshStandardMaterial({ color: '#c99642', metalness: 0.9, roughness: 0.38, envMap: env, envMapIntensity: 1.2 });

  const spec = {
    main: { h: 3.2, pr: 1.25, ph: 0.75, mw: 4.4, mh: 6.0, file: 'buddha.glb', mat: goldA },
    left: { h: 2.3, pr: 0.9, ph: 0.55, mw: 2.8, mh: 4.0, file: 'bodhisattva.glb', mat: goldB },
    right: { h: 2.3, pr: 0.9, ph: 0.55, mw: 2.8, mh: 4.0, file: 'bodhisattva.glb', mat: goldB },
  } as const;

  const holders = slots.map((s) => {
    const sp = spec[s.kind];
    const holder = new THREE.Group();
    holder.position.set(s.x, s.y, s.z);
    const ped = lotusPedestal(pedestalMat, sp.pr, sp.ph);
    holder.add(ped);
    group.add(holder);
    return { slot: s, holder, sp };
  });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const base = new URL('models/', document.baseURI).toString();
  const cache = new Map<string, Promise<THREE.Object3D>>();
  const load = (file: string) => {
    if (!cache.has(file))
      cache.set(
        file,
        loader.loadAsync(base + file).then((g) => {
          g.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh && !m.geometry.attributes.normal) m.geometry.computeVertexNormals();
          });
          return g.scene;
        })
      );
    return cache.get(file)!;
  };

  return Promise.all(
    holders.map(async ({ slot, holder, sp }) => {
      const src = await load(sp.file);
      const obj = src.clone(true);
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = sp.mat;
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      obj.scale.setScalar(sp.h);
      // 右侧那尊左右镜像，让两尊菩萨对称地朝向中间
      if (slot.kind === 'right') obj.scale.x *= -1;
      obj.position.y = sp.ph - 0.04;
      obj.rotation.y = slot.kind === 'left' ? 0.12 : slot.kind === 'right' ? -0.12 : 0;
      holder.add(obj);
    })
  ).catch((e) => console.warn('佛像模型加载失败', e));
}
