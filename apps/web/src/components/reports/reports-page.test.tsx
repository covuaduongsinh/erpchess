import type { MyAcademy } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route } from '../../routes/a.$slug.reports';

const summary = (studentId: string, displayName: string, username: string) => ({
  studentId,
  displayName,
  username,
  assignmentsCompleted: 1,
  assignmentsTotal: 2,
  quizAvgScore: 8,
  quizCompleted: 1,
  attendanceRate: 90,
  sessionsPresent: 9,
  sessionsTotal: 10,
  gamesTotal: 3,
  gamesWdl: '1/1/1',
  blitzRating: 1000,
  rapidRating: 1000,
  classicalRating: 1000,
});

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  downloadCsv: vi.fn(),
  batchIds: undefined as string[] | undefined,
  summaryCalls: [] as unknown[][],
  members: [] as unknown[],
}));

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  useNavigate: () => h.navigate,
}));
vi.mock('../../lib/download', () => ({ downloadCsv: h.downloadCsv }));
vi.mock('@erpchess/api/react', () => ({
  useMembers: () => ({ data: h.members, isPending: false, error: null }),
  useGroups: () => ({
    data: [
      { id: 'g1', name: 'Batch tối', kind: 'batch' },
      { id: 'g2', name: 'Nhóm U10', kind: 'group' },
    ],
  }),
  useLevels: () => ({ data: [{ id: 'l1', name: 'Cơ bản' }] }),
  useGroupStudentIds: () => ({ data: h.batchIds }),
  useAcademyStudentsReport: () => ({
    data: [summary('s1', 'Nguyễn Văn An', 'an'), summary('s2', 'Trần Thị Bình', 'binh')],
    isPending: false,
    error: null,
  }),
  useStudentReportSummary: (...args: unknown[]) => {
    h.summaryCalls.push(args);
    return { data: {}, isPending: false, error: null };
  },
  useStudentReportDetails: () => ({
    data: { student: { username: 'an' } },
    isPending: false,
    error: null,
  }),
}));
vi.mock('./ReportViews', () => ({
  AllStudentsReportView: ({
    students,
    onSelectStudent,
  }: {
    students: { studentId: string }[];
    onSelectStudent: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onSelectStudent('s2')}>
      {`Bảng ${students.length} học viên`}
    </button>
  ),
  SingleStudentReportView: () => <div>Chi tiết báo cáo</div>,
}));
vi.mock('./PrintableReportCard', () => ({ PrintableReportCard: () => null }));

const member = (id: string, name: string, username: string, role = 'student') => ({
  role,
  levelId: 'l1',
  profile: { id, display_name: name, username },
});

function renderPage(role: AcademyRole = 'owner', userId = 'u-owner', fideEnabled = false) {
  const Page = Route.options.component as ComponentType;
  const academy = {
    id: 'a1',
    slug: 'clb',
    name: 'CLB',
    role,
    logo_url: null,
    contact: {},
    fide_enabled: fideEnabled,
  } as unknown as MyAcademy;
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AcademyContext value={{ academy, session: { user: { id: userId } } as never }}>
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </AcademyContext>
    </I18nextProvider>,
  );
}

const SLOW = { timeout: 30_000 };

beforeAll(async () => {
  const page = Route.options.component as { preload?: () => Promise<void> };
  await page.preload?.();
}, 180_000);

beforeEach(() => {
  h.navigate.mockClear();
  h.downloadCsv.mockClear();
  h.summaryCalls = [];
  h.batchIds = undefined;
  h.members = [
    member('s1', 'Nguyễn Văn An', 'an'),
    member('s2', 'Trần Thị Bình', 'binh'),
    member('u-owner', 'Chủ', 'owner', 'owner'),
  ];
  vi.spyOn(Route, 'useSearch').mockReturnValue({});
});
afterEach(() => cleanup());

const list = () => screen.getByRole('list', { name: 'Danh sách học viên' });

describe('trang Báo cáo theo học viên', () => {
  it('nhân sự: hai tab (Theo học viên mặc định), danh sách bên trái, lời nhắc bên phải', async () => {
    renderPage();
    expect(
      await screen.findByRole('tab', { name: 'Theo học viên', selected: true }, SLOW),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Toàn học viện' })).toBeTruthy();
    // chỉ học viên (không có chủ/HLV) trong danh sách
    expect(
      within(list())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['NNguyễn Văn An@an', 'TTrần Thị Bình@binh']);
    expect(screen.getByText('Chọn học viên để xem báo cáo')).toBeTruthy();
    expect(screen.queryByText('Chi tiết báo cáo')).toBeNull();
  });

  it('?student= mở báo cáo của học viên đó và tô học viên đang chọn', async () => {
    vi.spyOn(Route, 'useSearch').mockReturnValue({ student: 's1' });
    renderPage();
    expect(await screen.findByText('Chi tiết báo cáo', {}, SLOW)).toBeTruthy();
    expect(h.summaryCalls[0]?.slice(0, 2)).toEqual(['a1', 's1']);
    const current = within(list()).getByRole('button', { current: true });
    expect(current.textContent).toContain('Nguyễn Văn An');
    expect(screen.queryByText('Chọn học viên để xem báo cáo')).toBeNull();
  });

  it('FIDE: dòng FIDE của học viên chỉ hiện khi học viện bật FIDE và học viên có dữ liệu', async () => {
    h.members = [
      {
        ...member('s1', 'Nguyễn Văn An', 'an'),
        fide: { id: '12345678', standard: 1800, rapid: null, blitz: null },
      },
      {
        ...member('s2', 'Trần Thị Bình', 'binh'),
        fide: { id: null, standard: null, rapid: null, blitz: null },
      },
    ];
    vi.spyOn(Route, 'useSearch').mockReturnValue({ student: 's1' });
    const { unmount } = renderPage('owner', 'u-owner', true);
    expect(
      await screen.findByText('FIDE: ID FIDE 12345678 · Standard 1800', {}, SLOW),
    ).toBeTruthy();
    unmount();
    renderPage('owner', 'u-owner', false);
    expect(await screen.findByText('Chi tiết báo cáo', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText(/FIDE:/)).toBeNull();
    cleanup();
    vi.spyOn(Route, 'useSearch').mockReturnValue({ student: 's2' });
    renderPage('owner', 'u-owner', true);
    expect(await screen.findByText('Chi tiết báo cáo', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText(/FIDE:/)).toBeNull();
  });

  it('?student= không thuộc học viện thì coi như chưa chọn', async () => {
    vi.spyOn(Route, 'useSearch').mockReturnValue({ student: 'khong-co' });
    renderPage();
    expect(await screen.findByText('Chọn học viên để xem báo cáo', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('Chi tiết báo cáo')).toBeNull();
  });

  it('chọn học viên đổi URL; nút quay lại (màn hẹp) bỏ ?student=', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Trần Thị Bình/ }, SLOW));
    expect(h.navigate).toHaveBeenLastCalledWith({ search: { student: 's2' } });
    cleanup();
    vi.spyOn(Route, 'useSearch').mockReturnValue({ student: 's2' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Danh sách học viên' }, SLOW));
    expect(h.navigate).toHaveBeenLastCalledWith({ search: {} });
  });

  it('tìm học viên trong danh sách bên trái', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Tìm học viên…', {}, SLOW), {
      target: { value: 'bình' },
    });
    expect(within(list()).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Nguyễn Văn An')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tìm học viên…'), { target: { value: 'zzz' } });
    expect(screen.getByText('Không có học viên nào.')).toBeTruthy();
  });

  it('lọc theo batch chỉ giữ học viên của batch', async () => {
    h.batchIds = ['s2'];
    renderPage();
    fireEvent.change(await screen.findByLabelText('Lớp học (Batch)', {}, SLOW), {
      target: { value: 'g1' },
    });
    expect(within(list()).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Trần Thị Bình')).toBeTruthy();
  });

  it('tab Toàn học viện đổi ?view=academy; ở đó có bảng và Xuất CSV toàn học viện', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Toàn học viện' }, SLOW));
    expect(h.navigate).toHaveBeenLastCalledWith({ search: { view: 'academy' } });
    cleanup();
    vi.spyOn(Route, 'useSearch').mockReturnValue({ view: 'academy' });
    renderPage();
    expect(
      await screen.findByRole('tab', { name: 'Toàn học viện', selected: true }, SLOW),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xuất CSV toàn học viện' }));
    expect(h.downloadCsv).toHaveBeenCalledTimes(1);
    expect(String(h.downloadCsv.mock.calls[0]?.[0])).toMatch(
      /^bao-cao-hoc-vien-clb-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    // chọn một học viên trong bảng thì sang tab Theo học viên với ?student=
    fireEvent.click(screen.getByRole('button', { name: 'Bảng 2 học viên' }));
    expect(h.navigate).toHaveBeenLastCalledWith({ search: { student: 's2' } });
  });

  it('khoảng ngày: nút nhanh có aria-pressed; Tuỳ chỉnh hiện hai ô ngày', async () => {
    renderPage();
    const all = await screen.findByRole('button', { name: 'Toàn thời gian' }, SLOW);
    expect(all.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Tháng này' }));
    expect(screen.getByRole('button', { name: 'Tháng này' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tuỳ chỉnh' }));
    expect(screen.getByLabelText('Từ ngày')).toBeTruthy();
    expect(screen.getByLabelText('Đến ngày')).toBeTruthy();
  });

  it('học viên: vào thẳng báo cáo của mình, không tab và không danh sách', async () => {
    h.members = [member('s1', 'Nguyễn Văn An', 'an')];
    renderPage('student', 's1');
    expect(await screen.findByText('Chi tiết báo cáo', {}, SLOW)).toBeTruthy();
    expect(h.summaryCalls[0]?.slice(0, 2)).toEqual(['a1', 's1']);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Danh sách học viên' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xuất CSV toàn học viện' })).toBeNull();
  });

  it('phụ huynh có một con: vào thẳng báo cáo của con; không có tab và không xuất CSV toàn học viện', async () => {
    h.members = [member('s1', 'Nguyễn Văn An', 'an')];
    renderPage('parent', 'p1');
    expect(await screen.findByText('Chi tiết báo cáo', {}, SLOW)).toBeTruthy();
    expect(h.summaryCalls[0]?.slice(0, 2)).toEqual(['a1', 's1']);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xuất CSV toàn học viện' })).toBeNull();
  });

  it('phụ huynh nhiều con: phải chọn một con, chưa chọn thì hiện lời nhắc', async () => {
    h.members = [member('s1', 'Nguyễn Văn An', 'an'), member('s2', 'Trần Thị Bình', 'binh')];
    renderPage('parent', 'p1');
    expect(await screen.findByText('Chọn học viên để xem báo cáo', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('Chi tiết báo cáo')).toBeNull();
  });

  it('validateSearch chỉ nhận student và view=academy', () => {
    const v = Route.options.validateSearch as (s: Record<string, unknown>) => unknown;
    expect(v({ student: 'abc', view: 'academy', lung: 1 })).toEqual({
      student: 'abc',
      view: 'academy',
    });
    expect(v({ student: '', view: 'khac' })).toEqual({});
    expect(v({})).toEqual({});
  });
});
