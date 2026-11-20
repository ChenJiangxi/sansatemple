// 两座配殿的殿内：须弥座佛坛、菩萨像（观音殿供宋代水月观音、地藏殿供地藏菩萨）、背光、翘头供桌（铜鼎、红烛、青瓷瓶插荷、供果）、暖灯；
// 地藏殿另有一架三层长明灯。殿门、佛坛、灯架各有一个点击用的隐形盒子。
// 藏经阁（第三座）里是一排排经橱和三张抄经的经案。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SH, hallWorld, HALLS, LIB_DESKS, LIB_DESK_Z, LIB_SEAT_Z } from '../layout';
import { chineseMats, cushionMesh, candleGeometry, candleTexture, candleStand, flameGeometry, vaseBouquet, plateGeometry, fruitPile } from './hall';
import { buildDing } from './bronze';
import { altarClothTexture, plaqueTexture, rng } from '../textures';
import { mandorla } from './statues';
import { mesh, worldBox, lathe, carvedBlock, grainUV } from './util';
import { paint } from './lotus';
import { pbr } from './pbr';

export const LAMPS = 36;
// 两座配殿共用的材质（第一次用到时建）
let panelMat: THREE.Material | null = null;
let clothMat: THREE.Material | null = null;
let pewterMat: THREE.Material | null = null;
let candleMatS: THREE.Material | null = null;
let vaseMatS: THREE.Material | null = null;
let plateMatS: THREE.Material | null = null;
let fruitMatS: THREE.Material | null = null;

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
    // 须弥座佛坛（朱漆）：圭角、下枋、下枭一层层收进去，束腰正面三块描金开光，上枭、上枋再挑出来；
    // 束腰上下两道金线，上枋正面一道金线。台面高 1.03
    {
      const az = -d.hz + 0.95, HX = 2.3, HZ = 0.82, IN = 0.15;
      const low = mesh(carvedBlock(HX, HZ, [[0, 0], [0.07, 0], [0.07, 0.03], [0.13, 0.03], [0.15, 0.06], [0.175, 0.1], [0.2, IN]]), M.redDark);
      low.position.set(0, fy, az);
      g.add(low);
      // 束腰用 0–1 的贴图坐标，正面那张开光图正好铺满一面
      const waist = mesh(new THREE.BoxGeometry(2 * (HX - IN), 0.56, 2 * (HZ - IN)), [M.red, M.red, M.red, M.red, (panelMat ??= new THREE.MeshStandardMaterial({ map: altarPanelTexture(), roughness: 0.55 })), M.red]);
      waist.position.set(0, fy + 0.48, az);
      g.add(waist);
      const up = mesh(carvedBlock(HX, HZ, [[0, IN], [0.025, 0.1], [0.05, 0.06], [0.075, 0.035], [0.075, 0], [0.25, 0], [0.25, 0.012], [0.27, 0.012]]), M.red);
      up.position.set(0, fy + 0.76, az);
      g.add(up);
      const trim = [0.21, 0.75].map((y) => new THREE.CylinderGeometry(0.02, 0.02, 2 * (HX - IN), 8).rotateZ(Math.PI / 2).translate(0, y, HZ - IN + 0.004).toNonIndexed());
      trim.push(new THREE.BoxGeometry(2 * HX - 0.04, 0.022, 0.01).translate(0, 0.92, HZ + 0.003).toNonIndexed());
      const gl = mesh(mergeGeometries(trim)!, M.gold, false);
      gl.position.set(0, fy, az);
      g.add(gl);
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
    // 供桌：朱漆翘头案（案面冰盘沿、两头上翘），四条圆腿、牙条、两侧双枨，正面垂做旧带褶的桌围；
    // 桌上小铜鼎、一对铜烛台插红烛、一对青瓷玉壶春瓶插荷、两只高足盘供苹果和柿子
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.6) });
    {
      const tz = -d.hz + 2.2, th = 0.8, ttop = fy + th;
      const lx = 0.95, lz = 0.25, ny = (geo: THREE.BufferGeometry) => (geo.index ? geo.toNonIndexed() : geo);
      const topParts = [ny(carvedBlock(1.1, 0.33, [[0, 0.03], [0.015, 0.012], [0.03, 0], [0.06, 0]]).translate(0, th - 0.06, 0))];
      // 翘头：案面两端各一条，从案面里侧平平起来、到端头翘起 8 厘米
      for (const dir of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(dir * 0.84, 0);
        sh.quadraticCurveTo(dir * 1.04, 0, dir * 1.12, 0.075);
        sh.lineTo(dir * 1.1, 0.082);
        sh.quadraticCurveTo(dir * 1.02, 0.026, dir * 0.84, 0.016);
        sh.closePath();
        topParts.push(ny(new THREE.ExtrudeGeometry(sh, { depth: 0.56, bevelEnabled: false, curveSegments: 8 }).translate(0, th, -0.28)));
      }
      const top = mesh(mergeGeometries(topParts)!, M.red);
      const frame: THREE.BufferGeometry[] = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) frame.push(new THREE.CylinderGeometry(0.028, 0.032, th - 0.06, 12).translate(sx * lx, (th - 0.06) / 2, sz * lz));
        for (const y of [0.12, 0.22]) frame.push(new THREE.CylinderGeometry(0.013, 0.013, lz * 2, 8).rotateX(Math.PI / 2).translate(sx * lx, y, 0));
        frame.push(new THREE.BoxGeometry(0.02, 0.06, lz * 2).translate(sx * lx, th - 0.09, 0));
        frame.push(new THREE.BoxGeometry(lx * 2, 0.06, 0.02).translate(0, th - 0.09, sx * lz));
      }
      const legs = mesh(mergeGeometries(frame.map(ny))!, M.redDark);
      for (const o of [top, legs]) {
        o.position.set(0, fy, tz);
        g.add(o);
      }
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
      // 红烛：和大殿同一式样，烛台矮一些
      const pewter = (pewterMat ??= new THREE.MeshStandardMaterial({ color: '#a88848', metalness: 0.8, roughness: 0.4 }));
      const candleMat = (candleMatS ??= new THREE.MeshStandardMaterial({ map: candleTexture(), roughness: 0.45, emissive: '#3a0805', emissiveIntensity: 0.4 }));
      const S = 0.3, CH = 0.22, flameGeo = flameGeometry();
      for (const sx of [-0.76, 0.76]) {
        const holder = mesh(candleStand(S), pewter);
        holder.position.set(sx, ttop, tz - 0.1);
        g.add(holder);
        const c = mesh(candleGeometry(CH), candleMat);
        c.position.set(sx, ttop + S - 0.01, tz - 0.1);
        c.rotation.y = Math.PI; // 贴图上的金莲转到正面
        g.add(c);
        const f = new THREE.Mesh(flameGeo, flameMat);
        f.scale.set(1, 2.3, 1);
        f.position.set(sx, ttop + S + CH + 0.055, tz - 0.1);
        g.add(f);
      }
      // 青瓷玉壶春瓶插荷：和大殿的青花瓶同一套几何体，缩小两成；荷叶都朝外
      const kit = vaseBouquet();
      const vaseMat = (vaseMatS ??= new THREE.MeshPhysicalMaterial({ color: '#8db3a0', roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
      for (const sx of [-1, 1]) {
        const v = new THREE.Group();
        v.add(mesh(kit.vase, vaseMat), mesh(kit.bouquet, kit.flowerMat, false), mesh(kit.leaf, kit.leafMat, false));
        v.scale.set(sx * 0.8, 0.8, 0.8);
        v.position.set(sx * 0.42, ttop, tz - 0.16);
        g.add(v);
      }
      const plateMat = (plateMatS ??= new THREE.MeshStandardMaterial({ color: '#eceae2', roughness: 0.3 }));
      const piles: THREE.BufferGeometry[] = [];
      for (const [sx, kind] of [[-0.6, 'apple'], [0.6, 'persimmon']] as const) {
        const plate = mesh(plateGeometry(), plateMat);
        plate.scale.setScalar(0.8);
        plate.position.set(sx, ttop, tz + 0.15);
        g.add(plate);
        piles.push(fruitPile(kind, 41 + i * 2 + (sx > 0 ? 1 : 0)).scale(0.8, 0.8, 0.8).translate(sx, ttop, tz + 0.15));
      }
      g.add(mesh(mergeGeometries(piles)!, (fruitMatS ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 }))));
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
    // 地藏殿的长明灯架：三级台阶式的朱漆木架，两侧台阶形侧板，每级前面一块挡板；每级一排十二盏铜莲花灯盏
    if (i === 1) {
      const LX = -5.1, W = 3.0;
      const tierY = (t: number) => 0.55 + t * 0.35; // 相对殿内地面
      const tierZ = (t: number) => -d.hz + 1.45 - t * 0.33;
      const wood: THREE.BufferGeometry[] = [];
      const add = (geo: THREE.BufferGeometry, axis: 'x' | 'y' | 'z') => wood.push(grainUV(geo.index ? geo.toNonIndexed() : geo, axis));
      // 侧板：形状的 x 是殿内 z，转过来立在架子两头
      const side = new THREE.Shape();
      side.moveTo(tierZ(0) + 0.17, 0);
      for (let t = 0; t < 3; t++) {
        side.lineTo(tierZ(t) + 0.17, tierY(t) + 0.07);
        side.lineTo(t < 2 ? tierZ(t + 1) + 0.17 : tierZ(2) - 0.17, tierY(t) + 0.07);
      }
      side.lineTo(tierZ(2) - 0.17, 0);
      side.closePath();
      for (const sx of [-1, 1]) add(new THREE.ExtrudeGeometry(side, { depth: 0.05, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(LX + sx * (W / 2 + 0.025) + 0.025, 0, 0), 'z');
      for (let t = 0; t < 3; t++) {
        add(new RoundedBoxGeometry(W, 0.05, 0.34, 2, 0.012).translate(LX, tierY(t) + 0.015, tierZ(t)), 'x');
        const y0 = t ? tierY(t - 1) + 0.04 : 0, y1 = tierY(t) - 0.01;
        add(new THREE.BoxGeometry(W, y1 - y0, 0.025).translate(LX, (y0 + y1) / 2, tierZ(t) + 0.14), 'x');
      }
      add(new THREE.BoxGeometry(W, tierY(2), 0.025).translate(LX, tierY(2) / 2, tierZ(2) - 0.155), 'x');
      const stand = mesh(mergeGeometries(wood)!, M.red);
      stand.position.y = fy;
      g.add(stand);
      // 莲花灯盏：小圈足、细腰，盏口分八瓣、瓣尖微微上翘
      const cupGeo = lathe([[0, 0], [0.026, 0], [0.028, 0.006], [0.012, 0.014], [0.011, 0.024], [0.03, 0.03], [0.046, 0.046], [0.05, 0.056], [0.044, 0.054], [0.03, 0.042], [0, 0.04]], 24);
      {
        const p = cupGeo.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) {
          const y = p.getY(k);
          if (y < 0.028) continue;
          const lobe = Math.abs(Math.cos(4 * Math.atan2(p.getX(k), p.getZ(k))));
          const w = Math.min(1, (y - 0.028) / 0.02);
          const r = 1 + 0.1 * w * (lobe - 0.5);
          p.setXYZ(k, p.getX(k) * r, y + 0.006 * w * lobe, p.getZ(k) * r);
        }
        cupGeo.computeVertexNormals();
      }
      const cups: THREE.BufferGeometry[] = [];
      for (let t = 0; t < 3; t++) {
        const y = fy + tierY(t);
        for (let k = 0; k < 12; k++) {
          const x = LX - 1.375 + k * 0.25;
          cups.push(cupGeo.clone().translate(x, y + 0.04, tierZ(t)));
          flameAt.push(new THREE.Vector3(x, y + 0.12, tierZ(t)));
        }
      }
      g.add(mesh(mergeGeometries(cups)!, M.gold, false));
      flames = new THREE.InstancedMesh(flameGeometry().scale(0.7, 1.6, 0.7), flameMat, LAMPS);
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

// 《心经》抄经纸：米黄皮纸，淡朱色竖格（乌丝栏）；从右往左写，第一行是经名，写到一半，左边还空着
function sutraPaperTexture() {
  const W = 512, H = 340;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe5cc';
  g.fillRect(0, 0, W, H);
  const r = rng(77);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(160,130,90,0.06)' : 'rgba(255,250,235,0.12)';
    g.fillRect(r() * W, r() * H, 1 + r() * 8, 1);
  }
  const cols = 14, cw = 33, x0 = (W - cols * cw) / 2, top = 22, rows = 10, rh = (H - 44) / rows;
  g.strokeStyle = 'rgba(176,72,52,0.55)';
  g.lineWidth = 1.5;
  for (let k = 0; k <= cols; k++) {
    g.beginPath();
    g.moveTo(x0 + k * cw, top - 6);
    g.lineTo(x0 + k * cw, H - top + 6);
    g.stroke();
  }
  g.strokeRect(x0 - 5, top - 6, cols * cw + 10, H - 2 * top + 12);
  const text = ['般若波羅蜜多心經', '觀自在菩薩行深般若', '波羅蜜多時照見五蘊', '皆空度一切苦厄舍利', '子色不異空空不異色', '色即是空空即是色受', '想行識亦復如是舍利', '子是諸法空相'];
  g.fillStyle = 'rgba(24,20,18,0.88)';
  g.font = '500 23px "Songti TC","Songti SC","STSong","Noto Serif CJK TC","Noto Serif CJK SC","Source Han Serif","SimSun",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  text.forEach((line, k) => {
    const x = x0 + (cols - 0.5 - k) * cw;
    [...line].forEach((ch, j) => g.fillText(ch, x, top + (j + 0.5 + (k === 0 ? 1 : 0)) * rh));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 藏经阁殿内：后墙一排经橱，两侧墙后半段也立着经橱；殿中三张矮经案，案上抄经纸、镇尺、砚台、笔架，案后一张方坐垫
function furnishLibrary(g: THREE.Group, d: ReturnType<typeof SH>, fy: number, deskHits: THREE.Mesh[], hitMat: THREE.Material, M: ReturnType<typeof chineseMats>) {
  // 经橱：底座下收一道踢脚；橱身正面是一格格经函（贴图），格子之间的立柱和隔板做成真木条凸出来；顶帽一道线脚向外挑。
  // 所有经橱的木作合成一个网格，正面经函合成一个网格
  {
    const woodParts: THREE.BufferGeometry[] = [], faceParts: THREE.BufferGeometry[] = [];
    const D = 0.6, BH = 0.14, CH = 2.46;
    const shelf = (x: number, z: number, w: number, yaw: number) => {
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
      const wood = (geo: THREE.BufferGeometry, axis: 'x' | 'y' | 'z') => woodParts.push(grainUV(geo.index ? geo.toNonIndexed() : geo, axis).applyMatrix4(m));
      wood(carvedBlock(w / 2, D / 2, [[0, 0.03], [0.1, 0.03], [0.1, 0], [BH, 0]]), 'x');
      wood(worldBox(w, CH, D - 0.04).translate(0, BH + CH / 2, -0.02), 'y');
      wood(carvedBlock(w / 2 + 0.06, D / 2 + 0.06, [[0, 0.06], [0.03, 0.06], [0.05, 0.04], [0.07, 0.015], [0.08, 0], [0.13, 0]]).translate(0, BH + CH, 0), 'x');
      // 贴图是 4 列 × 6 层的格子，立柱、隔板压在格子之间的缝上
      const fw = w - 0.02, fh = CH - 0.02;
      faceParts.push(new THREE.PlaneGeometry(fw, fh).translate(0, BH + CH / 2, D / 2 - 0.035).applyMatrix4(m));
      for (let k = 0; k <= 4; k++) {
        const pw = k % 4 ? fw / 32 + 0.004 : 0.05;
        const px = k === 0 ? -w / 2 + 0.025 : k === 4 ? w / 2 - 0.025 : -fw / 2 + (k * fw) / 4;
        wood(new THREE.BoxGeometry(pw, CH, 0.05).translate(px, BH + CH / 2, D / 2 - 0.025), 'y');
      }
      for (let r = 0; r <= 6; r++) {
        const v = r === 0 ? 4 : r === 6 ? 509 : (r * 512) / 6 + 1; // 贴图上从顶往下的像素
        const rh = r % 6 ? (14 / 512) * fh : 0.04;
        const y = Math.min(BH + CH - rh / 2, Math.max(BH + rh / 2, BH + 0.01 + fh * (1 - v / 512)));
        wood(new THREE.BoxGeometry(w - 0.02, rh, 0.045).translate(0, y, D / 2 - 0.0275), 'x');
      }
    };
    const n = 6, sw = (d.hx * 2 - 0.6) / n;
    for (let k = 0; k < n; k++) shelf(-d.hx + 0.3 + sw * (k + 0.5), -d.hz + 0.45, sw - 0.08, 0);
    for (const sx of [-1, 1]) for (const z of [-2.0, -0.4]) shelf(sx * (d.hx - 0.45), z, 1.5, -sx * Math.PI / 2);
    const woodMat = pbr('wood', { metersPerTile: 0.9, color: '#6a3524' });
    woodMat.roughness = 0.6;
    const cab = mesh(mergeGeometries(woodParts)!, woodMat);
    const face = mesh(mergeGeometries(faceParts)!, new THREE.MeshStandardMaterial({ map: shelfTexture(), roughness: 0.75 }), false);
    for (const o of [cab, face]) {
      o.position.y = fy;
      g.add(o);
    }
  }
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
  // 经案：朱漆矮案，案面冰盘沿；两侧板下沿挖出壶门、立在托泥上，前后各一条牙条。高 0.43
  const deskGeo = (() => {
    const parts: THREE.BufferGeometry[] = [carvedBlock(0.75, 0.28, [[0, 0.025], [0.015, 0.01], [0.025, 0], [0.045, 0]]).translate(0, 0.385, 0)];
    const panel = new THREE.Shape();
    panel.moveTo(-0.24, 0.05);
    panel.lineTo(-0.16, 0.05);
    panel.lineTo(-0.16, 0.2);
    panel.quadraticCurveTo(-0.16, 0.28, -0.04, 0.285);
    panel.quadraticCurveTo(-0.01, 0.287, 0, 0.305);
    panel.quadraticCurveTo(0.01, 0.287, 0.04, 0.285);
    panel.quadraticCurveTo(0.16, 0.28, 0.16, 0.2);
    panel.lineTo(0.16, 0.05);
    panel.lineTo(0.24, 0.05);
    panel.lineTo(0.24, 0.385);
    panel.lineTo(-0.24, 0.385);
    panel.closePath();
    for (const sx of [-1, 1]) {
      parts.push(new THREE.ExtrudeGeometry(panel, { depth: 0.04, bevelEnabled: false, curveSegments: 6 }).rotateY(-Math.PI / 2).translate(sx * 0.66 + 0.02, 0, 0));
      parts.push(new RoundedBoxGeometry(0.07, 0.05, 0.54, 2, 0.01).translate(sx * 0.66, 0.025, 0));
      parts.push(new THREE.BoxGeometry(1.28, 0.045, 0.02).translate(0, 0.3625, sx * 0.2));
    }
    return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  })();
  // 案上的东西做成一组，三张案各复制一份（几何体和材质共用）
  const items = new THREE.Group();
  {
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
    const sheet = mesh(new THREE.PlaneGeometry(0.6, 0.4).rotateX(-Math.PI / 2), std({ map: sutraPaperTexture(), roughness: 0.95 }), false);
    sheet.position.set(0, 0.002, 0.02);
    // 镇尺压在纸的上端
    const weight = mesh(new RoundedBoxGeometry(0.5, 0.014, 0.03, 2, 0.005), std({ color: '#2b1a12', roughness: 0.45 }));
    weight.position.set(0, 0.009, -0.155);
    // 砚台和墨：长方砚，砚头一汪墨；一锭墨搁在旁边
    const ink = new THREE.Group();
    ink.position.set(0.52, 0, -0.04);
    ink.rotation.y = -0.1;
    ink.add(
      mesh(new RoundedBoxGeometry(0.13, 0.026, 0.19, 2, 0.006).translate(0, 0.013, 0), std({ color: '#2d2b29', roughness: 0.55 })),
      mesh(new THREE.CircleGeometry(1, 24).scale(0.045, 0.028, 1).rotateX(-Math.PI / 2).translate(0, 0.0265, -0.055), std({ color: '#0c0b0b', roughness: 0.08 }), false),
      mesh(new THREE.BoxGeometry(0.02, 0.013, 0.075).rotateY(0.5).translate(0.095, 0.0065, 0.04), std({ color: '#171515', roughness: 0.5 }))
    );
    // 山形笔架：三座峰，一支笔搁在右边的山口里，笔头朝坐垫这边
    const rest = new THREE.Shape();
    rest.moveTo(-0.07, 0);
    rest.lineTo(0.07, 0);
    rest.lineTo(0.07, 0.018);
    rest.quadraticCurveTo(0.06, 0.045, 0.045, 0.042);
    rest.quadraticCurveTo(0.03, 0.04, 0.022, 0.028);
    rest.quadraticCurveTo(0.012, 0.035, 0.006, 0.05);
    rest.quadraticCurveTo(0, 0.06, -0.006, 0.05);
    rest.quadraticCurveTo(-0.012, 0.035, -0.022, 0.028);
    rest.quadraticCurveTo(-0.03, 0.04, -0.045, 0.042);
    rest.quadraticCurveTo(-0.06, 0.045, -0.07, 0.018);
    rest.closePath();
    const brushRest = new THREE.Group();
    brushRest.position.set(-0.5, 0, -0.06);
    const nonIdx = (geo: THREE.BufferGeometry) => {
      const n = geo.toNonIndexed();
      n.deleteAttribute('uv');
      return n;
    };
    const brush = mergeGeometries([
      paint(nonIdx(new THREE.CylinderGeometry(0.0045, 0.005, 0.2, 6).rotateX(Math.PI / 2)), () => new THREE.Color('#b39a5c')),
      paint(nonIdx(lathe([[0, 0], [0.0062, 0], [0.0082, 0.009], [0.0075, 0.022], [0.004, 0.036], [0, 0.046]], 8).rotateX(Math.PI / 2).translate(0, 0, 0.1)), () => new THREE.Color('#2b2621')),
    ])!;
    brushRest.add(
      mesh(new THREE.ExtrudeGeometry(rest, { depth: 0.022, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -0.011), std({ color: '#3a2418', roughness: 0.5 })),
      mesh(brush.translate(0.022, 0.033, 0.03), std({ vertexColors: true, roughness: 0.6 }))
    );
    items.add(sheet, weight, ink, brushRest);
  }
  // 方坐垫：圆角厚垫，面上微微鼓起
  const seatGeo = new RoundedBoxGeometry(0.6, 0.09, 0.5, 3, 0.035);
  {
    const p = seatGeo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) <= 0) continue;
      const fx = Math.max(0, 1 - (p.getX(k) / 0.3) ** 2), fz = Math.max(0, 1 - (p.getZ(k) / 0.25) ** 2);
      p.setY(k, p.getY(k) + 0.016 * fx * fz);
    }
  }
  const seatMat = new THREE.MeshStandardMaterial({ color: '#7d5232', roughness: 0.95 });
  LIB_DESKS.forEach((dx, k) => {
    const desk = mesh(deskGeo, M.redDark);
    desk.position.set(dx, fy, LIB_DESK_Z);
    g.add(desk);
    const it = items.clone();
    it.position.set(dx, fy + 0.43, LIB_DESK_Z);
    g.add(it);
    const seat = mesh(seatGeo, seatMat);
    seat.position.set(dx, fy + 0.045, LIB_SEAT_Z);
    g.add(seat);
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
