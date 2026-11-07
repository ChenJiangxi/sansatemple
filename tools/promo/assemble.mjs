// 把各镜头的帧序列按分镜表叠化拼接，配上合成好的配乐，输出 H.264 竖屏视频
// 用法：node tools/promo/assemble.mjs 帧目录 配乐.wav 输出.mp4
import { spawnSync } from 'node:child_process';
import { SHOTS, XF, FPS, TOTAL } from './timeline.mjs';

const [dir = '/tmp/sansa-promo/shots', wav = '/tmp/sansa-promo/score.wav', out = '/tmp/sansa-promo/promo.mp4'] = process.argv.slice(2);
const args = ['-hide_banner', '-loglevel', 'error', '-y'];
for (const s of SHOTS) args.push('-framerate', String(FPS), '-i', `${dir}/${s.id}/%05d.jpg`);
args.push('-i', wav);
const parts = [];
let prev = '[0:v]';
SHOTS.slice(1).forEach((s, k) => {
  const label = k === SHOTS.length - 2 ? '[v]' : `[x${k}]`;
  parts.push(`${prev}[${k + 1}:v]xfade=transition=fade:duration=${XF}:offset=${s.start.toFixed(3)}${label}`);
  prev = label;
});
args.push('-filter_complex', parts.join(';'), '-map', '[v]', '-map', `${SHOTS.length}:a`);
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS));
args.push('-c:a', 'aac', '-b:a', '192k', '-t', TOTAL.toFixed(3), '-movflags', '+faststart', out);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
