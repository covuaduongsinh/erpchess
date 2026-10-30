/**
 * Âm thanh nước đi tổng hợp bằng WebAudio — không dùng file âm thanh nên không vướng bản quyền.
 */
export type BoardSound = 'move' | 'capture' | 'check';

type Tone = { freq: number; type: OscillatorType; start: number; duration: number };

const TONES: Record<BoardSound, Tone[]> = {
  move: [{ freq: 520, type: 'sine', start: 0, duration: 0.07 }],
  capture: [{ freq: 240, type: 'triangle', start: 0, duration: 0.12 }],
  check: [
    { freq: 660, type: 'sine', start: 0, duration: 0.08 },
    { freq: 880, type: 'sine', start: 0.09, duration: 0.1 },
  ],
};

/** Số quân trên bàn, đọc từ phần xếp quân của FEN. */
export function countPieces(fen: string): number {
  const placement = fen.split(' ')[0] ?? '';
  return placement.replace(/[^pnbrqkPNBRQK]/g, '').length;
}

/** Chọn loại âm thanh: chiếu được ưu tiên, sau đó là ăn quân (số quân giảm). */
export function classifyBoardSound(prevFen: string, fen: string, check?: string): BoardSound {
  if (check) return 'check';
  return countPieces(fen) < countPieces(prevFen) ? 'capture' : 'move';
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    return null;
  }
  return audioCtx;
}

export function playBoardSound(kind: BoardSound): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  const now = ctx.currentTime;
  for (const tone of TONES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.value = tone.freq;
    const t0 = now + tone.start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + tone.duration + 0.02);
  }
}

/** Chỉ dùng trong test: bỏ AudioContext đã lưu. */
export function resetBoardSoundForTest(): void {
  audioCtx = null;
}
