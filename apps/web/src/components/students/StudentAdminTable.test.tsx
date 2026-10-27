import type { Member } from '@erpchess/api';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentAdminTable } from './StudentAdminTable';

vi.mock('@erpchess/api/react', () => ({
  useSetStudentLevel: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useCreateInvitation: () => ({
    mutate: vi.fn(),
    isPending: false,
    data: null,
    error: null,
  }),
  useSetInitialRating: () => ({
    mutate: vi.fn(),
  }),
}));

const MOCK_STUDENTS = [
  {
    role: 'student',
    profile: {
      id: 's1',
      display_name: 'Nguyễn Văn An',
      username: 'an_nguyen',
    },
    levelId: 'lvl-1',
  },
  {
    role: 'student',
    profile: {
      id: 's2',
      display_name: 'Trần Thị Bình',
      username: 'binh_tran',
    },
    levelId: null,
  },
] as unknown as Member[];

const MOCK_LEVELS = [
  { id: 'lvl-1', name: 'Gold Kiwi' },
  { id: 'lvl-2', name: 'Silver Knight' },
];

const MOCK_GROUPS = [{ id: 'g1', name: 'Lớp U10 Nâng Cao', studentIds: ['s1'] }];

describe('StudentAdminTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị danh sách học viên với tên, avatar và cấp độ', () => {
    render(
      <StudentAdminTable
        students={MOCK_STUDENTS}
        academyId="acad-1"
        slug="clb-test"
        levels={MOCK_LEVELS}
        groups={MOCK_GROUPS}
      />,
    );

    expect(screen.getByText('Nguyễn Văn An')).toBeTruthy();
    expect(screen.getByText('@an_nguyen')).toBeTruthy();
    expect(screen.getByText('Trần Thị Bình')).toBeTruthy();
    expect(screen.getAllByText('Gold Kiwi').length).toBeGreaterThan(0);
    expect(screen.getByText('🏫 Lớp U10 Nâng Cao')).toBeTruthy();
  });

  it('lọc học viên theo từ khóa tìm kiếm', () => {
    render(
      <StudentAdminTable
        students={MOCK_STUDENTS}
        academyId="acad-1"
        slug="clb-test"
        levels={MOCK_LEVELS}
        groups={MOCK_GROUPS}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Tìm theo tên học viên, username...');
    fireEvent.change(searchInput, { target: { value: 'Bình' } });

    expect(screen.queryByText('Nguyễn Văn An')).toBeNull();
    expect(screen.getByText('Trần Thị Bình')).toBeTruthy();
  });

  it('hiển thị empty state khi không có kết quả lọc', () => {
    render(
      <StudentAdminTable
        students={MOCK_STUDENTS}
        academyId="acad-1"
        slug="clb-test"
        levels={MOCK_LEVELS}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Tìm theo tên học viên, username...');
    fireEvent.change(searchInput, { target: { value: 'Tên Không Tồn Tại 123' } });

    expect(screen.getByText('Không tìm thấy học viên nào phù hợp với bộ lọc.')).toBeTruthy();
  });
});
