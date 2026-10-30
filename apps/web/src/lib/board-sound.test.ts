import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyBoardSound,
  countPieces,
  playBoardSound,
  resetBoardSoundForTest,
} from './board-sound';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const CAPTURED = 'rnbqkbnr/ppp1pppp/8/8/4p3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

afterEach(() => {
  resetBoardSoundForTest();
  vi.unstubAllGlobals();
});

describe('board-sound', () => {
  it('counts pieces from the FEN placement', () => {
    expect(countPieces(START)).toBe(32);
    expect(countPieces(CAPTURED)).toBe(31);
  });

  it('classifies move, capture and check', () => {
    expect(classifyBoardSound(START, AFTER_E4)).toBe('move');
    expect(classifyBoardSound(AFTER_E4, CAPTURED)).toBe('capture');
    expect(classifyBoardSound(AFTER_E4, CAPTURED, 'e1')).toBe('check');
    // Lùi lại nước ăn quân (số quân tăng) là tiếng đi quân thường
    expect(classifyBoardSound(CAPTURED, AFTER_E4)).toBe('move');
  });

  it('does nothing when WebAudio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playBoardSound('move')).not.toThrow();
  });

  it('schedules one oscillator per tone', () => {
    const start = vi.fn();
    const createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start,
      stop: vi.fn(),
    }));
    const createGain = vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }));
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator = createOscillator;
      createGain = createGain;
      resume = vi.fn(() => Promise.resolve());
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);

    playBoardSound('check');
    expect(createOscillator).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);

    playBoardSound('move');
    expect(createOscillator).toHaveBeenCalledTimes(3);
  });
});
