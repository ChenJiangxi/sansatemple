// 两座配殿的殿内：佛坛、菩萨像（观音殿供宋代水月观音、地藏殿供地藏菩萨）、背光、供桌香炉蜡烛、暖灯；
// 地藏殿另有一架三层长明灯。殿门、佛坛、灯架各有一个点击用的隐形盒子。
// 藏经阁（第三座）里是一排排经橱和三张抄经的经案。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SH, hallWorld, HALLS, LIB_DESKS, LIB_DESK_Z, LIB_SEAT_Z } from '../layout';
import { chineseMats, cushionMesh } from './hall';
import { buildDing } from './bronze';
import { altarClothTexture, plaqueTexture } from '../textures';
import { mandorla } from './statues';
import { mesh, worldBox, lathe } from './util';
import { pbr } from './pbr';

export const LAMPS = 36;
// 两座配殿共用的材质（第一次用到时建）
let panelMat: THREE.Material | null = null;
let clothMat: THREE.Material | null = null;
let pewterMat: THREE.Material | null = null;
let candleMatS: THREE.Material | null = null;
let vaseMatS: THREE.Material | null = null;
let lotusMatS: THREE.Material | null = null;
let leafMatS: THREE.Material | null = null;
let plateMatS: THREE.Material | null = null;
const fruitMats: Record<string, THREE.Material> = {};

// 佛坛束腰的正面：朱漆底上三块描金的开光（圆角框），框里一朵金色卷云
function altarPanelTexture() {
  const W = 1024, H = 160;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a2a1d';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,170,140,0.04)' : 'rgba(30,0,0,0.07)';
    g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 1);
  }
  const gold = '#d9aa52';
  for (let k = 0; k < 3; k++) {
    const x = 40 + k * (W - 80) / 3 + 18, w = (W - 80) / 3 - 36, y = 24, h = H - 48, r = 22;
    g.strokeStyle = gold;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    g.stroke();
    // 卷云：两道向内卷的弧
    const cx = x + w / 2, cy = y + h / 2;
    g.lineWidth = 4;
    for (const s of [-1, 1]) {
      g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, a = t * Math.PI * 2.2, rr = 26 * (1 - t * 0.7);
        const px = cx + s * (30 + Math.cos(a) * rr), py = cy + Math.sin(a) * rr * 0.6;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.stroke();
    }
  }
  g.strokeStyle = gold;
  g.lineWidth = 3;
  g.strokeRect(10, 8, W - 20, H - 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

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
      const light = new THREE.PointLight('#ffd6a0', 0, 18, 1.4);
      light.position.set(0, fy + 3.2, -0.5);
      light.userData.base = 11; // 藏经阁进深浅、面阔大，灯要亮一些
      g.add(light);
      lights.push(light);
      const doorHit = new THREE.Mesh(new THREE.BoxGeometry(d.hx * 2, 4, 1.2), hitMat);
      doorHit.position.set(0, fy + 2, d.hz + 0.4);
      doorHit.userData.interact = { type: 'hallDoor', hall: i };
      g.add(doorHit);
      doorHits.push(doorHit);
      return;
    }
    // 须弥座佛坛（朱漆）：底座、束腰（正面三块描金开光）、上下两道金线、台面；台面高 1.03
    {
      const az = -d.hz + 0.95;
      const plinth = mesh(worldBox(4.6, 0.16, 1.7, 1), M.redDark);
      plinth.position.set(0, fy + 0.08, az);
      g.add(plinth);
      // 束腰用 0–1 的贴图坐标，正面那张开光图正好铺满一面
      const waist = mesh(new THREE.BoxGeometry(4.2, 0.72, 1.4), [M.red, M.red, M.red, M.red, (panelMat ??= new THREE.MeshStandardMaterial({ map: altarPanelTexture(), roughness: 0.55 })), M.red]);
      waist.position.set(0, fy + 0.16 + 0.36, az);
      g.add(waist);
      const top = mesh(worldBox(4.5, 0.15, 1.6, 1), M.red);
      top.position.set(0, fy + 0.955, az);
      g.add(top);
      for (const y of [0.17, 0.87]) {
        const bead = mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.3, 8).rotateZ(Math.PI / 2), M.gold, false);
        bead.position.set(0, fy + y, az + 0.71);
        g.add(bead);
      }
      const edge = mesh(worldBox(4.52, 0.025, 0.02, 1), M.gold, false);
      edge.position.set(0, fy + 0.93, az + 0.8);
      g.add(edge);
    }
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
          // 地藏像的扫描里带着一张很大的底板（几十个特别大的三角形，铺在佛坛上方像一张翘起的纸），剔掉
          if (i === 1) dropHugeTriangles(m.geometry, 0.4, -0.3, 0.05);
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
    // 供桌：朱漆桌面、做旧带褶的桌围；桌上小铜鼎、一对烛台、一对青瓷瓶插莲花、两盘供果
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.6) });
    {
      const tz = -d.hz + 2.2, th = 0.8, ttop = fy + th;
      const body = mesh(worldBox(2.0, th - 0.06, 0.55, 1), M.redDark);
      body.position.set(0, fy + (th - 0.06) / 2, tz);
      g.add(body);
      const top = mesh(worldBox(2.2, 0.06, 0.66, 1), M.red);
      top.position.set(0, ttop - 0.03, tz);
      g.add(top);
      const cg = new THREE.PlaneGeometry(2.08, th - 0.1, 40, 3);
      const cp = cg.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < cp.count; k++) cp.setZ(k, Math.sin((cp.getX(k) / 2.08) * Math.PI * 12) * 0.014 * (0.3 + 0.7 * ((th - 0.1) / 2 - cp.getY(k)) / (th - 0.1)));
      cg.computeVertexNormals();
      const cloth = mesh(cg, (clothMat ??= new THREE.MeshStandardMaterial({ map: altarClothTexture(), roughness: 0.85, side: THREE.DoubleSide })), false);
      cloth.position.set(0, fy + (th - 0.1) / 2 + 0.02, tz + 0.3);
      g.add(cloth);
      const ding = buildDing({ front: i === 0 ? '慈航普度' : '幽冥教主', back: '南無阿彌陀佛', stubs: 24 }).group;
      ding.scale.setScalar(0.26);
      ding.position.set(0, ttop, tz);
      g.add(ding);
      const pewter = (pewterMat ??= new THREE.MeshStandardMaterial({ color: '#a88848', metalness: 0.8, roughness: 0.4 }));
      const candleMat = (candleMatS ??= new THREE.MeshStandardMaterial({ color: '#b3201a', roughness: 0.45, emissive: '#3a0805', emissiveIntensity: 0.4 }));
      for (const sx of [-0.78, 0.78]) {
        const holder = mesh(lathe([[0, 0], [0.08, 0], [0.09, 0.03], [0.03, 0.07], [0.026, 0.2], [0.07, 0.23], [0.09, 0.27], [0.08, 0.28], [0, 0.28]], 14), pewter);
        holder.position.set(sx, ttop, tz - 0.08);
        g.add(holder);
        const c = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.24, 10), candleMat, false);
        c.position.set(sx, ttop + 0.28 + 0.12, tz - 0.08);
        g.add(c);
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6).scale(1, 2.3, 1), flameMat);
        f.position.set(sx, ttop + 0.28 + 0.24 + 0.045, tz - 0.08);
        g.add(f);
      }
      const vaseMat = (vaseMatS ??= new THREE.MeshPhysicalMaterial({ color: '#6f9a8c', roughness: 0.25, clearcoat: 0.8 }));
      const lotusMat = (lotusMatS ??= new THREE.MeshStandardMaterial({ color: '#f0a8b8', roughness: 0.55 }));
      const leafMat = (leafMatS ??= new THREE.MeshStandardMaterial({ color: '#3f6a3a', roughness: 0.7, side: THREE.DoubleSide }));
      for (const sx of [-0.45, 0.45]) {
        const vase = mesh(lathe([[0, 0], [0.06, 0], [0.09, 0.06], [0.085, 0.16], [0.04, 0.24], [0.035, 0.29], [0.055, 0.32], [0, 0.32]], 18), vaseMat);
        vase.position.set(sx, ttop, tz - 0.16);
        g.add(vase);
        const stem = mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.28, 5), leafMat, false);
        stem.position.set(sx, ttop + 0.44, tz - 0.16);
        g.add(stem);
        const bud = mesh(new THREE.SphereGeometry(0.055, 10, 8).scale(1, 1.4, 1), lotusMat, false);
        bud.position.set(sx, ttop + 0.6, tz - 0.16);
        g.add(bud);
        const leaf = mesh(new THREE.CircleGeometry(0.1, 12), leafMat, false);
        leaf.rotation.set(-1.1, 0, sx * 0.8);
        leaf.position.set(sx + Math.sign(sx) * 0.05, ttop + 0.4, tz - 0.12);
        g.add(leaf);
      }
      const plateMat = (plateMatS ??= new THREE.MeshStandardMaterial({ color: '#e9e2d0', roughness: 0.4 }));
      const fruit = ['#e08a2a', '#c43f2b', '#e2b23f'].map((c) => (fruitMats[c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })));
      for (const [sx, kind] of [[-0.62, 0], [0.62, 1]] as [number, number][]) {
        const plate = mesh(lathe([[0, 0], [0.05, 0], [0.045, 0.04], [0.14, 0.08], [0.15, 0.09], [0, 0.08]], 18), plateMat);
        plate.position.set(sx, ttop, tz + 0.15);
        g.add(plate);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          const f = mesh(new THREE.SphereGeometry(0.05, 10, 8), fruit[(k + kind) % 3], false);
          f.position.set(sx + (k < 3 ? Math.cos(a) * 0.06 : 0), ttop + 0.12 + (k < 3 ? 0 : 0.08), tz + 0.15 + (k < 3 ? Math.sin(a) * 0.06 : 0));
          g.add(f);
        }
      }
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
        lights[i].intensity = ((lights[i].userData.base as number | undefined) ?? 7) * doorK[i];
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
  // 后墙经橱上方一块匾「如是我聞」（佛经的开头四个字）
  {
    const pw = 3.0, ph = pw * (340 / (260 * 4 + 140));
    const plaque = mesh(new THREE.BoxGeometry(pw, ph, 0.1), [M.gold, M.gold, M.gold, M.gold, new THREE.MeshStandardMaterial({ map: plaqueTexture('如是我聞'), roughness: 0.5, metalness: 0.2 }), M.redDark]);
    plaque.position.set(0, fy + 3.45, -d.hz + 0.22);
    g.add(plaque);
  }
  // 三盏小宫灯吊在经案上方：红框、发光的黄绢灯罩（只是发光材质，不另加光源）
  {
    const silk = new THREE.MeshStandardMaterial({ color: '#f2d79a', roughness: 0.85, emissive: '#ffc070', emissiveIntensity: 0.9, side: THREE.DoubleSide });
    const frame: THREE.BufferGeometry[] = [];
    const shades: THREE.BufferGeometry[] = [];
    for (const dx of LIB_DESKS) {
      const y = fy + 2.85;
      shades.push(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 6, 1, true).translate(dx, y, LIB_DESK_Z));
      for (const yy of [y - 0.19, y + 0.19]) frame.push(new THREE.CylinderGeometry(0.23, 0.23, 0.04, 6).translate(dx, yy, LIB_DESK_Z));
      frame.push(new THREE.ConeGeometry(0.24, 0.13, 6).translate(dx, y + 0.27, LIB_DESK_Z));
      frame.push(new THREE.CylinderGeometry(0.006, 0.006, 4.35 - 3.12, 4).translate(dx, fy + (4.35 + 3.12) / 2, LIB_DESK_Z));
      frame.push(new THREE.ConeGeometry(0.03, 0.14, 6).rotateX(Math.PI).translate(dx, y - 0.28, LIB_DESK_Z));
    }
    g.add(mesh(mergeGeometries(frame.map((x) => x.toNonIndexed()))!, M.red, false));
    g.add(mesh(mergeGeometries(shades)!, silk, false));
  }
  // 点后墙的经橱：翻阅经藏
  {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(d.hx * 2 - 0.4, 2.7, 0.9), hitMat);
    hit.position.set(0, fy + 1.35, -d.hz + 0.5);
    hit.userData.interact = { type: 'sutraShelf' };
    g.add(hit);
    deskHits.push(hit);
  }
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

// 去掉最长边超过 limit（模型原始坐标）的三角形：雕像本身的三角形都很小，特别大的是扫描时带进来的底板、背板。
// 模型下半部（y < lowY）那张底板的三角形没那么大，用更小的门槛 lowLimit
function dropHugeTriangles(geo: THREE.BufferGeometry, limit: number, lowY = -Infinity, lowLimit = limit) {
  const idx = geo.index;
  if (!idx) return;
  const p = geo.attributes.position as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const keep: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(p, idx.getX(t));
    b.fromBufferAttribute(p, idx.getX(t + 1));
    c.fromBufferAttribute(p, idx.getX(t + 2));
    const e = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    if (e > limit || ((a.y + b.y + c.y) / 3 < lowY && e > lowLimit)) continue;
    keep.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  }
  geo.setIndex(keep);
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
