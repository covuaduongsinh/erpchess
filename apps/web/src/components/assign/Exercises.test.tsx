import type { ExerciseSummary } from '@erpchess/api';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Exercises } from './Exercises';

vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({
    t: (key: string, opt?: { count?: number }) => {
      if (key === 'assignments.puzzleCount') return `${opt?.count ?? 0} thế cờ`;
      if (key === 'exercise.assignedTimes') return `Đã giao ${opt?.count ?? 0} lần`;
      if (key === 'exercise.title') return 'Ngân hàng Bài tập';
      if (key === 'exercise.create') return 'Tạo bài tập';
      if (key === 'exercise.assign') return 'Giao bài tập';
      if (key === 'studies.delete') return 'Xóa';
      return key;
    },
    i18n: { language: 'vi' },
  }),
}));

vi.mock('../../lib/academy-context', () => ({
  useAcademy: () => ({
    academy: { id: 'acad-1', slug: 'clb-test', role: 'owner' },
    session: { user: { id: 'user-coach-1' } },
  }),
}));

const MOCK_EXERCISES: ExerciseSummary[] = [
  {
    id: 'ex-1',
    academy_id: 'acad-1',
    title: 'Đòn Chĩa Ba Hiểm Hóc',
    description: 'Tuyển tập thế cờ bắt đôi bằng Mã và Hậu',
    level_id: 'lvl-intermediate',
    tags: ['fork', 'tactics'],
    puzzleIds: ['puz-1', 'puz-2', 'puz-3'],
    assignedCount: 4,
    created_at: new Date().toISOString(),
    created_by: 'coach-1',
  },
  {
    id: 'ex-2',
    academy_id: 'acad-1',
    title: 'Chiếu Bí Trong 1 Nước',
    description: 'Bài tập nhập môn cho kỳ thủ nhí',
    level_id: 'lvl-beginner',
    tags: ['mate', 'beginner'],
    puzzleIds: ['puz-4', 'puz-5'],
    assignedCount: 12,
    created_at: new Date().toISOString(),
    created_by: 'coach-1',
  },
];

const MOCK_LEVELS = [
  { id: 'lvl-beginner', name: 'Nhập Môn' },
  { id: 'lvl-intermediate', name: 'Trung Cấp' },
];

vi.mock('@erpchess/api/react', () => ({
  useExercises: () => ({
    data: MOCK_EXERCISES,
    isPending: false,
    error: null,
  }),
  useLevels: () => ({
    data: MOCK_LEVELS,
    isPending: false,
    error: null,
  }),
  useExerciseMutations: () => ({
    remove: { mutate: vi.fn(), isPending: false, error: null },
    assign: { mutate: vi.fn(), isPending: false, error: null },
    create: { mutate: vi.fn(), isPending: false, error: null },
  }),
}));

describe('Exercises component', () => {
  afterEach(cleanup);

  it('hiển thị danh sách bài tập kèm số lượng thế cờ và cấp độ', () => {
    render(<Exercises />);

    expect(screen.getByText('Đòn Chĩa Ba Hiểm Hóc')).toBeTruthy();
    expect(screen.getByText('Chiếu Bí Trong 1 Nước')).toBeTruthy();
    expect(screen.getAllByText('Trung Cấp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nhập Môn').length).toBeGreaterThan(0);
    expect(screen.getByText('3 thế cờ')).toBeTruthy();
    expect(screen.getByText('2 thế cờ')).toBeTruthy();
  });

  it('lọc danh sách bài tập theo từ khóa tìm kiếm', () => {
    render(<Exercises />);

    const searchInput = screen.getByLabelText('Tìm bài tập');
    fireEvent.change(searchInput, { target: { value: 'Chĩa Ba' } });

    expect(screen.getByText('Đòn Chĩa Ba Hiểm Hóc')).toBeTruthy();
    expect(screen.queryByText('Chiếu Bí Trong 1 Nước')).toBeNull();
  });

  it('lọc danh sách bài tập theo cấp độ được chọn', () => {
    render(<Exercises />);

    const levelSelect = screen.getByLabelText('Lọc theo cấp độ');
    fireEvent.change(levelSelect, { target: { value: 'lvl-beginner' } });

    expect(screen.queryByText('Đòn Chĩa Ba Hiểm Hóc')).toBeNull();
    expect(screen.getByText('Chiếu Bí Trong 1 Nước')).toBeTruthy();
  });

  it('hiển thị thông báo khi không tìm thấy kết quả phù hợp', () => {
    render(<Exercises />);

    const searchInput = screen.getByLabelText('Tìm bài tập');
    fireEvent.change(searchInput, { target: { value: 'Không tìm thấy gì 12345' } });

    expect(screen.getByText('Không tìm thấy bài tập nào phù hợp với bộ lọc.')).toBeTruthy();
  });
});
