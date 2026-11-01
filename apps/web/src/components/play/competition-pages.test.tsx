import type { MyAcademy } from '@erpchess/api';
import type { AcademyRole } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ComponentType, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { Route as PlayRoute } from '../../routes/a.$slug.play.index';
import { Route as SimulsRoute } from '../../routes/a.$slug.simuls.index';
import { Route as TournamentsRoute } from '../../routes/a.$slug.tournaments.index';

const data = vi.hoisted(() => ({
  tournaments: [] as unknown[],
  simuls: [] as unknown[],
  today: [] as unknown[],
  live: [] as unknown[],
  history: [] as unknown[],
  members: [] as unknown[],
}));

const ok = <T,>(d: T) => ({ data: d, isPending: false, error: null });
const mutation = { mutate: vi.fn(), isPending: false, error: null, data: null, reset: vi.fn() };

vi.mock('@erpchess/api/react', () => ({
  useTournaments: () => ok(data.tournaments),
  useSimuls: () => ok(data.simuls),
  useSimulMutations: () => ({ create: mutation }),
  useMembers: () => ok(data.members),
  useGameMutations: () => ({ challenge: mutation, pair: mutation }),
  // Gọi với { status: ['active'] } / { since } / { status: ['finished'] }
  usePlayGames: (_academyId: string, o: { status?: string[]; since?: Date }) =>
    ok(o.status?.[0] === 'active' ? data.live : o.since ? data.today : data.history),
}));
vi.mock('./QuickPairCard', () => ({ QuickPairCard: () => <div>QuickPairCard</div> }));
vi.mock('../assign/TargetPicker', () => ({ TargetPicker: () => null }));

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

const tournament = (n: number, title: string, status: string, players: string[], when: string) => ({
  id: `t${n}`,
  title,
  status,
  playerIds: players,
  location: 'CLB Hà Nội',
  format: 'swiss',
  base_ms: 300_000,
  inc_ms: 0,
  starts_at: when,
  created_at: when,
});
const simul = (n: number, title: string, status: string, when: string) => ({
  id: `s${n}`,
  title,
  description: '',
  status,
  host_id: 'u1',
  boardCount: 8,
  starts_at: when,
  created_at: when,
});

function renderRoute(
  route: { options: { component?: unknown } },
  role: AcademyRole = 'owner',
  online: unknown[] = [],
) {
  const Page = route.options.component as ComponentType;
  const academy = { id: 'a1', slug: 'clb', name: 'CLB', role } as unknown as MyAcademy;
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AcademyContext
        value={{ academy, session: { user: { id: 'u1' } } as never, online: online as never }}
      >
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </AcademyContext>
    </I18nextProvider>,
  );
}

beforeAll(async () => {
  for (const r of [PlayRoute, SimulsRoute, TournamentsRoute]) {
    await (r.options.component as { preload?: () => Promise<void> }).preload?.();
  }
}, 60_000);

beforeEach(() => {
  data.tournaments = [
    tournament(1, 'Giải Mùa Xuân', 'active', ['a', 'b', 'c'], '2026-05-10T08:00:00'),
    tournament(2, 'Giải Mùa Hè', 'upcoming', ['a'], '2026-07-01T08:00:00'),
    tournament(3, 'Giải Khai Trường', 'finished', ['a', 'b'], '2026-03-01T08:00:00'),
  ];
  data.simuls = [
    simul(1, 'Simul Đại Kiện Tướng', 'upcoming', '2026-06-01T08:00:00'),
    simul(2, 'Simul Tết', 'finished', '2026-02-01T08:00:00'),
  ];
  data.members = [
    { role: 'student', levelId: null, profile: { id: 's1', display_name: 'An', username: 'an' } },
    { role: 'student', levelId: null, profile: { id: 's2', display_name: 'Bình', username: 'b' } },
  ];
  data.today = [
    { id: 'g1', white_id: 'u1', black_id: 's1', created_at: '2026-05-10T08:00:00' },
    { id: 'g2', white_id: 's2', black_id: 'u1', created_at: '2026-05-10T09:00:00' },
    { id: 'g3', white_id: 'u1', black_id: 's2', created_at: '2026-05-10T10:00:00' },
    { id: 'g4', white_id: 's1', black_id: 's2', created_at: '2026-05-10T11:00:00' },
  ];
  data.live = [];
  data.history = [];
});

afterEach(() => cleanup());
const SLOW = { timeout: 30_000 };

/** Giá trị của thẻ số liệu có nhãn `label`, cả hai kiểu inline và stacked. */
function stat(label: string): string | null | undefined {
  const el = screen.getAllByText(label).find((e) => {
    const card = e.closest('[data-variant]');
    return !!card && card.textContent?.includes(label);
  });
  const card = el?.closest('[data-variant]');
  const value = card?.querySelector('.text-2xl, .text-3xl');
  return value?.textContent;
}

describe('trang Giải đấu', () => {
  it('thẻ số liệu theo trạng thái, tìm kiếm và chip trạng thái', async () => {
    renderRoute(TournamentsRoute);
    expect(await screen.findByRole('heading', { level: 1, name: 'Giải đấu' }, SLOW)).toBeTruthy();
    expect(stat('Tổng')).toBe('3');
    expect(stat('Đang diễn ra')).toBe('1');
    expect(stat('Sắp tới')).toBe('1');
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên, người chơi hoặc địa điểm'), {
      target: { value: 'hè' },
    });
    expect(screen.queryByText('Giải Mùa Xuân')).toBeNull();
    expect(screen.getByText('Giải Mùa Hè')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên, người chơi hoặc địa điểm'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đã xong' }));
    expect(screen.getByText('Giải Khai Trường')).toBeTruthy();
    expect(screen.queryByText('Giải Mùa Hè')).toBeNull();
  });

  it('lọc khoảng ngày và sắp xếp theo số người chơi', async () => {
    renderRoute(TournamentsRoute);
    await screen.findByText('Giải Mùa Xuân', {}, SLOW);
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-05-01' } });
    expect(screen.queryByText('Giải Khai Trường')).toBeNull();
    expect(screen.getByText('Giải Mùa Hè')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Sắp xếp'), { target: { value: 'players' } });
    const links = screen.getAllByRole('link').map((l) => l.textContent);
    expect(links.indexOf('Giải Mùa Xuân')).toBeLessThan(links.indexOf('Giải Khai Trường'));
    expect(links.indexOf('Giải Khai Trường')).toBeLessThan(links.indexOf('Giải Mùa Hè'));
  });

  it('bốn chế độ xem: danh sách, lưới, bảng, lịch', async () => {
    renderRoute(TournamentsRoute);
    await screen.findByText('Giải Mùa Xuân', {}, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Lưới' }));
    expect(document.querySelector('ul.grid')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bảng' }));
    expect(screen.getByRole('table')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lịch' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeTruthy();
  });

  it('phân trang và trạng thái rỗng (CTA tạo giải chỉ staff)', async () => {
    data.tournaments = Array.from({ length: 12 }, (_, i) =>
      tournament(i, `Giải số ${i}`, 'finished', ['a'], '2026-03-01T08:00:00'),
    );
    renderRoute(TournamentsRoute);
    await screen.findByText('1–10 / 12', {}, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('11–12 / 12')).toBeTruthy();
    cleanup();
    data.tournaments = [];
    renderRoute(TournamentsRoute);
    const title = await screen.findByText('Chưa có giải nào.', {}, SLOW);
    expect(within(title.closest('div') as HTMLElement).getByText('Tạo giải')).toBeTruthy();
    cleanup();
    renderRoute(TournamentsRoute, 'student');
    const t2 = await screen.findByText('Chưa có giải nào.', {}, SLOW);
    expect(within(t2.closest('div') as HTMLElement).queryByText('Tạo giải')).toBeNull();
  });
});

describe('trang Simul', () => {
  it('thẻ số liệu, chip trạng thái và tìm kiếm', async () => {
    renderRoute(SimulsRoute);
    expect(await screen.findByRole('heading', { level: 1, name: 'Simul' }, SLOW)).toBeTruthy();
    expect(stat('Tổng')).toBe('2');
    expect(stat('Sắp tới')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Đã xong' }));
    expect(screen.queryByText('Simul Đại Kiện Tướng')).toBeNull();
    expect(screen.getByText('Simul Tết')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc mô tả'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Không có mục nào khớp bộ lọc.')).toBeTruthy();
  });

  it('chế độ lưới và nút tạo chỉ cho staff', async () => {
    renderRoute(SimulsRoute);
    await screen.findByText('Simul Tết', {}, SLOW);
    expect(screen.getByRole('button', { name: /Tạo simul/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lịch' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lưới' }));
    expect(document.querySelector('ul.grid')).toBeTruthy();
    cleanup();
    renderRoute(SimulsRoute, 'student');
    await screen.findByText('Simul Tết', {}, SLOW);
    expect(screen.queryByRole('button', { name: /Tạo simul/ })).toBeNull();
  });
});

describe('trang Khu thi đấu', () => {
  it('staff: thẻ toàn học viện (hôm nay, đang diễn ra, đã xong hôm nay, học viên online)', async () => {
    data.live = [{ id: 'l1' }, { id: 'l2' }];
    data.today = [
      { id: 'g1', status: 'finished', white_id: 'u1', black_id: 's1' },
      { id: 'g2', status: 'finished', white_id: 's2', black_id: 's1' },
      { id: 'g3', status: 'active', white_id: 's1', black_id: 's2' },
    ];
    renderRoute(PlayRoute, 'owner', [
      { userId: 's1', name: 'An', role: 'student' },
      { userId: 'c9', name: 'HLV', role: 'coach' },
    ]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Chơi cờ' }, SLOW)).toBeTruthy();
    expect(stat('Ván hôm nay')).toBe('3');
    expect(stat('Đang diễn ra')).toBe('2');
    expect(stat('Đã xong hôm nay')).toBe('2');
    expect(stat('Học viên online')).toBe('1'); // chỉ tính học viên
    expect(screen.getAllByText('Toàn học viện')).toHaveLength(3);
    expect(screen.queryByText('Cầm Trắng')).toBeNull();
  });

  it('staff không còn thấy dãy 0/0 của Cầm Trắng/Cầm Đen khi tự mình không chơi', async () => {
    data.today = [{ id: 'g1', status: 'active', white_id: 's1', black_id: 's2' }];
    renderRoute(PlayRoute, 'coach');
    await screen.findByRole('heading', { level: 1, name: 'Chơi cờ' }, SLOW);
    expect(stat('Ván hôm nay')).toBe('1');
    expect(screen.queryByText('Cầm Đen')).toBeNull();
  });

  it('học viên: bốn thẻ cùng phạm vi "của tôi"', async () => {
    data.today = [
      { id: 'g1', status: 'finished', white_id: 'u1', black_id: 's1' },
      { id: 'g2', status: 'finished', white_id: 's2', black_id: 'u1' },
      { id: 'g3', status: 'active', white_id: 'u1', black_id: 's2' },
      { id: 'g4', status: 'active', white_id: 's1', black_id: 's2' }, // không phải của tôi
    ];
    data.history = [
      { id: 'h1', white_id: 'u1', black_id: 's1' },
      { id: 'h2', white_id: 's1', black_id: 's2' },
    ];
    renderRoute(PlayRoute, 'student');
    await screen.findByRole('heading', { level: 1, name: 'Chơi cờ' }, SLOW);
    expect(stat('Ván hôm nay của tôi')).toBe('3');
    expect(stat('Cầm Trắng')).toBe('2');
    expect(stat('Cầm Đen')).toBe('1');
    expect(stat('Tổng ván của tôi')).toBe('1');
    expect(screen.getAllByText('Ván của bạn hôm nay')).toHaveLength(3);
    expect(screen.getByText('Trong 50 ván kết thúc gần nhất')).toBeTruthy();
    expect(screen.queryByText('Toàn học viện')).toBeNull();
  });

  it('banner đánh với máy có liên kết tới bàn đấu máy và chip mức Elo thật', async () => {
    renderRoute(PlayRoute);
    const link = await screen.findByRole('link', { name: /Đánh với máy|Chơi với máy/ }, SLOW);
    expect(link.getAttribute('href')).toBe('/a/$slug/play/bot');
    expect(screen.getByText('Elo 800 – 2600+')).toBeTruthy();
    expect(screen.getByText('QuickPairCard')).toBeTruthy();
  });

  it('ba tab: học viên (có chấm online), lịch sử, ván đang diễn ra', async () => {
    renderRoute(PlayRoute, 'owner', [{ userId: 's2', name: 'Bình', role: 'student' }]);
    const students = await screen.findByRole('tab', { name: /Học viên/ }, SLOW);
    expect(students.getAttribute('aria-selected')).toBe('true');
    expect(within(students).getByText('2')).toBeTruthy();
    const roster = screen.getByText('Ngoại tuyến').closest('ul') as HTMLElement;
    // Học viên online xếp trước
    expect(within(roster).getAllByRole('listitem')[0]?.textContent).toContain('Bình');
    expect(within(roster).getByText('Đang online')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử ván' }));
    expect(screen.getByText('Chưa có ván nào.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Ván đang diễn ra/ }));
    expect(screen.getByText('Không có ván nào đang diễn ra.')).toBeTruthy();
  });

  it('cột phải: trạng thái rỗng khi không ai online; thách đấu khi có người online', async () => {
    renderRoute(PlayRoute);
    expect(await screen.findByText('Chưa có học viên nào online', {}, SLOW)).toBeTruthy();
    cleanup();
    renderRoute(PlayRoute, 'owner', [{ userId: 's1', name: 'An', role: 'student' }]);
    await screen.findByRole('button', { name: /Thách đấu/ }, SLOW);
    expect(screen.queryByText('Chưa có học viên nào online')).toBeNull();
  });

  it('nút Ghép cặp chỉ cho staff và bật/tắt biểu mẫu ghép cặp', async () => {
    renderRoute(PlayRoute);
    const pair = await screen.findByRole('button', { name: 'Ghép cặp' }, SLOW);
    expect(screen.queryByText('Ghép cặp học viên')).toBeNull();
    fireEvent.click(pair);
    expect(screen.getByText('Ghép cặp học viên')).toBeTruthy();
    fireEvent.click(pair);
    expect(screen.queryByText('Ghép cặp học viên')).toBeNull();
    cleanup();
    renderRoute(PlayRoute, 'student');
    await screen.findByRole('heading', { level: 1, name: 'Chơi cờ' }, SLOW);
    expect(screen.queryByRole('button', { name: 'Ghép cặp' })).toBeNull();
  });
});
