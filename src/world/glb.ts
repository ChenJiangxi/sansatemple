// 道具模型（public/models/props/*.glb，由 tools/prep-prop.mjs 处理过：原点在底面中心、meshopt 压缩）的加载器。
// 同一个文件只下载一次；每次取用都克隆一份（几何体和材质共用）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<THREE.Object3D>>();
// 道具模型（咖啡馆、围炉，共约 2.5 MB）等进寺以后再下，不和加载画面里的贴图抢网速；主程序在第一帧画出来后放行
let release!: () => void;
const gate = new Promise<void>((r) => (release = r));
export function releaseProps() {
  release();
}

export function loadProp(name: string, shadow = true): Promise<THREE.Object3D> {
  if (!cache.has(name)) {
    const url = new URL(`models/props/${name}.glb`, document.baseURI).toString();
    cache.set(
      name,
      gate.then(() => loader.loadAsync(url)).then((g) => {
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = shadow;
          m.receiveShadow = true;
          for (const mat of ([] as THREE.Material[]).concat(m.material)) {
            const s = mat as THREE.MeshStandardMaterial;
            if (s.map) s.map.anisotropy = 4;
          }
        });
        return g.scene;
      })
    );
  }
  return cache.get(name)!.then((o) => o.clone(true));
}
