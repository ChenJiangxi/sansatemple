import * as THREE from 'three';

// 盒子的 UV 按真实尺寸缩放，这样同一张可平铺贴图在大小不同的盒子上密度一致
export function worldBox(w: number, h: number, d: number, scale = 1) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // 面顺序：+x -x +y -y +z -z，每面 4 个顶点
  const dims: [number, number][] = [
    [d, h], [d, h], [w, d], [w, d], [w, h], [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * a / scale, uv.getY(i) * b / scale);
    }
  }
  return geo;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0): T {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  return o;
}

// 由二维轮廓旋转出的回转体，pts 为 [半径, 高度]
export function lathe(pts: [number, number][], seg = 32) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export const gold = () =>
  new THREE.MeshStandardMaterial({ color: '#d9a54e', metalness: 1, roughness: 0.3, envMapIntensity: 1.4 });
