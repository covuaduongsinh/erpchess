import type { MyAcademy } from '@erpchess/api';
import { ApiError } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route } from '../../routes/a.$slug.email';
import { InviteLink } from '../InviteLink';

const h = vi.hoisted(() => ({
  status: { data: undefined as unknown, isPending: false, error: null as unknown },
  log: { data: [] as unknown[], isPending: false, error: null as unknown },
  test: { mutate: vi.fn(), isPending: false, isSuccess: false, error: null as unknown },
  invite: { mutate: vi.fn(), isPending: false, isSuccess: false, error: null as unknown },
}));

vi.mock('@erpchess/api/react', () => ({
  useEmailStatus: () => h.status,
  useEmailLog: () => h.log,
  useSendTestEmail: () => h.test,
  useSendInviteEmail: () => h.invite,
}));

function renderPage(role: AcademyRole = 'owner', email: string | null = 'chu@clb.vn') {
  const Page = Route.options.component as ComponentType;
  const academy = { id: 'a1', slug: 'clb', name: 'CLB', role } as unknown as MyAcademy;
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AcademyContext value={{ academy, session: { user: { id: 'u1', email } } as never }}>
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
  h.status = {
    data: {
      configured: false,
      from: 'onboarding@resend.dev',
      sandbox: true,
      limitPerHour: 30,
      usedLastHour: 0,
    },
    isPending: false,
    error: null,
  };
  h.log = { data: [], isPending: false, error: null };
  h.test = { mutate: vi.fn(), isPending: false, isSuccess: false, error: null };
  h.invite = { mutate: vi.fn(), isPending: false, isSuccess: false, error: null };
});
afterEach(() => cleanup());

describe('trang Email', () => {
  it('chưa cấu hình khoá: huy hiệu Chưa cấu hình + hướng dẫn 4 bước, không hiện khoá nào', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Email' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Chưa cấu hình')).toBeTruthy();
    expect(screen.getByText('Cách bật gửi email')).toBeTruthy();
    expect(screen.getByText(/RESEND_API_KEY/)).toBeTruthy();
    expect(screen.getByText('onboarding@resend.dev')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/re_[A-Za-z0-9]{8,}/);
  });

  it('đã cấu hình + địa chỉ thử: huy hiệu Đã cấu hình, cảnh báo sandbox, đếm số email trong giờ, không hướng dẫn', async () => {
    h.status.data = {
      configured: true,
      from: 'onboarding@resend.dev',
      sandbox: true,
      limitPerHour: 30,
      usedLastHour: 4,
    };
    renderPage();
    expect(await screen.findByText('Đã cấu hình', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Đã gửi 4/30 email trong giờ qua')).toBeTruthy();
    expect(screen.getByText(/chỉ gửi được tới email của chủ tài khoản Resend/)).toBeTruthy();
    expect(screen.queryByText('Cách bật gửi email')).toBeNull();
  });

  it('tên miền riêng đã xác minh thì không có cảnh báo sandbox', async () => {
    h.status.data = {
      configured: true,
      from: 'no-reply@duongsinh.vn',
      sandbox: false,
      limitPerHour: 30,
      usedLastHour: 0,
    };
    renderPage();
    expect(await screen.findByText('no-reply@duongsinh.vn', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText(/chỉ gửi được tới email của chủ tài khoản Resend/)).toBeNull();
  });

  it('Edge Function chưa triển khai (lỗi gọi trạng thái): báo rõ, vẫn hiện hướng dẫn', async () => {
    h.status = { data: undefined, isPending: false, error: new Error('non-2xx') };
    renderPage();
    expect(await screen.findByText(/send-email chưa được triển khai/, {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Cách bật gửi email')).toBeTruthy();
  });

  it('gửi thử tới đúng email của người đang đăng nhập', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi thử' }, SLOW));
    expect(h.test.mutate).toHaveBeenCalledWith({ to: 'chu@clb.vn', locale: 'vi' });
    expect(screen.getByText('Gửi một email thử tới ch***@clb.vn.')).toBeTruthy();
  });

  it('chưa cấu hình khoá thì lỗi "not_configured" hiện bằng tiếng Việt rõ ràng', async () => {
    h.test.error = new ApiError('x', 'not_configured');
    renderPage();
    expect(await screen.findByRole('alert', {}, SLOW)).toBeTruthy();
    expect(
      screen.getByText('Chưa cấu hình gửi email (chưa đặt RESEND_API_KEY). Xem trang Email.'),
    ).toBeTruthy();
  });

  it('tài khoản không có email thì không có nút Gửi thử', async () => {
    renderPage('owner', null);
    expect(
      await screen.findByText('Tài khoản của bạn chưa có email nên không gửi thử được.', {}, SLOW),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi thử' })).toBeNull();
  });

  it('nhật ký: trống thì có lời nhắc; có dữ liệu thì hiện loại, người nhận, trạng thái và lỗi', async () => {
    const { unmount } = renderPage();
    expect(await screen.findByText('Chưa gửi email nào.', {}, SLOW)).toBeTruthy();
    unmount();
    h.log.data = [
      {
        id: '1',
        kind: 'invite_coach',
        to_email: 'hlv@gmail.com',
        subject: 'x',
        status: 'sent',
        error: null,
        created_at: '2026-11-02T03:00:00Z',
      },
      {
        id: '2',
        kind: 'invoice_reminder',
        to_email: 'ph@gmail.com',
        subject: 'y',
        status: 'failed',
        error: '403 validation_error domain not verified',
        created_at: '2026-11-02T04:00:00Z',
      },
    ];
    renderPage();
    expect(await screen.findByText('hlv@gmail.com', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Mời HLV')).toBeTruthy();
    expect(screen.getByText('Đã gửi')).toBeTruthy();
    expect(screen.getByText('Nhắc học phí')).toBeTruthy();
    expect(screen.getByText('Thất bại')).toBeTruthy();
    expect(screen.getByText('403 validation_error domain not verified')).toBeTruthy();
  });

  it.each(['coach', 'student', 'parent'] as const)(
    '%s chỉ thấy thông báo dành cho chủ học viện',
    async (role) => {
      renderPage(role);
      expect(
        await screen.findByText('Chỉ chủ học viện xem được trang này.', {}, SLOW),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Gửi thử' })).toBeNull();
    },
  );
});

describe('InviteLink: gửi lời mời qua email', () => {
  function renderInvite(withEmail = true) {
    return render(
      <I18nextProvider i18n={createI18n('vi')}>
        {withEmail ? (
          <InviteLink token="tok1" academyId="a1" inviteRole="parent" />
        ) : (
          <InviteLink token="tok1" />
        )}
      </I18nextProvider>,
    );
  }

  it('không truyền academyId/inviteRole thì chỉ có link như cũ', () => {
    renderInvite(false);
    expect(screen.queryByLabelText('Email người nhận')).toBeNull();
  });

  it('nhập email rồi gửi: gọi gửi lời mời với token và vai trò', () => {
    renderInvite();
    fireEvent.change(screen.getByLabelText('Email người nhận'), {
      target: { value: ' ph@gmail.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi email' }));
    expect(h.invite.mutate).toHaveBeenCalledWith({
      role: 'parent',
      to: 'ph@gmail.com',
      token: 'tok1',
      locale: 'vi',
    });
  });

  it('nút gửi khoá khi chưa nhập email; thành công và lỗi đều hiện rõ', () => {
    const { unmount } = renderInvite();
    expect((screen.getByRole('button', { name: 'Gửi email' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    unmount();
    h.invite.isSuccess = true;
    renderInvite();
    fireEvent.change(screen.getByLabelText('Email người nhận'), {
      target: { value: 'ph@gmail.com' },
    });
    expect(screen.getByRole('status').textContent).toBe('Đã gửi email tới ph@gmail.com.');
    cleanup();
    h.invite.isSuccess = false;
    h.invite.error = new ApiError('x', 'recipient_not_allowed');
    renderInvite();
    expect(screen.getByRole('alert').textContent).toContain('Không được gửi tới địa chỉ này');
  });
});
