import { legalDests, START_FEN } from '@erpchess/chess-core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board, type Drawings } from '../src/Board';

afterEach(cleanup);

function square(container: HTMLElement, sq: string) {
  const el = container.querySelector(`[data-square="${sq}"]`);
  if (!el) throw new Error(`không thấy ô ${sq}`);
  return el;
}

function press(container: HTMLElement, sq: string, button = 0) {
  fireEvent.pointerDown(square(container, sq), { button, pointerId: 1 });
  fireEvent.pointerUp(square(container, sq), { button, pointerId: 1 });
}

describe('Board', () => {
  it('vẽ đủ 32 quân; ẩn quân ở chế độ cờ mù', () => {
    const { container, rerender } = render(<Board fen={START_FEN} />);
    expect(container.querySelectorAll('[data-piece]')).toHaveLength(32);
    expect(container.querySelector('[data-at="e1"]')?.getAttribute('data-piece')).toBe('wK');
    rerender(<Board fen={START_FEN} hiddenSquares={['e1', 'd1']} />);
    expect(container.querySelectorAll('[data-piece]')).toHaveLength(30);
  });

  it('bấm quân rồi bấm ô đích thì đi; hiện các ô có thể đi', () => {
    const onMove = vi.fn();
    const { container } = render(
      <Board
        fen={START_FEN}
        movable={{ color: 'w', dests: legalDests(START_FEN) }}
        onMove={onMove}
      />,
    );
    press(container, 'e2');
    expect(
      [...container.querySelectorAll('[data-dest]')].map((d) => d.getAttribute('data-dest')).sort(),
    ).toEqual(['e3', 'e4']);
    press(container, 'e4');
    expect(onMove).toHaveBeenCalledWith('e2', 'e4');
  });

  it('không cho đi quân đối phương hoặc khi bàn chỉ để xem', () => {
    const onMove = vi.fn();
    const { container, rerender } = render(
      <Board
        fen={START_FEN}
        movable={{ color: 'w', dests: legalDests(START_FEN) }}
        onMove={onMove}
      />,
    );
    press(container, 'e7');
    expect(container.querySelectorAll('[data-dest]')).toHaveLength(0);
    rerender(<Board fen={START_FEN} onMove={onMove} />);
    press(container, 'e2');
    press(container, 'e4');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('phong cấp: hiện hộp chọn quân, trả quân đã chọn', () => {
    const fen = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
    const onMove = vi.fn();
    const { container } = render(
      <Board fen={fen} movable={{ color: 'w', dests: legalDests(fen) }} onMove={onMove} />,
    );
    press(container, 'e7');
    press(container, 'e8');
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mã' }));
    expect(onMove).toHaveBeenCalledWith('e7', 'e8', 'n');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('chuột phải: kéo vẽ mũi tên, bấm tại chỗ tô ô; vẽ lại thì xoá', () => {
    let drawings: Drawings = { arrows: [], highlights: [] };
    const onDrawingsChange = vi.fn((d: Drawings) => {
      drawings = d;
    });
    const { container, rerender } = render(
      <Board fen={START_FEN} drawings={drawings} onDrawingsChange={onDrawingsChange} />,
    );
    fireEvent.pointerDown(square(container, 'e2'), { button: 2, pointerId: 2 });
    fireEvent.pointerUp(square(container, 'e4'), { button: 2, pointerId: 2 });
    expect(drawings.arrows).toEqual([{ from: 'e2', to: 'e4', brush: 'green' }]);
    rerender(<Board fen={START_FEN} drawings={drawings} onDrawingsChange={onDrawingsChange} />);
    expect(container.querySelector('[data-arrow="e2e4"]')).not.toBeNull();

    fireEvent.pointerDown(square(container, 'd5'), { button: 2, pointerId: 2, shiftKey: true });
    fireEvent.pointerUp(square(container, 'd5'), { button: 2, pointerId: 2 });
    expect(drawings.highlights).toEqual([{ square: 'd5', brush: 'red' }]);

    rerender(<Board fen={START_FEN} drawings={drawings} onDrawingsChange={onDrawingsChange} />);
    fireEvent.pointerDown(square(container, 'e2'), { button: 2, pointerId: 2 });
    fireEvent.pointerUp(square(container, 'e4'), { button: 2, pointerId: 2 });
    expect(drawings.arrows).toEqual([]);
  });

  it('bàn phím: mũi tên chọn ô, Enter để chọn và đi', () => {
    const onMove = vi.fn();
    render(
      <Board
        fen={START_FEN}
        movable={{ color: 'w', dests: legalDests(START_FEN) }}
        onMove={onMove}
      />,
    );
    const board = screen.getByRole('application', { name: 'Bàn cờ' });
    board.focus();
    expect(screen.getByText('e2, Tốt trắng')).toBeTruthy();
    fireEvent.keyDown(board, { key: 'Enter' });
    fireEvent.keyDown(board, { key: 'ArrowUp' });
    fireEvent.keyDown(board, { key: 'ArrowUp' });
    expect(screen.getByText('e4')).toBeTruthy();
    fireEvent.keyDown(board, { key: 'Enter' });
    expect(onMove).toHaveBeenCalledWith('e2', 'e4');
  });

  it('kéo-thả nhanh (các sự kiện tới trước khi React vẽ lại) vẫn đi được', () => {
    const onMove = vi.fn();
    const { container } = render(
      <Board
        fen={START_FEN}
        movable={{ color: 'w', dests: legalDests(START_FEN) }}
        onMove={onMove}
      />,
    );
    const svg = container.querySelector('svg') as SVGSVGElement;
    // Bàn 800×800 tại gốc toạ độ: g1 có tâm (650, 750), f3 có tâm (550, 550)
    svg.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 800,
        x: 0,
        y: 0,
        right: 800,
        bottom: 800,
      }) as DOMRect;
    const g1 = square(container, 'g1');
    // fireEvent bọc act(): mỗi sự kiện được React xử lý xong mới tới sự kiện sau. Để mô phỏng
    // các sự kiện tới dồn dập, gửi trực tiếp trên DOM rồi mới cho React vẽ lại.
    const opts = (x: number, y: number) => ({
      bubbles: true,
      button: 0,
      pointerId: 7,
      clientX: x,
      clientY: y,
    });
    g1.dispatchEvent(new PointerEvent('pointerdown', opts(650, 750)));
    svg.dispatchEvent(new PointerEvent('pointermove', opts(600, 650)));
    svg.dispatchEvent(new PointerEvent('pointermove', opts(550, 550)));
    svg.dispatchEvent(new PointerEvent('pointerup', opts(550, 550)));
    expect(onMove).toHaveBeenCalledWith('g1', 'f3');
  });

  it('lật bàn: a1 nằm góc trên phải khi nhìn từ phía Đen', () => {
    const { container } = render(<Board fen={START_FEN} orientation="b" />);
    const a1 = square(container, 'a1');
    expect(a1.getAttribute('x')).toBe('700');
    expect(a1.getAttribute('y')).toBe('0');
  });
});

describe('Board trên thế cờ không có vua (hoạt động bắt quân)', () => {
  it('đi được nước thường và hỏi phong cấp khi tốt lên hàng cuối', () => {
    const onMove = vi.fn();
    const fen = '1p6/P7/8/8/8/8/8/R3p3 w - - 0 1';
    const dests = new Map([
      ['a1', ['e1']],
      ['a7', ['b8']],
    ]);
    const { container } = render(
      <Board fen={fen} movable={{ color: 'w', dests }} onMove={onMove} label="bàn" />,
    );
    for (const sq of ['a1', 'e1']) {
      fireEvent.pointerDown(square(container, sq), { button: 0, pointerId: 1 });
      fireEvent.pointerUp(square(container, sq), { button: 0, pointerId: 1 });
    }
    expect(onMove).toHaveBeenCalledWith('a1', 'e1');
    for (const sq of ['a7', 'b8']) {
      fireEvent.pointerDown(square(container, sq), { button: 0, pointerId: 1 });
      fireEvent.pointerUp(square(container, sq), { button: 0, pointerId: 1 });
    }
    // Hiện bảng chọn quân phong cấp thay vì gọi onMove ngay
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });
});
