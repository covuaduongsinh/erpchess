import type { MyAcademy } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route } from '../../routes/a.$slug.integrations';

const h = vi.hoisted(() => ({
  billing: { data: null as unknown, isPending: false, error: null as unknown },
  emailStatus: { data: undefined as unknown },
  saveSettings: { mutate: vi.fn(), isPending: false, error: null as unknown },
  updateSender: { mutate: vi.fn(), isPending: false, error: null as unknown },
}));

vi.mock('@erpchess/api/react', () => ({
  useBilling: () => h.billing,
  useEmailStatus: () => h.emailStatus,
  useBillingMutations: () => ({ saveSettings: h.saveSettings }),
  useUpdateInviteSender: () => h.updateSender,
}));

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function renderPage(role: AcademyRole = 'owner', contact: Record<string, string> = {}) {
  const Page = Route.options.component as ComponentType;
  const academy = {
    id: 'a1',
    slug: 'clb',
    name: 'CLB Dương Sinh',
    role,
    contact,
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
  h.billing = { data: null, isPending: false, error: null };
  h.emailStatus = { data: undefined };
  h.saveSettings.mutate.mockReset();
  h.updateSender.mutate.mockReset();
});
afterEach(() => cleanup());

const card = (name: string) =>
  screen.getByRole('heading', { level: 3, name }).closest('li') as HTMLElement;

describe('trang Tích hợp', () => {
  it('chưa cấu hình gì: hai thẻ cấu hình được hiện "Chưa cấu hình", PayOS và Stripe "Sắp có" không có nút', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Tích hợp' }, SLOW)).toBeTruthy();
    expect(within(card('Người gửi lời mời')).getByText('Chưa cấu hình')).toBeTruthy();
    expect(within(card('Chuyển khoản / VietQR')).getByText('Chưa cấu hình')).toBeTruthy();
    for (const name of ['PayOS', 'Stripe']) {
      expect(within(card(name)).getByText('Sắp có')).toBeTruthy();
      expect(within(card(name)).queryByRole('button')).toBeNull();
    }
    // Không hiện tích hợp ngoài phạm vi
    expect(screen.queryByText(/WhatsApp|Razorpay/)).toBeNull();
  });

  it('thẻ Người gửi phản ánh trạng thái gửi email thật: chưa kết nối / đã kết nối, kèm link sang trang Email', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Tích hợp' }, SLOW);
    const sender = card('Người gửi lời mời');
    expect(within(sender).getByText(/Gửi email: chưa kết nối/)).toBeTruthy();
    expect(within(sender).getByRole('link', { name: 'Mở trang Email' }).getAttribute('href')).toBe(
      '/a/$slug/email',
    );
    cleanup();
    h.emailStatus = { data: { configured: true, from: 'no-reply@duongsinh.vn' } };
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Tích hợp' }, SLOW);
    expect(
      within(card('Người gửi lời mời')).getByText(
        /Gửi email: đã kết nối \(no-reply@duongsinh.vn\)/,
      ),
    ).toBeTruthy();
  });

  it('đã cấu hình: huy hiệu Đã cấu hình kèm tóm tắt (email, ngân hàng + số tài khoản)', async () => {
    h.billing.data = {
      currency: 'VND',
      invoice_prefix: 'HD',
      tax_id: null,
      bank_bin: '970436',
      bank_account: '0123456789',
      bank_holder: 'CLB DUONG SINH',
    };
    renderPage('owner', { senderName: 'CLB Dương Sinh', replyTo: 'hi@clb.vn' });
    await screen.findByRole('heading', { level: 1, name: 'Tích hợp' }, SLOW);
    const sender = card('Người gửi lời mời');
    expect(within(sender).getByText('Đã cấu hình')).toBeTruthy();
    expect(within(sender).getByText('CLB Dương Sinh · hi@clb.vn')).toBeTruthy();
    const bank = card('Chuyển khoản / VietQR');
    expect(within(bank).getByText('Đã cấu hình')).toBeTruthy();
    expect(within(bank).getByText(/0123456789/)).toBeTruthy();
    expect(within(bank).getByRole('button', { name: 'Sửa' })).toBeTruthy();
  });

  it('modal VietQR: lưu giữ nguyên tiền tệ, mã số thuế, tiền tố hoá đơn và đóng khi thành công', async () => {
    h.billing.data = {
      currency: 'USD',
      invoice_prefix: 'ABC',
      tax_id: '0312345678',
      bank_bin: null,
      bank_account: null,
      bank_holder: null,
    };
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Tích hợp' }, SLOW);
    fireEvent.click(
      within(card('Chuyển khoản / VietQR')).getByRole('button', { name: 'Cấu hình' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Chuyển khoản / VietQR' });
    const bank = within(dialog).getByLabelText('Ngân hàng') as HTMLSelectElement;
    fireEvent.change(bank, { target: { value: '970436' } });
    fireEvent.change(within(dialog).getByLabelText('Số tài khoản'), {
      target: { value: '0123 4567 89' },
    });
    fireEvent.change(within(dialog).getByLabelText('Chủ tài khoản'), {
      target: { value: 'clb duong sinh' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(h.saveSettings.mutate).toHaveBeenCalledTimes(1);
    const [input, opts] = h.saveSettings.mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess: () => void },
    ];
    expect(input).toEqual({
      currency: 'USD',
      taxId: '0312345678',
      invoicePrefix: 'ABC',
      bankBin: '970436',
      bankAccount: '0123456789',
      bankHolder: 'CLB DUONG SINH',
    });
    // Thành công thì modal đóng
    opts.onSuccess();
  });

  it('modal Người gửi lời mời: lưu tên hiển thị và email trả lời; Huỷ đóng không lưu', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Tích hợp' }, SLOW);
    fireEvent.click(within(card('Người gửi lời mời')).getByRole('button', { name: 'Cấu hình' }));
    let dialog = screen.getByRole('dialog', { name: 'Người gửi lời mời' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.updateSender.mutate).not.toHaveBeenCalled();

    fireEvent.click(within(card('Người gửi lời mời')).getByRole('button', { name: 'Cấu hình' }));
    dialog = screen.getByRole('dialog', { name: 'Người gửi lời mời' });
    fireEvent.change(within(dialog).getByLabelText('Tên hiển thị'), {
      target: { value: 'CLB Dương Sinh' },
    });
    fireEvent.change(within(dialog).getByLabelText('Email trả lời'), {
      target: { value: 'hi@clb.vn' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(h.updateSender.mutate).toHaveBeenCalledWith(
      { senderName: 'CLB Dương Sinh', replyTo: 'hi@clb.vn' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('Esc đóng modal', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Tích hợp' }, SLOW);
    fireEvent.click(within(card('Người gửi lời mời')).getByRole('button', { name: 'Cấu hình' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['coach', 'student', 'parent'] as const)(
    '%s chỉ thấy thông báo chủ học viện',
    async (role) => {
      renderPage(role);
      expect(await screen.findByText('Chỉ chủ học viện cấu hình tích hợp.', {}, SLOW)).toBeTruthy();
      expect(screen.queryByText('PayOS')).toBeNull();
    },
  );
});
