import { useMemo } from 'react';

export interface DayActivity {
  day: string; // 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'
  label: string; // 'Thứ Hai', 'Thứ Ba'...
  count: number;
  isToday?: boolean;
  /** Khoá ổn định khi nhãn `day` có thể trùng (khoảng dài hơn một tuần). */
  date?: string;
}

export interface WeeklyActivityChartProps {
  /** Số liệu thật từng ngày (không có dữ liệu mẫu mặc định). */
  data: DayActivity[];
  totalSolved?: number;
  /** % thay đổi so với kỳ trước; không truyền (hoặc null) thì ẩn huy hiệu xu hướng. */
  trendPercent?: number | null;
  title?: string;
  subtitle?: string;
  /** Đơn vị của số liệu, vd. "bài", "lượt", "quiz". */
  unit?: string;
}

export function WeeklyActivityChart({
  data,
  totalSolved,
  trendPercent,
  title = '📊 Hoạt động giải bài tập trong tuần',
  subtitle = 'Tần suất giải thế cờ và nộp bài tập của học viên toàn học viện',
  unit = 'bài',
}: WeeklyActivityChartProps) {
  const { maxCount, total, avgPerDay, bestDay } = useMemo(() => {
    let max = 1;
    let sum = 0;
    let best = data[0];

    for (const d of data) {
      if (d.count > max) max = d.count;
      sum += d.count;
      if (best && d.count > best.count) best = d;
    }

    return {
      maxCount: max,
      total: totalSolved ?? sum,
      avgPerDay: Math.round(sum / Math.max(1, data.length)),
      bestDay: best,
    };
  }, [data, totalSolved]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="font-bold text-base text-text">{title}</h3>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {trendPercent !== undefined && trendPercent !== null && (
            <span
              className={`rounded-full px-2.5 py-1 font-bold text-xs ${
                trendPercent >= 0 ? 'bg-green/15 text-green' : 'bg-danger/10 text-danger'
              }`}
            >
              {trendPercent >= 0 ? '▲ +' : '▼ '}
              {trendPercent}%
            </span>
          )}
          <span className="font-bold text-lg text-primary">{total}</span>
          <span className="text-text-muted text-xs">{unit}</span>
        </div>
      </div>

      {/* SVG / Bar Chart Area */}
      <div className="relative flex h-44 items-end gap-2 pt-6 pb-2 sm:gap-4">
        {data.map((item) => {
          const heightPercent = Math.max(8, Math.round((item.count / maxCount) * 100));

          return (
            <div
              key={item.date ?? item.day}
              className="group relative flex flex-1 flex-col items-center h-full justify-end cursor-pointer"
            >
              {/* Tooltip on Hover via CSS */}
              <div className="pointer-events-none absolute -top-10 z-20 hidden whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-center font-medium text-white text-xs shadow-lg group-hover:block animate-in fade-in duration-150">
                <span className="font-bold">{item.count}</span> {unit} ({item.label})
              </div>

              {/* Number Badge above Bar */}
              <span
                className={`mb-1.5 text-xs font-semibold transition-colors ${
                  item.isToday ? 'text-primary font-bold' : 'text-text-muted group-hover:text-text'
                }`}
              >
                {item.count}
              </span>

              {/* Bar Element */}
              <div
                className={`w-full max-w-[36px] rounded-t-md transition-all duration-300 ${
                  item.isToday
                    ? 'bg-primary ring-2 ring-primary/20'
                    : 'bg-blue-500/80 group-hover:bg-blue-600'
                }`}
                style={{ height: `${heightPercent}%` }}
              />

              {/* Day Label below Bar */}
              <div className="mt-2 flex flex-col items-center">
                <span
                  className={`text-xs font-medium ${
                    item.isToday
                      ? 'rounded-full bg-primary/10 px-1.5 font-bold text-primary'
                      : 'text-text'
                  }`}
                >
                  {item.day}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Stats Summary */}
      <div className="flex flex-wrap items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
        <div>
          <span>Trung bình: </span>
          <strong className="text-text">{avgPerDay}</strong> {unit}/ngày
        </div>
        {bestDay && (
          <div>
            <span>Tích cực nhất: </span>
            <strong className="text-text">{bestDay.label}</strong> ({bestDay.count} {unit})
          </div>
        )}
      </div>
    </div>
  );
}
