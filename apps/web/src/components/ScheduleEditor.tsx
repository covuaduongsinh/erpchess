import type { ScheduleSlot } from '@erpchess/domain';
import { useT } from '../lib/use-t';
import { Button } from './ui';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

/** Sửa lịch tuần (thứ, giờ bắt đầu, số phút): lịch Batch, lịch lặp của lớp, lịch trống HLV. */
export function ScheduleEditor({
  legend,
  schedule,
  onChange,
  maxMinutes = 480,
}: {
  legend: string;
  schedule: ScheduleSlot[];
  onChange: (next: ScheduleSlot[]) => void;
  maxMinutes?: number;
}) {
  const { t } = useT();
  const setSlot = (index: number, patch: Partial<ScheduleSlot>) =>
    onChange(schedule.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      {schedule.length === 0 && <p className="text-sm text-text-muted">{t('groups.noSchedule')}</p>}
      {schedule.map((slot, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: các buổi không có id, thứ tự do người dùng sửa
        <div key={i} className="flex flex-wrap items-end gap-2">
          <select
            aria-label={`${legend} ${i + 1}`}
            value={slot.day}
            onChange={(e) => setSlot(i, { day: Number(e.target.value) })}
            className="rounded-md border border-text-muted/30 bg-white px-2 py-2"
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {t(`weekday.d${d}`)}
              </option>
            ))}
          </select>
          <input
            type="time"
            aria-label={legend}
            value={slot.start}
            onChange={(e) => setSlot(i, { start: e.target.value })}
            className="rounded-md border border-text-muted/30 bg-white px-2 py-2"
            required
          />
          <input
            type="number"
            aria-label={t('groups.minutes')}
            min={15}
            max={maxMinutes}
            step={15}
            value={slot.minutes}
            onChange={(e) => setSlot(i, { minutes: Number(e.target.value) })}
            className="w-24 rounded-md border border-text-muted/30 bg-white px-2 py-2"
          />
          <Button
            variant="ghost"
            className="text-sm"
            onClick={() => onChange(schedule.filter((_, j) => j !== i))}
          >
            {t('groups.removeSlot')}
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        className="self-start text-sm"
        onClick={() => onChange([...schedule, { day: 1, start: '18:00', minutes: 90 }])}
      >
        {t('groups.addSlot')}
      </Button>
    </fieldset>
  );
}
