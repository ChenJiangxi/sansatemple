// 写实的树：用 ez-tree（MIT）按预设长出枝干和叶片，每种树只长几棵样板，
// 再用实例化网格摆到各处；材质换成 PBR，好吃到天空的环境光；叶子随风轻摆。
import * as THREE from 'three';
import { Tree, TreePreset } from 'ez-tree-src';

export interface TreeKind {
  preset: keyof typeof TreePreset;
  seed: number;
  height: number; // 米
  tint?: number; // 叶色
  bark?: number; // 树皮色
  leafCount?: number;
  leafSize?: number;
  lite?: boolean; // 远处用：枝干分段更少
}

export interface TreeVariant {
  branches: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
  barkMat: THREE.MeshStandardMaterial;
  leafMat: THREE.MeshStandardMaterial;
  leafDepth: THREE.MeshDepthMaterial;
  height: number;
  tris: number;
}

const windU = { value: 0 };
export function treeWind(t: number) {
  windU.value = t;
}

// 叶子随风摆：越高摆得越大，每棵树的相位按位置错开
function sway(mat: THREE.Material, height: number, amp: number, gray = false) {
  mat.onBeforeCompile = (sh) => {
    // 叶片贴图本身是绿色：先取亮度变成灰，再乘叶色，才染得出银杏黄、枫红
    if (gray)
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float lum = dot(diffuseColor.rgb / max(diffuse, vec3(0.001)), vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = diffuse * clamp(lum * 1.9, 0.0, 1.4);`
      );
    sh.uniforms.uWind = windU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        float k = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0);
        k *= k;
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.21;
        #endif
        float w = sin(uWind * 1.1 + ph) * 0.6 + sin(uWind * 2.3 + ph * 1.7 + position.x * 0.4) * 0.4;
        transformed.x += w * ${amp.toFixed(3)} * k;
        transformed.z += cos(uWind * 0.9 + ph * 1.3 + position.z * 0.4) * ${(amp * 0.7).toFixed(3)} * k;
      }`
    );
  };
}

export function makeVariant(k: TreeKind): TreeVariant {
  const tree = new Tree();
  tree.loadPreset(k.preset);
  tree.options.seed = k.seed;
  if (k.tint !== undefined) tree.options.leaves.tint = k.tint;
  if (k.leafCount !== undefined) tree.options.leaves.count = k.leafCount;
  if (k.leafSize !== undefined) tree.options.leaves.size = k.leafSize;
  if (k.bark !== undefined) tree.options.bark.tint = k.bark;
  if (k.lite) {
    const br = tree.options.branch as unknown as { sections: Record<number, number>; segments: Record<number, number> };
    for (const lv of [0, 1, 2, 3]) {
      if (br.sections[lv] !== undefined) br.sections[lv] = Math.max(2, Math.round(br.sections[lv] * 0.55));
      if (br.segments[lv] !== undefined) br.segments[lv] = Math.max(3, Math.round(br.segments[lv] * 0.6));
    }
  }
  tree.generate();
  const bb = new THREE.Box3().setFromObject(tree);
  const s = k.height / Math.max(0.001, bb.max.y - bb.min.y);
  const fit = (g: THREE.BufferGeometry) => {
    const c = g.clone();
    c.translate(0, -bb.min.y, 0);
    c.scale(s, s, s);
    c.computeBoundingSphere();
    return c;
  };
  const branches = fit(tree.branchesMesh.geometry);
  const leaves = fit(tree.leavesMesh.geometry);
  const ob = tree.branchesMesh.material as THREE.MeshPhongMaterial;
  const ol = tree.leavesMesh.material as THREE.MeshPhongMaterial;
  const barkMat = new THREE.MeshStandardMaterial({
    map: ob.map,
    normalMap: ob.normalMap,
    roughnessMap: (ob as unknown as { roughnessMap: THREE.Texture | null }).roughnessMap,
    aoMap: ob.aoMap,
    color: ob.color.clone(),
    roughness: 1,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    map: ol.map,
    color: ol.color.clone(),
    side: THREE.DoubleSide,
    alphaTest: ol.alphaTest,
    roughness: 0.75,
  });
  sway(leafMat, k.height, 0.22, k.tint !== undefined);
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ol.map, alphaTest: ol.alphaTest });
  sway(leafDepth, k.height, 0.22);
  const tris = ((branches.index?.count ?? 0) + (leaves.index?.count ?? 0)) / 3;
  return { branches, leaves, barkMat, leafMat, leafDepth, height: k.height, tris };
}

export interface TreePlace {
  x: number;
  y?: number;
  z: number;
  s: number; // 相对样板的缩放
  yaw: number;
  tint?: THREE.Color; // 每棵叶色微调
}

// 把一种样板摆到多处
export function plantTrees(group: THREE.Group, v: TreeVariant, places: TreePlace[], shadows = true) {
  if (!places.length) return;
  const b = new THREE.InstancedMesh(v.branches, v.barkMat, places.length);
  const l = new THREE.InstancedMesh(v.leaves, v.leafMat, places.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  places.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw);
    m.compose(p.set(t.x, t.y ?? -0.05, t.z), q, sc.set(t.s, t.s, t.s));
    b.setMatrixAt(i, m);
    l.setMatrixAt(i, m);
    if (t.tint) l.setColorAt(i, t.tint);
  });
  b.castShadow = l.castShadow = shadows;
  b.receiveShadow = l.receiveShadow = true;
  l.customDepthMaterial = v.leafDepth;
  b.computeBoundingSphere();
  l.computeBoundingSphere();
  group.add(b, l);
}
