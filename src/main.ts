// 山寺主程序：搭场景、控制小和尚、镜头、点击交互，以及与服务器同步
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { t, randomName, onLangChange, type Key } from './i18n';
import { Environment, buildTerrain, type TimeMode } from './world/environment';
import { buildHall } from './world/hall';
import { buildNature } from './world/nature';
import { buildProps } from './world/props';
import { buildBuildings } from './world/buildings';
import { IncenseSpot } from './world/incense';
import { placeStatues } from './world/statues';
import { preloadTextures, setMaxAnisotropy, loadTexture } from './world/pbr';
import { Monk, type Action, HAPJANG_DURATION, INCENSE_DURATION } from './monk';
import { HALL, SPAWN, INCENSE, CUSHIONS, SEAT_BY_ID, ALTAR_SPOT, ALTAR_BURNER, type Seat, heightAt, canStep, planRoute } from './layout';
import { audio } from './audio';
import { Net, type IncenseItem, type IncensePlace } from './net';
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

const STATUS_KEY: Record<Action, Key> = {
  idle: 'statusIdle', walk: 'statusWalk', bow: 'statusBow', hapjang: 'statusHapjang', sit: 'statusSit', bench: 'statusSit',
  moktak: 'statusMoktak', rosary: 'statusRosary', incense: 'statusIncense',
};

const today = () => new Date().toISOString().slice(0, 10);
function loadBows() {
  try {
    const v = JSON.parse(localStorage.getItem('sansa.bows') || 'null');
    if (v && v.date === today()) return Number(v.n) || 0;
  } catch {
    /* 忽略 */
  }
  return 0;
}

const CUSHION_TOP = HALL.baseH + 0.12;
const seatY = (s: Seat) => (s.kind === 'cushion' ? CUSHION_TOP : 0);
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
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // —— 渲染器与场景 ——
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // 调试：?debugview 时把着色器编译错误写进页面，便于排查
  if (new URL(location.href).searchParams.has('debugview')) {
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let shadowsOn = localStorage.getItem('sansa.shadows') !== '0';
  renderer.shadowMap.enabled = shadowsOn;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.appendChild(renderer.domElement);

  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
  const bootMsg = document.getElementById('boot-msg')!;
  await preloadTextures((d, n) => (bootMsg.textContent = `${t('opening')} · ${Math.round((d / n) * 100)}%`));
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // 室外反射用森林全景照片
  const skyTex = loadTexture('sky.jpg');
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(skyTex).texture;
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 900);

  const env = new Environment(scene, renderer);
  const timeParam = new URL(location.href).searchParams.get('time') as TimeMode | null;
  env.setMode(timeParam && ['auto', 'dawn', 'day', 'dusk', 'night'].includes(timeParam) ? timeParam : (localStorage.getItem('sansa.time') as TimeMode) || 'auto');
  if (isTouch) env.sun.shadow.mapSize.set(1024, 1024);
  buildTerrain(scene);
  const hall = buildHall(scene);
  const nature = buildNature(scene);
  const props = buildProps(scene);
  const buildings = buildBuildings(scene);
  const altarIncense = new IncenseSpot(hall.group, ALTAR_BURNER.x, hall.altarSandY, ALTAR_BURNER.z, 0.27, 18, 0.3);
  props.setLanternLevel(env.lanternLevel);
  placeStatues(hall.group, hall.statueSlots, roomEnv);
  // 金身佛像用室内环境光反射
  hall.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && (m as any).isMeshStandardMaterial && m.metalness >= 0.75) {
      m.envMap = roomEnv;
      m.envMapIntensity = 1.5;
    }
  });

  const walkables: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.name === 'walkable') walkables.push(o);
  });
  const interactives = [...hall.interactives, ...props.interactives, ...buildings.bell.interactives, ...buildings.drum.interactives];

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
    statusAction: () => {
      if (player.seat || claimed) standUp();
    },
    moktakStrike: () => strikeMoktak(),
    moktakAuto: () => toggleMoktakAuto(),
    moktakClose: () => closeMoktak(),
    rosaryClose: () => closeRosary(),
    langChanged: () => {
      renderMyTag();
      refreshStatus();
      ui.setMoktak(!!moktakAuto, moktakCount);
      ui.setRosary(beadCount);
    },
  });
  audio.onChange(() => ui.setSound(audio.enabled, audio.chanting));
  ui.setRoom(0, 1, 50, false);
  ui.setMoktak(false, 0);
  ui.setRosary(0);

  // —— 玩家 ——
  const me = new Monk();
  scene.add(me.root);
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
  let intent: null | 'bow' | 'sit' | 'incense' | 'bell' | 'drum' = null;
  const keys = new Set<string>();

  const myTag = document.createElement('div');
  myTag.className = 'tag';
  ui.tags.appendChild(myTag);
  function renderMyTag() {
    myTag.innerHTML = `<span class="me">${t('me')}</span>${escapeHtml(name)}`;
  }
  renderMyTag();

  me.onBowTouch = () => audio.bell(0.32);
  me.onBowDone = () => {
    sessionBows++;
    bowsToday++;
    localStorage.setItem('sansa.bows', JSON.stringify({ date: today(), n: bowsToday }));
    refreshStatus();
  };

  function refreshStatus() {
    if (me.action === 'bow') ui.setStatus('bowCount', 'stop', { n: sessionBows + 1 });
    else if (player.seat) ui.setStatus('sit', 'standUp');
    else if (claimed && intent === 'bow') ui.setStatus('walkingToCushion', 'stop');
    else if (claimed) ui.setStatus('walkingToSeat', 'stop');
    else if (intent === 'incense') ui.setStatus('incenseWalking');
    else if (intent === 'bell') ui.setStatus('bellWalking');
    else if (intent === 'drum') ui.setStatus('drumWalking');
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
  function endIncenseScene() {
    cine.on = false;
    ui.showCaption(null);
    ui.root.classList.remove('cine');
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
    }
  }

  // —— 钟楼：撞钟 ——
  let lastBell = 0;
  // 钟楼撞钟、鼓楼击鼓（晨钟暮鼓），同房间的人也会听到
  const lastStrike: Record<'bell' | 'drum', number> = { bell: 0, drum: 0 };
  function strikeInstrument(kind: 'bell' | 'drum') {
    if (performance.now() - lastStrike[kind] < (kind === 'bell' ? 15000 : 4000)) {
      ui.toast(t('bellCooldown'));
      return;
    }
    if (player.seat) standUp();
    if (overlay) overlay === 'moktak' ? closeMoktak() : closeRosary();
    intent = kind;
    refreshStatus();
    const b = kind === 'bell' ? buildings.bell : buildings.drum;
    walkTo(b.standX, b.standZ, () => {
      intent = null;
      player.yaw = b.standYaw;
      lastStrike[kind] = performance.now();
      me.setAction('hapjang');
      refreshStatus();
      b.strike();
      setTimeout(() => {
        if (kind === 'bell') audio.templeBell();
        else audio.drum();
        net.ringBell(kind);
      }, kind === 'bell' ? 1050 : 320);
      setTimeout(() => {
        if (me.action === 'hapjang') me.setAction(baseAction());
      }, HAPJANG_DURATION * 1000);
    });
  }
  net.on('bell', (_from, kind) => {
    const b = kind === 'drum' ? buildings.drum : buildings.bell;
    b.strike();
    setTimeout(() => (kind === 'drum' ? audio.drum(0.6) : audio.templeBell(0.6)), kind === 'drum' ? 320 : 1050);
  });

  // —— 木鱼 ——
  function openMoktak() {
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
    if (moktakAuto) toggleMoktakAuto();
    stage.show(null);
    ui.showMoktak(false);
    if (me.action === 'moktak') me.setAction('idle');
    refreshStatus();
  }
  function strikeMoktak() {
    moktakView.strike();
    me.strike();
    audio.moktak();
    moktakCount++;
    ui.setMoktak(!!moktakAuto, moktakCount);
  }
  function toggleMoktakAuto() {
    if (moktakAuto) {
      clearInterval(moktakAuto);
      moktakAuto = 0;
    } else {
      strikeMoktak();
      moktakAuto = window.setInterval(strikeMoktak, 640);
    }
    ui.setMoktak(!!moktakAuto, moktakCount);
  }

  // —— 念珠 ——
  rosaryView.onBead = () => {
    beadCount++;
    audio.bead();
    ui.setRosary(beadCount);
    if (beadCount % 108 === 0) {
      audio.bell(0.4);
      ui.toast(t('rosaryRoundDone', { n: beadCount / 108 }));
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
  }
  const remotes = new Map<string, Remote>();
  function removeRemote(id: string) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.monk.root);
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
        const tag = document.createElement('div');
        tag.className = 'tag other';
        ui.tags.appendChild(tag);
        r = { id: p.id, name: '', monk, tag, x: p.x, z: p.z, yaw: p.yaw, tx: p.x, tz: p.z, tyaw: p.yaw, a: p.a, s: p.s, n: p.n };
        remotes.set(p.id, r);
      }
      if (r.name !== p.name) {
        r.name = p.name;
        r.tag.textContent = p.name;
      }
      r.tx = p.x;
      r.tz = p.z;
      r.tyaw = p.yaw;
      r.a = p.a;
      r.s = p.s;
      r.n = p.n;
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
    const list: Visitor[] = [{ name, me: true, status: t(STATUS_KEY[me.action]), bows: bowsToday }];
    for (const r of remotes.values()) list.push({ name: r.name, me: false, status: t(STATUS_KEY[r.a] ?? 'statusIdle'), bows: r.n });
    ui.setVisitors(list);
  }, 1000);

  // —— 镜头 ——
  const cam = { yaw: 0, pitch: 0.3, dist: isTouch ? 6.4 : 5.6, tx: player.x, ty: 1, tz: player.z };
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
  }
  const camRay = new THREE.Raycaster();
  const tmpV = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  function updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 9);
    cam.tx += (player.x - cam.tx) * k;
    cam.tz += (player.z - cam.tz) * k;
    const targetY = player.y + (me.action === 'bow' || me.action === 'sit' ? 0.55 : 0.95);
    cam.ty += (targetY - cam.ty) * k;
    tmpT.set(cam.tx, cam.ty, cam.tz);
    const cp = Math.cos(cam.pitch);
    const dir = tmpV.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    let d = cam.dist;
    camRay.set(tmpT, dir);
    camRay.far = d + 0.3;
    const hit = camRay.intersectObjects(hall.blockers, true)[0];
    if (hit) d = Math.max(0.8, hit.distance - 0.3);
    const pos = tmpT.clone().addScaledVector(dir, d);
    // 在殿内时镜头不要穿过天花板
    const inside = pos.x > -HALL.wallX && pos.x < HALL.wallX && pos.z > HALL.backZ && pos.z < HALL.colZFront;
    if (inside) pos.y = Math.min(pos.y, HALL.baseH + HALL.colH + 0.6);
    pos.y = Math.max(pos.y, heightAt(pos.x, pos.z) + 0.3);
    if (cine.on && me.action !== 'incense') endIncenseScene();
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
    if (overlay) return;
    const p = pick(cx, cy);
    if (!p) return;
    if (p.interact?.type === 'seat') {
      const seat = SEAT_BY_ID.get(p.interact.id);
      if (seat) goToSeat(seat, 'sit');
      return;
    }
    if (p.interact?.type === 'incense' || p.interact?.type === 'altarIncense') {
      requestIncense(p.interact.type === 'altarIncense' ? 'altar' : 'yard');
      return;
    }
    if (p.interact?.type === 'bell' || p.interact?.type === 'drum') {
      strikeInstrument(p.interact.type);
      return;
    }
    cancelIntent();
    if (me.action === 'hapjang' || me.action === 'incense') me.setAction(baseAction());
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
    } else if (it?.type === 'incense' || it?.type === 'altarIncense') label = t('incense');
    else if (it?.type === 'bell') label = t('ringBell');
    else if (it?.type === 'drum') label = t('beatDrum');
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
  function updatePlayer(dt: number) {
    let dx = 0;
    let dz = 0;
    if (keys.size && !overlay) {
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
      const speed = 2.7;
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
    const lift = me.action === 'bow' || me.action === 'sit' ? 1.15 : 1.5;
    placeTag(myTag, player.x, player.y + lift, player.z, 60);
    myTag.style.visibility = overlay ? 'hidden' : 'visible';
    for (const r of remotes.values()) {
      const y = r.monk.root.position.y + (r.a === 'bow' || r.a === 'sit' ? 1.15 : 1.5);
      placeTag(r.tag, r.x, y, r.z, 24);
      r.tag.style.visibility = overlay ? 'hidden' : 'visible';
    }
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
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
  let envTimer = 0;
  let booted = false;
  function frame() {
    requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(0.05, clock.getDelta()) * slowmo;
    elapsed += dt;
    updatePlayer(dt);
    checkIncenseDone();
    updateRemotes(dt);
    updateCamera(dt);
    nature.update(dt, elapsed);
    props.update(dt, elapsed);
    altarIncense.update(dt, elapsed);
    buildings.bell.update(dt);
    buildings.drum.update(dt);
    env.follow(player.x, player.z);
    for (const [i, f] of hall.candleFlames.entries()) f.scale.set(1, 2.2 + Math.sin(elapsed * 9 + i * 2) * 0.25, 1);
    if (markerLife > 0) {
      markerLife -= dt * 1.2;
      (marker.material as THREE.MeshBasicMaterial).opacity = Math.max(0, markerLife) * 0.8;
      marker.scale.setScalar(1 + (1 - markerLife) * 0.6);
    }
    envTimer += dt;
    if (envTimer > 30) {
      envTimer = 0;
      env.update();
      props.setLanternLevel(env.lanternLevel);
    }
    env.sky.position.copy(camera.position);
    renderer.render(scene, camera);
    stage.render(dt);
    updateTags();
    net.sendState({ x: player.x, z: player.z, yaw: player.yaw, a: me.action, s: player.seat?.id ?? claimed?.id ?? null, n: bowsToday });
    if (!booted) {
      booted = true;
      bootEl.classList.add('gone');
      setTimeout(() => bootEl.remove(), 1000);
    }
  }
  frame();
  onLangChange(() => {
    document.getElementById('boot-title') && (document.getElementById('boot-title')!.textContent = t('title'));
  });
}

start().catch(fail);
