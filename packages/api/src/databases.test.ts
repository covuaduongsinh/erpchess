import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { importPgn, lichessStudyId, lichessUsername } from './databases';

const PGN = `[White "An"]
[Black "Bình"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0

[White "Hỏng"]

1. e4 e4 *

[White "Cường"]
[Result "*"]

1. d4 *
`;

describe('databases', () => {
  it('importPgn bỏ qua ván hỏng, chèn ván tốt kèm thông tin tiêu đề', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { from: () => ({ insert }) } as unknown as ErpClient;
    const progress: number[] = [];
    const result = await importPgn(client, 'db1', PGN, (done) => progress.push(done));
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.firstError).toMatch(/e4/);
    const rows = insert.mock.calls[0]?.[0];
    expect(rows[0]).toMatchObject({
      database_id: 'db1',
      white: 'An',
      black: 'Bình',
      result: '1-0',
      ply_count: 7,
      start_fen: null,
    });
    expect(rows[0].pgn).toContain('4. Qxf7#');
    expect(progress).toEqual([2]);
  });

  it('lichessStudyId chỉ nhận link (mã trơn trùng dạng tên người chơi)', () => {
    expect(lichessStudyId('https://lichess.org/study/AbCd1234/XyZ98765')).toBe('AbCd1234');
    expect(lichessStudyId('lichess.org/study/AbCd1234')).toBe('AbCd1234');
    expect(lichessStudyId('thibault')).toBeNull();
    expect(lichessStudyId('https://example.com/study/AbCd1234')).toBeNull();
    expect(lichessStudyId('abc')).toBeNull();
  });

  it('lichessUsername kiểm tên tài khoản', () => {
    expect(lichessUsername(' DrNykterstein ')).toBe('DrNykterstein');
    expect(lichessUsername('https://lichess.org/@/thibault')).toBe('thibault');
    expect(lichessUsername('a')).toBeNull();
    expect(lichessUsername('../x')).toBeNull();
  });
});
