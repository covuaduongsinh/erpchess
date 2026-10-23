import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardEditor } from '../src/BoardEditor';
import { boardToFen, parseBoard } from '../src/geometry';

afterEach(cleanup);

const LABELS = {
  board: 'Bàn dựng',
  eraser: 'Tẩy',
  start: 'Thế ban đầu',
  clear: 'Xoá bàn',
  flip: 'Lật bàn',
  sideToMove: 'Lượt đi',
  white: 'Trắng',
  black: 'Đen',
};

describe('boardToFen', () => {
  it('ghép lại đúng thế ban đầu kèm quyền nhập thành', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(boardToFen(parseBoard(start), 'w')).toBe(start);
  });

  it('bàn không vua, lượt đen', () => {
    expect(boardToFen(parseBoard('8/8/8/p3p3/8/8/8/R7 w - - 0 1'), 'b')).toBe(
      '8/8/8/p3p3/8/8/8/R7 b - - 0 1',
    );
  });
});

describe('BoardEditor', () => {
  it('chọn quân, đặt lên ô, bấm lại để xoá, đổi lượt', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" onChange={onChange} labels={LABELS} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xe trắng' }));
    fireEvent.click(container.querySelector('[data-square="a1"]') as Element);
    expect(onChange).toHaveBeenLastCalledWith('8/8/8/8/8/8/8/R7 w - - 0 1');

    rerender(<BoardEditor fen="8/8/8/8/8/8/8/R7 w - - 0 1" onChange={onChange} labels={LABELS} />);
    fireEvent.click(container.querySelector('[data-square="a1"]') as Element);
    expect(onChange).toHaveBeenLastCalledWith('8/8/8/8/8/8/8/8 w - - 0 1');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenLastCalledWith('8/8/8/8/8/8/8/R7 b - - 0 1');
  });

  it('nút thế ban đầu và xoá bàn', () => {
    const onChange = vi.fn();
    render(<BoardEditor fen="8/8/8/8/8/8/8/8 b - - 0 1" onChange={onChange} labels={LABELS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thế ban đầu' }));
    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(
      /^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR b /,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xoá bàn' }));
    expect(onChange).toHaveBeenLastCalledWith('8/8/8/8/8/8/8/8 b - - 0 1');
  });
});
