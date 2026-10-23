import type { EngineInfo, UciEngine } from '@erpchess/engine';
import { useEffect, useRef, useState } from 'react';

/**
 * Phân tích liên tục (go infinite) thế cờ đang xem. Đổi thế cờ hoặc số phương án thì
 * dừng lần cũ và chạy lại; dòng info muộn của lần cũ bị bỏ qua nhờ run token.
 */
export function useAnalysis(
  engine: UciEngine | null,
  fen: string,
  enabled: boolean,
  multiPv: number,
): EngineInfo[] {
  const [lines, setLines] = useState<EngineInfo[]>([]);
  const runRef = useRef(0);

  useEffect(() => {
    const run = ++runRef.current;
    setLines([]);
    if (!engine || !enabled) {
      engine?.stop();
      return;
    }
    const byPv = new Map<number, EngineInfo>();
    void engine
      .analyse(fen, { multiPv }, (info) => {
        if (runRef.current !== run) return;
        // Chỉ giữ phương án ở độ sâu mới nhất cho mỗi số thứ tự MultiPV
        byPv.set(info.multipv, info);
        setLines([...byPv.values()].sort((a, b) => a.multipv - b.multipv));
      })
      .catch(() => undefined);
    return () => {
      engine.stop();
    };
  }, [engine, fen, enabled, multiPv]);

  return lines;
}
