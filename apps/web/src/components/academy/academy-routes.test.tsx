import type { MyAcademy } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route as CoachesRoute } from '../../routes/a.$slug.coaches';
import { Route as SettingsRoute } from '../../routes/a.$slug.settings';

vi.mock('./BrandingCard', () => ({
  BrandingCard: () => <div>BrandingCard</div>,
}));
vi.mock('./AcademyBoardDefaultsCard', () => ({
  AcademyBoardDefaultsCard: () => <div>BoardDefaultsCard</div>,
}));
vi.mock('./CoachesPanel', () => ({
  CoachesList: () => <div>CoachesList</div>,
  InviteCoachCard: () => <div>InviteCoachCard</div>,
}));

function renderRoute(route: { options: { component?: unknown } }, role: AcademyRole) {
  const Page = route.options.component as ComponentType;
  const academy = { id: 'a1', slug: 'clb', name: 'CLB', role } as unknown as MyAcademy;
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

afterEach(() => cleanup());

// Nạp trước chunk của route (tách mã) để lần render đầu không bị treo trong `act`
beforeAll(async () => {
  for (const route of [SettingsRoute, CoachesRoute]) {
    const page = route.options.component as { preload?: () => Promise<void> };
    await page.preload?.();
  }
}, 180_000);

// Lần đầu nạp chunk của route (tách mã) có thể chậm hơn mốc 1 giây mặc định
const SLOW = { timeout: 30_000 };

/** Trang route được tách mã theo plugin, nên nội dung hiện sau khi chunk nạp xong. */

describe('route /a/$slug/settings', () => {
  it('chủ học viện thấy tiêu đề, thẻ Branding và Bàn cờ mặc định', async () => {
    renderRoute(SettingsRoute, 'owner');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Thông tin & Branding' }, SLOW),
    ).toBeTruthy();
    expect(screen.getByText('BrandingCard')).toBeTruthy();
    expect(screen.getByText('BoardDefaultsCard')).toBeTruthy();
  });

  it.each(['coach', 'student', 'parent'] as const)(
    '%s chỉ thấy thông báo chủ học viện',
    async (role) => {
      renderRoute(SettingsRoute, role);
      expect(
        await screen.findByText('Chỉ chủ học viện chỉnh thông tin và thương hiệu.'),
      ).toBeTruthy();
      expect(screen.queryByText('BrandingCard')).toBeNull();
    },
  );
});

describe('route /a/$slug/coaches', () => {
  it('chủ học viện thấy danh sách HLV và thẻ mời', async () => {
    renderRoute(CoachesRoute, 'owner');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Huấn luyện viên' }, SLOW),
    ).toBeTruthy();
    expect(screen.getByText('CoachesList')).toBeTruthy();
    expect(screen.getByText('InviteCoachCard')).toBeTruthy();
  });

  it('HLV thấy danh sách nhưng không có thẻ mời', async () => {
    renderRoute(CoachesRoute, 'coach');
    expect(await screen.findByText('CoachesList')).toBeTruthy();
    expect(screen.queryByText('InviteCoachCard')).toBeNull();
  });

  it.each(['student', 'parent'] as const)('%s không xem được', async (role) => {
    renderRoute(CoachesRoute, role);
    expect(await screen.findByText('Chỉ nhân sự học viện xem được danh sách này.')).toBeTruthy();
    expect(screen.queryByText('CoachesList')).toBeNull();
  });
});
