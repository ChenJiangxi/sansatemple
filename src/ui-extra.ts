// 新增的界面：开场标题、寺游印谱（印章画在 canvas 上）、得印的盖章动画、签文卡片
import { t, type Key } from './i18n';
import { SEALS, progress, LEVELS, levelOf, PLACE_LEVEL, type SealId, type MeritKey } from './progress';
import { ROBES, BEADS, type Look } from './looks';
import { LOTS, NUMERALS } from './fortune';

const fontUrl = (f: string) => `url(${new URL(`fonts/${f}`, document.baseURI).toString()})`;
let sealFont: Promise<void> | null = null;
let poemFont: Promise<void> | null = null;
// 印章和标题的字体很小，一开始就加载；签诗字体只在第一次求签时加载
export function loadUiFonts() {
  sealFont ??= Promise.all(
    [new FontFace('SansaSeal', fontUrl('seal.woff2')), new FontFace('SansaTitle', fontUrl('title.woff2'))].map((f) =>
      f.load().then((ff) => {
        document.fonts.add(ff);
      })
    )
  ).then(
    () => {},
    () => {}
  );
  return sealFont;
}
function loadPoemFont() {
  poemFont ??= new FontFace('SansaPoem', fontUrl('poem.woff2'))
    .load()
    .then((ff) => {
      document.fonts.add(ff);
    })
    .catch(() => {});
  return poemFont;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// —— 印章：朱红方印，白文，边缘略有残破 ——
const sealCache = new Map<string, string>();
export function sealImage(text: string, size = 128, gold = false, font = 'SansaSeal'): string {
  const key = `${text}|${size}|${gold}|${font}`;
  const hit = sealCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const pad = size * 0.06;
  const r = size * 0.07;
  const box = (x: number, y: number, w: number, h: number, rr: number) => {
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  };
  g.fillStyle = gold ? '#b8862d' : '#b3261e';
  box(pad, pad, size - pad * 2, size - pad * 2, r);
  g.fill();
  g.strokeStyle = '#f6ecd8';
  g.lineWidth = size * 0.035;
  box(size * 0.14, size * 0.14, size * 0.72, size * 0.72, r * 0.5);
  g.stroke();
  g.fillStyle = '#f6ecd8';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = [...text];
  if (chars.length === 1) {
    g.font = `${size * 0.52}px ${font}, serif`;
    g.fillText(chars[0], size / 2, size / 2 + size * 0.02);
  } else {
    // 两字竖排，每字压扁一点，填满印面
    g.font = `${size * 0.31}px ${font}, serif`;
    chars.slice(0, 2).forEach((ch, i) => {
      g.save();
      g.translate(size / 2, size * (0.355 + i * 0.29));
      g.scale(1.45, 1);
      g.fillText(ch, 0, size * 0.01);
      g.restore();
    });
  }
  // 残破：按印文算的伪随机小点，同一方印每次都一样
  g.globalCompositeOperation = 'destination-out';
  let s = [...text].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 46; i++) {
    const edge = rnd() < 0.6;
    const x = edge ? (rnd() < 0.5 ? pad + rnd() * size * 0.08 : size - pad - rnd() * size * 0.08) : pad + rnd() * (size - pad * 2);
    const y = pad + rnd() * (size - pad * 2);
    g.beginPath();
    g.arc(rnd() < 0.5 ? x : y, rnd() < 0.5 ? y : x, size * (0.006 + rnd() * 0.014), 0, Math.PI * 2);
    g.fill();
  }
  const url = c.toDataURL();
  sealCache.set(key, url);
  return url;
}

// —— 印谱面板的内容 ——
const MERIT: [MeritKey, Key][] = [
  ['visits', 'meritVisits'],
  ['service', 'meritService'],
  ['bow', 'meritBow'],
  ['incense', 'meritIncense'],
  ['moktak', 'meritMoktak'],
  ['beads', 'meritBeads'],
  ['bell', 'meritBell'],
  ['drum', 'meritDrum'],
  ['lantern', 'meritLantern'],
  ['koi', 'meritKoi'],
  ['sutra', 'meritSutra'],
];
export function sealBook(): HTMLElement {
  const wrap = el('div', 'sealbook');
  const n = progress.count();
  const top = el('p', 'sealbook-progress');
  top.textContent = n >= 12 ? t('sealsDone') : t('sealsProgress', { n });
  wrap.appendChild(top);
  const grid = el('ul', 'seal-grid');
  for (const s of SEALS) {
    const li = el('li', progress.has(s.id) ? 'got' : 'todo');
    const name = t(`seal_${s.id}` as Key);
    const hint = t(`sealHint_${s.id}` as Key);
    if (progress.has(s.id)) {
      const d = new Date(progress.when(s.id));
      li.innerHTML = `<img alt="" src="${sealImage(s.text, 128)}"><b>${name}</b><small>${d.getMonth() + 1}/${d.getDate()}</small>`;
    } else {
      li.innerHTML = `<span class="seal-empty">${s.text}</span><b>${name}</b><small>${hint}</small>`;
    }
    li.title = hint;
    grid.appendChild(li);
  }
  wrap.appendChild(grid);
  const merit = el('div', 'merit');
  merit.innerHTML = `<h3>${t('meritTitle')}</h3>`;
  const items = MERIT.filter(([k]) => progress.merit(k) > 0);
  const ul = el('ul');
  if (!items.length) ul.innerHTML = `<li class="muted">${t('meritEmpty')}</li>`;
  for (const [k, key] of items) ul.insertAdjacentHTML('beforeend', `<li>${t(key, { n: progress.merit(k) })}</li>`);
  merit.appendChild(ul);
  wrap.appendChild(merit);
  return wrap;
}

// —— 得印：大印「盖」在屏幕中间，停一会儿，再缩小飞向右上角的印谱按钮 ——
let popChain = Promise.resolve();
export function sealPop(parent: HTMLElement, id: SealId, target?: HTMLElement, done = false) {
  popChain = popChain.then(
    () =>
      new Promise<void>((resolve) => {
        const s = SEALS.find((x) => x.id === id)!;
        const box = el('div', 'seal-pop');
        const text = done ? t('sealsDone') : t('sealGot', { name: t(`seal_${id}` as Key) });
        box.innerHTML = `<img alt="" src="${sealImage(done ? '圓滿' : s.text, 220, done)}"><p>${text}</p>`;
        box.setAttribute('role', 'status');
        parent.appendChild(box);
        requestAnimationFrame(() => box.classList.add('in'));
        setTimeout(() => {
          const r = target?.getBoundingClientRect();
          if (r) {
            const img = box.querySelector('img')!;
            const ir = img.getBoundingClientRect();
            img.style.transform = `translate(${r.left + r.width / 2 - (ir.left + ir.width / 2)}px, ${r.top + r.height / 2 - (ir.top + ir.height / 2)}px) scale(0.12)`;
          }
          box.classList.add('out');
          target?.classList.add('ping');
          setTimeout(() => target?.classList.remove('ping'), 900);
        }, done ? 3200 : 2100);
        setTimeout(() => {
          box.remove();
          resolve();
        }, done ? 4000 : 2900);
      })
  );
}

// —— 签文卡片 ——
export async function showFortune(parent: HTMLElement, n: number, again: boolean, lang: string): Promise<void> {
  await loadPoemFont();
  await loadUiFonts();
  return new Promise((resolve) => {
    const lot = LOTS[n];
    const back = el('div', 'fortune-back');
    const card = el('section', 'fortune');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const zh = lang === 'zh';
    const reading = zh ? lot.zh : lot.en;
    card.innerHTML = `
      <header><span class="f-no">第${NUMERALS[n]}籤</span><span class="f-grade">${lot.grade}</span></header>
      ${zh ? '' : `<p class="f-sub">${t('fortuneNo', { n: n + 1 })}</p>`}
      <div class="f-poem">${lot.poem.map((l) => `<p>${l}</p>`).join('')}</div>
      <p class="f-by">${lot.by}</p>
      <hr>
      <p class="f-read">${reading}</p>
      ${again ? `<p class="f-note">${t('fortuneToday')}</p>` : ''}
      <button class="f-keep">${t('fortuneKeep')}</button>`;
    back.appendChild(card);
    parent.appendChild(back);
    requestAnimationFrame(() => back.classList.add('in'));
    const btn = card.querySelector('.f-keep') as HTMLButtonElement;
    btn.focus({ preventScroll: true });
    const close = () => {
      back.classList.remove('in');
      setTimeout(() => back.remove(), 400);
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') close();
    };
    document.addEventListener('keydown', onKey);
    btn.onclick = close;
    back.onclick = (e) => {
      if (e.target === back) close();
    };
  });
}

// —— 开场标题：寺名一笔笔显出来，然后是「入山门」按钮和一行操作说明 ——
export function titleCard(parent: HTMLElement, touch: boolean, onEnter: () => void) {
  const card = el('section', 'title-card');
  card.innerHTML = `
    <div class="tc-inner">
      <h1 class="tc-name"><span>山寺</span><img alt="" class="tc-seal"></h1>
      <p class="tc-tag">${t('tagline')}</p>
      <button class="tc-enter">${t('enter')}</button>
      <p class="tc-ctl">${t(touch ? 'hintTouch' : 'hintDesktop')}</p>
    </div>`;
  parent.appendChild(card);
  loadUiFonts().then(() => {
    (card.querySelector('.tc-seal') as HTMLImageElement).src = sealImage('靜山', 120);
    card.classList.add('in');
  });
  setTimeout(() => card.classList.add('in'), 1200);
  const btn = card.querySelector('.tc-enter') as HTMLButtonElement;
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    card.classList.add('out');
    setTimeout(() => card.remove(), 1100);
    document.removeEventListener('keydown', onKey);
    onEnter();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  };
  document.addEventListener('keydown', onKey);
  btn.onclick = go;
  setTimeout(() => btn.focus({ preventScroll: true }), 1500);
}

// —— 共修提示条：屏幕上方一行，带「去礼佛」按钮 ——
export function serviceChip(parent: HTMLElement, onGo: () => void) {
  const chip = el('div', 'pill service-chip');
  chip.hidden = true;
  const text = el('span', 'svc-text');
  const btn = el('button', 'svc-go');
  btn.onclick = onGo;
  chip.append(text, btn);
  parent.appendChild(chip);
  let last = '';
  return {
    set(msg: string | null, go: string | null) {
      const key = `${msg}|${go}`;
      if (key === last) return;
      last = key;
      chip.hidden = !msg;
      text.textContent = msg ?? '';
      btn.hidden = !go;
      btn.textContent = go ?? '';
    },
  };
}

// —— 修行面板：称号与功德进度、每一级开放什么、衣钵（僧袍和念珠，没到等级的锁着） ——
export function practicePanel(look: Look, onPick: (l: Look) => void): HTMLElement {
  const pts = progress.points();
  const lv = levelOf(pts);
  const wrap = document.createElement('div');
  wrap.className = 'practice';
  const head = document.createElement('div');
  head.className = 'practice-head';
  const next = LEVELS[lv + 1];
  const k = next ? (pts - LEVELS[lv].at) / (next.at - LEVELS[lv].at) : 1;
  head.innerHTML = `<b>${t(LEVELS[lv].key as Key)}</b><span>${t('practicePoints', { n: pts })}</span>
    <div class="practice-bar"><i style="width:${(k * 100).toFixed(1)}%"></i></div>
    <small>${next ? t('practiceNext', { t: t(next.key as Key), n: next.at - pts }) : t('practiceMax')}</small>`;
  wrap.appendChild(head);

  // 修行之路：每一级的称号、门槛，以及这一级开放的地方和衣钵
  const path = document.createElement('ol');
  path.className = 'practice-path';
  const places: [number, Key][] = [
    [PLACE_LEVEL.guanyin, 'hallGuanyin'],
    [PLACE_LEVEL.dizang, 'hallDizang'],
    [PLACE_LEVEL.library, 'placeLibrary'],
    [PLACE_LEVEL.pagoda, 'placePagoda'],
  ];
  LEVELS.forEach((L, i) => {
    if (i === 0) return;
    const li = document.createElement('li');
    li.className = i <= lv ? 'got' : '';
    const gets = [
      ...places.filter(([n]) => n === i).map(([, key]) => t(key)),
      ...ROBES.filter((r) => r.lv === i).map((r) => t(`robe_${r.id}` as Key)),
      ...BEADS.filter((b) => b.lv === i).map((b) => t(`bead_${b.id}` as Key)),
    ];
    li.innerHTML = `<b>${t(L.key as Key)}</b><small>${L.at}</small><span>${gets.join(' · ')}</span>`;
    path.appendChild(li);
  });
  const h1 = document.createElement('h3');
  h1.textContent = t('practicePath');
  wrap.append(h1, path);

  // 衣钵
  const h2 = document.createElement('h3');
  h2.textContent = t('practiceWardrobe');
  wrap.appendChild(h2);
  const row = (label: Key, items: { id: string; lv: number; sw: string; name: string }[], cur: string, pick: (id: string) => void) => {
    const box = document.createElement('div');
    box.className = 'look-row';
    const lab = document.createElement('span');
    lab.className = 'look-label';
    lab.textContent = t(label);
    const ul = document.createElement('ul');
    for (const it of items) {
      const open = it.lv <= lv;
      const b = document.createElement('button');
      b.className = `look-sw${it.id === cur ? ' on' : ''}${open ? '' : ' locked'}`;
      b.disabled = !open;
      b.title = open ? it.name : `${it.name} · ${t('unlockAt', { t: t(LEVELS[it.lv].key as Key) })}`;
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(it.id === cur));
      b.innerHTML = `<i style="background:${it.sw}"></i><small>${open ? it.name : t(LEVELS[it.lv].key as Key)}</small>`;
      b.onclick = () => pick(it.id);
      const li = document.createElement('li');
      li.appendChild(b);
      ul.appendChild(li);
    }
    box.append(lab, ul);
    return box;
  };
  wrap.appendChild(
    row(
      'robeLabel',
      ROBES.map((r) => ({ id: r.id, lv: r.lv, name: t(`robe_${r.id}` as Key), sw: `linear-gradient(135deg, ${r.robe} 0 48%, ${r.kasaya.border} 48% 56%, ${r.kasaya.base} 56%)` })),
      look.robe,
      (id) => onPick({ ...look, robe: id })
    )
  );
  wrap.appendChild(
    row(
      'beadsLabel',
      BEADS.map((b) => ({ id: b.id, lv: b.lv, name: t(`bead_${b.id}` as Key), sw: `radial-gradient(circle at 35% 30%, #fff8 0 12%, ${b.color} 40%)` })),
      look.beads,
      (id) => onPick({ ...look, beads: id })
    )
  );
  return wrap;
}
