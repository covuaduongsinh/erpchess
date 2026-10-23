import { createI18n } from '@erpchess/i18n';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { Home } from './Home';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

function renderHome(lang: 'vi' | 'en') {
  return render(
    <I18nextProvider i18n={createI18n(lang)}>
      <Home />
    </I18nextProvider>,
  );
}

describe('Home', () => {
  it('hiển thị lời chào tiếng Việt và link đăng ký/đăng nhập', () => {
    renderHome('vi');
    expect(screen.getByRole('heading', { name: 'Chào mừng đến với ERPChess' })).toBeTruthy();
    expect(screen.getByText('Bạn đang dùng bản web')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bắt đầu' }).getAttribute('href')).toBe('/signup');
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/login');
  });

  it('hiển thị tiếng Anh', () => {
    renderHome('en');
    expect(screen.getByRole('heading', { name: 'Welcome to ERPChess' })).toBeTruthy();
  });
});
