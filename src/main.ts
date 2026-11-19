// 山寺主程序：搭场景、控制小和尚、镜头、点击交互，以及与服务器同步
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { t, randomName, onLangChange, type Key } from './i18n';
import { Environment, buildTerrain, type TimeMode } from './world/environment';
import { buildHall, setRoofDetail } from './world/hall';
import { buildNature } from './world/nature';
import { furnishSideHalls, LAMPS } from './world/sidehall';
import { floatText, Rhythm, Charge, leafPile, waterRing, type QuestDef } from './play';
import { LEVELS, levelOf, PLACE_LEVEL, DAILY } from './progress';
import { ROBES, BEADS, savedLook, saveLook, lookCode, parseLook, type Look } from './looks';
import { preloadTreeTextures } from './world/ez-textures';
import { loadHead, REAL } from './body-real';
import { buildProps } from './world/props';
import { buildBuildings } from './world/buildings';
import { IncenseSpot } from './world/incense';
import { placeStatues } from './world/statues';
import { PostFX } from './world/post';
import { buildPond } from './world/pond';
import { buildCloudSea } from './world/clouds';
import { SutraCopy } from './sutra';
import { Reader } from './reader';
import { buildLife } from './world/life';
import { buildShrines } from './world/shrines';
import { buildCafe } from './world/cafe';
import { buildGarden } from './world/garden';
import { WishUI, wishStore, assignHooks, newWishId, type Wish } from './wishes';
import { CafeUI, parseCup, cupCode, SIPS, BREW_MS, DRINK_BY_ID, type DrinkId } from './coffee';
import { Radio, type StationId } from './radio';
import { mountRadioUI } from './radio-ui';
import { PolaroidUI } from './polaroid';
import { buildTea, ROAST_SECONDS } from './world/tea';
import { TeaUI } from './tea-ui';
import { buildResidents, type Role } from './residents';
import { preloadTextures, setMaxAnisotropy, loadTexture } from './world/pbr';
import { Monk, type Action, HANG_DURATION, HAPJANG_DURATION, INCENSE_DURATION, LANTERN_DURATION, FEED_DURATION, FORTUNE_DURATION } from './monk';
import { progress, today as localToday, type SealId } from './progress';
import { sealPop, showFortune, titleCard, loadUiFonts, serviceChip } from './ui-extra';
import { LOTS } from './fortune';
import { getLang } from './i18n';
import { CAFE, CAFE_STAND, CAFE_BIN, CAFE_BIN_STAND, WISH_DESK_STAND, PERSIMMON_STAND, WISH_ALLEY, cafeLocal } from './layout';
import { HALL, SPAWN, INCENSE, CUSHIONS, SEAT_BY_ID, TEA_SEATS, ALTAR_SPOT, ALTAR_BURNER, LANTERN_STAND, FORTUNE, POND, BRIDGE, BELL, COURT, HALLS, PAGODAS, type Seat, heightAt, canStep, planRoute, setSideHallOpen, sideHallOpen } from './layout';
import { audio } from './audio';
import { Net, type IncenseItem, type IncensePlace, type LanternMsg } from './net';
import { OverlayStage, MoktakView, RosaryView } from './overlays';
import { UI, type Visitor, escapeHtml } from './ui';

const bootEl = document.getElementById('boot')!;
document.getElementById('boot-title')!.textContent = t('title');
document.getElementById('boot-msg')!.textContent = t('opening');

function fail(err: unknown) {
  console.error(err);
  bootEl.classList.add('err');
  document.getElementById('boot-title')!.textContent = t('loadFail');
  const msg = document.getElementById('boot-msg')!;
  msg.innerHTML = `<a href="">${t('retry')}</a>`;
}

// 玩家只会用到前面这些；僧人的日常动作在玩家列表里一律算「闲逛」
const STATUS_KEY: Partial<Record<Action, Key>> = {
  idle: 'statusIdle', walk: 'statusWalk', bow: 'statusBow', hapjang: 'statusHapjang', sit: 'statusSit', bench: 'statusSit',
  moktak: 'statusMoktak', rosary: 'statusRosary', incense: 'statusIncense',
  lantern: 'statusLantern', feed: 'statusFeed', fortune: 'statusFortune', sweep: 'statusIdle',
};

const today = localToday; // 按本地日期算「今天」
function loadBows() {
  try {
    const v = JSON.parse(localStorage.getItem('sansa.bows') || 'null');
    if (v && v.date === today()) return Number(v.n) || 0;
  } catch {
    /* 忽略 */
  }
  return 0;
}

// 殿内地砖顶面 baseH + 0.06，蒲团高 0.184；身子坐在蒲团顶上、略压下去一点
const CUSHION_TOP = HALL.baseH + 0.18;
// 长椅、凳子坐在所在地面的高度上（咖啡馆的平台垫高了一点）
const seatY = (s: Seat) => (s.kind === 'cushion' ? CUSHION_TOP : heightAt(s.x, s.z));
const seatPos = (s: Seat) => (s.kind === 'cushion' ? { x: s.x, z: s.z + 0.32 } : { x: s.x, z: s.z });

function angleLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

async function start() {
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  const app = document.getElementById('app')!;
  // 调试：?noui 隐藏所有界面（截干净的游戏画面用）
  if (new URL(location.href).searchParams.has('noui')) document.documentElement.classList.add('noui');
  const isTouch = matchMedia('(pointer: coarse)').matches;
  setRoofDetail(isTouch); // 手机上筒瓦垄距放宽，顶点少一半

  // —— 渲染器与场景 ——
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // 调试：?debugview 时把着色器编译错误和脚本报错写进页面，便于排查
  if (new URL(location.href).searchParams.has('debugview')) {
    const errBox = document.createElement('pre');
    errBox.style.cssText = 'position:fixed;left:8px;top:60px;z-index:99;max-width:60vw;white-space:pre-wrap;background:#300c;color:#fdd;font:11px monospace;padding:4px 8px;pointer-events:none';
    document.body.appendChild(errBox);
    const showErr = (m: string) => {
      errBox.textContent = (errBox.textContent + '\n' + m).slice(-1500);
    };
    addEventListener('error', (e) => showErr('error: ' + e.message));
    addEventListener('unhandledrejection', (e) => showErr('reject: ' + String((e as PromiseRejectionEvent).reason?.stack || (e as PromiseRejectionEvent).reason)));
    renderer.debug.onShaderError = (gl, program, vs, fs) => {
      let box = document.querySelector<HTMLPreElement>('[data-testid="shader-error"]');
      if (!box) {
        box = document.createElement('pre');
        box.dataset.testid = 'shader-error';
        box.hidden = true;
        document.body.appendChild(box);
      }
      if (box.textContent) return;
      box.textContent = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs), (gl.getShaderSource(fs) || '').split('\n').map((l, i) => i + 1 + ': ' + l).join('\n').slice(-6000)].join('\n----\n');
    };
  }
  renderer.domElement.className = 'main';
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let shadowsOn = localStorage.getItem('sansa.shadows') !== '0';
  renderer.shadowMap.enabled = shadowsOn;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.appendChild(renderer.domElement);

  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
  const bootMsg = document.getElementById('boot-msg')!;
  // 贴图、僧人的头、树皮树叶一起在加载画面里下载好
  await Promise.all([
    preloadTextures((d, n) => (bootMsg.textContent = `${t('opening')} · ${Math.round((d / n) * 100)}%`)),
    REAL ? loadHead().catch(() => {}) : Promise.resolve(),
    preloadTreeTextures(),
  ]);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // 室外的环境光由 Environment 用写实天空生成
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 900);

  const post = new PostFX(renderer, scene, camera, isTouch);
  const PR = Math.min(devicePixelRatio, isTouch ? 1.5 : 2);
  post.setSize(innerWidth, innerHeight, PR);
  const env = new Environment(scene, renderer);
  // 金身、铜器的环境反射：夜里跟着天色变暗，不然佛像会在黑夜里白得刺眼
  const goldNight = () => {
    const night = THREE.MathUtils.clamp((env.lanternLevel - 0.6) / 1.8, 0, 1);
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !(m as any).isMeshStandardMaterial || m.envMap !== roomEnv) return;
      m.userData.baseEnvI ??= m.envMapIntensity;
      m.envMapIntensity = m.userData.baseEnvI * (1 - 0.7 * night);
    });
  };
  env.onLook = (l) => {
    post.setLook(l);
    goldNight();
  };
  const timeParam = new URL(location.href).searchParams.get('time') as TimeMode | null;
  env.setMode(timeParam && ['auto', 'dawn', 'day', 'dusk', 'night'].includes(timeParam) ? timeParam : (localStorage.getItem('sansa.time') as TimeMode) || 'auto');
  if (isTouch) env.sun.shadow.mapSize.set(1024, 1024);
  const terrain = buildTerrain(scene);
  const hall = buildHall(scene);
  const nature = buildNature(scene, { renderer, heightAt: terrain.heightAt, size: terrain.size, lite: isTouch });
  const props = buildProps(scene);
  const buildings = buildBuildings(scene);
  const clouds = buildCloudSea(scene);
  const pond = buildPond(scene, { isTouch, lanternFrom: { x: LANTERN_STAND.standX, z: LANTERN_STAND.standZ + 0.9 } });
  const life = buildLife(scene);
  const shrines = buildShrines(scene);
  const cafe = buildCafe(scene);
  const garden = buildGarden(scene, { lite: isTouch });
  const tea = buildTea(scene);
  const distGain = (x: number, z: number) => THREE.MathUtils.clamp(1 - Math.hypot(x - player.x, z - player.z) / 110, 0.15, 1);
  const residents = buildResidents(scene, {
    bell: buildings.bell,
    onBell: () => setTimeout(() => audio.templeBell(distGain(BELL.x, BELL.z)), 1050),
    onQing: () => audio.bell(0.4 * distGain(0, -16)),
    onFeed: (x, z) => pond.feed(x, z),
  });
  const altarIncense = new IncenseSpot(hall.group, ALTAR_BURNER.x, hall.altarSandY, ALTAR_BURNER.z, 0.27, 18, 0.3);
  props.setLanternLevel(env.lanternLevel);
  cafe.setLanternLevel(env.lanternLevel);
  garden.setLanternLevel(env.lanternLevel);
  placeStatues(hall.group, hall.statueSlots, roomEnv);
  // 金身佛像用室内环境光反射
  hall.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && (m as any).isMeshStandardMaterial && m.metalness >= 0.75 && !m.userData.keepEnv) {
      m.envMap = roomEnv;
      m.envMapIntensity = 1.15;
    }
  });

  const walkables: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.name === 'walkable') walkables.push(o);
  });
  const interactives = [...hall.interactives, ...props.interactives, ...buildings.bell.interactives, ...shrines.interactives, ...residents.interactives, ...cafe.interactives, ...garden.interactives, ...tea.interactives, pond.water];
  // 两座配殿：修行到「行者」开观音殿，到「沙弥」开地藏殿
  const sideHalls = furnishSideHalls(buildings.halls, roomEnv);
  interactives.push(...sideHalls.interactives, ...sideHalls.doorHits, ...sideHalls.deskHits);
  const HALL_LEVEL = [PLACE_LEVEL.guanyin, PLACE_LEVEL.dizang, PLACE_LEVEL.library];
  const HALL_NAME = ['hallGuanyin', 'hallDizang', 'placeLibrary'] as const;
  const lampKey = 'sansa.lamps';
  const lampsToday = () => {
    try {
      const v = JSON.parse(localStorage.getItem(lampKey) || 'null');
      return v && v.day === today() ? (v.n as number) : 0;
    } catch {
      return 0;
    }
  };
  sideHalls.setLamps(lampsToday());

  // —— 叠加层与界面 ——
  const stage = new OverlayStage(app);
  const moktakView = new MoktakView(stage.env);
  const rosaryView = new RosaryView(stage.env);
  const net = new Net();

  let name = localStorage.getItem('sansa.name') || randomName();
  localStorage.setItem('sansa.name', name);
  let bowsToday = loadBows();
  let sessionBows = 0;
  let beadCount = 0;
  let moktakCount = 0;
  let moktakAuto = 0;
  let overlay: null | 'moktak' | 'rosary' = null;
  let running = true;
  // 开场标题：调试视角和 ?nointro 时跳过
  const sp0 = new URL(location.href).searchParams;
  let intro = !(sp0.has('debugview') || sp0.has('nointro'));
  const svcShift = sp0.has('svc') ? Number(sp0.get('svc')) - ((Date.now() / 1000) % 3600) : 0;
  loadUiFonts();

  // 衣钵：选好的僧袍和念珠（没到等级的不会被选中）
  let myLook: Look = savedLook(progress.points());
  const applyLook = (m: Monk, l: Look) => m.setLook(ROBES.find((r) => r.id === l.robe) ?? ROBES[0], BEADS.find((b) => b.id === l.beads) ?? BEADS[0]);
  const ui = new UI(app, {
    dock: (k) => {
      if (k === 'bow') toggleBow();
      else if (k === 'hapjang') hapjang();
      else if (k === 'moktak') (overlay === 'moktak' ? closeMoktak() : openMoktak());
      else if (k === 'rosary') (overlay === 'rosary' ? closeRosary() : openRosary());
    },
    toggleSound: async () => {
      if (audio.enabled) audio.disable();
      else await audio.enable();
    },
    toggleChant: async () => {
      if (audio.serviceChanting) {
        audio.serviceChant(false);
        svcMutedHour = Math.floor(svcNow() / 3600000);
        return;
      }
      if (!audio.enabled) await audio.enable();
      if (audio.chanting) audio.stopChant();
      else audio.startChant();
    },
    exit: () => {
      running = false;
      audio.disable();
      net.close();
      closeMoktak();
      closeRosary();
      ui.showFarewell(true);
    },
    stay: () => {
      running = true;
      ui.showFarewell(false);
      net.connect(name, net.room);
      clock.getDelta();
    },
    switchRoom: (id) => {
      ui.toast(t('switching'));
      clearRemotes();
      net.switchRoom(id);
    },
    loadRooms: () => net.rooms(),
    setVolume: (bus, v) => audio.setVolume(bus, v),
    getVolumes: () => audio.volumes,
    setName: (n) => {
      name = n.slice(0, 16);
      localStorage.setItem('sansa.name', name);
      net.setName(name);
      renderMyTag();
    },
    getName: () => name,
    setTime: (m) => {
      localStorage.setItem('sansa.time', m);
      env.setMode(m as TimeMode);
      props.setLanternLevel(env.lanternLevel);
      cafe.setLanternLevel(env.lanternLevel);
      garden.setLanternLevel(env.lanternLevel);
    },
    getTime: () => env.mode,
    setShadows: (on) => {
      shadowsOn = on;
      localStorage.setItem('sansa.shadows', on ? '1' : '0');
      renderer.shadowMap.enabled = on;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
      });
    },
    getShadows: () => shadowsOn,
    setQuality: (q) => post.setQuality(q),
    getQuality: () => post.quality,
    statusAction: () => {
      if (tower) descendPagoda();
      else if (player.seat || claimed) standUp();
    },
    moktakStrike: () => strikeMoktak(),
    moktakAuto: () => toggleMoktakAuto(),
    moktakClose: () => closeMoktak(),
    rosaryClose: () => closeRosary(),
    getLook: () => myLook,
    readSutra: (id) => {
      ui.closePanel();
      reader.show(id);
    },
    dailyGo: (id) => {
      ui.closePanel();
      if (id === 'bow') toggleBow();
      else if (id === 'incense') requestIncense('yard');
      else if (id === 'moktak') openMoktak();
      else if (id === 'beads') openRosary();
      else if (id === 'read') ui.openPractice('sutras');
      else if (id === 'sutra') requestSutra(1);
      else if (id === 'coffee') requestCafe();
    },
    getScript: () => (localStorage.getItem('sansa.script') as 't' | 's' | null) ?? (getLang() === 'zh' ? 's' : 't'),
    setLook: (l) => {
      myLook = savedLook(progress.points());
      const lv = levelOf(progress.points());
      if (ROBES.some((r) => r.id === l.robe && r.lv <= lv)) myLook.robe = l.robe;
      if (BEADS.some((b) => b.id === l.beads && b.lv <= lv)) myLook.beads = l.beads;
      saveLook(myLook);
      applyLook(me, myLook);
    },
    langChanged: () => {
      renderMyTag();
      for (const r of remotes.values()) renderRemoteTag(r);
      refreshStatus();
      ui.setMoktak(!!moktakAuto, moktakCount);
      ui.setRosary(beadCount);
      renderNpcTags();
    },
  });
  audio.onChange(() => ui.setSound(audio.enabled, audio.chanting));
  ui.setRoom(0, 1, 50, false);
  ui.setMoktak(false, 0);
  ui.setRosary(0);

  // —— 玩家 ——
  const me = new Monk();
  scene.add(me.root);
  applyLook(me, myLook);
  const player = {
    x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, y: 0,
    route: [] as { x: number; z: number }[],
    onArrive: null as null | (() => void),
    seat: null as Seat | null,
    stuck: 0,
    dest: null as null | { x: number; z: number },
    replans: 0,
  };
  let claimed: Seat | null = null; // 已向服务器申请、正在走过去的座位
  let intent: null | 'bow' | 'sit' | 'incense' | 'bell' | 'lantern' | 'feed' | 'fortune' | 'climb' | 'desk' | 'cafe' | 'bin' | 'gift' | 'wish' | 'hang' | 'persimmon' = null;
  const keys = new Set<string>();

  const myTag = document.createElement('div');
  myTag.className = 'tag';
  ui.tags.appendChild(myTag);
  function renderMyTag() {
    const lv = LEVELS[levelOf(progress.points())];
    myTag.innerHTML = `<span class="me">${t('me')}</span><span class="title">${t(lv.key as Key)}</span>${escapeHtml(name)}`;
  }
  renderMyTag();

  me.onBowTouch = () => audio.bell(0.32);
  me.onBowDone = () => {
    sessionBows++;
    bowsToday++;
    localStorage.setItem('sansa.bows', JSON.stringify({ date: today(), n: bowsToday }));
    progress.add('bow');
    gain(2);
    award('bow');
    refreshStatus();
  };

  // —— 常住僧人：名字标签、说话气泡、整点共修 ——
  const ROLE_KEY: Record<Role, Key> = {
    sweeper: 'roleSweeper', greeter: 'roleGreeter', elder: 'roleElder', xiangdeng: 'roleXiangdeng', weina: 'roleWeina', bell: 'roleBell', walker: 'roleWalker', novice: 'roleNovice', assembly: 'roleWeina', librarian: 'roleLibrarian', barista: 'roleBarista', waiter: 'roleWaiter',
  };
  const LINES_KEY: Partial<Record<Role, Key>> = { sweeper: 'npcSweeper', greeter: 'npcGreeter', elder: 'npcElder', xiangdeng: 'npcXiangdeng', weina: 'npcWeina', bell: 'npcBell', walker: 'npcWalker', novice: 'npcNovice', librarian: 'npcLibrarian', barista: 'npcBarista', waiter: 'npcWaiter' };
  const npcUi = residents.list
    .filter((r) => r.role !== 'assembly')
    .map((r) => {
      const tag = document.createElement('div');
      tag.className = 'tag npc';
      const bubble = document.createElement('div');
      bubble.className = 'npc-bubble';
      bubble.style.opacity = '0';
      ui.tags.append(tag, bubble);
      return { r, tag, bubble, until: 0, line: 0, label: '' as string | undefined, lastAmbient: -1e9 };
    });
  // 头顶：职名 · 正在做的事
  function npcTagText(n: (typeof npcUi)[number]) {
    const role = t(ROLE_KEY[n.r.role]);
    return n.r.label ? `${role} · ${t(`act_${n.r.label}` as Key)}` : role;
  }
  function renderNpcTags() {
    for (const n of npcUi) {
      n.label = n.r.label;
      n.tag.textContent = npcTagText(n);
    }
  }
  renderNpcTags();
  // who：角色（同角色取第一位）或点中的那位僧人的编号
  function say(who: Role | number, idx?: number) {
    const n = npcUi.find((x) => (typeof who === 'number' ? x.r.id === who : x.r.role === who));
    const role = n?.r.role;
    const key = role && LINES_KEY[role];
    if (!n || !key) return;
    const lines = t(key).split('|');
    const i = idx ?? (role === 'elder' ? n.line++ % lines.length : Math.floor(Math.random() * lines.length));
    n.bubble.textContent = lines[i];
    n.until = performance.now() + 4500;
  }
  // 僧人对你说一句指定的话（寺务）
  function sayText(id: number, text: string) {
    const n = npcUi.find((x) => x.r.id === id);
    if (!n) return;
    n.bubble.textContent = text;
    n.until = performance.now() + 5500;
    n.lastAmbient = performance.now();
  }

  // 僧人做事时自言自语：只在你走得够近时冒一句，每人二十秒内最多一句
  function murmur(id: number, key: string) {
    const n = npcUi.find((x) => x.r.id === id);
    if (!n || intro || overlay) return;
    const m = n.r.monk.root;
    if (!m.visible || Math.hypot(player.x - m.position.x, player.z - m.position.z) > 14) return;
    const now = performance.now();
    if (now - n.lastAmbient < 20000 || now < n.until || Math.random() > 0.75) return;
    n.lastAmbient = now;
    const lines = t(key as Key).split('|');
    n.bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
    n.until = now + 4200;
  }
  // —— 配殿：没开时提示还差多少功德；开了以后礼拜菩萨、点长明灯 ——
  const lastBless = [-1e9, -1e9];
  function hallClick(kind: string, i: number) {
    if (!sideHallOpen[i] || kind === 'hallDoor') {
      const need = HALL_LEVEL[i];
      const left = Math.max(1, LEVELS[need].at - progress.points());
      ui.toast(t('hallLocked', { h: t(HALL_NAME[i]), t: t(LEVELS[need].key as Key), n: left }), 4800);
      return;
    }
    if (player.seat) standUp();
    cancelIntent();
    if (kind === 'hallStatue') {
      const st = sideHalls.statueStand(i);
      walkTo(st.x, st.z, () => {
        player.yaw = st.yaw;
        me.setAction('hapjang');
        setTimeout(() => {
          const lines = t(i === 0 ? 'blessGuanyin' : 'blessDizang').split('|');
          const line = lines[Math.floor(Math.random() * lines.length)];
          floatText(ui.root, innerWidth / 2, innerHeight * 0.36, line, 'levelup');
          audio.bell(0.35);
          if (performance.now() - lastBless[i] > 30000) {
            lastBless[i] = performance.now();
            gain(4);
          }
          if (me.action === 'hapjang') me.setAction(baseAction());
        }, HAPJANG_DURATION * 1000);
      });
    } else {
      const st = sideHalls.lampStand();
      walkTo(st.x, st.z, () => {
        player.yaw = st.yaw;
        const n0 = lampsToday();
        if (n0 >= LAMPS) {
          ui.toast(t('lampFull'), 4000);
          return;
        }
        me.setAction('incense');
        setTimeout(() => {
          const n = Math.min(LAMPS, lampsToday() + 1);
          localStorage.setItem(lampKey, JSON.stringify({ day: today(), n }));
          sideHalls.setLamps(n);
          audio.bell(0.3);
          gain(5);
          ui.toast(t('lampLit', { n, m: LAMPS }), 3600);
        }, 2750);
      });
    }
  }

  // —— 寺务：扫地僧请你扫落叶，小沙弥请你浇树；头上有「！」就是有事找你 ——
  const QUESTS: QuestDef[] = [
    {
      id: 'sweep', giver: residents.ids.sweeper, action: 'sweep', seconds: 3.2, points: 5, reward: 30, icon: '扫',
      targets: ([[-9.8, 29.2], [8.6, 33.2], [-16.6, 40.4]] as const).map(([x, z]) => ({ x, z, standX: x + 0.9, standZ: z + 0.5, yaw: Math.atan2(-0.9, -0.5) })),
    },
    {
      id: 'water', giver: residents.ids.waterNovice, action: 'water', seconds: 3.2, points: 5, reward: 30, icon: '浇',
      targets: ([[-19, 4], [19, 4], [-22, 17]] as const).map(([x, z]) => ({ x, z, standX: x, standZ: z + 1.35, yaw: Math.PI })),
    },
  ];
  const QTEXT = {
    sweep: { ask: 'questSweepAsk', track: 'questSweepTrack', remind: 'questSweepRemind', thanks: 'questSweepThanks', who: 'roleSweeper' },
    water: { ask: 'questWaterAsk', track: 'questWaterTrack', remind: 'questWaterRemind', thanks: 'questWaterThanks', who: 'roleNovice' },
  } as const;
  type QVis = { update(dt: number, time: number): void; done(): void; hit: THREE.Mesh; mark: HTMLElement };
  const qRun = QUESTS.map((q) => {
    const giverMark = document.createElement('div');
    giverMark.className = 'quest-mark giver';
    giverMark.textContent = '！';
    ui.tags.appendChild(giverMark);
    return { q, giverMark, vis: new Map<number, QVis>() };
  });
  const qPill = document.createElement('div');
  qPill.className = 'pill quest-pill';
  qPill.hidden = true;
  ui.leftCol.appendChild(qPill);
  let questWork: { o: (typeof qRun)[number]; i: number; until: number } | null = null;
  function questShow(o: (typeof qRun)[number]) {
    const st = progress.quest(o.q.id);
    if (!st || st.phase !== 'active') return;
    o.q.targets.forEach((tg, i) => {
      if (st.got.includes(i) || o.vis.has(i)) return;
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.4, 12), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(tg.x, 0.7, tg.z);
      hit.userData.interact = { type: 'quest', q: o.q.id, i };
      scene.add(hit);
      interactives.push(hit);
      const mark = document.createElement('div');
      mark.className = 'quest-mark';
      mark.textContent = o.q.icon;
      ui.tags.appendChild(mark);
      let v: QVis;
      if (o.q.action === 'sweep') {
        const pile = leafPile(tg.x, tg.z, i + 3);
        scene.add(pile.group);
        v = { update: (dt) => pile.update(dt), done: () => pile.sweep(), hit, mark };
      } else {
        const ring = waterRing(tg.x, tg.z);
        scene.add(...ring.meshes);
        v = { update: (dt, time) => ring.update(dt, time), done: () => ring.water(), hit, mark };
      }
      o.vis.set(i, v);
    });
  }
  function questPill() {
    for (const o of qRun) {
      const st = progress.quest(o.q.id);
      if (st && st.phase !== 'done') {
        const tx = QTEXT[o.q.id];
        qPill.innerHTML = `<b>${t('questTitle')}</b>${st.phase === 'ready' ? t('questReport', { who: t(tx.who) }) : t(tx.track, { n: st.got.length, m: o.q.targets.length })}`;
        qPill.hidden = false;
        return;
      }
    }
    qPill.hidden = true;
  }
  qRun.forEach(questShow);
  questPill();
  refreshHalls(false);
  // 点到交付寺务的僧人：接活、提醒、或者回禀
  function questNpc(id: number) {
    const o = qRun.find((x) => x.q.giver === id);
    if (!o) return false;
    const st = progress.quest(o.q.id);
    const tx = QTEXT[o.q.id];
    if (st?.phase === 'done') return false;
    if (!st) {
      progress.setQuest(o.q.id, { phase: 'active', got: [] });
      questShow(o);
      sayText(id, t(tx.ask));
      audio.bell(0.25);
    } else if (st.phase === 'ready') {
      progress.setQuest(o.q.id, { phase: 'done', got: st.got });
      sayText(id, t(tx.thanks));
      const m = residents.list[id].monk.root.position;
      gain(o.q.reward, screenOf(m.x, m.y + 1.6, m.z));
      progress.tick('quest');
      audio.bell(0.4);
    } else sayText(id, t(tx.remind));
    questPill();
    return true;
  }
  function questGo(qid: string, i: number) {
    const o = qRun.find((x) => x.q.id === qid);
    const st = o && progress.quest(o.q.id);
    if (!o || !st || st.phase !== 'active' || st.got.includes(i)) return;
    if (player.seat) standUp();
    cancelIntent();
    const tg = o.q.targets[i];
    walkTo(tg.standX, tg.standZ, () => {
      player.yaw = tg.yaw;
      me.setAction(o.q.action);
      questWork = { o, i, until: elapsed + o.q.seconds };
      ui.setStatus('questWorking');
    });
  }
  function questUpdate(dt: number) {
    if (questWork && elapsed >= questWork.until) {
      const { o, i } = questWork;
      questWork = null;
      const st = progress.quest(o.q.id);
      if (st && st.phase === 'active' && !st.got.includes(i)) {
        st.got.push(i);
        const all = st.got.length >= o.q.targets.length;
        progress.setQuest(o.q.id, { phase: all ? 'ready' : 'active', got: st.got });
        const v = o.vis.get(i);
        if (v) {
          v.done();
          v.mark.remove();
          const k = interactives.indexOf(v.hit);
          if (k >= 0) interactives.splice(k, 1);
          scene.remove(v.hit);
        }
        audio.bead();
        gain(o.q.points);
        if (all) ui.toast(t('questReport', { who: t(QTEXT[o.q.id].who) }), 4200);
        questPill();
      }
      if (me.action === o.q.action) me.setAction(baseAction());
      ui.setStatus(null);
    }
    for (const o of qRun) {
      const st = progress.quest(o.q.id);
      // 有事找你（还没接）或者等你回禀：头上一个「！」
      const show = !st || st.phase === 'ready';
      const m = residents.list[o.q.giver].monk.root;
      if (show && m.visible && !overlay && !intro) {
        placeTag(o.giverMark, m.position.x, m.position.y + 2.0 * m.scale.y, m.position.z, 40);
        o.giverMark.classList.toggle('ready', !!st);
      } else o.giverMark.style.opacity = '0';
      for (const [i, v] of o.vis) {
        v.update(dt, elapsed);
        if (st?.phase === 'active' && !st.got.includes(i) && !overlay && !intro) placeTag(v.mark, o.q.targets[i].x, 1.3, o.q.targets[i].z, 45);
        else v.mark.style.opacity = '0';
      }
    }
  }

  const chip = serviceChip(ui.leftCol, () => {
    if (me.action !== 'bow' && intent !== 'bow') toggleBow();
  });
  const svcNow = () => Date.now() + serverOffset + svcShift * 1000;
  let svcMutedHour = -1;
  let svcToastHour = -1;
  let svcJoinedHour = -1;
  let svcTick = 0;
  function updateService(dt: number) {
    svcTick += dt;
    if (svcTick < 0.5) return;
    svcTick = 0;
    const nowMs = svcNow();
    const hourN = Math.floor(nowMs / 3600000);
    const ph = residents.phase((nowMs / 1000) % 3600);
    const bowing = me.action === 'bow' || intent === 'bow';
    if (ph.kind === 'chant') chip.set(t('serviceNow'), bowing ? null : t('serviceGo'));
    else if (ph.kind !== 'idle' && ph.kind !== 'disperse') chip.set(t('serviceSoon', { m: Math.max(1, Math.ceil(ph.toStart / 60)) }), bowing ? null : t('serviceGo'));
    else chip.set(null, null);
    if (intro) return;
    if (ph.kind === 'chant') {
      if (svcToastHour !== hourN) {
        svcToastHour = hourN;
        if (!bowing) ui.toast(t('serviceStarted'), 5200);
      }
      if (me.action === 'bow' && svcJoinedHour !== hourN) {
        svcJoinedHour = hourN;
        progress.add('service');
        ui.toast(t('serviceJoined'), 4200);
        gain(10);
      }
      if (audio.enabled && svcMutedHour !== hourN) audio.serviceChant(true, THREE.MathUtils.clamp(1.1 - Math.hypot(player.x, player.z + 12) / 50, 0.08, 1));
    } else audio.serviceChant(false);
  }

  // —— 寺游印谱：第一次做到某件事时盖一方印 ——
  // 功德点：在人头顶飘一个「功德 +N」；升级时放一声磬、换称号
  const scrV = new THREE.Vector3();
  function screenOf(x: number, y: number, z: number) {
    scrV.set(x, y, z).project(camera);
    return { x: (scrV.x * 0.5 + 0.5) * innerWidth, y: (-scrV.y * 0.5 + 0.5) * innerHeight };
  }
  function gain(n: number, at?: { x: number; y: number }, quiet = false) {
    if (n <= 0) return;
    const r = progress.addPoints(n);
    if (!quiet) {
      const p = at ?? screenOf(player.x, player.y + 1.7, player.z);
      floatText(ui.root, p.x, p.y, t('meritPlus', { n }), 'merit');
    }
    if (r.after > r.before) {
      renderMyTag();
      audio.bell(0.5);
      setTimeout(() => audio.templeBell(0.35), 400);
      const title = t(LEVELS[r.after].key as Key);
      floatText(ui.root, innerWidth / 2, innerHeight * 0.4, t('levelUp', { t: title }), 'levelup');
      ui.toast(t('levelUp', { t: title }), 5000);
      setTimeout(() => refreshHalls(true), 2500);
      // 这一级有新的僧袍或念珠：过一会儿提示去「修行」里换
      const fresh = [
        ...ROBES.filter((x) => x.lv > r.before && x.lv <= r.after).map((x) => t(`robe_${x.id}` as Key)),
        ...BEADS.filter((x) => x.lv > r.before && x.lv <= r.after).map((x) => t(`bead_${x.id}` as Key)),
      ];
      if (fresh.length)
        setTimeout(() => {
          ui.toast(t('newLook', { x: fresh.join('、') }), 5600);
          ui.practiceBtn.classList.add('ping');
          setTimeout(() => ui.practiceBtn.classList.remove('ping'), 900);
        }, 8000);
    }
    refreshPracticeHud();
  }

  function refreshHalls(animate: boolean) {
    const lv = levelOf(progress.points());
    HALL_LEVEL.forEach((need, i) => {
      const o = lv >= need;
      const was = sideHallOpen[i];
      setSideHallOpen(i, o);
      sideHalls.setOpen(i, o, animate);
      // 藏经阁没开放时，知藏师也不露面（头顶的名牌不会被墙挡住）
      if (i === 2) residents.list[residents.ids.librarian].monk.root.visible = o;
      const hit = sideHalls.doorHits[i];
      const k = interactives.indexOf(hit);
      if (o && k >= 0) interactives.splice(k, 1);
      if (!o && k < 0) interactives.push(hit);
      if (o && !was && animate) {
        ui.toast(i === 2 ? t('libraryOpened') : t('hallOpened', { h: t(HALL_NAME[i]) }), 5600);
        setTimeout(() => audio.templeBell(0.45), 600);
      }
    });
  }

  function award(id: SealId) {
    if (!progress.stamp(id)) return;
    sealPop(ui.root, id, ui.sealsBtn);
    audio.bell(0.28);
    ui.refreshSeals();
    if (progress.count() === 12) {
      sealPop(ui.root, id, ui.sealsBtn, true);
      setTimeout(() => audio.templeBell(0.5), 2600);
    }
  }

  function refreshStatus() {
    if (me.action === 'bow') ui.setStatus('bowCount', 'stop', { n: sessionBows + 1 });
    else if (player.seat) ui.setStatus('sit', 'standUp');
    else if (claimed && intent === 'bow') ui.setStatus('walkingToCushion', 'stop');
    else if (claimed) ui.setStatus('walkingToSeat', 'stop');
    else if (intent === 'incense') ui.setStatus('incenseWalking');
    else if (intent === 'bell') ui.setStatus('bellWalking');
    else if (intent === 'lantern') ui.setStatus('statusLantern');
    else if (intent === 'feed') ui.setStatus('statusFeed');
    else if (intent === 'fortune') ui.setStatus('statusFortune');
    else if (tower) ui.setStatus('towerTop', 'towerDown');
    else if (intent === 'climb') ui.setStatus('statusClimb');
    else if (intent === 'desk') ui.setStatus('statusDesk');
    else if (intent === 'cafe') ui.setStatus('statusCafe');
    else if (intent === 'bin') ui.setStatus('statusBin');
    else if (intent === 'gift') ui.setStatus('statusGift');
    else if (intent === 'wish') ui.setStatus('statusWish');
    else if (intent === 'hang') ui.setStatus('statusHang');
    else if (intent === 'persimmon') ui.setStatus('statusPersimmon');
    else ui.setStatus(null);
    ui.setDockActive(overlay ?? (me.action === 'bow' || intent === 'bow' ? 'bow' : null));
  }

  function baseAction(): Action {
    return overlay === 'moktak' ? 'moktak' : overlay === 'rosary' ? 'rosary' : 'idle';
  }

  function walkTo(x: number, z: number, onArrive?: () => void) {
    player.route = planRoute(player.x, player.z, x, z);
    player.onArrive = onArrive ?? null;
    player.stuck = 0;
    player.dest = { x, z };
    player.replans = 0;
  }

  function seatTaken(seat: Seat) {
    for (const r of remotes.values()) if (r.s === seat.id) return true;
    return false;
  }

  const pendingClaims = new Map<string, (ok: boolean) => void>();
  net.on('claim', (seat, ok) => {
    pendingClaims.get(seat)?.(ok);
    pendingClaims.delete(seat);
  });
  function claimSeat(seat: Seat): Promise<boolean> {
    if (seatTaken(seat)) return Promise.resolve(false);
    if (!net.online) return Promise.resolve(true);
    return new Promise((res) => {
      pendingClaims.set(seat.id, res);
      net.claim(seat.id);
      setTimeout(() => {
        if (pendingClaims.has(seat.id)) {
          pendingClaims.delete(seat.id);
          res(true);
        }
      }, 2500);
    });
  }

  function standUp() {
    const s = player.seat ?? null;
    if (s) {
      player.x = s.approachX;
      player.z = s.approachZ;
      player.yaw = s.yaw;
    }
    player.seat = null;
    claimed = null;
    intent = null;
    player.route = [];
    player.onArrive = null;
    net.release();
    me.setAction(baseAction());
    refreshStatus();
  }

  function sitAt(seat: Seat, action: Action) {
    player.seat = seat;
    claimed = null;
    const p = seatPos(seat);
    player.x = p.x;
    player.z = p.z;
    player.yaw = seat.yaw;
    player.route = [];
    if (action === 'bow') sessionBows = 0;
    me.setAction(action);
    refreshStatus();
  }

  async function goToSeat(seat: Seat, action: 'bow' | 'sit') {
    if (player.seat?.id === seat.id) {
      if (action === 'bow' && me.action !== 'bow') sitAt(seat, 'bow');
      return;
    }
    if (player.seat) standUp();
    if (seatTaken(seat)) {
      ui.toast(t(action === 'bow' ? 'findCushionFail' : 'seatTaken'));
      return;
    }
    const ok = await claimSeat(seat);
    if (!ok) {
      ui.toast(t('seatTaken'));
      return;
    }
    claimed = seat;
    intent = action;
    refreshStatus();
    walkTo(seat.approachX, seat.approachZ, () => {
      if (claimed?.id !== seat.id) return;
      sitAt(seat, action === 'bow' ? 'bow' : seat.kind === 'bench' ? 'bench' : 'sit');
    });
  }

  function toggleBow() {
    if (me.action === 'bow' || (intent === 'bow' && claimed)) {
      const s = player.seat;
      if (s && me.action === 'bow' && sessionBows > 0) ui.toast(t('bowDone', { n: sessionBows }));
      standUp();
      return;
    }
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    if (player.seat?.kind === 'cushion') {
      sitAt(player.seat, 'bow');
      return;
    }
    const free = CUSHIONS.filter((c) => !seatTaken(c));
    if (!free.length) {
      ui.toast(t('findCushionFail'));
      return;
    }
    free.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    goToSeat(free[0], 'bow');
  }

  function hapjang() {
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    player.route = [];
    me.setAction('hapjang');
    setTimeout(() => {
      if (me.action === 'hapjang') me.setAction(baseAction());
    }, HAPJANG_DURATION * 1000);
  }

  // —— 上香（院中大香炉、佛前小香炉）——
  let incenseList: IncenseItem[] = [];
  let serverOffset = 0;
  const myIncenseOwner = () => net.id || 'me';
  function refreshIncense() {
    const now = Date.now() + serverOffset;
    incenseList = incenseList.filter((i) => i.until > now);
    const view = (place: IncensePlace) =>
      incenseList.filter((i) => (i.place ?? 'yard') === place).map((i) => ({ id: i.id, mine: i.owner === myIncenseOwner(), remain: (i.until - now) / (i.until - i.start) }));
    props.setIncense(view('yard'));
    altarIncense.set(view('altar'));
  }
  net.on('incense', (list, now) => {
    serverOffset = now - Date.now();
    incenseList = list;
    refreshIncense();
  });
  setInterval(refreshIncense, 2000);

  // 上香时的特写镜头：在香炉斜前方，略高于小和尚，看向双手与香炉之间
  const cine = { on: false, blend: 0, pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let cineMode: null | 'incense' | 'lantern' | 'intro' | 'tower' = null;
  const cineValid = () => (cineMode === 'intro' ? intro : cineMode === 'tower' ? !!tower : cineMode !== null && me.action === cineMode);

  // —— 登塔：走到塔门前，黑一下，人就在塔顶檐下了；拖动环顾，云海在脚下。点「下塔」回到塔门前 ——
  let tower: null | { i: number } = null;
  const fadeEl = document.createElement('div');
  fadeEl.className = 'fade-black';
  ui.root.appendChild(fadeEl);
  const pagodaDoor = (i: number) => {
    const P = PAGODAS[i];
    const dir = P.x < 0 ? 1 : -1;
    // 塔门前三级石阶外沿在本地半径 2.62 处，再往外站一点
    return { x: P.x + dir * (2.62 * 0.75 * P.s + 0.65), z: P.z, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2 };
  };
  function requestClimb(i: number) {
    if (tower) return;
    const lv = levelOf(progress.points());
    if (lv < PLACE_LEVEL.pagoda) {
      const need = LEVELS[PLACE_LEVEL.pagoda];
      ui.toast(t('placeLocked', { t: t(need.key as Key), h: t('placePagoda'), n: Math.max(1, need.at - progress.points()) }), 4800);
      return;
    }
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    intent = 'climb';
    refreshStatus();
    const d = pagodaDoor(i);
    walkTo(d.x, d.z, () => {
      intent = null;
      player.x = d.x;
      player.z = d.z;
      player.yaw = d.yaw;
      fadeEl.classList.add('on');
      setTimeout(() => {
        tower = { i };
        me.root.visible = false;
        cineMode = 'tower';
        cine.on = true;
        cine.blend = 1;
        // 先朝山门和前山看（略偏向塔外侧），微微低头，看得到脚下的云
        cam.yaw = PAGODAS[i].x < 0 ? 2.84 : -2.84;
        cam.pitch = 0.5;
        // 调试：&tyaw=朝向&tpitch=俯仰 指定塔顶的视线
        const dsp = new URL(location.href).searchParams;
        if (dsp.has('debugview') && dsp.has('tyaw')) cam.yaw = Number(dsp.get('tyaw'));
        if (dsp.has('debugview') && dsp.has('tpitch')) cam.pitch = Number(dsp.get('tpitch'));
        refreshStatus();
        fadeEl.classList.remove('on');
        audio.templeBell(0.25);
        if (localStorage.getItem('sansa.climb') !== localToday()) {
          localStorage.setItem('sansa.climb', localToday());
          setTimeout(() => {
            ui.toast(t('towerFirst'), 5200);
            gain(15, { x: innerWidth / 2, y: innerHeight * 0.45 });
          }, 2600);
        }
      }, 650);
    });
  }
  // —— 抄经：点经案，走过去坐下，铺开纸抄《心经》（电脑上打字，手机上描） ——
  // 调试：?debugview&sutramode=type|brush 指定抄经方式
  {
    const sp0 = new URL(location.href).searchParams;
    const m0 = sp0.get('sutramode');
    if (sp0.has('debugview') && (m0 === 'type' || m0 === 'brush')) localStorage.setItem('sansa.sutra.mode', m0);
  }
  const sutra = new SutraCopy(ui.root, {
    onChar: (grade, at) => {
      progress.add('sutra');
      // 键盘打一个字 1 点；毛笔描一个字按描得好坏 2–4 点
      gain(grade === 'typed' ? 1 : grade === 'perfect' ? 4 : grade === 'good' ? 3 : 2, at);
      if (grade === 'perfect') audio.bell(0.16);
    },
    onLine: () => {
      setTimeout(() => {
        audio.bell(0.3);
        ui.toast(t('sutraLineDone'), 2400);
        gain(5, { x: innerWidth / 2, y: innerHeight * 0.18 });
      }, 300);
    },
    onRound: () => {
      setTimeout(() => {
        audio.templeBell(0.5);
        ui.toast(t('sutraRoundDone'), 6000);
        gain(100, { x: innerWidth / 2, y: innerHeight * 0.3 });
      }, 900);
    },
    onClose: () => {
      if (me.action === 'sit' && !player.seat) me.setAction('idle');
      refreshStatus();
    },
    getName: () => name,
  });
  sutra.onBrush = () => audio.brush();
  // —— 经藏：读经。一页读过今天第一次给 1 功德（每天前 40 页），读完一部 10，第一次读完 30 ——
  const reader = new Reader(
    ui.root,
    {
      onPage: (first) => {
        progress.tick('read');
        if (first && progress.today('read') <= 40) gain(1, { x: innerWidth / 2, y: innerHeight * 0.14 });
      },
      onFinish: (first, n, title) => {
        audio.bell(0.35);
        ui.toast(first ? t('readFinishFirst', { s: title }) : t('readFinish', { s: title, n }), 4600);
        gain(first ? 30 : 10, { x: innerWidth / 2, y: innerHeight * 0.3 });
      },
      onClose: () => ui.refreshPractice(),
    },
    getLang() === 'zh'
  );

  // —— 半山咖啡：东院茶寮点一杯；分三口喝；满杯可以请人喝（常住僧人或别的访客）；空杯放回收桶 ——
  let cup: { d: DrinkId; sips: number; from?: string } | null = null;
  let brewing = false;
  let pendingGift: { id: string; d: DrinkId } | null = null;
  // —— 围炉煮茶：坐到炉边以后，喝茶（常住僧人那套端杯喝茶的动作）、烤橘子柿子栗子，烤好了吃掉 ——
  const teaUI = new TeaUI(ui.root, {
    drink: () => {
      if (!player.seat?.id.startsWith('t')) return;
      me.setAction(me.action === 'tea' ? 'bench' : 'tea');
    },
    drinking: () => me.action === 'tea',
    roast: (kind) => {
      const slot = tea.roast(kind);
      if (slot < 0) {
        ui.toast(t('roastFull'));
        return;
      }
      ui.toast(t('roastPut', { n: ROAST_SECONDS }));
      setTimeout(() => {
        if (tea.ready(slot) && teaUI.shown) teaUI.addReady(slot, kind);
      }, ROAST_SECONDS * 1000 + 100);
    },
    eat: (slot) => {
      tea.take(slot);
      floatText(ui.root, innerWidth / 2, innerHeight * 0.42, t('roastAte'), 'merit');
      gain(2);
    },
  });

  // —— 拍立得打卡：右上角相机；倒数时小和尚转身面向镜头，拍下画面（不带界面），印成拍立得，收进打卡册 ——
  let grabFrame: ((c: HTMLCanvasElement) => void) | null = null;
  new PolaroidUI(ui.root, {
    name: () => name,
    where: () => ({ x: player.x, z: player.z }),
    pose: () => {
      if (me.action === 'idle' && !player.seat) player.yaw = Math.atan2(camera.position.x - player.x, camera.position.z - player.z);
    },
    grab: (cb) => (grabFrame = cb),
    shutter: () => audio.shutter(),
  }, ui.dockExtra);

  // —— 耳机电台：右上角选台；戴上耳机的小和尚跟着拍子点头，别人也看得到耳机 ——
  const radio = new Radio(audio);
  mountRadioUI(ui.root, radio, (st: StationId | null) => {
    me.setHeadphones(st);
    me.beatClock = st ? () => radio.beats() : null;
    if (st) ui.toast(t('radioOn', { x: t(`station_${st}` as Key) }));
  }, { slot: ui.dockExtra, chant: ui.chantBtn });

  const cafeUI = new CafeUI(ui.root, {
    choose: (d) => brewCoffee(d),
    sip: () => sipCup(),
    recycle: () => requestBin(),
    close: () => refreshStatus(),
    getName: () => name,
  });
  function setCup(c: typeof cup) {
    cup = c;
    me.setCup(c?.d ?? null, c?.sips ?? 0);
    cafeUI.setCup(c);
  }
  const drinkName = (d: DrinkId) => t(`drink_${d}` as Key);
  // 先放下手上的事：起身、收起木鱼念珠
  function freeHands() {
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
  }
  function requestCafe() {
    if (brewing || cafeUI.open) return;
    if (cup) {
      if (cup.sips > 0) ui.toast(t('cupHave'));
      else requestBin();
      return;
    }
    freeHands();
    intent = 'cafe';
    refreshStatus();
    walkTo(CAFE_STAND.x, CAFE_STAND.z, () => {
      intent = null;
      player.yaw = CAFE.yaw + Math.PI;
      refreshStatus();
      say('barista');
      cafeUI.openMenu();
    });
  }
  function brewCoffee(d: DrinkId) {
    if (brewing || cup) return;
    brewing = true;
    cafeUI.showBrewing(d, BREW_MS);
    cafe.setBrewing(true);
    audio.coffeeGrind();
    setTimeout(() => audio.coffeePour(), 2200);
    setTimeout(() => {
      brewing = false;
      cafe.setBrewing(false);
      cafeUI.closeMenu();
      setCup({ d, sips: SIPS });
      audio.bell(0.18);
      ui.toast(t('coffeeReady', { x: drinkName(d) }), 3600);
      refreshStatus();
    }, BREW_MS);
  }
  const CAN_SIP: Action[] = ['idle', 'walk', 'bench', 'hapjang'];
  function sipCup() {
    if (!cup || cup.sips <= 0 || me.sipping) return;
    if (!CAN_SIP.includes(me.action)) {
      ui.toast(t('cupNotNow'));
      return;
    }
    me.sip();
    cafeUI.setBusy(true);
    setTimeout(() => audio.sip(), 700);
    setTimeout(() => {
      cafeUI.setBusy(false);
      if (!cup || cup.sips <= 0) return;
      cup.sips--;
      const d = cup.d;
      setCup(cup);
      if (cup.sips === 0) {
        progress.tick('coffee');
        setTimeout(() => ui.toast(t(`drinkDone_${d}` as Key), 4200), 600);
      }
    }, 1300);
  }
  function requestBin() {
    if (!cup) return;
    if (cup.sips > 0) {
      ui.toast(t('cupNotDone'));
      return;
    }
    freeHands();
    intent = 'bin';
    refreshStatus();
    walkTo(CAFE_BIN_STAND.x, CAFE_BIN_STAND.z, () => {
      intent = null;
      player.yaw = Math.atan2(CAFE_BIN.x - player.x, CAFE_BIN.z - player.z);
      me.offer();
      setTimeout(() => {
        setCup(null);
        audio.bead();
        gain(1);
        ui.toast(t('cupRecycled'));
        refreshStatus();
      }, 800);
    });
  }
  // 请人喝：走到对方跟前一步远，双手递过去
  function approach(x: number, z: number, done: () => void) {
    const dx = player.x - x, dz = player.z - z, d = Math.hypot(dx, dz) || 1;
    freeHands();
    intent = 'gift';
    refreshStatus();
    walkTo(x + (dx / d) * 1.05, z + (dz / d) * 1.05, () => {
      intent = null;
      refreshStatus();
      done();
    });
  }
  function canGift() {
    if (!cup) return false;
    if (cup.sips < SIPS) {
      ui.toast(t('giftNeedFull'));
      return false;
    }
    return true;
  }
  function giftNpc(id: number) {
    if (!canGift()) return;
    const r = residents.list[id];
    approach(r.monk.root.position.x, r.monk.root.position.z, () => {
      const p = r.monk.root.position;
      if (!cup || Math.hypot(p.x - player.x, p.z - player.z) > 2.6) {
        ui.toast(t('giftFail'));
        return;
      }
      player.yaw = Math.atan2(p.x - player.x, p.z - player.z);
      me.offer();
      const d = cup.d;
      setTimeout(() => {
        setCup(null);
        const lines = t('npcThanks').split('|');
        sayText(id, lines[Math.floor(Math.random() * lines.length)]);
        gain(8);
        audio.bell(0.22);
        ui.toast(t('giftGave', { n: t(ROLE_KEY[r.role]), x: drinkName(d) }), 4200);
      }, 1000);
    });
  }
  function giftRemote(id: string) {
    if (!canGift()) return;
    const r = remotes.get(id);
    if (!r) return;
    if (r.c) {
      ui.toast(t('giftTheyHave'));
      return;
    }
    approach(r.x, r.z, () => {
      const q = remotes.get(id);
      if (!cup || !q) return;
      player.yaw = Math.atan2(q.x - player.x, q.z - player.z);
      me.offer();
      pendingGift = { id, d: cup.d };
      setTimeout(() => net.give(id), 800);
      setTimeout(() => {
        if (pendingGift?.id !== id) return;
        pendingGift = null;
        ui.toast(t('giftFail'));
      }, 5000);
    });
  }
  net.on('gave', (to, ok, why) => {
    if (!pendingGift || pendingGift.id !== to) return;
    const d = pendingGift.d;
    pendingGift = null;
    if (!ok) {
      ui.toast(t(why === 'has' ? 'giftTheyHave' : 'giftFail'));
      return;
    }
    setCup(null);
    gain(8);
    audio.bell(0.22);
    ui.toast(t('giftGave', { n: remotes.get(to)?.name ?? '', x: drinkName(d) }), 4200);
  });
  net.on('gift', (_from, nm, code) => {
    const c = parseCup(code);
    if (!c) return;
    setCup({ d: c.d, sips: c.sips, from: nm });
    audio.bell(0.3);
    ui.toast(t('giftGot', { n: nm, x: drinkName(c.d) }), 5200);
  });

  // —— 祈福灯廊：每天挂一盏灯、写一句心愿；点别人的灯看心愿，可以随喜、举报 ——
  const wishMap = new Map<string, Wish>();
  for (const w of wishStore.mine()) wishMap.set(w.id, { ...w, mine: true });
  let hookWish = new Map<number, Wish>();
  const wishOrder = (list: Wish[]) => {
    const hidden = new Set(wishStore.hidden());
    return list.filter((w) => !hidden.has(w.id)).sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.at - a.at);
  };
  function refreshLanterns() {
    hookWish = assignHooks(wishOrder([...wishMap.values()]), garden.hooks.length).used;
    garden.setLanterns([...hookWish].map(([hook, w]) => ({ hook, color: w.c, tag: w.mine ? 2 : 1 })));
  }
  refreshLanterns();
  const mineIds = () => new Set(wishStore.mine().map((w) => w.id));
  net.on('wishes', (list) => {
    const mine = mineIds();
    for (const [id, w] of wishMap) if (!w.mine) wishMap.delete(id);
    for (const m of list) wishMap.set(m.id, { ...m, mine: mine.has(m.id) });
    refreshLanterns();
    // 服务器上没有的自己的心愿（服务器重启过）补交回去
    const missing = wishStore.mine().filter((w) => !list.some((m) => m.id === w.id));
    if (missing.length) net.wishBack(missing.slice(0, 3).map(({ id, text, c, k, at }) => ({ id, text, c, k, at })));
  });
  net.on('wishAdd', (m) => {
    const old = wishMap.get(m.id);
    wishMap.set(m.id, { ...m, mine: mineIds().has(m.id), likes: Math.max(m.likes, old?.likes ?? 0) });
    refreshLanterns();
  });
  net.on('wishDel', (id) => {
    const w = wishMap.get(id);
    if (!w || w.mine) return;
    wishMap.delete(id);
    refreshLanterns();
  });
  net.on('wishLike', (id, n) => {
    const w = wishMap.get(id);
    if (w) w.likes = n;
  });
  const wishUI = new WishUI(ui.root, {
    hang: (k, c, text) => hangWish(k, c, text),
    like: (w) => {
      net.like(w.id);
      wishStore.like(w.id);
      gain(1);
      ui.toast(t('wishLikedToast'));
    },
    report: (w) => {
      net.report(w.id);
      wishStore.hide(w.id);
      refreshLanterns();
      ui.toast(t('wishReported'));
    },
  });
  function requestWish() {
    if (wishUI.open) return;
    if (wishStore.hungToday(localToday())) {
      ui.toast(t('wishDoneToday'));
      return;
    }
    freeHands();
    intent = 'wish';
    refreshStatus();
    walkTo(WISH_DESK_STAND.x, WISH_DESK_STAND.z, () => {
      intent = null;
      player.yaw = -Math.PI / 2;
      refreshStatus();
      wishUI.compose();
    });
  }
  // 挂灯：先算好挂在哪个位置，走到那盏灯底下，举起来，灯自己升上去
  function hangWish(k: number, c: number, text: string) {
    wishUI.close();
    const w: Wish = { id: newWishId(), by: name, text, c, k, at: Date.now(), likes: 0, mine: true };
    const hook = assignHooks(wishOrder([w, ...wishMap.values()]), garden.hooks.length).hookOf.get(w.id) ?? 0;
    const hk = garden.hooks[hook];
    freeHands();
    intent = 'hang';
    refreshStatus();
    walkTo(hk.stand.x, hk.stand.z, () => {
      intent = null;
      player.yaw = Math.atan2(hk.x - player.x, hk.z - player.z);
      me.onHangRelease = () => {
        wishMap.set(w.id, w);
        wishStore.addMine(w);
        wishStore.markToday(localToday());
        refreshLanterns();
        garden.rise(hook, new THREE.Vector3(player.x + Math.sin(player.yaw) * 0.25, player.y + 1.45, player.z + Math.cos(player.yaw) * 0.25));
        net.wish({ id: w.id, text: w.text, c: w.c, k: w.k });
        audio.bell(0.25);
        award('wish');
      };
      me.setAction('hang', true);
      refreshStatus();
      setTimeout(() => {
        if (me.action === 'hang') me.setAction(baseAction());
        ui.toast(t('wishHung'), 4200);
        gain(5);
      }, HANG_DURATION * 1000 + 100);
    });
  }
  function readLantern(hook: number) {
    const w = hookWish.get(hook);
    if (!w) {
      ui.toast(t('wishTemple'), 4200);
      return;
    }
    wishUI.show(w, wishStore.liked().includes(w.id));
  }
  // 柿饼架：合十，得一句「柿柿如意」；每天第一次有功德
  function requestPersimmon() {
    freeHands();
    intent = 'persimmon';
    refreshStatus();
    walkTo(PERSIMMON_STAND.x, PERSIMMON_STAND.z, () => {
      intent = null;
      player.yaw = Math.PI;
      refreshStatus();
      me.setAction('hapjang', true);
      setTimeout(() => {
        if (me.action === 'hapjang') me.setAction(baseAction());
      }, HAPJANG_DURATION * 1000);
      const lines = t('persimmonLines').split('|');
      const line = lines[Math.floor(Math.random() * lines.length)];
      setTimeout(() => {
        floatText(ui.root, innerWidth / 2, innerHeight * 0.36, line, 'levelup');
        ui.toast(t('persimmonSub'), 4200);
        audio.bell(0.2);
        if (localStorage.getItem('sansa.persimmon') !== localToday()) {
          localStorage.setItem('sansa.persimmon', localToday());
          gain(3);
        }
      }, 900);
    });
  }

  // —— 今日功课：每秒看一次做满了没有；做满的给功德、放提示；左上角的进度条跟着刷新 ——
  let dailySig = '';
  function refreshPracticeHud() {
    const pts = progress.points();
    const lv = levelOf(pts);
    const next = LEVELS[lv + 1];
    const tasks = DAILY.filter((q) => (q.lv ?? 0) <= lv);
    ui.setPractice({
      title: t(LEVELS[lv].key as Key),
      pts,
      k: next ? (pts - LEVELS[lv].at) / (next.at - LEVELS[lv].at) : 1,
      daily: tasks.filter((q) => progress.dailyGot(q.id) || progress.today(q.id) >= q.need).length,
      dailyAll: tasks.length,
    });
  }
  function checkDaily() {
    const lv = levelOf(progress.points());
    const got = progress.claimDaily(lv);
    got.forEach((g, i) =>
      setTimeout(() => {
        audio.bell(0.25);
        ui.toast(g.id === 'all' ? t('dailyAllDone', { n: g.reward }) : t('dailyGot', { x: t(`daily_${g.id}` as Key), n: g.reward }), 3800);
        gain(g.reward, { x: 120, y: 90 });
      }, i * 1600)
    );
    const sig = DAILY.map((q) => progress.today(q.id)).join(',') + '|' + progress.points();
    if (sig !== dailySig) {
      dailySig = sig;
      refreshPracticeHud();
      if (got.length || !reader.open) ui.refreshPractice();
    }
  }
  setInterval(checkDaily, 1000);
  refreshPracticeHud();

  function requestSutra(k: number) {
    if (!sideHallOpen[2]) {
      hallClick('hallDoor', 2);
      return;
    }
    const seat = sideHalls.deskSeat(k);
    for (const r of remotes.values())
      if (Math.hypot(r.x - seat.x, r.z - seat.z) < 0.5 && r.a === 'sit') {
        ui.toast(t('sutraDeskTaken'));
        return;
      }
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    intent = 'desk';
    refreshStatus();
    walkTo(seat.x, seat.z, () => {
      intent = null;
      player.x = seat.x;
      player.z = seat.z;
      player.yaw = seat.yaw;
      me.setAction('sit');
      refreshStatus();
      sutra.show();
    });
  }

  function descendPagoda() {
    if (!tower) return;
    fadeEl.classList.add('on');
    setTimeout(() => {
      tower = null;
      me.root.visible = true;
      cine.on = false;
      cine.blend = 0;
      cineMode = null;
      cam.pitch = 0.3;
      refreshStatus();
      fadeEl.classList.remove('on');
    }, 650);
  }
  function endIncenseScene() {
    cine.on = false;
    cineMode = null;
    ui.showCaption(null);
    ui.root.classList.remove('cine');
  }

  if (intro) {
    ui.root.classList.add('intro');
    cineMode = 'intro';
    cine.on = true;
    cine.blend = 1;
  }
  function enterTemple() {
    intro = false;
    ui.root.classList.remove('intro');
    endIncenseScene();
    if (!audio.enabled) audio.enable();
    progress.visit();
    ui.replayHint();
    setTimeout(() => award('gate'), 1600);
    setTimeout(() => {
      if (progress.count() < 12 && !overlay) ui.toast(t('sealsHint'), 6500);
    }, 14000);
  }

  function requestIncense(place: IncensePlace) {
    const now = Date.now() + serverOffset;
    if (incenseList.some((i) => i.owner === myIncenseOwner() && (i.place ?? 'yard') === place && i.until > now)) {
      ui.toast(t('incenseBurning'));
      return;
    }
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    intent = 'incense';
    refreshStatus();
    const spot = place === 'altar' ? ALTAR_SPOT : { x: INCENSE.x, z: INCENSE.z + 1.9 };
    const burner = place === 'altar' ? { x: ALTAR_BURNER.x, y: hall.altarSandY, z: ALTAR_BURNER.z } : { x: INCENSE.x, y: 1.2, z: INCENSE.z };
    walkTo(spot.x, spot.z, () => {
      intent = null;
      player.x = spot.x;
      player.z = spot.z;
      player.yaw = Math.PI;
      me.onIncensePlant = () => {
        if (net.online) net.offerIncense(place);
        else {
          const t0 = Date.now();
          incenseList.push({ id: 'local' + t0, by: name, owner: 'me', start: t0, until: t0 + 180000, place });
          refreshIncense();
        }
        audio.bell(0.45);
      };
      me.setAction('incense');
      refreshStatus();
      // 镜头：从香炉的右后方回看小和尚
      const fy = heightAt(spot.x, spot.z);
      if (place === 'altar') cine.pos.set(HALL.tableX1 + 1.05, fy + 1.5, burner.z + 0.15);
      else cine.pos.set(burner.x + 2.15, fy + 2.35, burner.z - 1.45); // 大鼎口沿高 1.4 m：镜头要高过口沿，才看得到香灰和人
      cine.look.set((burner.x + spot.x) / 2, (burner.y + fy + 0.9) / 2, (burner.z + spot.z) / 2 + 0.1);
      cine.on = true;
      cineMode = 'incense';
      ui.root.classList.add('cine');
      ui.showCaption(t('incenseTitle'), t('incenseSub'));
    });
  }
  // 上香动作做完：回到原来的状态、镜头拉回
  function checkIncenseDone() {
    if (me.action === 'incense' && me.actionTime >= INCENSE_DURATION) {
      me.setAction(baseAction());
      endIncenseScene();
      ui.toast(t('incenseOffered'), 3600);
      gain(5);
      progress.add('incense');
      award('incense');
    }
  }

  // —— 放河灯：走到池边的河灯台，捧灯跪下，把灯放进水里 ——
  let lanternList: LanternMsg[] = [];
  let lanternOffset = 0;
  const pushLanterns = () =>
    pond.setLanterns(
      lanternList.map((l) => ({ id: l.id, seed: l.seed, start: l.start, until: l.until, mine: l.owner === (net.id || 'me') })),
      Date.now() + lanternOffset
    );
  net.on('lanterns', (list, now) => {
    lanternOffset = now - Date.now();
    lanternList = list;
    pushLanterns();
  });
  function requestLantern() {
    const now = Date.now() + lanternOffset;
    if (lanternList.some((l) => l.owner === (net.id || 'me') && l.until > now)) {
      ui.toast(t('lanternFloating'));
      return;
    }
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    intent = 'lantern';
    refreshStatus();
    walkTo(LANTERN_STAND.standX, LANTERN_STAND.standZ, () => {
      intent = null;
      player.x = LANTERN_STAND.standX;
      player.z = LANTERN_STAND.standZ;
      player.yaw = LANTERN_STAND.yaw;
      me.onLanternRelease = () => {
        if (net.online) net.floatLantern();
        else {
          const t0 = Date.now();
          lanternList = [...lanternList, { id: 'local' + t0, by: name, owner: 'me', seed: Math.random(), start: t0, until: t0 + 8 * 60000 }];
          pushLanterns();
        }
        pond.lanternDrop();
        audio.bead();
      };
      me.setAction('lantern');
      refreshStatus();
      // 镜头：从水面上低低地回望岸边
      const fy = heightAt(player.x, player.z);
      cine.pos.set(player.x + 2.4, fy + 1.05, player.z + 3.4);
      cine.look.set(player.x, fy + 0.45, player.z + 0.5);
      cine.on = true;
      cineMode = 'lantern';
      ui.root.classList.add('cine');
      ui.showCaption(t('lanternTitle'), t('lanternSub'));
    });
  }

  // —— 喂锦鲤：走到离点中位置最近的岸边，把鱼食撒出去 ——
  function bankPoint(px: number, pz: number) {
    let a = Math.atan2((pz - POND.z) / POND.rz, (px - POND.x) / POND.rx);
    let x = POND.x + Math.cos(a) * (POND.rx + 0.75);
    let z = POND.z + Math.sin(a) * (POND.rz + 0.75);
    // 不要站在桥头正中
    if (Math.abs(x) < 2.6) {
      a += x >= 0 ? 0.35 : -0.35;
      x = POND.x + Math.cos(a) * (POND.rx + 0.75);
      z = POND.z + Math.sin(a) * (POND.rz + 0.75);
    }
    return { x, z };
  }
  function requestFeed(px: number, pz: number) {
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    const k = Math.hypot((px - POND.x) / POND.rx, (pz - POND.z) / POND.rz);
    if (k > 0.88) {
      px = POND.x + ((px - POND.x) / k) * 0.88;
      pz = POND.z + ((pz - POND.z) / k) * 0.88;
    }
    const near = Math.hypot((player.x - POND.x) / (POND.rx + 1.6), (player.z - POND.z) / (POND.rz + 1.6)) < 1;
    const toss = () => {
      intent = null;
      player.yaw = Math.atan2(px - player.x, pz - player.z);
      me.onFeedToss = () => {
        pond.feed(px, pz);
        audio.bead();
        progress.add('koi');
        award('koi');
        setTimeout(() => ui.toast(t('feedDone')), 900);
        gain(2);
      };
      me.setAction('feed');
      refreshStatus();
    };
    intent = 'feed';
    refreshStatus();
    if (near) toss();
    else {
      const b = bankPoint(px, pz);
      walkTo(b.x, b.z, toss);
    }
  }

  // —— 求签：观音殿前，摇签筒，掉出一支签；一天一支 ——
  let fortuneOpen = false;
  function requestFortune() {
    const done = progress.fortuneToday();
    if (done !== null) {
      fortuneOpen = true;
      showFortune(ui.root, done, true, getLang()).then(() => (fortuneOpen = false));
      return;
    }
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    intent = 'fortune';
    refreshStatus();
    walkTo(FORTUNE.standX, FORTUNE.standZ, () => {
      intent = null;
      player.x = FORTUNE.standX;
      player.z = FORTUNE.standZ;
      player.yaw = FORTUNE.yaw;
      ui.showCaption(t('fortuneTitle'), t('fortuneSub'));
      me.onFortuneDrop = () => {
        audio.moktak('effects', 0, 0.35);
        const n = Math.floor(Math.random() * LOTS.length);
        progress.setFortune(n);
        setTimeout(() => {
          ui.showCaption(null);
          fortuneOpen = true;
          showFortune(ui.root, n, false, getLang()).then(() => {
            fortuneOpen = false;
            award('fortune');
            gain(2);
          });
        }, 900);
      };
      me.setAction('fortune');
      refreshStatus();
    });
  }
  // 新动作做完：回到原来的状态
  function checkNewActionsDone() {
    if (me.action === 'lantern' && me.actionTime >= LANTERN_DURATION) {
      me.setAction(baseAction());
      endIncenseScene();
      ui.toast(t('lanternReleased'), 4200);
      gain(6);
      progress.add('lantern');
      award('lantern');
    } else if (me.action === 'feed' && me.actionTime >= FEED_DURATION) me.setAction(baseAction());
    else if (me.action === 'fortune' && me.actionTime >= FORTUNE_DURATION) me.setAction(baseAction());
  }

  // —— 钟楼：撞钟 ——
  let lastBell = 0;
  // 钟楼撞钟，同房间的人也会听到（2026-11-19 去掉了鼓楼击鼓，钟和鼓只留钟）
  const lastStrike = { bell: -1e9 };
  function strikeInstrument() {
    if (performance.now() - lastStrike.bell < 15000) {
      ui.toast(t('bellCooldown'));
      return;
    }
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    intent = 'bell';
    refreshStatus();
    const b = buildings.bell;
    walkTo(b.standX, b.standZ, () => {
      intent = null;
      player.yaw = b.standYaw;
      // 撞钟要自己拉：按住拉撞木，松手撞
      me.setAction('hapjang');
      charge.open();
      refreshStatus();
    });
  }
  // 松手：落在金色区间最好，钟声最洪亮、传得最远
  const charge = new Charge(ui.root, {
    onRelease(q) {
      const b = buildings.bell;
      lastStrike.bell = performance.now();
      b.aim?.(0);
      b.strike();
      progress.add('bell');
      award('bell');
      setTimeout(() => {
        audio.templeBell(0.4 + 0.6 * q);
        net.ringBell();
      }, 700);
      const li = Math.round(2 + q * 16);
      const at = { x: innerWidth / 2, y: innerHeight * 0.42 };
      floatText(ui.root, at.x, at.y, t(q > 0.95 ? 'bellGreat' : 'bellResult', { n: li }), q > 0.95 ? 'levelup' : 'merit');
      setTimeout(() => gain(Math.round(4 + q * 16)), 600);
      setTimeout(() => {
        if (me.action === 'hapjang') me.setAction(baseAction());
      }, 1500);
    },
    onCancel() {
      buildings.bell.aim?.(0);
      if (me.action === 'hapjang') me.setAction(baseAction());
    },
  });

  net.on('bell', () => {
    buildings.bell.strike();
    setTimeout(() => audio.templeBell(0.6), 1050);
  });

  // —— 木鱼 ——
  const rhythm = new Rhythm(ui.root);
  function openMoktak() {
    rhythm.start();
    if (overlay === 'rosary') closeRosary();
    if (me.action === 'bow') standUp();
    overlay = 'moktak';
    stage.show(moktakView);
    ui.showMoktak(true);
    if (!player.seat) me.setAction('moktak');
    if (!audio.enabled) ui.toast(t('soundNeeded'));
    refreshStatus();
  }
  function closeMoktak() {
    if (overlay !== 'moktak') return;
    overlay = null;
    rhythm.stop();
    if (moktakAuto) toggleMoktakAuto();
    stage.show(null);
    ui.showMoktak(false);
    if (me.action === 'moktak') me.setAction('idle');
    refreshStatus();
  }
  // 手敲：跟着圆环收拢的拍子敲，准了是「妙」，连击越多功德越多；自动敲只计数、不计功德点
  function strikeMoktak(auto = false) {
    moktakView.strike();
    me.strike();
    audio.moktak();
    moktakCount++;
    progress.add('moktak');
    if (moktakCount >= 30) award('moktak');
    if (!auto) {
      const r = rhythm.hit();
      const cx = innerWidth / 2 + (Math.random() - 0.5) * 60, cy = innerHeight * 0.38;
      floatText(ui.root, cx, cy, `<b>${t(r.grade)}</b>${r.points ? ' ' + t('meritPlus', { n: r.points }) : ''}`, r.grade);
      if (r.points) gain(r.points, undefined, true);
    }
    ui.setMoktak(!!moktakAuto, moktakCount, rhythm.combo);
  }
  let autoAlign = 0;
  function toggleMoktakAuto() {
    if (moktakAuto || autoAlign) {
      clearTimeout(autoAlign);
      clearInterval(moktakAuto);
      moktakAuto = 0;
      autoAlign = 0;
    } else {
      // 自动敲也对齐到拍子上
      autoAlign = window.setTimeout(() => {
        autoAlign = 0;
        strikeMoktak(true);
        moktakAuto = window.setInterval(() => strikeMoktak(true), rhythm.period * 1000);
        ui.setMoktak(true, moktakCount, rhythm.combo);
      }, rhythm.untilBeat());
      moktakAuto = -1;
    }
    ui.setMoktak(!!moktakAuto, moktakCount, rhythm.combo);
  }

  // —— 念珠 ——
  rosaryView.onBead = () => {
    beadCount++;
    audio.bead();
    ui.setRosary(beadCount);
    progress.add('beads');
    if (beadCount % 108 === 0) {
      award('beads');
      audio.bell(0.4);
      ui.toast(t('rosaryRoundDone', { n: beadCount / 108 }));
      gain(15);
    }
    navigator.vibrate?.(6);
  };
  function openRosary() {
    if (overlay === 'moktak') closeMoktak();
    if (me.action === 'bow') standUp();
    overlay = 'rosary';
    stage.show(rosaryView);
    ui.showRosary(true);
    if (!player.seat) me.setAction('rosary');
    refreshStatus();
  }
  function closeRosary() {
    if (overlay !== 'rosary') return;
    overlay = null;
    stage.show(null);
    ui.showRosary(false);
    if (me.action === 'rosary') me.setAction('idle');
    refreshStatus();
  }
  {
    const pad = ui.rosaryPad;
    let lastY = 0;
    let active = -1;
    pad.addEventListener('pointerdown', (e) => {
      active = e.pointerId;
      lastY = e.clientY;
      pad.setPointerCapture(e.pointerId);
      pad.classList.add('grabbing');
      rosaryView.setDragging(true);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      rosaryView.drag(e.clientY - lastY);
      lastY = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      active = -1;
      pad.classList.remove('grabbing');
      rosaryView.setDragging(false);
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    let wheelAcc = 0;
    pad.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        wheelAcc += e.deltaY;
        if (Math.abs(wheelAcc) > 60) {
          rosaryView.nudge(Math.sign(wheelAcc));
          wheelAcc = 0;
        }
      },
      { passive: false }
    );
  }

  // —— 其他访客 ——
  interface Remote {
    id: string; name: string; monk: Monk; tag: HTMLDivElement;
    x: number; z: number; yaw: number; tx: number; tz: number; tyaw: number; a: Action; s: string | null; n: number;
    k: string; lv: number; // 衣钵与等级（旧版客户端没有，lv 为 -1）
    c: string; // 手里的咖啡
    h: string; // 戴着耳机在听哪个台（空串是没戴）
  }
  function renderRemoteTag(r: Remote) {
    r.tag.innerHTML = (r.lv >= 0 ? `<span class="title">${t(LEVELS[r.lv].key as Key)}</span>` : '') + escapeHtml(r.name);
  }
  const remotes = new Map<string, Remote>();
  function removeRemote(id: string) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.monk.root);
    const k = interactives.indexOf(r.monk.root);
    if (k >= 0) interactives.splice(k, 1);
    r.tag.remove();
    remotes.delete(id);
  }
  function clearRemotes() {
    for (const id of [...remotes.keys()]) removeRemote(id);
  }
  let roomCount = 1;
  net.on('snapshot', (list) => {
    const seen = new Set<string>();
    for (const p of list) {
      if (p.id === net.id) continue;
      seen.add(p.id);
      let r = remotes.get(p.id);
      if (!r) {
        const monk = new Monk();
        scene.add(monk.root);
        // 别的访客可以点：端着满杯时就是请 TA 喝
        monk.root.userData.interact = { type: 'player', id: p.id };
        interactives.push(monk.root);
        const tag = document.createElement('div');
        tag.className = 'tag other';
        ui.tags.appendChild(tag);
        r = { id: p.id, name: '', monk, tag, x: p.x, z: p.z, yaw: p.yaw, tx: p.x, tz: p.z, tyaw: p.yaw, a: p.a, s: p.s, n: p.n, k: '', lv: -1, c: '', h: '' };
        remotes.set(p.id, r);
      }
      if (r.name !== p.name || r.k !== (p.k ?? '')) {
        r.name = p.name;
        r.k = p.k ?? '';
        const L = parseLook(p.k);
        if (L) applyLook(r.monk, L);
        r.lv = L ? L.lv : -1;
        renderRemoteTag(r);
      }
      r.tx = p.x;
      r.tz = p.z;
      r.tyaw = p.yaw;
      r.a = p.a;
      r.s = p.s;
      r.n = p.n;
      // 手里的咖啡：换了就换杯子；同一杯少了一口就做喝的动作
      const pc = p.c ?? '';
      if (pc !== r.c) {
        const before = parseCup(r.c), now = parseCup(pc);
        r.c = pc;
        r.monk.setCup(now?.d ?? null, now?.sips ?? 0);
        if (before && now && before.d === now.d && now.sips < before.sips) r.monk.sip();
      }
      const ph = p.h ?? '';
      if (ph !== r.h) {
        r.h = ph;
        r.monk.setHeadphones(ph || null);
      }
    }
    for (const id of [...remotes.keys()]) if (!seen.has(id)) removeRemote(id);
    roomCount = list.length;
    ui.setRoom(net.room, roomCount, net.capacity, true);
    // 有人占了我正走向的座位
    if (claimed && seatTaken(claimed)) {
      ui.toast(t('seatTaken'));
      standUp();
    }
  });
  net.on('leave', (id) => removeRemote(id));
  let offlineNotified = false;
  net.on('status', (s) => {
    if (s === 'online') {
      offlineNotified = false;
      return;
    }
    if (s === 'full') {
      ui.toast(t('roomFull'), 5000);
      ui.togglePanel('servers');
    }
    if (s === 'offline') {
      clearRemotes();
      ui.setRoom(0, 1, 50, false);
      if (!offlineNotified) {
        offlineNotified = true;
        setTimeout(() => net.status !== 'online' && ui.toast(t('offline'), 4000), 1500);
      }
    }
  });
  net.on('welcome', ({ room }) => {
    clearRemotes();
    ui.setRoom(room, 1, net.capacity, true);
    const u = new URL(location.href);
    u.searchParams.set('room', String(room));
    history.replaceState(null, '', u);
    if (player.seat) net.claim(player.seat.id);
  });
  const urlRoom = Number(new URL(location.href).searchParams.get('room')) || 0;
  net.connect(name, urlRoom);

  setInterval(() => {
    const list: Visitor[] = [{ name, me: true, status: t(STATUS_KEY[me.action] ?? 'statusIdle'), bows: bowsToday }];
    for (const r of remotes.values()) list.push({ name: r.name, me: false, status: t(STATUS_KEY[r.a] ?? 'statusIdle'), bows: r.n });
    ui.setVisitors(list);
  }, 1000);

  // —— 镜头 ——
  const cam = REAL ? { yaw: 0, pitch: 0.22, dist: isTouch ? 5.4 : 4.6, tx: player.x, ty: 1.4, tz: player.z } : { yaw: 0, pitch: 0.3, dist: isTouch ? 6.4 : 5.6, tx: player.x, ty: 1, tz: player.z };
  // 调试：?debugview&at=x,z&cam=yaw,pitch,dist 直接跳到某个位置
  if (new URL(location.href).searchParams.has('debugview')) {
    const sp = new URL(location.href).searchParams;
    const at = sp.get('at')?.split(',').map(Number);
    if (at && at.length >= 2 && at.every(Number.isFinite)) {
      player.x = cam.tx = at[0];
      player.z = cam.tz = at[1];
    }
    const cv = sp.get('cam')?.split(',').map(Number);
    if (cv && cv.length === 3 && cv.every(Number.isFinite)) [cam.yaw, cam.pitch, cam.dist] = cv;
    const inc = sp.get('incense');
    if (inc === 'altar' || inc === 'yard') setTimeout(() => requestIncense(inc), 1200);
    // 调试：?debugview&do=lantern|feed|fortune 直接做一次
    const act = sp.get('do');
    if (act === 'lantern') setTimeout(requestLantern, 1200);
    if (act === 'feed') setTimeout(() => requestFeed(POND.x - 3, POND.z - 1.5), 1200);
    if (act === 'fortune') setTimeout(requestFortune, 1200);
    if (act === 'bell') setTimeout(() => strikeInstrument(), 1200);
    // 调试：&do=cafe 走去点咖啡；&coffee=饮品&sips=n 直接端上一杯；&sipnow / &offernow 过几秒做一次喝、递的动作
    if (act === 'cafe') setTimeout(requestCafe, 1200);
    // 调试：&do=wish 走去祈福台写心愿，&do=persimmon 去柿饼架；&wishdemo=n 在灯廊里挂 n 盏假心愿（只在本机）
    if (act === 'wish') setTimeout(requestWish, 1200);
    if (act === 'persimmon') setTimeout(requestPersimmon, 1200);
    const demo = Number(sp.get('wishdemo'));
    // 等服务器发来心愿列表之后再挂（不然会被那份列表冲掉）
    if (demo > 0) setTimeout(() => {
      const texts = ['愿一战上岸', '愿家人安康', '愿钱包鼓鼓', '愿遇见对的人', '愿岁岁平安', '愿诸事顺遂', '愿少加班多睡觉', '愿毕业顺利'];
      for (let i = 0; i < demo; i++) {
        const id = newWishId();
        wishMap.set(id, { id, by: `访客${i + 1}`, text: texts[i % texts.length], c: i % 6, k: i % 7, at: Date.now() - i * 60000, likes: i % 4 });
      }
      refreshLanterns();
    }, 2500);
    if (sp.has('readwish')) setTimeout(() => readLantern([...hookWish.keys()][0] ?? 0), 4000);
    const dbgHang = sp.get('hang');
    if (dbgHang) setTimeout(() => hangWish(0, Number(sp.get('hangc') ?? 0), dbgHang), 1200);
    const dbgCup = sp.get('coffee');
    if (dbgCup && DRINK_BY_ID.has(dbgCup as DrinkId)) setTimeout(() => setCup({ d: dbgCup as DrinkId, sips: Number(sp.get('sips') ?? SIPS) }), 1000);
    if (sp.has('sipnow')) setTimeout(() => me.sip(), Number(sp.get('sipnow')) || 3000);
    // 调试：&radio=lofi|rain|qin 直接戴上耳机开台
    const dbgRadio = sp.get('radio') as StationId | null;
    if (dbgRadio && ['lofi', 'rain', 'qin'].includes(dbgRadio)) {
      me.setHeadphones(dbgRadio);
      me.beatClock = () => radio.beats();
      radio.start(dbgRadio).catch(() => {});
    }
    if (sp.has('offernow')) setTimeout(() => me.offer(), Number(sp.get('offernow')) || 3000);
    const dbgBrew = sp.get('brew');
    if (dbgBrew && DRINK_BY_ID.has(dbgBrew as DrinkId)) {
      setTimeout(requestCafe, 1200);
      const iv = setInterval(() => {
        if (!cafeUI.open) return;
        clearInterval(iv);
        setTimeout(() => brewCoffee(dbgBrew as DrinkId), 800);
      }, 300);
    }
    // 调试：?debugview&moktak=n 打开木鱼并按拍子敲 n 下（前几下准，后面偏一点）
    const mk = Number(sp.get('moktak'));
    if (mk > 0)
      setTimeout(() => {
        openMoktak();
        let k = 0;
        const tick = () => {
          if (k++ >= mk) return;
          setTimeout(() => strikeMoktak(), k > mk - 2 ? 200 : 20);
          setTimeout(tick, rhythm.untilBeat() + 5);
        };
        setTimeout(tick, rhythm.untilBeat() + 5);
      }, 1200);
    // 调试：&points=N 直接加功德点（看解锁），&lamps=N 直接点亮长明灯
    const dbgPts = Number(sp.get('points'));
    if (dbgPts > 0) {
      progress.addPoints(dbgPts);
      renderMyTag();
      refreshHalls(false);
    }
    const dbgLamps = Number(sp.get('lamps'));
    if (dbgLamps > 0) sideHalls.setLamps(Math.min(LAMPS, dbgLamps));
    // 调试：?debugview&quest=sweep|water 直接接下寺务
    const qp = sp.get('quest');
    const qd = QUESTS.find((q) => q.id === qp);
    if (qd) setTimeout(() => questNpc(qd.giver), 1200);
    // 调试：再加 &qauto 自动把目标一个个做完、回去回禀
    if (qd && sp.has('qauto'))
      setInterval(() => {
        const st = progress.quest(qd.id);
        if (questWork || !st) return;
        if (st.phase === 'ready') questNpc(qd.giver);
        else if (st.phase === 'active' && !player.route.length) {
          const i = qd.targets.findIndex((_, k) => !st.got.includes(k));
          if (i >= 0) questGo(qd.id, i);
        }
      }, 1500);
    // 调试：?treestats 在左下角显示树的三角形数
    if (sp.has('treestats')) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;background:#000a;color:#fff;font:12px monospace;padding:4px 8px';
      d.textContent = `trees ${(((window as unknown as { __treeTris: number }).__treeTris ?? 0) / 1000).toFixed(0)}k tris · calls ${renderer.info.render.calls} · scene ${(renderer.info.render.triangles / 1000).toFixed(0)}k`;
      document.body.appendChild(d);
      setInterval(() => (d.textContent = `trees ${(((window as unknown as { __treeTris: number }).__treeTris ?? 0) / 1000).toFixed(0)}k tris · ${post.info()}`), 1000);
    }
    // 调试：?hideme 截图时把自己藏起来
    if (sp.has('hideme')) me.root.scale.setScalar(0.001);
    const rt = Number(sp.get('routine'));
    if (sp.has('routine') && Number.isFinite(rt)) residents.setDebugTime(rt);
    // 调试：&look=僧袍.念珠 换衣钵（要先有够的功德）；&panel=practice 打开修行面板
    const dbgLook = sp.get('look')?.split('.');
    if (dbgLook?.length === 2) {
      myLook = { robe: dbgLook[0], beads: dbgLook[1] };
      applyLook(me, myLook);
    }
    if (sp.get('panel') === 'practice') setTimeout(() => ui.openPractice((sp.get('ptab') as 'progress' | 'sutras' | 'rules' | 'look' | null) ?? 'progress'), 1500);
    // 调试：&daily=bow:6,incense:1 设今天各项功课的次数（录宣传片的界面截图用）
    for (const kv of (sp.get('daily') ?? '').split(',')) {
      const [k, v] = kv.split(':');
      if (k && Number(v) > 0) progress.tick(k, Number(v));
    }
    // 调试：&read=经的编号 直接打开读经
    const dbgRead = sp.get('read');
    if (dbgRead) setTimeout(() => reader.show(dbgRead), 1500);
    // 调试：&climb=0|1 直接登上左（右）塔
    const dbgClimb = Number(sp.get('climb'));
    if (sp.has('climb') && PAGODAS[dbgClimb]) setTimeout(() => requestClimb(dbgClimb), 1200);
    // 调试：&desk=0|1|2 走到藏经阁的经案坐下抄经
    const dbgDesk = Number(sp.get('desk'));
    if (sp.has('desk') && dbgDesk >= 0 && dbgDesk < 3) setTimeout(() => requestSutra(dbgDesk), 1500);
    // 调试：再加 &sutratype=文字 模拟用键盘打一段（看简体、错字的反应）
    const dbgType = sp.get('sutratype');
    if (dbgType) {
      const iv = setInterval(() => {
        if (!sutra.open) return;
        clearInterval(iv);
        setTimeout(() => sutra.debugType(dbgType), 600);
      }, 400);
    }
    // 调试：再加 &sutraauto=n 自动描 n 个字
    const dbgAuto = Number(sp.get('sutraauto'));
    if (dbgAuto > 0) {
      let left = dbgAuto;
      const iv = setInterval(() => {
        if (!sutra.open) return;
        sutra.autoTrace();
        if (--left <= 0) {
          clearInterval(iv);
          // 再加 &sutrascroll：描完后打开横幅
          if (sp.has('sutrascroll')) setTimeout(() => sutra.showScroll(), 1500);
        }
      }, 1100);
    }
    // 调试：&seat=座位编号 直接坐上去（看人和蒲团、长椅贴不贴合）
    const dbgSeat = SEAT_BY_ID.get(sp.get('seat') ?? '');
    if (dbgSeat) setTimeout(() => sitAt(dbgSeat, dbgSeat.kind === 'bench' ? 'bench' : 'sit'), 1200);
    const sayRole = sp.get('say');
    if (sayRole) setTimeout(() => say(sayRole as Role), 1500);
  }
  const camRay = new THREE.Raycaster();
  // 挡镜头的建筑：用简单的长方体代替真实模型（算起来很省）。镜头和人之间被挡住，就把镜头拉到挡板前面；
  // 钟楼、山门只挡屋顶那一截，镜头可以从柱子之间、门洞里看过去；人本身在哪个长方体里，就不算它
  const camBoxes: THREE.Box3[] = [];
  {
    const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => camBoxes.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
    const { x0, x1, z0, z1, gateX } = COURT;
    const t = 0.4, wh = 2.8;
    B(x0, 0, z0 - t, x1, wh, z0 + t);
    B(x0 - t, 0, z0, x0 + t, wh, z1);
    B(x1 - t, 0, z0, x1 + t, wh, z1);
    B(x0, 0, z1 - t, -gateX - 2.3, wh, z1 + t);
    B(gateX + 2.3, 0, z1 - t, x1, wh, z1 + t);
    B(-gateX - 2.6, 4.4, z1 - 1.6, gateX + 2.6, 8.6, z1 + 1.6);
    for (const h of HALLS) {
      // 面阔沿哪条轴：配殿横着放（转了 90°），藏经阁正着放
      const across = Math.abs(Math.sin(h.yaw)) > 0.5;
      const ax = (across ? h.w : h.d) / 2 + 1.8, az = (across ? h.d : h.w) / 2 + 1.8;
      B(h.x - ax, 0, h.z - az, h.x + ax, h === HALLS[2] ? 14 : 9.5, h.z + az);
    }
    for (const T of [BELL]) B(T.x - 4.7, 5.0, T.z - 4.7, T.x + 4.7, 9.2, T.z + 4.7);
    for (const p of PAGODAS) B(p.x - 1.7 * p.s, 0, p.z - 1.7 * p.s, p.x + 1.7 * p.s, 22, p.z + 1.7 * p.s);
  }
  const camHit = new THREE.Vector3();
  const camBlockers = [...hall.blockers, ...sideHalls.walls];
  let camD = isTouch ? 6.4 : 5.6;
  const tmpV = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  function updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 9);
    cam.tx += (player.x - cam.tx) * k;
    cam.tz += (player.z - cam.tz) * k;
    // 镜头看向胸口偏上，跪拜、打坐时跟着降低（Q 版和真人比例各一套高度）
    const low = me.action === 'bow' || me.action === 'sit';
    const targetY = player.y + (REAL ? (low ? 0.8 : 1.4) : low ? 0.55 : 0.95);
    cam.ty += (targetY - cam.ty) * k;
    tmpT.set(cam.tx, cam.ty, cam.tz);
    const cp = Math.cos(cam.pitch);
    const dir = tmpV.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    let d = cam.dist;
    camRay.set(tmpT, dir);
    camRay.far = d + 0.3;
    const hit = camRay.intersectObjects(camBlockers, true)[0];
    if (hit) d = Math.max(0.8, hit.distance - 0.3);
    for (const b of camBoxes) {
      if (b.containsPoint(tmpT)) continue;
      if (camRay.ray.intersectBox(b, camHit)) {
        const hd = camHit.distanceTo(tmpT);
        if (hd < d + 0.3) d = Math.max(0.8, Math.min(d, hd - 0.35));
      }
    }
    // 被挡住时立刻拉近；挡板过去了再慢慢退回原来的距离，免得镜头一跳一跳
    camD = d < camD ? d : camD + (d - camD) * (1 - Math.exp(-dt * 2.5));
    const pos = tmpT.clone().addScaledVector(dir, camD);
    // 在殿内时镜头不要穿过天花板
    const inside = pos.x > -HALL.wallX && pos.x < HALL.wallX && pos.z > HALL.backZ && pos.z < HALL.colZFront;
    if (inside) pos.y = Math.min(pos.y, HALL.baseH + HALL.colH + 0.6);
    // 祈福灯廊里：镜头压在灯笼底下，不钻进灯里
    {
      const A = WISH_ALLEY;
      if (pos.x > A.xW - 0.8 && pos.x < A.xE + 0.8 && pos.z > A.zs[0] - 0.8 && pos.z < A.zs[A.zs.length - 1] + 0.8) pos.y = Math.min(pos.y, 2.25);
      // 咖啡馆厅里：镜头不穿过天花
      const c = cafeLocal(pos.x, pos.z);
      if (Math.abs(c.lx) < CAFE.hw + 0.3 && c.lz > -CAFE.hd && c.lz < CAFE.hd + 0.6) pos.y = Math.min(pos.y, CAFE.base + CAFE.colH - 0.3);
    }
    pos.y = Math.max(pos.y, heightAt(pos.x, pos.z) + 0.3);
    if (cine.on && !cineValid()) endIncenseScene();
    if (cineMode === 'intro') {
      // 开场：从山门方向远远望着大殿，镜头慢慢横移
      const a = 0.42 * Math.sin(elapsed * 0.045) - 0.12;
      cine.pos.set(Math.sin(a) * 34, 10.5, 24 + Math.cos(a) * 34);
      cine.look.set(0, 4.2, 0);
    }
    if (cineMode === 'tower' && tower) {
      // 塔顶：站在顶层檐下的外廊上，朝拖动的方向往外看；上下拖动是抬头、低头
      const P = PAGODAS[tower.i];
      const s = P.s * 0.75;
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const eyeY = 9.0 * s;
      cine.pos.set(P.x + fx * 1.15 * s, eyeY, P.z + fz * 1.15 * s);
      const down = (cam.pitch - 0.12) * 0.75;
      cine.look.set(cine.pos.x + fx * Math.cos(down) * 10, eyeY - Math.sin(down) * 10, cine.pos.z + fz * Math.cos(down) * 10);
    }
    cine.blend = Math.max(0, Math.min(1, cine.blend + (cine.on ? dt / 1.1 : -dt / 0.9)));
    if (cine.blend > 0) {
      const e = cine.blend * cine.blend * (3 - 2 * cine.blend);
      pos.lerp(cine.pos, e);
      tmpT.lerp(cine.look, e);
    }
    camera.position.copy(pos);
    camera.lookAt(tmpT);
  }

  // —— 输入 ——
  const canvas = renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointers = new Map<number, { x: number; y: number }>();
  let drag = { id: -1, sx: 0, sy: 0, lx: 0, ly: 0, t: 0, moved: false };
  let pinch = 0;

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 32), new THREE.MeshBasicMaterial({ color: '#fff8e6', transparent: true, opacity: 0, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  scene.add(marker);
  let markerLife = 0;

  function findInteract(hit: THREE.Intersection): any {
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      const it = o.userData.interact;
      if (it) {
        if (it.ids && hit.instanceId !== undefined) return { type: it.type, id: it.ids[hit.instanceId] };
        return it;
      }
      o = o.parent;
    }
    return null;
  }

  function pick(cx: number, cy: number) {
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const ih = ray.intersectObjects(interactives, true)[0];
    const gh = ray.intersectObjects(walkables, false)[0];
    if (ih && (!gh || ih.distance <= gh.distance + 0.5) && ih.distance < 60) return { interact: findInteract(ih), point: ih.point };
    if (gh) return { interact: null, point: gh.point };
    return null;
  }

  function cancelIntent() {
    if (player.seat || claimed) standUp();
    intent = null;
    refreshStatus();
  }

  function handleClick(cx: number, cy: number) {
    if (overlay || fortuneOpen || intro || tower || sutra.open || reader.open || cafeUI.open || wishUI.open) return;
    const p = pick(cx, cy);
    if (!p) return;
    if (p.interact?.type === 'cafe') {
      requestCafe();
      return;
    }
    if (p.interact?.type === 'wishDesk') {
      requestWish();
      return;
    }
    if (p.interact?.type === 'wishLantern') {
      readLantern(p.interact.id as number);
      return;
    }
    if (p.interact?.type === 'persimmon') {
      requestPersimmon();
      return;
    }
    if (p.interact?.type === 'cafeBin' && cup) {
      requestBin();
      return;
    }
    if (p.interact?.type === 'player' && cup && cup.sips === SIPS) {
      giftRemote(p.interact.id as string);
      return;
    }
    if (p.interact?.type === 'pagoda') {
      requestClimb(p.interact.i as number);
      return;
    }
    if (p.interact?.type === 'sutraDesk') {
      requestSutra(p.interact.desk as number);
      return;
    }
    if (p.interact?.type === 'sutraShelf') {
      ui.openPractice('sutras');
      return;
    }
    if (p.interact?.type === 'seat') {
      const seat = SEAT_BY_ID.get(p.interact.id);
      if (seat) goToSeat(seat, 'sit');
      return;
    }
    // 点茶几：走到离自己最近的空椅子坐下
    if (p.interact?.type === 'tea') {
      const free = TEA_SEATS.filter((s) => !seatTaken(s)).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
      if (free[0]) goToSeat(free[0], 'sit');
      else ui.toast(t('seatTaken'));
      return;
    }
    if (p.interact?.type === 'incense' || p.interact?.type === 'altarIncense') {
      requestIncense(p.interact.type === 'altarIncense' ? 'altar' : 'yard');
      return;
    }
    if (p.interact?.type === 'bell') {
      strikeInstrument();
      return;
    }
    if (p.interact?.type === 'lantern') {
      requestLantern();
      return;
    }
    if (p.interact?.type === 'npc') {
      // 端着满杯：请这位师父喝；咖啡师父那里没杯子就是去点单
      if (typeof p.interact.id === 'number' && cup && cup.sips === SIPS) {
        giftNpc(p.interact.id);
        return;
      }
      if (p.interact.role === 'barista' && !cup) {
        requestCafe();
        return;
      }
      if (typeof p.interact.id === 'number' && questNpc(p.interact.id)) return;
      say(typeof p.interact.id === 'number' ? p.interact.id : (p.interact.role as Role));
      return;
    }
    if (p.interact?.type === 'quest') {
      questGo(p.interact.q, p.interact.i);
      return;
    }
    if (p.interact?.type === 'hallDoor' || p.interact?.type === 'hallStatue' || p.interact?.type === 'hallLamp') {
      hallClick(p.interact.type, p.interact.hall as number);
      return;
    }
    if (p.interact?.type === 'fortune') {
      requestFortune();
      return;
    }
    if (p.interact?.type === 'pond') {
      requestFeed(p.point.x, p.point.z);
      return;
    }
    cancelIntent();
    if (questWork) {
      questWork = null;
      ui.setStatus(null);
    }
    if (me.action === 'hapjang' || me.action === 'incense' || me.action === 'sweep' || me.action === 'water') me.setAction(baseAction());
    marker.position.set(p.point.x, p.point.y + 0.03, p.point.z);
    markerLife = 1;
    walkTo(p.point.x, p.point.z);
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
      drag.moved = true;
    }
  });
  let hoverAt = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) cam.dist = THREE.MathUtils.clamp(cam.dist * (pinch / d), 2.2, 24);
        pinch = d;
        return;
      }
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.lx;
      const dy = e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.moved = true;
        canvas.classList.add('grab');
      }
      if (drag.moved) {
        cam.yaw -= dx * 0.0055;
        cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.03, 1.25);
      }
      return;
    }
    if (e.pointerType !== 'mouse' || overlay) return;
    const now = performance.now();
    if (now - hoverAt < 90) return;
    hoverAt = now;
    const p = pick(e.clientX, e.clientY);
    const it = p?.interact;
    let label: string | null = null;
    if (it?.type === 'seat') {
      const s = SEAT_BY_ID.get(it.id);
      label = s && seatTaken(s) ? t('seatTaken') : t('sit');
    } else if (it?.type === 'tea') label = t('tipTea');
    else if (it?.type === 'incense' || it?.type === 'altarIncense') label = t('incense');
    else if (it?.type === 'bell') label = t('ringBell');
    else if (it?.type === 'lantern') label = t('tipLantern');
    else if (it?.type === 'fortune') label = t('tipFortune');
    else if (it?.type === 'pagoda') label = t('placePagoda');
    else if (it?.type === 'sutraDesk') label = t('tipDesk');
    else if (it?.type === 'sutraShelf') label = t('tipShelf');
    else if (it?.type === 'pond') label = t('tipPond');
    else if (it?.type === 'npc') label = cup && cup.sips === SIPS ? t('tipGift', { n: t(ROLE_KEY[it.role as Role]) }) : t(ROLE_KEY[it.role as Role]);
    else if (it?.type === 'cafe') label = t('tipCafe');
    else if (it?.type === 'wishDesk') label = t('tipWish');
    else if (it?.type === 'wishLantern') label = hookWish.has(it.id) ? t('tipWishRead') : t('tipWish');
    else if (it?.type === 'persimmon') label = t('tipPersimmon');
    else if (it?.type === 'cafeBin') label = t('tipBin');
    else if (it?.type === 'player') label = cup && cup.sips === SIPS ? t('tipGift', { n: remotes.get(it.id)?.name ?? '' }) : null;
    else if (it?.type === 'hallDoor' || it?.type === 'hallStatue') label = t(HALL_NAME[it.hall as number]);
    else if (it?.type === 'hallLamp') label = t('lampLabel');
    canvas.classList.toggle('point', !!label);
    ui.showTooltip(label, e.clientX, e.clientY);
  });
  const up = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (e.pointerId === drag.id) {
      canvas.classList.remove('grab');
      if (!drag.moved && performance.now() - drag.t < 600 && e.type === 'pointerup') handleClick(e.clientX, e.clientY);
      drag.id = -1;
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => ui.showTooltip(null));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      cam.dist = THREE.MathUtils.clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 2.2, 24);
    },
    { passive: false }
  );

  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  addEventListener('keydown', (e) => {
    const tg = e.target as HTMLElement;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA')) return;
    if (!running) return;
    if (e.code === 'Escape') {
      if (ui.panelOpen) ui.closePanel();
      else if (overlay === 'moktak') closeMoktak();
      else if (overlay === 'rosary') closeRosary();
      return;
    }
    // 抄经、读经、点咖啡的面板开着时，空格、数字键不去触发礼佛、念珠这些
    if (sutra.open || reader.open || cafeUI.open || wishUI.open) return;
    if (overlay === 'rosary' && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.code)) {
      e.preventDefault();
      if (!e.repeat || true) rosaryView.nudge(e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (overlay === 'moktak' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      if (!e.repeat) strikeMoktak();
      return;
    }
    if (e.repeat && !MOVE_KEYS.has(e.code)) return;
    if (MOVE_KEYS.has(e.code)) {
      if (overlay) return;
      e.preventDefault();
      keys.add(e.code);
      return;
    }
    if (tg && tg.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    switch (e.code) {
      case 'Digit1':
      case 'KeyE':
      case 'Space':
        e.preventDefault();
        toggleBow();
        break;
      case 'Digit2':
        overlay === 'rosary' ? closeRosary() : openRosary();
        break;
      case 'Digit3':
        hapjang();
        break;
      case 'Digit5':
        overlay === 'moktak' ? closeMoktak() : openMoktak();
        break;
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // —— 每帧更新 ——
  // 静坐满一分钟；从池子一头走过石拱桥到另一头
  let sitTime = 0;
  let bridgeFrom = 0;
  function trackSeals(dt: number) {
    if (intro) return;
    if (player.seat && (me.action === 'sit' || me.action === 'bench')) {
      sitTime += dt;
      if (sitTime >= 60) award('sit');
    } else sitTime = 0;
    const onBridge = player.x > BRIDGE.x0 && player.x < BRIDGE.x1 && player.z > BRIDGE.z0 && player.z < BRIDGE.z1;
    if (onBridge && !bridgeFrom) bridgeFrom = player.z < POND.z ? -1 : 1;
    if (!onBridge && bridgeFrom) {
      if ((player.z < POND.z ? -1 : 1) !== bridgeFrom && Math.abs(player.x) < 4) award('bridge');
      bridgeFrom = 0;
    }
  }

  function updatePlayer(dt: number) {
    let dx = 0;
    let dz = 0;
    if (keys.size && !overlay && !tower && !sutra.open && !reader.open && !cafeUI.open && !wishUI.open) {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      if (f || s) {
        if (player.seat || claimed || intent) cancelIntent();
        if (me.action === 'hapjang' || me.action === 'incense') me.setAction(baseAction());
        player.route = [];
        const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
        const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
        dx = fx * f + rx * s;
        dz = fz * f + rz * s;
        const l = Math.hypot(dx, dz);
        dx /= l;
        dz /= l;
      }
    }
    if (!dx && !dz && player.route.length && !player.seat) {
      const wp = player.route[0];
      const ddx = wp.x - player.x;
      const ddz = wp.z - player.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist < 0.12) {
        player.route.shift();
        if (!player.route.length) {
          const cb = player.onArrive;
          player.onArrive = null;
          cb?.();
        }
      } else {
        dx = ddx / dist;
        dz = ddz / dist;
      }
    }
    const moving = !!(dx || dz);
    if (moving) {
      const speed = REAL ? 2.1 : 2.7;
      const step = Math.min(speed * dt, 0.2);
      let nx = player.x + dx * step;
      let nz = player.z + dz * step;
      if (canStep(player.x, player.z, nx, nz)) {
        player.x = nx;
        player.z = nz;
        player.stuck = 0;
      } else if (canStep(player.x, player.z, nx, player.z)) {
        player.x = nx;
        player.stuck += dt * 0.5;
      } else if (canStep(player.x, player.z, player.x, nz)) {
        player.z = nz;
        player.stuck += dt * 0.5;
      } else player.stuck += dt;
      if (player.route.length && player.stuck > 1.2 && player.dest && player.replans < 2) {
        // 被挡住了：从当前位置重新找一条路
        player.replans++;
        player.stuck = 0;
        player.route = planRoute(player.x, player.z, player.dest.x, player.dest.z);
      } else if (player.route.length && player.stuck > 1.2) {
        // 还是走不过去：放弃这段路
        player.route = [];
        player.onArrive = null;
        if (claimed || intent) {
          ui.toast(t('findCushionFail'));
          cancelIntent();
        }
      }
      player.yaw = angleLerp(player.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      me.speed = speed;
      if (me.action !== 'walk') me.setAction('walk');
    } else if (me.action === 'walk') {
      me.setAction(baseAction());
    }
    const ty = player.seat ? seatY(player.seat) : heightAt(player.x, player.z);
    player.y += (ty - player.y) * Math.min(1, dt * 14);
    me.root.position.set(player.x, player.y, player.z);
    me.root.rotation.y = player.yaw;
    me.update(dt);
  }

  // 人和人不穿过去：碰到僧人或别的玩家就由自己这边让开（僧人按时刻表走，不能被挡住）
  function separatePlayer() {
    if (player.seat || me.action === 'bow' || me.action === 'sit' || me.action === 'bench') return;
    const rp = REAL ? 0.36 : 0.3;
    const push = (o: THREE.Object3D) => {
      if (!o.visible) return;
      let dx = player.x - o.position.x, dz = player.z - o.position.z;
      const min = rp * (1 + o.scale.x);
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) return;
      let d = Math.sqrt(d2);
      if (d < 1e-4) {
        dx = Math.sin(player.yaw + Math.PI);
        dz = Math.cos(player.yaw + Math.PI);
        d = 1;
      }
      const ov = min - (d2 < 1e-8 ? 0 : Math.sqrt(d2));
      const tx = player.x + (dx / d) * ov, tz = player.z + (dz / d) * ov;
      if (canStep(player.x, player.z, tx, tz)) {
        player.x = tx;
        player.z = tz;
      }
    };
    for (const r of residents.list) push(r.monk.root);
    for (const r of remotes.values()) push(r.monk.root);
    me.root.position.x = player.x;
    me.root.position.z = player.z;
  }

  function updateRemotes(dt: number) {
    const k = 1 - Math.exp(-dt * 8);
    for (const r of remotes.values()) {
      r.x += (r.tx - r.x) * k;
      r.z += (r.tz - r.z) * k;
      r.yaw = angleLerp(r.yaw, r.tyaw, k);
      const seat = r.s ? SEAT_BY_ID.get(r.s) : undefined;
      const seated = seat && (r.a === 'sit' || r.a === 'bench' || r.a === 'bow');
      const y = seated ? seatY(seat!) : heightAt(r.x, r.z);
      r.monk.root.position.set(r.x, y, r.z);
      r.monk.root.rotation.y = r.yaw;
      r.monk.speed = 2;
      r.monk.setAction(r.a);
      r.monk.update(dt);
    }
  }

  const tagV = new THREE.Vector3();
  function placeTag(el: HTMLElement, x: number, y: number, z: number, maxDist: number) {
    tagV.set(x, y, z);
    const dist = tagV.distanceTo(camera.position);
    tagV.project(camera);
    if (tagV.z > 1 || dist > maxDist || Math.abs(tagV.x) > 1.2 || Math.abs(tagV.y) > 1.2) {
      el.style.opacity = '0';
      return;
    }
    const sx = (tagV.x * 0.5 + 0.5) * innerWidth;
    const sy = (-tagV.y * 0.5 + 0.5) * innerHeight;
    el.style.opacity = String(Math.min(1, (maxDist - dist) / 6));
    el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }
  function updateTags() {
    const now = performance.now();
    for (const n of npcUi) {
      const m = n.r.monk.root;
      const a = n.r.monk.action;
      const low = a === 'sit' || a === 'bow' || a === 'read' || a === 'tea' || a === 'teach' || a === 'fill';
      const y = m.position.y + (REAL ? (low ? 1.25 : 1.95) : low ? 1.2 : 1.55) * m.scale.y;
      if (!m.visible || overlay || intro) {
        n.tag.style.opacity = '0';
        n.bubble.style.opacity = '0';
        continue;
      }
      if (n.label !== n.r.label) {
        n.label = n.r.label;
        n.tag.textContent = npcTagText(n);
      }
      placeTag(n.tag, m.position.x, y, m.position.z, 13);
      if (now < n.until) {
        placeTag(n.bubble, m.position.x, y + 0.42, m.position.z, 30);
      } else n.bubble.style.opacity = '0';
    }
    const lift = me.action === 'bow' || me.action === 'sit' ? (REAL ? 1.25 : 1.15) : REAL ? 1.95 : 1.5;
    placeTag(myTag, player.x, player.y + lift, player.z, 60);
    myTag.style.visibility = overlay || tower ? 'hidden' : 'visible';
    for (const r of remotes.values()) {
      const y = r.monk.root.position.y + (r.a === 'bow' || r.a === 'sit' ? (REAL ? 1.25 : 1.15) : REAL ? 1.95 : 1.5);
      placeTag(r.tag, r.x, y, r.z, 24);
      r.tag.style.visibility = overlay ? 'hidden' : 'visible';
    }
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    post.setSize(innerWidth, innerHeight, PR);
  });
  document.addEventListener('visibilitychange', () => {
    audio.pauseForHidden(document.hidden);
    if (document.hidden) keys.clear();
    clock.getDelta();
  });

  const clock = new THREE.Clock();
  // 调试：?debugview&slowmo=0.2 慢放
  const slowmo = new URL(location.href).searchParams.has('debugview') ? Number(new URL(location.href).searchParams.get('slowmo')) || 1 : 1;
  let elapsed = 0;
  let goldDone = false;
  const sunDir = new THREE.Vector3();
  const sunCol = new THREE.Color();
  let envTimer = 0;
  let booted = false;
  function frame() {
    requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(0.05, clock.getDelta()) * slowmo;
    elapsed += dt;
    updatePlayer(dt);
    checkIncenseDone();
    checkNewActionsDone();
    trackSeals(dt);
    for (const e of residents.update(dt, svcNow(), camera.position, player)) murmur(e.id, e.key);
    questUpdate(dt);
    sideHalls.update(dt, elapsed);
    rhythm.update();
    charge.update(dt);
    if (charge.active) buildings.bell.aim?.(Math.max(0.02, charge.power));
    if (!intro && residents.greet(player.x, player.z, elapsed)) say('greeter', 0);
    updateService(dt);
    updateRemotes(dt);
    separatePlayer();
    updateCamera(dt);
    clouds.update(dt, elapsed, !!tower || intro, camera.position.y);
    nature.update(dt, elapsed);
    life.update(dt, elapsed, env.lanternLevel, camera.position);
    sunDir.copy(env.sun.position).sub(env.sun.target.position).normalize();
    sunCol.copy(env.sun.color).multiplyScalar(env.sun.intensity);
    pond.update(dt, elapsed, env.lanternLevel, sunDir, sunCol);
    props.update(dt, elapsed);
    altarIncense.update(dt, elapsed);
    cafe.update(dt, elapsed);
    garden.update(dt, elapsed);
    buildings.bell.update(dt);
    env.follow(player.x, player.z);
    for (const [i, f] of hall.candleFlames.entries()) f.scale.set(1, 2.2 + Math.sin(elapsed * 9 + i * 2) * 0.25, 1);
    if (markerLife > 0) {
      markerLife -= dt * 1.2;
      (marker.material as THREE.MeshBasicMaterial).opacity = Math.max(0, markerLife) * 0.8;
      marker.scale.setScalar(1 + (1 - markerLife) * 0.6);
    }
    envTimer += dt;
    if (envTimer > 30 || (!goldDone && elapsed > 6)) {
      envTimer = 0;
      goldDone = true;
      env.update();
      props.setLanternLevel(env.lanternLevel);
      cafe.setLanternLevel(env.lanternLevel);
      garden.setLanternLevel(env.lanternLevel);
    }
    env.tick(dt, camera.position);
    post.render(dt / slowmo);
    // 拍立得：在这一帧画完的同时取画面（画布不保留上一帧，必须当场取）
    if (grabFrame) {
      const cb = grabFrame;
      grabFrame = null;
      cb(renderer.domElement);
    }
    stage.render(dt);
    updateTags();
    // 围炉：坐在炉边的椅子上才出现操作条；炭火天黑以后更亮
    teaUI.setVisible(!!player.seat && player.seat.id.startsWith('t'));
    tea.update(dt, Math.min(1, env.lanternLevel));
    net.sendState({ x: player.x, z: player.z, yaw: player.yaw, a: me.action, s: player.seat?.id ?? claimed?.id ?? null, n: bowsToday, k: lookCode(myLook, levelOf(progress.points())), c: cupCode(cup), h: radio.station ?? '' });
    if (!booted) {
      booted = true;
      bootEl.classList.add('gone');
      if (intro) setTimeout(() => titleCard(app, isTouch, enterTemple), 500);
      setTimeout(() => bootEl.remove(), 1000);
    }
  }
  frame();
  onLangChange(() => {
    document.getElementById('boot-title') && (document.getElementById('boot-title')!.textContent = t('title'));
  });
}

start().catch(fail);
