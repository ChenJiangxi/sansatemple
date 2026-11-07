// 把下载的佛像扫描模型处理成游戏用的小文件：
// 去掉贴图和材质（游戏里统一换成金身）、合并成一个网格、减面、归一化（底面中心在原点、高 1 米）、meshopt 压缩
// 用法：node tools/prep-statue.mjs 输入.glb 输出.glb 目标三角形数
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, join, flatten, quantize, getBounds, transformMesh } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { mat4 } from 'gl-matrix';

const [, , input, output, targetStr] = process.argv;
const target = Number(targetStr || 60000);
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();

// 只保留几何体
for (const t of root.listTextures()) t.dispose();
const mat = doc.createMaterial('statue');
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  p.setMaterial(mat);
  for (const sem of p.listSemantics()) if (sem !== 'POSITION' && sem !== 'NORMAL') p.setAttribute(sem, null);
}
for (const m of root.listMaterials()) if (m !== mat) m.dispose();
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_materials_unlit') e.dispose();

await doc.transform(flatten(), join({ keepNamed: false }), weld({}), dedup(), prune());

let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
const ratio = Math.min(1, target / tris);
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }), prune());

// 归一化：底面中心到原点、高度 1
const scene = root.listScenes()[0];
const b = getBounds(scene);
const h = b.max[1] - b.min[1];
const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
const m = mat4.create();
mat4.scale(m, m, [1 / h, 1 / h, 1 / h]);
mat4.translate(m, m, [-cx, -b.min[1], -cz]);
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  // flatten 之后节点的变换已经烘焙进世界坐标，这里一并去掉
  const world = node.getWorldMatrix();
  const full = mat4.multiply(mat4.create(), m, world);
  transformMesh(mesh, full);
  node.setMatrix(mat4.create());
}
// 重新算法线，去掉 0 长度的
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10 }));
doc.createExtension((await import('@gltf-transform/extensions')).EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'filter' });
await io.write(output, doc);

let after = 0;
for (const mm of root.listMeshes()) for (const p of mm.listPrimitives()) after += p.getIndices().getCount() / 3;
console.log(`${input}: ${Math.round(tris)} → ${Math.round(after)} tris, height was ${h.toFixed(3)}`);
