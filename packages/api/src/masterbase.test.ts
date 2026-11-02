import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { masterbaseQueryKey, searchMasterbase } from './masterbase';

function client() {
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
  return { c: { rpc } as unknown as ErpClient, rpc };
}

const q = { position: null, maxPlies: null, minElo: null, page: 0 };

describe('masterbaseQueryKey', () => {
  it('mỗi trường ảnh hưởng kết quả làm khoá đổi (nhất là includeEngines: thiếu thì bật công tắc vẫn ra dữ liệu cũ)', () => {
    const base = masterbaseQueryKey(q);
    const variants = [
      { ...q, position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq' },
      { ...q, maxPlies: 39 },
      { ...q, minElo: 2500 },
      { ...q, includeEngines: true },
      { ...q, page: 1 },
    ];
    for (const v of variants) expect(masterbaseQueryKey(v)).not.toEqual(base);
    // mặc định không gồm engine: bỏ trống và false là cùng một khoá
    expect(masterbaseQueryKey({ ...q, includeEngines: false })).toEqual(base);
  });
});

describe('searchMasterbase', () => {
  it('mặc định ẩn ván engine (p_include_engines = false)', async () => {
    const { c, rpc } = client();
    await searchMasterbase(c, q);
    expect(rpc).toHaveBeenCalledWith(
      'search_masterbase',
      expect.objectContaining({ p_include_engines: false, p_limit: 20, p_offset: 0 }),
    );
  });

  it('includeEngines = true gửi p_include_engines = true và phân trang theo trang', async () => {
    const { c, rpc } = client();
    await searchMasterbase(c, { ...q, includeEngines: true, page: 2, minElo: 2500 });
    expect(rpc).toHaveBeenCalledWith(
      'search_masterbase',
      expect.objectContaining({ p_include_engines: true, p_offset: 40, p_min_elo: 2500 }),
    );
  });
});
