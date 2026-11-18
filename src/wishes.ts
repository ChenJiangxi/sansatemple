// 祈福灯廊的心愿：写一句、挑颜色、挂上去；点别人的灯看心愿，可以「随喜」或举报。
// 心愿存在服务器内存里（所有房间共用，挂七天）；自己挂的也存在本地，重连或服务器重启后再补交回去。
import { t, onLangChange, type Key } from './i18n';
import { LANTERN_COLORS } from './world/garden';

export const WISH_KINDS = ['peace', 'exam', 'health', 'wealth', 'love', 'smooth', 'family'] as const;
export const WISH_MAX_LEN = 24;
export const WISH_DAYS = 7;

export interface Wish {
  id: string;
  by: string;
  text: string;
  c: number; // 灯笼颜色
  k: number; // 心愿类别
  at: number; // 挂上的时间（毫秒）
  likes: number;
  mine?: boolean;
}

const MINE_KEY = 'sansa.wishes';
const DAY_KEY = 'sansa.wishDay';
const LIKED_KEY = 'sansa.wishLiked';
const HIDDEN_KEY = 'sansa.wishHidden';

function readJson<T>(k: string, d: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return v ?? d;
  } catch {
    return d;
  }
}
function writeJson(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 存不下也不影响 */
  }
}

export const wishStore = {
  // 自己挂过、还在七天里的
  mine(): Wish[] {
    const now = Date.now();
    return readJson<Wish[]>(MINE_KEY, []).filter((w) => w && typeof w.id === 'string' && now - w.at < WISH_DAYS * 864e5);
  },
  addMine(w: Wish) {
    writeJson(MINE_KEY, [w, ...this.mine()].slice(0, 7));
  },
  hungToday(day: string) {
    return localStorage.getItem(DAY_KEY) === day;
  },
  markToday(day: string) {
    localStorage.setItem(DAY_KEY, day);
  },
  liked(): string[] {
    return readJson<string[]>(LIKED_KEY, []);
  },
  like(id: string) {
    writeJson(LIKED_KEY, [id, ...this.liked().filter((x) => x !== id)].slice(0, 300));
  },
  hidden(): string[] {
    return readJson<string[]>(HIDDEN_KEY, []);
  },
  hide(id: string) {
    writeJson(HIDDEN_KEY, [id, ...this.hidden()].slice(0, 300));
  },
};

export function newWishId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
}
// 心愿挂在哪个挂点：按编号算一个起点，被占了就往后找（同一组心愿每次算出来都一样，新来的不会把别人的灯挤走）
export function assignHooks(list: Wish[], hooks: number) {
  const used = new Map<number, Wish>();
  const hookOf = new Map<string, number>();
  for (const w of list) {
    if (used.size >= hooks) break;
    let h = parseInt(w.id.slice(0, 6), 16) % hooks;
    while (used.has(h)) h = (h + 7) % hooks;
    used.set(h, w);
    hookOf.set(w.id, h);
  }
  return { used, hookOf };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

export interface WishHooks {
  hang(k: number, c: number, text: string): void;
  like(w: Wish): void;
  report(w: Wish): void;
}

export class WishUI {
  private layer: HTMLElement;
  private write: HTMLElement;
  private read: HTMLElement;
  private kinds: HTMLElement;
  private swatches: HTMLElement;
  private input: HTMLTextAreaElement;
  private count: HTMLElement;
  private hangBtn: HTMLButtonElement;
  private k = 0;
  private c = 0;
  open = false;
  private texts: () => void;
  // 读心愿的卡片
  private rKind: HTMLElement;
  private rText: HTMLElement;
  private rBy: HTMLElement;
  private rLike: HTMLButtonElement;
  private rReport: HTMLButtonElement;
  private rLamp: HTMLElement;
  private cur: Wish | null = null;
  private liked = false;

  constructor(root: HTMLElement, private h: WishHooks) {
    this.layer = el('div', 'wish');
    this.layer.hidden = true;
    // —— 写心愿 ——
    this.write = el('div', 'wish-sheet');
    const head = el('header');
    const title = el('div', 'wish-title', '<h2></h2><small></small>');
    const close = el('button', 'icon-btn small', ICON_X);
    close.onclick = () => this.close();
    head.append(title, close);
    this.kinds = el('div', 'wish-kinds');
    WISH_KINDS.forEach((_, i) => {
      const b = el('button');
      b.onclick = () => this.setKind(i);
      this.kinds.append(b);
    });
    this.swatches = el('div', 'wish-colors');
    LANTERN_COLORS.forEach((col, i) => {
      const b = el('button');
      b.style.setProperty('--c', col);
      b.onclick = () => this.setColor(i);
      this.swatches.append(b);
    });
    const box = el('div', 'wish-input');
    this.input = el('textarea');
    this.input.rows = 2;
    this.input.maxLength = WISH_MAX_LEN;
    this.count = el('small');
    this.input.oninput = () => (this.count.textContent = `${[...this.input.value].length} / ${WISH_MAX_LEN}`);
    box.append(this.input, this.count);
    const foot = el('footer');
    const note = el('small');
    this.hangBtn = el('button', 'pill-btn primary');
    this.hangBtn.onclick = () => {
      const text = [...this.input.value.replace(/\s+/g, ' ').trim()].slice(0, WISH_MAX_LEN).join('');
      this.h.hang(this.k, this.c, text || t(`wishHint_${WISH_KINDS[this.k]}` as Key));
    };
    foot.append(note, this.hangBtn);
    this.write.append(head, this.kinds, this.swatches, box, foot);

    // —— 读心愿：一张竖签 ——
    this.read = el('div', 'wish-card');
    const rClose = el('button', 'icon-btn small', ICON_X);
    rClose.onclick = () => this.close();
    this.rLamp = el('i', 'wish-lamp');
    this.rKind = el('span', 'wish-card-kind');
    this.rText = el('p');
    this.rBy = el('small');
    const acts = el('div', 'wish-card-acts');
    this.rLike = el('button', 'pill-btn primary');
    this.rLike.onclick = () => {
      if (!this.cur || this.liked || this.cur.mine) return;
      this.liked = true;
      this.h.like(this.cur);
      this.cur.likes++;
      this.renderRead();
    };
    this.rReport = el('button', 'wish-report');
    this.rReport.onclick = () => {
      if (!this.cur) return;
      this.h.report(this.cur);
      this.close();
    };
    acts.append(this.rLike, this.rReport);
    this.read.append(rClose, this.rLamp, this.rKind, this.rText, this.rBy, acts);

    this.layer.append(this.write, this.read);
    this.layer.addEventListener('pointerdown', (e) => {
      if (e.target === this.layer) this.close();
    });
    addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') this.close();
    });
    root.append(this.layer);
    this.texts = () => {
      (title.querySelector('h2') as HTMLElement).textContent = t('wishTitle');
      (title.querySelector('small') as HTMLElement).textContent = t('wishSub');
      close.setAttribute('aria-label', t('close'));
      rClose.setAttribute('aria-label', t('close'));
      [...this.kinds.children].forEach((b, i) => (b.textContent = t(`wishKind_${WISH_KINDS[i]}` as Key)));
      [...this.swatches.children].forEach((b, i) => b.setAttribute('aria-label', `${t('wishColor')} ${i + 1}`));
      note.textContent = t('wishFoot');
      this.hangBtn.textContent = t('wishHang');
      this.rReport.textContent = t('wishReport');
      this.input.placeholder = t(`wishHint_${WISH_KINDS[this.k]}` as Key);
      if (this.cur) this.renderRead();
    };
    this.texts();
    onLangChange(() => this.texts());
  }

  private setKind(i: number) {
    this.k = i;
    [...this.kinds.children].forEach((b, j) => b.classList.toggle('on', j === i));
    this.input.placeholder = t(`wishHint_${WISH_KINDS[i]}` as Key);
  }
  private setColor(i: number) {
    this.c = i;
    [...this.swatches.children].forEach((b, j) => b.classList.toggle('on', j === i));
    this.write.style.setProperty('--lamp', LANTERN_COLORS[i]);
  }

  compose() {
    this.cur = null;
    this.input.value = '';
    this.count.textContent = `0 / ${WISH_MAX_LEN}`;
    this.setKind(Math.floor(Math.random() * WISH_KINDS.length));
    this.setColor(Math.floor(Math.random() * LANTERN_COLORS.length));
    this.write.hidden = false;
    this.read.hidden = true;
    this.layer.hidden = false;
    this.open = true;
    setTimeout(() => this.input.focus({ preventScroll: true }), 50);
  }

  show(w: Wish, liked: boolean) {
    this.cur = w;
    this.liked = liked;
    this.write.hidden = true;
    this.read.hidden = false;
    this.layer.hidden = false;
    this.open = true;
    this.renderRead();
  }
  private renderRead() {
    const w = this.cur;
    if (!w) return;
    this.read.style.setProperty('--lamp', LANTERN_COLORS[w.c] ?? LANTERN_COLORS[0]);
    this.rKind.textContent = t(`wishKind_${WISH_KINDS[w.k] ?? 'peace'}` as Key);
    this.rText.textContent = w.text;
    const d = new Date(w.at);
    this.rBy.textContent = `${w.mine ? t('wishMine') : w.by} · ${d.getMonth() + 1}.${d.getDate()}`;
    this.rLike.textContent = `${this.liked || w.mine ? t('wishLiked') : t('wishLike')}${w.likes ? ` · ${w.likes}` : ''}`;
    this.rLike.disabled = this.liked || !!w.mine;
    this.rReport.hidden = !!w.mine;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.layer.hidden = true;
    this.input.blur();
  }
}
