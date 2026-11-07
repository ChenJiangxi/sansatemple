// 佛坛上「一佛二弟子」：中间释迦牟尼佛（高丽铁佛扫描，降魔印），两侧迦叶、阿难二尊者立像
// （克利夫兰艺术博物馆光头立像扫描），统一做成金身
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

// 菩提叶形的木板，红底金边，中间一圈圈光环
function mandorlaTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 768;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9963e';
  g.fillRect(0, 0, 512, 768);
  // 外圈火焰纹
  g.strokeStyle = 'rgba(110,62,18,0.55)';
  g.lineWidth = 5;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const x = 256 + Math.cos(a) * 215;
    const y = 430 + Math.sin(a) * 300;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(-14, 10);
    g.quadraticCurveTo(-8, -20, 0, -46);
    g.quadraticCurveTo(10, -18, 14, 10);
    g.stroke();
    g.restore();
  }
  // 头光、身光的同心圈
  g.lineWidth = 6;
  for (const [cy, rx, ry] of [[230, 118, 118], [230, 150, 150], [440, 196, 250], [440, 165, 215]] as [number, number, number][]) {
    g.beginPath();
    g.ellipse(256, cy, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // 卷草纹
  g.lineWidth = 3;
  for (let k = 0; k < 60; k++) {
    const a = Math.random() * Math.PI * 2;
    const d = 160 + Math.random() * 40;
    const x = 256 + Math.cos(a) * d * 0.9, y = 440 + Math.sin(a) * d * 1.2;
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 1.4);
    g.stroke();
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
  const face = new THREE.MeshStandardMaterial({ map: mandorlaTexture(), metalness: 0.75, roughness: 0.42, envMapIntensity: 1.2 });
  const rim = new THREE.MeshStandardMaterial({ color: '#d1a24a', metalness: 0.9, roughness: 0.32 });
  return mesh(geo, [face, rim], false);
}

export function placeStatues(group: THREE.Group, slots: Slot[], env: THREE.Texture) {
  const goldA = new THREE.MeshStandardMaterial({ color: '#d6a24a', metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.6 });
  const goldB = new THREE.MeshStandardMaterial({ color: '#cf9c4c', metalness: 1, roughness: 0.34, envMap: env, envMapIntensity: 1.5 });
  const pedestalMat = new THREE.MeshStandardMaterial({ color: '#c99642', metalness: 0.9, roughness: 0.38, envMap: env, envMapIntensity: 1.2 });

  const spec = {
    main: { h: 3.2, pr: 1.25, ph: 0.75, mw: 4.0, mh: 5.4, file: 'buddha.glb', mat: goldA },
    left: { h: 2.55, pr: 0.62, ph: 0.4, mw: 0, mh: 0, file: 'disciple.glb', mat: goldB },
    right: { h: 2.55, pr: 0.62, ph: 0.4, mw: 0, mh: 0, file: 'disciple.glb', mat: goldB },
  } as const;

  const holders = slots.map((s) => {
    const sp = spec[s.kind];
    const holder = new THREE.Group();
    holder.position.set(s.x, s.y, s.z);
    const ped = lotusPedestal(pedestalMat, sp.pr, sp.ph);
    holder.add(ped);
    if (s.kind === 'main') {
      // 主尊：鎏金背光（头光 + 身光）
      const back = mandorla(sp.mw, sp.mh);
      back.position.set(0, -0.05, -1.4);
      (back.material as THREE.Material[]).forEach((m) => ((m as THREE.MeshStandardMaterial).envMap = env));
      holder.add(back);
    } else {
      // 弟子：只有圆形头光
      const haloY = sp.ph + sp.h * 0.88;
      const disc = mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshStandardMaterial({ color: '#b98a3a', metalness: 0.8, roughness: 0.45, envMap: env, side: THREE.DoubleSide }), false);
      disc.position.set(0, haloY, -0.52);
      holder.add(disc);
      const ring = mesh(new THREE.TorusGeometry(0.44, 0.03, 8, 48), goldA, false);
      ring.position.set(0, haloY, -0.5);
      holder.add(ring);
    }
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
      // 两位弟子略微侧身，朝向中间的佛
      obj.rotation.y = slot.kind === 'left' ? 0.28 : slot.kind === 'right' ? -0.28 : 0;
      holder.add(obj);
    })
  ).catch((e) => console.warn('佛像模型加载失败', e));
}
