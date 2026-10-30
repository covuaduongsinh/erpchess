import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import {
  chesscomUsername,
  fetchChesscomGamesSince,
  fetchLichessGamesSince,
  syncGames,
} from './game-sync';

const ARCHIVES = {
  archives: [
    'https://api.chess.com/pub/player/an/games/2026/08',
    'https://api.chess.com/pub/player/an/games/2026/09',
    'https://api.chess.com/pub/player/an/games/2026/10',
  ],
};
const pgn = (n: number) =>
  `[Event "Live Chess"]\n[White "an"]\n[Black "b${n}"]\n[Result "1-0"]\n\n1. e4 e5 1-0`;
const MONTHS: Record<string, { games: { pgn: string; end_time: number }[] }> = {
  '2026/10': {
    games: [
      { pgn: pgn(3), end_time: Date.UTC(2026, 9, 5) / 1000 },
      { pgn: pgn(4), end_time: Date.UTC(2026, 9, 20) / 1000 },
    ],
  },
  '2026/09': { games: [{ pgn: pgn(2), end_time: Date.UTC(2026, 8, 10) / 1000 }] },
  '2026/08': { games: [{ pgn: pgn(1), end_time: Date.UTC(2026, 7, 1) / 1000 }] },
};

function mockFetch(handler: (url: string) => { status?: number; json?: unknown; text?: string }) {
  const fn = vi.fn(async (url: string) => {
    const r = handler(url);
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => r.text ?? '',
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function chesscomHandler(url: string) {
  if (url.endsWith('/games/archives')) return { json: ARCHIVES };
  const m = /games\/(\d{4}\/\d{2})$/.exec(url);
  return m ? { json: MONTHS[m[1] as string] } : { status: 404 };
}

afterEach(() => vi.unstubAllGlobals());

describe('chesscomUsername', () => {
  it('nhận tên hoặc link hồ sơ, từ chối tên sai', () => {
    expect(chesscomUsername('Hikaru')).toBe('Hikaru');
    expect(chesscomUsername('https://www.chess.com/member/magnus_c/')).toBe('magnus_c');
    expect(chesscomUsername('ab')).toBeNull();
    expect(chesscomUsername('có dấu')).toBeNull();
  });
});

describe('fetchChesscomGamesSince', () => {
  it('lấy ván mới nhất trước, dừng khi đủ số ván', async () => {
    const fetchFn = mockFetch(chesscomHandler);
    const r = await fetchChesscomGamesSince('An', 0, 2);
    expect(r.count).toBe(2);
    expect(r.pgn).toContain('"b4"');
    expect(r.pgn).toContain('"b3"');
    expect(r.cursor).toBe(Date.UTC(2026, 9, 20));
    // Đủ 2 ván ở tháng 10 nên không tải các tháng cũ hơn
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('chỉ lấy ván kết thúc sau mốc, bỏ qua tháng đã cũ hơn mốc', async () => {
    const fetchFn = mockFetch(chesscomHandler);
    const since = Date.UTC(2026, 8, 15);
    const r = await fetchChesscomGamesSince('an', since);
    expect(r.count).toBe(2);
    expect(r.pgn).not.toContain('"b2"');
    // Tháng 9 vẫn tải (chưa hết tháng lúc mốc), tháng 8 thì không
    expect(fetchFn.mock.calls.map((c) => c[0])).not.toContain(ARCHIVES.archives[0]);
  });

  it('báo không tìm thấy người chơi', async () => {
    mockFetch(() => ({ status: 404 }));
    await expect(fetchChesscomGamesSince('khongco', 0)).rejects.toMatchObject({
      code: 'sync_not_found',
    });
  });
});

describe('fetchLichessGamesSince', () => {
  it('gửi mốc since và lấy thời điểm ván mới nhất làm mốc mới', async () => {
    const text = [
      '[Event "Rated blitz game"]\n[UTCDate "2026.10.20"]\n[UTCTime "10:00:00"]\n\n1. e4 e5 1-0',
      '[Event "Rated blitz game"]\n[UTCDate "2026.10.18"]\n[UTCTime "08:30:00"]\n\n1. d4 d5 0-1',
    ].join('\n\n');
    const fetchFn = mockFetch(() => ({ text }));
    const since = Date.UTC(2026, 9, 1);
    const r = await fetchLichessGamesSince('thibault', since);
    expect(fetchFn.mock.calls[0]?.[0]).toContain(`since=${since + 1}`);
    expect(r.count).toBe(2);
    expect(r.cursor).toBe(Date.UTC(2026, 9, 20, 10));
  });

  it('không có ván mới thì trả 0', async () => {
    mockFetch(() => ({ text: '' }));
    expect(await fetchLichessGamesSince('thibault', 5)).toEqual({ pgn: '', count: 0, cursor: 5 });
  });
});

describe('syncGames', () => {
  it('tạo CSDL đồng bộ khi chưa có, nhập ván và dời mốc thời gian', async () => {
    mockFetch(chesscomHandler);
    const inserts: unknown[] = [];
    const updates: unknown[] = [];
    const client = {
      from: (table: string) => {
        if (table === 'game_databases') {
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: async () => ({ data: null, error: null }),
            insert: (row: unknown) => {
              inserts.push(row);
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'db1', sync_cursor: null }, error: null }),
                }),
              };
            },
            update: (row: unknown) => {
              updates.push(row);
              return { eq: async () => ({ data: null, error: null }) };
            },
          };
          return chain;
        }
        return { insert: async () => ({ data: null, error: null }) };
      },
    } as unknown as ErpClient;

    const r = await syncGames(client, {
      academyId: 'a1',
      userId: 'u1',
      source: 'chesscom',
      username: 'an',
      max: 3,
    });
    expect(inserts[0]).toMatchObject({
      academy_id: 'a1',
      created_by: 'u1',
      visibility: 'private',
      sync_source: 'chesscom',
      name: 'Chess.com · an',
    });
    expect(r).toMatchObject({ databaseId: 'db1', fetched: 3, imported: 3, failed: 0 });
    expect(updates[0]).toEqual({ sync_cursor: Date.UTC(2026, 9, 20) });
  });
});
