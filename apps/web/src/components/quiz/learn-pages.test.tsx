import type { MyAcademy } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route as AssignmentsRoute } from '../../routes/a.$slug.assignments.index';
import { Route as QuizzesRoute } from '../../routes/a.$slug.quizzes.index';
import { Route as StudiesRoute } from '../../routes/a.$slug.studies.index';

const data = vi.hoisted(() => ({
  quizzes: [] as unknown[],
  assignments: [] as unknown[],
  studies: { mine: [] as unknown[], academy: [] as unknown[], public: [] as unknown[] },
  started: null as null | { total: number; open: number; started: number },
  board: [] as unknown[],
}));

const ok = <T,>(d: T) => ({ data: d, isPending: false, error: null });
const mutation = { mutate: vi.fn(), isPending: false, error: null, data: null, reset: vi.fn() };

vi.mock('@erpchess/api/react', () => ({
  useQuizzes: () => ok(data.quizzes),
  useQuizStarted: (academyId: string | undefined) => ({
    data: academyId ? data.started : undefined,
  }),
  useAcademyQuizBoard: () => ok(data.board),
  useAssignments: () => ok(data.assignments),
  useProgress: () => ok([]),
  useStudies: (o: { scope: 'mine' | 'academy' | 'public' }) => ok(data.studies[o.scope]),
  useCollections: () => ok([]),
  useCollectionMutations: () => ({ create: mutation, toggle: mutation, remove: mutation }),
  useStudyMutations: () => ({ remove: mutation }),
}));
vi.mock('./QuizSchedulesPanel', () => ({ QuizSchedulesPanel: () => <div>SchedulesPanel</div> }));
vi.mock('./AutoQuiz', () => ({ AutoQuiz: () => <div>AutoQuizForm</div> }));
vi.mock('../assign/Exercises', () => ({ Exercises: () => <div>ExercisesList</div> }));
vi.mock('../study/LichessImportDialog', () => ({ LichessImportDialog: () => null }));

// Mốc ngày rơi vào quá khứ để trạng thái quiz do domain tính ổn định
const quiz = (n: number, title: string, created: string) => ({
  id: `q${n}`,
  title,
  created_at: created,
  starts_at: '2020-01-01T00:00:00Z',
  due_at: '2099-01-01T00:00:00Z',
  open_to_all: true,
  itemCount: 5,
});
const study = (n: number, title: string, created: string) => ({
  id: `s${n}`,
  title,
  description: '',
  created_at: created,
  academy_id: 'a1',
  created_by: 'u1',
  visibility: 'academy',
  activityCount: 3,
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

beforeAll(async () => {
  for (const r of [QuizzesRoute, AssignmentsRoute, StudiesRoute]) {
    await (r.options.component as { preload?: () => Promise<void> }).preload?.();
  }
}, 60_000);

beforeEach(() => {
  data.quizzes = [
    quiz(1, 'Chiến thuật cơ bản', '2026-05-10T08:00:00'),
    quiz(2, 'Tàn cuộc Tốt', '2026-04-01T08:00:00'),
  ];
  data.started = { total: 4, open: 2, started: 1 };
  data.board = [
    { studentId: 's1', displayName: 'An', avatarUrl: null, points: 18, correct: 2, completed: 1 },
    { studentId: 's2', displayName: 'Bình', avatarUrl: null, points: 10, correct: 1, completed: 0 },
    { studentId: 's3', displayName: 'Chi', avatarUrl: null, points: 0, correct: 0, completed: 0 },
  ];
  data.assignments = [
    {
      id: 'a1',
      title: 'Bài tập mở màn',
      created_at: '2026-05-01T00:00:00Z',
      due_at: null,
      itemCount: 4,
      targets: [],
    },
    {
      id: 'a2',
      title: 'Chiếu hết 2 nước',
      created_at: '2026-05-02T00:00:00Z',
      due_at: null,
      itemCount: 6,
      targets: [],
    },
  ];
  data.studies = {
    mine: [study(1, 'Khai cuộc Ý', '2026-05-01T00:00:00')],
    academy: [
      study(2, 'Tàn cuộc xe', '2026-05-02T00:00:00'),
      study(3, 'Chiến thuật ghim', '2026-04-02T00:00:00'),
    ],
    public: [],
  };
});

afterEach(() => cleanup());
const SLOW = { timeout: 30_000 };

describe('trang Quiz', () => {
  it('thẻ số liệu thật, tìm kiếm, lọc trạng thái và khoảng ngày', async () => {
    renderRoute(QuizzesRoute);
    expect(await screen.findByRole('heading', { level: 1, name: 'Quiz' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Tổng số quiz').previousElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Chiến thuật cơ bản')).toBeTruthy();
    expect(screen.getByText('Tàn cuộc Tốt')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Tìm quiz theo tên'), {
      target: { value: 'tàn' },
    });
    expect(screen.queryByText('Chiến thuật cơ bản')).toBeNull();
    expect(screen.getByText('Tàn cuộc Tốt')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Tìm quiz theo tên'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-05-01' } });
    expect(screen.queryByText('Tàn cuộc Tốt')).toBeNull();
    expect(screen.getByText('Chiến thuật cơ bản')).toBeTruthy();

    // Không khớp: trạng thái rỗng, không phải danh sách trống
    fireEvent.change(screen.getByPlaceholderText('Tìm quiz theo tên'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Không có mục nào khớp bộ lọc.')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Tìm quiz theo tên'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đã đóng' }));
    expect(screen.getByText('Không có mục nào khớp bộ lọc.')).toBeTruthy();
  });

  it('phân trang theo số dòng mỗi trang', async () => {
    data.quizzes = Array.from({ length: 25 }, (_, i) =>
      quiz(
        i,
        `Quiz số ${String(i).padStart(2, '0')}`,
        `2026-05-${String(i + 1).padStart(2, '0')}T08:00:00`,
      ),
    );
    renderRoute(QuizzesRoute);
    await screen.findByRole('navigation', { name: 'Phân trang' }, SLOW);
    expect(screen.getByText('1–10 / 25')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('11–20 / 25')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Số dòng mỗi trang'), { target: { value: '50' } });
    expect(screen.getByText('1–25 / 25')).toBeTruthy();
  });

  it('chưa có quiz: trạng thái rỗng có nút tạo (staff) và không có (học viên)', async () => {
    data.quizzes = [];
    renderRoute(QuizzesRoute);
    const title = await screen.findByText('Chưa có quiz nào.', {}, SLOW);
    expect(within(title.closest('div') as HTMLElement).getByText('Tạo quiz')).toBeTruthy();
    cleanup();
    renderRoute(QuizzesRoute, 'student');
    const t2 = await screen.findByText('Chưa có quiz nào.', {}, SLOW);
    expect(within(t2.closest('div') as HTMLElement).queryByText('Tạo quiz')).toBeNull();
  });

  it('tab Quiz tự động (badge Mới) chỉ dành cho staff và mở lịch tự giao', async () => {
    renderRoute(QuizzesRoute);
    const auto = await screen.findByRole('tab', { name: /Quiz tự động/ }, SLOW);
    expect(within(auto).getByText('Mới')).toBeTruthy();
    fireEvent.click(auto);
    expect(screen.getByText('SchedulesPanel')).toBeTruthy();
    expect(screen.getByText('AutoQuizForm')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Tìm quiz theo tên')).toBeNull();
    cleanup();
    renderRoute(QuizzesRoute, 'student');
    await screen.findByText('Chiến thuật cơ bản', {}, SLOW);
    expect(screen.queryByRole('tab', { name: /Quiz tự động/ })).toBeNull();
  });
});

describe('trang Quiz: % đã bắt đầu và bảng xếp hạng (25g)', () => {
  it('nhân sự thấy thẻ Đã bắt đầu = 50% (1/2 quiz đang giao)', async () => {
    renderRoute(QuizzesRoute);
    await screen.findByRole('heading', { level: 1, name: 'Quiz' }, SLOW);
    const label = screen.getByText('Đã bắt đầu');
    expect(label.previousElementSibling?.textContent).toBe('50%');
    expect(screen.getByText('1/2 quiz đang giao đã có người làm')).toBeTruthy();
  });

  it('không có quiz nào đang giao thì hiện "—" thay vì 0% giả', async () => {
    data.started = { total: 3, open: 0, started: 0 };
    renderRoute(QuizzesRoute);
    await screen.findByText('Đã bắt đầu', {}, SLOW);
    expect(screen.getByText('Đã bắt đầu').previousElementSibling?.textContent).toBe('—');
    expect(screen.getByText('Chưa có quiz nào đang giao')).toBeTruthy();
  });

  it('học viên không thấy thẻ Đã bắt đầu', async () => {
    renderRoute(QuizzesRoute, 'student');
    await screen.findByText('Chiến thuật cơ bản', {}, SLOW);
    expect(screen.queryByText('Đã bắt đầu')).toBeNull();
  });

  it('tab Bảng xếp hạng có cho mọi vai trò, hiện podium và bỏ người 0 điểm', async () => {
    renderRoute(QuizzesRoute, 'student');
    const tab = await screen.findByRole('tab', { name: 'Bảng xếp hạng' }, SLOW);
    fireEvent.click(tab);
    expect(screen.getByTestId('podium')).toBeTruthy();
    expect(screen.getByText('An')).toBeTruthy();
    expect(screen.getByText('Bình')).toBeTruthy();
    expect(screen.queryByText('Chi')).toBeNull();
    expect(screen.queryByPlaceholderText('Tìm quiz theo tên')).toBeNull();
  });

  it('bảng xếp hạng có chọn khoảng Tuần/Tháng/6 tháng; rỗng thì có trạng thái rỗng', async () => {
    data.board = [];
    renderRoute(QuizzesRoute);
    fireEvent.click(await screen.findByRole('tab', { name: 'Bảng xếp hạng' }, SLOW));
    expect(screen.getByRole('tab', { name: 'Tuần này', selected: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Tháng này' }));
    expect(screen.getByRole('tab', { name: 'Tháng này', selected: true })).toBeTruthy();
    expect(screen.getByText('Chưa có ai ghi điểm quiz trong khoảng này.')).toBeTruthy();
  });
});

describe('trang Bài tập', () => {
  it('tab pills có số đếm, tìm kiếm và sắp xếp', async () => {
    renderRoute(AssignmentsRoute);
    const assigned = await screen.findByRole('tab', { name: /Đã giao/ }, SLOW);
    expect(within(assigned).getByText('2')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Tìm bài tập theo tên'), {
      target: { value: 'chiếu' },
    });
    expect(screen.queryByText('Bài tập mở màn')).toBeNull();
    expect(screen.getByText('Chiếu hết 2 nước')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Tìm bài tập theo tên'), {
      target: { value: 'không có' },
    });
    expect(screen.getByText('Không có mục nào khớp bộ lọc.')).toBeTruthy();
  });

  it('tab Bài tập ↔ kho bài tập; học viên không thấy tab', async () => {
    renderRoute(AssignmentsRoute);
    const tabs = await screen.findAllByRole('tab', {}, SLOW);
    expect(tabs).toHaveLength(2);
    fireEvent.click(tabs[1] as HTMLElement);
    expect(screen.getByText('ExercisesList')).toBeTruthy();
    cleanup();
    renderRoute(AssignmentsRoute, 'student');
    await screen.findByText('Bài tập mở màn', {}, SLOW);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('chưa có bài tập: trạng thái rỗng viền nét đứt', async () => {
    data.assignments = [];
    const { container } = renderRoute(AssignmentsRoute);
    await screen.findByText('Chưa có bài tập nào', {}, SLOW);
    expect(container.querySelector('[data-dashed="true"]')).toBeTruthy();
  });
});

describe('trang Học liệu', () => {
  it('pills theo nguồn có số đếm và đổi nguồn', async () => {
    renderRoute(StudiesRoute);
    const mine = await screen.findByRole('tab', { name: /Của tôi/ }, SLOW);
    expect(within(mine).getByText('1')).toBeTruthy();
    expect(within(screen.getByRole('tab', { name: /Học viện/ })).getByText('2')).toBeTruthy();
    expect(screen.getByText('Khai cuộc Ý')).toBeTruthy();
    expect(screen.getByText('1 học liệu')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Học viện/ }));
    expect(screen.getByText('Tàn cuộc xe')).toBeTruthy();
    expect(screen.getByText('2 học liệu')).toBeTruthy();
  });

  it('tìm kiếm, sắp xếp và chuyển lưới/danh sách', async () => {
    renderRoute(StudiesRoute);
    await screen.findByRole('tab', { name: /Học viện/ }, SLOW);
    fireEvent.click(screen.getByRole('tab', { name: /Học viện/ }));
    fireEvent.change(screen.getByPlaceholderText('Tìm học liệu theo tên'), {
      target: { value: 'ghim' },
    });
    expect(screen.queryByText('Tàn cuộc xe')).toBeNull();
    expect(screen.getByText('Chiến thuật ghim')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Tìm học liệu theo tên'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưới' }));
    expect(document.querySelector('ul.grid')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    expect(document.querySelector('ul.grid')).toBeNull();
  });

  it('tab Bộ sưu tập chỉ dành cho staff; nút đầu trang cho staff', async () => {
    renderRoute(StudiesRoute);
    const tab = await screen.findByRole('tab', { name: /Bộ sưu tập/ }, SLOW);
    fireEvent.click(tab);
    expect(screen.queryByPlaceholderText('Tìm học liệu theo tên')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nhập từ Lichess' })).toBeTruthy();
    cleanup();
    renderRoute(StudiesRoute, 'student');
    await screen.findByText('Tàn cuộc xe', {}, SLOW);
    expect(screen.queryByRole('tab', { name: /Bộ sưu tập/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nhập từ Lichess' })).toBeNull();
  });
});
