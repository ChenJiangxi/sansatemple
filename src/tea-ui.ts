// 围炉煮茶的操作条：坐到围炉的椅子上时出现在底部。喝茶（再点放下）、烤橘子/柿子/栗子；烤好的会变成「吃」按钮
import { t, onLangChange, type Key } from './i18n';
import { ROAST_KINDS, type RoastKind } from './world/tea';

export interface TeaHooks {
  drink(): void;
  drinking(): boolean;
  roast(kind: RoastKind): void;
  eat(slot: number): void;
}

export class TeaUI {
  private bar: HTMLElement;
  private title: HTMLElement;
  private drinkBtn: HTMLButtonElement;
  private roastBtns: { kind: RoastKind; b: HTMLButtonElement }[];
  private readyBox: HTMLElement;
  private ready = new Map<number, RoastKind>();
  shown = false;

  constructor(root: HTMLElement, private h: TeaHooks) {
    this.bar = document.createElement('div');
    this.bar.className = 'tea-bar';
    this.bar.hidden = true;
    this.title = document.createElement('span');
    this.title.className = 'tea-title';
    this.drinkBtn = document.createElement('button');
    this.drinkBtn.className = 'tea-btn';
    this.drinkBtn.onclick = () => {
      this.h.drink();
      this.render();
    };
    this.roastBtns = ROAST_KINDS.map((kind) => {
      const b = document.createElement('button');
      b.className = 'tea-btn';
      b.onclick = () => this.h.roast(kind);
      return { kind, b };
    });
    this.readyBox = document.createElement('div');
    this.readyBox.className = 'tea-ready';
    this.bar.append(this.title, this.drinkBtn, ...this.roastBtns.map((x) => x.b), this.readyBox);
    root.append(this.bar);
    onLangChange(() => this.render());
    this.render();
  }

  setVisible(v: boolean) {
    if (v === this.shown) return;
    this.shown = v;
    this.bar.hidden = !v;
    if (!v) this.ready.clear();
    this.render();
  }

  addReady(slot: number, kind: RoastKind) {
    this.ready.set(slot, kind);
    this.render();
  }

  render() {
    this.title.textContent = t('teaTitle');
    this.drinkBtn.textContent = this.h.drinking() ? t('teaStop') : t('teaDrink');
    this.drinkBtn.classList.toggle('on', this.h.drinking());
    for (const { kind, b } of this.roastBtns) b.textContent = t(`roast_${kind}` as Key);
    this.readyBox.innerHTML = '';
    for (const [slot, kind] of this.ready) {
      const b = document.createElement('button');
      b.className = 'tea-btn ready';
      b.textContent = t('roastEat', { x: t(`food_${kind}` as Key) });
      b.onclick = () => {
        this.ready.delete(slot);
        this.h.eat(slot);
        this.render();
      };
      this.readyBox.append(b);
    }
  }
}
