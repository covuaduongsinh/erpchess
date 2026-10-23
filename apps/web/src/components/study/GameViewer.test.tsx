import { createI18n } from '@erpchess/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { GameViewer } from './GameViewer';

const PGN = `[White "An"]
[Black "Bình"]
[Result "1-0"]

1. e4 { Mở đầu tốt } e5 2. Qh5 (2. Nf3) Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;

function setup(pgn = PGN) {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <GameViewer pgn={pgn}>{(fen) => <output data-testid="fen">{fen}</output>}</GameViewer>
    </I18nextProvider>,
  );
}

describe('GameViewer', () => {
  it('hiện tên kỳ thủ, đi tới/lui bằng nút, hiện chú thích', () => {
    const { container } = setup();
    expect(screen.getByText(/An – Bình/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nước sau' }));
    expect(container.querySelector('[data-at="e4"]')?.getAttribute('data-piece')).toBe('wP');
    expect(screen.getByText('Mở đầu tốt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Về cuối' }));
    expect(screen.getByTestId('fen').textContent).toMatch(/^r1bqkb1r\/pppp1Qpp/);
    fireEvent.click(screen.getByRole('button', { name: 'Về đầu' }));
    expect(container.querySelector('[data-at="e4"]')).toBeNull();
  });

  it('PGN hỏng thì báo lỗi thay vì vỡ trang', () => {
    setup('1. e4 e4');
    expect(screen.getByText('Không đọc được PGN của ván này.')).toBeTruthy();
  });
});
