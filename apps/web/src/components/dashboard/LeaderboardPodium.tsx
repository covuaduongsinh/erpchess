import type { LeaderboardRow } from '@erpchess/api';
import { useT } from '../../lib/use-t';

export type PodiumSlot = { rank: 1 | 2 | 3; row: LeaderboardRow };

/**
 * Xếp top 3 theo thứ tự hiển thị 2-1-3 (hạng nhất ở giữa). Ít hơn 3 người thì chỉ trả các hạng có
 * người; `rest` là hạng 4 trở đi.
 */
export function podiumLayout(rows: LeaderboardRow[]): {
  slots: PodiumSlot[];
  rest: LeaderboardRow[];
} {
  const top = rows.slice(0, 3).map((row, i) => ({ rank: (i + 1) as 1 | 2 | 3, row }));
  const order = [2, 1, 3] as const;
  const slots = order.flatMap((rank) => top.filter((s) => s.rank === rank));
  return { slots, rest: rows.slice(3) };
}

// Chiều cao cột và màu theo hạng; tự vẽ bằng CSS, không dùng hình của bên thứ ba.
const column = {
  1: 'h-28 bg-orange text-white',
  2: 'h-20 bg-primary text-text-on-primary',
  3: 'h-14 bg-blue-light text-white',
} as const;

function Avatar({ row, size }: { row: LeaderboardRow; size: string }) {
  if (row.avatarUrl) {
    return <img src={row.avatarUrl} alt="" className={`${size} rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${size} flex items-center justify-center rounded-full bg-primary-soft font-bold text-primary`}
      aria-hidden="true"
    >
      {(row.displayName.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );
}

/** Bục podium top 3 và danh sách hạng 4 trở đi. */
export function LeaderboardPodium({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[];
  currentUserId?: string;
}) {
  const { t } = useT();
  const { slots, rest } = podiumLayout(rows);
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex items-end justify-center gap-3" data-testid="podium">
        {slots.map(({ rank, row }) => (
          <li
            key={row.studentId}
            data-rank={rank}
            className="flex w-24 flex-col items-center gap-1 text-center"
          >
            <Avatar row={row} size={rank === 1 ? 'size-14 text-xl' : 'size-11 text-base'} />
            <span
              className={`w-full truncate text-sm font-medium ${
                row.studentId === currentUserId ? 'text-primary' : ''
              }`}
            >
              {row.displayName}
            </span>
            <span className="text-xs text-text-muted">
              {t('dashboard.points', { count: row.points })}
            </span>
            <div
              className={`flex w-full items-start justify-center rounded-t-lg pt-2 text-lg font-bold ${column[rank]}`}
              role="img"
              aria-label={t('overview.podiumRank', { rank })}
            >
              {rank}
            </div>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <ol start={4} className="flex flex-col gap-1">
          {rest.slice(0, 7).map((row, i) => (
            <li
              key={row.studentId}
              data-rank={i + 4}
              className={`flex items-center gap-3 rounded-md px-3 py-2 ${
                row.studentId === currentUserId ? 'bg-yellow/20' : ''
              }`}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-bg text-sm font-bold text-text-muted">
                {i + 4}
              </span>
              <Avatar row={row} size="size-8 text-sm" />
              <span className="flex-1 truncate font-medium">{row.displayName}</span>
              <span className="text-sm font-bold text-primary">
                {t('dashboard.points', { count: row.points })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
