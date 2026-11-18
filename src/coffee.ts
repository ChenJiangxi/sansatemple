// 山寺咖啡：东院的小茶寮里，咖啡师父现做一杯带走。
// 一杯分三口喝；满杯可以请别人喝（常住僧人或别的访客）；喝完把空杯放进回收桶。
// 这里是饮品表、手里那只杯子的模型、点单面板、手边的杯子条和分享卡片；走路、动作、联机在 main.ts。
import * as THREE from 'three';
import { t, onLangChange, type Key } from './i18n';
import { sealImage } from './ui-extra';

export type DrinkId = 'latte' | 'americano' | 'coldbrew' | 'osmanthus' | 'decaf';
export interface Drink {
  id: DrinkId;
  cold?: boolean;
  sleeve: string; // 杯套颜色
  lid: string;
  liquid: string;
  foam?: string; // 奶泡（分享卡上画的杯口）
}
export const DRINKS: Drink[] = [
  { id: 'latte', sleeve: '#b98a5a', lid: '#f2ede3', liquid: '#b88a62', foam: '#efe2cc' },
  { id: 'americano', sleeve: '#4c3527', lid: '#2b2521', liquid: '#2e1a10' },
  { id: 'coldbrew', cold: true, sleeve: '#b98a5a', lid: '#eef3f4', liquid: '#3f2416' },
  { id: 'osmanthus', sleeve: '#d8ae52', lid: '#f2ede3', liquid: '#cfae80', foam: '#f3e4c4' },
  { id: 'decaf', sleeve: '#7f957a', lid: '#f2ede3', liquid: '#8a6646', foam: '#eadfcd' },
];
export const DRINK_BY_ID = new Map(DRINKS.map((d) => [d.id, d]));
export const SIPS = 3;
export const BREW_MS = 6500;
export const CUP_RE = /^(latte|americano|coldbrew|osmanthus|decaf)\.[0-3]$/;

export function cupCode(c: { d: DrinkId; sips: number } | null) {
  return c ? `${c.d}.${c.sips}` : '';
}
export function parseCup(code: string | undefined): { d: DrinkId; sips: number } | null {
  if (!code || !CUP_RE.test(code)) return null;
  const [d, n] = code.split('.');
  return { d: d as DrinkId, sips: Number(n) };
}

// —— 杯子模型（米为单位，原点在杯子正中，始终竖直）——
// 热饮：白纸杯、牛皮纸杯套上盖一方小红印、杯盖；冷萃：透明杯、深色咖啡、冰块、吸管，喝一口液面低一截
let sleeveTex: THREE.CanvasTexture | null = null;
function sleeveTexture() {
  if (sleeveTex) return sleeveTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 64);
  // 纸纹
  for (let k = 0; k < 500; k++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.3)';
    g.fillRect(Math.random() * 256, Math.random() * 64, 1 + Math.random() * 4, 1);
  }
  // 正面一方小红印
  g.fillStyle = '#a8261c';
  g.fillRect(112, 18, 30, 30);
  g.fillStyle = '#fff';
  g.fillRect(117, 23, 20, 3);
  g.fillRect(126, 23, 3, 20);
  g.fillRect(117, 40, 20, 3);
  sleeveTex = new THREE.CanvasTexture(c);
  sleeveTex.colorSpace = THREE.SRGBColorSpace;
  return sleeveTex;
}

export function cupMesh(d: Drink) {
  const g = new THREE.Group();
  const H = 0.1;
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  let level: THREE.Mesh | null = null;
  if (!d.cold) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.029, H, 20, 1, true), std({ color: '#f4f1ea', side: THREE.DoubleSide, roughness: 0.75 }));
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.029, 20), std({ color: '#e8e3d8' }));
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = -H / 2;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0335, 0.042, 20, 1, true), std({ color: d.sleeve, map: sleeveTexture(), roughness: 0.9 }));
    sleeve.position.y = 0.002;
    sleeve.rotation.y = -Math.PI / 2; // 小红印朝外（朝拿杯人的前方）
    const lid = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[0, 0.012], [0.03, 0.012], [0.034, 0.006], [0.0415, 0.004], [0.0415, -0.002], [0.039, -0.004]].map(([r, y]) => new THREE.Vector2(r, y)),
        24
      ),
      std({ color: d.lid, roughness: 0.45 })
    );
    lid.position.y = H / 2;
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.005), std({ color: '#111' }));
    hole.position.set(0, H / 2 + 0.0125, 0.022);
    g.add(body, bottom, sleeve, lid, hole);
  } else {
    const H2 = 0.115;
    // 杯壁很淡：日光下白色的杯壁一亮，就把里面的咖啡盖成一片灰
    const glass = std({ color: '#c9d4d8', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.031, H2, 20, 1, true), glass);
    body.renderOrder = 2;
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.03, 1, 18), std({ color: d.liquid, roughness: 0.25 }));
    level = liquid;
    const ice = std({ color: '#b9c9cf', transparent: true, opacity: 0.5, roughness: 0.05 });
    for (const [x, y, z, r] of [[0.012, 0.02, 0.008, 0.4], [-0.01, 0.032, -0.006, 1.1], [0.002, 0.008, -0.014, 2.2]]) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.018, 0.02), ice);
      cube.position.set(x, y, z);
      cube.rotation.set(r, r * 0.7, 0);
      g.add(cube);
    }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.004, 22), std({ color: '#c9d4d8', transparent: true, opacity: 0.35, roughness: 0.1 }));
    lid.position.y = H2 / 2;
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.17, 8), std({ color: '#2f4a3a', roughness: 0.4 }));
    straw.position.set(0.008, 0.045, 0.004);
    straw.rotation.z = -0.12;
    g.add(body, liquid, lid, straw);
  }
  const setSips = (n: number) => {
    if (!level) return;
    // 冷萃：液面跟着喝掉的口数往下走
    const full = 0.085, h = (full * Math.max(0, n)) / SIPS;
    level.visible = n > 0;
    level.scale.y = Math.max(0.001, h);
    level.position.y = -0.115 / 2 + 0.003 + h / 2;
  };
  setSips(SIPS);
  g.traverse((m) => ((m as THREE.Mesh).castShadow = true));
  return { group: g, setSips };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// 界面上的小杯子（纯 CSS）：杯身、杯套颜色、杯盖
function cupIcon(d: Drink, sips = SIPS) {
  const i = el('span', `cup-icon${d.cold ? ' cold' : ''}`);
  i.style.setProperty('--sleeve', d.sleeve);
  i.style.setProperty('--lid', d.lid);
  i.style.setProperty('--liquid', d.liquid);
  i.style.setProperty('--level', String(sips / SIPS));
  i.innerHTML = '<i class="lid"></i><i class="body"><i class="liquid"></i><i class="sleeve"></i></i>';
  return i;
}

const ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>';

export interface CafeHooks {
  choose(d: DrinkId): void; // 点了一杯
  sip(): void;
  recycle(): void; // 去放空杯
  close(): void; // 关了点单面板（没点）
  getName(): string;
}

export class CafeUI {
  private menu: HTMLElement;
  private list: HTMLElement;
  private brew: HTMLElement;
  private brewCup: HTMLElement;
  private brewText: HTMLElement;
  private brewBar: HTMLElement;
  private chip: HTMLElement;
  private chipCup: HTMLElement;
  private chipName: HTMLElement;
  private chipDots: HTMLElement;
  private chipBtn: HTMLButtonElement;
  private chipShare: HTMLButtonElement;
  private share: HTMLElement;
  private shareImg: HTMLImageElement;
  private shareNote: HTMLInputElement;
  private shareSave: HTMLAnchorElement;
  private cup: { d: DrinkId; sips: number; from?: string } | null = null;
  private shareTimer = 0;
  open = false;
  private texts: () => void;

  constructor(root: HTMLElement, private h: CafeHooks) {
    // 点单：一张纸做的菜单
    this.menu = el('div', 'cafe');
    this.menu.hidden = true;
    const sheet = el('div', 'cafe-sheet');
    const head = el('header');
    const title = el('div', 'cafe-title', '<h2>山寺咖啡</h2><small></small>');
    const close = el('button', 'icon-btn small', ICON_X);
    close.onclick = () => this.closeMenu(true);
    head.append(title, close);
    this.list = el('ul', 'cafe-list');
    const foot = el('p', 'cafe-foot');
    // 做咖啡：杯子一点点满起来
    this.brew = el('div', 'cafe-brew');
    this.brew.hidden = true;
    this.brewCup = el('div', 'cafe-brew-cup');
    this.brewText = el('p');
    const bar = el('span', 'cafe-bar');
    this.brewBar = el('i');
    bar.append(this.brewBar);
    this.brew.append(this.brewCup, this.brewText, bar);
    sheet.append(head, this.list, this.brew, foot);
    this.menu.append(sheet);
    this.menu.addEventListener('pointerdown', (e) => {
      if (e.target === this.menu && this.brew.hidden) this.closeMenu(true);
    });

    // 手边的杯子条：喝一口 / 去放空杯 / 分享
    this.chip = el('div', 'pill cup-chip');
    this.chip.hidden = true;
    this.chipCup = el('span', 'cup-chip-icon');
    const txt = el('span', 'cup-chip-text');
    this.chipName = el('b');
    this.chipDots = el('small');
    txt.append(this.chipName, this.chipDots);
    this.chipBtn = el('button', 'cup-chip-btn');
    this.chipBtn.onclick = () => (this.cup && this.cup.sips > 0 ? this.h.sip() : this.h.recycle());
    this.chipShare = el('button', 'icon-btn small', ICON_SHARE);
    this.chipShare.onclick = () => this.openShare();
    this.chip.append(this.chipCup, txt, this.chipBtn, this.chipShare);

    // 分享卡：一张竖图，可以写一句话，存下来发给朋友
    this.share = el('div', 'cafe');
    this.share.hidden = true;
    const ss = el('div', 'cafe-share');
    this.shareImg = el('img');
    this.shareImg.alt = '';
    const row = el('div', 'cafe-share-row');
    this.shareNote = el('input');
    this.shareNote.maxLength = 24;
    this.shareNote.oninput = () => {
      clearTimeout(this.shareTimer);
      this.shareTimer = window.setTimeout(() => this.renderShare(), 250);
    };
    this.shareSave = el('a', 'pill-btn primary');
    const back = el('button', 'pill-btn');
    back.onclick = () => (this.share.hidden = true);
    row.append(this.shareNote);
    const btns = el('div', 'cafe-share-btns');
    btns.append(back, this.shareSave);
    ss.append(this.shareImg, row, btns);
    this.share.append(ss);
    this.share.addEventListener('pointerdown', (e) => {
      if (e.target === this.share) this.share.hidden = true;
    });

    root.append(this.menu, this.chip, this.share);
    this.texts = () => {
      (title.querySelector('small') as HTMLElement).textContent = t('cafeSub');
      close.setAttribute('aria-label', t('close'));
      foot.textContent = t('cafeFoot');
      this.chipShare.setAttribute('aria-label', t('cafeShare'));
      this.chipShare.title = t('cafeShare');
      this.shareNote.placeholder = t('cafeNote');
      this.shareSave.textContent = t('sutraSave');
      back.textContent = t('cafeBack');
      this.renderChip();
    };
    this.texts();
    onLangChange(() => this.texts());
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.share.hidden) this.share.hidden = true;
      else if (this.open && this.brew.hidden) this.closeMenu(true);
    });
  }

  // —— 点单 ——
  openMenu() {
    this.texts();
    this.list.innerHTML = '';
    for (const d of DRINKS) {
      const li = el('li');
      const b = el('button');
      const txt = el('span', 'cafe-item');
      txt.innerHTML = `<b>${t(`drink_${d.id}` as Key)}</b><small>${t(`drinkDesc_${d.id}` as Key)}</small>`;
      b.append(cupIcon(d), txt, el('em', '', t('cafeMake')));
      b.onclick = () => this.h.choose(d.id);
      li.append(b);
      this.list.append(li);
    }
    this.list.hidden = false;
    this.brew.hidden = true;
    this.menu.hidden = false;
    this.open = true;
  }
  closeMenu(byUser = false) {
    if (!this.open) return;
    this.open = false;
    this.menu.hidden = true;
    if (byUser) this.h.close();
  }
  // 做咖啡：杯子从空到满，进度条走 ms 毫秒
  showBrewing(d: DrinkId, ms: number) {
    const dr = DRINK_BY_ID.get(d)!;
    this.list.hidden = true;
    this.brew.hidden = false;
    this.brewCup.innerHTML = '';
    const icon = cupIcon(dr, 0);
    icon.classList.add('big', 'filling');
    icon.style.setProperty('--ms', `${ms}ms`);
    this.brewCup.append(icon, el('i', 'steam'), el('i', 'steam b'), el('i', 'steam c'));
    this.brewText.textContent = t('cafeBrewing', { x: t(`drink_${d}` as Key) });
    this.brewBar.style.transition = 'none';
    this.brewBar.style.width = '0%';
    void this.brewBar.offsetWidth;
    this.brewBar.style.transition = `width ${ms}ms linear`;
    this.brewBar.style.width = '100%';
  }

  // —— 手边的杯子 ——
  setCup(c: { d: DrinkId; sips: number; from?: string } | null) {
    this.cup = c;
    this.renderChip();
  }
  private renderChip() {
    const c = this.cup;
    this.chip.hidden = !c;
    if (!c) return;
    const d = DRINK_BY_ID.get(c.d)!;
    this.chipCup.innerHTML = '';
    this.chipCup.append(cupIcon(d, c.sips));
    this.chipName.textContent = c.sips > 0 ? t(`drink_${c.d}` as Key) : t('cupEmpty');
    this.chipDots.textContent = c.sips > 0 ? (c.sips === SIPS ? t('cupFullHint') : t('cupLeft', { n: c.sips })) : t('cupEmptyHint');
    this.chipBtn.textContent = c.sips > 0 ? t('cupSip') : t('cupRecycle');
    this.chipBtn.classList.toggle('empty', c.sips <= 0);
    this.chipShare.hidden = c.sips <= 0;
  }
  // 喝一口时按钮暂时不能点（动作做完再说）
  setBusy(on: boolean) {
    this.chipBtn.disabled = on;
  }

  // —— 分享卡 ——
  private openShare() {
    if (!this.cup) return;
    this.shareNote.value = '';
    this.share.hidden = false;
    this.renderShare();
  }
  private async renderShare() {
    const c = this.cup;
    if (!c) return;
    const url = await shareCard(c.d, this.h.getName(), c.from, this.shareNote.value.trim());
    this.shareImg.src = url;
    this.shareSave.href = url;
    const d = new Date();
    this.shareSave.download = `sansa-coffee-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.png`;
  }
}

// 分享卡：1080×1440 竖图。米色纸面，上面一只画出来的杯子，饮品名、一句话、落款和印
async function shareCard(id: DrinkId, name: string, from: string | undefined, note: string) {
  const d = DRINK_BY_ID.get(id)!;
  const W = 1080, H = 1440;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f6efe0');
  bg.addColorStop(1, '#ece2cc');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 7000; k++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(255,255,255,0.25)' : 'rgba(120,92,52,0.05)';
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 7, 1.2);
  }
  // 细朱框
  g.strokeStyle = 'rgba(168,38,28,0.55)';
  g.lineWidth = 2;
  g.strokeRect(48, 48, W - 96, H - 96);
  const serif = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
  const kai = '"Kaiti SC", "STKaiti", "KaiTi", "BiauKai", serif';
  g.textAlign = 'center';
  g.fillStyle = '#7a6450';
  g.font = `500 30px ${serif}`;
  spaced(g, '山 寺 咖 啡', W / 2, 140, 10);
  g.font = `22px ${serif}`;
  g.fillStyle = '#a08a74';
  spaced(g, 'SANSA TEMPLE CAFÉ', W / 2, 182, 6);

  // 杯子：投影、杯身、杯套、杯盖，杯口冒两缕热气（冷萃画冰块和吸管）
  const cx = W / 2, top = 330, bh = 400, rt = 150, rb = 112;
  g.fillStyle = 'rgba(80,50,20,0.12)';
  g.beginPath();
  g.ellipse(cx, top + bh + 24, rb * 1.5, 26, 0, 0, Math.PI * 2);
  g.fill();
  const body = () => {
    g.beginPath();
    g.moveTo(cx - rt, top);
    g.lineTo(cx + rt, top);
    g.lineTo(cx + rb, top + bh);
    g.quadraticCurveTo(cx, top + bh + 18, cx - rb, top + bh);
    g.closePath();
  };
  if (!d.cold) {
    const cg = g.createLinearGradient(cx - rt, 0, cx + rt, 0);
    cg.addColorStop(0, '#e9e4d9');
    cg.addColorStop(0.35, '#fbf9f4');
    cg.addColorStop(1, '#ddd6c8');
    g.fillStyle = cg;
    body();
    g.fill();
    // 杯套
    const y0 = top + bh * 0.32, y1 = top + bh * 0.72;
    const at = (y: number) => rt + ((rb - rt) * (y - top)) / bh;
    const sg = g.createLinearGradient(cx - rt, 0, cx + rt, 0);
    sg.addColorStop(0, shade(d.sleeve, -0.12));
    sg.addColorStop(0.4, shade(d.sleeve, 0.08));
    sg.addColorStop(1, shade(d.sleeve, -0.18));
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(cx - at(y0) - 4, y0);
    g.lineTo(cx + at(y0) + 4, y0);
    g.lineTo(cx + at(y1) + 4, y1);
    g.lineTo(cx - at(y1) - 4, y1);
    g.closePath();
    g.fill();
    // 杯套上的印
    const seal = await img(sealImage('靜山', 160));
    g.drawImage(seal, cx - 46, (y0 + y1) / 2 - 46, 92, 92);
    // 杯盖
    g.fillStyle = shade(d.lid, -0.06);
    roundRect(g, cx - rt - 14, top - 34, (rt + 14) * 2, 40, 14);
    g.fill();
    g.fillStyle = d.lid;
    roundRect(g, cx - rt + 18, top - 66, (rt - 18) * 2, 38, 16);
    g.fill();
    // 热气
    g.strokeStyle = 'rgba(150,130,110,0.35)';
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (const [x, s] of [[cx - 40, 1], [cx + 34, -1]]) {
      g.beginPath();
      g.moveTo(x, top - 90);
      g.bezierCurveTo(x + 30 * s, top - 130, x - 30 * s, top - 170, x + 6 * s, top - 215);
      g.stroke();
    }
  } else {
    // 透明杯：咖啡、冰块、吸管
    g.save();
    body();
    g.clip();
    g.fillStyle = 'rgba(240,248,252,0.55)';
    g.fillRect(cx - rt, top, rt * 2, bh + 20);
    const lg = g.createLinearGradient(0, top + 80, 0, top + bh);
    lg.addColorStop(0, shade(d.liquid, 0.25));
    lg.addColorStop(1, d.liquid);
    g.fillStyle = lg;
    g.fillRect(cx - rt, top + 80, rt * 2, bh);
    g.fillStyle = 'rgba(235,246,250,0.55)';
    for (const [x, y, s, r] of [[-60, 120, 70, 0.2], [30, 100, 64, -0.3], [-10, 170, 60, 0.6], [55, 200, 56, 0.1]]) {
      g.save();
      g.translate(cx + x, top + y);
      g.rotate(r);
      roundRect(g, -s / 2, -s / 2, s, s, 10);
      g.fill();
      g.restore();
    }
    g.restore();
    g.strokeStyle = 'rgba(160,180,190,0.6)';
    g.lineWidth = 3;
    body();
    g.stroke();
    g.fillStyle = 'rgba(235,242,245,0.9)';
    roundRect(g, cx - rt - 10, top - 18, (rt + 10) * 2, 22, 10);
    g.fill();
    g.strokeStyle = '#2f4a3a';
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + 30, top + 140);
    g.lineTo(cx + 62, top - 120);
    g.stroke();
  }

  // 饮品名、介绍
  g.fillStyle = '#2a1f17';
  g.font = `600 84px ${kai}`;
  g.fillText(t(`drink_${id}` as Key), W / 2, 930);
  g.fillStyle = '#6d5a48';
  g.font = `34px ${serif}`;
  g.fillText(t(`drinkDesc_${id}` as Key), W / 2, 996);
  // 一句话（自己写的；没写就用默认的）
  g.fillStyle = '#a8261c';
  g.font = `40px ${kai}`;
  const line = note || (from ? t('cafeCardFrom', { n: from }) : t('cafeCardSelf'));
  g.fillText(`「${line}」`, W / 2, 1110);
  // 落款与印
  const dt = new Date();
  g.fillStyle = '#7a6450';
  g.font = `30px ${serif}`;
  g.fillText(`${name} · ${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()}`, W / 2, 1224);
  const seal = await img(sealImage('入山', 160));
  g.drawImage(seal, W / 2 - 34, 1262, 68, 68);
  g.fillStyle = '#a08a74';
  g.font = `24px ${serif}`;
  g.fillText(location.host || 'santemple', W / 2, H - 70);
  return c.toDataURL('image/png');
}

function spaced(g: CanvasRenderingContext2D, s: string, x: number, y: number, sp: number) {
  g.save();
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${sp}px`;
  g.fillText(s, x, y);
  g.restore();
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  return k >= 0 ? `#${c.lerp(new THREE.Color('#ffffff'), k).getHexString()}` : `#${c.multiplyScalar(1 + k).getHexString()}`;
}
function img(src: string) {
  return new Promise<HTMLImageElement>((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(im);
    im.src = src;
  });
}
