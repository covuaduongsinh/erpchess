import { cancelQuickPair, quickPair } from '@erpchess/api';
import { useErpClient } from '@erpchess/api/react';
import { useCallback, useEffect, useRef, useState } from 'react';

export const QUICK_PAIR_POLL_MS = 2000;

export type QuickPairPhase =
  | { phase: 'idle' }
  | {
      phase: 'searching';
      presetId: string;
      waitedMs: number;
      window: number | null;
      rating: number | null;
    }
  | { phase: 'error'; error: unknown };

type TimeControl = { id: string; baseMs: number; incMs: number };

/**
 * Tìm trận nhanh (Giai đoạn 22c): gọi `quick_pair` lặp lại mỗi 2 giây cho tới khi được ghép;
 * mỗi lần gọi vừa giữ chỗ trong hàng đợi vừa thử ghép. Rời trang khi đang chờ thì tự rời hàng đợi.
 */
export function useQuickPair(academyId: string, onMatched: (gameId: string) => void) {
  const client = useErpClient();
  const [state, setState] = useState<QuickPairPhase>({ phase: 'idle' });
  // Mỗi lượt tìm có mã riêng: huỷ hoặc tìm lại thì vòng lặp cũ tự dừng
  const runRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onMatchedRef = useRef(onMatched);
  onMatchedRef.current = onMatched;

  const stop = useCallback(() => {
    runRef.current += 1;
    clearTimeout(timerRef.current);
  }, []);

  const start = useCallback(
    (tc: TimeControl) => {
      stop();
      const run = runRef.current;
      setState({ phase: 'searching', presetId: tc.id, waitedMs: 0, window: null, rating: null });
      const tick = async () => {
        try {
          const res = await quickPair(client, academyId, tc);
          if (run !== runRef.current) return;
          if (res.status === 'matched') {
            stop();
            setState({ phase: 'idle' });
            onMatchedRef.current(res.gameId);
            return;
          }
          if (res.status === 'waiting') {
            setState({
              phase: 'searching',
              presetId: tc.id,
              waitedMs: res.waitedMs,
              window: res.window,
              rating: res.rating,
            });
          }
          timerRef.current = setTimeout(() => void tick(), QUICK_PAIR_POLL_MS);
        } catch (error) {
          if (run !== runRef.current) return;
          stop();
          setState({ phase: 'error', error });
        }
      };
      void tick();
    },
    [academyId, client, stop],
  );

  const cancel = useCallback(async () => {
    stop();
    setState({ phase: 'idle' });
    try {
      const res = await cancelQuickPair(client, academyId);
      // Vừa được ghép trước khi kịp huỷ: vào ván luôn để đối thủ không phải chờ
      if (res.status === 'matched') onMatchedRef.current(res.gameId);
    } catch {
      // Lượt chờ không còn heartbeat sẽ tự hết hạn sau 20–30 giây
    }
  }, [academyId, client, stop]);

  // Rời trang khi đang tìm: rời hàng đợi. Đọc qua ref để effect chỉ chạy dọn dẹp khi unmount thật
  // (nếu phụ thuộc `client`, mỗi lần client đổi tham chiếu sẽ dừng nhầm vòng tìm đang chạy).
  const latest = useRef({ searching: false, client, academyId, stop });
  latest.current = { searching: state.phase === 'searching', client, academyId, stop };
  useEffect(
    () => () => {
      const { searching, client: c, academyId: id, stop: halt } = latest.current;
      if (searching) {
        halt();
        void cancelQuickPair(c, id).catch(() => undefined);
      }
    },
    [],
  );

  return { state, start, cancel };
}
