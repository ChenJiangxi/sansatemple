// 16:9 讲解视频的口播稿：每段一句到几句话，配一组镜头。配音用 MiniMax 克隆音（voice.mjs 生成）
// 口播和画面里都不出现任何网址
export const VOICE = {
  model: 'speech-2.6-hd',
  voice_id: 'jessy1777965074473',
  speed: 1.0,
  // 佛教名词的读音
  tone: ['迦叶/(jia1)(she4)', '阿难/(e1)(nan2)', '释迦牟尼/(shi4)(jia1)(mou2)(ni2)', '斗栱/(dou3)(gong3)', '须弥座/(xu1)(mi2)(zuo4)', '华盖/(hua2)(gai4)', '一炷/(yi4)(zhu4)'],
};

export const SEGMENTS = [
  {
    id: 'e1',
    text: '最近，韩国有个线上寺院火了。一群小和尚在同一座寺里散步、礼佛、敲木鱼，彼此看得见，却一句话也不说。',
    shots: ['eTitle', 'court'],
  },
  { id: 'e2', text: '我只对 AI 说了一句话：帮我复刻这个游戏。', shots: ['ePrompt'] },
  {
    id: 'e3',
    text: '它真的做出来了。打开浏览器就能进，不用下载；一间最多五十人，一共开了五间。',
    shots: ['gate', 'uiRooms'],
  },
  {
    id: 'e4',
    text: '可原版是韩国寺院，我想要的是汉传佛寺。于是一点点改：山门挂上寺名匾，进门是放生池和石拱桥，两旁是钟楼、鼓楼，院中立着八角七层的双塔。',
    shots: ['plaque', 'pond', 'pagoda'],
  },
  {
    id: 'e5',
    text: '大雄宝殿是重檐顶，立在白石须弥座上。殿里供的是一佛二弟子：释迦牟尼佛居中，迦叶、阿难侍立两旁；两侧墙上是千佛壁，头顶是井口天花和华盖。',
    shots: ['hallFront', 'triad', 'wall', 'ceiling'],
  },
  {
    id: 'e6',
    text: '整座寺没有用现成的场景，殿堂、斗栱、香炉，都是代码一块块搭出来的；佛像用的是公开授权的三维扫描。',
    shots: ['ding', 'buddha'],
  },
  {
    id: 'e7',
    text: '在这里能做的事很简单：找个蒲团礼佛，一拜一拜地计数；在宝鼎前上一炷香，三分钟后燃尽，同一个房间的人都看得到。',
    shots: ['uiBow', 'bowClose', 'incense'],
  },
  {
    id: 'e8',
    text: '还能敲木鱼、拨一百零八颗念珠，去钟楼撞钟、鼓楼击鼓。这些声音全是代码实时合成的，连你现在听到的配乐也是。',
    shots: ['moktak', 'rosary', 'bell', 'drum'],
  },
  {
    id: 'e9',
    text: '寺里的时辰跟着你本地的时钟走。清晨、白天、黄昏、夜里，光线都不一样；入夜以后，灯笼、石灯和塔灯会一盏盏亮起来。',
    shots: ['grove', 'sideHall', 'nightSide', 'nightPagoda'],
  },
  { id: 'e10', text: '从一句话，到一座可以五十人同坐的寺院。累了的时候，进来坐一坐。', shots: ['crowd', 'eEnd'] },
];
