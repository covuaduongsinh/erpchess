import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ slug: 'clb-test' }),
}));

vi.mock('@erpchess/api/react', () => ({
  useErpClient: () => ({}),
  useSession: () => ({
    session: { user: { id: 'user-1' } },
  }),
}));

function renderCommandPalette() {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <CommandPalette />
    </I18nextProvider>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị nút kích hoạt Command Palette trên header', () => {
    renderCommandPalette();
    expect(screen.getByTitle('Tìm kiếm nhanh (Ctrl+K)')).toBeTruthy();
  });

  it('mở modal khi bấm vào nút kích hoạt', () => {
    renderCommandPalette();
    const btn = screen.getByTitle('Tìm kiếm nhanh (Ctrl+K)');
    fireEvent.click(btn);

    expect(
      screen.getByPlaceholderText('Nhập tên trang, lớp học, tính năng... (ESC để đóng)'),
    ).toBeTruthy();
    expect(screen.getByText('ERPChess Command Palette')).toBeTruthy();
  });

  it('lọc danh sách lệnh khi nhập từ khóa', () => {
    renderCommandPalette();
    fireEvent.click(screen.getByTitle('Tìm kiếm nhanh (Ctrl+K)'));

    const input = screen.getByPlaceholderText(
      'Nhập tên trang, lớp học, tính năng... (ESC để đóng)',
    );
    fireEvent.change(input, { target: { value: 'phân tích' } });

    expect(screen.getByText('Bàn cờ phân tích với Arasan WASM')).toBeTruthy();
  });

  it('đóng modal khi nhấn phím Escape', () => {
    renderCommandPalette();
    fireEvent.click(screen.getByTitle('Tìm kiếm nhanh (Ctrl+K)'));

    expect(
      screen.getByPlaceholderText('Nhập tên trang, lớp học, tính năng... (ESC để đóng)'),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByPlaceholderText('Nhập tên trang, lớp học, tính năng... (ESC để đóng)'),
    ).toBeNull();
  });
});
