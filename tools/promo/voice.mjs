// 讲解视频配音：MiniMax 克隆音，每段生成一次（已有文件就跳过，避免重复扣费），
// 读出时长，按标点把字幕切成一句一句，并按字数分配时间，写进 explainer-voice.mjs
// 用法：secret exec MINIMAX_API_KEY_MPLAN -- node tools/promo/voice.mjs 输出目录
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VOICE, SEGMENTS } from './explainer-script.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || '/tmp/sansa-promo/voice';
const KEY = process.env.MINIMAX_API_KEY_MPLAN || process.env.MINIMAX_API_KEY;
const API = (process.env.MINIMAX_API_BASE || 'https://api.minimax.io/v1') + '/t2a_v2';
fs.mkdirSync(OUT, { recursive: true });
const TEMPO = Number(process.env.TEMPO || 1.18); // 克隆音偏慢，本地加速

async function tts(text, file) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VOICE.model,
        text,
        stream: false,
        language_boost: 'Chinese',
        voice_setting: { voice_id: VOICE.voice_id, speed: VOICE.speed, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
        pronunciation_dict: { tone: VOICE.tone },
      }),
    });
    const j = await r.json().catch(() => null);
    const code = j?.base_resp?.status_code;
    if (code === 1002) {
      await new Promise((res) => setTimeout(res, 8000));
      continue;
    }
    if (code !== 0 || !j?.data?.audio) throw new Error(`MiniMax 返回 ${code} ${j?.base_resp?.status_msg ?? r.status}`);
    fs.writeFileSync(file, Buffer.from(j.data.audio, 'hex'));
    return;
  }
  throw new Error('MiniMax 限流重试仍失败');
}

const duration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

// 把一段话切成字幕行：先按句号、分号、冒号、问号切，过长再按逗号切；行尾标点去掉
function lines(text) {
  const out = [];
  for (const sent of text.split(/(?<=[。；：？！])/)) {
    if (!sent.trim()) continue;
    if ([...sent].length <= 24) out.push(sent);
    else out.push(...sent.split(/(?<=，)/));
  }
  return out.filter((s) => s.trim());
}
const weight = (s) => [...s].reduce((w, ch) => w + ('，、'.includes(ch) ? 1.2 : '。；：？！'.includes(ch) ? 2.4 : /\s/.test(ch) ? 0.3 : 1), 0);

const timing = {};
for (const seg of SEGMENTS.filter((s) => !process.env.ONLY || process.env.ONLY.split(",").includes(s.id))) {
  const file = path.join(OUT, `${seg.id}.mp3`);
  if (!fs.existsSync(file)) {
    process.stdout.write(`生成 ${seg.id}（${[...seg.text].length} 字）… `);
    await tts(seg.text, file);
    console.log('好');
  }
  // 本地加速（不变调）并统一响度，混音用这份 wav；不用再调 MiniMax
  const wav = path.join(OUT, `${seg.id}.wav`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-af', `atempo=${TEMPO},loudnorm=I=-16:TP=-1.5:LRA=7`, '-ar', '48000', '-ac', '1', wav]);
  const dur = duration(wav);
  const parts = lines(seg.text);
  const total = parts.reduce((s, p) => s + weight(p), 0);
  const lead = 0.12, tail = 0.25, span = dur - lead - tail;
  let t = lead;
  timing[seg.id] = {
    dur,
    lines: parts.map((p) => {
      const d = (weight(p) / total) * span;
      const line = { text: p.replace(/[，。；：、？！]+$/, ''), t0: +t.toFixed(3), t1: +(t + d).toFixed(3) };
      t += d;
      return line;
    }),
  };
}
const dst = path.join(here, 'explainer-voice.mjs');
fs.writeFileSync(dst, `// voice.mjs 生成：每段配音的时长（秒）和字幕时间（段内秒数）\nexport const VOICE_TIMING = ${JSON.stringify(timing, null, 2)};\n`);
const sum = Object.values(timing).reduce((s, x) => s + x.dur, 0);
console.log(`共 ${SEGMENTS.length} 段，配音 ${sum.toFixed(1)} 秒 → ${path.relative(process.cwd(), dst)}`);
