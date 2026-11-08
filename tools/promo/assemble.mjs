// 把各镜头的帧序列按分镜表叠化拼接，配上合成好的配乐，输出 H.264 视频
// 讲解视频（CUT=explainer）另外按口播起点混入克隆音，配乐在说话时自动压低
// 用法：CUT=explainer node tools/promo/assemble.mjs 帧目录 配乐.wav 输出.mp4 [配音目录]
import { spawnSync } from 'node:child_process';
import { SHOTS, XF, FPS, TOTAL, VOICE } from './timeline.mjs';

const [dir = '/tmp/sansa-promo/shots', wav = '/tmp/sansa-promo/score.wav', out = '/tmp/sansa-promo/promo.mp4', voiceDir] = process.argv.slice(2);
const args = ['-hide_banner', '-loglevel', 'error', '-y'];
for (const s of SHOTS) args.push('-framerate', String(FPS), '-i', `${dir}/${s.id}/%05d.jpg`);
args.push('-i', wav);
const musicIdx = SHOTS.length;
const voices = voiceDir ? VOICE : [];
voices.forEach((v) => args.push('-i', `${voiceDir}/${v.id}.wav`));
const parts = [];
let prev = '[0:v]';
SHOTS.slice(1).forEach((s, k) => {
  const label = k === SHOTS.length - 2 ? '[v]' : `[x${k}]`;
  parts.push(`${prev}[${k + 1}:v]xfade=transition=fade:duration=${XF}:offset=${s.start.toFixed(3)}${label}`);
  prev = label;
});
let audioOut = `${musicIdx}:a`;
if (voices.length) {
  voices.forEach((v, i) => {
    const ms = Math.round(v.start * 1000);
    parts.push(`[${musicIdx + 1 + i}:a]adelay=${ms}|${ms},apad=whole_dur=${TOTAL.toFixed(3)}[v${i}]`);
  });
  parts.push(`${voices.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voices.length}:normalize=0,asplit=2[vo][vk]`);
  // 配乐垫底：整体压到口播下面，说话时再自动让开
  parts.push(`[${musicIdx}:a]volume=0.42[m]`);
  parts.push(`[m][vk]sidechaincompress=threshold=0.03:ratio=5:attack=30:release=500[md]`);
  parts.push(`[md][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]`);
  audioOut = '[a]';
}
args.push('-filter_complex', parts.join(';'), '-map', '[v]', '-map', audioOut);
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS));
args.push('-c:a', 'aac', '-b:a', '192k', '-t', TOTAL.toFixed(3), '-movflags', '+faststart', out);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
