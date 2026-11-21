// 耳机电台的按钮和选台小面板：底部操作栏里一个耳机按钮，点开四个台（外加寺里的念佛），正在听的那个高亮；再点一下正在听的台就摘下耳机
import { t, onLangChange, type Key } from './i18n';
import { STATIONS, type Radio, type StationId } from './radio';
import { STATION_GLOW } from './monk';

const ICON_PHONES =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2"/><rect x="3.5" y="13.5" width="4" height="6" rx="1.6"/><rect x="16.5" y="13.5" width="4" height="6" rx="1.6"/></svg>';

export function mountRadioUI(root: HTMLElement, radio: Radio, onChange: (s: StationId | null) => void, o: { slot: HTMLElement; chant: HTMLElement }) {
  const btn = document.createElement('button');
  btn.className = 'dock-btn radio-btn';
  btn.innerHTML = `${ICON_PHONES}<span></span>`;
  const pop = document.createElement('div');
  pop.className = 'radio-pop pill';
  pop.hidden = true;
  const items = STATIONS.map((id) => {
    const b = document.createElement('button');
    b.className = 'radio-st';
    b.innerHTML = '<i></i><span></span>';
    // 小圆点是这个台耳机灯的颜色
    b.style.setProperty('--st', STATION_GLOW[id]);
    b.onclick = async () => {
      if (radio.station === id) radio.stop();
      else await radio.start(id);
      onChange(radio.station);
      pop.hidden = true;
    };
    pop.append(b);
    return { id, b };
  });
  btn.onclick = (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
  };
  addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target as Node) && !btn.contains(e.target as Node)) pop.hidden = true;
  });
  pop.append(o.chant);
  o.chant.addEventListener('click', () => (pop.hidden = true));
  o.slot.prepend(btn);
  root.append(pop);
  const render = () => {
    btn.classList.toggle('on', radio.on);
    btn.setAttribute('aria-label', t('radioTitle'));
    btn.title = radio.station ? t(`station_${radio.station}` as Key) : t('radioTitle');
    (btn.querySelector('span') as HTMLElement).textContent = t('radioShort');
    for (const { id, b } of items) {
      b.classList.toggle('on', radio.station === id);
      (b.querySelector('span') as HTMLElement).textContent = t(`station_${id}` as Key);
    }
  };
  radio.onChange(render);
  onLangChange(render);
  render();
}
