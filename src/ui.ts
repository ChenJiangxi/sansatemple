// 界面层：顶部两组胶囊按钮、底部动作栏、提示与面板。全部原生 DOM。
import { t, getLang, setLang, onLangChange, LANG_LABELS, type Lang, type Key } from './i18n';
import { sealBook, practicePanel, type PracticeTab } from './ui-extra';
import type { Look } from './looks';

const svg = (body: string, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  exit: svg('<path d="M14.5 6 8.5 12l6 6"/>'),
  chevron: svg('<path d="m7 10 5 5 5-5"/>', 14),
  people: svg('<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c.6-3 2.8-5 5.5-5s4.9 2 5.5 5"/><path d="M15.5 5a3 3 0 0 1 0 6m2.5 8.5c-.3-1.8-1.1-3.2-2.3-4.1"/>', 16),
  soundOn: svg('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="m16 9.5 5 5m0-5-5 5"/>'),
  settings: svg('<path d="M5 8h9M18 8h1M5 16h3M12 16h7"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>'),
  hapjang: svg('<path d="M11.4 20V9.6c0-1.6-.6-3.2-1.5-4.4L9 4"/><path d="M12.6 20V9.6c0-1.6.6-3.2 1.5-4.4L15 4"/><path d="M9 4c-1.4 2.6-2 5.4-2 8.2V16l3 4M15 4c1.4 2.6 2 5.4 2 8.2V16l-3 4"/>', 22),
  bow: svg('<circle cx="9" cy="7" r="2.2"/><path d="M5 19.5h14M7 19.5c0-3 1-5.5 3.5-6.5l4 1.2c1.6.5 2.6 2 2.6 3.7v1.6"/><path d="M10.5 13l3-3.2"/>', 22),
  moktak: svg('<path d="M4.5 13c0-4 3.6-7 7.8-7 3.5 0 6.2 2.3 7.2 5.3.3 1-.4 2-1.4 2.2l-3.4.6"/><path d="M4.5 13c.6 3.2 3.7 5.5 7.4 5.5 3.3 0 6-1.8 7.1-4.4"/><path d="M9 13.2h6.5"/><circle cx="8.3" cy="10" r=".6" fill="currentColor"/>', 22),
  rosary: svg('<circle cx="12" cy="11" r="6.2"/><circle cx="12" cy="4.8" r="1.2" fill="currentColor"/><circle cx="18.2" cy="11" r="1.2" fill="currentColor"/><circle cx="5.8" cy="11" r="1.2" fill="currentColor"/><circle cx="7.6" cy="15.4" r="1.2" fill="currentColor"/><circle cx="16.4" cy="15.4" r="1.2" fill="currentColor"/><path d="M12 17.2v3.3M10.8 20.5h2.4"/>', 22),
  play: svg('<path d="M8 5.5v13l10-6.5z"/>', 16),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13"/>', 16),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>', 16),
  back: svg('<path d="M19 12H5m5-5-5 5 5 5"/>', 16),
  temple: svg('<path d="M2 11c5-1 8-4 10-7 2 3 5 6 10 7M4 12h16M7 13v7m10-7v7M4 20h16M10 15h4v5"/>', 32),
  incense: svg('<path d="M12 3c1 1.5-1 2.5 0 4M9 5c.7 1-.7 1.8 0 3M15 5c.7 1-.7 1.8 0 3"/><path d="M6 13h12l-1.5 5h-9z"/><path d="M12 9v4M9 10v3M15 10v3"/>', 18),
  practice: svg('<path d="M12 5.5c-1.8 2-2 5 0 7.5 2-2.5 1.8-5.5 0-7.5Z"/><path d="M12 13c-2.3-.2-5.2-1.5-6.6-3.6-.4 3 2.4 5.6 6.6 5.6s7-2.6 6.6-5.6C17.2 11.5 14.3 12.8 12 13Z"/><path d="M7 18.5h10"/>'),
  seal: svg('<path d="M9.5 4.5h5a1 1 0 0 1 1 1v3a2 2 0 0 1-1 1.7v1.3h-5v-1.3a2 2 0 0 1-1-1.7v-3a1 1 0 0 1 1-1Z"/><rect x="5" y="11.5" width="14" height="5" rx="1.5"/><path d="M6 19.5h12"/>'),
  sit: svg('<circle cx="12" cy="6" r="2.5"/><path d="M5 18.5c1.8-1.6 4.2-2.5 7-2.5s5.2.9 7 2.5M8.5 15l1-3.5h5l1 3.5"/>', 18),
};

type DockKind = 'hapjang' | 'bow' | 'moktak' | 'rosary';

export interface UIHandlers {
  dock(kind: DockKind): void;
  toggleSound(): void;
  toggleChant(): void;
  exit(): void;
  stay(): void;
  switchRoom(id: number): void;
  loadRooms(): Promise<{ id: number; count: number; capacity: number }[]>;
  setVolume(bus: 'ambient' | 'effects' | 'chant', v: number): void;
  getVolumes(): Record<'ambient' | 'effects' | 'chant', number>;
  setName(n: string): void;
  getName(): string;
  setTime(m: string): void;
  getTime(): string;
  setShadows(on: boolean): void;
  getShadows(): boolean;
  setQuality(q: 'high' | 'low'): void;
  getQuality(): 'high' | 'low';
  statusAction(): void;
  moktakStrike(): void;
  moktakAuto(): void;
  moktakClose(): void;
  rosaryClose(): void;
  langChanged(): void;
  getLook(): Look;
  setLook(l: Look): void;
  readSutra(id: string): void;
  dailyGo(id: string): void;
  getScript(): 't' | 's';
}

export interface Visitor {
  name: string;
  me: boolean;
  status: string;
  bows: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class UI {
  root: HTMLElement;
  tags: HTMLElement;
  private h: UIHandlers;
  private roomBtn!: HTMLButtonElement;
  private countBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  sealsBtn!: HTMLButtonElement;
  practiceBtn!: HTMLButtonElement;
  private exitBtn!: HTMLButtonElement;
  chantBtn!: HTMLButtonElement;
  // 左边一列（寺名牌、修行进度、共修提示、寺务提示从上往下排，不会互相压住）；底部操作栏右端放电台和快门
  leftCol!: HTMLElement;
  dockExtra!: HTMLElement;
  private hint!: HTMLElement;
  private status!: HTMLElement;
  private statusText!: HTMLElement;
  private statusBtn!: HTMLButtonElement;
  private toastEl!: HTMLElement;
  private dockBtns = new Map<DockKind, HTMLButtonElement>();
  private panel!: HTMLElement;
  private panelKind: string | null = null;
  private moktakBar!: HTMLElement;
  private moktakAutoBtn!: HTMLButtonElement;
  private moktakCount!: HTMLElement;
  private moktakHit!: HTMLButtonElement;
  private rosaryBox!: HTMLElement;
  private rosaryNum!: HTMLElement;
  private rosaryRound!: HTMLElement;
  private rosaryBar!: HTMLElement;
  private rosarySoundBtn!: HTMLButtonElement;
  rosaryPad!: HTMLElement;
  private scrim!: HTMLElement;
  private farewell!: HTMLElement;
  private tooltip!: HTMLElement;
  private caption!: HTMLElement;
  private visitors: Visitor[] = [];
  private room = 0;
  private count = 1;
  private capacity = 50;
  private online = false;
  private soundOn = false;
  private chantOn = false;
  private toastTimer = 0;
  private statusState: { text: Key | string; action?: Key; vars?: Record<string, string | number> } | null = null;
  private lastFocus: HTMLElement | null = null;

  constructor(parent: HTMLElement, h: UIHandlers) {
    this.h = h;
    this.root = el('div', 'hud');
    parent.appendChild(this.root);
    this.tags = el('div', 'tags');
    parent.insertBefore(this.tags, this.root);
    this.build();
    this.applyText();
    onLangChange(() => {
      this.applyText();
      h.langChanged();
    });
  }

  private build() {
    const r = this.root;
    // 左上：离开 | 山寺 01 ▾ | 人数
    // 左上：离开（圆钮）+ 寺名牌（第一行寺名和房间号，第二行在线人数），下面一条修行进度
    this.leftCol = el('div', 'left-col');
    const left = el('div', 'top-left');
    this.exitBtn = el('button', 'icon-btn glass-btn', ICON.exit);
    this.exitBtn.onclick = () => this.h.exit();
    const place = el('div', 'pill place');
    this.roomBtn = el('button', 'room-btn');
    this.roomBtn.onclick = () => this.togglePanel('servers', this.roomBtn);
    this.countBtn = el('button', 'count-btn');
    this.countBtn.onclick = () => this.togglePanel('visitors', this.countBtn);
    place.append(this.roomBtn, this.countBtn);
    left.append(this.exitBtn, place);
    // 称号、到下一级的功德进度、今日功课几项完成；点开修行面板
    this.practiceChip = el('button', 'pill practice-chip');
    this.practiceChip.onclick = () => this.openPractice('progress');
    this.leftCol.append(left, this.practiceChip);
    // 右上：竖排四个圆钮——修行、印谱、声音、设置
    const right = el('div', 'top-right');
    this.soundBtn = el('button', 'icon-btn glass-btn', ICON.soundOff);
    this.soundBtn.onclick = () => this.h.toggleSound();
    this.settingsBtn = el('button', 'icon-btn glass-btn', ICON.settings);
    this.settingsBtn.onclick = () => this.togglePanel('settings', this.settingsBtn);
    this.sealsBtn = el('button', 'icon-btn glass-btn', ICON.seal);
    this.sealsBtn.onclick = () => this.togglePanel('seals', this.sealsBtn);
    this.practiceBtn = el('button', 'icon-btn glass-btn', ICON.practice);
    this.practiceBtn.onclick = () => (this.panelKind === 'practice' ? this.closePanel() : this.openPractice(this.practiceTab));
    right.append(this.practiceBtn, this.sealsBtn, this.soundBtn, this.settingsBtn);
    // 听念佛：交给电台菜单当其中一项（radio-ui 会把它搬进去）
    this.chantBtn = el('button', 'radio-st chant-st');
    this.chantBtn.onclick = () => this.h.toggleChant();

    this.hint = el('div', 'hint');
    this.status = el('div', 'pill status');
    this.status.hidden = true;
    this.statusText = el('span', 'status-text');
    this.statusBtn = el('button', 'status-btn');
    this.statusBtn.onclick = () => this.h.statusAction();
    this.status.append(this.statusText, this.statusBtn);
    this.toastEl = el('div', 'toast');
    this.toastEl.setAttribute('role', 'status');
    this.toastEl.setAttribute('aria-live', 'polite');

    // 底部动作栏
    const dock = el('nav', 'pill dock');
    for (const k of ['hapjang', 'bow', 'moktak', 'rosary'] as DockKind[]) {
      const b = el('button', 'dock-btn');
      b.innerHTML = `${ICON[k]}<span></span><kbd>${{ hapjang: '3', bow: '1', moktak: '5', rosary: '2' }[k]}</kbd>`;
      b.onclick = () => this.h.dock(k);
      dock.appendChild(b);
      this.dockBtns.set(k, b);
    }
    this.dockExtra = el('div', 'dock-extra');
    dock.append(el('span', 'sep dock-sep'), this.dockExtra);

    this.panel = el('section', 'panel');
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog');

    // 木鱼与念珠的控制条
    this.scrim = el('div', 'scrim');
    this.moktakHit = el('button', 'moktak-hit');
    this.moktakHit.onpointerdown = (e) => {
      e.preventDefault();
      this.h.moktakStrike();
    };
    this.moktakBar = el('div', 'pill overlay-bar');
    this.moktakAutoBtn = el('button', 'bar-btn');
    this.moktakAutoBtn.onclick = () => this.h.moktakAuto();
    const mClose = el('button', 'icon-btn small', ICON.close);
    mClose.onclick = () => this.h.moktakClose();
    mClose.dataset.label = 'close';
    this.moktakCount = el('div', 'moktak-count');
    this.moktakBar.append(this.moktakAutoBtn, el('span', 'sep'), mClose);
    this.rosaryPad = el('div', 'rosary-pad');
    this.rosaryPad.tabIndex = 0;
    this.rosaryPad.setAttribute('role', 'img');
    this.rosaryBox = el('div', 'rosary-box');
    this.rosaryNum = el('div', 'rosary-num');
    this.rosaryRound = el('div', 'rosary-round');
    const rosaryHint = el('div', 'rosary-hint');
    rosaryHint.dataset.key = 'rosaryHint';
    this.rosaryBox.append(this.rosaryNum, this.rosaryRound, rosaryHint);
    this.rosaryBar = el('div', 'pill overlay-bar');
    const fold = el('button', 'bar-btn');
    fold.innerHTML = `${ICON.back}<span data-key="fold"></span>`;
    fold.onclick = () => this.h.rosaryClose();
    this.rosarySoundBtn = el('button', 'icon-btn small', ICON.soundOff);
    this.rosarySoundBtn.onclick = () => this.h.toggleSound();
    this.rosaryBar.append(fold, el('span', 'sep'), this.rosarySoundBtn);
    for (const e of [this.moktakHit, this.moktakBar, this.moktakCount, this.rosaryPad, this.rosaryBox, this.rosaryBar]) e.hidden = true;

    this.tooltip = el('div', 'tooltip');
    this.tooltip.hidden = true;
    this.caption = el('div', 'caption');
    this.caption.setAttribute('role', 'status');
    this.caption.innerHTML = '<strong></strong><small></small>';

    // 离开后的告别页
    this.farewell = el('main', 'farewell');
    this.farewell.hidden = true;
    this.farewell.innerHTML = `<span class="mark">${ICON.temple}</span><h1></h1><p></p><button class="stay-btn"></button>`;
    (this.farewell.querySelector('.stay-btn') as HTMLButtonElement).onclick = () => this.h.stay();

    r.append(this.leftCol, right, this.hint, this.toastEl, this.status, dock, this.panel, this.moktakHit, this.moktakCount, this.moktakBar, this.rosaryPad, this.rosaryBox, this.rosaryBar, this.tooltip, this.caption, this.farewell);

    // 模糊层要在主场景之上、特写画布之下
    const parent = r.parentElement!;
    parent.insertBefore(this.scrim, parent.querySelector('.overlay-canvas') ?? this.tags);

    document.addEventListener('pointerdown', (e) => {
      if (!this.panelKind) return;
      const tgt = e.target as Node;
      if (this.panel.contains(tgt) || this.roomBtn.contains(tgt) || this.countBtn.contains(tgt) || this.settingsBtn.contains(tgt) || this.sealsBtn.contains(tgt) || this.practiceBtn.contains(tgt) || this.practiceChip.contains(tgt)) return;
      this.closePanel();
    });
    // 提示几秒后淡出
    setTimeout(() => this.hint.classList.add('fade'), 9000);
  }

  applyText() {
    const set = (b: HTMLElement, key: Key) => {
      b.setAttribute('aria-label', t(key));
      b.title = t(key);
    };
    set(this.exitBtn, 'exit');
    set(this.settingsBtn, 'settings');
    set(this.sealsBtn, 'sealsTitle');
    this.dockBtns.forEach((b, k) => {
      (b.querySelector('span') as HTMLElement).textContent = t(k === 'bow' && b.classList.contains('active') ? 'stop' : k);
      b.setAttribute('aria-label', t(k === 'bow' && b.classList.contains('active') ? 'stop' : k));
    });
    const touch = matchMedia('(pointer: coarse)').matches;
    this.hint.textContent = t(touch ? 'hintTouch' : 'hintDesktop');
    this.root.querySelectorAll<HTMLElement>('[data-key]').forEach((e) => (e.textContent = t(e.dataset.key as Key)));
    this.root.querySelectorAll<HTMLElement>('[data-label]').forEach((e) => e.setAttribute('aria-label', t(e.dataset.label as Key)));
    this.moktakHit.setAttribute('aria-label', t('moktakTap'));
    this.rosaryPad.setAttribute('aria-label', t('rosaryAria'));
    (this.farewell.querySelector('h1') as HTMLElement).textContent = t('farewellTitle');
    (this.farewell.querySelector('p') as HTMLElement).innerHTML = t('farewellBody');
    (this.farewell.querySelector('.stay-btn') as HTMLElement).textContent = t('stayAgain');
    document.title = `${t('title')} · ${t('tagline')}`;
    this.renderTop();
    this.renderSound();
    this.renderStatus();
    if (this.panelKind) this.renderPanel();
  }

  // —— 顶部 ——
  setRoom(room: number, count: number, capacity: number, online: boolean) {
    this.room = room;
    this.count = count;
    this.capacity = capacity;
    this.online = online;
    this.renderTop();
  }

  private renderTop() {
    const roomNo = this.room ? String(this.room).padStart(2, '0') : '—';
    this.roomBtn.innerHTML = `<strong>${t('server')}</strong><span class="room-no">· ${roomNo}</span>${ICON.chevron}`;
    this.roomBtn.setAttribute('aria-label', `${t('server')} ${roomNo}. ${t('serverSelect')}`);
    this.countBtn.innerHTML = `<i class="${this.online ? 'live' : 'off'}"></i>${t('hudPeople', { n: this.online ? this.count : 1 })}`;
    this.countBtn.setAttribute('aria-label', `${this.online ? this.count : 1}${t('people')} · ${t('visitors')}`);
  }

  setSound(on: boolean, chant: boolean) {
    this.soundOn = on;
    this.chantOn = chant;
    this.renderSound();
  }

  private renderSound() {
    this.soundBtn.innerHTML = this.soundOn ? ICON.soundOn : ICON.soundOff;
    this.soundBtn.setAttribute('aria-label', t(this.soundOn ? 'soundOff' : 'soundOn'));
    this.soundBtn.title = t(this.soundOn ? 'soundOff' : 'soundOn');
    this.soundBtn.classList.toggle('on', this.soundOn);
    this.rosarySoundBtn.innerHTML = this.soundOn ? ICON.soundOn : ICON.soundOff;
    this.rosarySoundBtn.setAttribute('aria-label', t(this.soundOn ? 'soundOff' : 'soundOn'));
    this.chantBtn.innerHTML = `<i></i><span>${t(this.chantOn ? 'chantOff' : 'chantOn')}</span>`;
    this.chantBtn.classList.toggle('on', this.chantOn);
    this.chantBtn.setAttribute('aria-pressed', String(this.chantOn));
  }

  // —— 底部动作栏 ——
  setDockActive(kind: DockKind | null) {
    this.dockBtns.forEach((b, k) => b.classList.toggle('active', k === kind));
    this.applyDockLabels();
  }

  private applyDockLabels() {
    this.dockBtns.forEach((b, k) => {
      const label = t(k === 'bow' && b.classList.contains('active') ? 'stop' : k);
      (b.querySelector('span') as HTMLElement).textContent = label;
      b.setAttribute('aria-label', label);
    });
  }

  // —— 状态条（礼拜计数、走向蒲团等）——
  setStatus(text: Key | string | null, action?: Key, vars?: Record<string, string | number>) {
    this.statusState = text ? { text, action, vars } : null;
    this.renderStatus();
  }

  private renderStatus() {
    const s = this.statusState;
    this.status.hidden = !s;
    if (!s) return;
    let txt: string;
    try {
      txt = t(s.text as Key, s.vars);
    } catch {
      txt = String(s.text);
    }
    this.statusText.textContent = txt;
    this.statusBtn.hidden = !s.action;
    if (s.action) this.statusBtn.textContent = t(s.action);
  }

  toast(msg: string, ms = 3200) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  showTooltip(text: string | null, x = 0, y = 0) {
    if (!text) {
      this.tooltip.hidden = true;
      return;
    }
    this.tooltip.hidden = false;
    this.tooltip.textContent = text;
    this.tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
  }

  // —— 面板 ——
  setVisitors(list: Visitor[]) {
    this.visitors = list;
    if (this.panelKind === 'visitors') this.renderPanel();
  }

  get panelOpen() {
    return !!this.panelKind;
  }

  togglePanel(kind: 'servers' | 'visitors' | 'settings' | 'seals' | 'practice', from?: HTMLElement) {
    if (this.panelKind === kind) {
      this.closePanel();
      return;
    }
    this.lastFocus = from ?? null;
    this.panelKind = kind;
    this.panel.hidden = false;
    this.panel.className = `panel panel-${kind}`;
    this.renderPanel();
    // 焦点放进面板方便键盘操作，但不画焦点框（鼠标、手指打开时那圈框很突兀）
    (this.panel.querySelector('button, input, select') as HTMLElement | null)?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  }

  // 进寺后重新显示一次操作提示
  replayHint() {
    this.hint.classList.remove('fade');
    setTimeout(() => this.hint.classList.add('fade'), 9000);
  }

  practiceTab: PracticeTab = 'progress';
  practiceChip!: HTMLButtonElement;
  openPractice(tab: PracticeTab) {
    this.practiceTab = tab;
    if (this.panelKind === 'practice') this.renderPanel();
    else this.togglePanel('practice', this.practiceChip);
  }
  // 左上角的称号进度条
  setPractice(o: { title: string; k: number; pts: number; daily: number; dailyAll: number }) {
    this.practiceChip.innerHTML = `<b>${o.title}</b><i class="chip-bar"><i style="width:${(Math.min(1, o.k) * 100).toFixed(1)}%"></i></i><small>${t('hudDaily', { n: o.daily, m: o.dailyAll })}</small>`;
    this.practiceChip.setAttribute('aria-label', `${t('practiceTitle')} · ${o.title} · ${t('practicePoints', { n: o.pts })}`);
  }

  // 修行面板开着时，功德变了就刷新
  refreshPractice() {
    if (this.panelKind === 'practice') this.renderPanel();
  }

  // 印谱面板开着时，盖了新印就刷新
  refreshSeals() {
    if (this.panelKind === 'seals') this.renderPanel();
  }

  closePanel() {
    this.panelKind = null;
    this.panel.hidden = true;
    this.panel.innerHTML = '';
    this.lastFocus?.focus({ preventScroll: true });
    this.lastFocus = null;
  }

  private header(title: string) {
    const h = el('header', 'panel-head');
    h.innerHTML = `<h2>${title}</h2>`;
    const c = el('button', 'icon-btn small', ICON.close);
    c.setAttribute('aria-label', t('close'));
    c.onclick = () => this.closePanel();
    h.appendChild(c);
    return h;
  }

  private renderPanel() {
    const p = this.panel;
    p.innerHTML = '';
    if (this.panelKind === 'servers') {
      p.setAttribute('aria-label', t('serverList'));
      p.appendChild(this.header(t('serverList')));
      const list = el('ul', 'room-list');
      list.innerHTML = `<li class="muted">${t('connecting')}</li>`;
      p.appendChild(list);
      this.h
        .loadRooms()
        .then((rooms) => {
          if (this.panelKind !== 'servers') return;
          list.innerHTML = '';
          for (const rm of rooms) {
            const li = el('li');
            const b = el('button', 'room-item');
            const full = rm.count >= rm.capacity;
            const cur = rm.id === this.room;
            b.disabled = full && !cur;
            b.innerHTML = `<span>${t('server')} ${String(rm.id).padStart(2, '0')}</span><span class="muted">${cur ? t('current') + ' · ' : ''}${rm.count} / ${rm.capacity}${full ? ' · ' + t('full') : ''}</span>`;
            if (cur) b.classList.add('current');
            b.onclick = () => {
              if (!cur) this.h.switchRoom(rm.id);
              this.closePanel();
            };
            li.appendChild(b);
            list.appendChild(li);
          }
        })
        .catch(() => {
          if (this.panelKind === 'servers') list.innerHTML = `<li class="muted">${t('offline')}</li>`;
        });
    } else if (this.panelKind === 'visitors') {
      p.setAttribute('aria-label', t('visitors'));
      p.appendChild(this.header(`${t('visitors')} · ${this.visitors.length}`));
      const list = el('ul', 'visitor-list');
      for (const v of this.visitors) {
        const li = el('li');
        li.innerHTML = `<span class="v-name">${v.me ? `<b class="me-badge">${t('me')}</b>` : ''}${escapeHtml(v.name)}</span><span class="muted">${v.status}${v.bows ? ` · ${v.bows}${t('bowsUnit')}` : ''}</span>`;
        list.appendChild(li);
      }
      if (this.visitors.length <= 1) {
        const li = el('li', 'muted');
        li.textContent = this.online ? t('alone') : t('offline');
        list.appendChild(li);
      }
      p.appendChild(list);
      const foot = el('p', 'panel-foot muted');
      foot.textContent = t('visitorsHint');
      p.appendChild(foot);
    } else if (this.panelKind === 'practice') {
      p.setAttribute('aria-label', t('practiceTitle'));
      p.appendChild(this.header(t('practiceTitle')));
      p.appendChild(
        practicePanel({
          tab: this.practiceTab,
          onTab: (k) => {
            this.practiceTab = k;
            this.renderPanel();
          },
          look: this.h.getLook(),
          onPick: (l) => {
            this.h.setLook(l);
            this.renderPanel();
          },
          onRead: (id) => this.h.readSutra(id),
          onGo: (id) => this.h.dailyGo(id),
          script: this.h.getScript(),
        })
      );
    } else if (this.panelKind === 'seals') {
      p.setAttribute('aria-label', t('sealsTitle'));
      p.appendChild(this.header(t('sealsTitle')));
      p.appendChild(sealBook());
    } else if (this.panelKind === 'settings') {
      p.setAttribute('aria-label', t('settingsTitle'));
      p.appendChild(this.header(t('settingsTitle')));
      const body = el('div', 'settings');
      const vols = this.h.getVolumes();
      for (const [bus, label, desc] of [['ambient', 'ambient', 'ambientDesc'], ['effects', 'effects', 'effectsDesc'], ['chant', 'chant', 'chantDesc']] as const) {
        const row = el('label', 'set-row');
        row.innerHTML = `<span class="set-label"><strong>${t(label)}</strong><small>${t(desc)}</small></span>`;
        const input = el('input');
        input.type = 'range';
        input.min = '0';
        input.max = '1';
        input.step = '0.01';
        input.value = String(vols[bus]);
        // 轨道上拉到的那一段填深色（iOS 滑块的样子）
        const fill = () => input.style.setProperty('--v', `${Number(input.value) * 100}%`);
        fill();
        input.oninput = () => {
          fill();
          this.h.setVolume(bus, Number(input.value));
        };
        row.appendChild(input);
        body.appendChild(row);
      }
      const nameRow = el('label', 'set-row');
      nameRow.innerHTML = `<span class="set-label"><strong>${t('nickname')}</strong></span>`;
      const name = el('input', 'text-input');
      name.maxLength = 16;
      name.value = this.h.getName();
      name.onchange = () => {
        const v = name.value.trim();
        if (v) this.h.setName(v);
        else name.value = this.h.getName();
      };
      nameRow.appendChild(name);
      body.appendChild(nameRow);

      const langRow = el('label', 'set-row');
      langRow.innerHTML = `<span class="set-label"><strong>${t('language')}</strong></span>`;
      const sel = el('select');
      for (const [k, v] of Object.entries(LANG_LABELS)) sel.add(new Option(v, k, false, k === getLang()));
      sel.onchange = () => setLang(sel.value as Lang);
      langRow.appendChild(sel);
      body.appendChild(langRow);

      const timeRow = el('label', 'set-row');
      timeRow.innerHTML = `<span class="set-label"><strong>${t('timeOfDay')}</strong></span>`;
      const ts = el('select');
      for (const [k, key] of [['auto', 'timeAuto'], ['dawn', 'timeDawn'], ['day', 'timeDay'], ['dusk', 'timeDusk'], ['night', 'timeNight']] as const)
        ts.add(new Option(t(key), k, false, k === this.h.getTime()));
      ts.onchange = () => this.h.setTime(ts.value);
      timeRow.appendChild(ts);
      body.appendChild(timeRow);

      const shRow = el('div', 'set-row');
      shRow.innerHTML = `<span class="set-label"><strong>${t('shadows')}</strong></span>`;
      const sw = el('button', 'switch');
      const setSw = (on: boolean) => {
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', String(on));
        sw.setAttribute('aria-label', t('shadows'));
        // iOS 式开关：只有滑块，不写字（读屏照样读 aria-checked）
        sw.textContent = '';
      };
      setSw(this.h.getShadows());
      sw.onclick = () => {
        const v = !this.h.getShadows();
        this.h.setShadows(v);
        setSw(v);
      };
      shRow.appendChild(sw);
      body.appendChild(shRow);

      const qRow = el('div', 'set-row');
      qRow.innerHTML = `<span class="set-label"><strong>${t('quality')}</strong><small>${t('qualityDesc')}</small></span>`;
      const qs = el('select');
      for (const [k, key] of [['high', 'qualityHigh'], ['low', 'qualityLow']] as const) qs.add(new Option(t(key), k, false, k === this.h.getQuality()));
      qs.onchange = () => this.h.setQuality(qs.value as 'high' | 'low');
      qRow.appendChild(qs);
      body.appendChild(qRow);

      const details = el('details', 'controls');
      details.innerHTML = `<summary>${t('controls')}</summary><p>${t('controlsBody')}</p>`;
      body.appendChild(details);
      p.appendChild(body);
    }
  }

  // —— 木鱼 ——
  showMoktak(on: boolean) {
    this.scrim.classList.toggle('on', on);
    for (const e of [this.moktakHit, this.moktakBar, this.moktakCount]) e.hidden = !on;
    if (on) this.moktakHit.focus({ preventScroll: true });
  }

  setMoktak(auto: boolean, count: number, combo = 0) {
    this.moktakAutoBtn.innerHTML = `${auto ? ICON.pause : ICON.play}<span>${t(auto ? 'pause' : 'autoplay')}</span>`;
    this.moktakAutoBtn.setAttribute('aria-pressed', String(auto));
    this.moktakCount.textContent = (count ? t('moktakCount', { n: count }) : '') + (combo > 1 && !auto ? ' · ' + t('combo', { n: combo }) : '');
  }

  // —— 念珠 ——
  showRosary(on: boolean) {
    this.scrim.classList.toggle('on', on);
    for (const e of [this.rosaryPad, this.rosaryBox, this.rosaryBar]) e.hidden = !on;
    if (on) this.rosaryPad.focus({ preventScroll: true });
  }

  setRosary(count: number) {
    const inRound = count % 108;
    const round = Math.floor(count / 108) + 1;
    this.rosaryNum.innerHTML = `<b>${count && inRound === 0 ? 108 : inRound}</b><span>${t('rosaryCount')}</span>`;
    this.rosaryRound.textContent = t('rosaryRound', { n: count && inRound === 0 ? round - 1 : round });
  }

  // 上香等时刻的字幕卡
  showCaption(title: string | null, sub = '') {
    if (!title) {
      this.caption.classList.remove('show');
      return;
    }
    (this.caption.querySelector('strong') as HTMLElement).textContent = title;
    (this.caption.querySelector('small') as HTMLElement).textContent = sub;
    this.caption.classList.add('show');
  }

  showFarewell(on: boolean) {
    this.farewell.hidden = !on;
    this.root.classList.toggle('left', on);
    if (on) (this.farewell.querySelector('.stay-btn') as HTMLElement).focus();
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
