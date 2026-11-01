import type { MyAcademy } from '@erpchess/api';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route } from '../../routes/a.$slug.students';

const members = vi.hoisted(() => ({ data: [] as unknown[] }));

const ok = <T,>(data: T) => ({ data, isPending: false, error: null });
const mutation = { mutate: vi.fn(), isPending: false, error: null, data: null, reset: vi.fn() };

vi.mock('@erpchess/api/react', () => ({
  useErpClient: () => ({}),
  useMembers: () => ok(members.data),
  useLevels: () => ok([{ id: 'l1', name: 'Gold Kiwi' }]),
  useGroups: () => ok([{ id: 'g1', name: 'Lớp U10', studentCount: 1 }]),
  useGroupMemberships: () => ok([{ groupId: 'g1', studentId: 's1' }]),
  useRatings: () => ok([]),
  useSetStudentLevel: () => mutation,
  useSetInitialRating: () => mutation,
  useCreateInvitation: () => mutation,
  useCreateStudent: () => mutation,
  useImportStudents: () => ({ ...mutation, progress: 0 }),
}));

const student = (id: string, name: string, username: string, levelId: string | null) => ({
  role: 'student',
  levelId,
  profile: { id, display_name: name, username },
});

function renderPage() {
  const Page = Route.options.component as ComponentType;
  const academy = { id: 'a1', slug: 'clb', name: 'CLB', role: 'owner' } as unknown as MyAcademy;
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AcademyContext value={{ academy, session: {} as never }}>
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </AcademyContext>
    </I18nextProvider>,
  );
}

beforeAll(async () => {
  const page = Route.options.component as { preload?: () => Promise<void> };
  await page.preload?.();
}, 60_000);

beforeEach(() => {
  vi.spyOn(Route, 'useSearch').mockReturnValue({});
  members.data = [
    student('s1', 'Nguyễn Văn An', 'an', 'l1'),
    student('s2', 'Trần Thị Bình', 'binh', null),
    {
      role: 'coach',
      levelId: null,
      profile: { id: 'c1', display_name: 'HLV Cường', username: 'c' },
    },
  ];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SLOW = { timeout: 30_000 };

describe('trang Học viên', () => {
  it('có tiêu đề, thẻ số liệu chỉ đếm học viên, mặc định ở chế độ bảng', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Học viên' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Tổng học viên').nextElementSibling?.textContent).toBe('2');
    // Chế độ bảng: có <table>, chưa có thẻ lưới
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Nguyễn Văn An')).toBeTruthy();
    expect(screen.queryByText('HLV Cường')).toBeNull();
    // Cột lớp lấy từ danh sách thành viên nhóm (trước đây luôn trống)
    expect(screen.getByText('🏫 Lớp U10')).toBeTruthy();
  });

  it('chuyển danh sách ↔ lưới bằng ViewToggle', async () => {
    renderPage();
    await screen.findByRole('table', {}, SLOW);
    expect(screen.getByRole('button', { name: 'Danh sách' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưới' }));
    expect(screen.queryByRole('table')).toBeNull();
    // Thẻ học viên: tên, @username, đổi cấp độ, mời phụ huynh
    expect(screen.getByText('@an')).toBeTruthy();
    expect(screen.getByLabelText('Đổi cấp độ cho Nguyễn Văn An')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mời phụ huynh của Trần Thị Bình' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('thanh lọc dùng chung cho cả hai chế độ: tìm kiếm và lọc theo lớp', async () => {
    renderPage();
    await screen.findByRole('table', {}, SLOW);
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc tên đăng nhập'), {
      target: { value: 'bình' },
    });
    expect(screen.queryByText('Nguyễn Văn An')).toBeNull();
    expect(screen.getByText('Trần Thị Bình')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lưới' }));
    expect(screen.queryByText('@an')).toBeNull();
    expect(screen.getByText('@binh')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc tên đăng nhập'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Lớp / nhóm'), { target: { value: 'g1' } });
    expect(screen.getByText('@an')).toBeTruthy();
    expect(screen.queryByText('@binh')).toBeNull();
  });

  it('không khớp bộ lọc thì hiện trạng thái rỗng, không phải bảng trống', async () => {
    renderPage();
    await screen.findByRole('table', {}, SLOW);
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc tên đăng nhập'), {
      target: { value: 'không ai tên vậy' },
    });
    expect(screen.getByText('Không có học viên nào khớp bộ lọc.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('học viện chưa có học viên: trạng thái rỗng có nút thêm', async () => {
    members.data = [];
    renderPage();
    expect(await screen.findByText('Chưa có học viên nào', {}, SLOW)).toBeTruthy();
    const empty = screen.getByText('Chưa có học viên nào').closest('div') as HTMLElement;
    fireEvent.click(within(empty).getByRole('button', { name: 'Thêm học viên' }));
    expect(screen.getByRole('heading', { name: 'Thêm học viên' })).toBeTruthy();
  });

  it('menu Thêm học viên: thêm một hoặc nhập CSV', async () => {
    renderPage();
    await screen.findByRole('table', {}, SLOW);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm học viên' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nhập từ CSV' }));
    expect(screen.getByRole('heading', { name: 'Nhập từ CSV' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm học viên' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Thêm một học viên' }));
    expect(screen.getByRole('heading', { name: 'Thêm học viên' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('heading', { name: 'Thêm học viên' })).toBeNull();
  });
});
