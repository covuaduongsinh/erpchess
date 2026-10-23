// Smoke test Giai đoạn 2 trên một project Supabase thật.
// Chạy: SUPABASE_URL=… SUPABASE_KEY=… OWNER_EMAIL=… OWNER_PASSWORD=… node scripts/smoke-phase2.mjs
// Tạo học viện/lớp/học viên với hậu tố ngẫu nhiên; in ra id để dọn dẹp sau.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_KEY, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Thiếu biến môi trường');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const suffix = Math.random().toString(36).slice(2, 8);
let failures = 0;

function check(cond, label, extra) {
  console.log(
    `${cond ? 'ok    ' : 'NOT OK'} ${label}${extra ? ` — ${JSON.stringify(extra)}` : ''}`,
  );
  if (!cond) failures++;
}

const owner = createClient(SUPABASE_URL, SUPABASE_KEY, opts);
const signIn = await owner.auth.signInWithPassword({
  email: OWNER_EMAIL,
  password: OWNER_PASSWORD,
});
check(!signIn.error, 'owner đăng nhập bằng email', signIn.error?.message);

const academy = await owner.rpc('create_academy', {
  p_name: `Smoke ${suffix}`,
  p_slug: `smoke-${suffix}`,
});
check(!academy.error && academy.data?.slug === `smoke-${suffix}`, 'create_academy', academy.error);
const academyId = academy.data?.id;

const group = await owner
  .from('groups')
  .insert({ academy_id: academyId, name: 'Lớp Smoke' })
  .select()
  .single();
check(!group.error, 'owner tạo lớp', group.error);

const username = `smoke_${suffix}`;
const pin = '135790';
const created = await owner.functions.invoke('create-student', {
  body: { academyId, displayName: 'Học viên Smoke', username, pin, groupId: group.data?.id },
});
let createdBody = created.data;
if (created.error?.context instanceof Response) createdBody = await created.error.context.json();
check(
  !created.error && created.data?.username === username,
  'Edge Function create-student',
  createdBody,
);

const dup = await owner.functions.invoke('create-student', {
  body: { academyId, displayName: 'Trùng', username, pin },
});
const dupBody = dup.error?.context instanceof Response ? await dup.error.context.json() : dup.data;
check(dupBody?.error === 'username_taken', 'chặn username trùng', dupBody);

const student = createClient(SUPABASE_URL, SUPABASE_KEY, opts);
const studentSignIn = await student.auth.signInWithPassword({
  email: `${username}@students.erpchess.local`,
  password: pin,
});
check(!studentSignIn.error, 'học viên đăng nhập bằng username + PIN', studentSignIn.error?.message);

const studentGroups = await student.from('groups').select('name');
check(
  studentGroups.data?.length === 1 && studentGroups.data[0].name === 'Lớp Smoke',
  'học viên thấy đúng lớp của mình',
  studentGroups.data,
);

const studentAcademy = await student.rpc('create_academy', {
  p_name: 'Lậu',
  p_slug: `lau-${suffix}`,
});
check(!!studentAcademy.error, 'học viên không tạo được học viện', studentAcademy.error?.code);

const wrongPin = await createClient(SUPABASE_URL, SUPABASE_KEY, opts).auth.signInWithPassword({
  email: `${username}@students.erpchess.local`,
  password: '000000',
});
check(!!wrongPin.error, 'sai PIN bị từ chối');

console.log(
  JSON.stringify({ academyId, studentId: created.data?.studentId, username, failures }, null, 2),
);
process.exit(failures ? 1 : 0);
