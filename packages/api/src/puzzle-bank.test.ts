import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { searchPuzzleBank } from './puzzle-bank';

const filter = {
  themes: [],
  ratingMin: null,
  ratingMax: null,
  movesMax: null,
  limit: 12,
  offset: 0,
};

function client(data: unknown[] | null, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { c: { rpc } as unknown as ErpClient, rpc };
}

describe('searchPuzzleBank', () => {
  it('gọi search_puzzle_bank; bộ lọc trống thì bỏ tham số (hàm SQL dùng mặc định null)', async () => {
    const { c, rpc } = client([]);
    await searchPuzzleBank(c, filter);
    expect(rpc).toHaveBeenCalledWith('search_puzzle_bank', {
      p_themes: undefined,
      p_rating_min: undefined,
      p_rating_max: undefined,
      p_moves_max: undefined,
      p_limit: 12,
      p_offset: 0,
    });
  });

  it('truyền chủ đề, rating, số nước; chặn limit tối đa 100 và offset không âm', async () => {
    const { c, rpc } = client([]);
    await searchPuzzleBank(c, {
      themes: ['fork', 'pin'],
      ratingMin: 1200,
      ratingMax: 1800,
      movesMax: 3,
      limit: 5000,
      offset: -7,
    });
    expect(rpc).toHaveBeenCalledWith('search_puzzle_bank', {
      p_themes: ['fork', 'pin'],
      p_rating_min: 1200,
      p_rating_max: 1800,
      p_moves_max: 3,
      p_limit: 100,
      p_offset: 0,
    });
    await searchPuzzleBank(c, { ...filter, limit: 0 });
    expect(rpc).toHaveBeenLastCalledWith(
      'search_puzzle_bank',
      expect.objectContaining({ p_limit: 1 }),
    );
  });

  it('đổi dòng kết quả sang camelCase kèm tổng; không có dòng thì tổng 0', async () => {
    const { c } = client([
      {
        id: '7',
        lichess_id: 'abc12',
        fen: 'f',
        moves: 'a1a2 b1b2',
        rating: 1500,
        popularity: 80,
        themes: ['fork'],
        total: '42',
      },
      {
        id: 8,
        lichess_id: 'abc13',
        fen: 'f',
        moves: 'a1a2 b1b2',
        rating: 1600,
        popularity: 70,
        themes: null,
        total: 42,
      },
    ]);
    const page = await searchPuzzleBank(c, filter);
    expect(page.total).toBe(42);
    expect(page.rows[0]).toEqual({
      id: 7,
      lichessId: 'abc12',
      fen: 'f',
      moves: 'a1a2 b1b2',
      rating: 1500,
      popularity: 80,
      themes: ['fork'],
    });
    expect(page.rows[1]?.themes).toEqual([]);
    const empty = await searchPuzzleBank(client([]).c, filter);
    expect(empty).toEqual({ rows: [], total: 0 });
  });

  it('lỗi máy chủ (vd. chưa áp migration) được ném ra', async () => {
    const { c } = client(null, { message: 'function search_puzzle_bank does not exist' });
    await expect(searchPuzzleBank(c, filter)).rejects.toThrow(/search_puzzle_bank/);
  });
});
