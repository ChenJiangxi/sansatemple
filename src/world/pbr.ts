// 照片级材质（Poly Haven，CC0）：颜色 + 法线 + 粗糙度三张贴图。
// UV 以米为单位时，用 metersPerTile 控制一张贴图覆盖多少米。
import * as THREE from 'three';

export type PbrName = 'floor' | 'wood' | 'path' | 'granite' | 'stonewall' | 'ground' | 'roof' | 'plaster';

const loader = new THREE.TextureLoader();
const base = () => new URL('tex/', document.baseURI).toString();
const cache = new Map<string, THREE.Texture>();
let maxAniso = 8;

export function setMaxAnisotropy(n: number) {
  maxAniso = Math.min(8, n);
}

function tex(file: string, srgb: boolean) {
  let t = cache.get(file);
  if (!t) {
    t = loader.load(base() + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(file, t);
  }
  return t;
}

// 进场前先把所有贴图下载好，避免一边渲染一边上传、闪出白模
export async function preloadTextures(onProgress?: (done: number, total: number) => void) {
  const names: PbrName[] = ['floor', 'wood', 'path', 'granite', 'stonewall', 'ground', 'roof', 'plaster'];
  const files: [string, boolean][] = [];
  for (const n of names) files.push([`${n}_color.jpg`, true], [`${n}_normal.jpg`, false], [`${n}_rough.jpg`, false]);
  files.push(['sky.jpg', true], ['mural.jpg', true]);
  let done = 0;
  await Promise.all(
    files.map(async ([f, srgb]) => {
      try {
        const t = await loader.loadAsync(base() + f);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = maxAniso;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        cache.set(f, t);
      } catch (e) {
        console.warn('贴图加载失败', f, e);
      }
      onProgress?.(++done, files.length);
    })
  );
}

export function loadTexture(file: string, srgb = true) {
  return tex(file, srgb);
}

interface Opts {
  metersPerTile?: number;
  color?: THREE.ColorRepresentation;
  roughness?: number;
  normalScale?: number;
  side?: THREE.Side;
  rotate?: boolean; // 贴图旋转 90°（木纹改成竖向等）
}

export function pbr(name: PbrName, o: Opts = {}) {
  const r = 1 / (o.metersPerTile ?? 2);
  const set = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(r, r);
    if (o.rotate) {
      c.center.set(0.5, 0.5);
      c.rotation = Math.PI / 2;
    }
    c.needsUpdate = true;
    return c;
  };
  return new THREE.MeshStandardMaterial({
    map: set(tex(`${name}_color.jpg`, true)),
    normalMap: set(tex(`${name}_normal.jpg`, false)),
    roughnessMap: set(tex(`${name}_rough.jpg`, false)),
    normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
    roughness: o.roughness ?? 1,
    color: o.color ?? '#ffffff',
    side: o.side ?? THREE.FrontSide,
  });
}
