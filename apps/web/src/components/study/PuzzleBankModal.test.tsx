import type { PuzzleBankRow } from '@erpchess/domain';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bankRowToActivity, PuzzleBankModal } from './PuzzleBankModal';

const FEN = 'q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17';
const MOVES = 'e8d7 a2e6 d7d8 f7f8';
const row = (id: number, rating: number, over: Partial<PuzzleBankRow> = {}): PuzzleBankRow => ({
  id,
  lichessId: `p${id}`,
  fen: FEN,
  moves: MOVES,
  rating,
  popularity: 90,
  themes: ['mate', 'mateIn2', 'middlegame', 'short'],
  ...over,
});

const h = vi.hoisted(() => ({
  calls: [] as unknown[],
  page: { rows: [] as unknown[], total: 0 },
  pending: false,
  error: null as unknown,
  searchNow: vi.fn(),
}));

vi.mock('@erpchess/api/react', () => ({
  usePuzzleBankSearch: (filter: unknown) => {
    h.calls.push(filter);
    return { data: h.page, isPending: h.pending, error: h.error };
  },
  useSearchPuzzleBankNow: () => h.searchNow,
}));
vi.mock('../board/PreferredBoard', () => ({
  PreferredBoard: ({ fen, orientation }: { fen: string; orientation: string }) => (
    <div data-testid="board" data-fen={fen} data-orientation={orientation} />
  ),
}));

const SETTINGS = { points: 15, maxAttempts: 3, timeLimitS: 60, wrongPenalty: 2 };

function renderModal(onAdd = vi.fn(async () => {}), lng: 'vi' | 'en' = 'vi') {
  const onClose = vi.fn();
  render(
    <I18nextProvider i18n={createI18n(lng)}>
      <PuzzleBankModal settings={SETTINGS} onAdd={onAdd} onClose={onClose} />
    </I18nextProvider>,
  );
  return { onAdd, onClose };
}

const lastFilter = () => h.calls.at(-1) as Record<string, unknown>;

beforeEach(() => {
  h.calls = [];
  h.page = { rows: [row(1, 1000), row(2, 1500)], total: 25 };
  h.pending = false;
  h.error = null;
  h.searchNow = vi.fn();
});
afterEach(() => cleanup());

describe('bankRowToActivity', () => {
  it('đổi sang hoạt động puzzle: thế sau nước đầu của đối thủ, lời giải còn lại, cấu hình mặc định, chủ đề', () => {
    const a = bankRowToActivity(row(1, 1760), SETTINGS, 'Puzzle · rating 1760');
    expect(a).toMatchObject({
      kind: 'puzzle',
      title: 'Puzzle · rating 1760',
      points: 15,
      maxAttempts: 3,
      timeLimitS: 60,
      wrongPenalty: 2,
      topics: ['mate', 'mateIn2', 'middlegame', 'short'],
    });
    expect((a as { payload: { moves: string[] } }).payload.moves).toEqual(['a2e6', 'd7d8', 'f7f8']);
    expect((a as { payload: { fen: string } }).payload.fen.split(' ')[1]).toBe('w');
  });

  it('dữ liệu hỏng thì null', () => {
    expect(
      bankRowToActivity(row(1, 1000, { moves: 'e8d7 a2a8 d7d8 f7f8' }), SETTINGS, 't'),
    ).toBeNull();
    expect(bankRowToActivity(row(1, 1000, { fen: 'khong-phai-fen' }), SETTINGS, 't')).toBeNull();
  });

  it('cắt chủ đề quá nhiều/quá dài theo giới hạn của hoạt động (≤ 20 chủ đề, mỗi chủ đề ≤ 40 ký tự)', () => {
    const themes = Array.from({ length: 25 }, (_, i) => `t${i}${'x'.repeat(60)}`);
    const a = bankRowToActivity(row(1, 1000, { themes }), SETTINGS, 't') as { topics: string[] };
    expect(a.topics).toHaveLength(20);
    expect(a.topics.every((x) => x.length <= 40)).toBe(true);
  });
});

describe('PuzzleBankModal: kết quả và bộ lọc', () => {
  it('kho rỗng chưa lọc → hướng dẫn nạp; có lọc mà không khớp → "không có puzzle nào khớp"', () => {
    h.page = { rows: [], total: 0 };
    renderModal();
    expect(screen.getByText(/Kho puzzle chưa có dữ liệu/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đòn đôi (fork)' }));
    expect(screen.getByText('Không có puzzle nào khớp bộ lọc.')).toBeTruthy();
    expect(screen.queryByText(/Kho puzzle chưa có dữ liệu/)).toBeNull();
  });

  it('hiện bàn cờ nhỏ (thế sau nước đầu, hướng theo bên đi), rating, chủ đề tiếng Việt, tổng số', () => {
    renderModal();
    const boards = screen.getAllByTestId('board');
    expect(boards).toHaveLength(2);
    expect(boards[0]?.getAttribute('data-orientation')).toBe('w');
    expect(boards[0]?.getAttribute('data-fen')).toContain(' w ');
    expect(screen.getByText('Rating 1000')).toBeTruthy();
    expect(screen.getAllByText('Chiếu hết · Chiếu hết 2 nước · Trung cuộc · Ngắn')).toHaveLength(2);
    expect(screen.getByText('1–2 / 25 puzzle')).toBeTruthy();
  });

  it('tiếng Anh dùng nhãn chủ đề tiếng Anh', () => {
    renderModal(undefined, 'en');
    expect(screen.getAllByText('Checkmate · Mate in 2 · Middlegame · Short')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Fork' })).toBeTruthy();
  });

  it('chủ đề, rating, số nước đều được gửi vào truy vấn; đổi bộ lọc về trang đầu; xoá bộ lọc', () => {
    renderModal();
    expect(lastFilter()).toMatchObject({
      themes: [],
      ratingMin: null,
      ratingMax: null,
      movesMax: null,
      limit: 12,
      offset: 0,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(lastFilter()).toMatchObject({ offset: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'Đòn đôi (fork)' }));
    expect(
      screen.getByRole('button', { name: 'Đòn đôi (fork)' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(lastFilter()).toMatchObject({ themes: ['fork'], offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Ghim' }));
    fireEvent.change(screen.getByLabelText('Rating từ'), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText('Rating từ đến'), { target: { value: '1800' } });
    fireEvent.change(screen.getByLabelText('Số nước giải tối đa'), { target: { value: '3' } });
    expect(lastFilter()).toMatchObject({
      themes: ['fork', 'pin'],
      ratingMin: 1200,
      ratingMax: 1800,
      movesMax: 3,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }));
    expect(lastFilter()).toMatchObject({
      themes: [],
      ratingMin: null,
      ratingMax: null,
      movesMax: null,
    });
  });

  it('phân trang: Trước khoá ở trang đầu, Sau khoá ở trang cuối', () => {
    h.page = { rows: [row(1, 1000)], total: 12 };
    renderModal();
    expect((screen.getByRole('button', { name: 'Trước' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Sau' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lỗi tải kho (vd. chưa áp migration) hiện thông báo', () => {
    h.error = new Error('relation "puzzle_bank" does not exist');
    h.page = { rows: [], total: 0 };
    renderModal();
    expect(screen.getByRole('alert').textContent).toContain('puzzle_bank');
  });
});

describe('PuzzleBankModal: chọn và thêm', () => {
  it('chọn nhiều, đếm đã chọn, thêm theo thứ tự rating tăng dần với cấu hình mặc định, báo thành công và bỏ chọn', async () => {
    const { onAdd } = renderModal();
    fireEvent.click(screen.getByLabelText('Chọn puzzle p2 (rating 1500)'));
    fireEvent.click(screen.getByLabelText('Chọn puzzle p1 (rating 1000)'));
    expect(screen.getByText('Đã chọn 2 puzzle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm 2 puzzle' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Đã thêm 2 puzzle vào học liệu.'),
    );
    expect(onAdd).toHaveBeenCalledTimes(1);
    const inputs = (onAdd.mock.calls[0] as unknown as [Record<string, unknown>[]])[0];
    expect(inputs.map((i) => i.title)).toEqual(['Puzzle · rating 1000', 'Puzzle · rating 1500']);
    expect(inputs[0]).toMatchObject({ kind: 'puzzle', points: 15, maxAttempts: 3 });
    expect(screen.getByText('Đã chọn 0 puzzle')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Thêm 0 puzzle' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('lựa chọn giữ nguyên khi sang trang khác', () => {
    renderModal();
    fireEvent.click(screen.getByLabelText('Chọn puzzle p1 (rating 1000)'));
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(screen.getByText('Đã chọn 1 puzzle')).toBeTruthy();
  });

  it('thêm lỗi: hiện lỗi và GIỮ lựa chọn để thử lại; tiến độ báo từng puzzle', async () => {
    const progressSeen: number[] = [];
    const onAdd = vi.fn(async (_inputs: unknown[], progress: (n: number) => void) => {
      progress(1);
      progressSeen.push(1);
      throw new Error('mạng lỗi');
    });
    renderModal(onAdd as never);
    fireEvent.click(screen.getByLabelText('Chọn puzzle p1 (rating 1000)'));
    fireEvent.click(screen.getByLabelText('Chọn puzzle p2 (rating 1500)'));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm 2 puzzle' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('mạng lỗi'));
    expect(progressSeen).toEqual([1]);
    expect(screen.getByText('Đã chọn 2 puzzle')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('puzzle hỏng dữ liệu không chọn được (ô chọn bị khoá)', () => {
    h.page = { rows: [row(1, 1000, { moves: 'e8d7 a2a8 d7d8 f7f8' })], total: 1 };
    renderModal();
    expect(
      (screen.getByLabelText('Chọn puzzle p1 (rating 1000)') as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('Đóng gọi onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(
      within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Đóng' })[0] as HTMLElement,
    );
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PuzzleBankModal: chọn ngẫu nhiên trải đều rating (thay AI)', () => {
  it('lấy mẫu 100 puzzle từ vị trí ngẫu nhiên trong kết quả đang lọc rồi chọn N puzzle trải đều rating', async () => {
    const pool = Array.from({ length: 100 }, (_, i) => row(100 + i, 600 + i * 20));
    h.searchNow = vi
      .fn()
      .mockResolvedValueOnce({ rows: [pool[0]], total: 250 })
      .mockResolvedValueOnce({ rows: pool, total: 250 });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Đòn đôi (fork)' }));
    fireEvent.change(screen.getByLabelText('Số puzzle'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngẫu nhiên, trải đều rating' }));
    await waitFor(() => expect(screen.getByText('Đã chọn 5 puzzle')).toBeTruthy());
    const [first, second] = h.searchNow.mock.calls as unknown as [Record<string, unknown>][];
    expect(first?.[0]).toMatchObject({ themes: ['fork'], limit: 1, offset: 0 });
    expect(second?.[0]).toMatchObject({ themes: ['fork'], limit: 100 });
    expect(Number(second?.[0]?.offset)).toBeGreaterThanOrEqual(0);
    expect(Number(second?.[0]?.offset)).toBeLessThanOrEqual(150);
    // thêm vào study: rating của 5 puzzle trải rộng khắp khoảng (không dồn về một đầu)
    const { onAdd } = { onAdd: vi.fn(async () => {}) };
    cleanup();
    h.searchNow = vi
      .fn()
      .mockResolvedValueOnce({ rows: [pool[0]], total: 250 })
      .mockResolvedValueOnce({ rows: pool, total: 250 });
    renderModal(onAdd);
    fireEvent.change(screen.getByLabelText('Số puzzle'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngẫu nhiên, trải đều rating' }));
    await waitFor(() => expect(screen.getByText('Đã chọn 5 puzzle')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Thêm 5 puzzle' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const ratings = (onAdd.mock.calls[0] as unknown as [{ title: string }[]])[0].map((i) =>
      Number(i.title.match(/\d+/)?.[0]),
    );
    expect(Math.max(...ratings) - Math.min(...ratings)).toBeGreaterThan(1200);
  });

  it('không có kết quả thì nút bị khoá; lỗi mạng khi lấy mẫu được báo', async () => {
    h.page = { rows: [], total: 0 };
    renderModal();
    expect(
      (
        screen.getByRole('button', {
          name: 'Chọn ngẫu nhiên, trải đều rating',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    cleanup();
    h.page = { rows: [row(1, 1000)], total: 5 };
    h.searchNow = vi.fn().mockRejectedValue(new Error('hết hạn phiên'));
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngẫu nhiên, trải đều rating' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('hết hạn phiên'));
  });
});
