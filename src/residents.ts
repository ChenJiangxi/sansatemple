// 常住僧人与时刻表。所有动作都由「服务器时间」推算，同一房间的人看到的是同一场：
//   每小时 0 分：钟头撞钟三下 → 大众从两侧配殿走进大雄宝殿 → 1–5 分大殿共修（礼拜、木鱼、引磬、诵经）→ 散去
//   每小时 30 分：鼓头击鼓九下
// 扫地僧沿院子一圈慢慢扫，知客僧在入口迎客，老和尚在银杏下打坐，香灯师和维那守在殿里。
import * as THREE from 'three';
import { Monk, type Action, BOW_DURATION } from './monk';
import { planRoute, heightAt, SIDE_HALLS, SPAWN, HALL } from './layout';
import type { StrikeBuild } from './world/buildings';

export type Role = 'sweeper' | 'greeter' | 'elder' | 'xiangdeng' | 'weina' | 'bell' | 'drum' | 'assembly';

// 一小时里的时刻（秒）
export const SVC = { bell: [3, 11, 19], gather: 25, chant: 62, end: 300, gone: 348, drum: 1800 };
const DRUM_BEATS = 9;

type P = { x: number; z: number };
interface Resident {
  role: Role;
  monk: Monk;
  post: P & { yaw: number; action: Action };
  route?: P[]; // 大众：从配殿门口到大殿的路线
  len?: number;
  spot?: P;
  lastStrike: number; // 上次木鱼、钟、鼓的时刻（避免一秒里重复）
}

function polyline(pts: P[]) {
  const segs: { a: P; b: P; l: number }[] = [];
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    segs.push({ a: pts[i - 1], b: pts[i], l });
    len += l;
  }
  return {
    len,
    at(d: number) {
      let r = Math.max(0, Math.min(len, d));
      for (const s of segs) {
        if (r <= s.l) {
          const k = s.l ? r / s.l : 0;
          return { x: s.a.x + (s.b.x - s.a.x) * k, z: s.a.z + (s.b.z - s.a.z) * k, yaw: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z) };
        }
        r -= s.l;
      }
      const s = segs[segs.length - 1];
      return { x: s.b.x, z: s.b.z, yaw: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z) };
    },
  };
}
const route = (pts: P[]) => {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) out.push(...planRoute(out[out.length - 1].x, out[out.length - 1].z, pts[i].x, pts[i].z));
  return out;
};

export interface ResidentsOpts {
  bell: StrikeBuild;
  drum: StrikeBuild;
  onBell(): void; // 钟头撞了一下（调用方放钟声）
  onDrum(): void;
  onQing(): void; // 维那敲引磬
}

export function buildResidents(scene: THREE.Scene, o: ResidentsOpts) {
  const list: Resident[] = [];
  const add = (role: Role, style: 'resident' | 'elder', post: Resident['post']) => {
    const monk = new Monk(style);
    monk.root.position.set(post.x, heightAt(post.x, post.z), post.z);
    monk.root.rotation.y = post.yaw;
    monk.setAction(post.action);
    monk.root.traverse((m) => (m.userData.interact = { type: 'npc', role }));
    scene.add(monk.root);
    const r: Resident = { role, monk, post, lastStrike: -1 };
    list.push(r);
    return r;
  };

  // 殿内：香灯师守木鱼，维那守引磬（都在佛前供桌两侧，面朝佛像）
  const fy = HALL.baseH;
  add('xiangdeng', 'resident', { x: -3.95, z: -16.55, yaw: Math.PI, action: 'idle' });
  add('weina', 'resident', { x: 3.95, z: -16.55, yaw: Math.PI, action: 'idle' });
  // 钟头、鼓头站在钟鼓旁
  add('bell', 'resident', { x: o.bell.standX - 0.9, z: o.bell.standZ + 0.6, yaw: Math.PI / 2, action: 'idle' });
  add('drum', 'resident', { x: o.drum.standX + 0.9, z: o.drum.standZ + 0.6, yaw: -Math.PI / 2, action: 'idle' });
  // 知客僧：站在新来的人进寺的地方旁边
  const greeter = add('greeter', 'resident', { x: SPAWN.x + 3.2, z: SPAWN.z - 1.0, yaw: -Math.PI / 2, action: 'idle' });
  // 老和尚：银杏树下打坐（垫一个蒲团）
  const elderPos = { x: -7.6, z: 29.6 };
  const elder = add('elder', 'elder', { ...elderPos, yaw: Math.PI * 0.75, action: 'sit' });
  {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 24), new THREE.MeshStandardMaterial({ color: '#c8952f', roughness: 0.9 }));
    pad.position.set(elderPos.x, heightAt(elderPos.x, elderPos.z) + 0.07, elderPos.z + 0.3);
    pad.receiveShadow = true;
    scene.add(pad);
    elder.monk.root.position.y += 0.12;
  }
  // 扫地僧：沿院子一圈，每到一处停下扫一会儿
  const sweeper = add('sweeper', 'resident', { x: -6, z: 14, yaw: 0, action: 'sweep' });
  const sweepStops: P[] = [
    { x: -6.5, z: 14 }, { x: -12, z: 22 }, { x: -14, z: 34 }, { x: -6, z: 40 }, { x: 6.5, z: 40 },
    { x: 14, z: 33 }, { x: 12.5, z: 22 }, { x: 7, z: 13 }, { x: 0.5, z: 4.5 },
  ];
  const sweepPath = polyline(route([...sweepStops, sweepStops[0]]));
  // 一圈：走 0.75 m/s，每个停点扫 9 秒
  const SWEEP_V = 0.75, SWEEP_STAY = 9;
  const stopD: number[] = [];
  {
    let acc = 0;
    const pts = route([...sweepStops, sweepStops[0]]);
    let k = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const s = sweepStops[k % sweepStops.length];
      if (Math.hypot(pts[i].x - s.x, pts[i].z - s.z) < 0.6 && (stopD.length === 0 || acc - stopD[stopD.length - 1] > 1)) {
        stopD.push(acc);
        k++;
      }
    }
  }
  const sweepPeriod = sweepPath.len / SWEEP_V + stopD.length * SWEEP_STAY;
  // 扫地僧在一圈里的第 tt 秒在哪、在扫还是在走
  function sweeperAt(tt: number) {
    let t = tt;
    let d = 0;
    for (let i = 0; i < stopD.length; i++) {
      const walk = (stopD[i] - d) / SWEEP_V;
      if (t < walk) return { d: d + t * SWEEP_V, sweeping: false };
      t -= walk;
      d = stopD[i];
      if (t < SWEEP_STAY) return { d, sweeping: true };
      t -= SWEEP_STAY;
    }
    return { d: Math.min(sweepPath.len, d + t * SWEEP_V), sweeping: false };
  }

  // 大众：四位，两位从观音殿、两位从地藏殿走来，在供桌两侧跪拜
  const spots: P[] = [{ x: -6.3, z: -16.9 }, { x: -5.0, z: -16.9 }, { x: 5.0, z: -16.9 }, { x: 6.3, z: -16.9 }];
  const assembly: Resident[] = spots.map((spot, i) => {
    const H = SIDE_HALLS[i < 2 ? 0 : 1];
    const sx = H.x < 0 ? 1 : -1;
    const door = { x: H.x + sx * 5.2, z: H.z + (i % 2 ? 1.2 : -1.2) };
    const out = { x: H.x + sx * 6.6, z: door.z };
    const pts = route([out, spot]);
    pts.unshift(door);
    const r = add('assembly', 'resident', { x: door.x, z: door.z, yaw: 0, action: 'walk' });
    r.route = pts;
    r.len = polyline(pts).len;
    r.spot = spot;
    r.monk.root.visible = false;
    return r;
  });
  const assemblyPaths = assembly.map((r) => polyline(r.route!));

  const tmp = new THREE.Vector3();
  let greetAt = -999;
  let greetWall = 0;
  const greeterYaw = greeter.post.yaw;

  return {
    interactives: [sweeper.monk.root, greeter.monk.root, elder.monk.root] as THREE.Object3D[],
    list,
    // 当前处在时刻表的哪一段（给界面用）
    phase(s: number): { kind: 'idle' | 'soon' | 'bell' | 'gather' | 'chant' | 'disperse'; toStart: number } {
      if (s < SVC.gather) return { kind: 'bell', toStart: SVC.chant - s };
      if (s < SVC.chant) return { kind: 'gather', toStart: SVC.chant - s };
      if (s < SVC.end) return { kind: 'chant', toStart: 0 };
      if (s < SVC.gone) return { kind: 'disperse', toStart: 3600 - s + SVC.chant };
      const to = 3600 - s + SVC.chant;
      return { kind: to < 4 * 60 ? 'soon' : 'idle', toStart: to };
    },
    // 知客僧：玩家走近时转身合十（一分钟内只迎一次）
    greet(px: number, pz: number, now: number) {
      const g = greeter.monk.root.position;
      if (Math.hypot(px - g.x, pz - g.z) < 4.2 && now - greetAt > 60) {
        greetAt = now;
        greetWall = Date.now() / 1000;
        greeter.post.yaw = Math.atan2(px - g.x, pz - g.z);
        greeter.monk.setAction('hapjang');
        return true;
      }
      return false;
    },
    update(dt: number, nowMs: number, camPos: THREE.Vector3) {
      const hourS = (nowMs / 1000) % 3600;
      const hourN = Math.floor(nowMs / 3600000);
      for (const r of list) {
        const m = r.monk;
        if (r.role === 'assembly') continue;
        if (r.role === 'sweeper') {
          const st = sweeperAt((nowMs / 1000) % sweepPeriod);
          const p = sweepPath.at(st.d);
          m.root.position.set(p.x, heightAt(p.x, p.z), p.z);
          // 扫地时身子微微转向一侧
          const yaw = st.sweeping ? p.yaw + 0.6 : p.yaw;
          m.root.rotation.y += Math.atan2(Math.sin(yaw - m.root.rotation.y), Math.cos(yaw - m.root.rotation.y)) * Math.min(1, dt * 4);
          m.speed = 0.75;
          const want: Action = st.sweeping ? 'sweep' : 'walk';
          if (m.action !== want) m.setAction(want);
        } else {
          m.root.rotation.y += Math.atan2(Math.sin(r.post.yaw - m.root.rotation.y), Math.cos(r.post.yaw - m.root.rotation.y)) * Math.min(1, dt * 3);
        }
        // 殿内两位：共修时一位敲木鱼、一位合十
        if (r.role === 'xiangdeng' || r.role === 'weina') {
          const chanting = hourS >= SVC.chant && hourS < SVC.end;
          const want: Action = chanting && r.role === 'xiangdeng' ? 'moktak' : 'idle';
          if (m.action !== want && m.action !== 'hapjang') m.setAction(want);
          if (chanting && r.role === 'xiangdeng') {
            const beat = Math.floor(hourS / 1.1);
            if (beat !== r.lastStrike) {
              r.lastStrike = beat;
              m.strike();
            }
          }
          if (r.role === 'weina') {
            const q = Math.floor((hourS - SVC.chant) / 24);
            const hit = (hourS >= SVC.chant && hourS < SVC.end && q !== r.lastStrike) || (hourS >= SVC.end && hourS < SVC.end + 1 && r.lastStrike !== 999);
            if (hit) {
              r.lastStrike = hourS >= SVC.end ? 999 : q;
              m.setAction('hapjang');
              o.onQing();
            }
            if (hourS < SVC.chant) r.lastStrike = -1;
          }
        }
        // 钟头：每小时开头撞三下；鼓头：半点击鼓九下
        if (r.role === 'bell') {
          const i = SVC.bell.findIndex((b) => hourS >= b && hourS < b + 1);
          const key = hourN * 10 + i;
          if (i >= 0 && r.lastStrike !== key) {
            r.lastStrike = key;
            m.setAction('hapjang');
            o.bell.strike();
            o.onBell();
          }
        }
        if (r.role === 'drum') {
          const k = Math.floor((hourS - SVC.drum) / 1.5);
          if (k >= 0 && k < DRUM_BEATS && r.lastStrike !== hourN * 100 + k) {
            r.lastStrike = hourN * 100 + k;
            if (k === 0) m.setAction('hapjang');
            o.drum.strike();
            o.onDrum();
          }
        }
        if (m.action === 'hapjang' && m.actionTime > 2.4) m.setAction(r.post.action);
        if (r.role === 'greeter' && Date.now() / 1000 - greetWall > 9) r.post.yaw = greeterYaw;
        m.update(dt);
      }

      // 大众：按时刻表走进来、跪拜、走回去；不在场时隐藏
      assembly.forEach((r, i) => {
        const m = r.monk;
        const path = assemblyPaths[i];
        let visible = true;
        if (hourS >= SVC.gather && hourS < SVC.chant) {
          const speed = Math.max(1.1, path.len / (SVC.chant - SVC.gather - 4));
          const p = path.at((hourS - SVC.gather) * speed);
          m.root.position.set(p.x, heightAt(p.x, p.z), p.z);
          m.root.rotation.y = p.yaw;
          m.speed = speed;
          if (m.action !== 'walk') m.setAction('walk');
          if ((hourS - SVC.gather) * speed >= path.len) {
            m.root.rotation.y = Math.PI;
            if (m.action !== 'hapjang') m.setAction('hapjang');
          }
        } else if (hourS >= SVC.chant && hourS < SVC.end) {
          m.root.position.set(r.spot!.x, fy, r.spot!.z);
          m.root.rotation.y = Math.PI;
          if (m.action !== 'bow') {
            m.setAction('bow');
            // 大家一起拜：按时刻表对齐每一拜的起点
            m.actionTime = (hourS - SVC.chant) % BOW_DURATION;
          }
        } else if (hourS >= SVC.end && hourS < SVC.gone) {
          const speed = Math.max(1.1, path.len / (SVC.gone - SVC.end - 6));
          const d = path.len - (hourS - SVC.end - 2) * speed;
          if (hourS - SVC.end < 2) {
            m.root.position.set(r.spot!.x, fy, r.spot!.z);
            if (m.action !== 'hapjang') m.setAction('hapjang');
          } else {
            const p = path.at(d);
            m.root.position.set(p.x, heightAt(p.x, p.z), p.z);
            m.root.rotation.y = p.yaw + Math.PI;
            m.speed = speed;
            if (m.action !== 'walk') m.setAction('walk');
            if (d <= 0) visible = false;
          }
        } else visible = false;
        m.root.visible = visible && m.root.position.distanceTo(camPos) < 70;
        if (m.root.visible) m.update(dt);
      });

      // 远处的人不画（省手机）
      for (const r of list) {
        if (r.role === 'assembly') continue;
        tmp.copy(r.monk.root.position);
        r.monk.root.visible = tmp.distanceTo(camPos) < 70;
      }
    },
  };
}
