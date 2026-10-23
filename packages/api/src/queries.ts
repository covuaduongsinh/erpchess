/**
 * Truy vấn dùng chung cho web, desktop, mobile. Mọi quyền truy cập do RLS phía DB quyết định;
 * các hàm ở đây chỉ gói lời gọi và ném lỗi khi Supabase trả lỗi.
 */
import {
  type AcademyRole,
  type CreateAcademyInput,
  type CreateStudentInput,
  createAcademySchema,
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
