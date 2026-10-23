/** Lớp học (Giai đoạn 8): buổi học online/offline, điểm danh, sự kiện, lịch trống HLV, Calendar. */
import {
  type AttendanceStatus,
  type CalendarEventKind,
  type ClassroomInput,
  classroomInputSchema,
  expandSchedule,
} from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Json, Tables } from './database.types';
import { ApiError, unwrap } from './queries';

export type Classroom = Tables<'classrooms'>;
export type ClassroomTarget = { group_id: string | null; student_id: string | null };
export type Attendance = Tables<'classroom_attendance'>;
export type ClassroomSummary = Classroom & {
  targets: ClassroomTarget[];
  attendance: Pick<Attendance, 'student_id' | 'status'>[];
};
export type ClassroomEvent = Tables<'classroom_events'>;
export type CoachAvailability = Tables<'coach_availability'>;
export type CalendarEvent = Tables<'calendar_events'>;

const SUMMARY =
  '*, classroom_targets(group_id, student_id), classroom_attendance(student_id, status)';

type SummaryRow = Classroom & {
  classroom_targets: ClassroomTarget[];
  classroom_attendance: Pick<Attendance, 'student_id' | 'status'>[];
};
function toSummary({
  classroom_targets,
  classroom_attendance,
  ...c
}: SummaryRow): ClassroomSummary {
  return { ...c, targets: classroom_targets, attendance: classroom_attendance };
}

/** Lớp có giờ bắt đầu trong [from, to); `createdBy` lọc "chỉ lớp của tôi". */
export async function fetchClassrooms(
  client: ErpClient,
  academyId: string,
  range: { from: Date; to: Date; createdBy?: string },
): Promise<ClassroomSummary[]> {
  let q = client
    .from('classrooms')
    .select(SUMMARY)
    .eq('academy_id', academyId)
    .gte('starts_at', range.from.toISOString())
    .lt('starts_at', range.to.toISOString());
  if (range.createdBy) q = q.eq('created_by', range.createdBy);
  return unwrap(await q.order('starts_at').limit(1000)).map(toSummary);
}

export async function fetchClassroom(client: ErpClient, id: string): Promise<ClassroomSummary> {
  return toSummary(unwrap(await client.from('classrooms').select(SUMMARY).eq('id', id).single()));
}

/**
 * Tạo một buổi, hoặc cả chuỗi lặp theo lịch tuần (chung `series_id`). Lỗi giữa chừng thì xoá các
 * buổi vừa tạo để không để lại chuỗi dở dang.
 */
export async function createClassrooms(
  client: ErpClient,
  userId: string,
  input: ClassroomInput,
): Promise<Classroom[]> {
  const v = classroomInputSchema.parse(input);
  const occurrences = v.repeat
    ? expandSchedule(v.repeat.schedule, new Date(v.startsAt), v.repeat.weeks)
    : [{ startsAt: new Date(v.startsAt), minutes: v.minutes }];
  if (occurrences.length === 0) throw new Error('schedule');
  const seriesId = v.repeat ? crypto.randomUUID() : null;
  const rows = unwrap(
    await client
      .from('classrooms')
      .insert(
        occurrences.map((o) => ({
          academy_id: v.academyId,
          title: v.title,
          kind: v.kind,
          video_mode: v.videoMode,
          is_public: v.isPublic,
          starts_at: o.startsAt.toISOString(),
          minutes: o.minutes,
          coach_id: v.coachId ?? userId,
          group_id: v.groupId,
          series_id: seriesId,
          created_by: userId,
        })),
      )
      .select(),
  );
  try {
    const targets = rows.flatMap((c) => [
      ...v.groupIds.map((group_id) => ({ classroom_id: c.id, group_id })),
      ...v.studentIds.map((student_id) => ({ classroom_id: c.id, student_id })),
    ]);
    if (targets.length) unwrap(await client.from('classroom_targets').insert(targets));
  } catch (err) {
    await client
      .from('classrooms')
      .delete()
      .in(
        'id',
        rows.map((c) => c.id),
      );
    throw err;
  }
  return rows;
}

export async function updateClassroom(
  client: ErpClient,
  id: string,
  patch: Partial<Pick<Classroom, 'title' | 'starts_at' | 'minutes' | 'video_mode' | 'ended_at'>>,
) {
  unwrap(await client.from('classrooms').update(patch).eq('id', id));
}

export async function deleteClassroom(client: ErpClient, id: string) {
  unwrap(await client.from('classrooms').delete().eq('id', id));
}

/** Xoá các buổi chưa diễn ra của một chuỗi lặp. */
export async function deleteUpcomingInSeries(
  client: ErpClient,
  seriesId: string,
  now = new Date(),
) {
  unwrap(
    await client
      .from('classrooms')
      .delete()
      .eq('series_id', seriesId)
      .gte('starts_at', now.toISOString()),
  );
}

/**
 * Danh sách học viên dự kiến của buổi (để điểm danh): học viên được giao trực tiếp, học viên trong
 * lớp/Batch được giao; lớp công khai thì là mọi học viên của học viện.
 */
export async function fetchClassroomRoster(
  client: ErpClient,
  classroom: ClassroomSummary,
): Promise<string[]> {
  if (classroom.is_public) {
    const rows = unwrap(
      await client
        .from('memberships')
        .select('user_id')
        .eq('academy_id', classroom.academy_id)
        .eq('role', 'student'),
    );
    return rows.map((r) => r.user_id);
  }
  const ids = new Set(classroom.targets.flatMap((t) => (t.student_id ? [t.student_id] : [])));
  const groupIds = classroom.targets.flatMap((t) => (t.group_id ? [t.group_id] : []));
  if (groupIds.length) {
    const rows = unwrap(
      await client.from('group_members').select('student_id').in('group_id', groupIds),
    );
    for (const r of rows) ids.add(r.student_id);
  }
  return [...ids];
}

export async function setAttendance(
  client: ErpClient,
  classroomId: string,
  studentId: string,
  status: AttendanceStatus,
  note = '',
) {
  unwrap(
    await client.from('classroom_attendance').upsert({
      classroom_id: classroomId,
      student_id: studentId,
      status,
      note,
      updated_at: new Date().toISOString(),
    }),
  );
}

/** Học viên vào lớp: tự ghi có mặt (hoặc đi muộn). Trả `null` với staff / người không được giao. */
export async function joinClassroom(
  client: ErpClient,
  classroomId: string,
): Promise<AttendanceStatus | null> {
  return unwrap(
    await client.rpc('classroom_join', { p_classroom: classroomId }),
  ) as AttendanceStatus | null;
}

export async function fetchClassroomEvents(
  client: ErpClient,
  classroomId: string,
): Promise<ClassroomEvent[]> {
  return unwrap(
    await client
      .from('classroom_events')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('id')
      .limit(5000),
  );
}

export async function addClassroomEvent(
  client: ErpClient,
  userId: string,
  classroomId: string,
  kind: ClassroomEvent['kind'],
  payload: Record<string, unknown>,
) {
  unwrap(
    await client.from('classroom_events').insert({
      classroom_id: classroomId,
      actor_id: userId,
      kind,
      payload: payload as Json,
    }),
  );
}

// ── Lịch trống HLV và Calendar ──

export async function fetchAvailability(
  client: ErpClient,
  academyId: string,
): Promise<CoachAvailability[]> {
  return unwrap(
    await client
      .from('coach_availability')
      .select('*')
      .eq('academy_id', academyId)
      .order('day')
      .order('start'),
  );
}

export async function addAvailability(
  client: ErpClient,
  academyId: string,
  slot: { coachId: string; day: number; start: string; minutes: number },
) {
  unwrap(
    await client.from('coach_availability').insert({
      academy_id: academyId,
      coach_id: slot.coachId,
      day: slot.day,
      start: slot.start,
      minutes: slot.minutes,
    }),
  );
}

export async function deleteAvailability(client: ErpClient, id: string) {
  unwrap(await client.from('coach_availability').delete().eq('id', id));
}

export async function fetchCalendarEvents(
  client: ErpClient,
  academyId: string,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  return unwrap(
    await client
      .from('calendar_events')
      .select('*')
      .eq('academy_id', academyId)
      .lt('starts_at', to.toISOString())
      .gt('ends_at', from.toISOString())
      .order('starts_at')
      .limit(2000),
  );
}

export async function createCalendarEvent(
  client: ErpClient,
  userId: string,
  academyId: string,
  e: {
    kind: Exclude<CalendarEventKind, 'class'>;
    title: string;
    coachId: string | null;
    startsAt: Date;
    endsAt: Date;
  },
): Promise<CalendarEvent> {
  const title = e.title.trim();
  if (!title) throw new Error('title');
  return unwrap(
    await client
      .from('calendar_events')
      .insert({
        academy_id: academyId,
        kind: e.kind,
        title,
        coach_id: e.coachId,
        starts_at: e.startsAt.toISOString(),
        ends_at: e.endsAt.toISOString(),
        created_by: userId,
      })
      .select()
      .single(),
  );
}

export async function deleteCalendarEvent(client: ErpClient, id: string) {
  unwrap(await client.from('calendar_events').delete().eq('id', id));
}

// ── Video LiveKit (Giai đoạn 8c) ──

export type VideoToken = {
  token: string;
  url: string;
  mode: 'performance' | 'standard' | 'none';
  runner: boolean;
};

async function invokeLivekit<T>(client: ErpClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.functions.invoke<T>('livekit-token', { body });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    let code: string | undefined;
    if (ctx instanceof Response) {
      try {
        code = ((await ctx.json()) as { error?: string }).error;
      } catch {
        code = undefined;
      }
    }
    throw new ApiError(code ?? error.message, code);
  }
  if (!data) throw new ApiError('Không nhận được phản hồi');
  return data;
}

/** Token vào phòng video của lớp; lỗi `video_not_configured` khi máy chủ chưa có khoá LiveKit. */
export function fetchVideoToken(client: ErpClient, classroomId: string) {
  return invokeLivekit<VideoToken>(client, { classroomId });
}

/** HLV tắt (`on = true`) hoặc mở lại quyền phát của một người trong phòng video. */
export function silenceParticipant(
  client: ErpClient,
  classroomId: string,
  identity: string,
  on: boolean,
) {
  return invokeLivekit<{ ok: true }>(client, { classroomId, silence: identity, on });
}
