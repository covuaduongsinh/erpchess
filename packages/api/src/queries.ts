/**
 * Truy vấn dùng chung cho web, desktop, mobile. Mọi quyền truy cập do RLS phía DB quyết định;
 * các hàm ở đây chỉ gói lời gọi và ném lỗi khi Supabase trả lỗi.
 */
import {
  type AcademyRole,
  type CreateAcademyInput,
  type CreateAssignmentInput,
  type CreateStudentInput,
  createAcademySchema,
  createAssignmentSchema,
  createStudentSchema,
  groupNameSchema,
  pinSchema,
  type SignUpInput,
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
export type Member = { role: AcademyRole; profile: Profile };
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

function unwrap<R extends Result>(res: R): Success<R> {
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
      .select('role, profile:profiles(*)')
      .eq('academy_id', academyId)
      .order('created_at'),
  );
  return rows.flatMap((r) => (r.profile ? [{ role: r.role, profile: r.profile }] : []));
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
