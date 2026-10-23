import { z } from 'zod';
import { type ScheduleSlot, scheduleSchema } from './admin';
import { toCsv } from './csv';

export const classroomKinds = ['online', 'offline'] as const;
export const videoModes = ['performance', 'standard', 'none'] as const;
export const attendanceStatuses = ['present', 'late', 'absent', 'excused'] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];
export const calendarEventKinds = ['class', 'trial', 'meeting', 'leave', 'other'] as const;
export type CalendarEventKind = (typeof calendarEventKinds)[number];

/**
 * Tạo lớp: một buổi (`startsAt`) hoặc chuỗi lặp theo lịch tuần (`repeat`) bắt đầu từ `startsAt`.
 * Phạm vi khớp với CHECK trong migration `…0012_classrooms.sql`.
 */
export const classroomInputSchema = z.object({
  academyId: z.uuid(),
  title: z
    .string()
    .trim()
    .max(160)
    .default('')
    .transform((v) => v || 'Class'),
  kind: z.enum(classroomKinds).default('online'),
  videoMode: z.enum(videoModes).default('performance'),
  isPublic: z.boolean().default(false),
  startsAt: z.iso.datetime({ offset: true }),
  minutes: z.int().min(5).max(600).default(60),
  coachId: z.uuid().nullable().default(null),
  groupId: z.uuid().nullable().default(null),
  groupIds: z.array(z.uuid()).default([]),
  studentIds: z.array(z.uuid()).default([]),
  repeat: z
    .object({ schedule: scheduleSchema.min(1, 'schedule'), weeks: z.int().min(1).max(26) })
    .nullable()
    .default(null),
});
export type ClassroomInput = z.input<typeof classroomInputSchema>;

export type Occurrence = { startsAt: Date; minutes: number };

function atLocalTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 0, m ?? 0);
}

/**
 * Các buổi của lịch tuần trong `weeks` tuần tính từ `from` (giờ địa phương), bỏ buổi trước `from`.
 * Dùng cho lịch Batch (`groups.schedule`) hoặc lịch tự chọn khi tạo lớp lặp lại.
 */
export function expandSchedule(
  schedule: readonly ScheduleSlot[],
  from: Date,
  weeks: number,
): Occurrence[] {
  const out: Occurrence[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    for (const slot of schedule) {
      if (slot.day !== day.getDay()) continue;
      const startsAt = atLocalTime(day, slot.start);
      if (startsAt >= from) out.push({ startsAt, minutes: slot.minutes });
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export const calendarRanges = ['month', 'quarter', 'year'] as const;
export type CalendarRange = (typeof calendarRanges)[number];

/** Tháng / quý / năm lịch chứa `now`, dạng [from, to) theo giờ địa phương (nút M/Q/Y). */
export function calendarRange(kind: CalendarRange, now = new Date()): { from: Date; to: Date } {
  const y = now.getFullYear();
  if (kind === 'year') return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
  const m = kind === 'month' ? now.getMonth() : now.getMonth() - (now.getMonth() % 3);
  const len = kind === 'month' ? 1 : 3;
  return { from: new Date(y, m, 1), to: new Date(y, m + len, 1) };
}

/** Thứ hai 00:00 của tuần chứa `day` và 7 ngày của tuần đó. */
export function weekDays(day: Date): Date[] {
  const monday = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() - ((day.getDay() + 6) % 7),
  );
  return Array.from(
    { length: 7 },
    (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
  );
}

export type Availability = { coachId: string; day: number; start: string; minutes: number };
export type BusyEvent = { coachId: string | null; startsAt: Date; endsAt: Date };

/**
 * HLV còn trống cho khoảng [start, end): lịch trống tuần của HLV phủ trọn khoảng đó (cùng ngày,
 * giờ địa phương) và không trùng sự kiện nào đã có của HLV (lớp, họp, nghỉ…).
 */
export function freeCoaches(
  availability: readonly Availability[],
  events: readonly BusyEvent[],
  start: Date,
  end: Date,
): string[] {
  const free = new Set<string>();
  for (const a of availability) {
    if (a.day !== start.getDay()) continue;
    const from = atLocalTime(start, a.start);
    const to = new Date(from.getTime() + a.minutes * 60_000);
    if (from <= start && end <= to) free.add(a.coachId);
  }
  for (const e of events) {
    if (e.coachId && e.startsAt < end && start < e.endsAt) free.delete(e.coachId);
  }
  return [...free];
}

export type ClassCsvRow = {
  title: string;
  kind: string;
  startsAt: Date;
  minutes: number;
  coach: string;
  present: number;
  late: number;
  absent: number;
};

function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Danh sách lớp ra CSV (giờ địa phương), tiêu đề cột do giao diện truyền vào theo ngôn ngữ. */
export function classesToCsv(rows: readonly ClassCsvRow[], header: readonly string[]): string {
  return toCsv([
    header,
    ...rows.map((r) => [
      r.title,
      r.kind,
      localStamp(r.startsAt),
      String(r.minutes),
      r.coach,
      String(r.present),
      String(r.late),
      String(r.absent),
    ]),
  ]);
}
