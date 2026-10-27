import type { ClassroomRoom, RoomSnapshot } from '@erpchess/api';
import { START_FEN } from '@erpchess/chess-core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassroomToolbar } from './ClassroomToolbar';

const MOCK_SNAPSHOT: RoomSnapshot = {
  fen: START_FEN,
  lastMove: null,
  ply: 0,
  drawings: { arrows: [], highlights: [] },
  controller: null,
  engine: false,
};

describe('ClassroomToolbar', () => {
  afterEach(cleanup);

  it('hiển thị nút lật cờ cho cả HLV và học viên', () => {
    const onToggleFlip = vi.fn();

    render(
      <ClassroomToolbar
        room={null}
        snapshot={MOCK_SNAPSHOT}
        runner={false}
        flipped={false}
        onToggleFlip={onToggleFlip}
      />,
    );

    const flipBtn = screen.getByText('Nhìn quân Đen');
    expect(flipBtn).toBeTruthy();
    fireEvent.click(flipBtn);
    expect(onToggleFlip).toHaveBeenCalledTimes(1);
  });

  it('không hiển thị công cụ HLV đối với học viên', () => {
    render(
      <ClassroomToolbar
        room={null}
        snapshot={MOCK_SNAPSHOT}
        runner={false}
        flipped={false}
        onToggleFlip={vi.fn()}
      />,
    );

    expect(screen.queryByText('Đi lại (Undo)')).toBeNull();
    expect(screen.queryByText('Ván mới')).toBeNull();
    expect(screen.queryByText('Bật Engine')).toBeNull();
    expect(screen.queryByText('Xóa nét vẽ')).toBeNull();
  });

  it('hiển thị đầy đủ công cụ sư phạm khi là HLV và tương tác kích hoạt hàm phòng', () => {
    const mockRoom = {
      setFen: vi.fn(),
      undo: vi.fn(),
      setEngine: vi.fn(),
      setDrawings: vi.fn(),
    } as unknown as ClassroomRoom;

    render(
      <ClassroomToolbar
        room={mockRoom}
        snapshot={MOCK_SNAPSHOT}
        runner={true}
        flipped={false}
        onToggleFlip={vi.fn()}
      />,
    );

    // Bấm ván mới
    fireEvent.click(screen.getByText('Ván mới'));
    expect(mockRoom.setFen).toHaveBeenCalledWith(START_FEN);

    // Bấm undo
    fireEvent.click(screen.getByText('Đi lại (Undo)'));
    expect(mockRoom.undo).toHaveBeenCalledTimes(1);

    // Bấm bật engine
    fireEvent.click(screen.getByText('Bật Engine'));
    expect(mockRoom.setEngine).toHaveBeenCalledWith(true);

    // Bấm xóa nét vẽ
    fireEvent.click(screen.getByText('Xóa nét vẽ'));
    expect(mockRoom.setDrawings).toHaveBeenCalledWith({ arrows: [], highlights: [] });
  });

  it('cho phép nạp FEN hợp lệ từ form FEN', () => {
    const mockRoom = {
      setFen: vi.fn(),
      undo: vi.fn(),
      setEngine: vi.fn(),
      setDrawings: vi.fn(),
    } as unknown as ClassroomRoom;

    render(
      <ClassroomToolbar
        room={mockRoom}
        snapshot={MOCK_SNAPSHOT}
        runner={true}
        flipped={false}
        onToggleFlip={vi.fn()}
      />,
    );

    // Mở hộp nạp FEN
    fireEvent.click(screen.getByText('Nạp FEN'));
    const input = screen.getByLabelText('Chuỗi FEN thế cờ');
    expect(input).toBeTruthy();

    const sampleFen = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';
    fireEvent.change(input, { target: { value: sampleFen } });

    fireEvent.click(screen.getByText('Áp dụng'));
    expect(mockRoom.setFen).toHaveBeenCalledWith(sampleFen);
  });
});
