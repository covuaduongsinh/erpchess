// Smoke test Giai đoạn 4 trên Supabase thật: giao bài, học viên làm bài qua Edge Function
// submit-attempt (server chấm lại), các tình huống gian lận, báo cáo tiến độ.
// Chạy: SUPABASE_URL=… SUPABASE_KEY=… OWNER_EMAIL=… OWNER_PASSWORD=… STUDENT_USERNAME=… STUDENT_PIN=…
//       ACADEMY_SLUG=… GROUP_NAME=… node scripts/smoke-phase4.mjs
// Dọn dẹp: xoá bài tập đã tạo ở cuối (dù thành công hay thất bại).
import { createClient } from '@supabase/supabase-js';

const env = process.env;
for (const k of [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'OWNER_EMAIL',
  'OWNER_PASSWORD',
  'STUDENT_USERNAME',
  'STUDENT_PIN',
  'ACADEMY_SLUG',
  'GROUP_NAME',
]) {
  if (!env[k]) {
    console.error(`Thiếu ${k}`);
    process.exit(2);
  }
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
let failures = 0;
const check = (cond, label, extra) => {
  console.log(
    `${cond ? 'ok    ' : 'NOT OK'} ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`,
  );
  if (!cond) failures++;
};
async function body(res) {
  if (res.error?.context instanceof Response)
    return { status: res.error.context.status, ...(await res.error.context.json()) };
  return res.data;
}

const owner = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, opts);
check(
  !(await owner.auth.signInWithPassword({ email: env.OWNER_EMAIL, password: env.OWNER_PASSWORD }))
    .error,
  'HLV đăng nhập',
);

const { data: academy } = await owner
  .from('academies')
  .select('id')
  .eq('slug', env.ACADEMY_SLUG)
  .single();
const { data: group } = await owner
  .from('groups')
  .select('id')
  .eq('academy_id', academy.id)
  .eq('name', env.GROUP_NAME)
  .single();
const { data: lib } = await owner
  .from('puzzles')
  .select('id, title, fen, moves')
  .is('academy_id', null);
check(lib.length >= 13, 'HLV thấy thư viện puzzle chung', lib.length);
const pick = (title) => lib.find((p) => p.title === title);
const p1 = pick('Chiếu hết hàng cuối');
const p2 = pick('Chiếu hết ngạt thở');
const p3 = pick('Xe xiên vua để ăn hậu'); // 3 nửa nước: người giải – đáp – người giải

const created = [];
try {
  const { data: assignment, error: aErr } = await owner
    .from('assignments')
    .insert({
      academy_id: academy.id,
      title: 'Smoke Giai đoạn 4',
      due_at: new Date(Date.now() + 864e5).toISOString(),
    })
    .select()
    .single();
  check(!aErr, 'HLV tạo bài tập', aErr?.message);
  created.push(assignment.id);
  const { error: tErr } = await owner
    .from('assignment_targets')
    .insert({ assignment_id: assignment.id, group_id: group.id });
  check(!tErr, 'giao cho lớp', tErr?.message);
  const { data: items, error: iErr } = await owner
    .from('assignment_items')
    .insert(
      [p1, p2, p3].map((p, position) => ({
        assignment_id: assignment.id,
        position,
        puzzle_id: p.id,
      })),
    )
    .select('id, position')
    .order('position');
  check(!iErr && items.length === 3, 'thêm 3 puzzle vào bài', iErr?.message);

  // Bài thứ hai KHÔNG giao cho học viên — dùng để thử gian lận
  const { data: other } = await owner
    .from('assignments')
    .insert({ academy_id: academy.id, title: 'Smoke không giao' })
    .select()
    .single();
  created.push(other.id);
  const { data: otherItem } = await owner
    .from('assignment_items')
    .insert({ assignment_id: other.id, position: 0, puzzle_id: p1.id })
    .select()
    .single();

  const student = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, opts);
  const signIn = await student.auth.signInWithPassword({
    email: `${env.STUDENT_USERNAME}@students.erpchess.local`,
    password: env.STUDENT_PIN,
  });
  check(!signIn.error, 'học viên đăng nhập', signIn.error?.message);
  const { data: mine } = await student.from('assignments').select('id, title');
  check(
    mine.some((a) => a.id === assignment.id) && !mine.some((a) => a.id === other.id),
    'học viên chỉ thấy bài được giao',
    mine.map((a) => a.title),
  );

  const submit = (itemId, moves) =>
    student.functions.invoke('submit-attempt', { body: { itemId, moves } });

  // Puzzle 1: thử sai rồi đúng
  const wrong = await body(await submit(items[0].id, [{ uci: 'd1d7', ms: 3000 }]));
  check(
    wrong.solved === false && wrong.results[0].ok === false && wrong.tries === 1,
    'nước sai bị chấm sai',
    wrong,
  );
  const right = await body(await submit(items[0].id, [{ uci: 'd1d8', ms: 2000 }]));
  check(right.solved === true && right.tries === 2, 'nước đúng được chấm giải xong', right);

  // Puzzle 3: chuỗi nhiều bước đúng (server tự biết nước đáp ở giữa)
  const multi = await body(
    await submit(items[2].id, [
      { uci: p3.moves[0], ms: 4000 },
      { uci: p3.moves[2], ms: 1500 },
    ]),
  );
  check(
    multi.solved === true && multi.results.every((r) => r.ok),
    'giải đúng puzzle nhiều bước',
    multi,
  );

  // Gian lận 1: tự ghi attempts
  const direct = await student
    .from('attempts')
    .insert({ item_id: items[1].id, student_id: signIn.data.user.id, solved: true });
  check(Boolean(direct.error), 'không tự ghi attempts được', direct.error?.code);
  // Gian lận 2: gửi nước rác
  const junk = await body(await submit(items[1].id, [{ uci: 'zz99', ms: 1 }]));
  check(junk.status === 400, 'nước không đúng định dạng bị từ chối', junk);
  // Gian lận 3: nộp cho item không được giao
  const notMine = await body(await submit(otherItem.id, [{ uci: 'd1d8', ms: 1 }]));
  check(notMine.status === 403, 'không nộp được bài không được giao', notMine);

  // Báo cáo
  const { data: progress } = await owner
    .from('assignment_progress')
    .select('student_id, solved_items, total_items, tries, time_ms')
    .eq('assignment_id', assignment.id)
    .eq('student_id', signIn.data.user.id)
    .single();
  check(
    progress.solved_items === 2 &&
      progress.total_items === 3 &&
      progress.tries === 3 &&
      progress.time_ms === 10500,
    'HLV xem báo cáo đúng: 2/3 câu, 3 lần thử, 10,5 giây',
    progress,
  );
} finally {
  if (created.length) {
    const { error } = await owner.from('assignments').delete().in('id', created);
    console.log(error ? `Dọn dẹp lỗi: ${error.message}` : `Đã xoá ${created.length} bài tập thử`);
  }
}
console.log(failures ? `${failures} lỗi` : 'Tất cả đều đạt');
process.exit(failures ? 1 : 0);
