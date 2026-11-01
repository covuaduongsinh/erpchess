import { useDailyStats } from '@erpchess/api/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { toDateInput } from '../../lib/quick-range';
import { useT } from '../../lib/use-t';
import {
  type DayRange,
  isValidRange,
  MAX_RANGE_DAYS,
  parseDay,
  previousRange,
  rangeLength,
  shiftRange,
  trendPercent,
  weekRange,
} from '../../lib/week-range';
import {
  Button,
  Card,
  DateRangeFields,
  EmptyState,
  ErrorText,
  IconButton,
  Spinner,
  Tabs,
} from '../ui';
import { type DayActivity, WeeklyActivityChart } from './WeeklyActivityChart';

type Series = 'activity' | 'attendance' | 'quiz';

/**
 * Thống kê theo ngày ở Tổng quan (nhân sự): ba chuỗi (lượt làm bài, điểm danh, quiz hoàn thành),
 * chọn khoảng ngày, nút Tuần trước/Tuần sau. Số liệu thật từ RPC `academy_daily_stats`.
 */
export function WeeklyStatsPanel({ academyId }: { academyId: string }) {
  const { t, i18n } = useT();
  const [range, setRange] = useState<DayRange>(() => weekRange());
  const [series, setSeries] = useState<Series>('activity');
  const valid = isValidRange(range);
  const current = useDailyStats(valid ? academyId : undefined, range.from, range.to);
  const prevRange = previousRange(range);
  const previous = useDailyStats(valid ? academyId : undefined, prevRange.from, prevRange.to);

  const thisWeek = weekRange();
  const isThisWeek = range.from === thisWeek.from && range.to === thisWeek.to;
  const today = toDateInput(new Date());
  const short = rangeLength(range) <= 7;

  const pick = (d: {
    attempts: number;
    attendancePresent: number;
    quizCompletions: number;
  }): number =>
    series === 'activity'
      ? d.attempts
      : series === 'attendance'
        ? d.attendancePresent
        : d.quizCompletions;

  const data: DayActivity[] = (current.data ?? []).map((d) => {
    const date = parseDay(d.date);
    return {
      date: d.date,
      day: short
        ? date.toLocaleDateString(i18n.language, { weekday: 'short' })
        : date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric' }),
      label: date.toLocaleDateString(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'numeric',
      }),
      count: pick(d),
      isToday: d.date === today,
    };
  });
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const prevTotal = (previous.data ?? []).reduce((sum, d) => sum + pick(d), 0);
  const trend = current.data && previous.data ? trendPercent(total, prevTotal) : null;
  const attendanceTotal = (current.data ?? []).reduce((sum, d) => sum + d.attendanceTotal, 0);

  return (
    <Card title={t('overview.weeklyTitle')}>
      <div className="flex flex-wrap items-end gap-3">
        <Tabs
          variant="pills"
          ariaLabel={t('overview.weeklyTitle')}
          value={series}
          onChange={setSeries}
          items={[
            { value: 'activity', label: t('overview.series_activity') },
            { value: 'attendance', label: t('overview.series_attendance') },
            { value: 'quiz', label: t('overview.series_quiz') },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <DateRangeFields value={range} onChange={setRange} />
          <div className="flex items-center gap-1">
            <IconButton
              icon={ChevronLeft}
              label={t('overview.prevPeriod')}
              disabled={!valid}
              onClick={() => setRange(shiftRange(range, -1))}
            />
            <IconButton
              icon={ChevronRight}
              label={t('overview.nextPeriod')}
              disabled={!valid}
              onClick={() => setRange(shiftRange(range, 1))}
            />
            {!isThisWeek && (
              <Button variant="secondary" size="sm" onClick={() => setRange(weekRange())}>
                {t('overview.thisWeek')}
              </Button>
            )}
          </div>
        </div>
      </div>
      {!valid ? (
        <p role="alert" className="text-sm text-danger">
          {t('overview.rangeInvalid', { max: MAX_RANGE_DAYS })}
        </p>
      ) : current.isPending ? (
        <Spinner />
      ) : current.error ? (
        <ErrorText error={current.error} />
      ) : data.length === 0 ? (
        <EmptyState dashed title={t('overview.noDataRange')} />
      ) : (
        <WeeklyActivityChart
          data={data}
          trendPercent={trend}
          title={t(`overview.chartTitle_${series}`)}
          subtitle={t(`overview.chartSub_${series}`, { total: attendanceTotal })}
          unit={t(`overview.unit_${series}`)}
        />
      )}
    </Card>
  );
}
