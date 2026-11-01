import type { MyAcademy } from '@erpchess/api';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFound } from './NotFound';

const state = vi.hoisted(() => ({ academy: null as unknown, back: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: { slug: string };
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={params ? to.replace('$slug', params.slug) : to} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ history: { back: state.back } }),
}));
vi.mock('./layout/useCurrentAcademy', () => ({
  useCurrentAcademy: () => ({ academy: state.academy, academies: [] }),
}));

function renderPage(lang: 'vi' | 'en' = 'vi') {
  return render(
    <I18nextProvider i18n={createI18n(lang)}>
      <NotFound />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  state.academy = { id: 'a1', slug: 'clb', name: 'CLB', role: 'owner' } as unknown as MyAcademy;
  state.back = vi.fn();
});
afterEach(() => cleanup());

describe('NotFound', () => {
  it('hiện 404, tiêu đề và mô tả', () => {
    renderPage();
    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeTruthy();
    expect(screen.getByText('Đường dẫn này không tồn tại hoặc đã được chuyển đi.')).toBeTruthy();
  });

  it('có học viện: Về tổng quan và liên kết nhanh trỏ theo học viện', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Về tổng quan' }).getAttribute('href')).toBe('/a/clb');
    const quick = screen.getByRole('navigation', { name: 'Đi nhanh tới' });
    const href = (name: string) => within(quick).getByRole('link', { name }).getAttribute('href');
    expect(href('Bàn cờ')).toBe('/analysis');
    expect(href('Luyện tập')).toBe('/a/clb/practice');
    expect(href('Học liệu')).toBe('/a/clb/studies');
    expect(href('Giải đấu')).toBe('/a/clb/tournaments');
  });

  it('chưa có học viện: Về trang chủ và chỉ còn liên kết Bàn cờ', () => {
    state.academy = null;
    renderPage();
    expect(screen.queryByRole('link', { name: 'Về tổng quan' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe('/');
    const quick = screen.getByRole('navigation', { name: 'Đi nhanh tới' });
    expect(within(quick).getAllByRole('link')).toHaveLength(1);
    expect(within(quick).getByRole('link', { name: 'Bàn cờ' })).toBeTruthy();
  });

  it('Quay lại gọi lịch sử trình duyệt; Tải lại tải lại trang', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(state.back).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('có bản tiếng Anh', () => {
    renderPage('en');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to overview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
  });
});
