import type { ClassroomRoom, RoomPeer, RoomSnapshot } from '@erpchess/api';
import { START_FEN } from '@erpchess/chess-core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassroomRoster } from './ClassroomRoster';

const MOCK_PEERS: RoomPeer[] = [
  { userId: 'coach-1', name: 'Đại Kiện Tướng Lê Quang Liêm', runner: true },
  { userId: 'student-1', name: 'Nguyễn Văn An', runner: false },
  { userId: 'student-2', name: 'Trần Thị Bình', runner: false },
];

const MOCK_SNAPSHOT: RoomSnapshot = {
  fen: START_FEN,
  lastMove: null,
  ply: 0,
  drawings: { arrows: [], highlights: [] },
  controller: 'student-1',
  engine: false,
};

describe('ClassroomRoster', () => {
  afterEach(cleanup);

  it('hiển thị danh sách các thành viên và vai trò', () => {
    render(
      <ClassroomRoster
        peers={MOCK_PEERS}
        snapshot={MOCK_SNAPSHOT}
        runner={false}
        room={null}
        currentUserId="student-2"
      />,
    );

    expect(screen.getByText('Thành viên (3)')).toBeTruthy();
    expect(screen.getByText('Đại Kiện Tướng Lê Quang Liêm')).toBeTruthy();
    expect(screen.getAllByText(/Nguyễn Văn An/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Trần Thị Bình/)).toBeTruthy();
    expect(screen.getByText('(bạn)')).toBeTruthy();
  });

  it('hiển thị badge đang đi cờ cho học viên được trao quyền', () => {
    render(
      <ClassroomRoster
        peers={MOCK_PEERS}
        snapshot={MOCK_SNAPSHOT}
        runner={false}
        room={null}
        currentUserId="student-2"
      />,
    );

    expect(screen.getByText('Đang đi cờ')).toBeTruthy();
  });

  it('cho phép HLV trao quyền và thu quyền học viên', () => {
    const mockRoom = {
      setController: vi.fn(),
    } as unknown as ClassroomRoom;

    render(
      <ClassroomRoster
        peers={MOCK_PEERS}
        snapshot={MOCK_SNAPSHOT}
        runner={true}
        room={mockRoom}
        currentUserId="coach-1"
      />,
    );

    // HLV có thể bấm Hủy quyền của student-1
    const revokeBtn = screen.getByText('Hủy quyền ✕');
    fireEvent.click(revokeBtn);
    expect(mockRoom.setController).toHaveBeenCalledWith(null);

    // HLV có thể trao quyền cho student-2
    const grantBtn = screen.getByText('Cho đi cờ ♟');
    fireEvent.click(grantBtn);
    expect(mockRoom.setController).toHaveBeenCalledWith('student-2');

    // Nút "Thu quyền về HLV" trên tiêu đề
    const returnAllBtn = screen.getByText('Thu quyền về HLV');
    fireEvent.click(returnAllBtn);
    expect(mockRoom.setController).toHaveBeenCalledWith(null);
  });

  it('hỗ trợ tính năng giơ tay phát biểu cho học viên và hạ tay cho HLV', () => {
    const onToggleRaiseHand = vi.fn();
    const onLowerAllHands = vi.fn();
    const raisedHands = new Set(['student-2']);

    // Render ở góc nhìn học viên student-2 (đang giơ tay)
    const { rerender } = render(
      <ClassroomRoster
        peers={MOCK_PEERS}
        snapshot={MOCK_SNAPSHOT}
        runner={false}
        room={null}
        currentUserId="student-2"
        raisedHands={raisedHands}
        onToggleRaiseHand={onToggleRaiseHand}
      />,
    );

    const lowerHandBtn = screen.getByText('✋ Hạ tay xuống');
    expect(lowerHandBtn).toBeTruthy();
    fireEvent.click(lowerHandBtn);
    expect(onToggleRaiseHand).toHaveBeenCalledTimes(1);

    // Render ở góc nhìn HLV coach-1
    rerender(
      <ClassroomRoster
        peers={MOCK_PEERS}
        snapshot={MOCK_SNAPSHOT}
        runner={true}
        room={null}
        currentUserId="coach-1"
        raisedHands={raisedHands}
        onLowerAllHands={onLowerAllHands}
      />,
    );

    // HLV thấy nút mời học viên giơ tay
    expect(screen.getByText('Mời đi cờ ✋')).toBeTruthy();

    // HLV bấm hạ tay cả lớp
    const lowerAllBtn = screen.getByText('Hạ tay (1)');
    expect(lowerAllBtn).toBeTruthy();
    fireEvent.click(lowerAllBtn);
    expect(onLowerAllHands).toHaveBeenCalledTimes(1);
  });
});
