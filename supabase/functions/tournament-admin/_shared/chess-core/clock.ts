// Tự sinh bởi supabase/functions/sync-shared.mjs từ packages/chess-core/src/clock.ts — không sửa tay.
/**
 * Đồng hồ ván đấu (server là nguồn sự thật, client chỉ đếm để hiển thị). Giống các nền tảng phổ
 * biến: đồng hồ chỉ chạy từ sau nước đầu tiên của Đen; mỗi nước được cộng thêm `incMs`.
 */
import type { Color } from './rules.ts';

export type TimeControl = { baseMs: number; incMs: number };
export type ClockState = {
  whiteMs: number;
  blackMs: number;
  /** Thời điểm (ms) bắt đầu lượt hiện tại; null khi đồng hồ chưa chạy. */
  turnStartedAt: number | null;
};
export type RatingCategory = 'blitz' | 'rapid' | 'classical';

export function startClock(tc: TimeControl): ClockState {
  return { whiteMs: tc.baseMs, blackMs: tc.baseMs, turnStartedAt: null };
}

/** Thời gian còn lại của `side` tại `now` (đang tới lượt thì trừ phần đã trôi). */
export function remaining(state: ClockState, side: Color, turn: Color, now: number): number {
  const base = side === 'w' ? state.whiteMs : state.blackMs;
  if (side !== turn || state.turnStartedAt === null) return base;
  return base - (now - state.turnStartedAt);
}

/** Bên đang đi đã hết giờ chưa. */
export function flagged(state: ClockState, turn: Color, now: number): boolean {
  return remaining(state, turn, turn, now) <= 0;
}

/**
 * Sau khi `mover` đi nước thứ `ply` (0 = nước đầu của Trắng): trừ thời gian đã dùng và cộng
 * increment; hai nước đầu không trừ giờ. Đồng hồ của bên kia bắt đầu chạy từ `now`.
 */
export function clockAfterMove(
  state: ClockState,
  mover: Color,
  ply: number,
  now: number,
  incMs: number,
): ClockState {
  const used = ply >= 2 && state.turnStartedAt !== null ? now - state.turnStartedAt : 0;
  const key = mover === 'w' ? 'whiteMs' : 'blackMs';
  return {
    ...state,
    [key]: Math.max(0, state[key] - used) + (ply >= 2 ? incMs : 0),
    turnStartedAt: ply >= 1 ? now : null,
  };
}

/** Phân loại rating theo thời gian ước tính một ván 40 nước: <10 phút blitz, <60 phút rapid. */
export function categoryOf(tc: TimeControl): RatingCategory {
  const estimate = tc.baseMs + 40 * tc.incMs;
  if (estimate < 10 * 60_000) return 'blitz';
  if (estimate < 60 * 60_000) return 'rapid';
  return 'classical';
}
