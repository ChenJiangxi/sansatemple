// 枫树、松树、莲池、石头、飘落的枫叶
import * as THREE from 'three';
import { MAPLES, PINES, ROCKS, POND } from '../layout';
import { foliageClusterTexture, mapleLeafTexture, waterNormalTexture, woodTexture, stoneTexture, rng } from '../textures';
import { mesh } from './util';

const windUniform = { value: 0 };

// 给叶片材质加一点随风摆动
function addSway(mat: THREE.Material, amount = 0.06) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float ph = ip.x * 0.37 + ip.z * 0.21;
          transformed.x += sin(uWind * 1.3 + ph) * ${amount.toFixed(3)} * (position.y + 0.5);
          transformed.z += cos(uWind * 1.1 + ph * 1.7) * ${amount.toFixed(3)} * 0.7 * (position.y + 0.5);
        #endif`
      );
  };
}

function branchTube(points: THREE.Vector3[], r0: number, mat: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 10, r0, 7, false);
  // 越往上越细
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const ring = 8;
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / ring);
    const t = seg / 10;
    const c = curve.getPointAt(Math.min(1, t));
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(c).multiplyScalar(1 - t * 0.65).add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return mesh(geo, mat);
}

export interface NatureBuild {
  update(dt: number, t: number): void;
  leafSpawns: THREE.Vector3[];
}

export function buildNature(scene: THREE.Scene): NatureBuild {
  const group = new THREE.Group();
  const r = rng(101);
  const barkMat = new THREE.MeshStandardMaterial({ map: woodTexture(9, ['#3b2a22', '#2a1d17', '#4a372b']), roughness: 0.95 });

  // 枫树
  const clusterTex = foliageClusterTexture(4);
  const leafMat = new THREE.MeshStandardMaterial({ map: clusterTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  addSway(leafMat, 0.05);
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: clusterTex, alphaTest: 0.45 });
  const perTree = 70;
  const clusters = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 1.5), leafMat, MAPLES.length * perTree);
  clusters.customDepthMaterial = leafDepth;
  clusters.castShadow = true;
  clusters.receiveShadow = true;
  const palettes = [
    ['#b8321f', '#cf4a24', '#a8281c', '#d9642a'],
    ['#d9792a', '#e0952f', '#c9612a', '#e8ad3a'],
    ['#c9a238', '#ddb840', '#b88a2c', '#d9762c'],
  ].map((p) => p.map((h) => new THREE.Color(h)));
  const leafSpawns: THREE.Vector3[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let ci = 0;
  MAPLES.forEach(([x, z, s], ti) => {
    const pal = palettes[ti % 3];
    const trunkTop = new THREE.Vector3(x + (r() - 0.5) * 0.4, 2.2 * s, z + (r() - 0.5) * 0.4);
    group.add(branchTube([new THREE.Vector3(x, -0.1, z), new THREE.Vector3(x + (r() - 0.5) * 0.3, 1.1 * s, z), trunkTop], 0.2 * s, barkMat));
    const tips: THREE.Vector3[] = [];
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2 + r();
      const len = (1.3 + r() * 0.9) * s;
      const tip = new THREE.Vector3(trunkTop.x + Math.cos(a) * len, trunkTop.y + (0.9 + r() * 1.3) * s, trunkTop.z + Math.sin(a) * len);
      const mid = trunkTop.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.3, 0));
      group.add(branchTube([trunkTop.clone(), mid, tip], 0.09 * s, barkMat));
      tips.push(tip);
    }
    const crownC = new THREE.Vector3(trunkTop.x, trunkTop.y + 1.5 * s, trunkTop.z);
    tips.push(crownC);
    leafSpawns.push(crownC);
    for (let k = 0; k < perTree; k++) {
      const tip = tips[k % tips.length];
      const p = tip.clone().add(new THREE.Vector3((r() - 0.5) * 2.2 * s, (r() - 0.4) * 1.4 * s, (r() - 0.5) * 2.2 * s));
      e.set(r() * Math.PI, r() * Math.PI * 2, r() * Math.PI);
      q.setFromEuler(e);
      const sc = (0.8 + r() * 0.7) * s;
      m.compose(p, q, new THREE.Vector3(sc, sc, sc));
      clusters.setMatrixAt(ci, m);
      clusters.setColorAt(ci, pal[Math.floor(r() * pal.length)].clone().multiplyScalar(0.85 + r() * 0.3));
      ci++;
    }
  });
  group.add(clusters);

  // 松树（伞形树冠）
  const pineMat = new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 0.95, flatShading: true });
  const pineBark = new THREE.MeshStandardMaterial({ map: woodTexture(12, ['#6b3a26', '#4f2a1c', '#7a4a30']), roughness: 0.9 });
  const blob = new THREE.IcosahedronGeometry(1, 1);
  for (const [x, z, s] of PINES) {
    const lean = (r() - 0.5) * 1.2;
    const top = new THREE.Vector3(x + lean, 6.5 * s, z + (r() - 0.5) * 1.2);
    group.add(branchTube([new THREE.Vector3(x, -0.1, z), new THREE.Vector3(x + lean * 0.3, 3 * s, z), top], 0.26 * s, pineBark));
    for (let k = 0; k < 6; k++) {
      const b = mesh(blob, pineMat);
      b.scale.set((1.6 + r()) * s, (0.55 + r() * 0.3) * s, (1.6 + r()) * s);
      b.position.set(top.x + (r() - 0.5) * 2.6 * s, top.y + (r() - 0.6) * 1.6 * s, top.z + (r() - 0.5) * 2.6 * s);
      group.add(b);
    }
  }

  // 石头
  const rockMat = new THREE.MeshStandardMaterial({ map: stoneTexture(31, '#8a877c'), roughness: 0.95, flatShading: true });
  const rockGeo = (seed: number) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const rr = rng(seed);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      v.multiplyScalar(0.8 + rr() * 0.35);
      p.setXYZ(i, v.x, Math.max(-0.2, v.y), v.z);
    }
    g.computeVertexNormals();
    return g;
  };
  ROCKS.forEach(([x, z, s], i) => {
    const rk = mesh(rockGeo(i + 7), rockMat);
    rk.scale.set(s * 1.2, s * 0.7, s);
    rk.position.set(x, 0.05, z);
    rk.rotation.y = r() * 6;
    group.add(rk);
  });

  // 莲池：池底、水面、岸石、莲叶和莲花
  const basin = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3b3324', roughness: 1, side: THREE.BackSide }));
  basin.scale.set(POND.rx, 0.9, POND.rz);
  basin.position.set(POND.x, 0, POND.z);
  group.add(basin);
  const wn = waterNormalTexture();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: '#30504a', roughness: 0.06, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.9, envMapIntensity: 1.1 })
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(POND.rx, POND.rz, 1);
  water.position.set(POND.x, -0.16, POND.z);
  water.receiveShadow = true;
  group.add(water);
  const edgeMat = new THREE.MeshStandardMaterial({ map: stoneTexture(44, '#6f6c63'), roughness: 0.95, flatShading: true, color: '#b9b4a8' });
  const edgeN = 46;
  for (let i = 0; i < edgeN; i++) {
    const a = (i / edgeN) * Math.PI * 2;
    const s = 0.24 + r() * 0.2;
    const rk = mesh(rockGeo(100 + i), edgeMat);
    rk.scale.set(s * 1.4, s * 0.6, s);
    rk.position.set(POND.x + Math.cos(a) * (POND.rx + 0.1), 0.0, POND.z + Math.sin(a) * (POND.rz + 0.1));
    rk.rotation.y = -a;
    group.add(rk);
  }
  const padMat = new THREE.MeshStandardMaterial({ color: '#4d6b34', roughness: 0.7, side: THREE.DoubleSide });
  const padGeo = new THREE.CircleGeometry(0.34, 20, 0.3, Math.PI * 2 - 0.3);
  const petalMat = new THREE.MeshStandardMaterial({ color: '#f2b7c3', roughness: 0.6, emissive: '#5a2a33', emissiveIntensity: 0.15 });
  const petalGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.85;
    const px = POND.x + Math.cos(a) * POND.rx * d;
    const pz = POND.z + Math.sin(a) * POND.rz * d;
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.set(-Math.PI / 2, 0, r() * 6);
    const ps = 0.7 + r() * 0.8;
    pad.scale.setScalar(ps);
    pad.position.set(px, -0.14, pz);
    group.add(pad);
    if (i % 4 === 0) {
      const flower = new THREE.Group();
      for (let k = 0; k < 8; k++) {
        const pe = new THREE.Mesh(petalGeo, petalMat);
        const pa = (k / 8) * Math.PI * 2;
        pe.scale.set(0.05, 0.13, 0.035);
        pe.position.set(Math.cos(pa) * 0.07, 0.1, Math.sin(pa) * 0.07);
        pe.lookAt(new THREE.Vector3(0, 0.1, 0));
        pe.rotateX(0.5);
        flower.add(pe);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: '#e8c04a' }));
      core.position.y = 0.08;
      flower.add(core);
      flower.position.set(px, -0.12, pz);
      group.add(flower);
    }
  }

  // 飘落的枫叶
  const leafTex = mapleLeafTexture();
  const fallMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  const N = 150;
  const fall = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.14), fallMat, N);
  const leaves = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0 }));
  const allColors = palettes.flat();
  const spawn = (L: (typeof leaves)[number], initial: boolean) => {
    const c = leafSpawns[Math.floor(Math.random() * leafSpawns.length)];
    L.p.set(c.x + (Math.random() - 0.5) * 4, c.y + (Math.random() - 0.5) * 1.5, c.z + (Math.random() - 0.5) * 4);
    if (initial) L.p.y = Math.random() * c.y;
    L.v.set((Math.random() - 0.3) * 0.3, -(0.25 + Math.random() * 0.3), (Math.random() - 0.5) * 0.3);
    L.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    L.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    L.life = 0;
  };
  leaves.forEach((L, i) => {
    spawn(L, true);
    fall.setColorAt(i, allColors[i % allColors.length]);
  });
  group.add(fall);

  scene.add(group);

  return {
    leafSpawns,
    update(dt, t) {
      windUniform.value = t;
      wn.offset.set(t * 0.012, t * 0.007);
      for (let i = 0; i < N; i++) {
        const L = leaves[i];
        L.life += dt;
        if (L.p.y > 0.02) {
          L.p.x += (L.v.x + Math.sin(t * 0.7 + i) * 0.25) * dt;
          L.p.y += L.v.y * dt;
          L.p.z += (L.v.z + Math.cos(t * 0.5 + i) * 0.2) * dt;
          L.rot.x += L.spin.x * dt;
          L.rot.y += L.spin.y * dt;
          L.rot.z += L.spin.z * dt;
        } else if (L.life > 25) spawn(L, false);
        q.setFromEuler(L.rot);
        m.compose(L.p, q, new THREE.Vector3(1, 1, 1));
        fall.setMatrixAt(i, m);
      }
      fall.instanceMatrix.needsUpdate = true;
    },
  };
}
