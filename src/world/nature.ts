// 银杏、枫树、松树（ez-tree 长出的写实树）、莲池、石头、飘落的叶子
import * as THREE from 'three';
import { MAPLES, PINES, ROCKS, POND, COURT } from '../layout';
import { rockGeometry, rockMaterial } from './rock';
import { buildLotus } from './lotus';
import { rng } from '../textures';
import { mesh } from './util';
import { makeVariant, plantTrees, treeWind, type TreeVariant, type TreePlace } from './trees';
import { bakeImpostor, whenTexturesReady } from './impostor';

export interface NatureBuild {
  update(dt: number, t: number): void;
  leafSpawns: THREE.Vector3[];
}

export function buildNature(scene: THREE.Scene, o: { renderer: THREE.WebGLRenderer; heightAt(x: number, z: number): number; size: number; lite: boolean }): NatureBuild {
  const group = new THREE.Group();
  const r = rng(101);
  // —— 树：院中的银杏（金黄）与枫树（红、橙），墙外一圈林子，几棵松 ——
  const outer: [number, number, number][] = [];
  {
    const rr = rng(77);
    const ring = (x0: number, z0: number, x1: number, z1: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const t = (i + rr() * 0.6) / n;
        const out = 4 + rr() * 10;
        let x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        if (x0 === x1) x += Math.sign(x0) * out;
        else z += Math.sign(z0) * out;
        outer.push([x, z, 1.1 + rr() * 0.6]);
      }
    };
    ring(COURT.x0, COURT.z0, COURT.x0, COURT.z1, 14);
    ring(COURT.x1, COURT.z0, COURT.x1, COURT.z1, 14);
    ring(COURT.x0, COURT.z0, COURT.x1, COURT.z0, 12);
    ring(COURT.x0, COURT.z1, -6, COURT.z1, 5);
    ring(6, COURT.z1, COURT.x1, COURT.z1, 5);
  }
  const allMaples = [...MAPLES, ...outer.filter((_, i) => i % 3 !== 2)];
  const outerPines = outer.filter((_, i) => i % 3 === 2);
  const gPal = ['#e8c23a', '#f0d24e', '#d9a82a', '#e0b838', '#c9a032'].map((h) => new THREE.Color(h));
  const palettes = [
    ['#b8321f', '#cf4a24', '#a8281c', '#d9642a'],
    ['#d9792a', '#e0952f', '#c9612a', '#e8ad3a'],
    ['#c9a238', '#ddb840', '#b88a2c', '#d9762c'],
  ].map((p) => p.map((h) => new THREE.Color(h)));
  const isGinkgo = (i: number) => i % 4 !== 3;
  const kinds = {
    ginkgo: [
      makeVariant({ preset: 'Ash Medium', seed: 11, height: 12.5, tint: 0xf2c544, bark: 0xbfb2a0 }),
      makeVariant({ preset: 'Ash Medium', seed: 29, height: 11.5, tint: 0xe9b93a, bark: 0xbfb2a0 }),
    ],
    maple: [
      makeVariant({ preset: 'Oak Medium', seed: 5, height: 8.5, tint: 0xd8502c, bark: 0x9a8878 }),
      makeVariant({ preset: 'Oak Medium', seed: 17, height: 8, tint: 0xe38a34, bark: 0x9a8878 }),
    ],
    pine: [makeVariant({ preset: 'Pine Medium', seed: 3, height: 13 })],
  };
  // 墙外那一圈离得远一些，用小号、分段更少的树
  const far = {
    ginkgo: [makeVariant({ preset: 'Ash Small', seed: 41, height: 10, tint: 0xf0c040, bark: 0xbfb2a0, lite: true })],
    maple: [makeVariant({ preset: 'Oak Small', seed: 23, height: 7, tint: 0xd4542a, bark: 0x9a8878, lite: true }), makeVariant({ preset: 'Oak Small', seed: 31, height: 7, tint: 0xe39a38, bark: 0x9a8878, lite: true })],
    pine: [makeVariant({ preset: 'Pine Small', seed: 7, height: 11, lite: true })],
  };
  const places = new Map<TreeVariant, TreePlace[]>();
  const put = (v: TreeVariant, p: TreePlace) => {
    if (!places.has(v)) places.set(v, []);
    places.get(v)!.push(p);
  };
  const leafSpawns: THREE.Vector3[] = [];
  allMaples.forEach(([x, z, sc], ti) => {
    const g = isGinkgo(ti);
    // 手机上院子里也用小号的树，省一半多的三角形
    const set = ti < MAPLES.length && !o.lite ? kinds : far;
    const pool = g ? set.ginkgo : set.maple;
    const v = pool[ti % pool.length];
    const s = (sc / 1.15) * (0.85 + r() * 0.3);
    const k = 0.85 + r() * 0.3;
    put(v, { x, z, s, yaw: r() * Math.PI * 2, tint: new THREE.Color(k, k * (0.95 + r() * 0.1), k) });
    if (ti < MAPLES.length) leafSpawns.push(new THREE.Vector3(x, v.height * s * 0.7, z));
  });
  for (const [x, z, sc] of PINES) put((o.lite ? far : kinds).pine[0], { x, z, s: (sc / 1.3) * (0.85 + r() * 0.3), yaw: r() * Math.PI * 2 });
  for (const [x, z, sc] of outerPines) put(far.pine[0], { x, z, s: (sc / 1.3) * (0.85 + r() * 0.3), yaw: r() * Math.PI * 2 });
  let treeTris = 0;
  for (const [v, list] of places) {
    plantTrees(group, v, list);
    treeTris += v.tris * list.length;
  }
  (window as unknown as { __treeTris: number }).__treeTris = treeTris;

  // 山坡上的林子：贴图下载好后把几种样板「拍」成图，铺几千棵
  const forestKinds: { v: TreeVariant; gray: boolean; w: number; tint: string[] }[] = [
    { v: far.ginkgo[0], gray: true, w: 0.22, tint: ['#ffffff', '#f0e0c0'] },
    { v: far.maple[0], gray: true, w: 0.2, tint: ['#ffffff', '#e8c0a8'] },
    { v: far.maple[1], gray: true, w: 0.18, tint: ['#ffffff', '#f0d8b0'] },
    { v: far.pine[0], gray: false, w: 0.4, tint: ['#ffffff', '#c8d0c0'] },
  ];
  whenTexturesReady([...forestKinds.flatMap((k) => [k.v.leafMat.map, k.v.barkMat.map])], () => {
    const rr = rng(313);
    const NF = o.lite ? 1800 : 4200;
    const meshes = forestKinds.map((k) => {
      const imp = bakeImpostor(o.renderer, k.v, k.gray);
      const im = new THREE.InstancedMesh(imp.geometry, imp.material, NF);
      im.count = 0;
      im.frustumCulled = false;
      im.receiveShadow = true;
      return im;
    });
    const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fs = new THREE.Vector3(), fp = new THREE.Vector3(), fc = new THREE.Color();
    const half = o.size / 2 - 6;
    const total = forestKinds.reduce((a2, k) => a2 + k.w, 0);
    for (let k = 0; k < NF * 3; k++) {
      const a2 = rr() * Math.PI * 2;
      const dist = 14 + Math.pow(rr(), 1.3) * 340;
      const x = Math.cos(a2) * (COURT.x1 + 2.5 + dist), z = (COURT.z0 + COURT.z1) / 2 + Math.sin(a2) * ((COURT.z1 - COURT.z0) / 2 + 2.5 + dist);
      if (Math.abs(x) > half || Math.abs(z) > half) continue;
      const h = o.heightAt(x, z);
      if (h > 175) continue;
      // 越高越偏松杉（青色），低处多秋叶
      let pick = rr() * total * (1 - Math.min(0.6, h / 300));
      let ki = 0;
      while (ki < forestKinds.length - 1 && pick > forestKinds[ki].w) pick -= forestKinds[ki++].w;
      if (h > 90 && rr() < 0.6) ki = forestKinds.length - 1;
      const im = meshes[ki];
      if (im.count >= NF) continue;
      const sc = (0.9 + rr() * 0.7) * (dist > 150 ? 1.5 : 1);
      fq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rr() * Math.PI);
      fm.compose(fp.set(x, h - 0.3, z), fq, fs.set(sc, sc * (0.85 + rr() * 0.3), sc));
      im.setMatrixAt(im.count, fm);
      const tint = forestKinds[ki].tint;
      im.setColorAt(im.count++, fc.set(tint[Math.floor(rr() * tint.length)]).multiplyScalar(0.8 + rr() * 0.3));
    }
    for (const im of meshes) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      group.add(im);
    }
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();

  // 石头：每处一块大石，旁边散两三块小石
  const rockMat = rockMaterial('#cfc8bd', 1.8, 0.32);
  const pebbleGeos = [0, 1, 2].map((k) => rockGeometry(500 + k, 3, 4));
  ROCKS.forEach(([x, z, s], i) => {
    const rk = mesh(rockGeometry(i + 7), rockMat);
    rk.scale.set(s * 1.25, s * 0.78, s * 0.95);
    rk.position.set(x, 0.12 * s, z);
    rk.rotation.y = r() * 6;
    group.add(rk);
    const n = 2 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      const d = s * (1.35 + r() * 0.5);
      const ps = s * (0.18 + r() * 0.16);
      const pb = mesh(pebbleGeos[(i + k) % 3], rockMat);
      pb.scale.set(ps * 1.2, ps * 0.7, ps);
      pb.position.set(x + Math.cos(a) * d, 0.08 * ps, z + Math.sin(a) * d);
      pb.rotation.y = r() * 6;
      group.add(pb);
    }
  });

  // 莲池：池底、水面、岸石、莲叶和莲花
  const basin = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3b3324', roughness: 1, side: THREE.BackSide }));
  basin.scale.set(POND.rx, 0.9, POND.rz);
  basin.position.set(POND.x, 0, POND.z);
  group.add(basin);
  // 水面在 pond.ts（会倒映的镜面水）
  // 岸石：六种形状轮流用，每种一个实例化网格
  const edgeMat = rockMaterial('#bcb6aa', 1.1, 0.36);
  const edgeN = 46;
  const edgeGeos = [0, 1, 2, 3, 4, 5].map((k) => rockGeometry(100 + k, 3, 4));
  const edgeMeshes = edgeGeos.map((g) => {
    const im = new THREE.InstancedMesh(g, edgeMat, Math.ceil(edgeN / 6));
    im.castShadow = im.receiveShadow = true;
    im.count = 0;
    return im;
  });
  const em = new THREE.Matrix4();
  const eq = new THREE.Quaternion();
  for (let i = 0; i < edgeN; i++) {
    const a = (i / edgeN) * Math.PI * 2 + (r() - 0.5) * 0.05;
    const s = 0.26 + r() * 0.2;
    const out = 0.05 + r() * 0.15;
    eq.setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, -a + (r() - 0.5) * 0.8, (r() - 0.5) * 0.2));
    em.compose(new THREE.Vector3(POND.x + Math.cos(a) * (POND.rx + out), 0.02, POND.z + Math.sin(a) * (POND.rz + out)), eq, new THREE.Vector3(s * 1.45, s * 0.62, s));
    const im = edgeMeshes[i % 6];
    im.setMatrixAt(im.count++, em);
  }
  group.add(...edgeMeshes);
  buildLotus(group);

  // 飘落的枫叶
  const leafTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(32, 58);
    g.arc(32, 58, 46, -Math.PI * 0.82, -Math.PI * 0.18);
    g.closePath();
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const fallMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  const N = 150;
  const fall = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.14), fallMat, N);
  const leaves = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0 }));
  const allColors = [...gPal, ...gPal, ...palettes[1]];
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
      treeWind(t);
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
