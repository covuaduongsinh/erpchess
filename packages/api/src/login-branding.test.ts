import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { fetchLoginBranding } from './queries';

function client(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { c: { rpc } as unknown as ErpClient, rpc };
}

describe('fetchLoginBranding', () => {
  it('trả null khi slug không tồn tại', async () => {
    const { c, rpc } = client(null);
    expect(await fetchLoginBranding(c, 'khong-co')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('academy_login_branding', { p_slug: 'khong-co' });
  });

  it('chuẩn hoá trường rỗng thành null và bỏ mục nội dung sai', async () => {
    const { c } = client({
      name: 'CLB Dương Sinh',
      slug: 'duong-sinh',
      description: 'Giới thiệu',
      logo_url: '',
      favicon_url: null,
      brand_color: '#c0392b',
      login_background_url: 'https://cdn.vn/bg.jpg',
      login_sections: [{ title: 'Lịch khai giảng', body: 'Thứ 7' }, { body: 'thiếu tiêu đề' }],
    });
    expect(await fetchLoginBranding(c, 'duong-sinh')).toEqual({
      name: 'CLB Dương Sinh',
      slug: 'duong-sinh',
      description: 'Giới thiệu',
      logoUrl: null,
      faviconUrl: null,
      brandColor: '#c0392b',
      backgroundUrl: 'https://cdn.vn/bg.jpg',
      sections: [{ title: 'Lịch khai giảng', body: 'Thứ 7' }],
    });
  });
});
