import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardPreferencesCard } from './BoardPreferencesCard';

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
});

vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({
    t: (key: string) => {
      if (key === 'profile.boardCustomizerTitle') return 'Tùy biến bàn cờ';
      if (key === 'profile.boardCustomizerSubtitle') return 'Chọn màu sắc và tùy chọn';
      if (key === 'profile.boardTheme') return 'Màu sắc bàn cờ';
      if (key === 'profile.boardTheme_navy') return 'Dương Sinh Navy';
      if (key === 'profile.boardTheme_green') return 'Cẩm thạch Xanh';
      if (key === 'profile.boardTheme_wood') return 'Gỗ Cổ điển';
      if (key === 'profile.boardTheme_blue') return 'Xanh Đại dương';
      if (key === 'profile.boardTheme_charcoal') return 'Xám Kim loại';
      if (key === 'profile.boardCoordinates') return 'Hiển thị tọa độ mép bàn cờ';
      if (key === 'profile.boardSound') return 'Âm thanh nước đi';
      if (key === 'profile.boardAutoFlip') return 'Tự động xoay bàn cờ theo lượt';
      if (key === 'profile.liveBoardPreview') return 'Bàn cờ xem trước';
      if (key === 'profile.boardPieceSet_celtic') return 'Celtic';
      if (key === 'profile.boardPieceSet_spatial') return 'Spatial';
      return key;
    },
    i18n: { language: 'vi' },
  }),
}));

vi.mock('@erpchess/board-web', () => ({
  BOARD_THEMES: {
    navy: { light: '#E8EBF7', dark: '#7C88C9', name: 'Dương Sinh Navy' },
    green: { light: '#EEEED2', dark: '#769656', name: 'Cẩm thạch Xanh' },
    wood: { light: '#F0D9B5', dark: '#B58863', name: 'Gỗ Cổ điển' },
    blue: { light: '#DEE3E6', dark: '#8CA2AD', name: 'Xanh Đại dương' },
    charcoal: { light: '#E0E0E0', dark: '#4E545C', name: 'Xám Kim loại' },
  },
  PIECE_SETS: {
    celtic: { wN: 'celtic-wN.svg' },
    spatial: { wN: 'spatial-wN.svg' },
  },
  Board: ({
    theme,
    coordinates,
    pieceSet,
  }: {
    theme?: string;
    coordinates?: boolean;
    pieceSet?: string;
  }) => (
    <div
      data-testid="live-board-preview"
      data-theme={theme}
      data-coords={coordinates}
      data-pieces={pieceSet}
    >
      Live Preview
    </div>
  ),
}));

describe('BoardPreferencesCard', () => {
  it('renders all board customization controls and preview', () => {
    render(<BoardPreferencesCard />);

    expect(screen.getByText('Tùy biến bàn cờ')).toBeTruthy();
    expect(screen.getByText('Dương Sinh Navy')).toBeTruthy();
    expect(screen.getByText('Cẩm thạch Xanh')).toBeTruthy();
    expect(screen.getByText('Gỗ Cổ điển')).toBeTruthy();
    expect(screen.getByText('Xanh Đại dương')).toBeTruthy();
    expect(screen.getByText('Xám Kim loại')).toBeTruthy();

    const preview = screen.getByTestId('live-board-preview');
    expect(preview.getAttribute('data-theme')).toBe('navy');
  });

  it('changes theme when clicking a theme button', () => {
    render(<BoardPreferencesCard />);

    const woodBtn = screen.getByRole('button', { name: /Gỗ Cổ điển/i });
    fireEvent.click(woodBtn);

    const preview = screen.getByTestId('live-board-preview');
    expect(preview.getAttribute('data-theme')).toBe('wood');
  });

  it('toggles coordinates and sound settings', () => {
    render(<BoardPreferencesCard />);

    const coordCheckbox = screen.getByLabelText('Hiển thị tọa độ mép bàn cờ');
    expect((coordCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(coordCheckbox);
    expect((coordCheckbox as HTMLInputElement).checked).toBe(false);

    const preview = screen.getByTestId('live-board-preview');
    expect(preview.getAttribute('data-coords')).toBe('false');
  });

  it('resets preferences to default when clicking reset button', () => {
    render(<BoardPreferencesCard />);

    const blueBtn = screen.getByRole('button', { name: /Xanh Đại dương/i });
    fireEvent.click(blueBtn);

    const preview = screen.getByTestId('live-board-preview');
    expect(preview.getAttribute('data-theme')).toBe('blue');

    const resetBtn = screen.getByRole('button', { name: /Đặt lại thiết lập bàn cờ mặc định/i });
    fireEvent.click(resetBtn);

    expect(preview.getAttribute('data-theme')).toBe('navy');
  });

  it('changes piece set when clicking a piece set button', () => {
    render(<BoardPreferencesCard />);

    const preview = screen.getByTestId('live-board-preview');
    expect(preview.getAttribute('data-pieces')).toBe('celtic');

    fireEvent.click(screen.getByRole('button', { name: /Spatial/i }));
    expect(preview.getAttribute('data-pieces')).toBe('spatial');
  });
});
