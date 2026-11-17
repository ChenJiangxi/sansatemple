// 抄经：在藏经阁的经案前坐下，照着灰色的楷字一个个描《般若波罗蜜多心经》（玄奘译，260 字）。
// 描得越贴合字形、越少出格越好；描够了自动换下一字。每抄完一句、抄完全经另有功德。进度存在本地。
// 字形用霞鹜文楷 TC（SIL OFL），只截了经文用到的字（public/fonts/sutra.woff2）。
import { t } from './i18n';

export const HEART_SUTRA =
  '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。舍利子，色不異空，空不異色，色即是空，空即是色，受想行識，亦復如是。' +
  '舍利子，是諸法空相，不生不滅，不垢不淨，不增不減。是故空中無色，無受想行識，無眼耳鼻舌身意，無色聲香味觸法，無眼界，乃至無意識界，' +
  '無無明，亦無無明盡，乃至無老死，亦無老死盡。無苦集滅道，無智亦無得。以無所得故，菩提薩埵，依般若波羅蜜多故，心無罣礙，無罣礙故，' +
  '無有恐怖，遠離顛倒夢想，究竟涅槃。三世諸佛，依般若波羅蜜多故，得阿耨多羅三藐三菩提。故知般若波羅蜜多，是大神咒，是大明咒，是無上咒，' +
  '是無等等咒，能除一切苦，真實不虛。故說般若波羅蜜多咒，即說咒曰：揭諦揭諦，波羅揭諦，波羅僧揭諦，菩提薩婆訶。';

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
export const SUTRA_LEN = LINES.reduce((s, l) => s + l.text.length, 0);

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

export type SutraGrade = 'perfect' | 'good' | 'ok';
export interface SutraHooks {
  onChar(grade: SutraGrade, at: { x: number; y: number }): void; // 抄完一个字
  onLine(): void; // 抄完一句
  onRound(): void; // 抄完全经
  onClose(): void;
}

const M = 96; // 判定用的小画布边长（像素）

export class SutraCopy {
  private layer: HTMLElement;
  private lineEl: HTMLElement;
  private countEl: HTMLElement;
  private guide: HTMLCanvasElement;
  private ink: HTMLCanvasElement;
  private nextBtn: HTMLButtonElement;
  private gradeEl: HTMLElement;
  private glyph = document.createElement('canvas'); // 字形（判定用）
  private wide = document.createElement('canvas'); // 字形外扩一圈（描在这里面不算出格）
  private inkMask = document.createElement('canvas'); // 写下的笔画（判定用）
  private glyphCount = 0;
  private save = load();
  private drawing: { id: number; x: number; y: number; t: number; w: number } | null = null;
  private busy = false;
  open = false;

  constructor(parent: HTMLElement, private hooks: SutraHooks) {
    this.layer = document.createElement('div');
    this.layer.className = 'sutra';
    this.layer.hidden = true;
    const sheet = document.createElement('div');
    sheet.className = 'sutra-sheet';
    const head = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = '般若波羅蜜多心經';
    this.countEl = document.createElement('span');
    const close = document.createElement('button');
    close.className = 'icon-btn small';
    close.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    close.onclick = () => this.close();
    close.setAttribute('aria-label', t('close'));
    head.append(title, this.countEl, close);
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
    redo.className = 'pill-btn';
    redo.onclick = () => this.clearInk();
    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'pill-btn primary';
    this.nextBtn.onclick = () => this.finish(true);
    const hint = document.createElement('small');
    foot.append(hint, redo, this.nextBtn);
    sheet.append(head, this.lineEl, cell, foot);
    this.layer.appendChild(sheet);
    parent.appendChild(this.layer);
    this.texts = () => {
      redo.textContent = t('sutraRedo');
      this.nextBtn.textContent = t('sutraNext');
      hint.textContent = t('sutraHint');
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
    this.layer.hidden = false;
    this.texts();
    await loadFont();
    this.layout();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.layer.hidden = true;
    this.hooks.onClose();
  }

  private line() {
    const i = this.save.i;
    let k = LINES.length - 1;
    while (k > 0 && LINES[k].start > i) k--;
    return LINES[k];
  }
  private char() {
    const L = this.line();
    return L.text[this.save.i - L.start];
  }

  private px() {
    return Math.min(2, devicePixelRatio || 1);
  }

  // 按格子的实际大小重画：米字格、灰字、清空墨迹
  private layout() {
    const size = this.ink.getBoundingClientRect().width || 300;
    const S = Math.round(size * this.px());
    for (const c of [this.guide, this.ink]) c.width = c.height = S;
    this.drawGuide();
    this.renderLine();
    this.clearInk();
  }

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
    this.countEl.textContent = t('sutraProgress', { n: this.save.i + 1, m: SUTRA_LEN });
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

  // 调试：用范字本身当墨迹描一遍（看判定和换字是否正常）
  autoTrace() {
    if (!this.open || this.busy) return;
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
    this.gradeEl.textContent = t(grade === 'ok' ? 'sutraOk' : grade);
    this.gradeEl.className = `sutra-grade show ${grade}`;
    const r = this.ink.getBoundingClientRect();
    this.hooks.onChar(grade, { x: r.left + r.width / 2, y: r.top + r.height * 0.2 });
    const L = this.line();
    const lineDone = this.save.i + 1 >= L.start + L.text.length;
    setTimeout(() => {
      this.gradeEl.className = 'sutra-grade';
      this.save.i++;
      let round = false;
      if (this.save.i >= SUTRA_LEN) {
        this.save.i = 0;
        this.save.rounds++;
        round = true;
      }
      store(this.save);
      if (lineDone) this.hooks.onLine();
      if (round) this.hooks.onRound();
      this.busy = false;
      if (this.open) {
        this.drawGuide();
        this.renderLine();
        this.clearInk();
      }
    }, 650);
  }
}
