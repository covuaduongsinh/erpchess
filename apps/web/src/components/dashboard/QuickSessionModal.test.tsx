import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickSessionModal } from './QuickSessionModal';

const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue([{ id: 'new-class-123' }]);

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@erpchess/api/react', () => ({
  useClassroomMutations: () => ({
    create: {
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    },
  }),
}));

const MOCK_COACHES = [
  { id: 'coach-1', name: 'Đại kiện tướng Tuấn' },
  { id: 'coach-2', name: 'Huấn luyện viên Mai' },
];

const MOCK_GROUPS = [
  { id: 'group-1', name: 'Lớp U10 Nâng cao' },
  { id: 'group-2', name: 'Lớp Nhập môn' },
];

describe('QuickSessionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('không render gì khi open = false', () => {
    const { container } = render(
      <QuickSessionModal
        open={false}
        onClose={vi.fn()}
        academyId="acad-1"
        slug="clb-test"
        userId="user-1"
        coaches={MOCK_COACHES}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('hiển thị form tạo lớp khi open = true', () => {
    render(
      <QuickSessionModal
        open={true}
        onClose={vi.fn()}
        academyId="acad-1"
        slug="clb-test"
        userId="user-1"
        coaches={MOCK_COACHES}
        groups={MOCK_GROUPS}
      />,
    );

    expect(screen.getByText('Tạo Lớp học Nhanh')).toBeTruthy();
    expect(screen.getByDisplayValue('Lớp Cờ vua Trực tuyến')).toBeTruthy();
    expect(screen.getByText('Đại kiện tướng Tuấn')).toBeTruthy();
    expect(screen.getByText('Lớp U10 Nâng cao')).toBeTruthy();
  });

  it('gọi create.mutateAsync khi submit form', async () => {
    const handleClose = vi.fn();
    render(
      <QuickSessionModal
        open={true}
        onClose={handleClose}
        academyId="acad-1"
        slug="clb-test"
        userId="user-1"
        coaches={MOCK_COACHES}
        groups={MOCK_GROUPS}
      />,
    );

    const titleInput = screen.getByDisplayValue('Lớp Cờ vua Trực tuyến');
    fireEvent.change(titleInput, { target: { value: 'Chuyên đề Tàn cuộc Xe' } });

    const submitBtn = screen.getByText('✓ Tạo Buổi Học');
    fireEvent.click(submitBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Chuyên đề Tàn cuộc Xe',
        kind: 'online',
        minutes: 60,
      }),
    );
  });

  it('gọi onClose khi nhấn nút đóng hoặc bấm Escape', () => {
    const handleClose = vi.fn();
    render(
      <QuickSessionModal
        open={true}
        onClose={handleClose}
        academyId="acad-1"
        slug="clb-test"
        userId="user-1"
        coaches={MOCK_COACHES}
      />,
    );

    const closeBtn = screen.getByLabelText('Đóng');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
