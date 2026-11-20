// 配殿（观音殿、地藏殿）与钟楼：朱红柱、格扇门、彩画梁、带鸱吻的屋顶
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { HALLS, BELL } from '../layout';
import { plaqueTexture } from '../textures';
import { worldBox, mesh, lathe, grainUV } from './util';
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
  // 台基（小须弥座）：底下一道宽的土衬，束腰嵌浮雕板、上下一道圆线脚，台面铺石板
  const PW = L + 1.6, PD = D + 1.6;
  const low = mesh(worldBox(PW + 0.3, 0.14, PD + 0.3, 1), M.marbleSide);
  low.position.y = 0.07;
  g.add(low);
  const waist = mesh(worldBox(PW - 0.2, base - 0.3, PD - 0.2, 1), M.marbleSide);
  waist.position.y = 0.14 + (base - 0.3) / 2;
  g.add(waist);
  const top = mesh(worldBox(PW, 0.16, PD, 1), [M.marbleSide, M.marbleSide, M.slab, M.slab, M.marbleSide, M.marbleSide]);
  top.position.y = base - 0.08;
  g.add(top);
  const trim: THREE.BufferGeometry[] = [];
  const panels: THREE.BufferGeometry[] = [];
  const wy = 0.14 + (base - 0.3) / 2, wh = base - 0.3;
  for (const [len, rot, off] of [[PW - 0.2, 0, (PD - 0.2) / 2], [PW - 0.2, Math.PI, (PD - 0.2) / 2], [PD - 0.2, Math.PI / 2, (PW - 0.2) / 2], [PD - 0.2, -Math.PI / 2, (PW - 0.2) / 2]] as [number, number, number][]) {
    // 一面：圆线脚两道，蜀柱和浮雕板交替；正面中间的台阶处不放
    for (const y of [0.17, base - 0.18]) trim.push(new THREE.CylinderGeometry(0.05, 0.05, len + 0.1, 8).rotateZ(Math.PI / 2).translate(0, y, off + 0.02).rotateY(rot));
    const n = Math.max(1, Math.round(len / 1.5)), step = len / n;
    for (let k = 0; k <= n; k++) {
      const u = -len / 2 + k * step;
      const front = rot === 0;
      if (!(front && Math.abs(u) < 2.0)) trim.push(new THREE.BoxGeometry(0.12, wh, 0.05).translate(u, wy, off + 0.02).rotateY(rot));
      const mu = u + step / 2;
      if (k < n && !(front && Math.abs(mu) < 2.2)) panels.push(new THREE.BoxGeometry(step - 0.2, wh * 0.6, 0.025).translate(mu, wy, off + 0.015).rotateY(rot));
    }
  }
  g.add(mesh(mergeGeometries(trim.map((t) => t.toNonIndexed()))!, M.marble, false));
  g.add(mesh(mergeGeometries(panels.map((t) => t.toNonIndexed()))!, M.relief, false));
  // 正面台阶：两级踏步，踏步前沿一道圆棱；两侧三角形的象眼石上压斜的垂带石
  for (let k = 0; k < 2; k++) {
    const h = (base * (k + 1)) / 2, dz = 0.6 * (2 - k);
    const st = mesh(worldBox(3.2, h, dz, 1), [M.marbleSide, M.marbleSide, M.slab, M.slab, M.marble, M.marble]);
    st.position.set(0, h / 2, PD / 2 + dz / 2);
    g.add(st);
    const nose = mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 8).rotateZ(Math.PI / 2), M.marble, false);
    nose.position.set(0, h - 0.03, PD / 2 + dz - 0.01);
    g.add(nose);
  }
  {
    const run = 1.2;
    const tri = new THREE.Shape([new THREE.Vector2(PD / 2 + run, 0), new THREE.Vector2(PD / 2, 0), new THREE.Vector2(PD / 2, base)]);
    for (const sx of [-1.82, 1.82]) {
      const side = new THREE.ExtrudeGeometry(tri, { depth: 0.44, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(sx + 0.22, 0, 0);
      g.add(mesh(side, M.marbleSide));
      const cap = mesh(worldBox(0.46, 0.18, Math.hypot(run, base), 1), M.marble);
      cap.rotation.x = Math.atan2(base, run);
      cap.position.set(sx, base / 2 + 0.09, PD / 2 + run / 2);
      g.add(cap);
    }
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

// 钟楼的亭子：台基、四根红柱、彩画梁、带鸱吻的四坡顶、匾额
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
  // 吊钟梁：圆角朱漆梁，两头架在左右的额枋上，梁下两头各一块雀替
  const beamY = colTop - 0.5;
  {
    const parts: THREE.BufferGeometry[] = [new RoundedBoxGeometry(BELL.size - 0.8, 0.34, 0.3, 2, 0.03).toNonIndexed()];
    for (const dir of [-1, 1]) {
      const sh = new THREE.Shape();
      const x0 = dir * 2.55;
      sh.moveTo(x0, 0);
      sh.lineTo(x0 - dir * 0.75, 0);
      sh.bezierCurveTo(x0 - dir * 0.55, -0.02, x0 - dir * 0.4, -0.1, x0 - dir * 0.3, -0.16);
      sh.quadraticCurveTo(x0 - dir * 0.15, -0.26, x0, -0.28);
      sh.closePath();
      parts.push(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false, curveSegments: 8 }).translate(0, -0.17, -0.06));
    }
    const beam = mesh(mergeGeometries(parts)!, M.red);
    beam.position.set(0, beamY, 0);
    g.add(beam);
  }
  // 梵钟：波浪钟口、莲瓣、四区佛号铭文、莲花撞座、蒲牢钮，青铜带铜锈
  const iron = new THREE.MeshStandardMaterial({ color: '#2f2c29', metalness: 0.7, roughness: 0.55 });
  const bell = buildTempleBell();
  bell.position.set(0, colTop - 1.2, 0);
  g.add(bell);
  // 挂钟的铁件：梁上一道铁箍，箍下一只环，再一只竖环穿过蒲牢钮
  {
    const parts = [
      new THREE.BoxGeometry(0.14, 0.38, 0.33),
      new THREE.TorusGeometry(0.055, 0.02, 8, 18).translate(0, -0.2, 0),
      new THREE.TorusGeometry(0.07, 0.024, 8, 18).scale(1, 1.5, 1).rotateY(Math.PI / 2).translate(0, -0.32, 0),
    ].map((x) => x.toNonIndexed());
    const hook = mesh(mergeGeometries(parts)!, iron);
    hook.position.set(0, beamY, 0);
    g.add(hook);
  }
  // 撞木：一整根原木，撞钟的一头平、后头收圆，两头各箍一道铁；两根红麻绳吊在梁上，后头垂一根拉绳带穗子。
  // 两根吊绳一样长、一起摆，撞木摆起来始终是平的（平行四边形），撞钟时木头正面平平地撞上去
  const ROPE = 2.27; // 吊点到撞木中心线
  const rig = new THREE.Group();
  rig.position.set(-1.25, beamY, 0);
  g.add(rig);
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#9e2b22', roughness: 0.9 });
  const log = new THREE.Group();
  log.position.set(-0.9, -ROPE, 0);
  rig.add(log);
  {
    const R = 0.15;
    // 车削轴是 y，转成沿 x；y = -1 那头转到 +x，朝钟
    const body = lathe([[0, -1], [0.12, -1], [0.14, -0.99], [R, -0.97], [R, 0.9], [0.145, 0.95], [0.125, 0.985], [0.08, 1], [0, 1]], 20).rotateZ(Math.PI / 2);
    const wood = pbr('wood', { metersPerTile: 0.9, color: '#9a7a5a' });
    wood.roughness = 0.75;
    log.add(mesh(grainUV(body.toNonIndexed(), 'x'), wood));
    const bands = [-0.85, 0.82].map((x) => lathe([[R - 0.004, -0.025], [R + 0.008, -0.022], [R + 0.008, 0.022], [R - 0.004, 0.025]], 20).rotateZ(Math.PI / 2).translate(x, 0, 0).toNonIndexed());
    log.add(mesh(mergeGeometries(bands)!, iron));
    // 绑绳：吊绳在撞木上绕一圈；拉绳从后头垂下来，末端一个结、一束穗子
    const loops = [-0.7, 0.7, -0.93].map((x) => new THREE.TorusGeometry(R + 0.018, 0.018, 6, 20).rotateY(Math.PI / 2).translate(x, 0, 0).toNonIndexed());
    const pull = new THREE.CylinderGeometry(0.016, 0.016, 0.95, 6).translate(-0.93, -R - 0.475, 0).toNonIndexed();
    const knot = new THREE.SphereGeometry(0.04, 10, 8).translate(-0.93, -R - 0.97, 0).toNonIndexed();
    const tassel = new THREE.CylinderGeometry(0.02, 0.055, 0.2, 10, 1, true).translate(-0.93, -R - 1.1, 0).toNonIndexed();
    log.add(mesh(mergeGeometries([...loops, pull, knot, tassel].map((x) => (x.deleteAttribute('uv'), x)))!, ropeMat));
  }
  // 吊绳：各自绕吊点转，下端伸进撞木中心线（藏在木头里），摆到哪都连着
  const ropes = [-1.6, -0.2].map((x) => {
    const r = mesh(new THREE.CylinderGeometry(0.018, 0.018, ROPE, 6).translate(0, -ROPE / 2, 0), ropeMat);
    r.position.x = x;
    rig.add(r);
    return r;
  });
  let ang = 0;
  const pose = () => {
    for (const r of ropes) r.rotation.z = ang;
    log.position.set(-0.9 + Math.sin(ang) * ROPE, -Math.cos(ang) * ROPE, 0);
  };
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
      swing = pull > 0.05 || ang < -0.05 ? 0.55 : 1;
      pull = 0;
    },
    update(dt) {
      if (pull > 0) {
        ang += (-pull * 0.5 - ang) * Math.min(1, dt * 10);
        pose();
        return;
      }
      if (swing > 0) {
        swing = Math.max(0, swing - dt * 0.9);
        const t = 1 - swing;
        ang = t < 0.45 ? -Math.sin((t / 0.45) * Math.PI * 0.5) * 0.35 : -0.35 + Math.sin(((t - 0.45) / 0.55) * Math.PI * 0.5) * 0.47;
        if (t > 0.98 && sway <= 0) sway = 1;
      } else ang *= Math.pow(0.1, dt);
      pose();
      if (sway > 0) {
        sway = Math.max(0, sway - dt * 0.12);
        phase += dt * 3.2;
        bell.rotation.z = Math.sin(phase) * 0.025 * sway;
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
  scene.add(group);
  return { group, bell, halls };
}
