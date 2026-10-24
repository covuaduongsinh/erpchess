import { useEffect, useState } from 'react';
import { formatDuration } from '../../lib/format';

/**
 * Đồng hồ một bên. Server là nguồn sự thật: `ms` là thời gian còn lại lúc `since` (bắt đầu lượt);
 * đang chạy thì trừ dần theo giờ máy để hiển thị. Hết giờ thì gọi `onFlag` một lần.
 */
export function GameClock({
  ms,
  running,
  since,
  label,
  onFlag,
}: {
  ms: number;
  running: boolean;
  since: string | null;
  label: string;
  onFlag?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running]);
  const left = running && since ? ms - (now - Date.parse(since)) : ms;
  const flagged = running && left <= 0;
  useEffect(() => {
    if (flagged) onFlag?.();
  }, [flagged, onFlag]);
  const low = left < 20_000;
  return (
    <div
      role="timer"
      aria-label={label}
      className={`flex items-center justify-between rounded-md px-3 py-2 font-mono text-xl ${
        running
          ? low
            ? 'bg-danger text-white'
            : 'bg-primary text-text-on-primary'
          : 'bg-bg text-text'
      }`}
    >
      <span className="font-sans text-sm">{label}</span>
      <span>{formatDuration(Math.max(0, left))}</span>
    </div>
  );
}
