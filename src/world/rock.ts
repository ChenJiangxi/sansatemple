// 石头：先把球面焊成一整块（顶点共享，面和面之间不会裂开），再用平滑噪声起伏、
// 几刀平面削出棱面、压平底部；贴图用世界坐标三向投影，石纹不会被拉长。
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../textures';

// 三维值噪声（格点上取伪随机数，三线性插值，smoothstep 过渡）
function noise3(seed: number) {
  const hash = (x: number, y: number, z: number) => {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144269) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
    return l(
      l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
      l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
      fz
    ) * 2 - 1;
  };
}

// 一块石头，大致是半径 1 的扁圆块，底面在 y = -0.35 附近
export function rockGeometry(seed: number, detail = 4, cuts = 7) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const r = rng(seed);
  const n = noise3(seed);
  const planes = Array.from({ length: cuts }, () => {
    const d = new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.2, r() - 0.5).normalize();
    return { d, o: 0.62 + r() * 0.2 };
  });
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const off = r() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1.6;
    const big = n(v.x * k + off, v.y * k, v.z * k);
    const fine = n(v.x * 4.5, v.y * 4.5 + off, v.z * 4.5) * 0.5 + n(v.x * 9, v.y * 9, v.z * 9 + off) * 0.25;
    v.multiplyScalar(1 + big * 0.24 + fine * 0.09);
    // 平面削去凸出的部分，留下像劈开过的棱面
    for (const pl of planes) {
      const over = v.dot(pl.d) - pl.o;
      if (over > 0) v.addScaledVector(pl.d, -over * 0.92);
    }
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  g.computeVertexNormals();
  return g;
}

// 石纹：灰褐底上叠几层大小不一的明暗斑、细麻点和浅色地衣斑；斑点在四边绕回，可以无缝平铺
let rockTex: THREE.CanvasTexture | null = null;
function rockTexture() {
  if (rockTex) return rockTex;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8c877d';
  g.fillRect(0, 0, S, S);
  const r = rng(31);
  const dot = (x: number, y: number, rad: number, col: string) => {
    g.fillStyle = col;
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        if (x + ox + rad < 0 || x + ox - rad > S || y + oy + rad < 0 || y + oy - rad > S) continue;
        g.beginPath();
        g.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
        g.fill();
      }
  };
  for (const [n, r0, r1, a] of [[60, 30, 80, 0.07], [260, 8, 26, 0.09], [2600, 1, 4, 0.16]] as const)
    for (let i = 0; i < n; i++) {
      const dark = r() < 0.55;
      dot(r() * S, r() * S, r0 + r() * (r1 - r0), dark ? `rgba(52,46,40,${a})` : `rgba(220,214,200,${a})`);
    }
  for (let i = 0; i < 70; i++) dot(r() * S, r() * S, 2 + r() * 7, `rgba(${r() < 0.5 ? '214,208,170' : '196,206,170'},0.28)`);
  rockTex = new THREE.CanvasTexture(c);
  rockTex.colorSpace = THREE.SRGBColorSpace;
  rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;
  rockTex.anisotropy = 4;
  return rockTex;
}

// 三向投影的石材：按世界坐标从三个方向取贴图、按法线混合；朝上的面带一点青苔
export function rockMaterial(color: THREE.ColorRepresentation, metersPerTile = 1.4, moss = 0.35) {
  const mat = new THREE.MeshStandardMaterial({ map: rockTexture(), color, roughness: 0.93 });
  const scale = { value: 1 / metersPerTile };
  const mossU = { value: moss };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTriScale = scale;
    sh.uniforms.uMoss = mossU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          mat4 tm = modelMatrix;
          #ifdef USE_INSTANCING
          tm = modelMatrix * instanceMatrix;
          #endif
          vTriPos = (tm * vec4(transformed, 1.0)).xyz;
          vTriN = normalize(mat3(tm) * objectNormal);
        }`
      );
    const tri = (tex: string) => `(texture2D(${tex}, vTriPos.zy * uTriScale) * bw.x + texture2D(${tex}, vTriPos.xz * uTriScale) * bw.y + texture2D(${tex}, vTriPos.xy * uTriScale) * bw.z)`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;\nuniform float uTriScale;\nuniform float uMoss;')
      .replace(
        '#include <map_fragment>',
        `vec3 bw = pow(abs(normalize(vTriN)), vec3(4.0));
        bw /= (bw.x + bw.y + bw.z);
        #ifdef USE_MAP
        diffuseColor *= ${tri('map')};
        #endif
        float mossK = smoothstep(0.55, 0.92, normalize(vTriN).y) * uMoss;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.34, 0.20) * (0.7 + diffuseColor.g), mossK);`
      )
      ;
  };
  mat.customProgramCacheKey = () => 'rock-triplanar';
  return mat;
}
