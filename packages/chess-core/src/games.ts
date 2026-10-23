/** Tiện ích cho kho ván (Database): tách tệp PGN nhiều ván và rút thông tin tiêu đề của một ván. */
import { START_FEN } from './rules';
import type { GameTree } from './tree';

/**
 * Tách văn bản PGN thành từng ván (vẫn là PGN) để đọc riêng: một ván hỏng không làm hỏng cả tệp.
 * Ván mới bắt đầu ở dòng tag `[...]` đầu tiên sau phần nước đi của ván trước.
 */
export function splitPgn(text: string): string[] {
  const games: string[] = [];
  let current: string[] = [];
  let inMoves = false;
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && inMoves) {
      games.push(current.join('\n').trim());
      current = [];
      inMoves = false;
    }
    if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith('%')) inMoves = true;
    current.push(line);
  }
  const last = current.join('\n').trim();
  if (last) games.push(last);
  return games.filter((g) => g.length > 0);
}

export type GameSummary = {
  white: string;
  black: string;
  result: string;
  event: string;
  site: string;
  /** Giữ nguyên dạng PGN "YYYY.MM.DD" (có thể có "??") */
  date: string;
  eco: string;
  whiteElo: number | null;
  blackElo: number | null;
  plyCount: number;
  /** null khi ván bắt đầu từ thế cờ chuẩn */
  startFen: string | null;
};

const elo = (v: string | undefined) => {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 && n < 4000 ? n : null;
};
const tag = (v: string | undefined, max = 120) => {
  const s = (v ?? '').trim();
  return s === '?' ? '' : s.slice(0, max);
};

export function gameSummary(tree: GameTree): GameSummary {
  const h = tree.headers;
  return {
    white: tag(h.White),
    black: tag(h.Black),
    result: ['1-0', '0-1', '1/2-1/2'].includes(h.Result ?? '') ? (h.Result as string) : '*',
    event: tag(h.Event),
    site: tag(h.Site),
    date: tag(h.Date, 10),
    eco: tag(h.ECO, 3),
    whiteElo: elo(h.WhiteElo),
    blackElo: elo(h.BlackElo),
    plyCount: tree.mainline().length,
    startFen: tree.root.fen === START_FEN ? null : tree.root.fen,
  };
}
