import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysOf, weekRange } from '../../lib/week-range';
import { WeeklyStatsPanel } from './WeeklyStatsPanel';

const h = vi.hoisted(() => ({
  calls: [] as { academyId: string | undefined; from: string; to: string }[],
  // số liệu theo ngày bắt đầu của khoảng; mặc định mỗi ngày 2 lượt
  perDay: {} as Record<string, number>,
  fail: false,
}));

vi.mock('@erpchess/api/react', async () => {
  const { daysOf: days } = await import('../../lib/week-range');
  return {
    useDailyStats: (academyId: string | undefined, from: string, to: string) => {
      h.calls.push({ academyId, from, to });
      if (!academyId) return { data: undefined, isPending: true, error: null };
      if (h.fail) return { data: undefined, isPending: false, error: new Error('lỗi mạng') };
      const n = h.perDay[from] ?? 2;
      return {
        isPending: false,
        error: null,
        data: days({ from, to }).map((date) => ({
          date,
          attempts: n,
          attendancePresent: 1,
          attendanceTotal: 4,
          quizCompletions: 3,
        })),
      };
    },
  };
});

function renderPanel() {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <WeeklyStatsPanel academyId="a1" />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  h.calls = [];
  h.perDay = {};
  h.fail = false;
});
afterEach(() => cleanup());

const week = weekRange();
const lastCall = () => h.calls.filter((c) => c.academyId).at(-1);

describe('WeeklyStatsPanel', () => {
  it('mặc định là tuần này, hiện chuỗi hoạt động với tổng và số liệu thật', () => {
    renderPanel();
    expect(screen.getByLabelText('Từ ngày')).toHaveProperty('value', week.from);
    expect(screen.getByLabelText('Đến ngày')).toHaveProperty('value', week.to);
    expect(screen.getByText('Lượt làm bài theo ngày')).toBeTruthy();
    // 7 ngày x 2 lượt, đơn vị theo chuỗi
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tuần này' })).toBeNull();
  });

  it('không còn dữ liệu mẫu: ngày không có số liệu thì cột là 0, không phải số bịa', () => {
    h.perDay[week.from] = 0;
    renderPanel();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.queryByText('▲ +14.5%')).toBeNull();
  });

  it('đổi chuỗi: điểm danh dùng lượt có mặt và chú thích tổng; quiz dùng số hoàn thành', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Điểm danh' }));
    expect(screen.getByText('Lượt có mặt theo ngày')).toBeTruthy();
    expect(screen.getByText(/trên 28 lượt điểm danh/)).toBeTruthy(); // 7 ngày x 4
    expect(screen.getByText('7')).toBeTruthy(); // 7 ngày x 1
    fireEvent.click(screen.getByRole('tab', { name: 'Quiz hoàn thành' }));
    expect(screen.getByText('Quiz hoàn thành theo ngày')).toBeTruthy();
    expect(screen.getByText('21')).toBeTruthy(); // 7 ngày x 3
  });

  it('Tuần trước / Tuần sau dời cả khoảng và truy vấn lại theo khoảng mới', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước' }));
    const prev = lastCall();
    expect((prev?.to ?? '') < week.from).toBe(true);
    expect(daysOf({ from: prev?.from ?? '', to: prev?.to ?? '' })).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Tuần này' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tuần sau' }));
    expect(screen.queryByRole('button', { name: 'Tuần này' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tuần sau' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tuần này' }));
    expect(screen.getByLabelText('Từ ngày')).toHaveProperty('value', week.from);
  });

  it('xu hướng so với kỳ trước: tăng, giảm và ẩn khi kỳ trước bằng 0', () => {
    const prev = weekRange(new Date(new Date(`${week.from}T00:00:00`).getTime() - 86_400_000));
    h.perDay[prev.from] = 1; // kỳ trước 7 lượt, kỳ này 14
    const { unmount } = renderPanel();
    expect(screen.getByText('▲ +100%')).toBeTruthy();
    unmount();
    h.perDay[prev.from] = 4; // kỳ trước 28 lượt, kỳ này 14
    const second = renderPanel();
    expect(screen.getByText('▼ -50%')).toBeTruthy();
    second.unmount();
    h.perDay[prev.from] = 0;
    renderPanel();
    expect(screen.queryByText(/[▲▼]/)).toBeNull();
  });

  it('chọn khoảng ngày tuỳ ý: truy vấn đúng khoảng; quá 31 ngày thì báo lỗi và không truy vấn', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Đến ngày'), {
      target: { value: week.to },
    });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: week.from } });
    // Kéo dài thành 60 ngày
    const end = new Date(`${week.from}T00:00:00`);
    end.setDate(end.getDate() + 59);
    const iso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: iso } });
    expect(screen.getByRole('alert').textContent).toContain('tối đa 31 ngày');
    expect(lastCall()?.academyId).toBeDefined();
    // Khi khoảng không hợp lệ, hai truy vấn bị tắt (academyId = undefined) thay vì gọi RPC lỗi
    expect(h.calls.at(-1)?.academyId).toBeUndefined();
    expect(h.calls.at(-2)?.academyId).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Tuần trước' }).hasAttribute('disabled')).toBe(true);
  });

  it('hiện lỗi khi RPC lỗi và không vẽ biểu đồ', () => {
    h.fail = true;
    renderPanel();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Lượt làm bài theo ngày')).toBeNull();
  });
});
