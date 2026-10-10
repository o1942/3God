// 音效系统：使用 Web Audio API 实时合成，无需外部音频文件
// 所有音效都是程序化生成的短音效，轻量且无网络依赖

let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  // 浏览器策略：用户交互后才能播放
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

type SoundType =
  | 'click'
  | 'build'
  | 'build_complete'
  | 'train'
  | 'train_complete'
  | 'research'
  | 'battle_win'
  | 'battle_lose'
  | 'defense_win'
  | 'defense_lose'
  | 'quest_complete'
  | 'error'
  | 'coin'
  | 'notify';

// 单个音符的配置
type Note = {
  freq: number;       // 频率 Hz
  duration: number;   // 时长秒
  type?: OscillatorType; // 波形
  volume?: number;    // 音量 0-1
  delay?: number;     // 延迟秒
};

// 各音效对应的音符序列
const SOUND_SEQUENCES: Record<SoundType, Note[]> = {
  click: [
    { freq: 800, duration: 0.05, type: 'square', volume: 0.08 },
  ],
  build: [
    { freq: 220, duration: 0.12, type: 'triangle', volume: 0.12 },
    { freq: 330, duration: 0.1, type: 'triangle', volume: 0.1, delay: 0.08 },
  ],
  build_complete: [
    { freq: 523, duration: 0.12, type: 'sine', volume: 0.15 },
    { freq: 659, duration: 0.12, type: 'sine', volume: 0.15, delay: 0.1 },
    { freq: 784, duration: 0.2, type: 'sine', volume: 0.18, delay: 0.2 },
  ],
  train: [
    { freq: 180, duration: 0.1, type: 'sawtooth', volume: 0.1 },
    { freq: 240, duration: 0.1, type: 'sawtooth', volume: 0.1, delay: 0.08 },
  ],
  train_complete: [
    { freq: 440, duration: 0.1, type: 'triangle', volume: 0.14 },
    { freq: 554, duration: 0.1, type: 'triangle', volume: 0.14, delay: 0.09 },
    { freq: 659, duration: 0.18, type: 'triangle', volume: 0.16, delay: 0.18 },
  ],
  research: [
    { freq: 300, duration: 0.15, type: 'sine', volume: 0.12 },
    { freq: 400, duration: 0.15, type: 'sine', volume: 0.12, delay: 0.1 },
    { freq: 500, duration: 0.2, type: 'sine', volume: 0.14, delay: 0.2 },
  ],
  battle_win: [
    { freq: 523, duration: 0.1, type: 'square', volume: 0.14 },
    { freq: 659, duration: 0.1, type: 'square', volume: 0.14, delay: 0.08 },
    { freq: 784, duration: 0.1, type: 'square', volume: 0.14, delay: 0.16 },
    { freq: 1047, duration: 0.25, type: 'square', volume: 0.16, delay: 0.24 },
  ],
  battle_lose: [
    { freq: 300, duration: 0.18, type: 'sawtooth', volume: 0.14 },
    { freq: 220, duration: 0.25, type: 'sawtooth', volume: 0.14, delay: 0.15 },
    { freq: 150, duration: 0.35, type: 'sawtooth', volume: 0.16, delay: 0.35 },
  ],
  defense_win: [
    { freq: 659, duration: 0.1, type: 'triangle', volume: 0.13 },
    { freq: 880, duration: 0.2, type: 'triangle', volume: 0.15, delay: 0.08 },
  ],
  defense_lose: [
    { freq: 200, duration: 0.2, type: 'sawtooth', volume: 0.13 },
    { freq: 130, duration: 0.35, type: 'sawtooth', volume: 0.15, delay: 0.15 },
  ],
  quest_complete: [
    { freq: 659, duration: 0.08, type: 'sine', volume: 0.14 },
    { freq: 784, duration: 0.08, type: 'sine', volume: 0.14, delay: 0.07 },
    { freq: 988, duration: 0.08, type: 'sine', volume: 0.14, delay: 0.14 },
    { freq: 1319, duration: 0.2, type: 'sine', volume: 0.16, delay: 0.21 },
  ],
  error: [
    { freq: 160, duration: 0.12, type: 'square', volume: 0.12 },
    { freq: 120, duration: 0.18, type: 'square', volume: 0.12, delay: 0.1 },
  ],
  coin: [
    { freq: 988, duration: 0.06, type: 'square', volume: 0.12 },
    { freq: 1319, duration: 0.12, type: 'square', volume: 0.12, delay: 0.05 },
  ],
  notify: [
    { freq: 880, duration: 0.08, type: 'sine', volume: 0.12 },
    { freq: 1175, duration: 0.12, type: 'sine', volume: 0.12, delay: 0.08 },
  ],
};

function playNote(note: Note, ctx: AudioContext, startTime: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = note.type || 'sine';
  osc.frequency.value = note.freq;

  const vol = note.volume || 0.1;
  const dur = note.duration;
  const start = startTime + (note.delay || 0);

  // 包络：快速起音 + 指数衰减，避免爆音
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playSound(type: SoundType) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const seq = SOUND_SEQUENCES[type];
  if (!seq) return;
  const now = ctx.currentTime;
  for (const note of seq) {
    playNote(note, ctx, now);
  }
  // 移动端震动反馈
  vibrate(type);
}

// 震动模式：不同事件不同震动节奏
const VIBRATION_PATTERNS: Partial<Record<SoundType, number[]>> = {
  build_complete: [30],
  train_complete: [30],
  battle_win: [50, 30, 50, 30, 80],
  battle_lose: [100, 50, 100, 50, 150],
  defense_win: [40, 20, 40],
  defense_lose: [80, 40, 80],
  quest_complete: [20, 20, 20, 20, 50],
  error: [60],
  coin: [20, 20],
  notify: [40],
};

function vibrate(type: SoundType) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const pattern = VIBRATION_PATTERNS[type];
  if (pattern) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted() {
  return muted;
}

export const SOUND_TYPES = {
  click: 'click',
  build: 'build',
  build_complete: 'build_complete',
  train: 'train',
  train_complete: 'train_complete',
  research: 'research',
  battle_win: 'battle_win',
  battle_lose: 'battle_lose',
  defense_win: 'defense_win',
  defense_lose: 'defense_lose',
  quest_complete: 'quest_complete',
  error: 'error',
  coin: 'coin',
  notify: 'notify',
} as const;
