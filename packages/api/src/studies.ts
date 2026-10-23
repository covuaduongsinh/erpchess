/** Truy vấn Study (Giai đoạn 6): học liệu, hoạt động, tiến độ, media, collection. */
import {
  type Activity,
  type ActivityInput,
  activityInputSchema,
  type StudyInput,
  type StudyVisibility,
  studyInputSchema,
} from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Json, Tables } from './database.types';
import { ApiError, unwrap } from './queries';

export type StudyRow = Tables<'studies'>;
export type StudySummary = StudyRow & { activityCount: number };
/** Hoạt động đã kiểm schema; `invalid` khi payload trong DB không còn khớp (hiện cảnh báo thay vì vỡ). */
export type StudyActivity = { id: string; position: number } & (
  | (Activity & { invalid?: false })
  | { invalid: true; kind: string; title: string }
);
export type StudyDetail = StudyRow & { activities: StudyActivity[] };
export type StudyScope = 'mine' | 'academy' | 'public';
export type ActivityAttempt = Pick<
  Tables<'activity_attempts'>,
  'activity_id' | 'student_id' | 'tries' | 'solved' | 'score' | 'time_ms' | 'updated_at'
>;
export type StudyProgressRow = {
  studyId: string;
  studentId: string;
  totalActivities: number;
  completed: number;
  score: number;
  timeMs: number;
  lastActivity: string | null;
};
export type Collection = Tables<'study_collections'> & { studyIds: string[] };

/** Hàng DB → hoạt động dạng camelCase đã kiểm schema. */
export function toStudyActivity(row: Tables<'study_activities'>): StudyActivity {
  const parsed = activityInputSchema.safeParse({
    kind: row.kind,
    payload: row.payload,
    title: row.title,
    points: row.points,
    maxAttempts: row.max_attempts,
    timeLimitS: row.time_limit_s,
    wrongPenalty: row.wrong_penalty,
    hintPenalty: row.hint_penalty,
    topics: row.topics,
  });
  return parsed.success
    ? { id: row.id, position: row.position, ...parsed.data }
    : { id: row.id, position: row.position, invalid: true, kind: row.kind, title: row.title };
}

function activityRow(input: ActivityInput) {
  const a = activityInputSchema.parse(input);
  return {
    kind: a.kind,
    payload: a.payload as unknown as Json,
    title: a.title,
    points: a.points,
    max_attempts: a.maxAttempts,
    time_limit_s: a.timeLimitS,
    wrong_penalty: a.wrongPenalty,
    hint_penalty: a.hintPenalty,
    topics: a.topics,
  };
}

/**
 * Study theo phạm vi: `mine` = do tôi soạn, `academy` = chia sẻ trong học viện,
 * `public` = thư viện chung. RLS đã lọc những gì người dùng được xem.
 */
export async function fetchStudies(
  client: ErpClient,
  opts: { scope: StudyScope; academyId: string; userId: string; search?: string },
): Promise<StudySummary[]> {
  let q = client
    .from('studies')
    .select('*, study_activities(count)')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (opts.scope === 'mine') q = q.eq('created_by', opts.userId);
  if (opts.scope === 'academy') {
    q = q.eq('academy_id', opts.academyId).eq('visibility', 'academy');
  }
  if (opts.scope === 'public') q = q.eq('visibility', 'public');
  const term = opts.search?.trim();
  if (term) q = q.ilike('title', `%${term.replace(/[%_]/g, '')}%`);
  const rows = unwrap(await q);
  return rows.map(({ study_activities, ...s }) => ({
    ...s,
    activityCount: study_activities[0]?.count ?? 0,
  }));
}

export async function fetchStudy(client: ErpClient, id: string): Promise<StudyDetail> {
  const { study_activities, ...study } = unwrap(
    await client.from('studies').select('*, study_activities(*)').eq('id', id).single(),
  );
  return {
    ...study,
    activities: study_activities.sort((a, b) => a.position - b.position).map(toStudyActivity),
  };
}

export async function createStudy(
  client: ErpClient,
  userId: string,
  input: StudyInput,
): Promise<StudyRow> {
  const v = studyInputSchema.parse(input);
  return unwrap(
    await client
      .from('studies')
      .insert({
        academy_id: v.academyId,
        title: v.title,
        description: v.description,
        level_id: v.levelId,
        visibility: v.visibility,
        created_by: userId,
      })
      .select()
      .single(),
  );
}

export async function updateStudy(
  client: ErpClient,
  id: string,
  patch: {
    title?: string;
    description?: string;
    levelId?: string | null;
    visibility?: StudyVisibility;
  },
) {
  unwrap(
    await client
      .from('studies')
      .update({
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
        ...(patch.levelId !== undefined ? { level_id: patch.levelId } : {}),
        ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
      })
      .eq('id', id),
  );
}

export async function deleteStudy(client: ErpClient, id: string) {
  unwrap(await client.from('studies').delete().eq('id', id));
}

export async function addActivity(
  client: ErpClient,
  studyId: string,
  input: ActivityInput,
  position: number,
): Promise<StudyActivity> {
  const row = unwrap(
    await client
      .from('study_activities')
      .insert({ study_id: studyId, position, ...activityRow(input) })
      .select()
      .single(),
  );
  return toStudyActivity(row);
}

export async function updateActivity(client: ErpClient, id: string, input: ActivityInput) {
  unwrap(await client.from('study_activities').update(activityRow(input)).eq('id', id));
}

export async function deleteActivity(client: ErpClient, id: string) {
  unwrap(await client.from('study_activities').delete().eq('id', id));
}

/**
 * Đặt lại thứ tự theo `orderedIds`. Mỗi lệnh PostgREST là một transaction riêng nên ràng buộc
 * unique(study_id, position) không hoãn được qua nhiều lệnh: dời tạm lên vùng cao rồi mới đặt lại.
 */
export async function reorderActivities(client: ErpClient, orderedIds: readonly string[]) {
  const OFFSET = 100_000;
  for (const [i, id] of orderedIds.entries()) {
    unwrap(
      await client
        .from('study_activities')
        .update({ position: OFFSET + i })
        .eq('id', id),
    );
  }
  for (const [i, id] of orderedIds.entries()) {
    unwrap(await client.from('study_activities').update({ position: i }).eq('id', id));
  }
}

export async function fetchActivityAttempts(
  client: ErpClient,
  activityIds: readonly string[],
  studentId?: string,
): Promise<ActivityAttempt[]> {
  if (activityIds.length === 0) return [];
  let q = client
    .from('activity_attempts')
    .select('activity_id, student_id, tries, solved, score, time_ms, updated_at')
    .in('activity_id', [...activityIds]);
  if (studentId) q = q.eq('student_id', studentId);
  return unwrap(await q);
}

export async function fetchStudyProgress(
  client: ErpClient,
  studyIds: readonly string[],
): Promise<StudyProgressRow[]> {
  if (studyIds.length === 0) return [];
  const rows = unwrap(
    await client
      .from('study_progress')
      .select('*')
      .in('study_id', [...studyIds]),
  );
  return rows.flatMap((r) =>
    r.study_id && r.student_id
      ? [
          {
            studyId: r.study_id,
            studentId: r.student_id,
            totalActivities: r.total_activities ?? 0,
            completed: r.completed ?? 0,
            score: r.score ?? 0,
            timeMs: Number(r.time_ms ?? 0),
            lastActivity: r.last_activity,
          },
        ]
      : [],
  );
}

export type ActivityAnswer =
  | { moves: string[] }
  | { choice: number }
  | { result: 'win' | 'draw' | 'loss' }
  | { viewed: true };

export type SubmitActivityResult = {
  solved: boolean;
  solvedThisTry: boolean;
  tries: number;
  score: number;
  correct?: number;
  captured?: number;
  remaining?: number;
  results?: { uci: string; ok: boolean }[];
};

/** Nộp kết quả một hoạt động; Edge Function `submit-activity` chấm lại và lưu. */
export async function submitActivity(
  client: ErpClient,
  activityId: string,
  answer: ActivityAnswer,
  ms = 0,
): Promise<SubmitActivityResult> {
  const { data, error } = await client.functions.invoke<SubmitActivityResult>('submit-activity', {
    body: { activityId, answer, ms: Math.round(ms) },
  });
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

// ── Media (bucket study-media, riêng tư) ──

const STORAGE_PREFIX = 'storage:study-media/';

/** Tải tệp lên `<academy>/<study>/<thời điểm>-<tên>`; trả giá trị lưu trong payload video/ảnh. */
export async function uploadStudyMedia(
  client: ErpClient,
  academyId: string,
  studyId: string,
  file: File | Blob,
  name: string,
): Promise<string> {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .slice(-80);
  const path = `${academyId}/${studyId}/${Date.now()}-${safe}`;
  unwrap(await client.storage.from('study-media').upload(path, file, { upsert: false }));
  return `${STORAGE_PREFIX}${path}`;
}

/** Đổi giá trị trong payload thành URL xem được: link https giữ nguyên, tệp trong bucket thì ký URL 1 giờ. */
export async function resolveMediaUrl(client: ErpClient, value: string): Promise<string> {
  if (!value.startsWith(STORAGE_PREFIX)) return value;
  const { signedUrl } = unwrap(
    await client.storage
      .from('study-media')
      .createSignedUrl(value.slice(STORAGE_PREFIX.length), 3600),
  );
  return signedUrl;
}

// ── Collection ──

export async function fetchCollections(
  client: ErpClient,
  academyId: string,
): Promise<Collection[]> {
  const rows = unwrap(
    await client
      .from('study_collections')
      .select('*, study_collection_items(study_id, position)')
      .eq('academy_id', academyId)
      .order('name'),
  );
  return rows.map(({ study_collection_items, ...c }) => ({
    ...c,
    studyIds: [...study_collection_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => i.study_id),
  }));
}

export async function createCollection(
  client: ErpClient,
  academyId: string,
  userId: string,
  name: string,
) {
  return unwrap(
    await client
      .from('study_collections')
      .insert({ academy_id: academyId, name: name.trim(), created_by: userId })
      .select()
      .single(),
  );
}

export async function setCollectionStudy(
  client: ErpClient,
  collectionId: string,
  studyId: string,
  included: boolean,
  position = 0,
) {
  unwrap(
    included
      ? await client
          .from('study_collection_items')
          .upsert({ collection_id: collectionId, study_id: studyId, position })
      : await client
          .from('study_collection_items')
          .delete()
          .eq('collection_id', collectionId)
          .eq('study_id', studyId),
  );
}

export async function deleteCollection(client: ErpClient, id: string) {
  unwrap(await client.from('study_collections').delete().eq('id', id));
}
