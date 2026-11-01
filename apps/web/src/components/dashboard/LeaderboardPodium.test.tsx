import type { LeaderboardRow } from '@erpchess/api';
import { createI18n } from '@erpchess/i18n';
import { cleanup, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import { LeaderboardPodium, podiumLayout } from './LeaderboardPodium';

function rows(n: number): LeaderboardRow[] {
  return Array.from({ length: n }, (_, i) => ({
    studentId: `s${i + 1}`,
    displayName: `Bạn ${i + 1}`,
    avatarUrl: null,
    points: 100 - i * 10,
    solved: 10 - i,
    tries: 20,
  }));
}

function renderPodium(n: number, currentUserId?: string) {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <LeaderboardPodium rows={rows(n)} currentUserId={currentUserId} />
    </I18nextProvider>,
  );
}

afterEach(() => cleanup());

describe('podiumLayout', () => {
  it('đủ 3 người: thứ tự hiển thị 2-1-3, phần còn lại từ hạng 4', () => {
    const { slots, rest } = podiumLayout(rows(6));
    expect(slots.map((s) => s.rank)).toEqual([2, 1, 3]);
    expect(slots.map((s) => s.row.studentId)).toEqual(['s2', 's1', 's3']);
    expect(rest.map((r) => r.studentId)).toEqual(['s4', 's5', 's6']);
  });

  it('ít hơn 3 người: chỉ có các hạng có người, vẫn giữ hạng nhất ở giữa', () => {
    expect(podiumLayout(rows(2)).slots.map((s) => s.rank)).toEqual([2, 1]);
    expect(podiumLayout(rows(1)).slots.map((s) => s.rank)).toEqual([1]);
    expect(podiumLayout(rows(0)).slots).toEqual([]);
    expect(podiumLayout(rows(2)).rest).toEqual([]);
  });
});

describe('LeaderboardPodium', () => {
  it('vẽ top 3 theo thứ tự 2-1-3 và danh sách hạng 4+', () => {
    renderPodium(5);
    const podium = screen.getByTestId('podium');
    const order = within(podium)
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('data-rank'));
    expect(order).toEqual(['2', '1', '3']);
    expect(within(podium).getByText('Bạn 1')).toBeTruthy();
    // Hạng 4 và 5 nằm ngoài bục
    expect(screen.getByText('Bạn 4')).toBeTruthy();
    expect(screen.getByText('Bạn 5')).toBeTruthy();
    expect(within(podium).queryByText('Bạn 4')).toBeNull();
  });

  it('dưới 3 người: không có cột trống, không có danh sách phụ', () => {
    renderPodium(2);
    expect(within(screen.getByTestId('podium')).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('avatar chữ cái khi không có ảnh; ảnh khi có avatarUrl', () => {
    const data = rows(2);
    const first = data[0];
    if (!first) throw new Error('thiếu dữ liệu');
    first.avatarUrl = 'https://example.com/a.png';
    const { container } = render(
      <I18nextProvider i18n={createI18n('vi')}>
        <LeaderboardPodium rows={data} />
      </I18nextProvider>,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(container.textContent).toContain('B'); // chữ cái đầu của "Bạn 2"
  });

  it('chỉ hiện tối đa 7 người từ hạng 4 và nhãn hạng cho trình đọc màn hình', () => {
    renderPodium(15);
    expect(screen.getByText('Bạn 10')).toBeTruthy();
    expect(screen.queryByText('Bạn 11')).toBeNull();
    expect(screen.getByRole('img', { name: 'Hạng 1' })).toBeTruthy();
  });
});
