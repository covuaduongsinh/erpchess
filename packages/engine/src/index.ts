export {
  EngineError,
  type InitOptions,
  type PlayOptions,
  type SearchLimits,
  UciEngine,
  type UciTransport,
} from './engine';
export {
  type BestMove,
  type EngineInfo,
  formatScore,
  parseBestMove,
  parseInfo,
  parseOption,
  type Score,
  sideToMoveFromFen,
  toWhitePov,
  type UciOption,
  whiteWinPercent,
} from './uci';

/** Các mức bot dùng cho học viên (Elo theo thang UCI_Elo của Arasan). */
export const BOT_LEVELS = [
  { id: 'beginner', elo: 1000 },
  { id: 'novice', elo: 1400 },
  { id: 'club', elo: 1800 },
  { id: 'strong', elo: 2200 },
  { id: 'master', elo: null },
] as const;
