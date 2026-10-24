/** Khoá học (Giai đoạn 11): lộ trình học liệu, giao, tiến độ, XP và chuỗi ngày học. */
import { type CourseInput, courseInputSchema } from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { unwrap } from './queries';

export type Course = Tables<'courses'>;
export type CourseItem = Tables<'course_items'> & {
  study: { id: string; title: string; level_id: string | null; activityCount: number } | null;
};
export type CourseSummary = Course & {
  itemCount: number;
  targets: { group_id: string | null; student_id: string | null }[];
};
export type CourseDetail = Course & {
  items: CourseItem[];
  targets: { group_id: string | null; student_id: string | null }[];
};
export type CourseProgressRow = Tables<'course_progress'>;
export type StudentXp = {
  total: number;
  today: number;
  days: string[];
  nextLevel: string | null;
  nextLevelXp: number | null;
};

export async function fetchCourses(client: ErpClient, academyId: string): Promise<CourseSummary[]> {
  const rows = unwrap(
    await client
      .from('courses')
      .select('*, course_items(count), course_targets(group_id, student_id)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );
  return rows.map(({ course_items, course_targets, ...c }) => ({
    ...c,
    itemCount: course_items[0]?.count ?? 0,
    targets: course_targets,
  }));
}

export async function fetchCourse(client: ErpClient, id: string): Promise<CourseDetail> {
  const { course_items, course_targets, ...c } = unwrap(
    await client
      .from('courses')
      .select(
        '*, course_items(*, studies(id, title, level_id, study_activities(count))), course_targets(group_id, student_id)',
      )
      .eq('id', id)
      .single(),
  );
  return {
    ...c,
    targets: course_targets,
    items: [...course_items]
      .sort((a, b) => a.position - b.position)
      .map(({ studies, ...it }) => ({
        ...it,
        study: studies
          ? {
              id: studies.id,
              title: studies.title,
              level_id: studies.level_id,
              activityCount: studies.study_activities[0]?.count ?? 0,
            }
          : null,
      })),
  };
}

export async function createCourse(
  client: ErpClient,
  userId: string,
  input: CourseInput,
): Promise<Course> {
  const v = courseInputSchema.parse(input);
  return unwrap(
    await client
      .from('courses')
      .insert({
        academy_id: v.academyId,
        title: v.title,
        description: v.description,
        level_id: v.levelId,
        open_to_all: v.openToAll,
        auto_certificate: v.autoCertificate,
        created_by: userId,
      })
      .select()
      .single(),
  );
}

export async function updateCourse(
  client: ErpClient,
  id: string,
  patch: Partial<
    Pick<
      Course,
      'title' | 'description' | 'level_id' | 'open_to_all' | 'auto_certificate' | 'status'
    >
  >,
) {
  unwrap(await client.from('courses').update(patch).eq('id', id));
}

export async function deleteCourse(client: ErpClient, id: string) {
  unwrap(await client.from('courses').delete().eq('id', id));
}

/** Thay toàn bộ lộ trình (thứ tự = vị trí trong mảng); sau đó tính lại người đã hoàn thành. */
export async function setCourseItems(
  client: ErpClient,
  courseId: string,
  items: readonly { studyId: string; required: boolean }[],
) {
  unwrap(await client.from('course_items').delete().eq('course_id', courseId));
  if (items.length) {
    unwrap(
      await client.from('course_items').insert(
        items.map((it, position) => ({
          course_id: courseId,
          position,
          study_id: it.studyId,
          required: it.required,
        })),
      ),
    );
  }
  await recheckCourse(client, courseId);
}

/** Thay danh sách người được giao (lớp/học viên). */
export async function setCourseTargets(
  client: ErpClient,
  courseId: string,
  groupIds: readonly string[],
  studentIds: readonly string[],
) {
  unwrap(await client.from('course_targets').delete().eq('course_id', courseId));
  const rows = [
    ...groupIds.map((group_id) => ({ course_id: courseId, group_id })),
    ...studentIds.map((student_id) => ({ course_id: courseId, student_id })),
  ];
  if (rows.length) unwrap(await client.from('course_targets').insert(rows));
  await recheckCourse(client, courseId);
}

/** Ghi nhận hoàn thành cho người đã học xong từ trước (trả số người vừa hoàn thành). */
export async function recheckCourse(client: ErpClient, courseId: string): Promise<number> {
  return unwrap(await client.rpc('recheck_course', { p_course: courseId })) ?? 0;
}

export async function fetchCourseProgress(
  client: ErpClient,
  courseIds: readonly string[],
): Promise<CourseProgressRow[]> {
  if (courseIds.length === 0) return [];
  return unwrap(
    await client
      .from('course_progress')
      .select('*')
      .in('course_id', [...courseIds]),
  );
}

export async function fetchCourseCompletions(
  client: ErpClient,
  courseIds: readonly string[],
): Promise<Tables<'course_completions'>[]> {
  if (courseIds.length === 0) return [];
  return unwrap(
    await client
      .from('course_completions')
      .select('*')
      .in('course_id', [...courseIds]),
  );
}

export async function fetchStudentXp(
  client: ErpClient,
  studentId: string,
  academyId?: string,
): Promise<StudentXp> {
  const rows = unwrap(
    await client.rpc('student_xp', { p_student: studentId, p_academy: academyId }),
  );
  const r = rows[0];
  return {
    total: r?.total ?? 0,
    today: r?.today ?? 0,
    days: r?.days ?? [],
    nextLevel: r?.next_level ?? null,
    nextLevelXp: r?.next_level_xp ?? null,
  };
}

export async function fetchXpLeaderboard(
  client: ErpClient,
  academyId: string,
  range: { from?: string; to?: string } = {},
): Promise<{ studentId: string; displayName: string; xp: number }[]> {
  const rows = unwrap(
    await client.rpc('xp_leaderboard', {
      p_academy: academyId,
      p_from: range.from,
      p_to: range.to,
    }),
  );
  return rows.map((r) => ({ studentId: r.student_id, displayName: r.display_name, xp: r.xp }));
}
