/**
 * Truy vấn dùng chung cho web, desktop, mobile. Mọi quyền truy cập do RLS phía DB quyết định;
 * các hàm ở đây chỉ gói lời gọi và ném lỗi khi Supabase trả lỗi.
 */
import {
  type AcademyProfileInput,
  type AcademyRole,
  type ActivityDefaults,
  academyProfileSchema,
  activityDefaultsSchema,
  type BatchMode,
  type BoardPreferences,
  boardPreferencesSchema,
  type CreateAcademyInput,
  type CreateAssignmentInput,
  type CreateStudentInput,
  createAcademySchema,
  createAssignmentSchema,
  createStudentSchema,
  type GroupKind,
  groupNameSchema,
  initialRatingSchema,
  type LevelInput,
  type LoginSection,
  levelSchema,
  levelTemplate,
  loginSectionSchema,
  modeNeedsLocation,
  pinSchema,
  type RatingCategory,
  type ScheduleSlot,
  type SignUpInput,
  type StudentCsvRow,
  scheduleSchema,
  signUpSchema,
  usernameSchema,
} from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { studentEmail } from './student';

export type Academy = Tables<'academies'>;
export type Group = Tables<'groups'>;
export type Profile = Tables<'profiles'>;
export type MyAcademy = Academy & { role: AcademyRole };
export type Member = { role: AcademyRole; levelId: string | null; profile: Profile };
export type GroupWithCount = Group & { studentCount: number };
export type PuzzleRow = Tables<'puzzles'>;
export type Assignment = Tables<'assignments'>;
export type AssignmentSummary = Assignment & {
  itemCount: number;
  targets: { group_id: string | null; student_id: string | null }[];
};
export type AssignmentItem = { id: string; position: number; puzzle: PuzzleRow };
export type AssignmentDetail = Assignment & { items: AssignmentItem[] };
export type AttemptSummary = Pick<
  Tables<'attempts'>,
  'item_id' | 'student_id' | 'solved' | 'tries' | 'time_ms' | 'moves' | 'updated_at'
>;
export type ProgressRow = {
  assignmentId: string;
  studentId: string;
  totalItems: number;
  solvedItems: number;
  tries: number;
  timeMs: number;
  lastActivity: string | null;
};

type Result = { data: unknown; error: { message: string; code?: string } | null };
/** Kiểu `data` của nhánh thành công (nhánh có `error: null`). */
type Success<R extends Result> = Extract<R, { error: null }>['data'];

/** Trả `data` hoặc ném `ApiError` mang mã lỗi của Supabase. */
export function unwrap<R extends Result>(res: R): Success<R> {
  if (res.error) throw new ApiError(res.error.message, res.error.code);
  return res.data as Success<R>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Đăng nhập ──

export async function signInWithEmail(client: ErpClient, email: string, password: string) {
  return unwrap(await client.auth.signInWithPassword({ email, password }));
}

export async function signInStudent(client: ErpClient, username: string, pin: string) {
  const u = usernameSchema.parse(username);
  const p = pinSchema.parse(pin);
  return unwrap(await client.auth.signInWithPassword({ email: studentEmail(u), password: p }));
}

export async function signUp(client: ErpClient, input: SignUpInput, emailRedirectTo?: string) {
  const { displayName, email, password } = signUpSchema.parse(input);
  return unwrap(
    await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo },
    }),
  );
}

export async function signOut(client: ErpClient) {
  const { error } = await client.auth.signOut();
  if (error) throw new ApiError(error.message);
}

// ── Học viện ──

export async function fetchMyAcademies(client: ErpClient, userId: string): Promise<MyAcademy[]> {
  const rows = unwrap(
    await client
      .from('memberships')
      .select('role, academy:academies(*)')
      .eq('user_id', userId)
      .order('created_at'),
  );
  return rows.flatMap((r) => (r.academy ? [{ ...r.academy, role: r.role }] : []));
}

export async function createAcademy(client: ErpClient, input: CreateAcademyInput) {
  const { name, slug } = createAcademySchema.parse(input);
  return unwrap(await client.rpc('create_academy', { p_name: name, p_slug: slug }));
}

export async function fetchMembers(client: ErpClient, academyId: string): Promise<Member[]> {
  const rows = unwrap(
    await client
      .from('memberships')
      .select('role, level_id, profile:profiles(*)')
      .eq('academy_id', academyId)
      .order('created_at'),
  );
  return rows.flatMap((r) =>
    r.profile ? [{ role: r.role, levelId: r.level_id, profile: r.profile }] : [],
  );
}

// ── Lớp học ──

export async function fetchGroups(client: ErpClient, academyId: string): Promise<GroupWithCount[]> {
  const rows = unwrap(
    await client
      .from('groups')
      .select('*, group_members(count)')
      .eq('academy_id', academyId)
      .order('name'),
  );
  return rows.map(({ group_members, ...g }) => ({
    ...g,
    studentCount: group_members[0]?.count ?? 0,
  }));
}

export async function createGroup(
  client: ErpClient,
  academyId: string,
  name: string,
  coachId?: string,
) {
  return unwrap(
    await client
      .from('groups')
      .insert({ academy_id: academyId, name: groupNameSchema.parse(name), coach_id: coachId })
      .select()
      .single(),
  );
}

export async function fetchGroupStudentIds(client: ErpClient, groupId: string): Promise<string[]> {
  const rows = unwrap(
    await client.from('group_members').select('student_id').eq('group_id', groupId),
  );
  return rows.map((r) => r.student_id);
}

export async function addStudentToGroup(client: ErpClient, groupId: string, studentId: string) {
  unwrap(await client.from('group_members').insert({ group_id: groupId, student_id: studentId }));
}

export async function removeStudentFromGroup(
  client: ErpClient,
  groupId: string,
  studentId: string,
) {
  unwrap(
    await client.from('group_members').delete().eq('group_id', groupId).eq('student_id', studentId),
  );
}

// ── Học viên ──

export type CreateStudentResult = { studentId: string; username: string; warning?: string };

export async function createStudent(
  client: ErpClient,
  input: CreateStudentInput,
): Promise<CreateStudentResult> {
  const body = createStudentSchema.parse(input);
  const { data, error } = await client.functions.invoke<CreateStudentResult>('create-student', {
    body,
  });
  if (error) {
    // FunctionsHttpError mang Response gốc trong `context`
    const payload = await readErrorBody(error);
    throw new ApiError(payload?.message ?? error.message, payload?.error);
  }
  if (!data) throw new ApiError('Không nhận được phản hồi');
  return data;
}

async function readErrorBody(error: unknown): Promise<{ error?: string; message?: string } | null> {
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      return (await ctx.json()) as { error?: string; message?: string };
    } catch {
      return null;
    }
  }
  return null;
}

// ── Lời mời ──

export async function createInvitation(
  client: ErpClient,
  academyId: string,
  role: 'coach' | 'parent',
  options: { email?: string; studentId?: string } = {},
) {
  return unwrap(
    await client.rpc('create_invitation', {
      p_academy: academyId,
      p_role: role,
      p_email: options.email,
      p_student: options.studentId,
    }),
  );
}

export async function acceptInvitation(client: ErpClient, token: string): Promise<string> {
  return unwrap(await client.rpc('accept_invitation', { p_token: token }));
}

// ── Puzzle ──

/** Thư viện chung (academy_id null) cộng puzzle riêng của học viện. */
export async function fetchPuzzles(client: ErpClient, academyId: string): Promise<PuzzleRow[]> {
  return unwrap(
    await client
      .from('puzzles')
      .select('*')
      .or(`academy_id.is.null,academy_id.eq.${academyId}`)
      .order('rating')
      .order('title'),
  );
}

// ── Bài tập ──

/** Bài tập người dùng được xem trong học viện (RLS lọc: staff thấy hết, học viên thấy bài được giao). */
export async function fetchAssignments(
  client: ErpClient,
  academyId: string,
): Promise<AssignmentSummary[]> {
  const rows = unwrap(
    await client
      .from('assignments')
      .select('*, assignment_items(count), assignment_targets(group_id, student_id)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );
  return rows.map(({ assignment_items, assignment_targets, ...a }) => ({
    ...a,
    itemCount: assignment_items[0]?.count ?? 0,
    targets: assignment_targets,
  }));
}

export async function fetchAssignment(client: ErpClient, id: string): Promise<AssignmentDetail> {
  const row = unwrap(
    await client
      .from('assignments')
      .select('*, assignment_items(id, position, puzzle:puzzles(*))')
      .eq('id', id)
      .single(),
  );
  const { assignment_items, ...a } = row;
  return {
    ...a,
    items: assignment_items
      .flatMap((i) => (i.puzzle ? [{ id: i.id, position: i.position, puzzle: i.puzzle }] : []))
      .sort((x, y) => x.position - y.position),
  };
}

/**
 * Tạo bài tập kèm đối tượng giao và danh sách puzzle. PostgREST không có transaction nhiều bảng,
 * nên nếu bước sau lỗi thì xoá bài vừa tạo (cascade) để không để lại bài dở dang.
 */
export async function createAssignment(
  client: ErpClient,
  input: CreateAssignmentInput,
): Promise<Assignment> {
  const v = createAssignmentSchema.parse(input);
  const assignment = unwrap(
    await client
      .from('assignments')
      .insert({
        academy_id: v.academyId,
        title: v.title,
        instructions: v.instructions || null,
        due_at: v.dueAt ?? null,
      })
      .select()
      .single(),
  );
  try {
    unwrap(
      await client
        .from('assignment_targets')
        .insert([
          ...v.groupIds.map((group_id) => ({ assignment_id: assignment.id, group_id })),
          ...v.studentIds.map((student_id) => ({ assignment_id: assignment.id, student_id })),
        ]),
    );
    unwrap(
      await client.from('assignment_items').insert(
        v.puzzleIds.map((puzzle_id, position) => ({
          assignment_id: assignment.id,
          position,
          puzzle_id,
        })),
      ),
    );
  } catch (err) {
    await client.from('assignments').delete().eq('id', assignment.id);
    throw err;
  }
  return assignment;
}

export async function deleteAssignment(client: ErpClient, id: string) {
  unwrap(await client.from('assignments').delete().eq('id', id));
}

/** Các lần làm bài của một bài tập; truyền `studentId` để chỉ lấy của một học viên. */
export async function fetchAttempts(
  client: ErpClient,
  itemIds: string[],
  studentId?: string,
): Promise<AttemptSummary[]> {
  if (itemIds.length === 0) return [];
  let q = client
    .from('attempts')
    .select('item_id, student_id, solved, tries, time_ms, moves, updated_at')
    .in('item_id', itemIds);
  if (studentId) q = q.eq('student_id', studentId);
  return unwrap(await q);
}

export async function fetchProgress(
  client: ErpClient,
  filter: { assignmentId?: string; academyId?: string },
): Promise<ProgressRow[]> {
  let q = client.from('assignment_progress').select('*');
  if (filter.assignmentId) q = q.eq('assignment_id', filter.assignmentId);
  if (filter.academyId) q = q.eq('academy_id', filter.academyId);
  const rows = unwrap(await q);
  return rows.flatMap((r) =>
    r.assignment_id && r.student_id
      ? [
          {
            assignmentId: r.assignment_id,
            studentId: r.student_id,
            totalItems: r.total_items ?? 0,
            solvedItems: r.solved_items ?? 0,
            tries: r.tries ?? 0,
            timeMs: Number(r.time_ms ?? 0),
            lastActivity: r.last_activity,
          },
        ]
      : [],
  );
}

export type SubmitAttemptResult = {
  solved: boolean;
  solvedThisTry: boolean;
  tries: number;
  results: { uci: string; ok: boolean }[];
};

/** Nộp một lượt thử; server (Edge Function `submit-attempt`) chấm lại và lưu. */
export async function submitAttempt(
  client: ErpClient,
  itemId: string,
  moves: { uci: string; ms: number }[],
): Promise<SubmitAttemptResult> {
  const { data, error } = await client.functions.invoke<SubmitAttemptResult>('submit-attempt', {
    body: { itemId, moves },
  });
  if (error) {
    const payload = await readErrorBody(error);
    throw new ApiError(payload?.message ?? payload?.error ?? error.message, payload?.error);
  }
  if (!data) throw new ApiError('Không nhận được phản hồi');
  return data;
}

// ── Quản trị học viện (Giai đoạn 5) ──

export type Level = Tables<'levels'>;
export type RatingRow = Tables<'ratings'>;
export type LeaderboardRow = {
  studentId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  solved: number;
  tries: number;
};
export type AcademyStats = {
  students: number;
  staff: number;
  groups: number;
  batches: number;
  assignments: number;
  attemptsWeek: number;
};

function levelRow(input: LevelInput) {
  const v = levelSchema.parse(input);
  return {
    name: v.name,
    min_rating: v.minRating,
    max_rating: v.maxRating,
    color: v.color,
    criteria: v.criteria,
  };
}

export async function fetchLevels(client: ErpClient, academyId: string): Promise<Level[]> {
  return unwrap(
    await client.from('levels').select('*').eq('academy_id', academyId).order('position'),
  );
}

export async function createLevel(
  client: ErpClient,
  academyId: string,
  input: LevelInput,
  position: number,
): Promise<Level> {
  return unwrap(
    await client
      .from('levels')
      .insert({ academy_id: academyId, position, ...levelRow(input) })
      .select()
      .single(),
  );
}

/** Tạo lộ trình mẫu, nối tiếp sau các cấp đã có. */
export async function createLevelsFromTemplate(
  client: ErpClient,
  academyId: string,
  startPosition = 0,
): Promise<Level[]> {
  return unwrap(
    await client
      .from('levels')
      .insert(
        levelTemplate.map((l, i) => ({
          academy_id: academyId,
          position: startPosition + i,
          ...levelRow(l),
        })),
      )
      .select(),
  );
}

export async function updateLevel(client: ErpClient, id: string, input: LevelInput) {
  unwrap(await client.from('levels').update(levelRow(input)).eq('id', id));
}

export async function deleteLevel(client: ErpClient, id: string) {
  unwrap(await client.from('levels').delete().eq('id', id));
}

export async function setStudentLevel(
  client: ErpClient,
  academyId: string,
  studentId: string,
  levelId: string | null,
) {
  unwrap(
    await client.rpc('set_student_level', {
      p_academy: academyId,
      p_student: studentId,
      // Hàm SQL nhận null để gỡ cấp; kiểu sinh tự động không thể hiện tham số nullable
      p_level: levelId as string,
    }),
  );
}

export type GroupPatch = {
  name?: string;
  kind?: GroupKind;
  levelId?: string | null;
  schedule?: ScheduleSlot[];
  /** Hình thức học (Giai đoạn 23a); offline/hybrid phải kèm `locationId`. */
  mode?: BatchMode;
  locationId?: string | null;
};

export async function updateGroup(client: ErpClient, id: string, patch: GroupPatch) {
  if (patch.mode !== undefined && modeNeedsLocation(patch.mode) && !patch.locationId) {
    throw new Error('location');
  }
  unwrap(
    await client
      .from('groups')
      .update({
        ...(patch.name !== undefined ? { name: groupNameSchema.parse(patch.name) } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.levelId !== undefined ? { level_id: patch.levelId } : {}),
        ...(patch.schedule !== undefined ? { schedule: scheduleSchema.parse(patch.schedule) } : {}),
        ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
        // Học online thì gỡ địa điểm
        ...(patch.mode === 'online'
          ? { location_id: null }
          : patch.locationId !== undefined
            ? { location_id: patch.locationId }
            : {}),
      })
      .eq('id', id),
  );
}

export async function deleteGroup(client: ErpClient, id: string) {
  unwrap(await client.from('groups').delete().eq('id', id));
}

export async function fetchRatings(client: ErpClient, academyId: string): Promise<RatingRow[]> {
  return unwrap(await client.from('ratings').select('*').eq('academy_id', academyId));
}

/** HLV đặt rating ban đầu (hoặc chỉnh tay); RD đặt lại 350 vì chưa có ván nào kiểm chứng. */
export async function setInitialRating(
  client: ErpClient,
  academyId: string,
  studentId: string,
  category: RatingCategory,
  rating: number,
) {
  unwrap(
    await client.from('ratings').upsert({
      academy_id: academyId,
      student_id: studentId,
      category,
      rating: initialRatingSchema.parse(rating),
      rd: 350,
      updated_at: new Date().toISOString(),
    }),
  );
}

export async function fetchLeaderboard(
  client: ErpClient,
  academyId: string,
  from: Date,
  to: Date,
): Promise<LeaderboardRow[]> {
  const rows = unwrap(
    await client.rpc('academy_leaderboard', {
      p_academy: academyId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  );
  return rows.map((r) => ({
    studentId: r.student_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    points: r.points,
    solved: r.solved,
    tries: r.tries,
  }));
}

/** Số liệu tổng quan; chỉ staff nhận được dữ liệu (người khác nhận `null`). */
export async function fetchAcademyStats(
  client: ErpClient,
  academyId: string,
): Promise<AcademyStats | null> {
  const [row] = unwrap(await client.rpc('academy_stats', { p_academy: academyId }));
  if (!row) return null;
  return {
    students: row.students,
    staff: row.staff,
    groups: row.groups,
    batches: row.batches,
    assignments: row.assignments,
    attemptsWeek: row.attempts_week,
  };
}

export async function updateAcademyProfile(
  client: ErpClient,
  academyId: string,
  input: AcademyProfileInput,
) {
  const v = academyProfileSchema.parse(input);
  const socials = Object.fromEntries(Object.entries(v.socials).filter(([, url]) => url));
  const contact = Object.fromEntries(Object.entries(v.contact).filter(([, value]) => value));
  unwrap(
    await client
      .from('academies')
      .update({
        name: v.name,
        description: v.description,
        logo_url: v.logoUrl,
        favicon_url: v.faviconUrl,
        brand_color: v.brandColor,
        socials,
        contact,
        login_background_url: v.loginBackgroundUrl,
        login_sections: v.loginSections,
      })
      .eq('id', academyId),
  );
}

/** Tải logo/favicon lên bucket công khai `academy-branding`, trả link https để lưu vào hồ sơ. */
export async function uploadAcademyBranding(
  client: ErpClient,
  academyId: string,
  kind: 'logo' | 'favicon' | 'login',
  file: File | Blob,
  name: string,
): Promise<string> {
  const ext = (name.toLowerCase().match(/\.(png|jpe?g|webp|svg|ico)$/)?.[1] ?? 'png').replace(
    'jpeg',
    'jpg',
  );
  const path = `${academyId}/${kind}-${Date.now()}.${ext}`;
  unwrap(await client.storage.from('academy-branding').upload(path, file, { upsert: false }));
  return client.storage.from('academy-branding').getPublicUrl(path).data.publicUrl;
}

export type ImportResult = { username: string; ok: boolean; error?: string };

/**
 * Tạo lần lượt các học viên từ CSV (Edge Function `create-student` mỗi người một lần). Lớp ghi theo tên;
 * tên không khớp lớp nào thì học viên vẫn được tạo nhưng không vào lớp. Lỗi của một dòng không dừng cả lô.
 */
export async function importStudents(
  client: ErpClient,
  academyId: string,
  rows: readonly StudentCsvRow[],
  groups: readonly Pick<Group, 'id' | 'name'>[],
  onProgress?: (done: number) => void,
): Promise<ImportResult[]> {
  const byName = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g.id]));
  const results: ImportResult[] = [];
  for (const row of rows) {
    try {
      await createStudent(client, {
        academyId,
        displayName: row.displayName,
        username: row.username,
        pin: row.pin,
        groupId: row.group ? byName.get(row.group.trim().toLowerCase()) : undefined,
      });
      results.push({ username: row.username, ok: true });
    } catch (err) {
      // Lỗi kiểm tra dữ liệu (Zod) trả mã của trường sai, lỗi server trả mã từ Edge Function
      const issue = (err as { issues?: { message: string }[] }).issues?.[0];
      const error =
        err instanceof ApiError
          ? (err.code ?? err.message)
          : (issue?.message ?? (err instanceof Error ? err.message : String(err)));
      results.push({ username: row.username, ok: false, error });
    }
    onProgress?.(results.length);
  }
  return results;
}

/** Mọi cặp lớp–học viên của học viện (dùng khi xuất CSV). */
export async function fetchGroupMemberships(
  client: ErpClient,
  academyId: string,
): Promise<{ groupId: string; studentId: string }[]> {
  const rows = unwrap(
    await client
      .from('group_members')
      .select('group_id, student_id, groups!inner(academy_id)')
      .eq('groups.academy_id', academyId),
  );
  return rows.map((r) => ({ groupId: r.group_id, studentId: r.student_id }));
}

/**
 * Bàn cờ mặc định của học viện (Giai đoạn 23f); `null` là bỏ mặc định. Lưu riêng, không qua
 * `updateAcademyProfile`, để hai form không ghi đè nhau.
 */
export async function updateAcademyBoardDefaults(
  client: ErpClient,
  academyId: string,
  prefs: BoardPreferences | null,
) {
  const value = prefs ? boardPreferencesSchema.parse(prefs) : {};
  unwrap(await client.from('academies').update({ board_defaults: value }).eq('id', academyId));
}

/** Hoạt động mặc định theo loại cho cả học viện (Giai đoạn 24d); lưu riêng như bàn cờ mặc định. */
export async function updateAcademyActivityDefaults(
  client: ErpClient,
  academyId: string,
  defaults: ActivityDefaults,
) {
  const value = activityDefaultsSchema.parse(defaults);
  unwrap(await client.from('academies').update({ activity_defaults: value }).eq('id', academyId));
}

/** Thông tin công khai cho trang đăng nhập riêng `/login/<slug>` (Giai đoạn 23d). */
export type LoginBranding = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor: string | null;
  backgroundUrl: string | null;
  sections: LoginSection[];
};

/** Khách chưa đăng nhập gọi được; slug không tồn tại thì trả null. */
export async function fetchLoginBranding(
  client: ErpClient,
  slug: string,
): Promise<LoginBranding | null> {
  const raw = unwrap(await client.rpc('academy_login_branding', { p_slug: slug })) as Record<
    string,
    unknown
  > | null;
  if (!raw) return null;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const sections = Array.isArray(raw.login_sections) ? raw.login_sections : [];
  return {
    name: String(raw.name ?? ''),
    slug: String(raw.slug ?? slug),
    description: String(raw.description ?? ''),
    logoUrl: str(raw.logo_url),
    faviconUrl: str(raw.favicon_url),
    brandColor: str(raw.brand_color),
    backgroundUrl: str(raw.login_background_url),
    sections: sections.flatMap((s) => {
      const r = loginSectionSchema.safeParse(s);
      return r.success ? [r.data] : [];
    }),
  };
}
