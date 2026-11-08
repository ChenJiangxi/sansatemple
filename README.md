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

时间跟随本地时钟：清晨、白天、傍晚、夜晚光线不同，夜里红灯笼和宫灯会亮。

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
src/monk.ts         小和尚模型（海青长袍、宽袖、搭左肩的袈裟和钩环、颈挂念珠）与程序动画（走、合十、礼拜、打坐、木鱼、念珠、上香）
src/world/          环境与昼夜、大雄宝殿（重檐、彩画斗栱、格扇门、须弥座栏杆）、佛像与背光、
                    配殿与钟鼓楼、银杏与放生池、灯笼宫灯、双塔、香炉、寺墙山门、石拱桥
src/overlays.ts     木鱼（红漆鳞纹、木槌真实落点）、念珠（佛头、佛塔、流苏）的特写画面
src/audio.ts        Web Audio 实时合成：风、鸟、木鱼、念珠、磬、梵钟、鼓、普通话「南无阿弥陀佛」念佛
src/ui.ts           顶栏、底栏、面板；src/i18n.ts 四种语言文案
```

## 素材来源

| 文件 | 来源 | 许可 | 处理 |
|---|---|---|---|
| `public/models/buddha.glb` | [Korean Buddha Iron Statue](https://sketchfab.com/3d-models/korean-buddha-iron-statue-872b44150e12431a898d0b8057705770) by artfletch（高丽铁佛扫描） | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | 去掉贴图、改为金身、减面到 9 万三角形、meshopt 压缩 |
| `public/models/disciple.glb` | [1997.11 Standing Bodhisattva](https://sketchfab.com/3d-models/199711-standing-bodhisattva-1a57a0d6609145b486ed5b1d3e9ec7fb)，Cleveland Museum of Art | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) | 同上；作迦叶、阿难二尊者用，右侧一尊镜像 |
| `public/tex/*_color/normal/rough.jpg` | Poly Haven：dark_wooden_planks、wood_cabinet_worn_long、grey_stone_path、granite_tile、japanese_stone_wall、forest_floor、grey_roof_tiles、beige_wall_001 | [CC0](https://polyhaven.com/license) | 1K 版本再压缩 |
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
