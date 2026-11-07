// 多人同场：WebSocket 客户端。服务器不可用时自动退回单机模式并定时重连
import type { Action } from './monk';

export interface RemoteState {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  a: Action;
  s: string | null; // 占用的座位
  n: number; // 今天的礼拜数
}

export interface RoomInfo {
  id: number;
  count: number;
  capacity: number;
}

export type IncensePlace = 'yard' | 'altar';

export interface IncenseItem {
  id: string;
  place?: IncensePlace;
  by: string;
  owner: string;
  until: number;
  start: number;
}

type Events = {
  status: (s: 'connecting' | 'online' | 'offline' | 'full') => void;
  welcome: (info: { id: string; room: number; capacity: number }) => void;
  snapshot: (players: RemoteState[]) => void;
  leave: (id: string) => void;
  incense: (list: IncenseItem[], serverNow: number) => void;
  claim: (seat: string, ok: boolean) => void;
  bell: (from: string) => void;
};

export class Net {
  id = '';
  room = 0;
  capacity = 50;
  status: 'connecting' | 'online' | 'offline' | 'full' = 'connecting';
  private ws: WebSocket | null = null;
  private handlers: { [K in keyof Events]?: Events[K][] } = {};
  private retry = 0;
  private lastSent = '';
  private lastSentAt = 0;
  private name = '';
  private wantRoom = 0;
  private closedByUser = false;

  on<K extends keyof Events>(k: K, fn: Events[K]) {
    ((this.handlers[k] ||= []) as Events[K][]).push(fn);
  }
  private emit<K extends keyof Events>(k: K, ...args: Parameters<Events[K]>) {
    (this.handlers[k] || []).forEach((fn) => (fn as any)(...args));
  }

  private url(path: string, ws = false) {
    const u = new URL(path, document.baseURI);
    if (ws) u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.toString();
  }

  async rooms(): Promise<RoomInfo[]> {
    const res = await fetch(this.url('api/rooms'), { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  connect(name: string, room = 0) {
    this.name = name;
    this.wantRoom = room;
    this.closedByUser = false;
    this.open();
  }

  private setStatus(s: Net['status']) {
    this.status = s;
    this.emit('status', s);
  }

  private open() {
    this.ws?.close();
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url('ws', true));
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      ws.send(JSON.stringify({ t: 'hello', name: this.name, room: this.wantRoom }));
    };
    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.t) {
        case 'welcome':
          this.id = msg.id;
          this.room = msg.room;
          this.capacity = msg.capacity;
          this.wantRoom = msg.room;
          this.lastSent = '';
          this.setStatus('online');
          this.emit('welcome', { id: msg.id, room: msg.room, capacity: msg.capacity });
          break;
        case 'full':
          this.setStatus('full');
          this.closedByUser = true;
          ws.close();
          break;
        case 'snap':
          this.emit(
            'snapshot',
            (msg.p as any[]).map((p) => ({ id: p[0], name: p[1], x: p[2], z: p[3], yaw: p[4], a: p[5], s: p[6], n: p[7] }))
          );
          break;
        case 'leave':
          this.emit('leave', msg.id);
          break;
        case 'incense':
          this.emit('incense', msg.list, msg.now);
          break;
        case 'claim':
          this.emit('claim', msg.seat, msg.ok);
          break;
        case 'bell':
          this.emit('bell', msg.from);
          break;
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedByUser) {
        if (this.status !== 'full') this.setStatus('offline');
        return;
      }
      this.setStatus('offline');
      this.scheduleRetry();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleRetry() {
    const delay = Math.min(30000, 2000 * Math.pow(1.6, this.retry++));
    setTimeout(() => {
      if (!this.closedByUser) this.open();
    }, delay);
  }

  switchRoom(room: number) {
    this.wantRoom = room;
    this.closedByUser = false;
    this.open();
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
    this.setStatus('offline');
  }

  get online() {
    return this.ws?.readyState === WebSocket.OPEN && this.status === 'online';
  }

  private send(obj: unknown) {
    if (this.online) this.ws!.send(JSON.stringify(obj));
  }

  sendState(s: { x: number; z: number; yaw: number; a: Action; s: string | null; n: number }) {
    const now = performance.now();
    const r = (v: number) => Math.round(v * 100) / 100;
    const key = `${r(s.x)},${r(s.z)},${r(s.yaw)},${s.a},${s.s},${s.n}`;
    // 状态没变就不发；变了最多每秒 10 次
    if (key === this.lastSent && now - this.lastSentAt < 3000) return;
    if (now - this.lastSentAt < 100) return;
    this.lastSent = key;
    this.lastSentAt = now;
    this.send({ t: 'state', x: r(s.x), z: r(s.z), yaw: r(s.yaw), a: s.a, s: s.s, n: s.n });
  }

  setName(name: string) {
    this.name = name;
    this.send({ t: 'name', name });
  }

  claim(seat: string) {
    this.send({ t: 'claim', seat });
  }

  release() {
    this.send({ t: 'release' });
  }

  offerIncense(place: IncensePlace) {
    this.send({ t: 'incense', place });
  }

  ringBell() {
    this.send({ t: 'bell' });
  }
}
