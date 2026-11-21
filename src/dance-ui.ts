// 半山夜场的舞步条：戴着耳机站上舞池跳起来时出现在底部，四种舞步点哪个换哪个（和围炉煮茶的操作条同一个样式）
import { t, onLangChange, type Key } from './i18n';
import { DANCES, type Action } from './monk';

export class DanceUI {
  private bar: HTMLElement;
  private title: HTMLElement;
  private btns: { m: Action; b: HTMLButtonElement }[];
  private move: Action = 'groove';
  shown = false;

  constructor(root: HTMLElement, pick: (m: Action) => void) {
    this.bar = document.createElement('div');
    this.bar.className = 'tea-bar dance-bar';
    this.bar.hidden = true;
    this.title = document.createElement('span');
    this.title.className = 'tea-title';
    this.btns = DANCES.map((m) => {
      const b = document.createElement('button');
      b.className = 'tea-btn';
      b.onclick = () => pick(m);
      return { m, b };
    });
    this.bar.append(this.title, ...this.btns.map((x) => x.b));
    root.append(this.bar);
    onLangChange(() => this.render());
    this.render();
  }

  set(visible: boolean, move: Action) {
    if (visible === this.shown && move === this.move) return;
    this.shown = visible;
    this.move = move;
    this.bar.hidden = !visible;
    this.render();
  }

  private render() {
    this.title.textContent = t('discoTitle');
    for (const { m, b } of this.btns) {
      b.textContent = t(`dance_${m}` as Key);
      b.classList.toggle('on', m === this.move);
    }
  }
}
