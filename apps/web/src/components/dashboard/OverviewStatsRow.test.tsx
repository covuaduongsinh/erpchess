import type { MyAcademy } from '@erpchess/api';
import { createI18n } from '@erpchess/i18n';
import { cleanup, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyContext } from '../../lib/academy-context';
import { OverviewStatsRow } from './OverviewStatsRow';

const h = vi.hoisted(() => ({
  stats: {
    data: undefined as unknown,
    isPending: false,
    error: null as unknown,
  },
}));

vi.mock('@erpchess/api/react', () => ({
  useAcademyStats: () => h.stats,
  useClassrooms: () => ({ data: [{ id: 'c1' }, { id: 'c2' }] }),
  useTournaments: () => ({
    data: [
      { id: 't1', status: 'active' },
      { id: 't2', status: 'upcoming' },
    ],
  }),
}));

function renderRow(lng: 'vi' | 'en' = 'vi') {
  const academy = { id: 'a1', slug: 'clb', name: 'CLB', role: 'owner' } as unknown as MyAcademy;
  return render(
    <I18nextProvider i18n={createI18n(lng)}>
      <AcademyContext value={{ academy, session: {} as never }}>
        <OverviewStatsRow />
      </AcademyContext>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  h.stats = {
    data: { students: 8, staff: 1, groups: 1, batches: 2, assignments: 3, attemptsWeek: 12 },
    isPending: false,
    error: null,
  };
});
afterEach(() => cleanup());

describe('OverviewStatsRow', () => {
  it('thẻ "Lượt làm bài 7 ngày" hiện attemptsWeek (bài tập + quiz + học liệu từ máy chủ)', () => {
    renderRow();
    const card = screen.getByText('Lượt làm bài 7 ngày').closest('div') as HTMLElement;
    expect(within(card.parentElement as HTMLElement).getByText('12')).toBeTruthy();
    expect(screen.queryByText('Bài tập đã làm 7 ngày')).toBeNull();
  });

  it('nhãn tiếng Anh, và các thẻ khác vẫn hiện số đúng', () => {
    renderRow('en');
    expect(screen.getByText('Attempts in 7 days')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('chưa có số liệu (không phải staff) thì không vẽ gì; lỗi thì báo lỗi', () => {
    h.stats = { data: null, isPending: false, error: null };
    const { container, unmount } = renderRow();
    expect(container.textContent).toBe('');
    unmount();
    h.stats = { data: undefined, isPending: false, error: new Error('mạng lỗi') };
    renderRow();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
