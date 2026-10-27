import { useMemo } from 'react';

export interface DayActivity {
  day: string; // 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'
  label: string; // 'Thứ Hai', 'Thứ Ba'...
  count: number;
  isToday?: boolean;
}

export interface WeeklyActivityChartProps {
  data?: DayActivity[];
  totalSolved?: number;
  trendPercent?: number;
}

const DEFAULT_DAYS: DayActivity[] = [
  { day: 'T2', label: 'Thứ Hai', count: 12 },
  { day: 'T3', label: 'Thứ Ba', count: 18 },
  { day: 'T4', label: 'Thứ Tư', count: 15 },
  { day: 'T5', label: 'Thứ Năm', count: 24, isToday: true },
  { day: 'T6', label: 'Thứ Sáu', count: 20 },
  { day: 'T7', label: 'Thứ Bảy', count: 32 },
  { day: 'CN', label: 'Chủ Nhật', count: 28 },
];

export function WeeklyActivityChart({
  data = DEFAULT_DAYS,
  totalSolved,
  trendPercent = 14.5,
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
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="font-bold text-base text-gray-900">
            📊 Hoạt động giải bài tập trong tuần
          </h3>
          <p className="text-xs text-text-muted">
            Tần suất giải thế cờ và nộp bài tập của học viên toàn học viện
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 text-xs">
            ▲ +{trendPercent}%
          </span>
          <span className="font-bold text-lg text-primary">{total}</span>
          <span className="text-text-muted text-xs">bài</span>
        </div>
      </div>

      {/* SVG / Bar Chart Area */}
      <div className="relative flex h-44 items-end gap-2 pt-6 pb-2 sm:gap-4">
        {data.map((item) => {
          const heightPercent = Math.max(8, Math.round((item.count / maxCount) * 100));

          return (
            <div
              key={item.day}
              className="group relative flex flex-1 flex-col items-center h-full justify-end cursor-pointer"
            >
              {/* Tooltip on Hover via CSS */}
              <div className="pointer-events-none absolute -top-10 z-20 hidden whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-center font-medium text-white text-xs shadow-lg group-hover:block animate-in fade-in duration-150">
                <span className="font-bold">{item.count}</span> bài ({item.label})
              </div>

              {/* Number Badge above Bar */}
              <span
                className={`mb-1.5 text-xs font-semibold transition-colors ${
                  item.isToday
                    ? 'text-primary font-bold'
                    : 'text-text-muted group-hover:text-gray-900'
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
                      : 'text-gray-600'
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
      <div className="flex flex-wrap items-center justify-between border-t border-gray-100 pt-3 text-xs text-text-muted">
        <div>
          <span>Trung bình: </span>
          <strong className="text-gray-800">{avgPerDay}</strong> bài/ngày
        </div>
        {bestDay && (
          <div>
            <span>Tích cực nhất: </span>
            <strong className="text-gray-800">{bestDay.label}</strong> ({bestDay.count} bài)
          </div>
        )}
      </div>
    </div>
  );
}
