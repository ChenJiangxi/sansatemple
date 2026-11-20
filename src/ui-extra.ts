// 新增的界面：开场标题、寺游印谱（印章画在 canvas 上）、得印的盖章动画、签文卡片
import { t, type Key } from './i18n';
import { SEALS, progress, LEVELS, levelOf, PLACE_LEVEL, DAILY, DAILY_BONUS, type SealId, type MeritKey } from './progress';
import { SUTRA_LIST } from './reader';
import { ROBES, BEADS, type Look } from './looks';
import { LOTS, NUMERALS } from './fortune';

const fontUrl = (f: string) => `url(${new URL(`fonts/${f}`, document.baseURI).toString()})`;
let sealFont: Promise<void> | null = null;
let poemFont: Promise<void> | null = null;
// 印章和标题的字体很小，一开始就加载；签诗字体只在第一次求签时加载
export function loadUiFonts() {
  sealFont ??= Promise.all(
    [new FontFace('SansaSeal', fontUrl('seal.woff2')), new FontFace('SansaTitle', fontUrl('title.woff2')), new FontFace('SansaSealSong', fontUrl('seal-song.woff2'), { weight: '600' })].map((f) =>
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
// 一方印：白文长方印——竖长的朱红印面，两个字上下排（从上往下读），字从印面上镂空出来。
// 字用思源宋体中粗（600，只取印文用字），每个字接近正方形，不再压扁；印面四角略圆，朱泥只有一点点深浅。
// 2026-11-20 用户两次说印章不好看：原来是最粗的字硬塞进正方形，每个字被压成扁条；改成传统的长方印。
export function sealImage(text: string, size = 128, gold = false, font = 'SansaSealSong'): string {
  const key = `${text}|${size}|${gold}|${font}`;
  const hit = sealCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let seed = [...text].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const chars = [...text].slice(0, 2);
  const H = size * 0.86;
  const W = chars.length === 1 ? H : H * 0.66;
  const x0 = (size - W) / 2, y0 = (size - H) / 2;
  g.beginPath();
  g.roundRect(x0, y0, W, H, size * 0.06);
  g.fillStyle = gold ? '#b0832e' : '#b5302a';
  g.fill();
  g.save();
  g.clip();
  for (let i = 0; i < 4; i++) {
    const x = x0 + rnd() * W, y = y0 + rnd() * H, r = H * (0.3 + rnd() * 0.3);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(60,0,0,0.06)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  g.restore();
  // 镂空印文
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `600 ${size}px ${font}, "Noto Serif TC", "Songti TC", serif`;
  const innerW = W * 0.84, innerH = H * 0.84;
  const ix = x0 + (W - innerW) / 2, iy = y0 + (H - innerH) / 2;
  const cellH = innerH / chars.length;
  chars.forEach((ch, i) => {
    const m = g.measureText(ch);
    const gw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight || size;
    const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || size;
    const gap = size * 0.025;
    const sx = (innerW - gap) / gw, sy = (cellH - gap) / gh;
    g.save();
    g.translate(ix + innerW / 2, iy + cellH * (i + 0.5));
    g.scale(sx, sy);
    g.fillText(ch, (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    g.restore();
  });
  g.globalCompositeOperation = 'source-over';
  const url = c.toDataURL();
  // 印文字体还没下载完时画出来的是替代字体，不缓存，下次再画
  if (document.fonts.check(`600 20px ${font}`)) sealCache.set(key, url);
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
      // 没盖的：一个浅浅的虚线印框，只写印名；点一下，怎么得这方印显示在顶上那一行
      li.innerHTML = `<span class="seal-empty">${[...s.text].join('<br>')}</span><b>${name}</b>`;
      li.tabIndex = 0;
      li.onclick = () => (top.textContent = hint);
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

// —— 修行面板：四页。进度（称号与功德、今日功课、修行之路）、经藏（六部经的阅读进度）、规则（怎样积功德）、衣钵 ——
export type PracticeTab = 'progress' | 'sutras' | 'rules' | 'look';
export interface PracticeCtx {
  tab: PracticeTab;
  onTab(t: PracticeTab): void;
  look: Look;
  onPick(l: Look): void;
  onRead(id: string): void;
  onGo(dailyId: string): void;
  script: 't' | 's';
}
const RULES: Key[] = ['rule_bow', 'rule_incense', 'rule_bell', 'rule_moktak', 'rule_beads', 'rule_offer', 'rule_service', 'rule_quest', 'rule_halls', 'rule_climb', 'rule_copy', 'rule_read', 'rule_daily'];

export function practicePanel(c: PracticeCtx): HTMLElement {
  const pts = progress.points();
  const lv = levelOf(pts);
  const wrap = document.createElement('div');
  wrap.className = 'practice';
  const tabs = document.createElement('div');
  tabs.className = 'practice-tabs';
  tabs.setAttribute('role', 'tablist');
  for (const [k, key] of [['progress', 'tabProgress'], ['sutras', 'tabSutras'], ['rules', 'tabRules'], ['look', 'practiceWardrobe']] as [PracticeTab, Key][]) {
    const b = document.createElement('button');
    b.textContent = t(key);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(c.tab === k));
    b.className = c.tab === k ? 'on' : '';
    b.onclick = () => c.onTab(k);
    tabs.appendChild(b);
  }
  wrap.appendChild(tabs);
  const h3 = (key: Key, vars?: Record<string, string | number>) => {
    const h = document.createElement('h3');
    h.textContent = t(key, vars);
    return h;
  };
  const bar = (k: number) => `<div class="practice-bar"><i style="width:${(Math.min(1, k) * 100).toFixed(1)}%"></i></div>`;

  if (c.tab === 'progress') {
    const head = document.createElement('div');
    head.className = 'practice-head';
    const next = LEVELS[lv + 1];
    const k = next ? (pts - LEVELS[lv].at) / (next.at - LEVELS[lv].at) : 1;
    head.innerHTML = `<b>${t(LEVELS[lv].key as Key)}</b><span>${t('practicePoints', { n: pts })}</span>${bar(k)}
      <small>${next ? t('practiceNext', { t: t(next.key as Key), n: next.at - pts }) : t('practiceMax')}</small>`;
    wrap.appendChild(head);
    // 今日功课
    wrap.appendChild(h3('dailyTitle'));
    const ul = document.createElement('ul');
    ul.className = 'daily-list';
    for (const q of DAILY) {
      if ((q.lv ?? 0) > lv) continue;
      const n = Math.min(q.need, progress.today(q.id));
      const done = progress.dailyGot(q.id) || n >= q.need;
      const li = document.createElement('li');
      li.className = done ? 'done' : '';
      li.innerHTML = `<span class="daily-name">${t(`daily_${q.id}` as Key)}</span><small>${n}/${q.need}</small>${bar(n / q.need)}<em>+${q.reward}</em>`;
      const go = document.createElement('button');
      go.className = 'pill-btn small';
      go.textContent = done ? '✓' : t('dailyGo');
      go.disabled = done;
      go.onclick = () => c.onGo(q.id);
      li.appendChild(go);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
    const note = document.createElement('p');
    note.className = 'practice-note';
    note.textContent = t('dailyNote', { n: DAILY_BONUS });
    wrap.appendChild(note);
    // 修行之路：每一级的称号、门槛，以及这一级开放的地方、经书和衣钵
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
        ...SUTRA_LIST.filter((x) => x.lv === i).map((x) => `《${x.title[c.script]}》`),
        ...ROBES.filter((r) => r.lv === i).map((r) => t(`robe_${r.id}` as Key)),
        ...BEADS.filter((b) => b.lv === i).map((b) => t(`bead_${b.id}` as Key)),
      ];
      li.innerHTML = `<b>${t(L.key as Key)}</b><small>${L.at}</small><span>${gets.join(' · ')}</span>`;
      path.appendChild(li);
    });
    wrap.append(h3('practicePath'), path);
  } else if (c.tab === 'sutras') {
    const ul = document.createElement('ul');
    ul.className = 'sutra-list';
    for (const x of SUTRA_LIST) {
      const open = x.lv <= lv;
      const r = progress.reading(x.id);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = open ? '' : 'locked';
      b.disabled = !open;
      const pct = r.total ? Math.round((r.seen.length / r.total) * 100) : 0;
      const status = !open ? t('sutraOpenAt', { t: t(LEVELS[x.lv].key as Key) }) : r.times ? `${t('sutraTimes', { n: r.times })}${pct ? ' · ' + t('sutraPct', { p: pct }) : ''}` : pct ? t('sutraPct', { p: pct }) : t('sutraUnread');
      b.innerHTML = `<b>《${x.title[c.script]}》</b><small>${status}</small>${open ? bar(pct / 100) : ''}`;
      b.onclick = () => c.onRead(x.id);
      li.appendChild(b);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
  } else if (c.tab === 'rules') {
    const p = document.createElement('p');
    p.className = 'practice-note';
    p.textContent = t('rulesIntro');
    const ul = document.createElement('ul');
    ul.className = 'rules-list';
    for (const k of RULES) {
      const li = document.createElement('li');
      li.textContent = t(k);
      ul.appendChild(li);
    }
    wrap.append(p, ul);
  } else {
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
        c.look.robe,
        (id) => c.onPick({ ...c.look, robe: id })
      )
    );
    wrap.appendChild(
      row(
        'beadsLabel',
        BEADS.map((b) => ({ id: b.id, lv: b.lv, name: t(`bead_${b.id}` as Key), sw: `radial-gradient(circle at 35% 30%, #fff8 0 12%, ${b.color} 40%)` })),
        c.look.beads,
        (id) => c.onPick({ ...c.look, beads: id })
      )
    );
  }
  return wrap;
}
