import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { searchMasterbase } from './masterbase';

function client() {
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
  return { c: { rpc } as unknown as ErpClient, rpc };
}

const q = { position: null, maxPlies: null, minElo: null, page: 0 };

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
