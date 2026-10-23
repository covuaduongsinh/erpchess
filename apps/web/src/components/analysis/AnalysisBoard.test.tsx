import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalysisBoard } from './AnalysisBoard';

afterEach(cleanup);

function setup(fen?: string) {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AnalysisBoard initialFen={fen} />
    </I18nextProvider>,
  );
}

function press(container: HTMLElement, sq: string) {
  const el = container.querySelector(`[data-square="${sq}"]`) as Element;
  fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(el, { button: 0, pointerId: 1 });
}

describe('AnalysisBoard', () => {
  it('render được, chưa tải engine khi chưa bật', () => {
    const { container } = setup();
    expect(container.querySelectorAll('[data-piece]')).toHaveLength(32);
    expect(screen.getByText('Đi một nước trên bàn cờ, hoặc dán FEN/PGN bên dưới.')).toBeTruthy();
  });

  it('đi quân thêm vào danh sách nước; đi lùi rồi đi khác tạo biến', () => {
    const { container } = setup();
    press(container, 'e2');
    press(container, 'e4');
    press(container, 'e7');
    press(container, 'e5');
    expect(screen.getAllByRole('button', { name: /e4|e5/ }).length).toBeGreaterThanOrEqual(2);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    press(container, 'c7');
    press(container, 'c5');
    const current = container.querySelector('[aria-current="true"]');
    expect(current?.textContent).toContain('c5');
    expect(container.textContent).toContain('(');
  }, 20_000);

  it('dán PGN mở ván và cho đi tới/lùi', () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText('Dán FEN hoặc PGN'), {
      target: { value: '1. e4 e5 2. Nf3 (2. f4 exf4) 2... Nc6 *' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mở' }));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain('Nc6');
    expect(container.querySelector('[data-at="c6"]')?.getAttribute('data-piece')).toBe('bN');
  }, 20_000);
});
