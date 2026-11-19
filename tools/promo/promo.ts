// 宣传片录制：用游戏本身的场景和角色，按分镜逐帧渲染，字幕在页面里画好，帧发回开发服务器存盘
// 打开 /tools/promo/promo.html?shots=gate,grove 只录指定镜头；不带参数录全部
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Environment, buildTerrain, type TimeMode } from '../../src/world/environment';
import { buildHall } from '../../src/world/hall';
import { buildNature } from '../../src/world/nature';
import { buildProps } from '../../src/world/props';
import { buildBuildings } from '../../src/world/buildings';
import { buildPond } from '../../src/world/pond';
import { buildLife } from '../../src/world/life';
import { IncenseSpot, type IncenseView } from '../../src/world/incense';
import { placeStatues } from '../../src/world/statues';
import { preloadTextures, setMaxAnisotropy, loadTexture } from '../../src/world/pbr';
import { Monk, BOW_DURATION } from '../../src/monk';
import { MoktakView, RosaryView } from '../../src/overlays';
import { HALL, ALTAR_BURNER, ALTAR_SPOT, INCENSE, BELL, CUSHIONS, CUSHION_ROWS, BENCH_SEATS, PAGODAS, SIDE_HALLS, LIBRARY, heightAt } from '../../src/layout';
import { furnishSideHalls } from '../../src/world/sidehall';
import { buildShrines } from '../../src/world/shrines';
import { PostFX } from '../../src/world/post';
import { buildCloudSea } from '../../src/world/clouds';
import { leafPile } from '../../src/play';
import { ROBES, BEADS } from '../../src/looks';
import { buildCafe } from '../../src/world/cafe';
import { buildGarden } from '../../src/world/garden';
import { CAFE, CAFE_SEATS, CAFE_BIN, cafeWorld, cafeLocal, planRoute, setSideHallOpen, WISH_ALLEY, PERSIMMON } from '../../src/layout';
import { shareCard } from '../../src/coffee';
import { releaseProps } from '../../src/world/glb';
// @ts-ignore 共用的分镜表
import { W, H, FPS, SHOTS, EVENTS, PROMPT_LINES, CUT, SUBS, WALK, COFFEE } from './timeline.mjs';

type Shot = { id: string; dur: number; start: number; time?: TimeMode; line?: string; feature?: [string, string] };
// 功能介绍和山寺上新：用游戏同一套后期，底部一块功能字幕
const FEATURES = CUT === 'features' || CUT === 'news' || CUT === 'walk';
type V3 = [number, number, number];

const statusEl = document.getElementById('status')!;
const status = (s: string) => (statusEl.textContent = s);
const log = (s: string) => fetch('/__promo/log', { method: 'POST', body: s }).catch(() => {});

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
// 镜头运动：首尾放缓，中间匀速
const glide = (t: number) => 0.75 * t + 0.25 * ease(t);

function camPath(keys: { p: V3; l: V3 }[]) {
  const pc = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.p)));
  const lc = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.l)));
  return (u: number, cam: THREE.PerspectiveCamera) => {
    const v = glide(clamp01(u));
    cam.position.copy(pc.getPoint(v));
    cam.lookAt(lc.getPoint(v));
  };
}

async function main() {
  // —— 字体 ——
  const fonts = [new FontFace('ZMX', 'url(/__promo/fonts/ZhiMangXing-Regular.ttf)'), new FontFace('MSZ', 'url(/__promo/fonts/MaShanZheng-Regular.ttf)')];
  for (const f of fonts) document.fonts.add(await f.load());
  // 抄经镜头用的楷字（游戏里同一份，只截了《心经》用到的字）
  document.fonts.add(await new FontFace('SansaSutra', 'url(/fonts/sutra.woff2)').load());
  await document.fonts.load('40px "Songti SC"');

  // —— 渲染器 ——
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  status('加载贴图');
  await preloadTextures((d, n) => status(`加载贴图 ${d}/${n}`));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // 环境光由 Environment 根据天空实时生成（和游戏里一样），这里不再单独从天空贴图生成
  const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 900);
  const LAND = W > H;
  const setFov = (f: number) => {
    camera.fov = LAND ? f * 0.92 : f;
  };

  const env = new Environment(scene, renderer);
  env.sun.shadow.mapSize.set(4096, 4096);
  const terrain = buildTerrain(scene);
  const hall = buildHall(scene);
  const nature = buildNature(scene, { renderer, heightAt: terrain.heightAt, size: terrain.size, lite: false });
  buildShrines(scene);
  // 东院的咖啡馆、西院的祈福灯廊和柿饼架、石板小路和草花
  releaseProps(); // 录宣传片不用等，模型马上下载
  const cafe = buildCafe(scene);
  const garden = buildGarden(scene, { lite: false });
  // 功能介绍：和游戏同一套后期（环境光遮蔽、泛光、调色）；别的版本照旧直接渲染
  const post = FEATURES ? new PostFX(renderer, scene, camera, false) : null;
  if (post) {
    post.setSize(W, H, 1);
    env.onLook = (l) => post.setLook(l);
  }
  const props = buildProps(scene);
  const buildings = buildBuildings(scene);
  const pond = buildPond(scene, { isTouch: false, lanternFrom: { x: -6.15, z: 47.65 } });
  const life = buildLife(scene);
  // 配殿与藏经阁的殿内陈设；三座殿门都开着（观音殿的镜头里再演一次开门）
  const sideHalls = furnishSideHalls(buildings.halls, roomEnv);
  for (const i of [0, 1, 2]) sideHalls.setOpen(i, true, false);
  sideHalls.setLamps(24);
  // 云海：只在登塔的镜头里显出来
  const clouds = buildCloudSea(scene);
  let showClouds = false;
  const sunDir = new THREE.Vector3();
  const sunCol = new THREE.Color();
  const altarIncense = new IncenseSpot(hall.group, ALTAR_BURNER.x, hall.altarSandY, ALTAR_BURNER.z, 0.27, 18, 0.3);
  placeStatues(hall.group, hall.statueSlots, roomEnv);
  hall.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    // 和游戏一致：背光之类标了 keepEnv 的不动，免得过曝
    if (m && (m as any).isMeshStandardMaterial && m.metalness >= 0.75 && !m.userData.keepEnv) {
      m.envMap = roomEnv;
      m.envMapIntensity = FEATURES ? 1.15 : 1.5;
    }
  });

  // 佛像是异步加载的：等三尊都进场
  status('等佛像');
  for (let k = 0; k < 150; k++) {
    let n = 0;
    hall.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (g?.attributes?.position && g.attributes.position.count > 15000) n++;
    });
    if (n >= 3) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  // 配殿的两尊菩萨也是异步加载的
  for (let k = 0; k < 150 && FEATURES; k++) {
    let n = 0;
    for (const h of buildings.halls)
      h.g.traverse((o) => {
        const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        if (g?.attributes?.position && g.attributes.position.count > 15000) n++;
      });
    if (n >= 2) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  // —— 木鱼特写用的第二块透明画布 ——
  const ovr = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  ovr.setPixelRatio(1);
  ovr.setSize(W, H, false);
  ovr.toneMapping = THREE.ACESFilmicToneMapping;
  ovr.outputColorSpace = THREE.SRGBColorSpace;
  ovr.setClearColor(0x000000, 0);
  const ovrEnv = new THREE.PMREMGenerator(ovr).fromScene(new RoomEnvironment(), 0.04).texture;
  const moktak = new MoktakView(ovrEnv);
  moktak.camera.aspect = W / H;
  moktak.camera.fov = LAND ? 28 : 40;
  moktak.camera.updateProjectionMatrix();
  const rosaryView = new RosaryView(ovrEnv);
  rosaryView.camera.aspect = W / H;
  rosaryView.camera.fov = LAND ? 27 : 38;
  rosaryView.camera.updateProjectionMatrix();

  // —— 香：院中香炉、佛前香炉 ——
  const sticks = (n: number, seed: number): IncenseView[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${seed}-${i}`, mine: false, remain: 0.25 + ((i * 37 + seed * 11) % 70) / 100 }));
  let yardList = sticks(15, 1);
  props.setIncense(yardList);
  altarIncense.set(sticks(9, 2));

  // —— 群众演员：一池小和尚 ——
  const pool: Monk[] = [];
  const cast = (n: number) => {
    while (pool.length < n) {
      const m = new Monk();
      scene.add(m.root);
      pool.push(m);
    }
    pool.forEach((m, i) => (m.root.visible = i < n));
    return pool.slice(0, n);
  };
  const place = (m: Monk, x: number, z: number, yaw: number, y = heightAt(x, z)) => {
    m.root.position.set(x, y, z);
    m.root.rotation.y = yaw;
  };
  const me = new Monk();
  scene.add(me.root);
  me.root.visible = false;
  // 功能介绍里另外几位：扫地僧（常住僧的褐色常服）、换了衣钵的五位
  const extras: Monk[] = [];
  const sweeperNpc = new Monk('resident');
  const looksRow = [0, 1, 2, 3, 5].map((ri, k) => {
    const m = new Monk();
    m.setLook(ROBES[ri], BEADS[k]);
    return m;
  });
  for (const m of [sweeperNpc, ...looksRow]) {
    scene.add(m.root);
    m.root.visible = false;
    extras.push(m);
  }
  let pile: ReturnType<typeof leafPile> | null = null;
  const CUSHION_TOP = HALL.baseH + 0.18; // 和 main.ts 一致
  const hallSeats = CUSHIONS.filter((_, i) => (i * 7) % 10 < 6);
  let heroSeat: (typeof CUSHIONS)[number] | null = null;
  function fillHall(phase: number) {
    me.root.visible = false;
    const ms = cast(hallSeats.length);
    ms.forEach((m, i) => {
      const st = hallSeats[i];
      place(m, st.x, st.z + 0.32, st.yaw, CUSHION_TOP);
      m.setAction('bow');
      m.actionTime = ((i * 0.37 + phase) % 1) * BOW_DURATION;
    });
    return ms;
  }

  // —— 合成画布：3D 画面 + 调色 + 字幕 ——
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;
  const grain = Array.from({ length: 4 }, () => noiseCanvas(W / 2, H / 2));
  const paper = paperCanvas();

  let elapsed = 0;
  function tickWorld(dt: number) {
    elapsed += dt;
    nature.update(dt, elapsed);
    life.update(dt, elapsed, env.lanternLevel, camera.position);
    sunDir.copy(env.sun.position).sub(env.sun.target.position).normalize();
    sunCol.copy(env.sun.color).multiplyScalar(env.sun.intensity);
    pond.update(dt, elapsed, env.lanternLevel, sunDir, sunCol);
    props.update(dt, elapsed);
    altarIncense.update(dt, elapsed);
    buildings.bell.update(dt);
    for (const [i, f] of hall.candleFlames.entries()) f.scale.set(1, 2.2 + Math.sin(elapsed * 9 + i * 2) * 0.25, 1);
    for (const m of pool) if (m.root.visible) m.update(dt);
    if (me.root.visible) me.update(dt);
    for (const m of extras) if (m.root.visible) m.update(dt);
    sideHalls.update(dt, elapsed);
    cafe.update(dt, elapsed);
    garden.update(dt, elapsed);
    clouds.update(dt, elapsed, showClouds, camera.position.y);
    pile?.update(dt);
  }
  function render3d() {
    env.sky.position.copy(camera.position);
    // 后期的自动降档按帧耗时判断；离线逐帧渲染时传一个很小的帧间隔，保持最高画质
    if (post) post.render(0.01);
    else renderer.render(scene, camera);
  }
  function grade(frame: number) {
    // 功能介绍已经用了游戏的后期调色，不再叠这层暖色和暗角
    if (FEATURES) return;
    // 暖色、轻微压暗四角、胶片颗粒
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(240,205,150,0.22)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply';
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.28, W / 2, H * 0.5, H * 0.72);
    vg.addColorStop(0, 'rgba(255,255,255,1)');
    vg.addColorStop(1, 'rgba(120,100,80,1)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.drawImage(grain[frame % grain.length], 0, 0, W, H);
    ctx.restore();
  }
  function header() {
    if (LAND) {
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, 150);
      g.addColorStop(0, 'rgba(12,9,6,0.5)');
      g.addColorStop(1, 'rgba(12,9,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 150);
      ctx.font = '44px ZMX';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fbf3e2';
      ctx.fillText('一句话复刻韩国爆火的山寺', 56, 62);
      ctx.restore();
      return;
    }
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, 'rgba(12,9,6,0.62)');
    g.addColorStop(1, 'rgba(12,9,6,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 360);
    ctx.font = '92px ZMX';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fbf3e2';
    ctx.fillText('一句话复刻韩国爆火的山寺', W / 2, 190);
    ctx.restore();
  }
  function verticalLine(text: string, t: number, x: number, y0: number, size: number, font: string, color: string, stagger = 0.12, startAt = 0.35) {
    ctx.save();
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    [...text].forEach((ch, i) => {
      const a = clamp01((t - startAt - i * stagger) / 0.35);
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.fillText(ch, x, y0 + i * size * 1.12 + (1 - a) * 14);
    });
    ctx.restore();
    return y0 + text.length * size * 1.12;
  }
  function caption(shot: Shot, t: number) {
    // 竖版里木鱼紧接在撞钟后面，延续「但余钟磬音」；讲解视频各镜头有自己的名目
    const carry = shot.id === 'moktak' && CUT !== 'explainer';
    const line = carry ? '但余钟磬音' : shot.line;
    if (!line) return;
    const instant = carry;
    const size = LAND ? 64 : H < 1600 ? 88 : 98;
    const x = W - (LAND ? 104 : 132), y0 = LAND ? 170 : H < 1600 ? 420 : 520;
    const end = verticalLine(line, instant ? 9 : t, x, y0, size, 'MSZ', '#fbf5e6');
    const sealA = instant ? 1 : clamp01((t - 0.35 - line.length * 0.12 - 0.1) / 0.3);
    if (sealA > 0) seal(ctx, x, end + size * 0.3, size * 0.6, '禅', sealA, 1);
    if (shot.id === 'gate' && CUT !== 'explainer') verticalLine('唐·常建', t, x - 120, y0 + 40, 36, '"Songti SC"', 'rgba(251,245,230,0.85)', 0.06, 1.3);
  }
  // 讲解视频的口播字幕：底部居中，白字黑边
  function subtitles(gt: number) {
    const cur = (SUBS as { text: string; t0: number; t1: number }[]).find((x) => gt >= x.t0 - 0.05 && gt < x.t1 + 0.12);
    if (!cur) return;
    ctx.save();
    ctx.font = '50px "PingFang SC","Songti SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(15,10,6,0.85)';
    ctx.strokeText(cur.text, W / 2, H - 84);
    ctx.fillStyle = '#fbf6ea';
    ctx.fillText(cur.text, W / 2, H - 84);
    ctx.restore();
  }

  // 功能介绍：底部一块字幕，大字功能名、小字一句玩法；镜头开头慢慢浮上来
  function featureCaption(shot: Shot, t: number) {
    const f = shot.feature;
    if (!f) return;
    const a = ease(clamp01((t - 0.3) / 0.7));
    if (a <= 0) return;
    ctx.save();
    const g = ctx.createLinearGradient(0, H - 520, 0, H);
    g.addColorStop(0, 'rgba(12,9,6,0)');
    g.addColorStop(0.45, 'rgba(12,9,6,0.55)');
    g.addColorStop(1, 'rgba(12,9,6,0.78)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 520, W, 520);
    ctx.translate(0, (1 - a) * 24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#fbf3e2';
    ctx.font = '96px MSZ';
    ctx.fillText(f[0], W / 2, H - 300);
    // 功能名下面一道短金线
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(226,180,92,0.9)';
    ctx.fillRect(W / 2 - 60, H - 228, 120, 4);
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(251,245,230,0.92)';
    ctx.font = '44px "Songti SC"';
    ctx.fillText(f[1], W / 2, H - 165);
    ctx.restore();
  }
  // 功能介绍里，撞钟、木鱼两个镜头叠上游戏里的蓄力条、节拍圈，看得出是怎么玩的
  function featureOverlay(shot: Shot, t: number) {
    if (shot.id === 'bell') {
      // 按住蓄力：力度来回摆，落在金色区间时松手
      const tStrike = EVENTS.bellStrike as number;
      const holdT = Math.min(t, tStrike) - 0.4;
      const power = holdT <= 0 ? 0 : t < tStrike ? (1 - Math.cos(holdT * 2.6)) / 2 : Math.max(0, 0.86 - (t - tStrike) * 2);
      const mw = 640, mh = 26, mx = (W - mw) / 2, my = H * 0.64;
      ctx.save();
      ctx.globalAlpha = clamp01(t / 0.4) * clamp01((tStrike + 1.6 - t) / 0.4);
      roundRect(ctx, mx - 8, my - 8, mw + 16, mh + 16, 21);
      ctx.fillStyle = 'rgba(20,15,10,0.72)';
      ctx.fill();
      ctx.fillStyle = 'rgba(226,180,92,0.35)';
      ctx.fillRect(mx + mw * 0.78, my, mw * 0.15, mh);
      ctx.fillStyle = power >= 0.78 && power <= 0.93 ? '#f3d38a' : '#fbf3e2';
      roundRect(ctx, mx, my, mw * power, mh, 13);
      ctx.fill();
      ctx.font = '40px "Songti SC"';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbf3e2';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 10;
      ctx.fillText(t < tStrike ? '按住，把撞木往后拉' : '', W / 2, my - 44);
      ctx.restore();
      const ha = clamp01((t - (EVENTS.bellHit as number)) / 0.3) * clamp01((EVENTS.bellHit + 3.4 - t) / 0.6);
      if (ha > 0) {
        ctx.save();
        ctx.globalAlpha = ha;
        ctx.textAlign = 'center';
        ctx.font = '76px MSZ';
        ctx.fillStyle = '#f3d38a';
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 18;
        ctx.fillText('洪钟！钟声传出十八里', W / 2, H * 0.56 - (t - EVENTS.bellHit) * 18);
        ctx.restore();
      }
    }
    if (shot.id === 'moktak') {
      // 节拍圈从外往里收，收到木鱼上那一刻敲下去是「妙」
      const beats = EVENTS.moktak as number[];
      const next = beats.find((b) => b + 0.07 >= t);
      const cx = W / 2, cy = H * 0.47;
      if (next !== undefined) {
        const ph = clamp01(1 - (next + 0.07 - t) / 0.42);
        ctx.save();
        ctx.strokeStyle = `rgba(251,243,226,${0.2 + 0.7 * ph * ph})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 250 * (1 + 1.4 * (1 - ph)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const hits = beats.filter((b) => b + 0.07 <= t);
      const last = hits[hits.length - 1];
      if (last !== undefined) {
        const k = t - last - 0.07;
        const a = clamp01(1 - k / 0.5);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 14;
        ctx.globalAlpha = a;
        ctx.font = '84px MSZ';
        ctx.fillStyle = '#f3d38a';
        ctx.fillText('妙', cx + ((hits.length % 3) - 1) * 70, cy - 300 - k * 120);
        ctx.globalAlpha = 1;
        ctx.font = '46px "Songti SC"';
        ctx.fillStyle = '#fbf3e2';
        ctx.fillText(`连击 ${hits.length}`, cx, H * 0.69);
        ctx.restore();
      }
    }
  }

  // 竖版的片头片尾按 1080×1920 设计，其他竖屏画幅等比缩放到中间
  function portrait() {
    const k = Math.min(W / 1080, H / 1920);
    ctx.setTransform(k, 0, 0, k, (W - 1080 * k) / 2, (H - 1920 * k) / 2);
  }
  // 线上实拍截图：慢慢推近到要讲的地方
  const uiImg: Record<string, HTMLImageElement> = {};
  for (const id of ['uiRooms', 'uiBow', 'uiPractice', 'uiReader', 'uiCafeMenu', 'uiWishWrite']) {
    const need = SHOTS.some((x: Shot) => x.id === id || (x.id === 'nMenu' && id === 'uiCafeMenu') || (x.id === 'nWish' && id === 'uiWishWrite') || (x.id === 'coffee' && id === 'uiCafeMenu'));
    if (!need) continue;
    const im = new Image();
    im.src = `/__promo/ui/${id}.jpg`;
    await im.decode();
    uiImg[id] = im;
  }
  const UI_FOCUS: Record<string, { cx: number; cy: number; z0: number; z1: number }> = {
    uiRooms: { cx: 0.2, cy: 0.2, z0: 1.15, z1: 1.9 },
    uiBow: { cx: 0.36, cy: 0.62, z0: 1.0, z1: 1.3 },
    uiPractice: { cx: 0.6, cy: 0.4, z0: 1.02, z1: 1.14 },
    uiReader: { cx: 0.5, cy: 0.34, z0: 1.02, z1: 1.14 },
    uiCafeMenu: { cx: 0.5, cy: 0.5, z0: 1.0, z1: 1.12 },
    uiWishWrite: { cx: 0.5, cy: 0.5, z0: 1.0, z1: 1.12 },
  };
  function uiCard(id: string, u: number) {
    const im = uiImg[id], f = UI_FOCUS[id];
    const z = f.z0 + (f.z1 - f.z0) * ease(u);
    const sw = im.width / z, sh = im.height / z;
    const sx = Math.min(im.width - sw, Math.max(0, f.cx * im.width - sw / 2));
    const sy = Math.min(im.height - sh, Math.max(0, f.cy * im.height - sh / 2));
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
  }

  // —— 山寺上新用到的：咖啡馆的人、灯廊的心愿、画面上的小字 ——
  // 吧台后两位咖啡师父，跑堂小沙弥；露台上坐着四位喝咖啡的客人（手里的杯子各不一样）
  const baristas = [new Monk('resident'), new Monk('resident')];
  const waiter = new Monk('novice');
  for (const m of [...baristas, waiter]) {
    scene.add(m.root);
    m.root.visible = false;
    extras.push(m);
  }
  let sipAt: [number, Monk][] = [];
  let offered = false, gave = false, hangDone = false;
  function cafeCrowd() {
    const bz = CAFE.bar - 0.6 - 0.55;
    [[-2.1, bz], [0.4, bz]].forEach(([lx, lz], i) => {
      const m = baristas[i], p = cafeWorld(lx, lz);
      m.root.visible = true;
      place(m, p.x, p.z, CAFE.yaw);
      m.setAction('brew');
      m.actionTime = i * 1.7;
    });
    const seats = [0, 3, 4, 7].map((i) => CAFE_SEATS[i]);
    const cups: [string, number][] = [['latte', 2], ['coldbrew', 3], ['osmanthus', 2], ['americano', 1]];
    const ms = cast(seats.length);
    ms.forEach((m, i) => {
      const s = seats[i];
      place(m, s.x, s.z, s.yaw);
      m.seatKind = 'bench';
      m.setAction('bench');
      m.setCup(cups[i][0] as never, cups[i][1]);
    });
    offered = gave = false;
    return ms;
  }
  // 灯廊：一百五十盏里七成挂着访客的心愿签
  const demoLanterns = garden.hooks.map((_, i) => ({ hook: i, color: (i * 5) % 6, tag: ((i * 7) % 10 < 7 ? 1 : 0) as 0 | 1 | 2 }));
  garden.setLanterns(demoLanterns);
  const HANG_HOOK = 27;

  function draw3d(frame: number) {
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    render3d();
    ctx.drawImage(renderer.domElement, 0, 0);
    grade(frame);
  }
  const sv = new THREE.Vector3();
  function worldToScreen(x: number, y: number, z: number) {
    sv.set(x, y, z).project(camera);
    return { x: (sv.x * 0.5 + 0.5) * W, y: (-sv.y * 0.5 + 0.5) * H };
  }
  // 一行带底色的小字（「做好了」之类）
  function pill(text: string, x: number, y: number, a: number, color = '#fbf3e2') {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '50px "Songti SC"';
    const w = ctx.measureText(text).width + 70;
    roundRect(ctx, x - w / 2, y - 44, w, 88, 44);
    ctx.fillStyle = 'rgba(20,15,10,0.62)';
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 2);
    ctx.restore();
  }
  // 僧人头上的说话气泡
  function bubble(text: string, p: { x: number; y: number }, a: number) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '46px "Songti SC"';
    const w = ctx.measureText(text).width + 60, h = 84, x = p.x - w / 2, y = p.y - h - 30 - (1 - a) * 16;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fillStyle = 'rgba(251,246,234,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(p.x - 16, y + h - 1);
    ctx.lineTo(p.x, y + h + 20);
    ctx.lineTo(p.x + 16, y + h - 1);
    ctx.fill();
    ctx.fillStyle = '#2a2320';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x, y + h / 2 + 2);
    ctx.restore();
  }
  // 往上飘的金字（功德、柿柿如意）
  function floatWord(text: string, x: number, y: number, a: number, size: number, font = 'MSZ', color = '#f3d38a') {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  // 灯下的心愿签：一条竖着的米色纸签，楷字，底下署名
  function wishTag(text: string, by: string, x: number, y: number, a: number) {
    ctx.save();
    ctx.globalAlpha = a;
    const chars = [...text], cw = 96, ch = chars.length * 62 + 150;
    ctx.translate(x, y + (1 - a) * 20);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 20;
    roundRect(ctx, -cw / 2, 0, cw, ch, 6);
    ctx.fillStyle = '#f8f1e2';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(176,58,40,0.55)';
    ctx.lineWidth = 2;
    roundRect(ctx, -cw / 2 + 7, 7, cw - 14, ch - 14, 4);
    ctx.stroke();
    ctx.fillStyle = '#1d1612';
    ctx.font = '54px "Kaiti SC", "STKaiti", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((c, i) => ctx.fillText(c, 0, 50 + i * 62));
    ctx.fillStyle = '#8a6e58';
    ctx.font = '24px "Songti SC"';
    ctx.fillText(by, 0, ch - 52);
    ctx.fillStyle = '#b3261e';
    ctx.fillRect(-12, ch - 30, 24, 16);
    ctx.restore();
  }
  // 键盘抄经的经纸：右起一列经题，十三字一列；每一拍上屏一组字，一个接一个落墨；上屏前半拍在当前格旁边显出拼音
  const SUTRA_TEXT = '觀自在菩薩行深般若波羅蜜多時照見五蘊皆空度一切苦厄舍利子色不異空空不異色色即是空空即是色受想行識亦復如是舍利子是諸法空相不生不滅不垢不淨不增不減是故空中無色無受想行識無眼耳鼻舌身意無色聲香味觸法';
  const GROUPS: [string, string][] = [
    ['觀自在', 'guanzizai'], ['菩薩', 'pusa'], ['行深', 'xingshen'], ['般若', 'bore'], ['波羅蜜多', 'boluomiduo'],
    ['時', 'shi'], ['照見', 'zhaojian'], ['五蘊', 'wuyun'], ['皆空', 'jiekong'], ['度一切苦厄', "duyiqieku'e"],
    ['舍利子', 'shelizi'], ['色不異空', 'sebuyikong'], ['空不異色', 'kongbuyise'], ['色即是空', 'sejishikong'],
  ];
  const sheetCols = 8, sheetRows = 13, cell = 90;
  const sheet = (() => {
    const c = document.createElement('canvas');
    c.width = (sheetCols + 1) * cell + 60;
    c.height = sheetRows * cell + 60;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f5eddb';
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = Math.random() < 0.55 ? 'rgba(255,255,255,0.25)' : 'rgba(120,92,52,0.07)';
      g.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 8, 1);
    }
    g.strokeStyle = 'rgba(176,58,40,0.75)';
    g.lineWidth = 3;
    g.strokeRect(30, 30, c.width - 60, c.height - 60);
    g.strokeStyle = 'rgba(176,58,40,0.4)';
    g.lineWidth = 1.5;
    for (let k = 1; k <= sheetCols; k++) {
      g.beginPath();
      g.moveTo(30 + k * cell, 30);
      g.lineTo(30 + k * cell, c.height - 30);
      g.stroke();
    }
    return c;
  })();
  function handOf(i: number) {
    const r = (k: number) => {
      const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return { rot: (r(1) - 0.5) * 0.09, sc: 0.93 + r(2) * 0.1, op: 0.84 + r(5) * 0.16 };
  }
  function drawSutraSheet(t: number, inkTimes?: number[]) {
    const sw = sheet.width, sh = sheet.height, sx = (W - sw) / 2, sy = 190;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 40;
    ctx.drawImage(sheet, sx, sy);
    ctx.restore();
    const colX = (k: number) => sx + 30 + (sheetCols - k + 0.5) * cell; // 第 k 列（右起，0 是经题）
    const rowY = (r: number) => sy + 30 + (r + 0.5) * cell;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${cell * 0.8}px SansaSutra`;
    ctx.fillStyle = '#1d1612';
    [...'般若波羅蜜多心經'].forEach((c, r) => ctx.fillText(c, colX(0), rowY(r) + 4));
    // 每一组上屏的时刻和这一组从第几个字开始
    const ink = inkTimes ?? (EVENTS.nInk as number[]);
    let start = 0;
    const startOf: number[] = [];
    for (const [s] of GROUPS) {
      startOf.push(start);
      start += [...s].length;
    }
    const written = (i: number) => {
      const gi = startOf.findIndex((s0, k) => i >= s0 && i < s0 + [...GROUPS[k][0]].length);
      if (gi < 0 || gi >= ink.length) return -1;
      return ink[gi] + (i - startOf[gi]) * 0.09;
    };
    const chars = [...SUTRA_TEXT].slice(0, sheetCols * sheetRows);
    let cur = 0;
    chars.forEach((c, i) => {
      const x = colX(1 + Math.floor(i / sheetRows)), y = rowY(i % sheetRows) + 4;
      const tw = written(i);
      if (tw >= 0 && t >= tw) {
        cur = i + 1;
        const k = clamp01((t - tw) / 0.35), h = handOf(i);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(h.rot);
        const s = h.sc * (1 + 0.22 * (1 - k));
        ctx.scale(s, s);
        ctx.globalAlpha = h.op * k;
        if (k < 1) ctx.filter = `blur(${((1 - k) * 4).toFixed(1)}px)`;
        ctx.shadowColor = 'rgba(26,18,12,0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText(c, 0, 0);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(110,92,72,0.26)';
        ctx.fillText(c, x, y);
        ctx.fillStyle = '#1d1612';
      }
    });
    // 当前格：淡淡的朱红框；旁边是正在拼的拼音（上屏前半拍出现）
    const cx = colX(1 + Math.floor(cur / sheetRows)), cy = rowY(cur % sheetRows);
    ctx.strokeStyle = 'rgba(179,38,30,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - cell / 2 + 4, cy - cell / 2 + 4, cell - 8, cell - 8);
    const next = ink.findIndex((b) => b > t);
    if (next >= 0 && next < GROUPS.length && ink[next] - t < 0.45) {
      const py = GROUPS[next][1];
      const typed = py.slice(0, Math.ceil(py.length * clamp01(1 - (ink[next] - t) / 0.45)));
      ctx.font = '40px "SF Mono", Menlo, monospace';
      const bw = ctx.measureText(typed).width + 40;
      roundRect(ctx, cx - cell / 2 - bw - 14, cy - 30, bw, 60, 12);
      ctx.fillStyle = 'rgba(40,30,22,0.88)';
      ctx.fill();
      ctx.fillStyle = '#fff3e0';
      ctx.textAlign = 'left';
      ctx.fillText(typed, cx - cell / 2 - bw + 6, cy + 2);
    }
    // 每组落墨后飘一个「功德 +1」
    ink.forEach((b, k) => {
      const d = t - b;
      if (d < 0 || d > 1.0 || k >= GROUPS.length) return;
      const i0 = startOf[k];
      floatWord(`功德 +${[...GROUPS[k][0]].length}`, colX(1 + Math.floor(i0 / sheetRows)) - 120, rowY(i0 % sheetRows) - d * 50, clamp01(1 - d), 34, '"Songti SC"');
    });
    ctx.restore();
  }

  // —— 一镜到底：小和尚从山门连贯走一圈，镜头一直跟着；停下来做事时镜头绕到合适的位置，转场时升过殿顶 ——
  const librarian = new Monk('resident');
  librarian.seatKind = 'floor';
  scene.add(librarian.root);
  librarian.root.visible = false;
  extras.push(librarian);
  const heroCushion = CUSHIONS.find((c) => Math.abs(c.x + 1.7) < 0.01 && Math.abs(c.z + 6.0) < 0.01) ?? CUSHIONS[0];
  const deskSeat = sideHalls.deskSeat(1);
  type Move = { t: [number, number]; c: THREE.CatmullRomCurve3; len: number };
  let moves: Move[] = [];
  const curveOf = (pts: [number, number][], direct = false) => {
    const route: THREE.Vector3[] = [new THREE.Vector3(pts[0][0], 0, pts[0][1])];
    for (let i = 1; i < pts.length; i++) {
      const a = route[route.length - 1], b = pts[i];
      const seg = direct ? [{ x: b[0], z: b[1] }] : planRoute(a.x, a.z, b[0], b[1]);
      for (const q of seg) route.push(new THREE.Vector3(q.x, 0, q.z));
    }
    const clean = route.filter((p, i) => i === 0 || i === route.length - 1 || p.distanceTo(route[i - 1]) > 0.6);
    if (clean.length < 2) clean.push(clean[0].clone().add(new THREE.Vector3(0, 0, 0.01)));
    return new THREE.CatmullRomCurve3(clean, false, 'centripetal', 0.5);
  };
  // 走路的快慢：起步、停下各用一成的时间缓一缓
  const plateau = (u: number, a = 0.12) => (u < a ? (u * u) / (2 * a * (1 - a)) : u > 1 - a ? 1 - ((1 - u) * (1 - u)) / (2 * a * (1 - a)) : (u - a / 2) / (1 - a));
  const camP = new THREE.Vector3(), camL = new THREE.Vector3(), wantP = new THREE.Vector3(), wantL = new THREE.Vector3();
  let walkYaw = Math.PI, lastWalkT = -1, struckW = false, hungW = false, satW = '', crane: THREE.CatmullRomCurve3[] | null = null, aerial: THREE.CatmullRomCurve3[] | null = null;
  let cafeOn = false, cutAt = -1, lastSip = -1;
  // 叠化用：上一帧、切换那一刻冻结的画面
  const lastFrame = document.createElement('canvas'), cutFrame = document.createElement('canvas');
  lastFrame.width = cutFrame.width = W;
  lastFrame.height = cutFrame.height = H;
  const lastCtx = lastFrame.getContext('2d')!, cutCtx = cutFrame.getContext('2d')!;
  const cafeHeroSeat = CAFE_SEATS[2];
  const PERSIMMON_FROM: [number, number] = [-24.6, 44.6];
  const W_ = WALK as {
    gate: number[]; toBell: number[]; bellStrike: number; bellHit: number; toIncense: number[]; incenseStart: number; incensePlant: number;
    toHall: number[]; bowStart: number; bowTouches: number[]; bowEnd: number; walkOut: number[]; craneLib: number[]; libTeleport: number; libWalk: number[];
    sit: number; sheet: number[]; inks: number[]; sitEnd: number; aerial: number[]; alleyTeleport: number; alleyWalk: number[]; hangStart: number; hangRelease: number;
    nightWalk: number[]; end: number; fadeOut: number[]; hours: number[][]; caps: [number, number, string, string][];
    cuts: number[]; incenseFrom: [number, number]; cafeIn: number[]; brew: number[]; cupReady: number; toSeat: number[]; sipAt: number[];
    persimmonTeleport: number; toPersimmon: number[]; persimmonBow: number; persimmonWord: number;
  };
  const BELL_AT: [number, number] = [BELL.x - 2.6, BELL.z + 1.0];
  const LIB_DOOR_X = LIBRARY.x + 2.275;
  const INC_AT: [number, number] = [0, INCENSE.z + 1.9];
  const ALLEY_IN: [number, number] = [-23.0, 46.6];

  // —— 小红书咖啡版（coffee）：只拍咖啡，不拍宗教 ——
  const C_ = COFFEE as {
    cuts: number[]; approach: number[]; menu: number[]; brew: number[]; cupReady: number; toFriend: number[]; offer: number; give: number;
    sit: number[]; sips: number[]; friendSips: number[]; toBin: number[]; binOffer: number; binDrop: number; card: number[]; aerial: number[];
    night: number[]; nightSip: number; end: number; fadeOut: number[]; hours: number[][]; caps: [number, number, string, string][];
  };
  // 两人坐露台最外侧那张伞桌（k6、k7），从露台外侧看过去，背景是厅里的吧台和灯
  const cofHeroSeat = CAFE_SEATS[6];
  const friendSeat = CAFE_SEATS[7];
  const FRIEND_SIDE: [number, number] = [friendSeat.approachX, friendSeat.approachZ]; // 递杯时站在朋友身边（露台外沿一侧）
  const BIN_AT: [number, number] = [CAFE_BIN.x + 0.8, CAFE_BIN.z]; // 回收桶东边，面朝西把空杯放进去
  let friend: Monk | null = null;
  const cofFill = new THREE.PointLight('#ffcf96', 0, 7, 1.5);
  cofFill.position.set(29.6, 2.1, 51.4);
  scene.add(cofFill);
  let cofMoves: Move[] = [];
  let cofCurve: THREE.CatmullRomCurve3[] | null = null, cofNight: THREE.CatmullRomCurve3[] | null = null;
  let cofSat = '', cofOffered = false, cofDropOffered = false, cofSeg = -1;
  // 分享卡：用游戏里同一个函数画，最底下不写网址
  let cardImg: HTMLImageElement | null = null;
  if (CUT === 'coffee') {
    document.fonts.add(await new FontFace('SansaSeal', 'url(/fonts/seal.woff2)').load());
    document.fonts.add(await new FontFace('SansaSealBold', 'url(/fonts/seal-bold.woff2)', { weight: '900' }).load());
    cardImg = new Image();
    cardImg.src = await shareCard('latte', '静静的云', undefined, '', '');
    await cardImg.decode();
  }
  function hourAt(t: number, H: number[][] = W_.hours) {
    for (let i = 0; i < H.length - 1; i++) if (t <= H[i + 1][0]) return H[i][1] + ((H[i + 1][1] - H[i][1]) * (t - H[i][0])) / (H[i + 1][0] - H[i][0]);
    return H[H.length - 1][1];
  }
  function followCam(dist = 5.2, height = 2.1, side = 0.55, ahead = 1.8, lookY = 1.15) {
    const fx = Math.sin(walkYaw), fz = Math.cos(walkYaw);
    const p = me.root.position;
    wantP.set(p.x - fx * dist + fz * side, p.y + height, p.z - fz * dist - fx * side);
    wantL.set(p.x + fx * ahead, p.y + lookY, p.z + fz * ahead);
  }
  // 时间段内沿一串关键位置走（位置、看点各一条曲线）
  const keyCurves = (keys: [V3, V3][]) => [new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k[0]))), new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k[1])))];
  function walkCaption(t: number, caps: [number, number, string, string][] = W_.caps) {
    for (const [t0, t1, title, sub] of caps) {
      const a = ease(clamp01((t - t0) / 0.6)) * clamp01((t1 - t) / 0.6);
      if (a <= 0) continue;
      ctx.save();
      const g = ctx.createLinearGradient(0, H - 520, 0, H);
      g.addColorStop(0, 'rgba(12,9,6,0)');
      g.addColorStop(0.45, 'rgba(12,9,6,0.5)');
      g.addColorStop(1, 'rgba(12,9,6,0.74)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.fillRect(0, H - 520, W, 520);
      ctx.translate(0, (1 - a) * 24);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#fbf3e2';
      ctx.font = '96px MSZ';
      ctx.fillText(title, W / 2, H - 300);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(226,180,92,0.9)';
      ctx.fillRect(W / 2 - 60, H - 228, 120, 4);
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(251,245,230,0.92)';
      ctx.font = '44px "Songti SC"';
      ctx.fillText(sub, W / 2, H - 165);
      ctx.restore();
    }
  }

  // —— 各个镜头 ——
  const shots: Record<string, { setup(): void; update(t: number, u: number): void; draw?(t: number, frame: number): void }> = {
    title: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        ctx.save();
        portrait();
        // 对话气泡：只说了一句话
        const ba = ease(clamp01((t - 0.05) / 0.35));
        ctx.save();
        ctx.globalAlpha = ba;
        ctx.translate(0, (1 - ba) * 30);
        ctx.font = '40px "Songti SC"';
        ctx.fillStyle = '#7a6c5a';
        ctx.fillText('只说了一句话：', 130, 452);
        roundRect(ctx, 110, 480, 860, 160, 36);
        ctx.fillStyle = 'rgba(255,252,245,0.94)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(60,40,25,0.28)';
        ctx.stroke();
        const all = PROMPT_LINES.join('');
        const shown = Math.floor(clamp01((t - EVENTS.titleType.from) / (EVENTS.titleType.perChar * all.length)) * all.length);
        const typed = all.slice(0, shown);
        ctx.font = '60px "Songti SC"';
        ctx.fillStyle = '#2b2420';
        ctx.fillText(typed, 165, 582);
        if (shown < all.length || Math.floor(t * 2.5) % 2 === 0) {
          const w = ctx.measureText(typed).width;
          ctx.fillRect(171 + w, 536, 4, 62);
        }
        ctx.restore();
        // 标题：一笔一笔写出来
        inkTitle(ctx, '一句话复刻', 540, 1010, 176, t - EVENTS.titleReveal);
        inkTitle(ctx, '韩国爆火的山寺', 540, 1215, 160, t - EVENTS.titleReveal - 0.35);
        const sa = clamp01((t - EVENTS.titleSeal) / 0.18);
        if (sa > 0) seal(ctx, 905, 1395, 118, '山寺', sa, 1.25 - 0.25 * ease(sa));
        const subA = clamp01((t - 3.25) / 0.5);
        ctx.save();
        ctx.globalAlpha = subA;
        ctx.font = '42px "Songti SC"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('一座汉传古寺 · 在线礼佛、上香、撞钟', 540, 1515);
        ctx.restore();
        ctx.restore(); // 收回 portrait() 的缩放
      },
    },
    gate: {
      setup() {
        const ms = cast(2);
        place(ms[0], -0.7, 59, Math.PI);
        place(ms[1], 0.8, 56.5, Math.PI);
        ms.forEach((m) => {
          m.setAction('walk');
          m.speed = 1.3;
        });
        env.follow(0, 60);
      },
      update(t, u) {
        setFov(60);
        camPath([
          { p: [0, 2.3, 72.6], l: [0, 3.4, 60] },
          { p: [0, 2.5, 66.5], l: [0, 2.9, 50] },
          { p: [0, 4.2, 60.5], l: [0, 2.3, 32] },
        ])(u, camera);
        pool.slice(0, 2).forEach((m, i) => {
          const z = (i ? 56.5 : 59) - t * 1.3;
          place(m, i ? 0.8 : -0.7, z, Math.PI);
        });
      },
    },
    grove: {
      setup() {
        cast(0);
        env.follow(16, 40);
      },
      update(_t, u) {
        setFov(62);
        camPath([
          { p: [14.6, 1.0, 36.2], l: [18.5, 6.0, 42.5] },
          { p: [13.4, 1.5, 38.6], l: [17.4, 8.8, 41.5] },
        ])(u, camera);
      },
    },
    bridge: {
      setup() {
        const ms = cast(2);
        ms.forEach((m) => {
          m.setAction('walk');
          m.speed = 1.6;
        });
        env.follow(0, 52);
      },
      update(t, u) {
        // 从桥头迎着走来的两位僧人，背后是放生池和山门
        setFov(50);
        const z0 = 57.6 - t * 1.6;
        place(pool[0], -0.25, z0, Math.PI);
        place(pool[1], 0.4, z0 + 2.2, Math.PI);
        camPath([
          { p: [3.6, 2.3, 44.6], l: [0, heightAt(0, 56) + 0.9, 56] },
          { p: [4.6, 2.9, 43.4], l: [0, heightAt(0, 51.5) + 0.9, 51.5] },
        ])(u, camera);
      },
    },
    court: {
      setup() {
        const ms = cast(6);
        place(ms[0], -1.2, 22, Math.PI);
        place(ms[1], 1.1, 24.5, Math.PI);
        place(ms[2], 0, 27, Math.PI);
        [ms[0], ms[1], ms[2]].forEach((m) => {
          m.setAction('walk');
          m.speed = 1.2;
        });
        place(ms[3], -2.3, 9.3, Math.PI);
        place(ms[4], 2.3, 9.3, Math.PI);
        place(ms[5], -9.2, 17.6, Math.PI * 0.85);
        [ms[3], ms[4]].forEach((m, i) => {
          m.setAction('hapjang');
          m.actionTime = i * 0.8;
        });
        ms[5].setAction('idle');
        env.follow(0, 6);
      },
      update(t, u) {
        setFov(60);
        camPath([
          { p: [4.6, 1.3, 17.5], l: [0, 2.4, 6] },
          { p: [6.2, 5.0, 22.5], l: [0, 4.0, -2] },
          { p: [7.8, 10.5, 28], l: [0, 5.6, -9] },
        ])(u, camera);
        place(pool[0], -1.2, 22 - t * 1.2, Math.PI);
        place(pool[1], 1.1, 24.5 - t * 1.2, Math.PI);
        place(pool[2], 0, 27 - t * 1.2, Math.PI);
      },
    },
    incense: {
      setup() {
        cast(0);
        me.root.visible = true;
        place(me, 0, INCENSE.z + 1.9, Math.PI);
        me.setAction('incense');
        me.actionTime = 0.5;
        me.onIncensePlant = () => {
          yardList = [...yardList, { id: 'mine', mine: true, remain: 1 }];
          props.setIncense(yardList);
        };
        env.follow(0, 7);
      },
      update(_t, u) {
        setFov(42);
        camPath([
          { p: [2.9, 2.35, 4.4], l: [0, 1.45, 7.9] },
          { p: [2.3, 2.15, 4.9], l: [0, 1.5, 8.1] },
        ])(u, camera);
      },
    },
    // —— 殿内：进殿 → 满殿礼拜 → 佛像 → 一佛二弟子 → 佛前供养 → 五体投地 ——
    hallEnter: {
      setup() {
        fillHall(0);
        env.follow(0, -12);
      },
      update(_t, u) {
        setFov(60);
        camPath([
          { p: [0, 2.85, 0.1], l: [0, 3.5, -20] },
          { p: [0, 2.65, -3.2], l: [0, 3.5, -20] },
          { p: [0, 2.4, -6.2], l: [0, 3.6, -20] },
        ])(u, camera);
      },
    },
    rows: {
      setup() {
        fillHall(0.3);
        env.follow(0, -12);
      },
      update(_t, u) {
        setFov(62);
        camPath([
          { p: [-11.2, 5.7, -4.8], l: [-1.0, 1.6, -13.5] },
          { p: [-8.6, 5.1, -6.4], l: [0.5, 1.8, -14.5] },
        ])(u, camera);
      },
    },
    buddha: {
      setup() {
        fillHall(0.55);
        env.follow(0, -16);
      },
      update(_t, u) {
        setFov(46);
        camPath([
          { p: [0, 2.7, -11.8], l: [0, 4.2, -20.6] },
          { p: [0, 3.3, -15.0], l: [0, 5.0, -20.6] },
        ])(u, camera);
      },
    },
    triad: {
      setup() {
        fillHall(0.7);
        env.follow(0, -18);
      },
      update(_t, u) {
        // 从左到右平移，迦叶、主尊、阿难依次经过
        setFov(44);
        const x = -3.4 + 6.8 * glide(u);
        camera.position.set(x, 3.15, -16.0);
        camera.lookAt(x * 1.05, 3.9, -20.5);
      },
    },
    altar: {
      setup() {
        fillHall(0.15);
        me.root.visible = true;
        place(me, ALTAR_SPOT.x, ALTAR_SPOT.z, Math.PI);
        me.setAction('incense');
        me.actionTime = 0.4;
        me.onIncensePlant = () => altarIncense.set([...sticks(9, 2), { id: 'mine', mine: true, remain: 1 }]);
        altarIncense.set(sticks(9, 2));
        env.follow(0, -17);
      },
      update(_t, u) {
        setFov(50);
        camPath([
          { p: [3.7, 2.7, -15.6], l: [-0.35, 2.0, -17.3] },
          { p: [3.3, 2.6, -15.95], l: [-0.35, 2.0, -17.35] },
        ])(u, camera);
      },
    },
    bowClose: {
      setup() {
        const ms = fillHall(0.45);
        // 主角：第一排靠走道的那位；镜头在他前方斜侧，背后是一排排礼拜的人
        const i = hallSeats.findIndex((st) => st.z === CUSHION_ROWS[0] && st.x > 0 && st.x < 3.5);
        const hero = ms[i >= 0 ? i : 0];
        hero.actionTime = 0.9;
        heroSeat = hallSeats[i >= 0 ? i : 0];
        env.follow(heroSeat.x, heroSeat.z);
      },
      update(_t, u) {
        setFov(50);
        const s = heroSeat!;
        camPath([
          { p: [s.x - 1.9, s.y + 1.3, s.z - 2.9], l: [s.x + 0.15, s.y + 0.55, s.z + 0.3] },
          { p: [s.x - 1.6, s.y + 1.1, s.z - 2.6], l: [s.x + 0.15, s.y + 0.5, s.z + 0.3] },
        ])(u, camera);
      },
    },
    // —— 讲解视频：横屏片头、那一句话、实拍截图、片尾 ——
    eTitle: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        inkTitle(ctx, '一句话复刻韩国爆火的山寺', W / 2, H * 0.42, 124, t - 0.5, 1.1);
        const sa = clamp01((t - 1.8) / 0.18);
        if (sa > 0) seal(ctx, W / 2 + 790, H * 0.42 - 20, 96, '山寺', sa, 1.25 - 0.25 * ease(sa));
        ctx.save();
        ctx.globalAlpha = clamp01((t - 2.2) / 0.5);
        ctx.textAlign = 'center';
        ctx.font = '42px "Songti SC"';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('一座汉传古寺 · 在线礼佛、上香、撞钟', W / 2, H * 0.56);
        ctx.restore();
      },
    },
    ePrompt: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        const ba = ease(clamp01((t - 0.05) / 0.35));
        ctx.save();
        ctx.globalAlpha = ba;
        ctx.translate(0, (1 - ba) * 24);
        const bw = 980, bh = 190, bx = (W - bw) / 2, by = H * 0.36;
        ctx.font = '46px "Songti SC"';
        ctx.fillStyle = '#7a6c5a';
        ctx.fillText('只说了一句话：', bx + 10, by - 28);
        roundRect(ctx, bx, by, bw, bh, 40);
        ctx.fillStyle = 'rgba(255,252,245,0.95)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(60,40,25,0.28)';
        ctx.stroke();
        const all = PROMPT_LINES.join('');
        const shown = Math.floor(clamp01((t - EVENTS.titleType.from) / (EVENTS.titleType.perChar * all.length)) * all.length);
        const typed = all.slice(0, shown);
        ctx.font = '84px "Songti SC"';
        ctx.fillStyle = '#2b2420';
        ctx.textBaseline = 'middle';
        ctx.fillText(typed, bx + 70, by + bh / 2 + 4);
        if (shown < all.length || Math.floor(t * 2.5) % 2 === 0) ctx.fillRect(bx + 78 + ctx.measureText(typed).width, by + bh / 2 - 44, 5, 88);
        ctx.restore();
      },
    },
    uiRooms: {
      setup() {},
      update() {},
      draw(t) {
        uiCard('uiRooms', t / curDur);
        grade(Math.round(t * FPS));
        header();
      },
    },
    uiBow: {
      setup() {},
      update() {},
      draw(t) {
        uiCard('uiBow', t / curDur);
        grade(Math.round(t * FPS));
        header();
      },
    },
    eEnd: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        inkTitle(ctx, '山寺', W / 2, H * 0.36, 300, t - 0.2, 0.9);
        const sa = clamp01((t - EVENTS.endSeal) / 0.18);
        if (sa > 0) seal(ctx, W / 2 + 330, H * 0.3, 96, '静山', sa, 1.25 - 0.25 * ease(sa));
        ctx.save();
        ctx.textAlign = 'center';
        ctx.globalAlpha = clamp01((t - 0.9) / 0.5);
        ctx.font = '68px MSZ';
        ctx.fillStyle = '#2a2320';
        ctx.fillText('一句话复刻韩国爆火的山寺', W / 2, H * 0.6);
        ctx.globalAlpha = clamp01((t - 2.0) / 0.5);
        ctx.font = '40px "Songti SC"';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('浏览器打开即玩 · 五十人同坐一殿', W / 2, H * 0.7);
        ctx.restore();
      },
    },
    // —— 清晨 ——
    plaque: {
      setup() {
        cast(0);
        env.follow(0, 64);
      },
      update(_t, u) {
        setFov(46);
        camPath([
          { p: [1.2, 2.6, 73.2], l: [0, 3.9, 68.3] },
          { p: [0.3, 3.3, 71.0], l: [0, 3.95, 68.3] },
        ])(u, camera);
      },
    },
    leaves: {
      setup() {
        const ms = cast(1);
        ms[0].setAction('walk');
        ms[0].speed = 1.0;
        env.follow(17, 42);
      },
      update(t, u) {
        setFov(60);
        place(pool[0], 16.2 + t * 0.15, 46.5 - t * 1.0, Math.PI - 0.15);
        camPath([
          { p: [14.2, 0.45, 40.2], l: [17.6, 1.6, 44.5] },
          { p: [14.6, 0.55, 40.8], l: [17.2, 2.2, 45.0] },
        ])(u, camera);
      },
    },
    // —— 白天·院子 ——
    pond: {
      setup() {
        const ms = cast(2);
        ms.forEach((m) => {
          m.setAction('walk');
          m.speed = 1.2;
        });
        env.follow(0, 52);
      },
      update(t, u) {
        setFov(54);
        place(pool[0], -0.2, 57.5 - t * 1.2, Math.PI);
        place(pool[1], 0.4, 59.5 - t * 1.2, Math.PI);
        // 站在池岸西南角，斜望水面、荷叶和拱桥，背后是山门
        camPath([
          { p: [-10.5, 1.9, 44.2], l: [-0.5, 0.7, 53.5] },
          { p: [-9.2, 1.7, 45.6], l: [0, 0.8, 54.0] },
        ])(u, camera);
      },
    },
    pagoda: {
      setup() {
        cast(0);
        env.follow(PAGODAS[0].x, PAGODAS[0].z);
      },
      update(_t, u) {
        setFov(58);
        const P = PAGODAS[0];
        camPath([
          { p: [P.x + 4.2, 1.2, P.z + 6.2], l: [P.x, 2.5, P.z] },
          { p: [P.x + 4.8, 1.6, P.z + 6.8], l: [P.x, 10.5, P.z] },
        ])(u, camera);
      },
    },
    sideHall: {
      setup() {
        const ms = cast(2);
        const D = SIDE_HALLS[0];
        place(ms[0], D.x + 6.5, D.z - 2, -Math.PI / 2);
        ms[0].setAction('hapjang');
        place(ms[1], D.x + 9, D.z + 4, Math.PI);
        ms[1].setAction('walk');
        ms[1].speed = 1;
        env.follow(D.x + 4, D.z);
      },
      update(t, u) {
        setFov(52);
        const D = SIDE_HALLS[0];
        place(pool[1], D.x + 9, D.z + 4 - t * 1.0, Math.PI);
        const z = D.z + 5.5 - 9 * glide(u);
        camera.position.set(D.x + 10.4, 2.3, z);
        camera.lookAt(D.x + 4, 2.9, z - 1.5);
      },
    },
    bench: {
      setup() {
        const ms = cast(1);
        const S = BENCH_SEATS[0];
        place(ms[0], S.x, S.z, S.yaw, heightAt(S.x, S.z));
        ms[0].setAction('bench');
        env.follow(S.x + 6, S.z);
      },
      update(_t, u) {
        setFov(52);
        const S = BENCH_SEATS[0];
        camPath([
          { p: [S.x - 2.0, 1.55, S.z - 1.6], l: [S.x + 7, 0.9, S.z + 2.5] },
          { p: [S.x - 1.6, 1.5, S.z - 1.2], l: [S.x + 7, 0.9, S.z + 2.0] },
        ])(u, camera);
      },
    },
    ding: {
      setup() {
        me.root.visible = false;
        cast(0);
        env.follow(0, 7);
      },
      update(_t, u) {
        // 绕鼎半圈，正面铭文「靜山禪寺」转到镜头前
        setFov(46);
        const a = 0.75 - 1.5 * glide(u);
        camera.position.set(INCENSE.x + Math.sin(a) * 3.0, 1.75, INCENSE.z + Math.cos(a) * 3.0);
        camera.lookAt(INCENSE.x, 1.0, INCENSE.z);
      },
    },
    hallFront: {
      setup() {
        const ms = cast(2);
        place(ms[0], -1.2, 6, Math.PI);
        place(ms[1], 1.0, 8, Math.PI);
        ms.forEach((m) => {
          m.setAction('walk');
          m.speed = 1.1;
        });
        env.follow(0, 0);
      },
      update(t, u) {
        setFov(58);
        place(pool[0], -1.2, 6 - t * 1.1, Math.PI);
        place(pool[1], 1.0, 8 - t * 1.1, Math.PI);
        camPath([
          { p: [3.4, 1.7, 11.5], l: [0.3, 3.2, -4] },
          { p: [3.0, 3.8, 10.0], l: [0.3, 7.5, -5] },
          { p: [2.6, 6.2, 8.5], l: [0.3, 10.5, -6] },
        ])(u, camera);
      },
    },
    ceiling: {
      setup() {
        fillHall(0.62);
        env.follow(0, -14);
      },
      update(_t, u) {
        setFov(62);
        camPath([
          { p: [0, 2.3, -8.5], l: [0, 7.6, -11.5] },
          { p: [0, 2.5, -10.0], l: [0, 6.5, -16.5] },
          { p: [0, 2.7, -11.5], l: [0, 4.6, -20.5] },
        ])(u, camera);
      },
    },
    wall: {
      setup() {
        fillHall(0.25);
        env.follow(8, -12);
      },
      update(_t, u) {
        setFov(52);
        const z = -7.5 - 8 * glide(u);
        camera.position.set(8.6, 3.0, z);
        camera.lookAt(13.8, 3.6, z - 2.5);
      },
    },
    rosary: {
      setup() {
        fillHall(0.85);
        rk = 0;
        env.follow(0, -12);
      },
      update(t) {
        setFov(50);
        camera.position.set(-0.4, 2.1, -9.4 - t * 0.12);
        camera.lookAt(0, 2.7, -19);
        while (rk < EVENTS.rosary.length && t >= EVENTS.rosary[rk]) {
          rosaryView.nudge(1);
          rk++;
        }
      },
    },
    // —— 夜 ——
    nightSide: {
      setup() {
        const ms = cast(2);
        const D = SIDE_HALLS[0];
        place(ms[0], D.x + 6.8, D.z + 1, -Math.PI / 2);
        ms[0].setAction('hapjang');
        place(ms[1], D.x + 9.5, D.z + 7, Math.PI);
        ms[1].setAction('walk');
        ms[1].speed = 0.9;
        env.follow(D.x + 6, D.z);
      },
      update(t, u) {
        setFov(56);
        const D = SIDE_HALLS[0];
        place(pool[1], D.x + 9.5, D.z + 7 - t * 0.9, Math.PI);
        camPath([
          { p: [D.x + 14.5, 2.2, D.z + 11], l: [D.x + 3, 2.6, D.z - 1] },
          { p: [D.x + 13.0, 2.5, D.z + 8.5], l: [D.x + 3, 2.8, D.z - 1.5] },
        ])(u, camera);
      },
    },
    nightPagoda: {
      setup() {
        cast(0);
        env.follow(PAGODAS[1].x, PAGODAS[1].z);
      },
      update(_t, u) {
        setFov(56);
        const P = PAGODAS[1];
        camPath([
          { p: [P.x - 5.5, 1.4, P.z + 6.5], l: [P.x, 4.0, P.z] },
          { p: [P.x - 6.5, 1.8, P.z + 7.8], l: [P.x, 8.0, P.z] },
        ])(u, camera);
      },
    },
    crowd: {
      setup() {
        me.root.visible = false;
        const ms = cast(CUSHIONS.length);
        ms.forEach((m, i) => {
          const st = CUSHIONS[i];
          place(m, st.x, st.z + 0.32, st.yaw, CUSHION_TOP);
          m.setAction('bow');
          m.actionTime = ((i * 0.29) % 1) * BOW_DURATION;
        });
        env.follow(0, -12);
      },
      update(_t, u) {
        setFov(60);
        camPath([
          { p: [0, 5.6, -2.6], l: [0, 1.6, -15] },
          { p: [0, 4.6, -5.0], l: [0, 2.2, -17] },
        ])(u, camera);
      },
    },
    bell: {
      setup() {
        const ms = cast(1);
        place(ms[0], BELL.x - 2.6, BELL.z + 1.0, Math.PI / 2, heightAt(BELL.x - 2.6, BELL.z + 1.0));
        ms[0].setAction('idle');
        env.follow(BELL.x, BELL.z);
      },
      update(t, u) {
        setFov(52);
        camPath([
          { p: [BELL.x + 3.0, 1.8, BELL.z + 5.4], l: [BELL.x - 0.4, 3.0, BELL.z] },
          { p: [BELL.x + 2.3, 2.1, BELL.z + 4.6], l: [BELL.x - 0.5, 3.2, BELL.z] },
        ])(u, camera);
        if (!struck && t >= EVENTS.bellStrike) {
          struck = true;
          buildings.bell.strike();
        }
      },
    },
    moktak: {
      setup() {
        fillHall(0.4);
        mk = 0;
        env.follow(0, -12);
      },
      update(t) {
        setFov(50);
        camera.position.set(0.4, 2.1, -9.6 - t * 0.15);
        camera.lookAt(0, 2.7, -19);
        while (mk < EVENTS.moktak.length && t >= EVENTS.moktak[mk]) {
          moktak.strike();
          mk++;
        }
      },
    },
    night: {
      setup() {
        const ms = cast(3);
        place(ms[0], -0.8, 14, Math.PI);
        place(ms[1], 0.9, 16, Math.PI);
        place(ms[2], -2.3, 9.3, Math.PI);
        ms[0].setAction('walk');
        ms[1].setAction('walk');
        ms[0].speed = ms[1].speed = 1.1;
        ms[2].setAction('idle');
        env.follow(0, 10);
      },
      update(t, u) {
        setFov(60);
        camPath([
          { p: [0, 15.5, 44], l: [0, 3.6, 2] },
          { p: [0, 12.2, 32], l: [0, 4.4, -3] },
        ])(u, camera);
        place(pool[0], -0.8, 14 - t * 1.1, Math.PI);
        place(pool[1], 0.9, 16 - t * 1.1, Math.PI);
      },
    },
    // —— 功能介绍 ——
    fTitle: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        ctx.save();
        portrait();
        inkTitle(ctx, '山寺', 540, 760, 380, t - 0.3, 1.0);
        const sa = clamp01((t - 1.6) / 0.18);
        if (sa > 0) seal(ctx, 905, 900, 110, '静山', sa, 1.25 - 0.25 * ease(sa));
        const a = clamp01((t - 1.9) / 0.6);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '78px MSZ';
        ctx.fillStyle = '#2a2320';
        ctx.fillText('一座可以修行的线上古寺', 540, 1100);
        const b = clamp01((t - 2.8) / 0.6);
        ctx.globalAlpha = b;
        ctx.font = '42px "Songti SC"';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('礼佛 · 上香 · 撞钟 · 抄经 · 读经 · 登塔', 540, 1220);
        ctx.restore();
      },
    },
    quest: {
      // 寺务：扫地僧请你帮忙，你拿起扫帚扫银杏下的落叶，叶子一扬而散
      setup() {
        cast(0);
        const px = -9.8, pz = 29.2;
        if (!pile) {
          pile = leafPile(px, pz, 3);
          scene.add(pile.group);
        }
        pile.group.visible = true;
        me.root.visible = true;
        place(me, px + 0.9, pz + 0.5, Math.atan2(-0.9, -0.5));
        me.setAction('idle');
        sweeperNpc.root.visible = true;
        place(sweeperNpc, -7.0, 31.6, Math.atan2(-1.9, -1.9));
        sweeperNpc.setAction('sweep');
        env.follow(-9, 30);
      },
      update(t, u) {
        setFov(46);
        camPath([
          { p: [-12.9, 1.9, 25.6], l: [-9.5, 0.7, 29.7] },
          { p: [-12.2, 1.6, 26.6], l: [-9.4, 0.6, 29.8] },
        ])(u, camera);
        if (t >= 2.4 && me.action !== 'sweep') {
          me.setAction('sweep');
          pile!.sweep();
        }
      },
    },
    uiPractice: {
      setup() {},
      update() {},
      draw(t) {
        uiCard('uiPractice', t / curDur);
        grade(Math.round(t * FPS));
        featureCaption(curShot!, t);
      },
    },
    looks: {
      // 衣钵：五位换了不同僧袍、念珠的小和尚站成一排，镜头慢慢横移；脚下写着几级的衣钵
      setup() {
        cast(0);
        looksRow.forEach((m, k) => {
          m.root.visible = true;
          place(m, -3.2 + k * 1.6, 3.0 + Math.abs(k - 2) * 0.3, 0);
          m.setAction('hapjang');
          m.actionTime = k * 0.5;
        });
        env.follow(0, 6);
      },
      update(_t, u) {
        setFov(50);
        camPath([
          // 镜头走在小和尚和院中大鼎之间（鼎在 z = 7，半径 1.2），别穿进鼎里
          { p: [-2.7, 1.4, 5.35], l: [-1.9, 0.95, 3.1] },
          { p: [2.7, 1.4, 5.35], l: [1.9, 0.95, 3.1] },
        ])(u, camera);
      },
      draw(t, frame) {
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        render3d();
        ctx.drawImage(renderer.domElement, 0, 0);
        grade(frame);
        const names = ['居士 · 赤袈裟', '行者 · 褐袈裟', '比丘 · 金黄袈裟', '法师 · 金线袈裟', '长老 · 紫金袈裟'];
        const v = new THREE.Vector3();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '36px "Songti SC"';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 10;
        looksRow.forEach((m, k) => {
          v.copy(m.root.position).setY(m.root.position.y + 1.75).project(camera);
          if (v.z > 1) return;
          const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
          ctx.globalAlpha = clamp01((t - 0.5 - k * 0.25) / 0.5);
          roundRect(ctx, x - 150, y - 34, 300, 60, 30);
          ctx.fillStyle = 'rgba(20,15,10,0.5)';
          ctx.fill();
          ctx.fillStyle = '#fbf3e2';
          ctx.fillText(names[k], x, y + 10);
        });
        ctx.restore();
        featureCaption(curShot!, t);
      },
    },
    guanyin: {
      // 解锁殿堂：观音殿的门转开，殿里点起暖灯，镜头慢慢推进到菩萨面前
      setup() {
        cast(0);
        sideHalls.setOpen(0, false, false);
        env.follow(-29, -4);
      },
      update(t, u) {
        setFov(50);
        if (t >= 0.9) sideHalls.setOpen(0, true, true);
        const H0 = SIDE_HALLS[0];
        // 正中一间是柱子，镜头从旁边一间敞开的门斜着看进去，停在殿外（殿门往里开，进去会被门扇挡住）
        camPath([
          { p: [H0.x + 9.0, 2.1, H0.z + 2.8], l: [H0.x - 3.1, 2.1, H0.z] },
          { p: [H0.x + 6.2, 1.85, H0.z + 1.9], l: [H0.x - 3.1, 2.2, H0.z] },
        ])(u, camera);
      },
    },
    library: {
      // 藏经阁：从后院仰看两层的楼阁，一位小和尚走上台阶
      setup() {
        cast(0);
        me.root.visible = true;
        me.setAction('walk');
        me.speed = 1.1;
        env.follow(0, -38);
      },
      update(t, u) {
        setFov(56);
        place(me, 0.6, -29.4 - t * 0.55, Math.PI);
        camPath([
          { p: [6.4, 1.4, -27.6], l: [0, 4.2, -40] },
          { p: [4.6, 2.4, -27.2], l: [0, 5.6, -41] },
        ])(u, camera);
      },
    },
    copy: {
      // 抄经：藏经阁里的经案虚化作底，一张宣纸上描《心经》：灰色范字上墨一点点写出来，写完盖「妙」
      setup() {
        cast(0);
        env.follow(0, -40);
        camera.position.set(1.4, 1.5, -38.0);
        camera.lookAt(0, 0.9, -41.5);
      },
      update() {
        setFov(50);
      },
      draw(t, frame) {
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        render3d();
        ctx.save();
        ctx.filter = 'blur(14px) brightness(0.55)';
        ctx.drawImage(renderer.domElement, -40, -60, W + 80, H + 120);
        ctx.restore();
        const chars = ['行', '深'];
        const per = 3.6;
        const k = Math.min(chars.length - 1, Math.floor(Math.max(0, t - 0.4) / per));
        const lt = Math.max(0, t - 0.4) - k * per;
        // 纸
        const pw = 860, ph = 1120, px = (W - pw) / 2, py = 330;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 40;
        roundRect(ctx, px, py, pw, ph, 10);
        ctx.fillStyle = '#f4ecda';
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = 'rgba(176,58,40,0.5)';
        ctx.lineWidth = 2;
        roundRect(ctx, px + 12, py + 12, pw - 24, ph - 24, 6);
        ctx.stroke();
        ctx.fillStyle = '#3a2a1e';
        ctx.font = '46px SansaSutra';
        ctx.textAlign = 'left';
        ctx.fillText('般若波羅蜜多心經', px + 50, py + 90);
        ctx.font = '30px "Songti SC"';
        ctx.fillStyle = '#8a6e58';
        ctx.fillText(`第 ${6 + k} / 260 字`, px + 520, py + 88);
        // 这一句：抄过的墨色，正在抄的朱红
        const line = '行深般若波羅蜜多時';
        ctx.font = '64px SansaSutra';
        ctx.textAlign = 'center';
        [...line].forEach((c, i) => {
          ctx.fillStyle = i < k ? '#1d1612' : i === k ? '#b03a28' : 'rgba(90,70,50,0.3)';
          ctx.fillText(c, px + pw / 2 + (i - 4) * 78, py + 200);
        });
        // 米字格
        const cs = 620, cx0 = (W - cs) / 2, cy0 = py + 270;
        ctx.fillStyle = '#f8f1e1';
        ctx.fillRect(cx0, cy0, cs, cs);
        ctx.strokeStyle = 'rgba(176,58,40,0.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(cx0, cy0, cs, cs);
        ctx.setLineDash([16, 12]);
        ctx.strokeStyle = 'rgba(176,58,40,0.28)';
        for (const [a, b, c, d] of [[0, cs / 2, cs, cs / 2], [cs / 2, 0, cs / 2, cs], [0, 0, cs, cs], [cs, 0, 0, cs]]) {
          ctx.beginPath();
          ctx.moveTo(cx0 + a, cy0 + b);
          ctx.lineTo(cx0 + c, cy0 + d);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.font = `${cs * 0.8}px SansaSutra`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(120,104,86,0.3)';
        ctx.fillText(chars[k], W / 2, cy0 + cs * 0.53);
        // 墨：从左上往右下一点点写出来（大致是汉字的笔顺方向）
        const wp = ease(clamp01(lt / 2.6));
        if (wp > 0) {
          const ink = document.createElement('canvas');
          ink.width = ink.height = cs;
          const g = ink.getContext('2d')!;
          g.font = `${cs * 0.8}px SansaSutra`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = 'rgba(24,18,14,0.95)';
          g.fillText(chars[k], cs / 2, cs * 0.53);
          g.globalCompositeOperation = 'destination-in';
          const grd = g.createLinearGradient(0, 0, cs, cs);
          const edge = wp * 1.15;
          grd.addColorStop(0, 'rgba(0,0,0,1)');
          grd.addColorStop(Math.max(0, Math.min(1, edge - 0.12)), 'rgba(0,0,0,1)');
          grd.addColorStop(Math.max(0.001, Math.min(1, edge)), 'rgba(0,0,0,0)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd;
          g.fillRect(0, 0, cs, cs);
          ctx.drawImage(ink, cx0, cy0);
        }
        // 写完：盖一方「妙」，飘一个「功德 +4」
        const ga = clamp01((lt - 2.7) / 0.2) * clamp01((per - 0.1 - lt) / 0.25);
        if (ga > 0) {
          ctx.globalAlpha = ga;
          roundRect(ctx, W / 2 - 64, cy0 + 40, 128, 84, 10);
          ctx.fillStyle = '#b3261e';
          ctx.fill();
          ctx.fillStyle = '#fff3e0';
          ctx.font = '60px MSZ';
          ctx.fillText('妙', W / 2, cy0 + 84);
          ctx.fillStyle = '#e2b45c';
          ctx.font = '40px "Songti SC"';
          ctx.fillText('功德 +4', W / 2 + 230, cy0 + 70 - (lt - 2.7) * 30);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        grade(frame);
        featureCaption(curShot!, t);
      },
    },
    uiReader: {
      setup() {},
      update() {},
      draw(t) {
        uiCard('uiReader', t / curDur);
        grade(Math.round(t * FPS));
        featureCaption(curShot!, t);
      },
    },
    tower: {
      // 登塔：站在左塔顶层檐下的外廊，清晨的云海铺满院子和山谷，镜头慢慢转向山门
      setup() {
        cast(0);
        showClouds = true;
        for (let k = 0; k < 8; k++) clouds.update(1, elapsed, true, 20);
        env.follow(-10, 15);
      },
      update(_t, u) {
        setFov(58);
        const P = PAGODAS[0], sc = P.s * 0.75;
        // 从左塔望向东边的右塔和大殿：殿顶、塔刹从云里露出来（白天，云是白的）
        const yaw = -1.25 + 0.85 * glide(clamp01(u));
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const eyeY = 9.0 * sc;
        camera.position.set(P.x + fx * 1.15 * sc, eyeY, P.z + fz * 1.15 * sc);
        camera.lookAt(camera.position.x + fx * 10, eyeY - Math.tan(0.17) * 10, camera.position.z + fz * 10);
      },
    },
    // ———— 山寺上新 ————
    nTitle: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        ctx.save();
        portrait();
        inkTitle(ctx, '山寺', 540, 640, 340, t - 0.05, 0.7);
        // 「上新」一枚红签，落在第二拍
        const a = clamp01((t - 1.2) / 0.18);
        if (a > 0) {
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(540, 900);
          ctx.scale(1.3 - 0.3 * ease(a), 1.3 - 0.3 * ease(a));
          roundRect(ctx, -170, -70, 340, 140, 18);
          ctx.fillStyle = '#b3261e';
          ctx.fill();
          ctx.fillStyle = '#fbefd8';
          ctx.font = '104px ZMX';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('上 新', 0, 6);
          ctx.restore();
        }
        // 三样新东西，一拍一个
        ['山寺咖啡', '祈福灯廊', '键盘抄经'].forEach((s, i) => {
          const b = clamp01((t - 2.4 - i * 0.6) / 0.3);
          if (b <= 0) return;
          ctx.globalAlpha = b;
          ctx.textAlign = 'center';
          ctx.font = '74px MSZ';
          ctx.fillStyle = '#2a2320';
          ctx.fillText(s, 540, 1130 + i * 110 + (1 - b) * 20);
        });
        ctx.restore();
      },
    },
    nCafe: {
      // 外景：从石板小路那头慢慢推近东院的茶寮，露台上有人坐着喝咖啡，小沙弥端着托盘走过
      setup() {
        cafeCrowd();
        waiter.root.visible = true;
        waiter.setAction('tray');
        waiter.speed = 1;
        env.follow(32, 48);
      },
      update(t, u) {
        setFov(52);
        const a = cafeWorld(0.3, 2.9), b = cafeWorld(2.6, 4.5);
        const k = clamp01((t - 0.6) / 4.2);
        place(waiter, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, Math.atan2(b.x - a.x, b.z - a.z));
        if (k >= 1 && waiter.action !== 'serve') waiter.setAction('serve');
        // 从西南方的高处斜着推近：厅、露台、油纸伞、大纸杯一起入画
        camPath([
          { p: [23.6, 5.4, 61.8], l: [35.2, 1.6, 48.8] },
          { p: [26.4, 3.6, 58.2], l: [35.0, 1.7, 48.8] },
        ])(u, camera);
      },
    },
    nTerrace: {
      // 露台：贴着平台前沿横移，油纸伞下的人端着杯子，一口一口喝
      setup() {
        const guests = cafeCrowd();
        sipAt = [[2.4, guests[0]], [4.2, guests[2]], [6.0, guests[1]]];
        env.follow(32, 48);
      },
      update(t, u) {
        setFov(62);
        for (const [tt, m] of sipAt) if (t >= tt && t - 1 / FPS < tt) m.sip();
        // 贴着平台前沿低机位横移，抬一点头，伞面在画面上半
        camPath([
          { p: [29.2, 1.15, 42.8], l: [32.4, 1.6, 45.6] },
          { p: [29.2, 1.15, 54.2], l: [32.4, 1.6, 51.4] },
        ])(u, camera);
      },
    },
    nBar: {
      // 吧台：顺着吧台横移，两位咖啡师父在忙，机器冒热气；第七拍咖啡做好，端到小和尚手上
      setup() {
        cafeCrowd();
        cafe.setBrewing(true);
        me.root.visible = true;
        const s = cafeWorld(0, -0.15);
        place(me, s.x, s.z, Math.PI / 2);
        me.setAction('idle');
        env.follow(38, 48);
      },
      update(t, u) {
        setFov(56);
        if (t >= EVENTS.nCupReady && !me.cupKind) {
          me.setCup('latte', 3);
          cafe.setBrewing(false);
        }
        camPath([
          { p: [36.3, 1.55, 45.3], l: [40.5, 1.45, 47.0] },
          { p: [36.3, 1.55, 51.7], l: [40.5, 1.45, 50.0] },
        ])(u, camera);
      },
      draw(t, frame) {
        draw3d(frame);
        const a = clamp01((t - EVENTS.nCupReady) / 0.25) * clamp01((curDur - 0.4 - t) / 0.4);
        if (a > 0) pill(`般若拿铁 · 做好了`, W / 2, H * 0.3, a, '#f3d38a');
        featureCaption(curShot!, t);
      },
    },
    nMenu: {
      setup() {},
      update() {},
      draw(t) {
        uiCard('uiCafeMenu', t / curDur);
        featureCaption(curShot!, t);
      },
    },
    nTreat: {
      // 请人喝：小和尚端着满杯从厅里走出来，走到跑堂小沙弥跟前，双手递过去；小沙弥接过、合十道谢
      setup() {
        cafeCrowd();
        me.root.visible = true;
        me.setCup('latte', 3);
        me.setAction('walk');
        me.speed = 1.1;
        waiter.root.visible = true;
        waiter.setAction('idle');
        const w = cafeWorld(0.4, 4.25);
        place(waiter, w.x, w.z, Math.PI / 2);
        env.follow(33, 49);
      },
      update(t, u) {
        setFov(50);
        const x0 = 36.7, x1 = 35.25, z = cafeWorld(0.4, 0).z;
        const k = clamp01(t / 2.6);
        place(me, x0 + (x1 - x0) * k, z, -Math.PI / 2);
        if (k >= 1 && me.action === 'walk') me.setAction('idle');
        if (t >= EVENTS.nGive - 1.0 && !gave && me.action === 'idle' && !offered) {
          offered = true;
          me.offer();
        }
        if (t >= EVENTS.nGive && !gave) {
          gave = true;
          me.setCup(null);
          waiter.setCup('latte', 3);
        }
        if (t >= EVENTS.nGive + 0.4 && waiter.action === 'idle') waiter.setAction('hapjang');
        camPath([
          { p: [30.5, 1.4, 46.3], l: [35.4, 1.05, 48.9] },
          { p: [30.9, 1.35, 47.1], l: [35.3, 1.05, 48.9] },
        ])(u, camera);
      },
      draw(t, frame) {
        draw3d(frame);
        const ba = clamp01((t - EVENTS.nGive - 0.4) / 0.25);
        if (ba > 0) bubble('多谢施主，阿弥陀佛', worldToScreen(waiter.root.position.x, waiter.root.position.y + 1.75, waiter.root.position.z), ba);
        const ma = clamp01((t - EVENTS.nGive - 0.1) / 0.2) * clamp01((EVENTS.nGive + 2.2 - t) / 0.4);
        if (ma > 0) {
          const p = worldToScreen(me.root.position.x, me.root.position.y + 1.7, me.root.position.z);
          floatWord('功德 +8', p.x, p.y - (t - EVENTS.nGive) * 40, ma, 48);
        }
        featureCaption(curShot!, t);
      },
    },
    nAlley: {
      // 灯廊：跟在小和尚身后、比灯低一点，抬头是一片灯和心愿纸签；前面两位在灯下合十
      setup() {
        cast(2);
        me.root.visible = true;
        me.setAction('walk');
        me.speed = 1;
        const ms = cast(2);
        place(ms[0], -26.2, 50.6, Math.PI * 0.95);
        place(ms[1], -28.0, 48.4, Math.PI * 1.1);
        ms.forEach((m, i) => {
          m.setAction('hapjang');
          m.actionTime = i * 0.8;
        });
        env.follow(-27, 52);
      },
      update(t) {
        setFov(64);
        const z = 59.6 - t * 0.78;
        place(me, -27.0, z, Math.PI);
        for (const m of pool) if (m.root.visible && m.actionTime > 2.3) m.setAction('hapjang', true);
        camera.position.set(-26.55, 1.42, z + 3.3);
        camera.lookAt(-27.15, 2.75, z - 6.5);
      },
    },
    nHang: {
      // 挂一盏灯：站在灯底下双手举起，灯从手里慢慢升到绳上；挂好后旁边显出这盏的心愿签
      setup() {
        cast(0);
        me.root.visible = true;
        const hk = garden.hooks[HANG_HOOK];
        place(me, hk.stand.x, hk.stand.z, Math.atan2(hk.x - hk.stand.x, hk.z - hk.stand.z));
        me.setAction('idle');
        // 这一盏先空着，挂上去以后才出现
        garden.setLanterns(demoLanterns.filter((v) => v.hook !== HANG_HOOK));
        hangDone = false;
        env.follow(-27, 54);
      },
      update(t, u) {
        setFov(56);
        if (t >= EVENTS.nHangStart && me.action === 'idle' && !hangDone) me.setAction('hang', true);
        if (t >= EVENTS.nHangRelease && !hangDone) {
          hangDone = true;
          garden.setLanterns([...demoLanterns.filter((v) => v.hook !== HANG_HOOK), { hook: HANG_HOOK, color: 0, tag: 2 }]);
          const a = me.root.rotation.y;
          garden.rise(HANG_HOOK, new THREE.Vector3(me.root.position.x + Math.sin(a) * 0.25, me.root.position.y + 1.45, me.root.position.z + Math.cos(a) * 0.25));
        }
        const hk = garden.hooks[HANG_HOOK];
        camPath([
          { p: [hk.x + 1.9, 1.0, hk.z + 2.6], l: [hk.x - 0.1, 2.1, hk.z] },
          { p: [hk.x + 1.6, 1.05, hk.z + 2.9], l: [hk.x - 0.1, 2.6, hk.z] },
        ])(u, camera);
      },
      draw(t, frame) {
        draw3d(frame);
        const a = clamp01((t - EVENTS.nHangRelease - 1.9) / 0.4);
        if (a > 0) {
          const hk = garden.hooks[HANG_HOOK];
          const p = worldToScreen(hk.x, hk.y - 0.55, hk.z);
          wishTag('愿一战上岸', '暖暖的山雀', p.x + 150, p.y - 60, a);
        }
        featureCaption(curShot!, t);
      },
    },
    nWish: {
      setup() {
        garden.setLanterns(demoLanterns);
      },
      update() {},
      draw(t) {
        uiCard('uiWishWrite', t / curDur);
        featureCaption(curShot!, t);
      },
    },
    nPersimmon: {
      // 柿饼架：黄昏，小和尚走到架前合十，架子上方飘出「柿柿如意」
      setup() {
        cast(0);
        me.root.visible = true;
        me.setAction('walk');
        me.speed = 1;
        env.follow(-27, 41);
      },
      update(t, u) {
        setFov(52);
        const a = { x: -25.4, z: 43.6 }, b = { x: -27, z: 40.75 };
        const k = clamp01(t / 2.0);
        if (k < 1) place(me, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, Math.atan2(b.x - a.x, b.z - a.z));
        else {
          place(me, b.x, b.z, Math.PI);
          if (me.action === 'walk') me.setAction('hapjang', true);
        }
        camPath([
          { p: [-24.3, 1.45, 44.6], l: [-27.0, 1.35, 39.6] },
          { p: [-25.0, 1.35, 43.7], l: [-27.0, 1.5, 39.5] },
        ])(u, camera);
      },
      draw(t, frame) {
        draw3d(frame);
        const a = clamp01((t - EVENTS.nPersimmon) / 0.3);
        if (a > 0) {
          const p = worldToScreen(-27, 2.55, 39.4);
          floatWord('柿柿如意', p.x, p.y - (t - EVENTS.nPersimmon) * 26, a, 128, 'MSZ');
          const b = clamp01((t - EVENTS.nPersimmon - 0.6) / 0.3);
          if (b > 0) floatWord('好柿成双 · 心想柿成', p.x, p.y + 110 - (t - EVENTS.nPersimmon) * 26, b, 48, '"Songti SC"', '#fbf3e2');
        }
        featureCaption(curShot!, t);
      },
    },
    nSutra: {
      // 键盘抄经：藏经阁虚化作底，铺一张朱丝栏经纸；每一拍输入法上屏一组字，纸上一个接一个落墨
      setup() {
        cast(0);
        env.follow(0, -40);
        camera.position.set(1.4, 1.5, -38.0);
        camera.lookAt(0, 0.9, -41.5);
      },
      update() {
        setFov(50);
      },
      draw(t, frame) {
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        render3d();
        ctx.save();
        ctx.filter = 'blur(14px) brightness(0.55)';
        ctx.drawImage(renderer.domElement, -40, -60, W + 80, H + 120);
        ctx.restore();
        drawSutraSheet(t);
        featureCaption(curShot!, t);
      },
    },
    nNight: {
      // 入夜：从灯廊外的高处慢慢降下来，一廊灯亮着，几个人在灯下走（灯笼比游戏里再亮一些，泛出光晕）
      setup() {
        garden.setLanterns(demoLanterns);
        garden.setLanternLevel(env.lanternLevel * 1.9);
        const ms = cast(3);
        ms.forEach((m, i) => {
          m.setAction('walk');
          m.speed = 0.8;
        });
        env.follow(-27, 52);
      },
      update(t, u) {
        setFov(56);
        pool.slice(0, 3).forEach((m, i) => place(m, -27 + (i - 1) * 0.9, 58 - i * 2.2 - t * 0.55, Math.PI));
        camPath([
          { p: [-19.3, 4.6, 60.6], l: [-27.0, 2.6, 51.5] },
          { p: [-20.4, 2.5, 56.2], l: [-27.2, 2.85, 50.5] },
        ])(u, camera);
      },
    },
    nEnd: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        ctx.save();
        portrait();
        inkTitle(ctx, '山寺', 540, 760, 360, t - 0.2, 0.9);
        const sa = clamp01((t - EVENTS.endSeal) / 0.18);
        if (sa > 0) seal(ctx, 948, 870, 96, '静山', sa, 1.25 - 0.25 * ease(sa));
        const a = clamp01((t - 0.9) / 0.5);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '70px MSZ';
        ctx.fillStyle = '#2a2320';
        ctx.fillText('浏览器打开就能逛', 540, 1060);
        const b = clamp01((t - 1.8) / 0.6);
        ctx.globalAlpha = b;
        ctx.font = '42px "Songti SC"';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('礼佛 · 上香 · 抄经 · 读经', 540, 1180);
        ctx.fillText('念珠 · 撞钟 · 木鱼 · 祈福', 540, 1250);
        ctx.restore();
      },
    },
    walk: {
      setup() {
        // 殿里一堂人在礼拜（主角的蒲团空着）；香炉边两位拨念珠
        const seats = CUSHIONS.filter((c, i) => c.id !== heroCushion.id && (i * 7) % 10 < 5);
        const ms = cast(seats.length + 2);
        seats.forEach((st, i) => {
          place(ms[i], st.x, st.z + 0.32, st.yaw, CUSHION_TOP);
          ms[i].setAction('bow');
          ms[i].actionTime = ((i * 0.37) % 1) * BOW_DURATION;
        });
        place(ms[seats.length], 2.2, INCENSE.z + 2.4, Math.PI * 0.92);
        place(ms[seats.length + 1], -2.4, INCENSE.z + 2.6, Math.PI * 1.08);
        ms[seats.length].setAction('rosary');
        ms[seats.length + 1].setAction('rosary');
        librarian.root.visible = true;
        place(librarian, LIBRARY.x + 7.0, LIBRARY.z + 2.2, -Math.PI / 2, heightAt(LIBRARY.x + 7.0, LIBRARY.z + 2.2) + 0.03);
        librarian.setAction('read');
        garden.setLanterns(demoLanterns.filter((v) => v.hook !== HANG_HOOK));
        for (const i of [0, 1, 2]) setSideHallOpen(i, true);
        const hk = garden.hooks[HANG_HOOK];
        const stand = cafeWorld(0, -0.15);
        moves = [
          { t: W_.gate, pts: [[0.3, 64.6], [0, 58.6], [0, 45.4], [0, 36.6]], direct: true },
          { t: W_.toBell, pts: [[0, 36.6], BELL_AT] },
          { t: W_.toIncense, pts: [W_.incenseFrom, INC_AT] },
          { t: W_.toHall, pts: [INC_AT, [heroCushion.x, heroCushion.z + 0.85]] },
          { t: W_.walkOut, pts: [[heroCushion.x, heroCushion.z + 0.85], [heroCushion.x, 2.6]], direct: true },
          // 藏经阁正中一间是柱子，从右边那扇开着的门进
          { t: W_.libWalk, pts: [[LIB_DOOR_X, -30.4], [LIB_DOOR_X, -37.4], [deskSeat.x + 0.6, deskSeat.z + 0.4], [deskSeat.x, deskSeat.z]], direct: true },
          // 茶寮：从石板路走上露台，从中间一间进厅，到吧台前
          { t: W_.cafeIn, pts: [[27.2, 47.4], [30.4, 48.7], [35.6, 48.7], [stand.x, stand.z]], direct: true },
          { t: W_.toSeat, pts: [[stand.x, stand.z], [36.2, 49.2], [cafeHeroSeat.approachX, cafeHeroSeat.approachZ], [cafeHeroSeat.x, cafeHeroSeat.z]], direct: true },
          { t: W_.toPersimmon, pts: [PERSIMMON_FROM, [PERSIMMON.x, PERSIMMON.z + 1.35]], direct: true },
          { t: W_.alleyWalk, pts: [[PERSIMMON.x, PERSIMMON.z + 1.35], [-27.0, 44.0], [hk.stand.x, hk.stand.z]], direct: true },
          { t: W_.nightWalk, pts: [[hk.stand.x, hk.stand.z], [-27.0, 51.0], [-27.0, 47.4]], direct: true },
        ].map((m) => {
          const c = curveOf(m.pts as [number, number][], !!m.direct);
          return { t: m.t as [number, number], c, len: c.getLength() };
        });
        me.root.visible = true;
        me.setAction('idle');
        place(me, 0.3, 64.6, Math.PI);
        me.onIncensePlant = () => {
          yardList = [...yardList, { id: 'mine', mine: true, remain: 1 }];
          props.setIncense(yardList);
        };
        walkYaw = Math.PI;
        lastWalkT = -1;
        struckW = hungW = false;
        satW = '';
        crane = aerial = null;
        cafeOn = false;
        cutAt = -1;
        followCam();
        camP.copy(wantP);
        camL.copy(wantL);
      },
      update(t) {
        const dt = lastWalkT < 0 ? 1 / FPS : Math.max(0, t - lastWalkT);
        const cutNow = W_.cuts.some((c) => lastWalkT < c && t >= c);
        lastWalkT = t;
        // 天色：按时间表的钟点变化；夜里灯廊的灯再亮一些，画面整体提亮
        const hr = hourAt(t);
        env.setHour(hr);
        const lv = env.lanternLevel;
        props.setLanternLevel(lv);
        cafe.setLanternLevel(lv);
        garden.setLanternLevel(lv * (lv > 1 ? 1.2 : 1));
        renderer.toneMappingExposure *= 1 + 0.38 * THREE.MathUtils.smoothstep(hr, 17.6, 19.8);
        // 切到茶寮时：咖啡师父、跑堂、几位客人上场（殿里的人此后不在画面里）
        if (t >= W_.cuts[1] && !cafeOn) {
          cafeOn = true;
          cafeCrowd();
          waiter.root.visible = true;
        }
        if (cafeOn) {
          // 跑堂从吧台右头出发，等主角走到吧台前再端着托盘穿过厅堂，送到左边的露台桌
          const a = cafeWorld(4.2, CAFE.bar + 0.45), b = cafeWorld(-2.4, 4.4);
          const k = clamp01((t - 112.4) / 5.2);
          place(waiter, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, Math.atan2(b.x - a.x, b.z - a.z));
          if (k <= 0 && waiter.action !== 'tray') waiter.setAction('tray');
          if (k > 0 && k < 1 && waiter.action !== 'tray') waiter.setAction('tray');
          if (k >= 1 && waiter.action !== 'serve') waiter.setAction('serve');
          waiter.speed = 1;
          cafe.setBrewing(t >= W_.brew[0] && t < W_.brew[1]);
        }
        // —— 人 ——
        const mv = moves.find((m) => t >= m.t[0] && t <= m.t[1]);
        const hk = garden.hooks[HANG_HOOK];
        const stand = cafeWorld(0, -0.15);
        const stay = (x: number, z: number, yaw: number, y?: number) => {
          place(me, x, z, yaw, y);
          walkYaw = yaw;
        };
        if (mv) {
          const u = (t - mv.t[0]) / (mv.t[1] - mv.t[0]);
          const s = clamp01(plateau(clamp01(u)));
          const p = mv.c.getPointAt(s);
          const tg = mv.c.getTangentAt(Math.min(0.999, Math.max(0.001, s)));
          const want = Math.atan2(tg.x, tg.z);
          if (cutNow || u < 0.02) walkYaw = want;
          walkYaw += Math.atan2(Math.sin(want - walkYaw), Math.cos(want - walkYaw)) * (1 - Math.exp(-dt * 6));
          place(me, p.x, p.z, walkYaw);
          const s2 = clamp01(plateau(clamp01(u + 0.01)));
          me.speed = Math.max(0.6, ((s2 - s) * mv.len) / ((mv.t[1] - mv.t[0]) * 0.01));
          if (me.action !== 'walk') me.setAction('walk');
          satW = '';
        } else if (t < W_.gate[0]) stay(0.3, 64.6, Math.PI);
        else if (t >= W_.toBell[1] && t < W_.cuts[0]) {
          stay(BELL_AT[0], BELL_AT[1], Math.PI / 2);
          if (satW !== 'bell') {
            satW = 'bell';
            me.setAction('hapjang', true);
          }
          if (!struckW && t >= W_.bellStrike) {
            struckW = true;
            buildings.bell.strike();
          }
        } else if (t >= W_.toIncense[1] && t < W_.toHall[0]) {
          stay(INC_AT[0], INC_AT[1], Math.PI);
          if (t >= W_.incenseStart && satW !== 'incense') {
            satW = 'incense';
            me.setAction('incense', true);
          } else if (t < W_.incenseStart && me.action !== 'idle') me.setAction('idle');
        } else if (t >= W_.toHall[1] && t < W_.walkOut[0]) {
          if (t >= W_.bowStart && t < W_.bowEnd) {
            stay(heroCushion.x, heroCushion.z + 0.32, Math.PI, CUSHION_TOP);
            if (satW !== 'bow') {
              satW = 'bow';
              me.setAction('bow', true);
            }
          } else {
            stay(heroCushion.x, heroCushion.z + 0.85, Math.PI);
            if (me.action !== 'idle') me.setAction('idle');
          }
        } else if (t > W_.walkOut[1] && t < W_.libTeleport) {
          stay(heroCushion.x, 2.6, 0);
          if (me.action !== 'idle') me.setAction('idle');
        } else if (t >= W_.libTeleport && t < W_.libWalk[0]) {
          stay(LIB_DOOR_X, -30.4, Math.PI);
          if (me.action !== 'idle') me.setAction('idle');
        } else if (t > W_.libWalk[1] && t < W_.cuts[1]) {
          stay(deskSeat.x, deskSeat.z, deskSeat.yaw);
          if (t >= W_.sit && satW !== 'sit') {
            satW = 'sit';
            me.setAction('sit', true);
          }
        } else if (t > W_.cafeIn[1] && t < W_.toSeat[0]) {
          // 吧台前等咖啡；做好的那一拍端到手上
          stay(stand.x, stand.z, Math.PI / 2);
          if (me.action !== 'idle') me.setAction('idle');
          if (t >= W_.cupReady && !me.cupKind) me.setCup('latte', 3);
        } else if (t > W_.toSeat[1] && t < W_.persimmonTeleport) {
          stay(cafeHeroSeat.x, cafeHeroSeat.z, cafeHeroSeat.yaw);
          if (satW !== 'cafeSeat') {
            satW = 'cafeSeat';
            me.seatKind = 'bench';
            me.setAction('bench', true);
          }
          W_.sipAt.forEach((st, i) => {
            if (lastSip < st && t >= st) me.sip();
            if (t >= st + 1.3 && me.cupSips > 2 - i) me.setCup('latte', 2 - i);
          });
        } else if (t >= W_.persimmonTeleport && t < W_.toPersimmon[0]) {
          stay(PERSIMMON_FROM[0], PERSIMMON_FROM[1], Math.atan2(PERSIMMON.x - PERSIMMON_FROM[0], PERSIMMON.z + 1.35 - PERSIMMON_FROM[1]));
          if (me.cupKind) me.setCup(null);
          if (me.action !== 'idle') me.setAction('idle');
        } else if (t > W_.toPersimmon[1] && t < W_.alleyWalk[0]) {
          stay(PERSIMMON.x, PERSIMMON.z + 1.35, Math.PI);
          if (t >= W_.persimmonBow && satW !== 'persimmon') {
            satW = 'persimmon';
            me.setAction('hapjang', true);
          } else if (t < W_.persimmonBow && me.action !== 'idle') me.setAction('idle');
        } else if (t > W_.alleyWalk[1] && t < W_.nightWalk[0]) {
          const yaw = Math.atan2(hk.x - hk.stand.x, hk.z - hk.stand.z);
          stay(hk.stand.x, hk.stand.z, yaw);
          if (t >= W_.hangStart && satW !== 'hang') {
            satW = 'hang';
            me.setAction('hang', true);
          } else if (t < W_.hangStart && me.action !== 'idle') me.setAction('idle');
          if (!hungW && t >= W_.hangRelease) {
            hungW = true;
            garden.setLanterns([...demoLanterns.filter((v) => v.hook !== HANG_HOOK), { hook: HANG_HOOK, color: 0, tag: 2 }]);
            garden.rise(HANG_HOOK, new THREE.Vector3(hk.stand.x + Math.sin(yaw) * 0.25, heightAt(hk.stand.x, hk.stand.z) + 1.45, hk.stand.z + Math.cos(yaw) * 0.25));
          }
        } else if (me.action === 'walk') me.setAction('idle');
        lastSip = t;
        env.follow(me.root.position.x, me.root.position.z);

        // —— 镜头 ——
        let k = 2.2;
        const B = BELL;
        const fixed = (p: V3, l: V3, kk = 1.6) => {
          wantP.set(...p);
          wantL.set(...l);
          k = kk;
        };
        if (t < W_.toBell[1] - 1.5) followCam(5.4, 2.0, 0.5);
        else if (t < W_.cuts[0]) fixed([B.x + 3.0, 1.9, B.z + 5.4], [B.x - 0.8, 2.5, B.z + 0.6]);
        else if (t < W_.toIncense[1] - 1.2) followCam(5.2, 2.1, 0.6);
        else if (t < W_.toHall[0] + 0.5) fixed([2.9, 2.35, 4.2], [0, 1.45, 7.9]);
        else if (t < W_.toHall[1] - 1.2) followCam(5.0, 2.2, 0.5);
        else if (t < W_.bowEnd + 0.4) fixed([0.3, 2.5, heroCushion.z - 3.7], [heroCushion.x, 0.8, heroCushion.z + 0.7], 1.4);
        else if (t < W_.craneLib[0]) followCam(5.0, 2.4, 0.4);
        else if (t < W_.craneLib[1] + 0.2) {
          if (!crane) crane = keyCurves([
            [[camP.x, camP.y, camP.z], [camL.x, camL.y, camL.z]],
            [[-2.5, 11.0, 10.0], [0, 7.0, -4.0]],
            [[0, 24.0, -10.0], [0, 4.0, -34.0]],
            [[LIB_DOOR_X, 7.5, -30.5], [LIB_DOOR_X, 2.2, -37.0]],
            [[LIB_DOOR_X, 2.4, -33.4], [1.0, 1.3, -39.0]],
          ]);
          const v = glide(clamp01((t - W_.craneLib[0]) / (W_.craneLib[1] - W_.craneLib[0])));
          wantP.copy(crane[0].getPoint(v));
          wantL.copy(crane[1].getPoint(v));
          k = 4;
        } else if (t < W_.cuts[1]) fixed([deskSeat.x + 1.2, 2.0, deskSeat.z + 1.9], [deskSeat.x, 0.95, deskSeat.z - 0.8], 1.3);
        else if (t < W_.cafeIn[1] - 1.0) followCam(5.0, 2.0, 0.5);
        else if (t < W_.toSeat[0] + 0.5) fixed([36.3, 1.6, 45.6], [39.4, 1.4, 48.3]);
        else if (t < W_.toSeat[1] - 1.0) followCam(4.6, 2.0, 0.5);
        // 伞下喝咖啡：机位在平台外侧（不在屋檐下），起飞时不会撞到伞和屋檐
        else if (t < W_.aerial[0]) fixed([31.0, 1.5, 50.2], [cafeHeroSeat.x, 1.0, cafeHeroSeat.z + 0.45], 1.5);
        else if (t < W_.aerial[1] - 2.0) {
          // 从露台升起来，高处看整座寺院的日落，再转向西院的柿饼架
          if (!aerial) aerial = keyCurves([
            [[camP.x, camP.y, camP.z], [camL.x, camL.y, camL.z]],
            [[28.8, 6.8, 50.4], [33.4, 1.2, 50.8]],
            [[14.0, 30.0, 44.0], [-12.0, 2.0, 42.0]],
            [[-14.0, 13.0, 47.0], [-26.0, 1.5, 41.0]],
            [[-22.0, 2.4, 46.4], [-26.4, 1.4, 41.4]],
          ]);
          const v = glide(clamp01((t - W_.aerial[0]) / (W_.aerial[1] - 2.0 - W_.aerial[0])));
          wantP.copy(aerial[0].getPoint(v));
          wantL.copy(aerial[1].getPoint(v));
          k = 4;
        } else if (t < W_.toPersimmon[1] + 0.2) followCam(4.6, 1.9, 0.5);
        else if (t < W_.alleyWalk[0] + 0.4) fixed([-23.6, 1.4, 42.4], [-27.0, 1.35, 39.6]);
        else if (t < W_.alleyWalk[1] - 1.2) {
          // 从柿饼架走进灯廊：镜头在前面倒着走，人朝镜头走来，柿饼架在身后
          if (t < W_.alleyWalk[0] + (W_.alleyWalk[1] - W_.alleyWalk[0]) * 0.75) followCam(-4.4, 1.6, 0.5, -1.2, 1.7);
          else followCam(4.6, 1.55, 0.4, 2.2, 1.6);
        }
        else if (t < W_.nightWalk[0] + 0.4) fixed([hk.x + 1.9, 1.0, hk.z + 2.6], [hk.x - 0.1, 2.3, hk.z], 1.5);
        else if (t < W_.nightWalk[1] - 0.6) followCam(4.4, 1.35, 0.3, 4.0, 2.4);
        else {
          // 收尾：人停在灯廊里，镜头还在身后，慢慢往后退、抬头看满廊的灯（不升高，灯廊里限高 2.2 米）
          const u = Math.max(0, t - (W_.nightWalk[1] - 0.6));
          followCam(4.4 + u * 0.28, 1.35 + u * 0.1, 0.3, 4.0, 2.4 + u * 0.14);
          k = 1.2;
        }
        if (cutNow) {
          // 叠化切换：镜头直接到位
          camP.copy(wantP);
          camL.copy(wantL);
        } else {
          const f = 1 - Math.exp(-dt * k);
          camP.lerp(wantP, f);
          camL.lerp(wantL, f);
        }
        const A = WISH_ALLEY;
        if (camP.x > A.xW - 0.8 && camP.x < A.xE + 0.8 && camP.z > A.zs[0] - 0.8 && camP.z < A.zs[A.zs.length - 1] + 0.8) camP.y = Math.min(camP.y, 2.2);
        // 茶寮厅里：镜头不穿过天花
        const cl = cafeLocal(camP.x, camP.z);
        if (Math.abs(cl.lx) < CAFE.hw + 0.3 && cl.lz > -CAFE.hd && cl.lz < CAFE.hd + 0.6) camP.y = Math.min(camP.y, CAFE.base + CAFE.colH - 0.3);
        camP.y = Math.max(camP.y, heightAt(camP.x, camP.z) + 0.6);
        setFov(t > W_.alleyWalk[0] ? 62 : 56);
        camera.position.copy(camP);
        camera.lookAt(camL);
      },
      draw(t, frame) {
        draw3d(frame);
        // 抄经：经纸从下面滑上来，背景压暗、虚化
        const S0 = W_.sheet[0], S1 = W_.sheet[1];
        const a = clamp01((t - S0) / 0.6) * clamp01((S1 - t) / 0.6);
        if (a > 0) {
          ctx.save();
          ctx.globalAlpha = a;
          ctx.filter = 'blur(14px) brightness(0.55)';
          ctx.drawImage(renderer.domElement, -40, -60, W + 80, H + 120);
          ctx.restore();
          ctx.save();
          ctx.translate(0, (1 - ease(a)) * H * 0.6);
          drawSutraSheet(t, W_.inks);
          ctx.restore();
        }
        const fl = (t0: number, text: string, size = 50) => {
          const d = t - t0;
          if (d < 0 || d > 1.4) return;
          const p = worldToScreen(me.root.position.x, me.root.position.y + 1.7, me.root.position.z);
          floatWord(text, p.x, p.y - d * 50, clamp01(1 - d / 1.4), size);
        };
        for (const tt of W_.bowTouches) fl(tt + 0.2, '功德 +2');
        fl(W_.incensePlant + 0.3, '功德 +5');
        fl(W_.bellHit + 0.2, '功德 +3');
        // 咖啡做好
        const ca = clamp01((t - W_.cupReady) / 0.25) * clamp01((W_.toSeat[0] + 0.3 - t) / 0.4);
        if (ca > 0) pill('般若拿铁 · 做好了', W / 2, H * 0.3, ca, '#f3d38a');
        // 柿柿如意
        const pa = clamp01((t - W_.persimmonWord) / 0.3) * clamp01((W_.alleyWalk[0] + 0.6 - t) / 0.5);
        if (pa > 0) {
          const p = worldToScreen(PERSIMMON.x, 2.55, PERSIMMON.z);
          floatWord('柿柿如意', p.x, p.y - (t - W_.persimmonWord) * 26, pa, 128, 'MSZ');
        }
        // 挂好的灯旁边显出心愿签
        const ha = clamp01((t - W_.hangRelease - 1.9) / 0.4) * clamp01((W_.nightWalk[0] + 1.0 - t) / 0.5);
        if (ha > 0) {
          const hk = garden.hooks[HANG_HOOK];
          const p = worldToScreen(hk.x, hk.y - 0.55, hk.z);
          wishTag('愿家人安康', '静静的云', p.x + 150, p.y - 60, ha);
        }
        walkCaption(t);
        // 叠化：切换后的半秒里，上一段的最后一帧慢慢淡掉
        const c = W_.cuts.find((x) => t >= x && t < x + 0.5);
        if (c !== undefined) {
          if (cutAt !== c) {
            cutAt = c;
            cutCtx.drawImage(lastFrame, 0, 0);
          }
          ctx.save();
          ctx.globalAlpha = 1 - (t - c) / 0.5;
          ctx.drawImage(cutFrame, 0, 0);
          ctx.restore();
        }
        // 片尾渐暗到黑
        const fo = clamp01((t - W_.fadeOut[0]) / (W_.fadeOut[1] - W_.fadeOut[0]));
        if (fo > 0) {
          ctx.save();
          ctx.globalAlpha = fo * fo * (3 - 2 * fo);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
        lastCtx.drawImage(out, 0, 0);
      },
    },
    coffee: {
      setup() {
        // 露台上四位客人；朋友坐在主角那张伞桌对面，手里空着
        const seats = [0, 4, 9, 10].map((i) => CAFE_SEATS[i]);
        const cups: [string, number][] = [['latte', 2], ['coldbrew', 3], ['osmanthus', 2], ['americano', 1]];
        const ms = cast(seats.length + 1);
        seats.forEach((st, i) => {
          place(ms[i], st.x, st.z, st.yaw);
          ms[i].seatKind = 'bench';
          ms[i].setAction('bench');
          ms[i].setCup(cups[i][0] as never, cups[i][1]);
        });
        friend = ms[seats.length];
        friend.setLook(ROBES[3], BEADS[1]);
        place(friend, friendSeat.x, friendSeat.z, friendSeat.yaw);
        friend.seatKind = 'bench';
        friend.setAction('bench');
        friend.setCup(null);
        [[-2.1, CAFE.bar - 1.15], [0.4, CAFE.bar - 1.15]].forEach(([lx, lz], i) => {
          const m = baristas[i], p = cafeWorld(lx, lz);
          m.root.visible = true;
          place(m, p.x, p.z, CAFE.yaw);
          m.setAction('brew');
          m.actionTime = i * 1.7;
        });
        waiter.root.visible = true;
        const stand = cafeWorld(0, -0.15);
        cofMoves = [
          // 从石板小路走上露台，从中间一间进厅，到吧台前
          { t: C_.approach, pts: [[22.0, 44.4], [24.0, 45.4], [29.0, 47.8], [30.4, 48.7], [35.6, 48.7], [stand.x, stand.z]] },
          // 端着满杯走出厅，到朋友身边
          { t: C_.toFriend, pts: [[stand.x, stand.z], [36.2, 48.9], [32.2, 48.7], [30.4, 50.0], FRIEND_SIDE] },
          // 喝完起身，从两张伞桌中间穿过去，到回收桶旁边
          { t: C_.toBin, pts: [[cofHeroSeat.x, cofHeroSeat.z], [32.0, 50.9], [32.25, 52.3], [32.0, 53.2], BIN_AT] },
        ].map((m) => {
          const c = curveOf(m.pts as [number, number][], true);
          return { t: m.t as [number, number], c, len: c.getLength() };
        });
        me.root.visible = true;
        me.setAction('idle');
        place(me, 22.0, 44.4, Math.atan2(2.0, 1.0));
        walkYaw = Math.atan2(2.0, 1.0);
        lastWalkT = -1;
        cofSat = '';
        cofOffered = cofDropOffered = false;
        cofCurve = cofNight = null;
        cofSeg = -1;
        cutAt = -1;
        followCam();
        camP.copy(wantP);
        camL.copy(wantL);
      },
      update(t) {
        const dt = lastWalkT < 0 ? 1 / FPS : Math.max(0, t - lastWalkT);
        // 第一帧也当作切换：镜头直接到位，不从别处飞过来
        const cutNow = lastWalkT < 0 || C_.cuts.some((c) => lastWalkT < c && t >= c);
        lastWalkT = t;
        const hr = hourAt(t, C_.hours);
        env.setHour(hr);
        const lv = env.lanternLevel;
        props.setLanternLevel(lv);
        cafe.setLanternLevel(lv);
        garden.setLanternLevel(lv);
        renderer.toneMappingExposure *= 1 + 0.38 * THREE.MathUtils.smoothstep(hr, 17.6, 19.8);
        // 夜里从露台外侧给两人补一点暖光，不然背着厅里的灯只剩剪影
        cofFill.intensity = Math.min(lv, 1) * 7;
        const fr = friend!;
        // 跑堂：主角在吧台前等咖啡时，端着托盘穿过厅堂送到露台左边那桌
        {
          const a = cafeWorld(4.2, CAFE.bar + 0.45), b = cafeWorld(-2.4, 4.4);
          const k = clamp01((t - 25.6) / 5.2);
          place(waiter, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, Math.atan2(b.x - a.x, b.z - a.z));
          const want = k >= 1 ? 'serve' : 'tray';
          if (waiter.action !== want) waiter.setAction(want);
          waiter.speed = 1;
        }
        cafe.setBrewing(t >= C_.brew[0] - 0.6 && t < C_.brew[1]);
        // —— 人 ——
        const stand = cafeWorld(0, -0.15);
        const stay = (x: number, z: number, yaw: number) => {
          place(me, x, z, yaw);
          walkYaw = yaw;
        };
        const sitDown = (seat: typeof cofHeroSeat, tag: string) => {
          stay(seat.x, seat.z, seat.yaw);
          if (cofSat !== tag) {
            cofSat = tag;
            me.seatKind = 'bench';
            me.setAction('bench', true);
          }
        };
        const mv = cofMoves.find((m) => t >= m.t[0] && t <= m.t[1]);
        if (mv) {
          const u = (t - mv.t[0]) / (mv.t[1] - mv.t[0]);
          const s = clamp01(plateau(clamp01(u)));
          const p = mv.c.getPointAt(s);
          const tg = mv.c.getTangentAt(Math.min(0.999, Math.max(0.001, s)));
          const want = Math.atan2(tg.x, tg.z);
          if (cutNow || u < 0.02) walkYaw = want;
          walkYaw += Math.atan2(Math.sin(want - walkYaw), Math.cos(want - walkYaw)) * (1 - Math.exp(-dt * 6));
          place(me, p.x, p.z, walkYaw);
          const s2 = clamp01(plateau(clamp01(u + 0.01)));
          me.speed = Math.max(0.6, ((s2 - s) * mv.len) / ((mv.t[1] - mv.t[0]) * 0.01));
          if (me.action !== 'walk') me.setAction('walk');
          cofSat = '';
        } else if (t < C_.approach[0]) stay(22.0, 44.4, Math.atan2(2.0, 1.0));
        else if (t < C_.toFriend[0]) {
          // 吧台前：点单、等咖啡；做好的那一拍端到手上
          stay(stand.x, stand.z, Math.PI / 2);
          if (me.action !== 'idle') me.setAction('idle');
          if (t >= C_.cupReady && !me.cupKind) me.setCup('latte', 3);
        } else if (t < C_.sit[0]) {
          // 朋友身边：递过去，朋友接住，马上喝一口
          stay(FRIEND_SIDE[0], FRIEND_SIDE[1], Math.atan2(friendSeat.x - FRIEND_SIDE[0], friendSeat.z - FRIEND_SIDE[1]));
          if (me.action !== 'idle') me.setAction('idle');
          if (t >= C_.offer && !cofOffered) {
            cofOffered = true;
            me.offer();
          }
          if (t >= C_.give && me.cupKind) {
            me.setCup(null);
            fr.setCup('latte', 3);
          }
          if (t >= C_.give + 1.0 && t - dt < C_.give + 1.0) fr.sip();
        } else if (t < C_.toBin[0]) {
          // 过了一会儿：主角也端着一杯冷萃坐下了，两人对坐着一口一口喝
          sitDown(cofHeroSeat, 'sit');
          if (cutNow || !me.cupKind) {
            me.setCup('coldbrew', 3);
            fr.setCup('latte', 3);
          }
          C_.sips.forEach((st, i) => {
            if (t >= st && t - dt < st) me.sip();
            if (t >= st + 1.3 && me.cupSips > 2 - i) me.setCup('coldbrew', 2 - i);
          });
          C_.friendSips.forEach((st, i) => {
            if (t >= st && t - dt < st) fr.sip();
            if (t >= st + 1.3 && fr.cupSips > 2 - i) fr.setCup('latte', 2 - i);
          });
        } else if (t < C_.aerial[0]) {
          // 回收桶旁：把空杯放进去
          stay(BIN_AT[0], BIN_AT[1], -Math.PI / 2);
          if (me.action !== 'idle') me.setAction('idle');
          if (t >= C_.binOffer && !cofDropOffered) {
            cofDropOffered = true;
            me.offer();
          }
          if (t >= C_.binDrop && me.cupKind) me.setCup(null);
        } else {
          // 傍晚到入夜：又坐回伞下，换了一杯低因
          sitDown(cofHeroSeat, 'evening');
          if (cutNow || me.cupKind !== 'decaf') {
            me.setCup('decaf', 3);
            fr.setCup('osmanthus', 2);
          }
          if (t >= C_.nightSip && t - dt < C_.nightSip) me.sip();
          if (t >= C_.nightSip + 1.3 && me.cupSips > 2) me.setCup('decaf', 2);
        }
        env.follow(me.root.position.x, me.root.position.z);

        // —— 镜头 ——
        let k = 2.2;
        const fixed = (p: V3, l: V3, kk = 1.6) => {
          wantP.set(...p);
          wantL.set(...l);
          k = kk;
        };
        const seg = C_.cuts.filter((c) => t >= c).length;
        if (seg !== cofSeg) {
          cofSeg = seg;
          cofCurve = null;
        }
        if (t < 6.0) {
          // 开场：从西北高处看整座咖啡馆，落到小和尚身后
          if (!cofCurve) cofCurve = keyCurves([
            [[22.5, 6.8, 57.0], [33.5, 1.4, 48.5]],
            [[21.0, 4.0, 50.5], [31.0, 1.3, 47.8]],
            [[23.0, 2.1, 44.4], [28.9, 1.15, 47.8]],
          ]);
          const v = glide(clamp01(t / 6.0));
          wantP.copy(cofCurve[0].getPoint(v));
          wantL.copy(cofCurve[1].getPoint(v));
          k = 6;
        } else if (t < C_.approach[1] - 1.0) followCam(5.0, 2.0, 0.5);
        // 吧台：从厅外斜着看进去，小和尚和两位咖啡师都在画面里
        else if (t < C_.toFriend[0] + 0.5) fixed([34.6, 1.75, 45.0], [40.0, 1.35, 48.6]);
        // 端着杯子走出来：镜头站在露台外，转着头跟住他
        else if (t < C_.toFriend[1] - 0.8) fixed([28.6, 1.7, 46.4], [me.root.position.x, me.root.position.y + 1.0, me.root.position.z], 1.8);
        else if (t < C_.sit[0]) fixed([28.2, 1.55, 49.6], [30.8, 1.0, 52.3], 1.4);
        else if (t < C_.cuts[3]) {
          // 两人对坐：从露台外侧平视，背景是厅里的吧台
          const u = clamp01((t - C_.sit[0]) / (C_.cuts[3] - C_.sit[0]));
          fixed([27.6 + u * 0.35, 1.5, 51.2], [31.1, 0.95, 51.5], 1.4);
        } else if (t < C_.aerial[0]) fixed([30.2, 1.7, 56.6], [31.0, 0.85, 53.2], 1.4);
        else if (t < C_.night[0]) {
          // 从露台外侧升起来，高处俯看整座咖啡馆和露台，再落回门前；天色慢慢暗下来
          if (!cofCurve) cofCurve = keyCurves([
            [[27.6, 1.5, 51.2], [31.1, 0.95, 51.5]],
            [[26.4, 6.5, 52.4], [32.0, 2.4, 50.0]],
            [[27.0, 14.0, 60.0], [36.0, 0.5, 48.0]],
            [[24.0, 9.0, 52.0], [34.0, 1.5, 48.5]],
            [[25.5, 3.2, 53.5], [33.5, 1.6, 50.0]],
          ]);
          const v = glide(clamp01((t - C_.aerial[0]) / (C_.aerial[1] - C_.aerial[0])));
          wantP.copy(cofCurve[0].getPoint(v));
          wantL.copy(cofCurve[1].getPoint(v));
          k = 5;
        } else {
          // 入夜：慢慢推近到伞下那一桌
          if (!cofNight) cofNight = keyCurves([
            [[25.5, 3.2, 53.5], [33.5, 1.6, 50.0]],
            [[26.6, 2.1, 52.0], [32.2, 1.2, 51.2]],
            [[27.3, 1.6, 51.1], [31.3, 1.05, 51.5]],
          ]);
          const v = glide(clamp01((t - C_.night[0]) / 9.0));
          wantP.copy(cofNight[0].getPoint(v));
          wantL.copy(cofNight[1].getPoint(v));
          k = 4;
        }
        if (cutNow) {
          camP.copy(wantP);
          camL.copy(wantL);
        } else {
          const f = 1 - Math.exp(-dt * k);
          camP.lerp(wantP, f);
          camL.lerp(wantL, f);
        }
        const cl = cafeLocal(camP.x, camP.z);
        if (Math.abs(cl.lx) < CAFE.hw + 0.3 && cl.lz > -CAFE.hd && cl.lz < CAFE.hd + 0.6) camP.y = Math.min(camP.y, CAFE.base + CAFE.colH - 0.3);
        camP.y = Math.max(camP.y, heightAt(camP.x, camP.z) + 0.6);
        setFov(56);
        camera.position.copy(camP);
        camera.lookAt(camL);
      },
      draw(t, frame) {
        draw3d(frame);
        const fr = friend!;
        // 点单界面：只截实拍截图中间那块菜单（四周的游戏按钮上有「礼佛」「木鱼」等字，不入画），背景是虚化的吧台
        if (t >= C_.menu[0] && t < C_.menu[1]) {
          const im = uiImg.uiCafeMenu;
          ctx.save();
          ctx.filter = 'blur(16px) brightness(0.6)';
          ctx.drawImage(renderer.domElement, -40, -60, W + 80, H + 120);
          ctx.restore();
          const sx = im.width * 0.096, sy = im.height * 0.248, sw = im.width * 0.808, sh = im.height * 0.504;
          const z = 1 + 0.05 * ease(clamp01((t - C_.menu[0]) / (C_.menu[1] - C_.menu[0])));
          const dw = W * 0.88 * z, dh = (dw * sh) / sw;
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = 40;
          ctx.drawImage(im, sx, sy, sw, sh, (W - dw) / 2, H * 0.42 - dh / 2, dw, dh);
          ctx.restore();
        }
        // 咖啡做好
        const ca = clamp01((t - C_.cupReady) / 0.25) * clamp01((C_.toFriend[0] + 0.3 - t) / 0.4);
        if (ca > 0) pill('山雾拿铁 · 做好了', W / 2, H * 0.3, ca, '#f3d38a');
        // 朋友接过杯子
        const ba = clamp01((t - C_.give - 0.3) / 0.25) * clamp01((C_.sit[0] - 0.1 - t) / 0.3);
        if (ba > 0) bubble('谢啦，下次我请！', worldToScreen(fr.root.position.x, fr.root.position.y + 1.6, fr.root.position.z), ba);
        // 每喝一口，头顶显示还剩几口
        C_.sips.forEach((st, i) => {
          const a = clamp01((t - st - 1.3) / 0.2) * clamp01((st + 3.0 - t) / 0.4);
          if (a <= 0) return;
          const p = worldToScreen(me.root.position.x, me.root.position.y + 1.45, me.root.position.z);
          pill(i < 2 ? `还剩 ${2 - i} 口` : '喝完了', p.x, p.y, a, '#f3d38a');
        });
        // 空杯落桶
        const da = clamp01((t - C_.binDrop) / 0.25) * clamp01((C_.binDrop + 1.8 - t) / 0.4);
        if (da > 0) pill('空杯回收 · 下次再来', W / 2, H * 0.3, da, '#f3d38a');
        // 分享卡：背景压暗虚化，卡片从下面滑上来
        const A0 = C_.card[0], A1 = C_.card[1];
        const sa = clamp01((t - A0) / 0.5) * clamp01((A1 - t) / 0.5);
        if (sa > 0 && cardImg) {
          ctx.save();
          ctx.globalAlpha = sa;
          ctx.filter = 'blur(14px) brightness(0.55)';
          ctx.drawImage(renderer.domElement, -40, -60, W + 80, H + 120);
          ctx.restore();
          const cw = W * 0.8, ch = (cw * cardImg.height) / cardImg.width;
          const k2 = ease(clamp01((t - A0) / 0.7));
          const y = H * 0.42 - ch / 2 + (1 - k2) * H * 0.6;
          ctx.save();
          ctx.globalAlpha = sa;
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 40;
          ctx.drawImage(cardImg, (W - cw) / 2, y, cw, ch);
          ctx.restore();
        }
        walkCaption(t, C_.caps);
        // 叠化：切换后的半秒里，上一段的最后一帧慢慢淡掉
        const c = C_.cuts.find((x) => t >= x && t < x + 0.5);
        if (c !== undefined) {
          if (cutAt !== c) {
            cutAt = c;
            cutCtx.drawImage(lastFrame, 0, 0);
          }
          ctx.save();
          ctx.globalAlpha = 1 - (t - c) / 0.5;
          ctx.drawImage(cutFrame, 0, 0);
          ctx.restore();
        }
        // 片尾渐暗到黑
        const fo = clamp01((t - C_.fadeOut[0]) / (C_.fadeOut[1] - C_.fadeOut[0]));
        if (fo > 0) {
          ctx.save();
          ctx.globalAlpha = fo * fo * (3 - 2 * fo);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
        lastCtx.drawImage(out, 0, 0);
      },
    },
    fEnd: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        ctx.save();
        portrait();
        inkTitle(ctx, '山寺', 540, 760, 360, t - 0.2, 0.9);
        const sa = clamp01((t - EVENTS.endSeal) / 0.18);
        if (sa > 0) seal(ctx, 948, 870, 96, '静山', sa, 1.25 - 0.25 * ease(sa));
        const a = clamp01((t - 0.9) / 0.5);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '70px MSZ';
        ctx.fillStyle = '#2a2320';
        ctx.fillText('浏览器打开就能逛', 540, 1060);
        const b = clamp01((t - 1.8) / 0.6);
        ctx.globalAlpha = b;
        ctx.font = '40px "Songti SC"';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('礼佛 上香 撞钟 木鱼 念珠', 540, 1180);
        ctx.fillText('寺务 · 抄经 · 读经 · 登塔 · 衣钵', 540, 1250);
        ctx.fillText('五十人同在一寺', 540, 1320);
        ctx.restore();
      },
    },
    end: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        ctx.save();
        portrait();
        inkTitle(ctx, '山寺', 540, 820, 360, t - 0.2, 0.9);
        const a = clamp01((t - 0.9) / 0.5);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '72px MSZ';
        ctx.fillStyle = '#2a2320';
        ctx.fillText('一句话复刻韩国爆火的山寺', 540, 1110);
        ctx.restore();
        const sa = clamp01((t - EVENTS.endSeal) / 0.18);
        if (sa > 0) seal(ctx, 948, 930, 96, '静山', sa, 1.25 - 0.25 * ease(sa));
        const b = clamp01((t - 2.0) / 0.5);
        ctx.save();
        ctx.globalAlpha = b;
        ctx.textAlign = 'center';
        ctx.font = '42px "Songti SC"';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('浏览器打开即玩 · 五十人同坐一殿', 540, 1230);
        ctx.restore();
        ctx.restore();
      },
    },
  };
  shots.wEnd = shots.nEnd;
  let struck = false;
  let curShot: Shot | null = null;
  let curDur = 4;
  let mk = 0;
  let rk = 0;

  // —— 封面：黄昏的大殿前，一位小和尚合十；上方大字标题，下方那一句话 ——
  async function renderCover(cw: number, ch: number, id: string) {
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.fov = ch / cw > 1.5 ? 54 : 46;
    camera.updateProjectionMatrix();
    env.setMode('dusk');
    props.setLanternLevel(env.lanternLevel);
    cafe.setLanternLevel(env.lanternLevel);
    garden.setLanternLevel(env.lanternLevel);
    renderer.toneMappingExposure *= 1.12;
    const fill = new THREE.PointLight('#ffd7a8', 14, 7, 2);
    fill.position.set(0.9, 2.4, 13.8);
    scene.add(fill);
    const ms = cast(3);
    place(ms[0], -2.4, 9.0, Math.PI);
    place(ms[1], 2.4, 9.0, Math.PI);
    place(ms[2], -1.0, 2.6, Math.PI);
    ms[0].setAction('hapjang');
    ms[1].setAction('hapjang');
    ms[2].setAction('walk');
    ms[2].speed = 1;
    me.root.visible = true;
    place(me, 0, 11.4, 0.06);
    me.setAction('idle');
    env.follow(0, 6);
    const tallShot = ch / cw > 1.5;
    camera.position.set(0.3, 1.25, 15.8);
    camera.lookAt(0, tallShot ? 2.6 : 2.0, 4);
    for (let k = 0; k < 60; k++) tickWorld(1 / 30);
    ms[0].setAction('hapjang');
    ms[1].setAction('hapjang');
    me.setAction('hapjang');
    for (let k = 0; k < 13; k++) tickWorld(1 / 30);
    render3d();

    const oc = document.createElement('canvas');
    oc.width = cw;
    oc.height = ch;
    const g = oc.getContext('2d')!;
    g.drawImage(renderer.domElement, 0, 0);
    // 调色：暖、压暗四角、细颗粒
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = 'rgba(240,200,140,0.25)';
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'multiply';
    const vg = g.createRadialGradient(cw / 2, ch * 0.55, ch * 0.25, cw / 2, ch * 0.55, ch * 0.75);
    vg.addColorStop(0, '#fff');
    vg.addColorStop(1, 'rgb(110,90,70)');
    g.fillStyle = vg;
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.07;
    g.drawImage(grain[0], 0, 0, cw, ch);
    g.restore();
    // 标题底下压一层墨色，字更醒目
    const band = g.createLinearGradient(0, 0, 0, ch * 0.42);
    band.addColorStop(0, 'rgba(10,6,4,0.75)');
    band.addColorStop(1, 'rgba(10,6,4,0)');
    g.fillStyle = band;
    g.fillRect(0, 0, cw, ch * 0.42);
    const tall = ch / cw > 1.5;
    const y1 = tall ? 230 : 175, y2 = y1 + (tall ? 200 : 180);
    const titleLine = (text: string, y: number, size: number, cx = cw / 2) => {
      g.save();
      g.font = `${size}px ZMX`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = 24;
      g.lineWidth = size * 0.09;
      g.strokeStyle = 'rgba(22,12,6,0.92)';
      g.strokeText(text, cx, y);
      g.shadowColor = 'transparent';
      const fg = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      fg.addColorStop(0, '#fff8e6');
      fg.addColorStop(1, '#f0c983');
      g.fillStyle = fg;
      g.fillText(text, cx, y);
      g.restore();
    };
    {
      // 「一句话复刻」和印章作为一组居中，印章盖在这行字的末尾
      const size = tall ? 184 : 172, sealS = tall ? 100 : 90;
      g.font = `${size}px ZMX`;
      const w1 = g.measureText('一句话复刻').width;
      const gx = (cw - (w1 + 26 + sealS)) / 2;
      titleLine('一句话复刻', y1, size, gx + w1 / 2);
      seal(g, gx + w1 + 26 + sealS / 2, y1 + 8, sealS, '山寺', 1, 1);
    }
    titleLine('韩国爆火的山寺', y2, tall ? 158 : 146);
    // 下方：那一句话
    // 那一句话（封面不放网址）：一行，放在标题下面
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.7)';
    {
      const quote = PROMPT_LINES[PROMPT_LINES.length - 1];
      const fs = tall ? 60 : 52;
      g.font = `${fs}px "Songti SC"`;
      const tw = g.measureText(quote).width;
      const bw = tw + fs * 1.8, bh = fs * 1.9, bx = (cw - bw) / 2, by = y2 + (tall ? 170 : 134);
      g.font = `${tall ? 40 : 34}px "Songti SC"`;
      g.fillStyle = '#fbf2de';
      g.shadowBlur = 14;
      g.fillText('只说了一句话：', bx + 8, by - 20);
      g.shadowBlur = 28;
      roundRect(g, bx, by, bw, bh, bh * 0.3);
      g.fillStyle = 'rgba(255,251,242,0.93)';
      g.fill();
      g.shadowColor = 'transparent';
      g.font = `${fs}px "Songti SC"`;
      g.fillStyle = '#2b2420';
      g.textBaseline = 'middle';
      g.fillText(quote, bx + fs * 0.9, by + bh / 2 + 2);
    }
    g.restore();

    const blob: Blob = await new Promise((r) => oc.toBlob((b) => r(b!), 'image/jpeg', 0.95));
    await fetch(`/__promo/frame?shot=${id}&i=0`, { method: 'POST', body: blob });
    scene.remove(fill);
    renderer.setSize(W, H, false);
  }
  if (new URL(location.href).searchParams.has('cover')) {
    status('封面');
    await renderCover(1080, 1920, 'cover');
    await renderCover(1080, 1440, 'cover34');
    const done = document.createElement('div');
    done.dataset.testid = 'promo-done';
    document.body.appendChild(done);
    status('完成');
    return;
  }

  // —— 逐帧录制 ——
  const want = new URL(location.href).searchParams.get('shots')?.split(',') ?? SHOTS.map((s: Shot) => s.id);
  const every = Number(new URL(location.href).searchParams.get('every')) || 1;
  for (const shot of SHOTS as Shot[]) {
    if (!want.includes(shot.id)) continue;
    const S = shots[shot.id];
    const n = Math.round(shot.dur * FPS);
    curDur = shot.dur;
    if (shot.time) {
      env.setMode(shot.time);
      props.setLanternLevel(env.lanternLevel);
      cafe.setLanternLevel(env.lanternLevel);
      garden.setLanternLevel(env.lanternLevel);
      // 夜景提亮一些，手机上看得清
      if (shot.time === 'night') renderer.toneMappingExposure *= 1.45;
    }
    struck = false;
    curShot = shot;
    showClouds = false;
    for (const m of extras) m.root.visible = false;
    for (const m of [me, ...pool, ...extras]) m.setCup(null);
    cafe.setBrewing(false);
    if (pile) pile.group.visible = false;
    S.setup();
    // 先空跑一秒：让香烟、落叶、动作进入状态
    for (let k = 0; k < 30; k++) {
      S.update(0, 0);
      tickWorld(1 / FPS);
    }
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const t = i / FPS;
      S.update(t, t / shot.dur);
      tickWorld(1 / FPS);
      // 试看：&every=N 只出每第 N 帧（世界照常逐帧推进）
      if (every > 1 && i % every) continue;
      if (S.draw) S.draw(t, i);
      else {
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        render3d();
        if (shot.id === 'moktak' || shot.id === 'rosary') {
          ctx.save();
          ctx.filter = 'blur(18px) brightness(0.6) saturate(0.85)';
          ctx.drawImage(renderer.domElement, -60, -100, W + 120, H + 200);
          ctx.restore();
          const view = shot.id === 'moktak' ? moktak : rosaryView;
          view.update(1 / FPS);
          ovr.render(view.scene, view.camera);
          ctx.drawImage(ovr.domElement, 0, ((shot.id === 'moktak' ? 120 : 60) * H) / 1920);
        } else ctx.drawImage(renderer.domElement, 0, 0);
        grade(i);
        if (FEATURES) {
          featureOverlay(shot, t);
          featureCaption(shot, t);
        } else {
          header();
          caption(shot, t);
        }
      }
      if (CUT === 'explainer') subtitles(shot.start + t);
      const blob: Blob = await new Promise((r) => out.toBlob((b) => r(b!), 'image/jpeg', 0.93));
      await fetch(`/__promo/frame?shot=${shot.id}&i=${i}`, { method: 'POST', body: blob });
      if (i % 10 === 0) status(`${shot.id} ${i}/${n}`);
    }
    await log(`${shot.id}: ${n} 帧，${((performance.now() - t0) / n).toFixed(0)} ms/帧`);
  }
  const done = document.createElement('div');
  done.dataset.testid = 'promo-done';
  document.body.appendChild(done);
  status('完成');
}

// —— 2D 素材：宣纸、水墨远山、印章、颗粒 ——
function noiseCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 120;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function paperCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe5d0';
  g.fillRect(0, 0, W, H);
  // 纸上的斑驳与纤维
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 60 + Math.random() * 220;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${Math.random() < 0.5 ? '170,140,100' : '255,250,235'},0.03)`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineWidth = 1;
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * W, y = Math.random() * H, a = Math.random() * Math.PI, l = 6 + Math.random() * 22;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '120,95,60' : '255,255,245'},${0.05 + Math.random() * 0.08})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // 朱红的日
  g.fillStyle = 'rgba(196,62,42,0.88)';
  g.beginPath();
  g.arc(W * 0.807, H * 0.845, 60 * Math.max(0.75, H / 1920), 0, Math.PI * 2);
  g.fill();
  // 三层水墨远山，越远越淡、越虚
  const layers = [
    { base: H * 0.8125, amp: 150 * Math.max(0.6, H / 1920), alpha: 0.16, blur: 8, seed: 1 },
    { base: H * 0.8646, amp: 170 * Math.max(0.6, H / 1920), alpha: 0.28, blur: 4, seed: 2 },
    { base: H * 0.9323, amp: 130 * Math.max(0.6, H / 1920), alpha: 0.5, blur: 1.5, seed: 3 },
  ];
  for (const L of layers) {
    g.save();
    g.filter = `blur(${L.blur}px)`;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) {
      const y = L.base - L.amp * (0.55 * Math.sin(x / 210 + L.seed * 1.7) + 0.3 * Math.sin(x / 83 + L.seed) + 0.15 * Math.sin(x / 31 + L.seed * 3)) - L.amp * 0.4;
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    const grd = g.createLinearGradient(0, L.base - L.amp * 1.4, 0, H);
    grd.addColorStop(0, `rgba(30,28,26,${L.alpha})`);
    grd.addColorStop(1, `rgba(30,28,26,${L.alpha * 0.15})`);
    g.fillStyle = grd;
    g.fill();
    g.restore();
  }
  // 四角略暗
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(90,70,40,0.25)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  return c;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 墨字从左到右显出来，边缘带一点晕开
function inkTitle(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, t: number, dur = 0.8) {
  if (t <= 0) return;
  const p = ease(clamp01(t / dur));
  g.save();
  g.font = `${size}px ZMX`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(text).width;
  const x0 = cx - w / 2 - 20;
  const grad = g.createLinearGradient(x0, 0, x0 + (w + 40) * p + 80, 0);
  grad.addColorStop(0, 'rgba(27,23,20,1)');
  grad.addColorStop(Math.max(0.001, (w + 40) * p / ((w + 40) * p + 80)), 'rgba(27,23,20,1)');
  grad.addColorStop(1, 'rgba(27,23,20,0)');
  g.filter = 'blur(3px)';
  g.globalAlpha = 0.3;
  g.fillStyle = grad;
  g.fillText(text, cx, cy + 4);
  g.filter = 'none';
  g.globalAlpha = 1;
  g.fillStyle = grad;
  g.fillText(text, cx, cy);
  g.restore();
}

// 朱红印章：白字，边缘有些斑驳（先画在单独的小画布上，斑驳只抠印章本身）
const sealCache = new Map<string, HTMLCanvasElement>();
function sealCanvas(size: number, text: string) {
  const key = size + text;
  const hit = sealCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * 1.1);
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2);
  g.fillStyle = '#b52a1f';
  roundRect(g, -size / 2, -size / 2, size, size, size * 0.08);
  g.fill();
  g.strokeStyle = '#f4e9d6';
  g.lineWidth = size * 0.04;
  roundRect(g, -size * 0.4, -size * 0.4, size * 0.8, size * 0.8, size * 0.04);
  g.stroke();
  g.fillStyle = '#f4e9d6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = [...text];
  if (chars.length === 1) {
    g.font = `${size * 0.6}px ZMX`;
    g.fillText(chars[0], 0, size * 0.02);
  } else {
    g.font = `${size * 0.36}px ZMX`;
    chars.forEach((ch, i) => g.fillText(ch, 0, (i - (chars.length - 1) / 2) * size * 0.36));
  }
  g.globalCompositeOperation = 'destination-out';
  let s = text.charCodeAt(0);
  for (let i = 0; i < 40; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280 - 0.5) * size;
    s = (s * 9301 + 49297) % 233280;
    const y = (s / 233280 - 0.5) * size;
    g.beginPath();
    g.arc(x, y, size * 0.012 + (i % 3) * size * 0.006, 0, Math.PI * 2);
    g.fill();
  }
  sealCache.set(key, c);
  return c;
}
function seal(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, text: string, alpha: number, scale: number) {
  const c = sealCanvas(size, text);
  g.save();
  g.globalAlpha = alpha;
  g.translate(cx, cy);
  g.scale(scale, scale);
  g.drawImage(c, -c.width / 2, -c.height / 2);
  g.restore();
}

main().catch((e) => {
  status('出错：' + (e?.message || e));
  log('ERROR ' + (e?.stack || e));
});
