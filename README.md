# 山寺 · sansa-clone

照着 [sansatemple.com](https://sansatemple.com/) 的玩法重做的一座线上寺院：
大家各是一个 Q 版小和尚，在同一个院子里散步、合掌、去大殿蒲团上礼拜、
敲木鱼、拨 108 颗念珠、坐长椅、上香，彼此看得见但不聊天。

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
| 礼拜（找空蒲团，跪拜循环计数） | 1、E、空格 | 底栏「礼拜」 |
| 念珠（上下拨，108 颗一圈） | 2，方向键或滚轮拨珠 | 上下滑 |
| 合掌 | 3 | 底栏「合掌」 |
| 木鱼（可自动敲） | 5，空格敲 | 点木鱼 |
| 坐下 / 上香 / 撞钟 | 点蒲团、长椅 / 点院中香炉或佛前香炉 / 点钟楼的钟 | 同左 |

时间跟随本地时钟：清晨、白天、傍晚、夜晚光线不同，夜里莲花灯和石灯会亮。

## 结构

```
server/server.mjs   静态文件 + WebSocket：5 个房间×50 人，位置快照 8 次/秒，
                    座位占用由服务器裁决，两处香炉的香 3 分钟后燃尽，撞钟同房间都听得到
src/main.ts         场景组装、玩家移动、镜头、点击交互、联机同步
src/layout.ts       场景布局、可走区域、碰撞、网格寻路（A*，自动绕开水池石塔柱子）
src/monk.ts         小和尚模型与程序动画（走、合掌、礼拜、打坐、木鱼、念珠）
src/world/          环境与昼夜、大殿（七开间、112 个蒲团、佛前供桌香炉）、佛像、
                    配殿与钟楼、树木莲池、灯与双塔香炉围墙
src/overlays.ts     木鱼、念珠的特写画面
src/audio.ts        Web Audio 实时合成：风、鸟、木鱼、念珠、磬、梵钟、念佛
src/ui.ts           顶栏、底栏、面板；src/i18n.ts 四种语言文案
```

## 素材来源

| 文件 | 来源 | 许可 | 处理 |
|---|---|---|---|
| `public/models/buddha.glb` | [Korean Buddha Iron Statue](https://sketchfab.com/3d-models/korean-buddha-iron-statue-872b44150e12431a898d0b8057705770) by artfletch（高丽铁佛扫描） | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | 去掉贴图、改为金身、减面到 9 万三角形、meshopt 压缩 |
| `public/models/bodhisattva.glb` | [Seated bodhisattva Guanyin, 12th C.](https://sketchfab.com/3d-models/seated-bodhisattva-guanyin-12th-c-ce-2c865894453743a49f8e82d57e4f0a8d)，Minneapolis Institute of Art | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) | 同上，减面到 6 万三角形 |

署名也写在游戏「设置」面板底部。换模型时用 `node tools/prep-statue.mjs 输入.glb 输出.glb 目标三角形数` 处理。

## 与原站的差别

- 没做：咖啡赞助（CAFE25 / GS25）、捐款入口、定时的「共同礼佛」广播。
- 念佛是共振峰合成的男声齐诵「南无阿弥陀佛」加木鱼，不是真人录音。
- 场景用程序生成的几何体和 canvas 贴图，比原站的照片贴图更卡通。

## 本地预览

预览机：macmini003，端口 4318，命令 `npm start`；同一时间只开这一个预览。
