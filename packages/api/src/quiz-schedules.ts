/** Lịch quiz tự động (Giai đoạn 24b): cron trên server giao quiz từ chuỗi study theo lịch. */
import { type QuizScheduleInput, quizScheduleSchema } from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { unwrap } from './queries';

export type QuizSchedule = Tables<'quiz_schedules'> & {
  targets: { group_id: string | null; student_id: string | null }[];
};

export async function fetchQuizSchedules(
  client: ErpClient,
  academyId: string,
): Promise<QuizSchedule[]> {
  return unwrap(
    await client
      .from('quiz_schedules')
      .select('*, targets:quiz_schedule_targets(group_id, student_id)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  ) as QuizSchedule[];
}

export async function createQuizSchedule(
  client: ErpClient,
  academyId: string,
  userId: string,
  input: QuizScheduleInput,
): Promise<string> {
  const v = quizScheduleSchema.parse(input);
  const row = unwrap(
    await client
      .from('quiz_schedules')
      .insert({
        academy_id: academyId,
        name: v.name,
        days: v.days,
        at_time: v.atTime,
        timezone: v.timezone,
        expires_on: v.expiresOn,
        study_ids: v.studyIds,
        open_hours: v.openHours,
        created_by: userId,
      })
      .select('id')
      .single(),
  );
  const targets = [
    ...v.groupIds.map((group_id) => ({ schedule_id: row.id, group_id })),
    ...v.studentIds.map((student_id) => ({ schedule_id: row.id, student_id })),
  ];
  unwrap(await client.from('quiz_schedule_targets').insert(targets));
  return row.id;
}

export async function setQuizScheduleActive(client: ErpClient, id: string, active: boolean) {
  unwrap(await client.from('quiz_schedules').update({ active }).eq('id', id));
}

export async function deleteQuizSchedule(client: ErpClient, id: string) {
  unwrap(await client.from('quiz_schedules').delete().eq('id', id));
}

/** Giao ngay quiz từ study kế tiếp; trả id quiz, hoặc null nếu study đó không có câu chấm được. */
export async function runQuizScheduleNow(client: ErpClient, id: string): Promise<string | null> {
  return unwrap(await client.rpc('run_quiz_schedule_now', { p_schedule: id })) ?? null;
}
