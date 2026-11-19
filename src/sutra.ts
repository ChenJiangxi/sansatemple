// 抄经：在藏经阁的经案前坐下，抄《般若波罗蜜多心经》（玄奘译，260 字）。两种写法，进度共用：
//  · 键盘（电脑默认）：铺开一整张朱丝栏经纸，十三字一列、从右往左；用平常的输入法打出灰色的字，
//    打对一个，纸上就落一个墨字。简体、日文新字形都认（观＝觀、仏＝佛），标点不用打。手机屏窄时分几页。
//  · 毛笔（手机默认）：照着米字格里的灰字一个个描，描得越贴合越好，描够了自动换下一字。
// 每抄完一句、抄完全经另有功德。进度存在本地。字形用霞鹜文楷 TC（SIL OFL），只截了经文用到的字（public/fonts/sutra.woff2）。
import { t } from './i18n';
import { sealImage } from './ui-extra';

export const HEART_SUTRA =
  '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。舍利子，色不異空，空不異色，色即是空，空即是色，受想行識，亦復如是。' +
  '舍利子，是諸法空相，不生不滅，不垢不淨，不增不減。是故空中無色，無受想行識，無眼耳鼻舌身意，無色聲香味觸法，無眼界，乃至無意識界，' +
  '無無明，亦無無明盡，乃至無老死，亦無老死盡。無苦集滅道，無智亦無得。以無所得故，菩提薩埵，依般若波羅蜜多故，心無罣礙，無罣礙故，' +
  '無有恐怖，遠離顛倒夢想，究竟涅槃。三世諸佛，依般若波羅蜜多故，得阿耨多羅三藐三菩提。故知般若波羅蜜多，是大神咒，是大明咒，是無上咒，' +
  '是無等等咒，能除一切苦，真實不虛。故說般若波羅蜜多咒，即說咒曰：揭諦揭諦，波羅揭諦，波羅僧揭諦，菩提薩婆訶。';

const TITLE = '般若波羅蜜多心經';

// 按标点切成一句一句；每句记下在全文（不含标点）里的起点
const LINES: { text: string; start: number }[] = (() => {
  const out: { text: string; start: number }[] = [];
  let n = 0;
  for (const seg of HEART_SUTRA.split(/[，。：]/)) {
    if (!seg) continue;
    out.push({ text: seg, start: n });
    n += seg.length;
  }
  return out;
})();
const TEXT = LINES.map((l) => l.text).join('');
export const SUTRA_LEN = TEXT.length;

// 打字时认的异体：简体、日文新字形、旧字形 → 经文里的字（经文用到的字里有写法不同的才列）
const VARIANTS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  const src =
    '觀観观 薩萨 羅罗 時时 見见 蘊蕴藴 異异 識识 復复 諸诸 滅灭 淨净浄 減减 無无 聲声 觸触 盡尽 礙碍 遠远 離离 顛顚颠 夢梦 ' +
    '實实実 虛虚 說説说 諦谛 訶诃 咒呪 揭掲 真眞 舍舎 增増 佛仏 罣挂';
  for (const g of src.split(' ')) {
    if (!g) continue;
    const [base, ...alts] = [...g];
    for (const a of alts) m[a] = base;
  }
  return m;
})();
// 打字时直接跳过的：空白、标点
const SKIP = /[\s，。、；：！？,.;:!?'"“”‘’「」『』（）()《》〈〉…—\-·]/;

const KEY = 'sansa.sutra';
interface SutraSave {
  i: number; // 下一个要抄的字
  rounds: number; // 抄完几部
}
function load(): SutraSave {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v.i === 'number') return { i: Math.max(0, Math.min(SUTRA_LEN - 1, v.i | 0)), rounds: v.rounds | 0 };
  } catch {
    /* 从头开始 */
  }
  return { i: 0, rounds: 0 };
}
function store(s: SutraSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 存不了也能抄 */
  }
}

// 每个字的墨迹：毛笔写的缩成小图（data URL），键盘打的记 'k'（拼横幅时用字体写、带一点手写的歪斜）。
// 攒成一部就能拼成一张横幅；上一部抄完后，开始抄下一部时才清掉
const INK_KEY = 'sansa.sutra.ink';
const INK = 72;
interface InkSave {
  inks: (string | null)[];
  complete: boolean;
}
function loadInk(): InkSave {
  try {
    const v = JSON.parse(localStorage.getItem(INK_KEY) || 'null');
    if (v && Array.isArray(v.inks)) return { inks: v.inks.slice(0, SUTRA_LEN), complete: !!v.complete };
  } catch {
    /* 没有就从空白开始 */
  }
  return { inks: [], complete: false };
}
function storeInk(s: InkSave) {
  try {
    localStorage.setItem(INK_KEY, JSON.stringify(s));
  } catch {
    /* 存不下就只是拼不出这几个字，不影响抄 */
  }
}

let fontReady: Promise<void> | null = null;
function loadFont() {
  fontReady ??= new FontFace('SansaSutra', `url(${new URL('fonts/sutra.woff2', document.baseURI).toString()})`)
    .load()
    .then((f) => {
      document.fonts.add(f);
    })
    .catch(() => undefined);
  return fontReady;
}

// 每个字固定的一点「手写感」：歪一点、大小浓淡略有不同（按字的序号算，重画时不变）
function hand(i: number) {
  const r = (k: number) => {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { rot: (r(1) - 0.5) * 5, sc: 0.93 + r(2) * 0.1, dx: (r(3) - 0.5) * 0.05, dy: (r(4) - 0.5) * 0.05, op: 0.84 + r(5) * 0.16 };
}

// 宣纸纹：一小块噪点图，铺在经纸上
let paperUrl = '';
function paperTexture() {
  if (paperUrl) return paperUrl;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  for (let k = 0; k < 2600; k++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(255,255,255,0.22)' : 'rgba(120,92,52,0.07)';
    const w = 1 + Math.random() * 9;
    g.save();
    g.translate(Math.random() * 256, Math.random() * 256);
    g.rotate(Math.random() * Math.PI);
    g.fillRect(0, 0, w, 0.8);
    g.restore();
  }
  paperUrl = c.toDataURL('image/png');
  return paperUrl;
}

export type SutraGrade = 'perfect' | 'good' | 'ok' | 'typed';
export interface SutraHooks {
  onChar(grade: SutraGrade, at: { x: number; y: number }): void; // 抄完一个字
  onLine(): void; // 抄完一句
  onRound(): void; // 抄完全经
  onClose(): void;
  getName(): string; // 落款用
}

type Mode = 'type' | 'brush';
const MODE_KEY = 'sansa.sutra.mode';
const M = 96; // 判定用的小画布边长（像素）
const ROWS = 13; // 一列十三字：二十列正好是一部心经

export class SutraCopy {
  private layer: HTMLElement;
  private sheet: HTMLElement;
  private lineEl: HTMLElement;
  private countEl: HTMLElement;
  private guide: HTMLCanvasElement;
  private ink: HTMLCanvasElement;
  private nextBtn: HTMLButtonElement;
  private gradeEl: HTMLElement;
  private hintEl: HTMLElement;
  private modeBtns: Record<Mode, HTMLButtonElement>;
  // 键盘：经纸、格子、隐藏的输入框、正在拼的拼音
  private pageEl: HTMLElement;
  private grid: HTMLElement;
  private input: HTMLTextAreaElement;
  private compose: HTMLElement;
  private cells: HTMLElement[] = [];
  private pg = { s: 40, cols: 20, per: SUTRA_LEN, pages: 1, at: -1 };
  private composing = false;
  private hintTimer = 0;
  private glyph = document.createElement('canvas'); // 字形（判定用）
  private wide = document.createElement('canvas'); // 字形外扩一圈（描在这里面不算出格）
  private inkMask = document.createElement('canvas'); // 写下的笔画（判定用）
  private glyphCount = 0;
  private save = load();
  private drawing: { id: number; x: number; y: number; t: number; w: number } | null = null;
  private busy = false;
  private inkSave = loadInk();
  private scroll: HTMLElement;
  private scrollImg: HTMLImageElement;
  private saveLink: HTMLAnchorElement;
  private mode: Mode;
  open = false;

  constructor(parent: HTMLElement, private hooks: SutraHooks) {
    const saved = localStorage.getItem(MODE_KEY);
    this.mode = saved === 'type' || saved === 'brush' ? saved : matchMedia('(pointer: fine)').matches ? 'type' : 'brush';
    this.layer = document.createElement('div');
    this.layer.className = 'sutra';
    this.layer.hidden = true;
    const sheet = (this.sheet = document.createElement('div'));
    sheet.className = 'sutra-sheet';
    sheet.style.setProperty('--paper', `url(${paperTexture()})`);
    const head = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = TITLE;
    this.countEl = document.createElement('span');
    // 键盘 / 毛笔
    const modes = document.createElement('div');
    modes.className = 'sutra-mode';
    this.modeBtns = { type: document.createElement('button'), brush: document.createElement('button') };
    for (const m of ['type', 'brush'] as Mode[]) {
      const b = this.modeBtns[m];
      b.innerHTML =
        m === 'type'
          ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8"/></svg><span></span>'
          : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.5 3.5 9 13l2 2 9.5-9.5a1.4 1.4 0 0 0-2-2Z"/><path d="M9 13c-2.5 0-4 1.6-4 4 0 1.3-.7 2.3-2 3 3.6.6 8-.4 8-5"/></svg><span></span>';
      b.onclick = () => this.setMode(m);
      modes.appendChild(b);
    }
    const close = document.createElement('button');
    close.className = 'icon-btn small';
    close.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    close.onclick = () => this.close();
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'icon-btn small';
    scrollBtn.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.5h12v15H6z"/><path d="M4 4.5h4M16 19.5h4M9.5 8v8M12.5 8v8M15.5 8v5"/></svg>';
    scrollBtn.onclick = () => this.showScroll();
    head.append(title, this.countEl, modes, scrollBtn, close);

    // 键盘：经纸
    this.pageEl = document.createElement('div');
    this.pageEl.className = 'sutra-page';
    this.grid = document.createElement('div');
    this.grid.className = 'sutra-grid';
    this.input = document.createElement('textarea');
    this.input.className = 'sutra-input';
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('autocorrect', 'off');
    this.input.setAttribute('autocapitalize', 'off');
    this.input.spellcheck = false;
    this.input.rows = 1;
    this.compose = document.createElement('div');
    this.compose.className = 'sutra-compose';
    this.compose.hidden = true;
    this.grid.append(this.input, this.compose);
    this.pageEl.append(this.grid);
    this.pageEl.addEventListener('pointerdown', (e) => {
      if (e.target !== this.input) {
        e.preventDefault();
        this.focusInput();
      }
    });
    this.input.addEventListener('compositionstart', () => {
      this.composing = true;
    });
    this.input.addEventListener('compositionupdate', (e) => this.showCompose(e.data));
    this.input.addEventListener('compositionend', () => {
      this.composing = false;
      this.showCompose('');
      // 各家浏览器 compositionend 和最后一次 input 的先后不一样：等这一轮事件走完再读输入框
      setTimeout(() => this.takeInput(), 0);
    });
    this.input.addEventListener('input', (e) => {
      if (this.composing || (e as InputEvent).isComposing) return;
      this.takeInput();
    });

    // 毛笔：一句经文 + 米字格
    this.lineEl = document.createElement('div');
    this.lineEl.className = 'sutra-line';
    const cell = document.createElement('div');
    cell.className = 'sutra-cell';
    this.guide = document.createElement('canvas');
    this.ink = document.createElement('canvas');
    this.ink.className = 'sutra-ink';
    this.gradeEl = document.createElement('div');
    this.gradeEl.className = 'sutra-grade';
    cell.append(this.guide, this.ink, this.gradeEl);

    const foot = document.createElement('footer');
    const redo = document.createElement('button');
    redo.className = 'pill-btn brush-only';
    redo.onclick = () => this.clearInk();
    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'pill-btn primary brush-only';
    this.nextBtn.onclick = () => this.finish(true);
    this.hintEl = document.createElement('small');
    foot.append(this.hintEl, redo, this.nextBtn);
    sheet.append(head, this.pageEl, this.lineEl, cell, foot);

    // 横幅：自己抄的经拼成一张图，可以存下来
    this.scroll = document.createElement('div');
    this.scroll.className = 'sutra-scroll';
    this.scroll.hidden = true;
    this.scrollImg = document.createElement('img');
    this.scrollImg.alt = '';
    const sf = document.createElement('footer');
    const back = document.createElement('button');
    back.className = 'pill-btn';
    back.onclick = () => this.hideScroll();
    this.saveLink = document.createElement('a');
    this.saveLink.className = 'pill-btn primary';
    sf.append(back, this.saveLink);
    this.scroll.append(this.scrollImg, sf);
    this.layer.append(sheet, this.scroll);
    parent.appendChild(this.layer);
    this.texts = () => {
      scrollBtn.title = t('sutraScroll');
      scrollBtn.setAttribute('aria-label', t('sutraScroll'));
      close.setAttribute('aria-label', t('close'));
      back.textContent = t('sutraBack');
      this.saveLink.textContent = t('sutraSave');
      redo.textContent = t('sutraRedo');
      this.nextBtn.textContent = t('sutraNext');
      (this.modeBtns.type.querySelector('span') as HTMLElement).textContent = t('sutraModeType');
      (this.modeBtns.brush.querySelector('span') as HTMLElement).textContent = t('sutraModeBrush');
      this.input.setAttribute('aria-label', t('sutraTypeHint'));
      this.setHint();
    };
    for (const c of [this.glyph, this.wide, this.inkMask]) c.width = c.height = M;

    this.ink.addEventListener('pointerdown', (e) => this.down(e));
    this.ink.addEventListener('pointermove', (e) => this.move(e));
    this.ink.addEventListener('pointerup', (e) => this.up(e));
    this.ink.addEventListener('pointercancel', (e) => this.up(e));
    addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') this.close();
    });
    addEventListener('resize', () => this.open && this.layout());
  }
  private texts: () => void;

  get progress() {
    return { i: this.save.i, n: SUTRA_LEN, rounds: this.save.rounds };
  }

  async show() {
    this.open = true;
    this.busy = false;
    this.layer.hidden = false;
    this.texts();
    this.applyMode();
    await loadFont();
    this.layout();
    this.focusInput();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.layer.hidden = true;
    this.input.blur();
    this.hideScroll();
    this.hooks.onClose();
  }

  private setMode(m: Mode) {
    if (m === this.mode || this.busy) return;
    this.mode = m;
    localStorage.setItem(MODE_KEY, m);
    this.applyMode();
    this.layout();
    this.focusInput();
  }
  private applyMode() {
    this.sheet.dataset.mode = this.mode;
    for (const m of ['type', 'brush'] as Mode[]) this.modeBtns[m].classList.toggle('on', m === this.mode);
    this.setHint();
  }
  // 底部的提示；warn：短暂换成一句提醒（比如还没切到中文输入法）
  private setHint(warn?: string) {
    clearTimeout(this.hintTimer);
    this.hintEl.classList.toggle('warn', !!warn);
    this.hintEl.textContent = warn ?? t(this.mode === 'type' ? 'sutraTypeHint' : 'sutraHint');
    if (warn) this.hintTimer = window.setTimeout(() => this.setHint(), 3600);
  }
  private focusInput() {
    if (this.open && this.mode === 'type' && this.scroll.hidden) this.input.focus({ preventScroll: true });
  }

  private line() {
    const i = this.save.i;
    let k = LINES.length - 1;
    while (k > 0 && LINES[k].start > i) k--;
    return LINES[k];
  }
  private char() {
    return TEXT[this.save.i];
  }

  private px() {
    return Math.min(2, devicePixelRatio || 1);
  }

  private layout() {
    this.renderCount();
    if (this.mode === 'type') {
      this.layoutPaper();
      return;
    }
    // 毛笔：按格子的实际大小重画米字格、灰字，清空墨迹
    const size = this.ink.getBoundingClientRect().width || 300;
    const S = Math.round(size * this.px());
    for (const c of [this.guide, this.ink]) c.width = c.height = S;
    this.drawGuide();
    this.renderLine();
    this.clearInk();
  }

  private renderCount() {
    let s = t('sutraProgress', { n: this.save.i + 1, m: SUTRA_LEN });
    if (this.mode === 'type' && this.pg.pages > 1) s += ` · ${t('sutraPage', { n: Math.floor(this.save.i / this.pg.per) + 1, m: this.pg.pages })}`;
    this.countEl.textContent = s;
  }

  // —— 键盘：经纸 ——
  // 格子尽量大：放得下二十列就整部一张纸（右起一列经题）；屏幕窄就每页少几列、分几页
  private layoutPaper() {
    const W = this.pageEl.clientWidth, H = this.pageEl.clientHeight;
    if (!W || !H) return;
    let s = Math.floor(Math.min(H / ROWS, W / 21));
    let cols = 20;
    if (s < 30) {
      s = Math.max(22, Math.floor(Math.min(H / ROWS, 42)));
      cols = Math.max(3, Math.floor(W / s) - 1);
    }
    const per = cols * ROWS;
    this.pg = { s, cols, per, pages: Math.ceil(SUTRA_LEN / per), at: -1 };
    const gw = (cols + 1) * s, gh = ROWS * s;
    Object.assign(this.grid.style, { width: `${gw}px`, height: `${gh}px`, left: `${Math.round((W - gw) / 2)}px`, top: `${Math.round((H - gh) / 2)}px` });
    this.grid.style.setProperty('--s', `${s}px`);
    this.renderPage(false);
  }

  // 第 i 字在这一页里的格子位置（右起第 0 列是经题）
  private cellPos(i: number) {
    const k = i % this.pg.per;
    const col = 1 + Math.floor(k / ROWS), row = k % ROWS;
    return { x: (this.pg.cols - col) * this.pg.s, y: row * this.pg.s };
  }

  private renderPage(flip: boolean) {
    const at = Math.floor(this.save.i / this.pg.per);
    this.pg.at = at;
    for (const c of this.cells) c.remove();
    this.cells = [];
    const s = this.pg.s;
    const add = (ch: string, x: number, y: number, cls: string) => {
      const e = document.createElement('span');
      e.className = `c ${cls}`;
      e.textContent = ch;
      e.style.left = `${x}px`;
      e.style.top = `${y}px`;
      this.grid.insertBefore(e, this.input);
      return e;
    };
    [...TITLE].forEach((ch, r) => add(ch, this.pg.cols * s, r * s, 'title'));
    const i0 = at * this.pg.per, i1 = Math.min(SUTRA_LEN, i0 + this.pg.per);
    for (let i = i0; i < i1; i++) {
      const p = this.cellPos(i);
      const e = add(TEXT[i], p.x, p.y, '');
      this.cells[i - i0] = e;
      if (i < this.save.i) this.inkCell(e, i, false);
    }
    this.markNow();
    if (flip) {
      this.grid.classList.remove('flip');
      void this.grid.offsetWidth;
      this.grid.classList.add('flip');
    }
  }

  // 把一格写上墨：毛笔写过的用那张小图，键盘打的用字体加一点歪斜
  private inkCell(e: HTMLElement, i: number, fresh: boolean, delay = 0) {
    const src = this.inkSave.inks[i];
    const h = hand(i);
    e.classList.remove('now', 'nope');
    e.classList.add('done');
    if (src && src.startsWith('data:')) {
      e.classList.add('img');
      e.style.backgroundImage = `url(${src})`;
    }
    e.style.setProperty('--tf', `translate(${(h.dx * 100).toFixed(1)}%, ${(h.dy * 100).toFixed(1)}%) rotate(${h.rot.toFixed(1)}deg) scale(${h.sc.toFixed(3)})`);
    e.style.setProperty('--op', h.op.toFixed(2));
    if (fresh) {
      e.style.animationDelay = `${delay}ms`;
      e.classList.add('fresh');
    }
  }

  private markNow() {
    const k = this.save.i - this.pg.at * this.pg.per;
    this.cells.forEach((c, j) => c.classList.toggle('now', j === k));
    const p = this.cellPos(this.save.i);
    Object.assign(this.input.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${this.pg.s}px`, height: `${this.pg.s}px` });
    // 拼音提示放在当前格的左边（下一列的位置），最后一列就放右边
    const leftSide = p.x >= this.pg.s * 2.2;
    this.compose.classList.toggle('right', !leftSide);
    Object.assign(this.compose.style, { top: `${p.y + this.pg.s * 0.18}px`, left: leftSide ? '' : `${p.x + this.pg.s + 4}px`, right: leftSide ? `${this.pg.cols * this.pg.s + this.pg.s - p.x + 4}px` : '' });
  }

  private showCompose(s: string) {
    this.compose.hidden = !s;
    this.compose.classList.remove('bad');
    this.compose.textContent = s;
  }

  // 读走输入框里已经确定的字，逐个对：对了落墨，错了停下、那一格抖一下
  private takeInput() {
    const v = this.input.value;
    this.input.value = '';
    if (!v || !this.open || this.mode !== 'type' || this.busy) return;
    let n = 0;
    let latin = false;
    for (const raw of v) {
      if (SKIP.test(raw)) continue;
      if (/[A-Za-z0-9]/.test(raw)) {
        latin = true;
        break;
      }
      const ch = VARIANTS[raw] ?? raw;
      if (ch !== this.char()) {
        this.nope(raw);
        break;
      }
      this.typed(n++);
      if (this.save.i === 0) break; // 抄完一部了
    }
    if (latin && !n) this.setHint(t('sutraNeedIme'));
  }

  private nope(ch: string) {
    const k = this.save.i - this.pg.at * this.pg.per;
    const e = this.cells[k];
    if (e) {
      e.classList.remove('nope');
      void e.offsetWidth;
      e.classList.add('nope');
    }
    this.compose.textContent = ch;
    this.compose.hidden = false;
    this.compose.classList.add('bad');
    setTimeout(() => {
      if (this.compose.classList.contains('bad')) this.showCompose('');
    }, 900);
  }

  // 打对了一个字：落墨、记进度；连着打对好几个时一个接一个落下
  private typed(n: number) {
    const i = this.save.i;
    if (this.inkSave.complete && i === 0) this.inkSave = { inks: [], complete: false };
    this.inkSave.inks[i] = 'k';
    const k = i - this.pg.at * this.pg.per;
    const e = this.cells[k];
    const delay = Math.min(n, 8) * 100; // 输入法一次上屏一个词：一个接一个落下（一大段粘贴进来也不会等太久）
    if (e) this.inkCell(e, i, true, delay);
    setTimeout(() => this.onBrush?.(), delay);
    const r = e?.getBoundingClientRect();
    const at = r ? { x: r.left + r.width / 2, y: r.top } : { x: innerWidth / 2, y: innerHeight * 0.3 };
    setTimeout(() => this.hooks.onChar('typed', at), delay);
    this.advance(() => {
      if (!this.open || this.mode !== 'type') return;
      if (this.save.i === 0) {
        // 抄完一部：留着这张写满的纸，先不收字；横幅过一会儿自己打开，回来时换一张新纸
        this.busy = true;
        return;
      }
      if (Math.floor(this.save.i / this.pg.per) !== this.pg.at) setTimeout(() => this.open && this.renderPage(true), 500 + delay);
      else this.markNow();
      this.renderCount();
    }, true);
  }
  onBrush?: () => void; // 落墨时的声音（由外面接到音效上）

  // 进度往前走一字；抄完一句、一部时通知外面。immediate：键盘打字不等动画
  private advance(after: () => void, immediate = false) {
    const L = this.line();
    const lineDone = this.save.i + 1 >= L.start + L.text.length;
    const step = () => {
      this.save.i++;
      let round = false;
      if (this.save.i >= SUTRA_LEN) {
        this.save.i = 0;
        this.save.rounds++;
        round = true;
      }
      store(this.save);
      storeInk(this.inkSave);
      if (lineDone) this.hooks.onLine();
      if (round) {
        this.inkSave.complete = true;
        storeInk(this.inkSave);
        this.hooks.onRound();
        setTimeout(() => this.open && this.showScroll(), 1600);
      }
      after();
    };
    if (immediate) step();
    else setTimeout(step, 650);
  }

  // —— 毛笔 ——
  private drawGuide() {
    const g = this.guide.getContext('2d')!;
    const S = this.guide.width;
    g.clearRect(0, 0, S, S);
    // 米字格：朱红细线，外框实线，里面虚线
    g.strokeStyle = 'rgba(176,58,40,0.55)';
    g.lineWidth = Math.max(1, S / 160);
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, S - g.lineWidth, S - g.lineWidth);
    g.setLineDash([S / 40, S / 50]);
    g.strokeStyle = 'rgba(176,58,40,0.28)';
    for (const [a, b, c, d] of [[0, S / 2, S, S / 2], [S / 2, 0, S / 2, S], [0, 0, S, S], [S, 0, 0, S]]) {
      g.beginPath();
      g.moveTo(a, b);
      g.lineTo(c, d);
      g.stroke();
    }
    g.setLineDash([]);
    // 灰色的范字
    const ch = this.char();
    g.fillStyle = 'rgba(120,104,86,0.32)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${Math.round(S * 0.8)}px SansaSutra, "Kaiti TC", "Kaiti SC", STKaiti, KaiTi, serif`;
    g.fillText(ch, S / 2, S * 0.53);
    // 判定用：字形本身，和外扩一圈的字形
    const gm = this.glyph.getContext('2d', { willReadFrequently: true })!;
    const wm = this.wide.getContext('2d', { willReadFrequently: true })!;
    for (const [c, grow] of [[gm, 0], [wm, M * 0.07]] as [CanvasRenderingContext2D, number][]) {
      c.clearRect(0, 0, M, M);
      c.fillStyle = '#000';
      c.strokeStyle = '#000';
      c.lineJoin = 'round';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `${Math.round(M * 0.8)}px SansaSutra, "Kaiti TC", "Kaiti SC", STKaiti, KaiTi, serif`;
      c.fillText(ch, M / 2, M * 0.53);
      if (grow) {
        c.lineWidth = grow * 2;
        c.strokeText(ch, M / 2, M * 0.53);
      }
    }
    const d = gm.getImageData(0, 0, M, M).data;
    this.glyphCount = 0;
    for (let p = 3; p < d.length; p += 4) if (d[p] > 128) this.glyphCount++;
  }

  // 这一句：抄过的字是墨色，正在抄的描金边，没抄的淡灰
  private renderLine() {
    const L = this.line();
    const at = this.save.i - L.start;
    this.lineEl.innerHTML = '';
    [...L.text].forEach((c, k) => {
      const s = document.createElement('span');
      s.textContent = c;
      s.className = k < at ? 'done' : k === at ? 'now' : '';
      this.lineEl.appendChild(s);
    });
    this.renderCount();
  }

  private clearInk() {
    this.ink.getContext('2d')!.clearRect(0, 0, this.ink.width, this.ink.height);
    this.inkMask.getContext('2d')!.clearRect(0, 0, M, M);
    this.nextBtn.disabled = true;
  }

  private pos(e: PointerEvent) {
    const r = this.ink.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  private down(e: PointerEvent) {
    if (this.busy) return;
    e.preventDefault();
    this.ink.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.drawing = { id: e.pointerId, ...p, t: performance.now(), w: 0.05 };
    this.stroke(p.x, p.y, p.x, p.y, 0.05);
  }
  private move(e: PointerEvent) {
    const d = this.drawing;
    if (!d || e.pointerId !== d.id) return;
    const p = this.pos(e);
    const now = performance.now();
    // 毛笔：走得慢笔画粗，走得快笔画细，粗细慢慢变
    const v = Math.hypot(p.x - d.x, p.y - d.y) / Math.max(1, now - d.t);
    const want = Math.max(0.028, Math.min(0.062, 0.062 - v * 18));
    const w = d.w + (want - d.w) * 0.35;
    this.stroke(d.x, d.y, p.x, p.y, w);
    Object.assign(d, p, { t: now, w });
  }
  private up(e: PointerEvent) {
    if (!this.drawing || e.pointerId !== this.drawing.id) return;
    this.drawing = null;
    this.judge();
  }
  private stroke(x0: number, y0: number, x1: number, y1: number, w: number) {
    const S = this.ink.width;
    const g = this.ink.getContext('2d')!;
    g.strokeStyle = 'rgba(24,18,14,0.94)';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = w * S;
    g.beginPath();
    g.moveTo(x0 * S, y0 * S);
    g.lineTo(x1 * S, y1 * S);
    g.stroke();
    const m = this.inkMask.getContext('2d')!;
    m.strokeStyle = '#000';
    m.lineCap = 'round';
    m.lineWidth = w * M;
    m.beginPath();
    m.moveTo(x0 * M, y0 * M);
    m.lineTo(x1 * M, y1 * M);
    m.stroke();
  }

  // 把这一字的墨迹缩成小图存起来
  private keepInk() {
    if (this.inkSave.complete && this.save.i === 0) this.inkSave = { inks: [], complete: false };
    const c = document.createElement('canvas');
    c.width = c.height = INK;
    c.getContext('2d')!.drawImage(this.ink, 0, 0, INK, INK);
    this.inkSave.inks[this.save.i] = c.toDataURL('image/png');
    storeInk(this.inkSave);
  }

  private hideScroll() {
    if (this.scroll.hidden) return;
    this.scroll.hidden = true;
    this.sheet.hidden = false;
    // 刚抄完一部：换一张新纸
    if (this.mode === 'type' && this.busy) this.busy = false;
    if (this.open) this.layout();
    this.focusInput();
  }

  // 拼横幅：从右往左竖排，右起一列经题，正文二十列每列十三字，左边落款和一方「心經」朱印；还没抄的字是淡灰的范字
  async showScroll() {
    await loadFont();
    const cell = 64, colW = 74, rowH = 68, rows = ROWS, cols = 20, mx = 70, my = 64;
    const W = mx * 2 + (cols + 3) * colW, H = my * 2 + rows * rowH;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f2e8d0';
    g.fillRect(0, 0, W, H);
    // 纸纹
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,96,60,0.06)';
      g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 6, 1);
    }
    // 外框两道朱线，栏内每列一道细朱线
    g.strokeStyle = 'rgba(176,58,40,0.75)';
    g.lineWidth = 3;
    g.strokeRect(28, 28, W - 56, H - 56);
    g.lineWidth = 1.2;
    g.strokeRect(38, 38, W - 76, H - 76);
    g.strokeStyle = 'rgba(176,58,40,0.4)';
    for (let k = 1; k < cols + 3; k++) {
      const x = W - mx - k * colW;
      g.beginPath();
      g.moveTo(x, 38);
      g.lineTo(x, H - 38);
      g.stroke();
    }
    const colX = (k: number) => W - mx - (k + 0.5) * colW; // 第 k 列（从右数）的中线
    const font = (px: number) => `${px}px SansaSutra, "Kaiti TC", "Kaiti SC", STKaiti, KaiTi, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // 经题
    g.fillStyle = '#1d1612';
    g.font = font(46);
    [...TITLE].forEach((ch, r) => g.fillText(ch, colX(0), my + rowH * (r + 0.5) + 6));
    // 正文
    const imgs = await Promise.all(
      Array.from({ length: SUTRA_LEN }, (_, i) => {
        const src = this.inkSave.inks[i];
        if (!src || !src.startsWith('data:')) return Promise.resolve(null);
        return new Promise<HTMLImageElement | null>((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = src;
        });
      })
    );
    g.font = font(cell * 0.8);
    for (let i = 0; i < SUTRA_LEN; i++) {
      const k = 1 + Math.floor(i / rows), r = i % rows;
      const cx = colX(k), cy = my + rowH * (r + 0.5);
      const im = imgs[i];
      if (im) g.drawImage(im, cx - cell / 2, cy - cell / 2, cell, cell);
      else if (this.inkSave.inks[i] === 'k') {
        // 键盘打的：字体写，带一点手写的歪斜和浓淡，边上洇一点墨
        const h = hand(i);
        g.save();
        g.translate(cx + h.dx * cell, cy + 2 + h.dy * cell);
        g.rotate((h.rot * Math.PI) / 180);
        g.scale(h.sc, h.sc);
        g.globalAlpha = h.op;
        g.shadowColor = 'rgba(26,18,12,0.45)';
        g.shadowBlur = 1.4;
        g.fillStyle = '#17110d';
        g.fillText(TEXT[i], 0, 0);
        g.restore();
      } else {
        g.fillStyle = 'rgba(120,104,86,0.22)';
        g.fillText(TEXT[i], cx, cy + 2);
      }
    }
    // 落款：名字、敬書、日期，下面盖印
    const d = new Date();
    const sign = `${this.hooks.getName()} 敬書`;
    const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    g.fillStyle = '#2a201a';
    g.font = font(30);
    const sk = cols + 1;
    [...sign].forEach((ch, r) => g.fillText(ch, colX(sk), my + 40 + r * 36));
    g.font = '22px "Songti SC", serif';
    g.save();
    g.translate(colX(sk + 1), my + 30);
    g.rotate(Math.PI / 2);
    g.textAlign = 'left';
    g.fillStyle = '#6a5340';
    g.fillText(date, 0, 0);
    g.restore();
    const seal = await new Promise<HTMLImageElement>((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.src = sealImage('心經', 160);
    });
    g.drawImage(seal, colX(sk) - 34, my + 52 + [...sign].length * 36, 68, 68);
    const url = c.toDataURL('image/jpeg', 0.9);
    this.scrollImg.src = url;
    this.saveLink.href = url;
    this.saveLink.download = `heart-sutra-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.jpg`;
    this.sheet.hidden = true;
    this.scroll.hidden = false;
    this.input.blur();
  }

  // 调试：毛笔模式下用范字本身当墨迹描一遍；键盘模式下直接「打」下一个字
  autoTrace() {
    if (!this.open || this.busy) return;
    if (this.mode === 'type') {
      this.input.value = this.char();
      this.takeInput();
      return;
    }
    const ch = this.char();
    for (const [c, S] of [[this.ink, this.ink.width], [this.inkMask, M]] as [HTMLCanvasElement, number][]) {
      const g = c.getContext('2d')!;
      g.fillStyle = c === this.ink ? 'rgba(24,18,14,0.94)' : '#000';
      g.strokeStyle = g.fillStyle;
      g.lineWidth = S * 0.012;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `${Math.round(S * 0.8)}px SansaSutra, serif`;
      g.fillText(ch, S / 2, S * 0.53);
      g.strokeText(ch, S / 2, S * 0.53);
    }
    this.judge();
  }
  // 调试：键盘模式下模拟输入一段文字（看简体、错字、拼音的反应）
  debugType(s: string) {
    if (!this.open || this.mode !== 'type') return;
    this.input.value = s;
    this.takeInput();
  }

  // 判定：字形被墨盖住的比例（覆盖），墨落在字形外扩一圈之外的比例（出格）
  private score() {
    const g = this.glyph.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, M, M).data;
    const w = this.wide.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, M, M).data;
    const k = this.inkMask.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, M, M).data;
    let cov = 0, ink = 0, out = 0;
    for (let p = 3; p < k.length; p += 4) {
      const inked = k[p] > 100;
      if (g[p] > 128 && inked) cov++;
      if (inked) {
        ink++;
        if (w[p] < 60) out++;
      }
    }
    return { cover: this.glyphCount ? cov / this.glyphCount : 0, spill: ink ? out / ink : 0 };
  }
  private judge() {
    const { cover } = this.score();
    this.nextBtn.disabled = cover < 0.3;
    if (cover >= 0.8) this.finish(false);
  }

  private finish(manual: boolean) {
    if (this.busy) return;
    const { cover, spill } = this.score();
    if (manual && cover < 0.3) return;
    const q = cover - spill * 0.7;
    const grade: SutraGrade = q >= 0.7 ? 'perfect' : q >= 0.5 ? 'good' : 'ok';
    this.busy = true;
    this.keepInk();
    this.gradeEl.textContent = t(grade === 'ok' ? 'sutraOk' : grade);
    this.gradeEl.className = `sutra-grade show ${grade}`;
    const r = this.ink.getBoundingClientRect();
    this.hooks.onChar(grade, { x: r.left + r.width / 2, y: r.top + r.height * 0.2 });
    this.advance(() => {
      this.gradeEl.className = 'sutra-grade';
      this.busy = false;
      if (this.open && this.mode === 'brush') {
        this.drawGuide();
        this.renderLine();
        this.clearInk();
      }
    });
  }
}
