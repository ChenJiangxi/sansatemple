// 经藏：读经。经文是维基文库整理的古代译本（公有领域），由 tools/build-sutras.py 生成到 public/sutras/，打开时才下载。
// 按字数分页；一页停留 5 秒算读过。每页每天第一次读过有一点功德，读完一整部另有功德，记「读过几遍」。
// 繁体、简体可切换（界面是中文时默认简体，其他语言默认繁体）。
import { t } from './i18n';
import { progress } from './progress';

export interface SutraInfo {
  id: string;
  lv: number; // 几级开放（LEVELS 的下标）
  title: { t: string; s: string };
}
export const SUTRA_LIST: SutraInfo[] = [
  { id: 'heart', lv: 0, title: { t: '般若波羅蜜多心經', s: '般若波罗蜜多心经' } },
  { id: 'eight', lv: 1, title: { t: '佛說八大人覺經', s: '佛说八大人觉经' } },
  { id: 'amitabha', lv: 2, title: { t: '佛說阿彌陀經', s: '佛说阿弥陀经' } },
  { id: 'pumen', lv: 3, title: { t: '觀世音菩薩普門品', s: '观世音菩萨普门品' } },
  { id: 'forty2', lv: 4, title: { t: '佛說四十二章經', s: '佛说四十二章经' } },
  { id: 'diamond', lv: 5, title: { t: '金剛般若波羅蜜經', s: '金刚般若波罗蜜经' } },
];

type Script = 't' | 's';
interface Para {
  t: string;
  s: string;
  verse: boolean;
}
interface Doc {
  id: string;
  title: { t: string; s: string };
  by: { t: string; s: string };
  sections: { h: { t: string; s: string } | null; paras: Para[] }[];
}
interface Page {
  h?: { t: string; s: string };
  paras: Para[];
}

const READ_MS = 5000;

// 分页：按句子往一页里装，装满了才翻页（一段可以跨页）；小节标题另起一页。每页字数按屏幕宽窄定
function paginate(doc: Doc, budget: number): Page[] {
  const pages: Page[] = [];
  for (const sec of doc.sections) {
    let cur: Page = { h: sec.h ?? undefined, paras: [] };
    let n = 0;
    const flush = () => {
      if (cur.paras.length) pages.push(cur);
      cur = { paras: [] };
      n = 0;
    };
    for (const p of sec.paras) {
      if (p.verse) {
        if (n && n + p.t.length > budget) flush();
        cur.paras.push(p);
        n += p.t.length;
        continue;
      }
      // 繁简两份按同样的字数切句（两种写法逐字对应，长度一样）
      // 逗号处也可以翻页（像书本一样），页面能铺得更满
      const sentT = splitAfter(p.t, '，、。！？；：');
      let at = 0;
      let bufT = '', bufS = '';
      const push = () => {
        if (bufT) cur.paras.push({ t: bufT, s: bufS, verse: false });
        bufT = '';
        bufS = '';
      };
      for (const c of sentT) {
        const cs = p.s.slice(at, at + c.length);
        at += c.length;
        if (n + c.length > budget && (n > 0 || bufT)) {
          push();
          flush();
        }
        bufT += c;
        bufS += cs;
        n += c.length;
      }
      push();
    }
    flush();
  }
  return pages;
}

// 在这些标点之后断开（不用正则的「向后看」：旧版 iOS Safari 不认识，整段脚本会报错）
function splitAfter(str: string, marks: string) {
  const out: string[] = [];
  let cur = '';
  for (const ch of str) {
    cur += ch;
    if (marks.includes(ch)) {
      out.push(cur);
      cur = '';
    }
  }
  if (cur) out.push(cur);
  return out;
}

const cache = new Map<string, Promise<Doc>>();
function load(id: string) {
  let p = cache.get(id);
  if (!p) {
    p = fetch(new URL(`sutras/${id}.json`, document.baseURI).toString()).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Doc>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export interface ReaderHooks {
  // 一页读过了；firstToday：今天第一次读这一页
  onPage(firstToday: boolean): void;
  // 读完一整部；first：第一次读完
  onFinish(first: boolean, times: number, title: string): void;
  onClose(): void;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export class Reader {
  open = false;
  private layer: HTMLElement;
  private titleEl: HTMLElement;
  private byEl: HTMLElement;
  private body: HTMLElement;
  private bar: HTMLElement;
  private count: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private scriptBtn: HTMLButtonElement;
  private doc: Doc | null = null;
  private pages: Page[] = [];
  private page = 0;
  private timer = 0;
  private script: Script;
  private swipe: { x: number; y: number } | null = null;

  constructor(parent: HTMLElement, private hooks: ReaderHooks, zh: boolean) {
    this.script = (localStorage.getItem('sansa.script') as Script | null) ?? (zh ? 's' : 't');
    this.layer = document.createElement('div');
    this.layer.className = 'reader';
    this.layer.hidden = true;
    const sheet = document.createElement('article');
    sheet.className = 'reader-sheet';
    const head = document.createElement('header');
    const tt = document.createElement('div');
    this.titleEl = document.createElement('h2');
    this.byEl = document.createElement('small');
    tt.append(this.titleEl, this.byEl);
    this.scriptBtn = document.createElement('button');
    this.scriptBtn.className = 'pill-btn small';
    this.scriptBtn.onclick = () => {
      this.script = this.script === 's' ? 't' : 's';
      localStorage.setItem('sansa.script', this.script);
      this.render();
    };
    const close = document.createElement('button');
    close.className = 'icon-btn small';
    close.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    close.onclick = () => this.close();
    head.append(tt, this.scriptBtn, close);
    this.body = document.createElement('div');
    this.body.className = 'reader-body';
    const foot = document.createElement('footer');
    this.prevBtn = document.createElement('button');
    this.prevBtn.className = 'pill-btn';
    this.prevBtn.onclick = () => this.go(this.page - 1);
    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'pill-btn primary';
    this.nextBtn.onclick = () => this.go(this.page + 1);
    const mid = document.createElement('div');
    mid.className = 'reader-prog';
    this.bar = document.createElement('i');
    const track = document.createElement('span');
    track.append(this.bar);
    this.count = document.createElement('small');
    mid.append(track, this.count);
    foot.append(this.prevBtn, mid, this.nextBtn);
    sheet.append(head, this.body, foot);
    this.layer.append(sheet);
    parent.appendChild(this.layer);
    this.layer.addEventListener('pointerdown', (e) => {
      if (e.target === this.layer) this.close();
    });
    // 左右滑动翻页
    this.body.addEventListener('pointerdown', (e) => (this.swipe = { x: e.clientX, y: e.clientY }));
    this.body.addEventListener('pointerup', (e) => {
      const s = this.swipe;
      this.swipe = null;
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.go(this.page + (dx < 0 ? 1 : -1));
    });
    addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.go(this.page + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.go(this.page - 1);
    });
  }

  async show(id: string) {
    this.open = true;
    this.layer.hidden = false;
    this.body.innerHTML = `<p class="reader-wait">${t('readerLoading')}</p>`;
    try {
      this.doc = await load(id);
    } catch {
      this.body.innerHTML = `<p class="reader-wait">${t('readerFail')}</p>`;
      return;
    }
    if (!this.open) return;
    this.pages = paginate(this.doc, innerWidth < 600 ? 205 : 350);
    const r = progress.reading(id);
    // 换了屏幕宽窄，页数会变：读到的位置按比例换算，这一遍已读的页清掉重来
    if (r.total && r.total !== this.pages.length) {
      r.last = Math.round((r.last / r.total) * this.pages.length);
      r.seen = [];
    }
    r.total = this.pages.length;
    progress.saveReading();
    this.page = Math.min(r.last, this.pages.length - 1);
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.layer.hidden = true;
    clearTimeout(this.timer);
    this.hooks.onClose();
  }

  private go(n: number) {
    if (!this.doc || n < 0 || n >= this.pages.length) return;
    this.page = n;
    const r = progress.reading(this.doc.id);
    r.last = n;
    progress.saveReading();
    this.render();
  }

  private render() {
    if (!this.doc) return;
    const sc = this.script;
    this.scriptBtn.textContent = sc === 's' ? '繁' : '简';
    this.scriptBtn.title = t(sc === 's' ? 'readerTrad' : 'readerSimp');
    this.titleEl.textContent = this.doc.title[sc];
    this.byEl.textContent = this.doc.by[sc];
    const pg = this.pages[this.page];
    this.body.innerHTML = '';
    if (pg.h) {
      const h = document.createElement('h3');
      h.textContent = pg.h[sc];
      this.body.appendChild(h);
    }
    for (const p of pg.paras) {
      const el = document.createElement('p');
      if (p.verse) {
        // 偈颂：一句一格，排成整齐的几列
        el.className = 'verse';
        for (const phrase of splitAfter(p[sc], '，。、；！？')) {
          if (!phrase) continue;
          const s = document.createElement('span');
          s.textContent = phrase;
          el.appendChild(s);
        }
      } else el.textContent = p[sc];
      this.body.appendChild(el);
    }
    this.body.scrollTop = 0;
    const n = this.pages.length;
    const r = progress.reading(this.doc.id);
    this.bar.style.width = `${(((r.seen?.length ?? 0) / n) * 100).toFixed(1)}%`;
    this.count.textContent = `${this.page + 1} / ${n}`;
    this.prevBtn.textContent = t('readerPrev');
    this.nextBtn.textContent = t('readerNext');
    this.prevBtn.disabled = this.page === 0;
    this.nextBtn.disabled = this.page === n - 1;
    clearTimeout(this.timer);
    const id = this.doc.id, page = this.page;
    this.timer = window.setTimeout(() => this.markRead(id, page), READ_MS);
  }

  // 这一页读过了：记进这一遍的进度；今天第一次读这页给一点功德；整部读完记一遍
  private markRead(id: string, page: number) {
    if (!this.open || !this.doc || this.doc.id !== id) return;
    const r = progress.reading(id);
    const d = today();
    if (r.day !== d) {
      r.day = d;
      r.paid = [];
    }
    const first = !r.paid!.includes(page);
    if (first) r.paid!.push(page);
    if (!r.seen.includes(page)) r.seen.push(page);
    let finished = false;
    if (r.seen.length >= this.pages.length) {
      r.times++;
      r.seen = [];
      finished = true;
    }
    progress.saveReading();
    this.hooks.onPage(first);
    if (finished) this.hooks.onFinish(r.times === 1, r.times, this.doc.title[this.script]);
    this.bar.style.width = `${((r.seen.length / this.pages.length) * 100).toFixed(1)}%`;
  }
}
