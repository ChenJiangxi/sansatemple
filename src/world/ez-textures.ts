// 替换 ez-tree 自带的贴图模块：原模块在加载时把 20 张树皮、树叶图全部内联进 JS（约 4 MB），
// 这里只提供用得到的橡树、松树树皮和三种树叶，放在 public/tex/tree/，用到时才下载。
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
const base = () => new URL('tex/tree/', document.baseURI).toString();
function load(file: string, srgb: boolean) {
  let t = cache.get(file);
  if (!t) {
    t = loader.load(base() + file);
    t.premultiplyAlpha = true;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(file, t);
  }
  return t;
}

const BARK = new Set(['oak', 'pine']);
export function getBarkTexture(barkType: string, fileType: 'ao' | 'color' | 'normal' | 'roughness', scale = { x: 1, y: 1 }) {
  const type = BARK.has(barkType) ? barkType : 'oak';
  const texture = load(`${type}_${fileType}.jpg`, fileType === 'color');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x = scale.x;
  texture.repeat.y = 1 / scale.y;
  return texture;
}

const LEAVES = new Set(['ash', 'oak', 'pine']);
export function getLeafTexture(leafType: string) {
  return load(`${LEAVES.has(leafType) ? leafType : 'ash'}_leaves.png`, true);
}

// 进寺前在加载画面里先把用得到的树皮、树叶都下载好（不然树叶和远山林子会晚几秒才出现）
export async function preloadTreeTextures() {
  const files: [string, boolean][] = [];
  for (const t of BARK) for (const k of ['color', 'normal', 'roughness', 'ao']) files.push([`${t}_${k}.jpg`, k === 'color']);
  for (const l of LEAVES) files.push([`${l}_leaves.png`, true]);
  await Promise.all(
    files.map(async ([f, srgb]) => {
      if (cache.has(f)) return;
      try {
        const t = await loader.loadAsync(base() + f);
        t.premultiplyAlpha = true;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        cache.set(f, t);
      } catch {
        /* 下载失败就让用到时再试 */
      }
    })
  );
}
