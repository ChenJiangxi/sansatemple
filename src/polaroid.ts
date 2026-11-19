// 拍立得打卡：右上角相机按钮。按下后小和尚转身面向镜头，倒数三秒，闪光，拍下当前的游戏画面（不带界面文字），
// 印成一张白边拍立得：底下手写地名和日期，像真相纸一样慢慢显影。每个景点第一次拍的那张收进「打卡册」（十二处）。
import { t, onLangChange, type Key } from './i18n';
import { BELL, PAGODAS, SIDE_HALLS, LIBRARY, POND, WISH_ALLEY, PERSIMMON, cafeLocal, CAFE } from './layout';

export const SPOTS = ['gate', 'pond', 'bell', 'ginkgo', 'pagoda', 'hall', 'guanyin', 'dizang', 'library', 'cafe', 'alley', 'persimmon'] as const;
export type SpotId = (typeof SPOTS)[number];
// 相纸上的题字（中文手写体，各语言都用这一行；字体只含这些字）
export const SPOT_INK: Record<SpotId | 'temple', string> = {
  gate: '山门', pond: '放生池', bell: '钟楼', ginkgo: '银杏树下', pagoda: '双塔', hall: '大殿',
  guanyin: '观音殿', dizang: '地藏殿', library: '藏经阁', cafe: '半山咖啡', alley: '祈福灯廊', persimmon: '柿柿如意', temple: '山寺',
};

const near = (x: number, z: number, ax: number, az: number, r: number) => Math.hypot(x - ax, z - az) < r;
export function spotAt(x: number, z: number): SpotId | 'temple' {
  if (near(x, z, PERSIMMON.x, PERSIMMON.z, 4)) return 'persimmon';
  const cl = cafeLocal(x, z);
  if (Math.abs(cl.lx) < CAFE.hw + 1.5 && cl.lz > -CAFE.hd - 0.5 && cl.lz < CAFE.deck + 2.5) return 'cafe';
  const A = WISH_ALLEY;
  if (x > A.xW - 2.5 && x < A.xE + 2.5 && z > A.zs[0] - 2.5 && z < A.zs[A.zs.length - 1] + 2.5) return 'alley';
  if (near(x, z, BELL.x, BELL.z, 7)) return 'bell';
  if (near(x, z, 24, 27, 6)) return 'ginkgo';
  if (PAGODAS.some((p) => near(x, z, p.x, p.z, 6))) return 'pagoda';
  if (near(x, z, SIDE_HALLS[0].x, SIDE_HALLS[0].z, 10)) return 'guanyin';
  if (near(x, z, SIDE_HALLS[1].x, SIDE_HALLS[1].z, 10)) return 'dizang';
  if (near(x, z, LIBRARY.x, LIBRARY.z, 14)) return 'library';
  if (Math.abs(x) < 16 && z > -14 && z < 9) return 'hall';
  if (Math.abs(x - POND.x) < POND.rx + 3 && Math.abs(z - POND.z) < POND.rz + 4) return 'pond';
  if (z > 58) return 'gate';
  return 'temple';
}

const ALBUM_KEY = 'sansa.album';
type Album = Partial<Record<SpotId, { at: number; img: string }>>;
function readAlbum(): Album {
  try {
    return JSON.parse(localStorage.getItem(ALBUM_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function writeAlbum(a: Album) {
  try {
    localStorage.setItem(ALBUM_KEY, JSON.stringify(a));
  } catch {
    /* 存不下就不收进打卡册 */
  }
}

let handFont: Promise<void> | null = null;
function loadHand() {
  handFont ??= new FontFace('SansaHand', `url(${new URL('fonts/hand.woff2', document.baseURI).toString()})`)
    .load()
    .then((f) => {
      document.fonts.add(f);
    })
    .catch(() => {});
  return handFont;
}

const ICON_CAMERA =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="13" rx="2.5"/><path d="M8.5 6.5 10 4.5h4l1.5 2"/><circle cx="12" cy="13" r="3.4"/><path d="M17 9.5h.01"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

export interface PolaroidHooks {
  name(): string;
  where(): { x: number; z: number };
  // 拍之前：小和尚转身面向镜头（走路时不转）
  pose(): void;
  // 在下一帧画面画完的那一刻把画面交给 cb
  grab(cb: (src: HTMLCanvasElement) => void): void;
  shutter(): void;
}

export class PolaroidUI {
  private layer: HTMLElement;
  private sheet: HTMLElement;
  private img: HTMLImageElement;
  private save: HTMLAnchorElement;
  private albumBtn: HTMLButtonElement;
  private album: HTMLElement;
  private grid: HTMLElement;
  private albumTitle: HTMLElement;
  private count: HTMLElement;
  private flash: HTMLElement;
  private cd: HTMLElement;
  private busy = false;
  open = false;

  constructor(root: HTMLElement, private h: PolaroidHooks, slot: HTMLElement) {
    loadHand();
    // 快门：底部操作栏最右边一个浅色圆钮
    const btn = document.createElement('button');
    btn.className = 'shutter camera-btn';
    btn.innerHTML = ICON_CAMERA;
    btn.onclick = () => this.shoot();
    slot.append(btn);

    this.flash = el('div', 'pola-flash');
    this.cd = el('div', 'pola-count');
    this.layer = el('div', 'pola');
    this.layer.hidden = true;
    this.sheet = el('div', 'pola-sheet');
    const close = el('button', 'icon-btn small pola-close', ICON_X);
    close.onclick = () => this.close();
    this.img = el('img', 'pola-photo') as HTMLImageElement;
    this.img.alt = '';
    const acts = el('div', 'pola-acts');
    this.save = el('a', 'pill-btn primary') as HTMLAnchorElement;
    this.albumBtn = el('button', 'pill-btn') as HTMLButtonElement;
    this.albumBtn.onclick = () => this.showAlbum();
    acts.append(this.albumBtn, this.save);
    this.sheet.append(close, this.img, acts);
    // 打卡册
    this.album = el('div', 'pola-album');
    this.album.hidden = true;
    const ah = el('header');
    this.albumTitle = el('h2');
    this.count = el('small');
    const aClose = el('button', 'icon-btn small', ICON_X);
    aClose.onclick = () => this.close();
    const tt = el('div', 'pola-album-title');
    tt.append(this.albumTitle, this.count);
    ah.append(tt, aClose);
    this.grid = el('div', 'pola-grid');
    this.album.append(ah, this.grid);
    this.layer.append(this.sheet, this.album);
    this.layer.addEventListener('pointerdown', (e) => {
      if (e.target === this.layer) this.close();
    });
    addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') this.close();
    });
    root.append(this.flash, this.cd, this.layer);
    const texts = () => {
      btn.setAttribute('aria-label', t('polaTake'));
      btn.title = t('polaTake');
      this.save.textContent = t('polaSave');
      this.albumTitle.textContent = t('polaAlbum');
      close.setAttribute('aria-label', t('close'));
      aClose.setAttribute('aria-label', t('close'));
      this.renderCount();
    };
    texts();
    onLangChange(texts);
  }

  private renderCount() {
    const n = Object.keys(readAlbum()).length;
    this.albumBtn.textContent = `${t('polaAlbum')} ${n} / ${SPOTS.length}`;
    this.count.textContent = t('polaCount', { n, m: SPOTS.length });
  }

  async shoot() {
    if (this.busy) return;
    this.busy = true;
    this.close();
    this.h.pose();
    // 倒数 3 · 2 · 1
    for (const n of ['3', '2', '1']) {
      this.cd.textContent = n;
      this.cd.classList.remove('go');
      void this.cd.offsetWidth;
      this.cd.classList.add('go');
      await sleep(650);
    }
    this.cd.textContent = '';
    await loadHand();
    const where = this.h.where();
    const spot = spotAt(where.x, where.z);
    this.h.grab(async (src) => {
      this.h.shutter();
      this.flash.classList.remove('go');
      void this.flash.offsetWidth;
      this.flash.classList.add('go');
      const card = this.compose(src, spot);
      const url = card.toDataURL('image/jpeg', 0.9);
      // 第一次在这里拍的，收进打卡册（存一张小图）
      let fresh = false;
      if (spot !== 'temple') {
        const a = readAlbum();
        if (!a[spot]) {
          a[spot] = { at: Date.now(), img: thumb(card, 260) };
          writeAlbum(a);
          fresh = true;
        }
      }
      await sleep(350);
      this.showPhoto(url, spot, fresh);
      this.busy = false;
    });
  }

  // 拍立得：米白相纸，上方正方形照片（取画面中间一块），下方手写地名、日期和署名
  private compose(src: HTMLCanvasElement, spot: SpotId | 'temple') {
    const W = 900, H = 1080, P = 50, S = 800;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f6f2e8';
    g.fillRect(0, 0, W, H);
    // 相纸的细微颗粒
    for (let k = 0; k < 3500; k++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.4)';
      g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    const side = Math.min(src.width, src.height);
    const sx = (src.width - side) / 2, sy = (src.height - side) / 2;
    g.save();
    g.filter = 'saturate(1.08) contrast(1.06) sepia(0.12) brightness(1.03)';
    g.drawImage(src, sx, sy, side, side, P, P, S, S);
    g.restore();
    // 暗角和一点暖色
    const v = g.createRadialGradient(P + S / 2, P + S / 2, S * 0.3, P + S / 2, P + S / 2, S * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(30,15,0,0.32)');
    g.fillStyle = v;
    g.fillRect(P, P, S, S);
    g.fillStyle = 'rgba(255,190,120,0.06)';
    g.fillRect(P, P, S, S);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 2;
    g.strokeRect(P, P, S, S);
    // 题字
    const d = new Date();
    g.fillStyle = '#3a2f28';
    g.textBaseline = 'alphabetic';
    g.font = '86px SansaHand, "Kaiti SC", STKaiti, serif';
    g.textAlign = 'left';
    g.fillText(SPOT_INK[spot], P + 18, H - 92);
    g.font = '44px SansaHand, "Kaiti SC", STKaiti, serif';
    g.textAlign = 'right';
    g.fillStyle = '#6b5a4c';
    g.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, W - P - 10, H - 94);
    g.font = '26px "PingFang SC", "Hiragino Sans GB", sans-serif';
    g.fillStyle = '#9a8a7a';
    g.fillText(this.h.name(), W - P - 10, H - 48);
    return c;
  }

  private showPhoto(url: string, spot: SpotId | 'temple', fresh: boolean) {
    this.img.src = url;
    this.img.classList.remove('dev');
    void this.img.offsetWidth;
    this.img.classList.add('dev');
    const d = new Date();
    this.save.href = url;
    this.save.download = `santemple-${spot}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.jpg`;
    this.renderCount();
    this.albumBtn.classList.toggle('fresh', fresh);
    this.sheet.hidden = false;
    this.album.hidden = true;
    this.layer.hidden = false;
    this.open = true;
  }

  showAlbum() {
    const a = readAlbum();
    this.grid.innerHTML = '';
    for (const id of SPOTS) {
      const cell = el('figure', a[id] ? 'got' : '');
      const pic = el('div', 'pola-mini');
      if (a[id]) {
        const im = el('img') as HTMLImageElement;
        im.src = a[id]!.img;
        im.alt = '';
        pic.append(im);
      }
      const cap = el('figcaption');
      cap.textContent = t(`spot_${id}` as Key);
      cell.append(pic, cap);
      this.grid.append(cell);
    }
    this.renderCount();
    this.sheet.hidden = true;
    this.album.hidden = false;
    this.layer.hidden = false;
    this.open = true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.layer.hidden = true;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function thumb(src: HTMLCanvasElement, w: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.round((w * src.height) / src.width);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}
