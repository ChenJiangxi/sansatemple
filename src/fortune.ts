// 观音殿前的灵签：二十四支，签诗取唐宋诗与禅偈原句（均为公有领域），配一句白话解签。
// 只分上上、上吉、中吉、中平四等，不设下签——来这里的人，求的是一句宽心话。
export type Grade = '上上' | '上吉' | '中吉' | '中平';

export interface Lot {
  grade: Grade;
  poem: string[];
  by: string; // 出处
  zh: string; // 解签
  en: string;
}

export const LOTS: Lot[] = [
  { grade: '上上', poem: ['春有百花秋有月', '夏有凉风冬有雪', '若无闲事挂心头', '便是人间好时节'], by: '宋·无门慧开', zh: '心上无事，四季皆好。眼下就是好时节。', en: 'With nothing weighing on the heart, every season is a good one — including this one.' },
  { grade: '上上', poem: ['手把青秧插满田', '低头便见水中天', '六根清净方为道', '退步原来是向前'], by: '五代·布袋和尚', zh: '退一步不是输，低下头才看见天。', en: 'Stepping back is also moving forward; bow your head and you will see the sky in the water.' },
  { grade: '上上', poem: ['菩提本无树', '明镜亦非台', '本来无一物', '何处惹尘埃'], by: '唐·慧能', zh: '烦恼多半是自己添的，放下就轻了。', en: 'Most dust is what we gather ourselves; set it down and you are light again.' },
  { grade: '上上', poem: ['朝辞白帝彩云间', '千里江陵一日还', '两岸猿声啼不住', '轻舟已过万重山'], by: '唐·李白', zh: '难关已在身后，船正顺流而下。', en: 'The hardest stretch is behind you; the boat is already running with the current.' },
  { grade: '上上', poem: ['好雨知时节', '当春乃发生', '随风潜入夜', '润物细无声'], by: '唐·杜甫', zh: '好事来得悄无声息，正在慢慢长。', en: 'Good things are arriving quietly, the way spring rain does.' },
  { grade: '上上', poem: ['飞来山上千寻塔', '闻说鸡鸣见日升', '不畏浮云遮望眼', '自缘身在最高层'], by: '宋·王安石', zh: '站得高一些，眼前的云就遮不住你。', en: 'Climb a little higher and the passing clouds will not block your view.' },
  { grade: '上吉', poem: ['山重水复疑无路', '柳暗花明又一村'], by: '宋·陆游', zh: '看似走到头了，再走几步就是新路。', en: 'Where the road seems to end, a few more steps reveal a new village.' },
  { grade: '上吉', poem: ['白日依山尽', '黄河入海流', '欲穷千里目', '更上一层楼'], by: '唐·王之涣', zh: '想看得更远，就再往上走一层。', en: 'To see a thousand miles, climb one more floor.' },
  { grade: '上吉', poem: ['半亩方塘一鉴开', '天光云影共徘徊', '问渠那得清如许', '为有源头活水来'], by: '宋·朱熹', zh: '心清是因为常有新水流进来，多读多看。', en: 'A pond stays clear because fresh water keeps flowing in — keep learning.' },
  { grade: '上吉', poem: ['荡胸生曾云', '决眦入归鸟', '会当凌绝顶', '一览众山小'], by: '唐·杜甫', zh: '登到顶上，回头看今天的事都小了。', en: 'From the summit, today’s troubles will look small.' },
  { grade: '上吉', poem: ['沉舟侧畔千帆过', '病树前头万木春'], by: '唐·刘禹锡', zh: '一处停下了，别处仍在生长，你也会。', en: 'Beside one sunken boat a thousand sails pass; you will set sail again too.' },
  { grade: '上吉', poem: ['清晨入古寺', '初日照高林', '曲径通幽处', '禅房花木深'], by: '唐·常建', zh: '绕一点远路也无妨，好地方常在深处。', en: 'A winding path is fine; the quiet places are often deep inside.' },
  { grade: '中吉', poem: ['山光悦鸟性', '潭影空人心', '万籁此俱寂', '但余钟磬音'], by: '唐·常建', zh: '先静下来，该听见的自然会听见。', en: 'Be still first; what you need to hear will reach you.' },
  { grade: '中吉', poem: ['行到水穷处', '坐看云起时'], by: '唐·王维', zh: '走不下去时就坐下看云，云会自己起来。', en: 'When the stream runs out, sit and watch the clouds rise.' },
  { grade: '中吉', poem: ['泉眼无声惜细流', '树阴照水爱晴柔', '小荷才露尖尖角', '早有蜻蜓立上头'], by: '宋·杨万里', zh: '刚冒头的小事，已经有人在看了。', en: 'Your small beginning has already been noticed.' },
  { grade: '中吉', poem: ['应怜屐齿印苍苔', '小扣柴扉久不开', '春色满园关不住', '一枝红杏出墙来'], by: '宋·叶绍翁', zh: '门暂时没开，好东西终究会透出来。', en: 'The gate is closed for now, but spring cannot be kept inside.' },
  { grade: '中吉', poem: ['月落乌啼霜满天', '江枫渔火对愁眠', '姑苏城外寒山寺', '夜半钟声到客船'], by: '唐·张继', zh: '睡不着的夜里，也有一声钟陪着你。', en: 'Even on a sleepless night, a temple bell reaches your boat.' },
  { grade: '中吉', poem: ['空山新雨后', '天气晚来秋', '明月松间照', '清泉石上流'], by: '唐·王维', zh: '雨过了，天自然清，慢一点走。', en: 'After the rain the air turns clear; walk slowly and enjoy it.' },
  { grade: '中平', poem: ['人闲桂花落', '夜静春山空', '月出惊山鸟', '时鸣春涧中'], by: '唐·王维', zh: '闲下来，才看得见花落和月出。', en: 'Only when you are idle do you notice the falling blossoms and the rising moon.' },
  { grade: '中平', poem: ['横看成岭侧成峰', '远近高低各不同', '不识庐山真面目', '只缘身在此山中'], by: '宋·苏轼', zh: '换个位置看，事情就不一样了。', en: 'Step outside the mountain to see its true shape.' },
  { grade: '中平', poem: ['春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少'], by: '唐·孟浩然', zh: '昨夜的风雨过去了，今天先好好睡一觉。', en: 'Last night’s storm has passed; rest well first.' },
  { grade: '中平', poem: ['独怜幽草涧边生', '上有黄鹂深树鸣', '春潮带雨晚来急', '野渡无人舟自横'], by: '唐·韦应物', zh: '没人催你，船横着也能等一等。', en: 'No one is hurrying you; the boat can wait at the ferry.' },
  { grade: '中平', poem: ['独坐幽篁里', '弹琴复长啸', '深林人不知', '明月来相照'], by: '唐·王维', zh: '一个人也不孤单，月亮会来照你。', en: 'Alone in the bamboo, you are not unseen — the moon comes to keep you company.' },
  { grade: '中平', poem: ['回首向来萧瑟处', '归去', '也无风雨也无晴'], by: '宋·苏轼', zh: '回头再看，风雨和晴天都只是一段路。', en: 'Looking back, the storm and the sunshine were both just part of the road.' },
];

export const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二', '二十三', '二十四'];
