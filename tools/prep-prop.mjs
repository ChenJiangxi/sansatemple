// 把下载的道具模型（gltf/glb）处理成游戏用的小 GLB：保留材质和贴图，
// 拍平节点、去重、焊点、可选减面、贴图缩到指定边长（macOS sips）、可选缩放到真实尺寸、
// 原点移到底面中心（min y = 0，x/z 居中），meshopt 压缩 + 量化后输出。
//
// 用法：
//   node tools/prep-prop.mjs <in.gltf|glb> <out.glb> [--tex 512] [--tris N] [--err 0.01]
//        [--height H | --scale S] [--rot x,y,z] [--min-alpha A] [--info] [--dump-tex DIR]
//   --tex N      贴图最长边上限（像素），默认 512
//   --tris N     减面目标三角形数（只在原始面数更多时生效）
//   --err E      减面允许误差（相对模型尺寸），默认 0.01
//   --height H   等比缩放，使模型高度为 H 米
//   --scale S    等比乘以 S（与 --height 二选一）
//   --rot x,y,z  先绕 X、Y、Z 轴依次旋转（角度），用于修正朝向/上轴
//   --min-alpha A 半透明材质的底色贴图 alpha 至少为 A（0–1），避免 alpha=0 的玻璃件在游戏里完全看不见
//   --info       只打印原始信息，不写文件
//   --dump-tex D 把最终贴图另存到目录 D，便于检查
import { NodeIO, Primitive, Mesh } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  flatten, join, weld, dedup, prune, simplify, meshopt, metalRough,
  getBounds, transformMesh, listTextureSlots,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { mat4 } from 'gl-matrix';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const pos = [];
const opt = { tex: 512, err: 0.01 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--info') opt.info = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = argv[++i];
  else pos.push(a);
}
const [input, output] = pos;
if (!input || (!output && !opt.info)) {
  console.error('usage: node tools/prep-prop.mjs <in> <out.glb> [--tex 512] [--tris N] [--err 0.01] [--height H | --scale S] [--rot x,y,z] [--info] [--dump-tex DIR]');
  process.exit(1);
}
if (opt.height && opt.scale) throw new Error('--height 和 --scale 只能二选一');
const texMax = Number(opt.tex);

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();

const fmt = (v) => v.map((x) => x.toFixed(3)).join(' × ');
const countTris = () => {
  let n = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    if (p.getMode() !== 4) continue;
    const idx = p.getIndices();
    n += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  return Math.round(n);
};
const sceneBounds = () => {
  const b = getBounds(root.getDefaultScene() || root.listScenes()[0]);
  return { min: b.min, max: b.max, size: [0, 1, 2].map((i) => b.max[i] - b.min[i]) };
};
const texSummary = (t) => {
  const s = t.getSize();
  return `${t.getName() || t.getURI() || '(unnamed)'} ${s ? s.join('x') : '?'} ${t.getMimeType()} ${(t.getImage()?.byteLength / 1024 || 0).toFixed(0)}KB [${listTextureSlots(t).join(',')}]`;
};

// ---------- 原始信息 ----------
const ext = root.listExtensionsUsed().map((e) => e.extensionName);
const nb = sceneBounds();
console.log(`in: ${input}`);
console.log(`  extensions: ${ext.join(', ') || '-'}`);
console.log(`  nodes ${root.listNodes().length}, meshes ${root.listMeshes().length}, materials ${root.listMaterials().length}, textures ${root.listTextures().length}, animations ${root.listAnimations().length}, skins ${root.listSkins().length}`);
console.log(`  native tris ${countTris()}, bbox ${fmt(nb.size)} (min ${fmt(nb.min)})`);
for (const m of root.listMaterials()) {
  console.log(`  material "${m.getName()}" alpha=${m.getAlphaMode()} doubleSided=${m.getDoubleSided()} base=${m.getBaseColorFactor().map((x) => x.toFixed(2)).join(',')} metal=${m.getMetallicFactor()} rough=${m.getRoughnessFactor()} exts=${m.listExtensions().map((e) => e.extensionName).join(',') || '-'}`);
}
for (const t of root.listTextures()) console.log(`  texture ${texSummary(t)}`);
if (opt.info) process.exit(0);

// ---------- 清理：道具是静态的，去掉动画/蒙皮/相机 ----------
for (const a of root.listAnimations()) a.dispose();
for (const n of root.listNodes()) { n.setSkin(null); n.setCamera(null); }
for (const s of root.listSkins()) s.dispose();
if (ext.includes('KHR_materials_pbrSpecularGlossiness')) {
  console.log('  converting KHR_materials_pbrSpecularGlossiness → metal/rough');
  await doc.transform(metalRough());
}

// ---------- 拍平，并把节点变换烘焙进顶点（之后所有节点都是单位矩阵，网格在世界坐标） ----------
await doc.transform(flatten());
const baked = new Set();
for (const node of root.listNodes()) {
  let mesh = node.getMesh();
  if (!mesh) continue;
  if (baked.has(mesh)) { mesh = mesh.clone(); node.setMesh(mesh); }
  transformMesh(mesh, node.getWorldMatrix());
  baked.add(mesh);
  node.setMatrix(mat4.create());
}
const transformAll = (m) => { for (const mesh of root.listMeshes()) transformMesh(mesh, m); };

if (opt.rot) {
  const [rx, ry, rz] = opt.rot.split(',').map((d) => (Number(d) * Math.PI) / 180);
  const r = mat4.create();
  mat4.rotateZ(r, r, rz); mat4.rotateY(r, r, ry); mat4.rotateX(r, r, rx); // 先 X 后 Y 再 Z
  transformAll(r);
}

await doc.transform(join({ keepNamed: false }), weld(), dedup(), prune());
const trisBefore = countTris();

// ---------- 减面 ----------
if (opt.tris && trisBefore > Number(opt.tris)) {
  const ratio = Number(opt.tris) / trisBefore;
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(opt.err), lockBorder: false }), prune());
}
const trisAfter = countTris();

// ---------- 透明模式 ----------
// Sketchfab 导出常把整个模型标成 BLEND，其实只有少数面（杯托网兜、玻璃料斗）是半透明的。
// 按每个三角形在底色贴图里的 alpha 分开：不透明的面换成 OPAQUE 材质，只把真半透明的面留在 BLEND，
// 避免整件道具在 three.js 里不写深度、排序出错。
for (const mat of root.listMaterials()) {
  if (mat.getAlphaMode() === 'OPAQUE' || mat.getBaseColorFactor()[3] < 1) continue;
  const tex = mat.getBaseColorTexture();
  const img = tex && tex.getMimeType() === 'image/png' ? decodePng(Buffer.from(tex.getImage())) : null;
  const label = `material "${mat.getName()}" ${mat.getAlphaMode()}`;
  if (!tex || tex.getMimeType() === 'image/jpeg' || (img && !img.alpha && !img.trns)) {
    console.log(`  ${label} → OPAQUE (base color has no alpha)`);
    mat.setAlphaMode('OPAQUE');
    continue;
  }
  if (!img || !img.alpha) { console.log(`  ${label}: kept (alpha not readable)`); continue; }
  const tc = mat.getBaseColorTextureInfo().getTexCoord();
  const alphaAt = (u, v) => {
    const x = Math.min(img.w - 1, Math.floor((u - Math.floor(u)) * img.w));
    const y = Math.min(img.h - 1, Math.floor((v - Math.floor(v)) * img.h));
    return img.px[(y * img.w + x) * img.bpp + img.bpp - 1];
  };
  let opaqueMat = null, nOpaque = 0, nTrans = 0;
  const getOpaque = () => (opaqueMat ??= mat.clone().setName(`${mat.getName()}_opaque`).setAlphaMode('OPAQUE'));
  for (const prim of mat.listParents().filter((p) => p instanceof Primitive)) {
    const uv = prim.getAttribute(`TEXCOORD_${tc}`), idx = prim.getIndices();
    if (!uv || !idx || prim.getMode() !== 4) continue;
    const keep = [], trans = [], t = [0, 0];
    for (let i = 0; i < idx.getCount(); i += 3) {
      const ids = [idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2)];
      const uvs = ids.map((id) => [...uv.getElement(id, t)]);
      // 三角形内部取 4 个点（中心 + 偏向三个顶点各一点），避开贴图岛边缘的空白填充
      let sum = 0;
      for (const w of [[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]]) {
        sum += alphaAt(w[0] * uvs[0][0] + w[1] * uvs[1][0] + w[2] * uvs[2][0], w[0] * uvs[0][1] + w[1] * uvs[1][1] + w[2] * uvs[2][1]);
      }
      (sum / 4 < 240 ? trans : keep).push(...ids);
    }
    nOpaque += keep.length / 3; nTrans += trans.length / 3;
    if (!keep.length) continue;
    if (!trans.length) { prim.setMaterial(getOpaque()); continue; }
    const Arr = uv.getCount() > 65535 ? Uint32Array : Uint16Array;
    const opaquePrim = prim.clone().setMaterial(getOpaque()).setIndices(doc.createAccessor().setArray(new Arr(keep)));
    prim.setIndices(doc.createAccessor().setArray(new Arr(trans)));
    for (const mesh of prim.listParents().filter((p) => p instanceof Mesh)) mesh.addPrimitive(opaquePrim);
  }
  if (!nTrans) mat.setAlphaMode('OPAQUE');
  if (nTrans && opt['min-alpha']) {
    const minA = Math.round(Number(opt['min-alpha']) * 255);
    for (let i = img.bpp - 1; i < img.px.length; i += img.bpp) if (img.px[i] < minA) img.px[i] = minA;
    tex.setImage(new Uint8Array(encodePng(img)));
    console.log(`  ${label}: base color alpha raised to ≥ ${minA}/255`);
  }
  console.log(`  ${label}: ${nOpaque} tris → OPAQUE, ${nTrans} tris stay ${nTrans ? mat.getAlphaMode() : '-'}`);
}
await doc.transform(prune());

// ---------- 贴图：缩到 texMax，以 JPEG 输出（需要透明的保持 PNG） ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prep-prop-'));
try {
  const extOf = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  for (const tex of root.listTextures()) {
    const mime = tex.getMimeType();
    const img = tex.getImage();
    if (!img || !extOf[mime]) { console.log(`  skip texture (${mime})`); continue; }
    const slots = listTextureSlots(tex);
    const src = path.join(tmp, `src.${extOf[mime]}`);
    fs.writeFileSync(src, img);
    // 只有被非 OPAQUE 材质当底色用、且图片真带 alpha 通道时才保留 PNG
    const usedAsAlpha = root.listMaterials().some((m) => m.getBaseColorTexture() === tex && m.getAlphaMode() !== 'OPAQUE');
    const hasAlpha = mime !== 'image/jpeg' && /hasAlpha: yes/.test(execFileSync('sips', ['-g', 'hasAlpha', src], { encoding: 'utf8' }));
    const keepPng = usedAsAlpha && hasAlpha;
    const isNormal = slots.includes('normalTexture');
    const size = tex.getSize() || [Infinity, Infinity];
    const needResize = Math.max(...size) > texMax;
    const dst = path.join(tmp, keepPng ? 'dst.png' : 'dst.jpg');
    const args = [];
    if (needResize) args.push('-Z', String(texMax));
    if (keepPng) args.push('-s', 'format', 'png');
    else args.push('-s', 'format', 'jpeg', '-s', 'formatOptions', isNormal ? '90' : '82');
    execFileSync('sips', [...args, src, '--out', dst], { stdio: 'ignore' });
    const out = fs.readFileSync(dst);
    // 没缩放且新文件更大就保留原图
    if (needResize || out.byteLength < img.byteLength || (mime === 'image/png' && !keepPng)) {
      tex.setImage(new Uint8Array(out)).setMimeType(keepPng ? 'image/png' : 'image/jpeg');
    }
    tex.setURI('');
    fs.rmSync(src); fs.rmSync(dst);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------- 缩放 + 原点移到底面中心 ----------
const b0 = sceneBounds();
let s = 1;
if (opt.height) s = Number(opt.height) / b0.size[1];
else if (opt.scale) s = Number(opt.scale);
const cx = (b0.min[0] + b0.max[0]) / 2, cz = (b0.min[2] + b0.max[2]) / 2;
const m = mat4.create();
mat4.scale(m, m, [s, s, s]);
mat4.translate(m, m, [-cx, -b0.min[1], -cz]);
transformAll(m);
const fb = sceneBounds();

await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
fs.mkdirSync(path.dirname(output), { recursive: true });
await io.write(output, doc);

if (opt['dump-tex']) {
  fs.mkdirSync(opt['dump-tex'], { recursive: true });
  const base = path.basename(output, '.glb');
  root.listTextures().forEach((t, i) => {
    const e = t.getMimeType() === 'image/png' ? 'png' : 'jpg';
    fs.writeFileSync(path.join(opt['dump-tex'], `${base}_${i}_${listTextureSlots(t).join('+')}.${e}`), t.getImage());
  });
}

// 把 decodePng 的结果重新编码成 PNG（不做行过滤，之后 sips 会再压一次）
function encodePng({ w, h, bpp, px }) {
  const stride = w * bpp, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) raw.set(px.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = bpp === 4 ? 6 : 4;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 解码 PNG（只解带 alpha 通道的 8 位非隔行图）。返回 { alpha: false, trns } 表示没有 alpha 通道；
// { alpha: true, w, h, bpp, px } 为解码后的像素；null 表示这种 PNG 读不了。
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0, trns = false;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'tRNS') trns = true;
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (ctype !== 6 && ctype !== 4) return { alpha: false, trns };
  if (depth !== 8 || interlace) return null;
  const bpp = ctype === 6 ? 4 : 2, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(h * stride);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let x = line[i];
      if (ft === 1) x += a;
      else if (ft === 2) x += b;
      else if (ft === 3) x += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); x += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = x & 255;
    }
    prev = cur;
  }
  return { alpha: true, w, h, bpp, px };
}

console.log(`out: ${output}`);
console.log(`  tris ${trisBefore} → ${trisAfter}, scale ×${s.toFixed(4)}, size ${(fs.statSync(output).size / 1024 / 1024).toFixed(3)} MB`);
console.log(`  bbox (x,y,z) ${fmt(fb.size)} m (before scale ${fmt(b0.size)})`);
console.log(`  materials ${root.listMaterials().length}, textures ${root.listTextures().length}`);
for (const t of root.listTextures()) console.log(`  texture ${texSummary(t)}`);
