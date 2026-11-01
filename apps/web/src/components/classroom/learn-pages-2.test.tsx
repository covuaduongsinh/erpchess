import type { MyAcademy } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route as ClassesRoute } from '../../routes/a.$slug.classes.index';
import { Route as CoursesRoute } from '../../routes/a.$slug.courses.index';
import { Route as PracticeRoute } from '../../routes/a.$slug.practice.index';

const data = vi.hoisted(() => ({
  courses: [] as unknown[],
  completions: [] as unknown[],
  classes: [] as unknown[],
  chapters: [] as unknown[],
}));

const ok = <T,>(d: T) => ({ data: d, isPending: false, error: null });
const mutation = { mutate: vi.fn(), isPending: false, error: null, data: null, reset: vi.fn() };

vi.mock('@erpchess/api/react', () => ({
  useCourses: () => ok(data.courses),
  useLevels: () => ok([{ id: 'l1', name: 'Gold Kiwi' }]),
  useCourseProgress: () => ok([]),
  useCourseCompletions: () => ok(data.completions),
  useCourseMutations: () => ({ create: mutation }),
  useClassrooms: () => ok(data.classes),
  useMembers: () => ok([]),
  usePracticeChapters: () => ok(data.chapters),
  usePracticeMutations: () => ({ createChapter: mutation }),
}));
vi.mock('./ClassroomForm', () => ({ ClassroomForm: () => <div>ClassroomForm</div> }));

vi.mock('@tanstack/react-router', async (orig) => {
  const actual = await orig<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, params: _p, search: _s, ...rest }: Record<string, unknown>) => (
      <a href={String(to)} {...(rest as object)}>
        {children as never}
      </a>
    ),
    useNavigate: () => vi.fn(),
  };
});

const course = (n: number, title: string, status: string) => ({
  id: `c${n}`,
  title,
  status,
  level_id: null,
  itemCount: 3,
});
const classroom = (n: number, title: string, kind: string) => ({
  id: `k${n}`,
  title,
  kind,
  minutes: 60,
  starts_at: '2026-05-10T08:00:00Z',
  coach_id: null,
  is_public: false,
  attendance: [],
});
const chapter = (n: number, title: string, positionCount: number) => ({
  id: `p${n}`,
  title,
  positionCount,
  visibility: 'academy',
});

function renderRoute(route: { options: { component?: unknown } }, role: AcademyRole = 'owner') {
  const Page = route.options.component as ComponentType;
  const academy = { id: 'a1', slug: 'clb', name: 'CLB', role } as unknown as MyAcademy;
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AcademyContext value={{ academy, session: { user: { id: 'u1' } } as never }}>
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </AcademyContext>
    </I18nextProvider>,
  );
}

beforeAll(async () => {
  for (const r of [CoursesRoute, ClassesRoute, PracticeRoute]) {
    await (r.options.component as { preload?: () => Promise<void> }).preload?.();
  }
}, 180_000);

beforeEach(() => {
  data.courses = [
    course(1, 'Khai cuộc nhập môn', 'published'),
    course(2, 'Tàn cuộc nâng cao', 'draft'),
  ];
  data.completions = [{ course_id: 'c1', student_id: 'u1' }];
  data.classes = [
    classroom(1, 'Lớp U10 tối thứ Hai', 'online'),
    classroom(2, 'Lớp U12 chiều thứ Tư', 'offline'),
    classroom(3, 'Lớp U10 sáng thứ Bảy', 'online'),
  ];
  data.chapters = [chapter(1, 'Khai cuộc Ý', 12), chapter(2, 'Tàn cuộc Xe', 8)];
});

afterEach(() => cleanup());
const SLOW = { timeout: 30_000 };

/** Giá trị của thẻ số liệu có nhãn `label` (nhãn có thể trùng chữ với phần tử khác trong trang). */
function stat(label: string): string | null | undefined {
  const el = screen
    .getAllByText(label)
    .find((e) => e.previousElementSibling?.className.includes('text-2xl'));
  return el?.previousElementSibling?.textContent;
}

describe('trang Khoá học', () => {
  it('thẻ số liệu, tìm kiếm và chip trạng thái cho staff', async () => {
    renderRoute(CoursesRoute);
    expect(await screen.findByRole('heading', { level: 1, name: 'Khoá học' }, SLOW)).toBeTruthy();
    expect(stat('Tổng số khoá học')).toBe('2');
    expect(stat('Đã xuất bản')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Bản nháp' }));
    expect(screen.queryByText('Khai cuộc nhập môn')).toBeNull();
    expect(screen.getByText('Tàn cuộc nâng cao')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    fireEvent.change(screen.getByPlaceholderText('Tìm khoá học theo tên'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Không có mục nào khớp bộ lọc.')).toBeTruthy();
  });

  it('học viên thấy số khoá đã hoàn thành và không có chip trạng thái', async () => {
    renderRoute(CoursesRoute, 'student');
    await screen.findByText('Khai cuộc nhập môn', {}, SLOW);
    expect(stat('Đã hoàn thành')).toBe('1');
    expect(screen.queryByRole('button', { name: 'Bản nháp' })).toBeNull();
  });

  it('chưa có khoá học: trạng thái rỗng nét đứt', async () => {
    data.courses = [];
    const { container } = renderRoute(CoursesRoute);
    await screen.findByText('Chưa có khoá học nào.', {}, SLOW);
    expect(container.querySelector('[data-dashed="true"]')).toBeTruthy();
  });
});

describe('trang Lớp học', () => {
  it('đếm buổi trực tuyến / trực tiếp và tìm theo tên', async () => {
    renderRoute(ClassesRoute);
    expect(await screen.findByRole('heading', { level: 1, name: 'Buổi học' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Số buổi trong khoảng').previousElementSibling?.textContent).toBe('3');
    expect(screen.getByText('Trực tuyến').previousElementSibling?.textContent).toBe('2');
    expect(
      screen.getByText('Trực tiếp', { selector: 'span' }).previousElementSibling?.textContent,
    ).toBe('1');
    fireEvent.change(screen.getByPlaceholderText('Tìm buổi học theo tên'), {
      target: { value: 'u12' },
    });
    expect(screen.queryByText('Lớp U10 tối thứ Hai')).toBeNull();
    expect(screen.getByText('Lớp U12 chiều thứ Tư')).toBeTruthy();
    expect(screen.getByText('Số buổi trong khoảng').previousElementSibling?.textContent).toBe('1');
  });

  it('phân trang và tab Của tôi chỉ dành cho staff', async () => {
    data.classes = Array.from({ length: 23 }, (_, i) => classroom(i, `Buổi ${i}`, 'online'));
    renderRoute(ClassesRoute);
    await screen.findByText('1–10 / 23', {}, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Trang cuối' }));
    expect(screen.getByText('21–23 / 23')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    cleanup();
    renderRoute(ClassesRoute, 'student');
    await screen.findByText('1–10 / 23', {}, SLOW);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Xuất CSV' })).toBeNull();
  });

  it('khoảng ngày chỉ nhận khi đủ hai đầu; rỗng có CTA tạo cho staff', async () => {
    renderRoute(ClassesRoute);
    const from = (await screen.findByLabelText('Từ ngày', {}, SLOW)) as HTMLInputElement;
    const before = from.value;
    fireEvent.change(from, { target: { value: '' } });
    expect(from.value).toBe(before);
    cleanup();
    data.classes = [];
    renderRoute(ClassesRoute);
    const title = await screen.findByText('Chưa có buổi học nào trong khoảng này.', {}, SLOW);
    expect(within(title.closest('div') as HTMLElement).getByRole('button')).toBeTruthy();
  });
});

describe('trang Luyện tập', () => {
  it('thẻ số liệu thật và tìm chương', async () => {
    renderRoute(PracticeRoute);
    expect(await screen.findByRole('heading', { level: 1, name: 'Luyện tập' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Tổng số chương').previousElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Tổng số thế cờ').previousElementSibling?.textContent).toBe('20');
    fireEvent.change(screen.getByPlaceholderText('Tìm chương theo tên'), {
      target: { value: 'xe' },
    });
    expect(screen.queryByText('Khai cuộc Ý')).toBeNull();
    expect(screen.getByText('Tàn cuộc Xe')).toBeTruthy();
  });

  it('chưa có chương: trạng thái rỗng; học viên không có nút tạo', async () => {
    data.chapters = [];
    renderRoute(PracticeRoute, 'student');
    await screen.findByText('Chưa có chương luyện tập nào.', {}, SLOW);
    expect(screen.queryByRole('button', { name: /Tạo chương/ })).toBeNull();
  });
});
