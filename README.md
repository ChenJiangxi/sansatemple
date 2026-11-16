# 山寺 · sansa-clone

照着 [sansatemple.com](https://sansatemple.com/) 的玩法重做的一座线上寺院，
建筑和人物按汉传佛寺来做：大家各是一个穿黄海青、披红袈裟的 Q 版小沙弥，
在同一座寺里散步、合十、去大雄宝殿的蒲团上礼佛、敲木鱼、拨 108 颗念珠、
坐石凳、上香、撞钟击鼓，彼此看得见但不聊天。

代码、贴图和声音全部是新写的，没有使用原站的任何素材；佛像用的是公开授权的博物馆扫描模型（见「素材来源」）。

## 运行

```bash
npm install --include=dev      # 本机 NODE_ENV=production，要显式装开发依赖
npm run build                  # 生成 dist/
npm start                      # node server/server.mjs → http://127.0.0.1:4318
```

开发时可以两个终端分别跑 `npm run server` 和 `npm run dev`（Vite 在 4317 端口，
`/ws`、`/api` 自动代理到 4318）。

环境变量：`PORT`（默认 4318）、`HOST`（默认 127.0.0.1，对外部署改成 0.0.0.0）。

链接参数：`?lang=zh|ko|ja|en` 切换语言，`?time=dawn|day|dusk|night` 固定时段，
`?room=1..5` 进入指定服务器。
调试用：`?svc=秒数` 把寺里的时刻表拨到当前小时的第几秒（如 `?svc=70` 直接看共修）。
下面几个要和 `?debugview` 一起用：`?routine=秒数` 把僧人的日常拨到一轮里的第几秒（如 `?routine=70` 看小沙弥奉茶），
`?say=elder` 让某位僧人开口，`?hideme` 截图时隐藏自己。

## 玩法与操作

| 操作 | 桌面 | 手机 |
|---|---|---|
| 走动 | 点地面 / WASD / 方向键 | 点地面 |
| 环顾、缩放 | 拖动 / 滚轮 | 单指滑动 / 双指捏合 |
| 礼佛（找空蒲团，跪拜循环计数） | 1、E、空格 | 底栏「礼佛」 |
| 念珠（上下拨，108 颗一圈） | 2，方向键或滚轮拨珠 | 上下滑 |
| 合十 | 3 | 底栏「合十」 |
| 木鱼（可自动敲） | 5，空格敲 | 点木鱼 |
| 坐下 / 上香 / 撞钟 / 击鼓 | 点蒲团、石凳 / 点院中或佛前香炉（镜头自动切到特写）/ 点钟楼的钟 / 点鼓楼的鼓 | 同左 |
| 放河灯 | 点放生池边的「河燈」台：捧灯跪下，把莲花灯放进水里，同一房间的人都看得见，漂 8 分钟 | 同左 |
| 喂锦鲤 | 点放生池的水面：走到岸边撒鱼食，锦鲤会游过来 | 同左 |
| 求签 | 点观音殿前的签筒：摇出一支签（二十四支，唐宋诗与禅偈），一天一支 | 同左 |
| 寺游印谱 | 右上角的印章按钮：十二处功课各盖一方印，十二印集齐为「圆满」；下面是功德簿（累计次数） | 同左 |

## 寺里的人与时刻表

寺里常住十一位僧人，穿灰褐海青（老和尚穿黄袍、搭袈裟，小沙弥穿浅灰、个子小一圈）。
平时各忙各的，手里拿着做事用的东西；走近时头顶写着职名和正在做的事（如「小沙弥 · 浇树」），
你在旁边时他们偶尔自言自语一句；点他们会说一句话。站着没事的僧人，你走到跟前会转过来看你。
这些日常也按服务器时间循环，所有人看到的位置和动作一样：

| 僧人 | 平时在做什么 |
|---|---|
| 知客僧 | 山门内迎客，有人走近就转身合十；隔一阵走到桥头朝山门合十，再去河灯台把灯摆整齐 |
| 扫地僧 | 在前院绕圈，走一段停下扫一会儿；扫完一圈到东边银杏下的石凳歇脚喝茶 |
| 老和尚 | 西边银杏下蒲团上打坐；小沙弥端茶来时接过来喝，给小沙弥讲几句，之后起身绕树散步 |
| 小沙弥（甲） | 提铜喷壶到放生池边跪下打水，挨棵给银杏、枫树浇水，浇完再回池边打水 |
| 小沙弥（乙） | 从观音殿端茶给老和尚，坐下听讲；再去池边喂鱼（锦鲤会游过来），然后到石凳上读经 |
| 香灯师 | 守在佛前木鱼旁；不共修时去佛前和院中大香炉上香，把香炉擦一遍，理一理两边烛台 |
| 维那 | 守在佛前引磬旁；不共修时沿殿里绕到殿门口，站着看一会儿院子再回来 |
| 钟头、鼓头 | 按时撞钟、击鼓；其余时间在楼上扫地，鼓头还会把鼓擦一擦 |
| 绕塔僧（两位） | 拨着念珠各绕东西一座塔，塔在右手边，每圈在塔前合十 |

时刻表按服务器时间走，所有人看到的是同一场：

- 每个整点：钟楼撞钟三下，四位僧人从配殿走进大殿；
- 整点后约 1 至 5 分钟：大殿共修，僧人齐拜，念佛声离大殿越近越响；屏幕上方出现「大殿正在共修 · 去礼佛」，点按钮会走到空蒲团跪拜，跟着拜一次记一次「共修」功德；
- 共修结束僧人退回配殿；每小时的半点鼓楼击鼓九下。

共修时点右上角的念佛按钮，这一场的念佛声就静音了。

时间跟随本地时钟：清晨、白天、傍晚、夜晚光线不同。入夜后红灯笼、宫灯、配殿门窗、石灯和塔灯会亮，放生池上有寺里放的莲花河灯，岸边有萤火虫；白天有燕子和蝴蝶。

打开网页先是开场标题，点「入山门」进寺（同时打开声音）。链接带 `?nointro` 可以跳过开场。

画面走写实路线：
- 天空按太阳位置做大气散射（three.js 的 Sky，自带会飘的云），环境光也由这片天空生成，早晚光色随时间变；
- 院墙外是几百米外抬起的群山，坡上几千棵秋林（用写实树的样板预先「拍」成图，十字面片摆放），陡坡和山顶露出岩石；
- 院里的银杏、枫树、松树用 ez-tree 长出写实枝叶，随风轻摆；
- 人物仍是 Q 版小和尚；真实比例的身体（约 1.68 米，海青、宽袖袖兜、能弯的手肘膝盖、人头扫描）保留在 src/body-real.ts，网址加 `?real` 可以看；
- 殿宇材质做旧：朱漆压暗、彩画褪色、汉白玉偏暖灰，叠一层斑驳和雨痕；
- 后期：环境光遮蔽（墙角、檐下自然变暗）、泛光（只给灯火）、色调映射与按时段调色。帧率长期偏低时会自动降分辨率、再不行关掉泛光；设置里的「画质」可以直接选「流畅」。手机上树和远景林子会自动减量。

## 寺院布局（汉传佛寺）

山门（三开间，挂「靜山禪寺」）→ 放生池与石拱桥 → 钟楼、鼓楼分列左右 → 红灯笼参道 →
双塔（八角七层）与铜鼎香炉、红烛架 → 白石须弥座上的重檐大雄宝殿，两侧观音殿、地藏殿，
四周黄色寺墙，院中多是银杏。殿内：方砖地、千佛壁、井口天花、一佛二弟子（主尊释迦牟尼佛带鎏金背光，两侧迦叶、阿难立像带圆形头光）、华盖、
经幡、朱漆供桌（黄桌围、铜鼎、红烛、莲花瓶）、木鱼与铜磬、112 个圆蒲团。

## 结构

```
server/server.mjs   静态文件 + WebSocket：5 个房间×50 人，位置快照 8 次/秒，
                    座位占用由服务器裁决，两处香炉的香 3 分钟后燃尽，撞钟同房间都听得到
src/main.ts         场景组装、玩家移动、镜头、点击交互、联机同步
src/layout.ts       场景布局、可走区域、碰撞、网格寻路（A*，自动绕开水池石塔柱子）
src/monk.ts         僧人的姿势系统与程序动画（走、合十、礼拜、打坐、木鱼、念珠、上香、读经、喝茶……）；保留了旧的 Q 版身体
src/body-real.ts    真实比例的身体：海青、宽袖、袈裟、念珠的几何体，扫描人头的加载与修整
src/world/          环境与昼夜、大雄宝殿（重檐、彩画斗栱、格扇门、须弥座栏杆）、佛像与背光、
                    配殿与钟鼓楼、银杏与放生池、灯笼宫灯、双塔、香炉、寺墙山门、石拱桥
src/overlays.ts     木鱼（红漆鳞纹、木槌真实落点）、念珠（佛头、佛塔、流苏）的特写画面
src/world/post.ts   后期：环境光遮蔽（N8AO）、泛光、色调映射、调色、暗角，按帧耗时自动调画质
src/world/trees.ts  写实树：ez-tree 长样板、换 PBR 材质、实例化摆放、随风摆；ez-textures.ts 只按需加载用到的树皮和叶片
src/world/impostor.ts 远山林子：把树的样板拍成图，用十字面片铺几千棵
src/world/pond.ts   放生池：镜面倒影水面、细浪与涟漪、锦鲤（七个品种、半透明鳍）、鱼食、莲花河灯
src/world/life.ts   萤火虫、燕子、蝴蝶
src/world/shrines.ts 河灯台、签筒桌
src/residents.ts    常住僧人：岗位、各人的日常路线、迎客、钟鼓与整点共修的时刻表（全部由服务器时间推算，不需要额外联网消息）
src/world/rock.ts   石头：整块焊接的网格、噪声起伏加平面削出的棱面，世界坐标三向投影的石纹
src/world/lotus.ts  放生池的荷：浮叶、立叶、荷花和花苞
src/progress.ts     本地存档：寺游印谱、功德簿、今天的签
src/fortune.ts      二十四支签的签诗与解签
src/ui-extra.ts     开场标题、印谱、得印动画、签文卡片、共修提示条
src/audio.ts        Web Audio 实时合成：风、鸟、木鱼、念珠、磬、梵钟、鼓、普通话「南无阿弥陀佛」念佛
src/ui.ts           顶栏、底栏、面板；src/i18n.ts 四种语言文案
```

## 素材来源

游戏里设置面板底部的「素材来源」链接打开 `public/credits.html`，列出下面需要署名的素材。

| 文件 | 来源 | 许可 | 处理 |
|---|---|---|---|
| `public/models/buddha.glb` | [Korean Buddha Iron Statue](https://sketchfab.com/3d-models/korean-buddha-iron-statue-872b44150e12431a898d0b8057705770) by artfletch（高丽铁佛扫描） | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | 去掉贴图、改为金身、减面到 9 万三角形、meshopt 压缩 |
| `public/models/disciple.glb` | [1997.11 Standing Bodhisattva](https://sketchfab.com/3d-models/199711-standing-bodhisattva-1a57a0d6609145b486ed5b1d3e9ec7fb)，Cleveland Museum of Art | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) | 同上；作迦叶、阿难二尊者用，右侧一尊镜像 |
| `public/tex/*_color/normal/rough.jpg` | Poly Haven：dark_wooden_planks、wood_cabinet_worn_long、grey_stone_path、granite_tile、japanese_stone_wall、forest_floor、grey_roof_tiles、beige_wall_001 | [CC0](https://polyhaven.com/license) | 1K 版本再压缩 |
| `public/fonts/title.woff2` | [Zhi Mang Xing](https://fonts.google.com/specimen/Zhi+Mang+Xing)（志莽行书） | [SIL OFL](https://openfontlicense.org/) | 只取「山寺」两字 |
| `public/fonts/seal.woff2` | [LXGW WenKai TC](https://github.com/lxgw/LxgwWenkaiTC)（霞鹜文楷） | SIL OFL | 只取印文和签号用到的字 |
| `public/models/head/` | Lee Perry-Smith「Infinite, 3D Head Scan」（triplegangers.com，经 three.js 示例分发） | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 运行时切掉肩颈、贴图上淡化胡茬，作所有僧人的头 |
| `public/tex/tree/` | ez-tree 自带：橡树树皮（Poly Haven）、松树树皮（TextureCan）、树叶 | CC0 / MIT | 只留用到的几张，缩到 512 像素 |
| `public/tex/linen_*.jpg` | Poly Haven「Rough Linen」 | CC0 | 只用法线和粗糙度，缩到 512 像素，作僧袍布纹 |
| `public/fonts/poem.woff2` | [Ma Shan Zheng](https://fonts.google.com/specimen/Ma+Shan+Zheng)（马善政楷书） | SIL OFL | 只取二十四支签诗用到的字，求签时才加载 |
| `public/tex/sky.jpg` | Poly Haven HDRI：autumn_forest_04（色调映射后的 JPG） | CC0 | 缩到 2048×1024 |

署名也写在游戏「设置」面板底部。换模型时用 `node tools/prep-statue.mjs 输入.glb 输出.glb 目标三角形数` 处理。

## 部署（jessylab 服务器）

线上地址：https://santemple.jessylab.cc （宣传片在 `/promo/`）。服务器 `root@8.216.48.63`，程序在 `/opt/santemple`，systemd 服务 `santemple`（只监听 127.0.0.1:4318），nginx 站点 `santemple.jessylab.cc` 负责 HTTPS 和 `/ws` 的 WebSocket 转发，证书由 certbot 自动续期。配置文件在 `deploy/`。

```bash
./deploy/deploy.sh                                              # 构建并同步代码，重启服务
./deploy/deploy.sh /Users/macmini003/chatcut-dev/projects/sansa-promo   # 连宣传片和封面一起同步
```

## 宣传片

`tools/promo/` 用游戏本身的场景逐帧录一支竖屏宣传片（1080×1920，30 帧/秒，约 2 分钟）：分镜、诗句字幕和配乐时间轴都写在 `timeline.mjs` 里。配乐全部用代码合成（`audio.mjs`：拨弦、梵钟、木鱼、磬、风声），不调用任何视频或音乐生成模型。

```bash
mkdir -p /tmp/sansa-promo/fonts   # 字体：Google Fonts 的 Zhi Mang Xing、Ma Shan Zheng（OFL）
curl -L -o /tmp/sansa-promo/fonts/ZhiMangXing-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf
curl -L -o /tmp/sansa-promo/fonts/MaShanZheng-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf
npx vite --config tools/promo/vite.config.mjs          # 录制服务器，4327 端口
# 浏览器打开 http://127.0.0.1:4327/tools/promo/promo.html，等页面显示“完成”，帧在 /tmp/sansa-promo/shots
node tools/promo/audio.mjs /tmp/sansa-promo/score.wav
node tools/promo/assemble.mjs /tmp/sansa-promo/shots /tmp/sansa-promo/score.wav 宣传片.mp4
```

三个版本用 `cut` 参数切换（页面 `?cut=`，Node 脚本用环境变量 `CUT=`）：`vertical`（9:16，2 分钟，默认）、`short34`（3:4，约 1 分钟）、`explainer`（16:9 讲解视频）。讲解视频的口播稿在 `explainer-script.mjs`，先用 `secret exec MINIMAX_API_KEY_MPLAN -- node tools/promo/voice.mjs 配音目录` 生成克隆音（已有的段落不会重复生成），再录制；拼接时把配音目录作为第四个参数传给 `assemble.mjs`，配乐会在说话时自动压低。实拍截图放在 `PROMO_UI` 指向的目录。

封面：打开 `promo.html?cover`，会生成 9:16 和 3:4 两张（`/tmp/sansa-promo/shots/cover*/00000.jpg`）。

成片放到 `PROMO_DIR`（默认项目下的 `promo/`，不进 Git），文件名 `promo.mp4`、`cover.jpg`、`cover-3x4.jpg`，服务器会在 `…/promo/` 提供播放页（支持拖动进度）。本机启动方式：`PROMO_DIR=/Users/macmini003/chatcut-dev/projects/sansa-promo npm start`。

## 与原站的差别

- 没做：咖啡赞助（CAFE25 / GS25）、捐款入口、定时的「共同礼佛」广播。
- 原站是韩国寺院，这里改成了汉传佛寺的形制和僧装；念佛是共振峰合成的男声齐诵，不是真人录音。
- 建筑是代码搭的几何体，材质用照片贴图；佛像为博物馆扫描模型，比原站的模型面数低。

## 本地预览

预览机：macmini003，端口 4318，命令 `npm start`；同一时间只开这一个预览。
