import type { Puzzle } from '@erpchess/chess-core';
import { createI18n } from '@erpchess/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { PuzzleSolver } from './PuzzleSolver';

const BACK_RANK: Puzzle = {
  fen: '5rk1/5ppp/8/8/8/8/5QPP/5RK1 w - - 0 1',
  moves: ['f2f7', 'f8f7', 'f1f7'],
};

function move(container: HTMLElement, from: string, to: string) {
  for (const sq of [from, to]) {
    const el = container.querySelector(`[data-square="${sq}"]`);
    if (!el) throw new Error(`không thấy ô ${sq}`);
    fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(el, { button: 0, pointerId: 1 });
  }
}

function setup() {
  const onTryEnd = vi.fn();
  const view = render(
    <I18nextProvider i18n={createI18n('vi')}>
      <PuzzleSolver puzzle={BACK_RANK} onTryEnd={onTryEnd} />
    </I18nextProvider>,
  );
  return { ...view, onTryEnd };
}

describe('PuzzleSolver', () => {
  it('đi sai: báo sai, nộp lượt thử, bấm Thử lại về thế ban đầu', () => {
    const { container, onTryEnd } = setup();
    move(container, 'f2', 'f6');
    expect(screen.getByRole('status').textContent).toBe('Chưa đúng.');
    expect(onTryEnd).toHaveBeenCalledTimes(1);
    expect(onTryEnd.mock.calls[0]?.[0].moves.map((m: { uci: string }) => m.uci)).toEqual(['f2f6']);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(container.querySelector('[data-at="f2"]')?.getAttribute('data-piece')).toBe('wQ');
  });

  it('đi đúng: đối phương tự đáp, giải xong thì nộp cả chuỗi nước', () => {
    const { container, onTryEnd } = setup();
    move(container, 'f2', 'f7');
    expect(screen.getByText('Đúng! Tiếp tục…')).toBeTruthy();
    // Đen đã ăn lại ở f7
    expect(container.querySelector('[data-at="f7"]')?.getAttribute('data-piece')).toBe('bR');
    expect(onTryEnd).not.toHaveBeenCalled();
    move(container, 'f1', 'f7');
    expect(screen.getByRole('status').textContent).toBe('Giải xong!');
    expect(onTryEnd.mock.calls[0]?.[0].moves.map((m: { uci: string }) => m.uci)).toEqual([
      'f2f7',
      'f1f7',
    ]);
  });
});
