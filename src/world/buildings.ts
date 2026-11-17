// 配殿（观音殿、地藏殿）与钟楼、鼓楼：朱红柱、格扇门、彩画梁、带鸱吻的屋顶
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALLS, BELL, DRUM } from '../layout';
import { plaqueTexture } from '../textures';
import { worldBox, mesh, lathe } from './util';
import { buildTempleBell } from './bronze';
import { buildRoof, beamRing, chineseMats, meterUV, aged } from './hall';
import { pbr } from './pbr';

const plaqueNames = ['觀音殿', '地藏殿', '藏經閣'];

function plaqueMesh(text: string, width: number) {
  const M = chineseMats();
  const n = [...text].length;
  const h = width * (340 / (260 * n + 140));
  return mesh(new THREE.BoxGeometry(width, h, 0.12), [M.gold, M.gold, M.gold, M.gold, new THREE.MeshStandardMaterial({ map: plaqueTexture(text), roughness: 0.5, metalness: 0.2 }), M.redDark]);
}

function sideHall(def: (typeof HALLS)[number], idx: number) {
  const M = chineseMats();
  const g = new THREE.Group();
  const L = def.d; // 面阔（本地 x）
  const D = def.w; // 进深（本地 z）
  const base = 0.6;
  const colH = 4.2;
  const plat = mesh(worldBox(L + 1.6, base, D + 1.6, 1), [M.marbleSide, M.marbleSide, M.marble, M.marble, M.marbleSide, M.marbleSide]);
  plat.position.y = base / 2;
  g.add(plat);
  for (let k = 0; k < 2; k++) {
    const s = mesh(worldBox(3.2, (base * (k + 1)) / 2, 0.6 * (2 - k), 1), M.marble);
    s.position.set(0, (base * (k + 1)) / 4, D / 2 + 0.8 + 0.3 * (2 - k));
    g.add(s);
  }
  const hx = L / 2 - 0.4;
  const hz = D / 2 - 0.4;
  const colTop = base + colH;
  const colGeo = meterUV(new THREE.CylinderGeometry(0.24, 0.27, colH, 16), 1.6, colH);
  for (const x of [-hx, -hx / 2, 0, hx / 2, hx])
    for (const z of [-hz, hz]) {
      const c = mesh(colGeo, M.red);
      c.position.set(x, base + colH / 2, z);
      g.add(c);
    }
  // 正面四间格扇门；正中两间的门扇做成能转开的（两扇一组，绕外侧的门轴往殿里开）
  const bay = hx / 2;
  const leaves: THREE.BufferGeometry[] = [];
  const doors: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const cx = -hx + bay / 2 + i * bay;
    const w = (bay - 0.4) / 4;
    const x0 = cx - (bay - 0.4) / 2;
    if (i === 1 || i === 2) {
      for (const side of [0, 1]) {
        const pivot = new THREE.Group();
        const hingeX = side === 0 ? x0 : x0 + 4 * w;
        pivot.position.set(hingeX, 0, hz);
        const pair: THREE.BufferGeometry[] = [];
        for (let k = 0; k < 2; k++) {
          const leaf = new THREE.BoxGeometry(w - 0.03, colH - 1.0, 0.1);
          const lx = side === 0 ? w * (k + 0.5) : -w * (k + 0.5);
          leaf.translate(lx, base + (colH - 1.0) / 2, 0);
          pair.push(leaf);
        }
        pivot.add(mesh(mergeGeometries(pair), M.geshan));
        pivot.userData.openSign = side === 0 ? 1 : -1;
        doors.push(pivot);
        g.add(pivot);
      }
    } else
      for (let k = 0; k < 4; k++) {
        const leaf = new THREE.BoxGeometry(w - 0.03, colH - 1.0, 0.1);
        leaf.translate(x0 + w * (k + 0.5), base + (colH - 1.0) / 2, hz);
        leaves.push(leaf);
      }
    const tw = new THREE.BoxGeometry(bay - 0.4, 0.6, 0.1);
    tw.translate(cx, colTop - 0.65, hz);
    leaves.push(tw);
  }
  const front = mesh(mergeGeometries(leaves), M.geshan);
  g.add(front);
  const back = mesh(worldBox(hx * 2, colH, 0.3, 1), M.redWall);
  back.position.set(0, base + colH / 2, -hz);
  g.add(back);
  const walls: THREE.Object3D[] = [back, front];
  for (const sx of [-1, 1]) {
    const w = mesh(worldBox(0.3, colH, hz * 2, 1), M.redWall);
    w.position.set(sx * hx, base + colH / 2, 0);
    g.add(w);
    walls.push(w);
  }
  // 殿内的天花：挡住从屋檐缝里漏进来的光，也让殿里暗下来
  const inCeil = mesh(worldBox(hx * 2, 0.06, hz * 2, 1), M.redDark);
  inCeil.position.set(0, colTop + 0.15, 0);
  g.add(inCeil);
  walls.push(inCeil);
  const fill = mesh(new THREE.BoxGeometry(hx * 2 + 0.2, 0.9, hz * 2 + 0.2), M.green);
  fill.position.y = colTop + 0.6;
  g.add(fill);
  beamRing(g, 0, 0, hx, hz, colTop, M, 1.0);
  if (idx === 2) upperStorey(g, hx, hz, colTop);
  else {
    g.add(buildRoof({ cx: 0, cz: 0, W: hx + 2.2, D: hz + 2.2, rx: hx * 0.55, eaveY: colTop + 1.2, ridgeY: colTop + 4.4, lift: 0.9, ornate: true }));
    const plaque = plaqueMesh(plaqueNames[idx], 2.6);
    plaque.position.set(0, colTop - 0.05, hz + 0.32);
    plaque.rotation.x = -0.08;
    g.add(plaque);
  }
  g.position.set(def.x, 0, def.z);
  g.rotation.y = def.yaw;
  return { g, doors, walls };
}

// 藏经阁的二层：一圈腰檐，上面是带栏杆的外廊（平座），再起一层小一圈的阁楼，匾额挂在二层檐下
function upperStorey(g: THREE.Group, hx: number, hz: number, colTop: number) {
  const M = chineseMats();
  g.add(buildRoof({ cx: 0, cz: 0, W: hx + 1.8, D: hz + 1.8, rx: hx * 0.62, eaveY: colTop + 1.0, ridgeY: colTop + 1.7, lift: 0.6 }));
  // 平座下的斗拱带，挡住腰檐和二层地板之间的空当
  const band = mesh(new THREE.BoxGeometry(hx * 2 + 0.6, 0.55, hz * 2 + 0.6), M.green);
  band.position.y = colTop + 1.32;
  g.add(band);
  const fy = colTop + 1.8;
  const floor = mesh(worldBox(hx * 2 + 0.8, 0.22, hz * 2 + 0.8, 1), M.redDark);
  floor.position.y = fy - 0.11;
  g.add(floor);
  const ux = hx - 0.9, uz = hz - 0.9, ch = 3.0;
  const colGeo = meterUV(new THREE.CylinderGeometry(0.2, 0.22, ch, 14), 1.3, ch);
  for (const x of [-ux, -ux / 2, 0, ux / 2, ux])
    for (const z of [-uz, uz]) {
      const c = mesh(colGeo, M.red);
      c.position.set(x, fy + ch / 2, z);
      g.add(c);
    }
  // 正面一排格扇窗，背面和两侧是红墙
  const win: THREE.BufferGeometry[] = [];
  const bays = 4, bw = (ux * 2) / bays;
  for (let i = 0; i < bays; i++)
    for (let k = 0; k < 4; k++) {
      const w = (bw - 0.4) / 4;
      const leaf = new THREE.BoxGeometry(w - 0.03, ch - 0.7, 0.1);
      leaf.translate(-ux + i * bw + 0.2 + w * (k + 0.5), fy + (ch - 0.7) / 2, uz);
      win.push(leaf);
    }
  g.add(mesh(mergeGeometries(win), M.geshan));
  const back = mesh(worldBox(ux * 2, ch, 0.25, 1), M.redWall);
  back.position.set(0, fy + ch / 2, -uz);
  g.add(back);
  for (const sx of [-1, 1]) {
    const w = mesh(worldBox(0.25, ch, uz * 2, 1), M.redWall);
    w.position.set(sx * ux, fy + ch / 2, 0);
    g.add(w);
  }
  // 外廊栏杆：一圈望柱，上下两道扶手
  const rail: THREE.BufferGeometry[] = [];
  const ex = hx + 0.3, ez = hz + 0.3;
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i <= n; i++) {
      const p = new THREE.BoxGeometry(0.1, 0.85, 0.1);
      p.translate(x0 + ((x1 - x0) * i) / n, fy + 0.42, z0 + ((z1 - z0) * i) / n);
      rail.push(p);
    }
    for (const [y, h] of [[0.8, 0.07], [0.35, 0.05]]) {
      const b = new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.07, h, Math.abs(z1 - z0) + 0.07);
      b.translate((x0 + x1) / 2, fy + y, (z0 + z1) / 2);
      rail.push(b);
    }
  };
  side(-ex, ez, ex, ez);
  side(-ex, -ez, ex, -ez);
  side(-ex, -ez, -ex, ez);
  side(ex, -ez, ex, ez);
  g.add(mesh(mergeGeometries(rail), M.red));
  const top = fy + ch;
  const fill = mesh(new THREE.BoxGeometry(ux * 2 + 0.2, 0.8, uz * 2 + 0.2), M.green);
  fill.position.y = top + 0.5;
  g.add(fill);
  beamRing(g, 0, 0, ux, uz, top, M, 1.0);
  g.add(buildRoof({ cx: 0, cz: 0, W: ux + 2.1, D: uz + 2.1, rx: ux * 0.55, eaveY: top + 1.05, ridgeY: top + 3.7, lift: 0.9, ornate: true }));
  const plaque = plaqueMesh('藏經閣', 2.8);
  plaque.position.set(0, top - 0.1, uz + 0.32);
  plaque.rotation.x = -0.08;
  g.add(plaque);
}

export interface StrikeBuild {
  interactives: THREE.Object3D[];
  strike(): void;
  update(dt: number): void;
  standX: number;
  standZ: number;
  standYaw: number;
  aim?(p: number): void; // 撞钟时把撞木往后拉（0 到 1）
}

// 钟鼓楼的亭子：台基、四根红柱、彩画梁、带鸱吻的四坡顶、匾额
function pavilion(T: { x: number; z: number; size: number; platform: number }, name: string, group: THREE.Group) {
  const M = chineseMats();
  const g = new THREE.Group();
  const S = T.size;
  const base = T.platform;
  // 台基：青灰条石，台面一圈压阑石，底下再放宽一道土衬石
  const platTop = pbr('granite', { metersPerTile: 1.1, color: new THREE.Color().setRGB(2.7, 2.6, 2.44) });
  const platSide = pbr('granite', { metersPerTile: 0.9, color: new THREE.Color().setRGB(2.25, 2.17, 2.03) });
  aged(platTop, 0.1, 0.28);
  aged(platSide, 0.1, 0.32);
  const plat = mesh(worldBox(S + 1.2, base, S + 1.2, 1), [platSide, platSide, platTop, platTop, platSide, platSide]);
  plat.position.y = base / 2;
  plat.name = 'walkable';
  g.add(plat);
  const plinth = mesh(worldBox(S + 1.5, 0.07, S + 1.5, 1), platSide);
  plinth.position.y = 0.035;
  g.add(plinth);
  const edgeMat = pbr('granite', { metersPerTile: 0.8, color: new THREE.Color().setRGB(3.0, 2.9, 2.72) });
  aged(edgeMat, 0.1, 0.25);
  const edge: THREE.BufferGeometry[] = [];
  const E = (S + 1.2) / 2;
  for (const sgn of [-1, 1]) {
    const a = worldBox(S + 1.2, 0.012, 0.42, 1);
    a.translate(0, base + 0.006, sgn * (E - 0.21));
    const b = worldBox(0.42, 0.012, S + 1.2 - 0.84, 1);
    b.translate(sgn * (E - 0.21), base + 0.006, 0);
    edge.push(a, b);
  }
  g.add(mesh(mergeGeometries(edge), edgeMat, false));
  const colH = 4.8;
  const h = S / 2 - 0.4;
  const colTop = base + colH;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = mesh(meterUV(new THREE.CylinderGeometry(0.25, 0.29, colH, 16), 1.7, colH), M.red);
    c.position.set(sx * h, base + colH / 2, sz * h);
    g.add(c);
    const p = mesh(lathe([[0, 0], [0.45, 0], [0.45, 0.05], [0.36, 0.16], [0, 0.16]], 16), M.marble);
    p.position.set(sx * h, base, sz * h);
    g.add(p);
  }
  beamRing(g, 0, 0, h, h, colTop, M, 0.9, false);
  g.add(buildRoof({ cx: 0, cz: 0, W: h + 1.9, D: h + 1.9, rx: 0.9, eaveY: colTop + 1.2, ridgeY: colTop + 3.8, lift: 0.95, ornate: true }));
  const plaque = plaqueMesh(name, 1.7);
  plaque.position.set(0, colTop - 0.1, h + 0.3);
  g.add(plaque);
  g.position.set(T.x, 0, T.z);
  group.add(g);
  return { g, colTop };
}

function bellTower(group: THREE.Group): StrikeBuild {
  const { g, colTop } = pavilion(BELL, '鐘樓', group);
  const M = chineseMats();
  const hanger = mesh(worldBox(BELL.size - 0.8, 0.34, 0.34, 1), M.red);
  hanger.position.set(0, colTop - 0.5, 0);
  g.add(hanger);
  // 梵钟：波浪钟口、莲瓣、四区佛号铭文、莲花撞座、蒲牢钮，青铜带铜锈
  const bronze = new THREE.MeshStandardMaterial({ color: '#4f5a48', metalness: 0.85, roughness: 0.42 });
  const bell = buildTempleBell();
  bell.position.set(0, colTop - 1.2, 0);
  g.add(bell);
  const chain = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), bronze);
  chain.position.set(0, colTop - 0.92, 0);
  g.add(chain);
  // 撞木
  const logPivot = new THREE.Group();
  logPivot.position.set(-1.25, colTop - 0.5, 0);
  const log = mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.0, 12), M.red);
  log.rotation.z = Math.PI / 2;
  log.position.set(-0.9, -2.27, 0);
  logPivot.add(log);
  const ropeMat = new THREE.LineBasicMaterial({ color: '#c9302a' });
  for (const x of [-1.6, -0.2]) logPivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -2.27, 0)]), ropeMat));
  g.add(logPivot);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 2.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(-0.8, colTop - 2.2, 0);
  hit.userData.interact = { type: 'bell' };
  g.add(hit);

  let swing = 0;
  let sway = 0;
  let phase = 0;
  let pull = 0;
  return {
    interactives: [hit],
    standX: BELL.x - 2.6,
    standZ: BELL.z + 1.0,
    standYaw: Math.PI / 2,
    aim(p: number) {
      pull = p;
    },
    strike() {
      // 已经拉开了就直接从「往前撞」那一段开始
      swing = pull > 0.05 || logPivot.rotation.z < -0.05 ? 0.55 : 1;
      pull = 0;
    },
    update(dt) {
      if (pull > 0) {
        logPivot.rotation.z += (-pull * 0.5 - logPivot.rotation.z) * Math.min(1, dt * 10);
        return;
      }
      if (swing > 0) {
        swing = Math.max(0, swing - dt * 0.9);
        const t = 1 - swing;
        logPivot.rotation.z = t < 0.45 ? -Math.sin((t / 0.45) * Math.PI * 0.5) * 0.35 : -0.35 + Math.sin(((t - 0.45) / 0.55) * Math.PI * 0.5) * 0.47;
        if (t > 0.98 && sway <= 0) sway = 1;
      } else logPivot.rotation.z *= Math.pow(0.1, dt);
      if (sway > 0) {
        sway = Math.max(0, sway - dt * 0.12);
        phase += dt * 3.2;
        bell.rotation.z = Math.sin(phase) * 0.025 * sway;
      }
    },
  };
}

function drumTower(group: THREE.Group): StrikeBuild {
  const { g } = pavilion(DRUM, '鼓樓', group);
  const M = chineseMats();
  // 大鼓：鼓面朝左右（东边击鼓），鼓腔微鼓、朱漆描金带，鼓面边上两圈金钉；
  // 鼓架是四根立柱（柱头莲苞）围在鼓外，两侧铜环把鼓吊在柱间的横枋上，下面一道托梁
  const drum = new THREE.Group();
  const HALF = 0.6;
  const rAt = (x: number) => 0.9 + 0.13 * (1 - (x / HALF) ** 2);
  const prof: [number, number][] = [[0, -HALF + 0.03]];
  for (let i = 0; i <= 16; i++) {
    const x = -HALF + (i / 16) * HALF * 2;
    prof.push([rAt(x), x]);
  }
  prof.push([0, HALF - 0.03]);
  const body = mesh(lathe(prof, 48), M.red);
  body.rotation.z = Math.PI / 2;
  drum.add(body);
  const goldBand = (x: number, w: number) => {
    const r0 = rAt(x);
    const band = mesh(lathe([[r0 + 0.004, -w / 2], [r0 + 0.012, -w / 4], [r0 + 0.012, w / 4], [r0 + 0.004, w / 2]], 48), M.gold, false);
    band.rotation.z = Math.PI / 2;
    band.position.x = x;
    drum.add(band);
  };
  for (const x of [-0.42, 0.42]) goldBand(x, 0.035);
  for (const x of [-0.12, 0.12]) goldBand(x, 0.02);
  // 鼓面：牛皮色，中间常敲的地方略深，边上一道暗圈
  const headTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, '#b89a68');
    grd.addColorStop(0.35, '#d2b884');
    grd.addColorStop(0.85, '#dcc697');
    grd.addColorStop(0.95, '#8a6a44');
    grd.addColorStop(1, '#5a3d26');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(120,90,50,0.06)' : 'rgba(255,245,220,0.05)';
      g.beginPath();
      g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 8, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const headMat = new THREE.MeshStandardMaterial({ map: headTex, roughness: 0.75 });
  const nails = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 8, 6), M.gold, 2 * 2 * 44);
  let ni = 0;
  const nm = new THREE.Matrix4();
  for (const s of [-1, 1]) {
    const r0 = rAt(HALF);
    const head = mesh(new THREE.CircleGeometry(r0 - 0.01, 48), headMat);
    head.rotation.y = (s * Math.PI) / 2;
    head.position.x = s * (HALF + 0.004);
    drum.add(head);
    for (const [dx, n] of [[0.035, 44], [0.085, 44]] as const) {
      const x = s * (HALF - dx);
      for (let k = 0; k < n; k++) {
        const a = ((k + (dx > 0.05 ? 0.5 : 0)) / n) * Math.PI * 2;
        const rr = rAt(x) + 0.004;
        nm.makeTranslation(x, Math.cos(a) * rr, Math.sin(a) * rr);
        nails.setMatrixAt(ni++, nm);
      }
    }
  }
  drum.add(nails);
  // 两侧的铜环
  const ringMat = new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: 0.85, roughness: 0.38 });
  for (const sz of [-1, 1]) {
    const lug = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), ringMat, false);
    lug.rotation.x = Math.PI / 2;
    lug.position.z = sz * (rAt(0) + 0.03);
    drum.add(lug);
    const ring = mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 20), ringMat, false);
    ring.position.set(0, 0, sz * (rAt(0) + 0.13));
    drum.add(ring);
  }
  const CY = DRUM.platform + 1.42;
  drum.position.set(0, CY, 0);
  g.add(drum);
  // 鼓架
  const frame: THREE.BufferGeometry[] = [];
  const PZ = rAt(0) + 0.32, PX = 0.62, TOP = CY + 0.42;
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const post = new THREE.CylinderGeometry(0.075, 0.085, TOP - DRUM.platform, 12);
      post.translate(sx * PX, DRUM.platform + (TOP - DRUM.platform) / 2, sz * PZ);
      frame.push(post);
      const foot = new THREE.CylinderGeometry(0.12, 0.14, 0.1, 12);
      foot.translate(sx * PX, DRUM.platform + 0.05, sz * PZ);
      frame.push(foot);
    }
    // 柱间上、下两道横枋，铜环挂在上枋正中
    const upper = worldBox(PX * 2 + 0.2, 0.12, 0.12, 1);
    upper.translate(0, CY + 0.12, sz * PZ);
    frame.push(upper);
    const lower = worldBox(PX * 2, 0.1, 0.1, 1);
    lower.translate(0, DRUM.platform + 0.32, sz * PZ);
    frame.push(lower);
    const hook = worldBox(0.05, 0.12, 0.05, 1);
    hook.translate(0, CY + 0.02, sz * (rAt(0) + 0.2));
    frame.push(hook);
  }
  // 底下前后两道纵枋，中间一道托梁贴着鼓腹
  for (const sx of [-1, 1]) {
    const rail = worldBox(0.1, 0.1, PZ * 2, 1);
    rail.translate(sx * PX, DRUM.platform + 0.32, 0);
    frame.push(rail);
  }
  const cradle = worldBox(PX * 2 - 0.1, 0.1, 0.5, 1);
  cradle.translate(0, CY - rAt(0) - 0.06, 0);
  frame.push(cradle);
  for (const sx of [-1, 1]) {
    const strut = worldBox(0.1, CY - rAt(0) - 0.11 - (DRUM.platform + 0.37), 0.1, 1);
    strut.translate(sx * (PX - 0.18), (CY - rAt(0) - 0.11 + DRUM.platform + 0.37) / 2, 0);
    frame.push(strut);
  }
  g.add(mesh(mergeGeometries(frame.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => {
    x.deleteAttribute('uv');
    return x;
  })), M.redDark));
  // 柱头莲苞
  const bud = lathe([[0, 0], [0.09, 0.0], [0.11, 0.05], [0.1, 0.11], [0.06, 0.17], [0, 0.21]], 12);
  for (const sz of [-1, 1])
    for (const sx of [-1, 1]) {
      const b = mesh(bud, M.gold, false);
      b.position.set(sx * PX, TOP, sz * PZ);
      g.add(b);
    }
  // 鼓槌
  const stickPivot = new THREE.Group();
  stickPivot.position.set(1.15, CY, 0.25);
  const stick = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 8), M.redDark);
  stick.rotation.z = Math.PI / 2;
  stick.position.x = 0.35;
  stickPivot.add(stick);
  g.add(stickPivot);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, CY, 0);
  hit.userData.interact = { type: 'drum' };
  g.add(hit);
  let t = 0;
  let shake = 0;
  return {
    interactives: [hit],
    standX: DRUM.x + 1.9,
    standZ: DRUM.z + 0.3,
    standYaw: -Math.PI / 2,
    strike() {
      t = 1;
    },
    update(dt) {
      if (t > 0) {
        t = Math.max(0, t - dt * 1.6);
        const k = 1 - t;
        stickPivot.rotation.y = k < 0.5 ? -k * 1.4 : -(1 - k) * 1.4;
        if (k > 0.48 && shake <= 0) shake = 1;
      }
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 2);
        drum.position.x = Math.sin(shake * 40) * 0.01 * shake;
      }
    },
  };
}

export function buildBuildings(scene: THREE.Scene) {
  const group = new THREE.Group();
  const halls = HALLS.map((d, i) => {
    const h = sideHall(d, i);
    group.add(h.g);
    return h;
  });
  const bell = bellTower(group);
  const drum = drumTower(group);
  scene.add(group);
  return { group, bell, drum, halls };
}
