// 远山上的林子：把写实树的样板从侧面「拍」成一张透明背景的图（只记颜色、不带光照），
// 再用两张十字交叉的面片摆几千棵。远看和真树一样，开销只是每棵 4 个三角形；
// 用标准材质接收场景的光，所以白天亮、夜里暗。
import * as THREE from 'three';
import type { TreeVariant } from './trees';

export interface Impostor {
  material: THREE.MeshStandardMaterial;
  geometry: THREE.BufferGeometry;
}

// 叶片贴图要先变灰再染色（和 trees.ts 里一样），这里给不受光的基础材质也加上
function grayTint(mat: THREE.Material) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float lum = dot(diffuseColor.rgb / max(diffuse, vec3(0.001)), vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = diffuse * clamp(lum * 1.9, 0.0, 1.4);`
    );
  };
}

export function bakeImpostor(renderer: THREE.WebGLRenderer, v: TreeVariant, gray: boolean, size = 256): Impostor {
  const scene = new THREE.Scene();
  const bark = new THREE.MeshBasicMaterial({ map: v.barkMat.map, color: v.barkMat.color });
  const leaf = new THREE.MeshBasicMaterial({ map: v.leafMat.map, color: v.leafMat.color, alphaTest: v.leafMat.alphaTest, side: THREE.DoubleSide });
  if (gray) grayTint(leaf);
  scene.add(new THREE.Mesh(v.branches, bark), new THREE.Mesh(v.leaves, leaf));
  v.leaves.computeBoundingBox();
  v.branches.computeBoundingBox();
  const bb = v.leaves.boundingBox!.clone().union(v.branches.boundingBox!);
  const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 1.02;
  const h = bb.max.y * 1.02;
  const aspect = w / h;
  const tw = Math.round(size * Math.min(1, aspect)), th = Math.round(size / Math.max(1, aspect));
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h, 0, -100, 100);
  cam.position.set(0, 0, 50);
  const rt = new THREE.WebGLRenderTarget(tw, th, { samples: 4 });
  const prev = { target: renderer.getRenderTarget(), tone: renderer.toneMapping, color: new THREE.Color(), alpha: renderer.getClearAlpha() };
  renderer.getClearColor(prev.color);
  renderer.setRenderTarget(rt);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev.target);
  renderer.toneMapping = prev.tone;
  renderer.setClearColor(prev.color, prev.alpha);
  bark.dispose();
  leaf.dispose();
  const tex = rt.texture;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  // 两张十字交叉的面片，底边在 y = 0；法线都朝上偏外，受光均匀
  const a = new THREE.PlaneGeometry(w, h);
  a.translate(0, h / 2, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  const merged = [a, b];
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of merged) {
    const p = g.attributes.position as THREE.BufferAttribute, u = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      uv.push(u.getX(i), u.getY(i));
      const n = new THREE.Vector3(p.getX(i), h * 0.8, p.getZ(i)).normalize();
      nor.push(n.x, n.y, n.z);
    }
    for (let i = 0; i < g.index!.count; i++) idx.push(g.index!.getX(i) + off);
    off += p.count;
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const material = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
  return { material, geometry: geo };
}

// 等树皮、叶片贴图都下载好再拍（不然拍出来是空的）
export function whenTexturesReady(textures: (THREE.Texture | null | undefined)[], cb: () => void) {
  const ready = () => textures.every((t) => !t || (t.image && ((t.image as HTMLImageElement).complete ?? true) && ((t.image as HTMLImageElement).naturalWidth ?? 1) > 0));
  const tick = () => (ready() ? cb() : setTimeout(tick, 150));
  tick();
}
