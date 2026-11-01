import type { MyAcademy } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route } from '../../routes/a.$slug.rating';

const h = vi.hoisted(() => ({
  setEnabled: { mutate: vi.fn(), isPending: false, error: null as unknown },
  members: [] as unknown[],
}));

vi.mock('@erpchess/api/react', () => ({
  useSetAcademyFideEnabled: () => h.setEnabled,
  useMembers: () => ({ data: h.members }),
}));
vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function renderPage(role: AcademyRole, fideEnabled: boolean) {
  const Page = Route.options.component as ComponentType;
  const academy = {
    id: 'a1',
    slug: 'clb',
    name: 'CLB',
    role,
    fide_enabled: fideEnabled,
  } as unknown as MyAcademy;
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AcademyContext value={{ academy, session: {} as never }}>
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </AcademyContext>
    </I18nextProvider>,
  );
}

const SLOW = { timeout: 30_000 };

beforeAll(async () => {
  const page = Route.options.component as { preload?: () => Promise<void> };
  await page.preload?.();
}, 180_000);

beforeEach(() => {
  h.setEnabled.mutate.mockReset();
  h.members = [
    { role: 'student', fide: { id: '123456', standard: null, rapid: null, blitz: null } },
    { role: 'student', fide: { id: null, standard: 1800, rapid: null, blitz: null } },
    { role: 'student', fide: { id: null, standard: null, rapid: null, blitz: null } },
    { role: 'coach', fide: { id: '999999', standard: null, rapid: null, blitz: null } },
  ];
});
afterEach(() => cleanup());

describe('trang Rating', () => {
  it('thẻ Nội bộ luôn bật, mô tả 3 loại theo mức thời gian; không có USCF', async () => {
    renderPage('owner', false);
    expect(await screen.findByRole('heading', { level: 1, name: 'Rating' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Nội bộ học viện' })).toBeTruthy();
    for (const text of ['Classical', 'Rapid', 'Blitz'])
      expect(screen.getAllByText(text, { exact: true }).length, text).toBeGreaterThan(0);
    expect(screen.getByText('Dưới 10 phút')).toBeTruthy();
    expect(screen.getByText('Từ 10 đến dưới 60 phút')).toBeTruthy();
    expect(screen.queryByText(/USCF/)).toBeNull();
  });

  it('chủ học viện bật FIDE bằng công tắc', async () => {
    renderPage('owner', false);
    const sw = await screen.findByRole('switch', { name: 'Bật FIDE' }, SLOW);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Đang tắt')).toBeTruthy();
    fireEvent.click(sw);
    expect(h.setEnabled.mutate).toHaveBeenCalledWith(true);
  });

  it('FIDE đang bật: huy hiệu Đã bật, đếm học viên đã nhập (chỉ học viên có dữ liệu), link sang danh sách', async () => {
    renderPage('owner', true);
    const sw = await screen.findByRole('switch', { name: 'Bật FIDE' }, SLOW);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Đã nhập FIDE cho 2 học viên.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mở danh sách học viên' })).toBeTruthy();
    fireEvent.click(sw);
    expect(h.setEnabled.mutate).toHaveBeenCalledWith(false);
  });

  it('HLV chỉ xem: công tắc bị khoá kèm giải thích', async () => {
    renderPage('coach', true);
    const sw = await screen.findByRole('switch', { name: 'Bật FIDE' }, SLOW);
    expect((sw as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Chỉ chủ học viện bật hoặc tắt FIDE.')).toBeTruthy();
  });

  it.each(['student', 'parent'] as const)(
    '%s chỉ thấy thông báo dành cho nhân sự',
    async (role) => {
      renderPage(role, true);
      expect(
        await screen.findByText('Chỉ nhân sự học viện xem được trang này.', {}, SLOW),
      ).toBeTruthy();
      expect(screen.queryByRole('switch')).toBeNull();
    },
  );
});
