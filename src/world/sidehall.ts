// 两座配殿的殿内：佛坛、菩萨像（观音殿供宋代水月观音、地藏殿供地藏菩萨）、背光、供桌香炉蜡烛、暖灯；
// 地藏殿另有一架三层长明灯。殿门、佛坛、灯架各有一个点击用的隐形盒子。
// 藏经阁（第三座）里是一排排经橱和三张抄经的经案。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SH, hallWorld, HALLS, LIB_DESKS, LIB_DESK_Z, LIB_SEAT_Z } from '../layout';
import { chineseMats, cushionMesh } from './hall';
import { mandorla } from './statues';
import { mesh, worldBox } from './util';
import { pbr } from './pbr';

export const LAMPS = 36;

interface HallBuild {
  g: THREE.Group;
  doors: THREE.Group[];
  walls: THREE.Object3D[];
}

export function furnishSideHalls(halls: HallBuild[], env: THREE.Texture) {
  const M = chineseMats();
  const interactives: THREE.Object3D[] = [];
  const doorHits: THREE.Mesh[] = [];
  const gold = new THREE.MeshStandardMaterial({ color: '#d2a24c', metalness: 1, roughness: 0.32, envMap: env, envMapIntensity: 1.1 });
  gold.userData.keepEnv = true;
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const base = new URL('models/', document.baseURI).toString();
  const lights: THREE.PointLight[] = [];
  const floorMat = pbr('granite', { metersPerTile: 1.3, color: '#78695b', roughness: 0.72 });
  floorMat.envMapIntensity = 0.35;
  const open = halls.map(() => false);
  const doorK = halls.map(() => 0);
  let flames: THREE.InstancedMesh | null = null;
  const flameAt: THREE.Vector3[] = [];

  const deskHits: THREE.Mesh[] = [];
  halls.forEach((h, i) => {
    const d = SH(i);
    const g = h.g;
    const fy = d.base;
    // 殿内铺方砖（和大殿一样的深色金砖）
    const floor = mesh(worldBox(d.hx * 2, 0.02, d.hz * 2, 1), floorMat);
    floor.position.set(0, fy + 0.01, 0);
    g.add(floor);
    if (i === 2) {
      furnishLibrary(g, d, fy, deskHits, hitMat, M);
      const light = new THREE.PointLight('#ffd6a0', 0, 14, 1.5);
      light.position.set(0, fy + 3.2, -0.5);
      g.add(light);
      lights.push(light);
      const doorHit = new THREE.Mesh(new THREE.BoxGeometry(d.hx * 2, 4, 1.2), hitMat);
      doorHit.position.set(0, fy + 2, d.hz + 0.4);
      doorHit.userData.interact = { type: 'hallDoor', hall: i };
      g.add(doorHit);
      doorHits.push(doorHit);
      return;
    }
    // 须弥座佛坛
    const altar = mesh(worldBox(4.4, 0.95, 1.5, 1), M.red);
    altar.position.set(0, fy + 0.475, -d.hz + 0.95);
    g.add(altar);
    const altarTop = mesh(worldBox(4.6, 0.08, 1.7, 1), M.gold);
    altarTop.position.set(0, fy + 0.99, -d.hz + 0.95);
    g.add(altarTop);
    // 背光
    const back = mandorla(2.6, 3.3);
    back.position.set(0, fy + 0.95, -d.hz + 0.35);
    (back.material as THREE.MeshStandardMaterial[]).forEach((m) => {
      m.envMap = env;
      m.userData.keepEnv = true;
    });
    // 地藏像自带火焰背光，就不再加
    if (i === 0) g.add(back);
    // 菩萨像：下载好后放上佛坛
    const file = i === 0 ? 'guanyin.glb' : 'dizang.glb';
    const height = i === 0 ? 2.1 : 2.85;
    loader
      .loadAsync(base + file)
      .then((gl) => {
        const obj = gl.scene;
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
          m.material = gold;
          m.castShadow = true;
          m.receiveShadow = true;
        });
        obj.scale.setScalar(height);
        obj.position.set(0, fy + 1.03, -d.hz + 1.0);
        obj.rotation.y = STATUE_YAW[i];
        g.add(obj);
      })
      .catch((e) => console.warn('配殿佛像加载失败', e));
    // 供桌：黄桌围、铜香炉、一对红烛
    const table = mesh(worldBox(2.0, 0.8, 0.55, 1), M.redDark);
    table.position.set(0, fy + 0.4, -d.hz + 2.2);
    g.add(table);
    const burner = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.16, 16), M.bronze);
    burner.position.set(0, fy + 0.88, -d.hz + 2.2);
    g.add(burner);
    const candleMat = new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.6 });
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.6) });
    for (const sx of [-0.7, 0.7]) {
      const c = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 10), candleMat, false);
      c.position.set(sx, fy + 0.94, -d.hz + 2.2);
      g.add(c);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 8), flameMat);
      f.position.set(sx, fy + 1.11, -d.hz + 2.2);
      g.add(f);
    }
    // 三个蒲团
    for (const sx of [-1.1, 0, 1.1]) {
      const p = cushionMesh();
      p.position.set(sx, fy + 0.02, -d.hz + 3.4);
      g.add(p);
    }
    // 殿内暖光
    const light = new THREE.PointLight('#ffcf95', 0, 11, 1.6);
    light.position.set(0, fy + 3.0, -d.hz + 2.4);
    g.add(light);
    lights.push(light);
    // 地藏殿的长明灯架：三层，每层十二盏
    if (i === 1) {
      const wood = new THREE.MeshStandardMaterial({ color: '#5a2d1e', roughness: 0.7 });
      const cupGeo = new THREE.CylinderGeometry(0.045, 0.03, 0.05, 10);
      const cups: THREE.BufferGeometry[] = [];
      for (let tier = 0; tier < 3; tier++) {
        const step = mesh(worldBox(3.0, 0.08, 0.32, 1), wood);
        const y = fy + 0.55 + tier * 0.35;
        const z = -d.hz + 1.45 - tier * 0.33;
        step.position.set(-5.1, y, z);
        g.add(step);
        const leg = mesh(worldBox(3.0, y - fy, 0.06, 1), wood);
        leg.position.set(-5.1, fy + (y - fy) / 2, z - 0.13);
        g.add(leg);
        for (let k = 0; k < 12; k++) {
          const x = -5.1 - 1.375 + k * 0.25;
          const c = cupGeo.clone();
          c.translate(x, y + 0.065, z);
          cups.push(c);
          flameAt.push(new THREE.Vector3(x, y + 0.12, z));
        }
      }
      const cupMesh = mesh(mergeGeos(cups), M.gold, false);
      g.add(cupMesh);
      flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.016, 0.055, 6), flameMat, LAMPS);
      flames.frustumCulled = false;
      g.add(flames);
      const lampHit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 1.4), hitMat);
      lampHit.position.set(-5.1, fy + 0.9, -d.hz + 1.1);
      lampHit.userData.interact = { type: 'hallLamp', hall: i };
      g.add(lampHit);
      interactives.push(lampHit);
    }
    // 点击：佛坛（礼拜）、殿门（没解锁时提示）
    const statueHit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 2.6), hitMat);
    statueHit.position.set(0, fy + 1.6, -d.hz + 1.3);
    statueHit.userData.interact = { type: 'hallStatue', hall: i };
    g.add(statueHit);
    interactives.push(statueHit);
    const doorHit = new THREE.Mesh(new THREE.BoxGeometry(d.hx * 2, 4, 1.2), hitMat);
    doorHit.position.set(0, fy + 2, d.hz + 0.4);
    doorHit.userData.interact = { type: 'hallDoor', hall: i };
    g.add(doorHit);
    doorHits.push(doorHit);
  });

  const m4 = new THREE.Matrix4();
  function setLamps(n: number) {
    if (!flames) return;
    for (let k = 0; k < LAMPS; k++) {
      m4.compose(flameAt[k], new THREE.Quaternion(), new THREE.Vector3().setScalar(k < n ? 1 : 0.0001));
      flames.setMatrixAt(k, m4);
    }
    flames.instanceMatrix.needsUpdate = true;
  }
  setLamps(0);

  // 站位（世界坐标）：佛前礼拜处、灯架前
  const stand = (i: number, lx: number, lz: number) => {
    const w = hallWorld(i, lx, lz);
    return { x: w.x, z: w.z, yaw: HALLS[i].yaw + Math.PI };
  };

  return {
    interactives,
    doorHits,
    walls: halls.flatMap((h) => h.walls),
    statueStand: (i: number) => stand(i, 0, -SH(i).hz + 3.0),
    lampStand: () => stand(1, -5.1, -SH(1).hz + 2.35),
    // 经案：点经案坐下抄经；人坐在经案朝门的一侧、面朝经橱
    deskHits,
    deskSeat: (k: number) => stand(2, LIB_DESKS[k], LIB_SEAT_Z),
    setLamps,
    setOpen(i: number, o: boolean, animate: boolean) {
      open[i] = o;
      if (!animate) doorK[i] = o ? 1 : 0;
    },
    update(dt: number, t: number) {
      halls.forEach((h, i) => {
        doorK[i] += ((open[i] ? 1 : 0) - doorK[i]) * Math.min(1, dt * 1.5);
        for (const p of h.doors) p.rotation.y = (p.userData.openSign as number) * 1.35 * doorK[i];
        lights[i].intensity = 7 * doorK[i];
      });
      if (flames) flames.rotation.y = 0;
      void t;
    },
  };
}

// 经橱正面：一格一格的经函，黄、蓝、赭色的包袱皮，每函一个白签条
function shelfTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a2416';
  g.fillRect(0, 0, W, H);
  const cols = 4, rows = 6, cw = W / cols, rh = H / rows;
  const cloth = ['#c99a3a', '#2f4a6a', '#9a5a2a', '#b8873a', '#3d5a4a', '#8a2e22'];
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const x0 = x * cw + 8, y0 = y * rh + 8, w = cw - 16, h = rh - 14;
      g.fillStyle = '#1e0e08';
      g.fillRect(x0, y0, w, h);
      // 一格里横放两三函经
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const bh = (h - 6) / 3;
        const by = y0 + h - (k + 1) * bh - 2;
        g.fillStyle = cloth[Math.floor(r() * cloth.length)];
        g.fillRect(x0 + 4, by, w - 8 - r() * 10, bh - 3);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x0 + 4, by + bh - 6, w - 8, 3);
        g.fillStyle = '#efe6cf';
        g.fillRect(x0 + w / 2 - 6, by + 3, 12, bh - 9);
      }
      g.strokeStyle = '#7a3a22';
      g.lineWidth = 3;
      g.strokeRect(x0 - 2, y0 - 2, w + 4, h + 4);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 藏经阁殿内：后墙一排经橱，两侧墙后半段也立着经橱；殿中三张矮经案，案上铺纸、笔架、砚台，案后一张坐垫
function furnishLibrary(g: THREE.Group, d: ReturnType<typeof SH>, fy: number, deskHits: THREE.Mesh[], hitMat: THREE.Material, M: ReturnType<typeof chineseMats>) {
  const wood = new THREE.MeshStandardMaterial({ color: '#5a2a1a', roughness: 0.6 });
  const front = new THREE.MeshStandardMaterial({ map: shelfTexture(), roughness: 0.75 });
  const shelf = (x: number, z: number, w: number, yaw: number) => {
    const b = mesh(worldBox(w, 2.7, 0.62, 1.3), [wood, wood, wood, wood, front, wood]);
    b.position.set(x, fy + 1.35, z);
    b.rotation.y = yaw;
    g.add(b);
    const cap = mesh(worldBox(w + 0.12, 0.1, 0.72, 1), wood);
    cap.position.set(x, fy + 2.75, z);
    cap.rotation.y = yaw;
    g.add(cap);
  };
  const n = 6, sw = (d.hx * 2 - 0.6) / n;
  for (let k = 0; k < n; k++) shelf(-d.hx + 0.3 + sw * (k + 0.5), -d.hz + 0.45, sw - 0.08, 0);
  for (const sx of [-1, 1]) for (const z of [-2.0, -0.4]) shelf(sx * (d.hx - 0.45), z, 1.5, -sx * Math.PI / 2);
  const paper = new THREE.MeshStandardMaterial({ color: '#f1e8d2', roughness: 0.95 });
  const ink = new THREE.MeshStandardMaterial({ color: '#1a1614', roughness: 0.35 });
  const mat = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.95 });
  LIB_DESKS.forEach((dx, k) => {
    const top = mesh(worldBox(1.5, 0.06, 0.56, 1), M.redDark);
    top.position.set(dx, fy + 0.4, LIB_DESK_Z);
    g.add(top);
    for (const sx of [-1, 1]) {
      const leg = mesh(worldBox(0.08, 0.37, 0.5, 1), M.redDark);
      leg.position.set(dx + sx * 0.66, fy + 0.185, LIB_DESK_Z);
      g.add(leg);
    }
    const sheet = mesh(worldBox(0.62, 0.005, 0.4, 1), paper, false);
    sheet.position.set(dx, fy + 0.433, LIB_DESK_Z + 0.02);
    g.add(sheet);
    // 纸上几行淡淡的字迹
    for (let r = 0; r < 5; r++) {
      const line = mesh(worldBox(0.012, 0.002, 0.3, 1), ink, false);
      line.position.set(dx + 0.22 - r * 0.07, fy + 0.437, LIB_DESK_Z + 0.02);
      g.add(line);
    }
    const stone = mesh(worldBox(0.16, 0.03, 0.24, 1), ink, false);
    stone.position.set(dx + 0.52, fy + 0.445, LIB_DESK_Z - 0.04);
    g.add(stone);
    const brush = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), M.redDark, false);
    brush.rotation.x = Math.PI / 2;
    brush.position.set(dx - 0.5, fy + 0.445, LIB_DESK_Z);
    g.add(brush);
    const cushion = mesh(worldBox(0.62, 0.04, 0.5, 1), mat);
    cushion.position.set(dx, fy + 0.02, LIB_SEAT_Z);
    g.add(cushion);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.5), hitMat);
    hit.position.set(dx, fy + 0.5, (LIB_DESK_Z + LIB_SEAT_Z) / 2);
    hit.userData.interact = { type: 'sutraDesk', desk: k };
    g.add(hit);
    deskHits.push(hit);
  });
}

// 模型朝向：按截图校正后的绕 y 旋转（让菩萨面朝殿门，也就是本地 +z）
const STATUE_YAW = [0, 0];

function mergeGeos(gs: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry();
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g0 of gs) {
    const g = g0.index ? g0 : g0;
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    off += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}
