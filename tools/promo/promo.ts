// 宣传片录制：用游戏本身的场景和角色，按分镜逐帧渲染，字幕在页面里画好，帧发回开发服务器存盘
// 打开 /tools/promo/promo.html?shots=gate,grove 只录指定镜头；不带参数录全部
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Environment, buildTerrain, type TimeMode } from '../../src/world/environment';
import { buildHall } from '../../src/world/hall';
import { buildNature } from '../../src/world/nature';
import { buildProps } from '../../src/world/props';
import { buildBuildings } from '../../src/world/buildings';
import { IncenseSpot, type IncenseView } from '../../src/world/incense';
import { placeStatues } from '../../src/world/statues';
import { preloadTextures, setMaxAnisotropy, loadTexture } from '../../src/world/pbr';
import { Monk, BOW_DURATION } from '../../src/monk';
import { MoktakView } from '../../src/overlays';
import { HALL, ALTAR_BURNER, INCENSE, BELL, CUSHIONS, heightAt } from '../../src/layout';
// @ts-ignore 共用的分镜表
import { W, H, FPS, SHOTS, EVENTS, PROMPT_LINES } from './timeline.mjs';

type Shot = { id: string; dur: number; start: number; time?: TimeMode; line?: string };
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
  const skyTex = loadTexture('sky.jpg');
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(skyTex).texture;
  const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 900);

  const env = new Environment(scene, renderer);
  env.sun.shadow.mapSize.set(4096, 4096);
  buildTerrain(scene);
  const hall = buildHall(scene);
  const nature = buildNature(scene);
  const props = buildProps(scene);
  const buildings = buildBuildings(scene);
  const altarIncense = new IncenseSpot(hall.group, ALTAR_BURNER.x, hall.altarSandY, ALTAR_BURNER.z, 0.27, 18, 0.3);
  placeStatues(hall.group, hall.statueSlots, roomEnv);
  hall.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && (m as any).isMeshStandardMaterial && m.metalness >= 0.75) {
      m.envMap = roomEnv;
      m.envMapIntensity = 1.5;
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
  moktak.camera.fov = 40;
  moktak.camera.updateProjectionMatrix();

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
    props.update(dt, elapsed);
    altarIncense.update(dt, elapsed);
    buildings.bell.update(dt);
    buildings.drum.update(dt);
    for (const [i, f] of hall.candleFlames.entries()) f.scale.set(1, 2.2 + Math.sin(elapsed * 9 + i * 2) * 0.25, 1);
    for (const m of pool) if (m.root.visible) m.update(dt);
    if (me.root.visible) me.update(dt);
  }
  function render3d() {
    env.sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  function grade(frame: number) {
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
    const line = shot.id === 'moktak' ? '但余钟磬音' : shot.line;
    if (!line) return;
    const instant = shot.id === 'moktak';
    const end = verticalLine(line, instant ? 9 : t, W - 132, 520, 98, 'MSZ', '#fbf5e6');
    const sealA = instant ? 1 : clamp01((t - 0.35 - line.length * 0.12 - 0.1) / 0.3);
    if (sealA > 0) seal(ctx, W - 132, end + 30, 58, '禅', sealA, 1);
    if (shot.id === 'gate') verticalLine('唐·常建', t, W - 252, 560, 36, '"Songti SC"', 'rgba(251,245,230,0.85)', 0.06, 1.3);
  }

  // —— 各个镜头 ——
  const shots: Record<string, { setup(): void; update(t: number, u: number): void; draw?(t: number, frame: number): void }> = {
    title: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        // 对话气泡：只说了一句话
        const ba = ease(clamp01((t - 0.05) / 0.35));
        ctx.save();
        ctx.globalAlpha = ba;
        ctx.translate(0, (1 - ba) * 30);
        ctx.font = '40px "Songti SC"';
        ctx.fillStyle = '#7a6c5a';
        ctx.fillText('只说了一句话：', 130, 452);
        roundRect(ctx, 110, 480, 860, 250, 36);
        ctx.fillStyle = 'rgba(255,252,245,0.94)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(60,40,25,0.28)';
        ctx.stroke();
        const all = PROMPT_LINES.join('\n');
        const shown = Math.floor(clamp01((t - EVENTS.titleType.from) / (EVENTS.titleType.perChar * all.length)) * all.length);
        const typed = all.slice(0, shown).split('\n');
        ctx.font = '52px "Songti SC"';
        ctx.fillStyle = '#2f4f6f';
        ctx.fillText(typed[0] || '', 160, 585);
        ctx.fillStyle = '#2b2420';
        ctx.fillText(typed[1] || '', 160, 672);
        if (shown < all.length || Math.floor(t * 2.5) % 2 === 0) {
          const li = typed.length - 1;
          const w = ctx.measureText(typed[li] || '').width;
          ctx.fillStyle = '#2b2420';
          ctx.fillRect(166 + w, li === 0 ? 545 : 632, 4, 54);
        }
        ctx.restore();
        // 标题：一笔一笔写出来
        inkTitle(ctx, '一句话复刻', W / 2, 1010, 176, t - EVENTS.titleReveal);
        inkTitle(ctx, '韩国爆火的山寺', W / 2, 1215, 160, t - EVENTS.titleReveal - 0.35);
        const sa = clamp01((t - EVENTS.titleSeal) / 0.18);
        if (sa > 0) seal(ctx, 905, 1395, 118, '山寺', sa, 1.25 - 0.25 * ease(sa));
        const subA = clamp01((t - 3.25) / 0.5);
        ctx.save();
        ctx.globalAlpha = subA;
        ctx.font = '42px "Songti SC"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('一座汉传古寺 · 在线礼佛、上香、撞钟', W / 2, 1515);
        ctx.restore();
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
        camera.fov = 60;
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
        camera.fov = 62;
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
        camera.fov = 50;
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
        camera.fov = 60;
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
        camera.fov = 42;
        camPath([
          { p: [2.9, 2.35, 4.4], l: [0, 1.45, 7.9] },
          { p: [2.3, 2.15, 4.9], l: [0, 1.5, 8.1] },
        ])(u, camera);
      },
    },
    hall: {
      setup() {
        me.root.visible = false;
        const seats = CUSHIONS.filter((_, i) => (i * 7) % 10 < 6);
        const ms = cast(seats.length);
        ms.forEach((m, i) => {
          const s = seats[i];
          place(m, s.x, s.z, s.yaw, s.y);
          m.setAction('bow');
          m.actionTime = ((i * 0.37) % 1) * BOW_DURATION;
        });
        env.follow(0, -12);
      },
      update(_t, u) {
        camera.fov = 58;
        camPath([
          { p: [0, 2.8, -3.2], l: [0, 3.2, -20] },
          { p: [0, 2.1, -8.2], l: [0, 3.5, -20] },
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
        camera.fov = 52;
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
        const seats = CUSHIONS.filter((_, i) => (i * 7) % 10 < 6);
        const ms = cast(seats.length);
        ms.forEach((m, i) => {
          const s = seats[i];
          place(m, s.x, s.z, s.yaw, s.y);
          m.setAction('bow');
          m.actionTime = ((i * 0.37 + 0.4) % 1) * BOW_DURATION;
        });
        mk = 0;
        env.follow(0, -12);
      },
      update(t) {
        camera.fov = 50;
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
        camera.fov = 60;
        camPath([
          { p: [0, 15.5, 44], l: [0, 3.6, 2] },
          { p: [0, 12.2, 32], l: [0, 4.4, -3] },
        ])(u, camera);
        place(pool[0], -0.8, 14 - t * 1.1, Math.PI);
        place(pool[1], 0.9, 16 - t * 1.1, Math.PI);
      },
    },
    end: {
      setup() {},
      update() {},
      draw(t) {
        ctx.drawImage(paper, 0, 0);
        inkTitle(ctx, '山寺', W / 2, 820, 360, t - 0.2, 0.9);
        const a = clamp01((t - 0.9) / 0.5);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '72px MSZ';
        ctx.fillStyle = '#2a2320';
        ctx.fillText('一句话复刻韩国爆火的山寺', W / 2, 1110);
        ctx.restore();
        const sa = clamp01((t - EVENTS.endSeal) / 0.18);
        if (sa > 0) seal(ctx, 948, 930, 96, '静山', sa, 1.25 - 0.25 * ease(sa));
        const b = clamp01((t - 2.0) / 0.5);
        ctx.save();
        ctx.globalAlpha = b;
        ctx.textAlign = 'center';
        ctx.font = '42px "Songti SC"';
        ctx.fillStyle = '#6b5f50';
        ctx.fillText('浏览器打开即玩 · 五十人同坐一殿', W / 2, 1230);
        ctx.font = '36px "Songti SC"';
        ctx.fillStyle = '#8a7c68';
        ctx.fillText('github.com/ChenJiangxi/sansatemple', W / 2, 1310);
        ctx.restore();
      },
    },
  };
  let struck = false;
  let mk = 0;

  // —— 逐帧录制 ——
  const want = new URL(location.href).searchParams.get('shots')?.split(',') ?? SHOTS.map((s: Shot) => s.id);
  for (const shot of SHOTS as Shot[]) {
    if (!want.includes(shot.id)) continue;
    const S = shots[shot.id];
    const n = Math.round(shot.dur * FPS);
    if (shot.time) {
      env.setMode(shot.time);
      props.setLanternLevel(env.lanternLevel);
      // 夜景提亮一些，手机上看得清
      if (shot.time === 'night') renderer.toneMappingExposure *= 1.45;
    }
    struck = false;
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
      if (S.draw) S.draw(t, i);
      else {
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        render3d();
        if (shot.id === 'moktak') {
          ctx.save();
          ctx.filter = 'blur(18px) brightness(0.6) saturate(0.85)';
          ctx.drawImage(renderer.domElement, -60, -100, W + 120, H + 200);
          ctx.restore();
          moktak.update(1 / FPS);
          ovr.render(moktak.scene, moktak.camera);
          ctx.drawImage(ovr.domElement, 0, 120);
        } else ctx.drawImage(renderer.domElement, 0, 0);
        grade(i);
        header();
        caption(shot, t);
      }
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
  g.arc(872, 1622, 60, 0, Math.PI * 2);
  g.fill();
  // 三层水墨远山，越远越淡、越虚
  const layers = [
    { base: 1560, amp: 150, alpha: 0.16, blur: 8, seed: 1 },
    { base: 1660, amp: 170, alpha: 0.28, blur: 4, seed: 2 },
    { base: 1790, amp: 130, alpha: 0.5, blur: 1.5, seed: 3 },
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

// 朱红印章：白字，边缘有些斑驳
function seal(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, text: string, alpha: number, scale: number) {
  g.save();
  g.translate(cx, cy);
  g.scale(scale, scale);
  g.globalAlpha = alpha;
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
  // 斑驳
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
  g.restore();
}

main().catch((e) => {
  status('出错：' + (e?.message || e));
  log('ERROR ' + (e?.stack || e));
});
