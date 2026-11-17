"""把维基文库的经文整理成游戏里「经藏」读的 JSON（繁体、简体各一份）。

用法：python3 -I tools/build-sutras.py <维基文库 API 返回的 JSON 所在目录> public/sutras
需要 opencc-python-reimplemented（繁转简）。经文都是古代译本，属于公有领域；来源写在 credits.html。

每部经输出 public/sutras/<id>.json：
{ id, title: {t, s}, by: {t, s}, sections: [{ h: {t, s} | null, paras: [{ t, s, verse }] }] }
"""
import json
import os
import re
import sys

import opencc

SRC, OUT = sys.argv[1], sys.argv[2]
cc = opencc.OpenCC('t2s')

# id、文件、标题、译者；start/end：正文从哪句开始、到哪句为止（含）
SUTRAS = [
    dict(id='eight', file='佛說八大人覺經.json', title='佛說八大人覺經', by='後漢 安世高 譯', start='為佛弟子', end='常住快樂。'),
    dict(id='amitabha', file='佛說阿彌陀經.json', title='佛說阿彌陀經', by='姚秦 鳩摩羅什 譯', start='如是我聞', end='作禮而去。'),
    dict(id='pumen', file='pumen.json', title='觀世音菩薩普門品', by='姚秦 鳩摩羅什 譯長行 · 隋 闍那崛多 譯重頌', start='爾時，無盡意菩薩即從座起', end='三藐三菩提心。'),
    dict(id='forty2', file='佛說四十二章經（高麗版大藏經本）.json', title='佛說四十二章經', by='後漢 迦葉摩騰、竺法蘭 譯', start='昔漢孝明皇帝', end=None),
    dict(id='diamond', file='金剛般若波羅蜜經_(鳩摩羅什).json', title='金剛般若波羅蜜經', by='姚秦 鳩摩羅什 譯', start='====法會因由分', end='信受奉行。'),
]


def clean_inline(s: str) -> str:
    s = re.sub(r'<sub>.*?</sub>', '', s)
    s = re.sub(r'<br\s*/?>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\[\[(?:File|Image|文件|檔案):[^\]]*\]\]', '', s)
    s = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\[\[([^\]]*)\]\]', r'\1', s)
    s = re.sub(r"'{2,}", '', s)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    return s.strip()


def build(spec):
    w = json.load(open(os.path.join(SRC, spec['file']), encoding='utf-8'))['parse']['wikitext']['*']
    # 去掉多行的模板（header 等）
    while True:
        n = re.sub(r'\{\{[^{}]*\}\}', '', w, flags=re.S)
        if n == w:
            break
        w = n
    i = w.find(spec['start'])
    assert i >= 0, spec['id']
    w = w[i:]
    if spec['end']:
        j = w.find(spec['end'])
        assert j >= 0, spec['id']
        w = w[: j + len(spec['end'])]
    else:
        w = w.split('[[Category')[0]
    sections = [{'h': None, 'paras': []}]
    for line in w.split('\n'):
        line = line.rstrip()
        if not line.strip():
            continue
        m = re.match(r'^=+\s*([^=]+?)\s*=+$', line)
        if m:
            title = re.sub(r'『.*?』', '', m.group(1)).strip()
            sections.append({'h': title, 'paras': []})
            continue
        verse = line.startswith(':')
        text = clean_inline(line.lstrip(':'))
        if not text or text.startswith('__'):
            continue
        sections[-1]['paras'].append({'t': text, 'verse': verse})
    sections = [s for s in sections if s['paras']]
    out = {
        'id': spec['id'],
        'title': {'t': spec['title'], 's': cc.convert(spec['title'])},
        'by': {'t': spec['by'], 's': cc.convert(spec['by'])},
        'sections': [
            {
                'h': None if s['h'] is None else {'t': s['h'], 's': cc.convert(s['h'])},
                'paras': [{'t': p['t'], 's': cc.convert(p['t']), 'verse': p['verse']} for p in s['paras']],
            }
            for s in sections
        ],
    }
    chars = sum(len(p['t']) for s in sections for p in s['paras'])
    os.makedirs(OUT, exist_ok=True)
    json.dump(out, open(os.path.join(OUT, spec['id'] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(spec['id'], 'sections', len(sections), 'chars', chars)


# 心经：游戏里抄经用的玄奘译本（src/sutra.ts 里的同一段），按句号分段
HEART = (
    '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。舍利子，色不異空，空不異色，色即是空，空即是色，受想行識，亦復如是。'
    '舍利子，是諸法空相，不生不滅，不垢不淨，不增不減。是故空中無色，無受想行識，無眼耳鼻舌身意，無色聲香味觸法，無眼界，乃至無意識界，'
    '無無明，亦無無明盡，乃至無老死，亦無老死盡。無苦集滅道，無智亦無得。以無所得故，菩提薩埵，依般若波羅蜜多故，心無罣礙，無罣礙故，'
    '無有恐怖，遠離顛倒夢想，究竟涅槃。三世諸佛，依般若波羅蜜多故，得阿耨多羅三藐三菩提。故知般若波羅蜜多，是大神咒，是大明咒，是無上咒，'
    '是無等等咒，能除一切苦，真實不虛。故說般若波羅蜜多咒，即說咒曰：揭諦揭諦，波羅揭諦，波羅僧揭諦，菩提薩婆訶。'
)
paras = [p + '。' for p in HEART.split('。') if p]
heart = {
    'id': 'heart',
    'title': {'t': '般若波羅蜜多心經', 's': cc.convert('般若波羅蜜多心經')},
    'by': {'t': '唐 玄奘 譯', 's': cc.convert('唐 玄奘 譯')},
    'sections': [{'h': None, 'paras': [{'t': p, 's': cc.convert(p), 'verse': False} for p in paras]}],
}
os.makedirs(OUT, exist_ok=True)
json.dump(heart, open(os.path.join(OUT, 'heart.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('heart', 'chars', sum(len(p) for p in paras))
for spec in SUTRAS:
    build(spec)
