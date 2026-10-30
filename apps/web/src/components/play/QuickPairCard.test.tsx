import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUICK_PAIR_POLL_MS } from '../../lib/use-quick-pair';
import { QuickPairCard } from './QuickPairCard';

const quickPair = vi.fn();
const cancelQuickPair = vi.fn();

vi.mock('@erpchess/api', () => ({
  TIME_PRESETS: [
    { id: '3+2', baseMs: 180_000, incMs: 2_000 },
    { id: '5+0', baseMs: 300_000, incMs: 0 },
  ],
  quickPair: (...args: unknown[]) => quickPair(...args),
  cancelQuickPair: (...args: unknown[]) => cancelQuickPair(...args),
}));

vi.mock('@erpchess/api/react', () => ({ useErpClient: () => ({}) }));

vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
    i18n: { language: 'vi' },
  }),
}));

const waiting = (waitedMs: number) => ({ status: 'waiting', rating: 1500, window: 100, waitedMs });

/** Chờ các promise đang treo chạy xong (fake timer không tự làm việc này). */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  quickPair.mockReset();
  cancelQuickPair.mockReset();
  cancelQuickPair.mockResolvedValue({ status: 'cancelled' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('QuickPairCard', () => {
  it('searches with the chosen time control, polls, then opens the matched game', async () => {
    const onMatched = vi.fn();
    quickPair
      .mockResolvedValueOnce(waiting(0))
      .mockResolvedValueOnce({ status: 'matched', gameId: 'g1' });
    render(<QuickPairCard academyId="a1" onMatched={onMatched} />);

    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: /play.quickPairStart/ }));
    await flush();
    expect(quickPair).toHaveBeenCalledWith(
      {},
      'a1',
      expect.objectContaining({ baseMs: 180_000, incMs: 2_000 }),
    );
    expect(screen.getByRole('status').textContent).toContain('play.quickPairWindow');
    expect(onMatched).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(QUICK_PAIR_POLL_MS);
    });
    await flush();
    expect(quickPair).toHaveBeenCalledTimes(2);
    expect(onMatched).toHaveBeenCalledWith('g1');
    expect(screen.getByRole('button', { name: /play.quickPairStart/ })).toBeTruthy();
  });

  it('cancel stops polling and leaves the queue', async () => {
    quickPair.mockResolvedValue(waiting(4000));
    render(<QuickPairCard academyId="a1" onMatched={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /play.quickPairStart/ }));
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'play.quickPairCancel' }));
    await flush();
    expect(cancelQuickPair).toHaveBeenCalledWith({}, 'a1');

    await act(async () => {
      vi.advanceTimersByTime(QUICK_PAIR_POLL_MS * 3);
    });
    expect(quickPair).toHaveBeenCalledTimes(1);
  });

  it('opens the game when it was matched just before cancelling', async () => {
    const onMatched = vi.fn();
    quickPair.mockResolvedValue(waiting(0));
    cancelQuickPair.mockResolvedValue({ status: 'matched', gameId: 'g2' });
    render(<QuickPairCard academyId="a1" onMatched={onMatched} />);
    fireEvent.click(screen.getByRole('button', { name: /play.quickPairStart/ }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'play.quickPairCancel' }));
    await flush();
    expect(onMatched).toHaveBeenCalledWith('g2');
  });

  it('leaves the queue when unmounted while searching', async () => {
    quickPair.mockResolvedValue(waiting(0));
    const { unmount } = render(<QuickPairCard academyId="a1" onMatched={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /play.quickPairStart/ }));
    await flush();
    unmount();
    expect(cancelQuickPair).toHaveBeenCalledWith({}, 'a1');
  });

  it('shows the error and stops when the server refuses', async () => {
    quickPair.mockRejectedValue(new Error('forbidden'));
    render(<QuickPairCard academyId="a1" onMatched={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /play.quickPairStart/ }));
    await flush();
    expect(screen.getByRole('button', { name: /play.quickPairStart/ })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(QUICK_PAIR_POLL_MS * 2);
    });
    expect(quickPair).toHaveBeenCalledTimes(1);
  });
});
