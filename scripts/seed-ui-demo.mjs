// Nạp dữ liệu mẫu (tự soạn) vào học viện thử `thu-nghiem-ui` để chụp ảnh nghiệm thu giao diện (REA).
//
// Cách chạy (từ thư mục gốc repo):
//   1. Cần `apps/web/.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) và
//      `.env.test-account` (ERP_TEST_EMAIL, ERP_TEST_PASSWORD) — cả hai đều gitignored.
//   2. node scripts/seed-ui-demo.mjs
//
// Ràng buộc an toàn:
//   - Chỉ ghi vào học viện có slug `thu-nghiem-ui`; đăng nhập bằng tài khoản thử, đi qua RLS như người dùng
//     thật (không dùng khoá service role); không DELETE gì cả.
//   - Idempotent: mỗi mục kiểm tra theo tên/tiêu đề trước khi tạo, chạy lại không nhân đôi.
//   - Không in mật khẩu. PIN học viên mẫu là chuỗi cố định, chỉ hợp lệ trong học viện thử.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/api/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const SLUG = 'thu-nghiem-ui';
const PIN = '123456';
const kv = (p) =>
  Object.fromEntries(
    readFileSync(new URL(p, import.meta.url), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
const env = kv('../apps/web/.env.local');
const acc = kv('../.env.test-account');
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const c = createClient(url, key);
const { data: auth, error: aerr } = await c.auth.signInWithPassword({
  email: acc.ERP_TEST_EMAIL,
  password: acc.ERP_TEST_PASSWORD,
});
if (aerr) throw new Error(`Đăng nhập tài khoản thử lỗi: ${aerr.message}`);
const me = auth.user.id;
const { data: academy, error: acErr } = await c
  .from('academies')
  .select('id,slug')
  .eq('slug', SLUG)
  .single();
if (acErr) throw new Error(`Không thấy học viện ${SLUG}: ${acErr.message}`);
const A = academy.id;
console.log('học viện', academy.slug);

const DAY = 864e5;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const note = (what, r) => {
  if (r.error) console.log(`LỖI ${what}: ${r.error.message}`);
  else console.log(`ok  ${what}`);
  return r;
};
/** Tìm theo cột; chưa có thì tạo. Trả về dòng. */
async function ensure(table, match, row, what) {
  let q = c.from(table).select('*').eq('academy_id', A);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const found = await q.limit(1);
  if (found.data?.[0]) return found.data[0];
  const r = note(
    what,
    await c
      .from(table)
      .insert({ academy_id: A, ...row })
      .select()
      .single(),
  );
  return r.data;
}

// --- Cấp độ, nhóm, batch -----------------------------------------------------------------------
const lvBasic = await ensure(
  'levels',
  { name: 'Cơ bản' },
  { name: 'Cơ bản', position: 0, min_rating: 0, max_rating: 800, color: '#3dbb95' },
  'cấp độ Cơ bản',
);
await ensure(
  'levels',
  { name: 'Trung cấp' },
  { name: 'Trung cấp', position: 1, min_rating: 801, max_rating: 1400, color: '#2275b4' },
  'cấp độ Trung cấp',
);
const group = await ensure(
  'groups',
  { name: 'Lớp U10 nâng cao' },
  { name: 'Lớp U10 nâng cao', kind: 'group', coach_id: me, level_id: lvBasic.id },
  'nhóm U10',
);
const batchMon = await ensure(
  'groups',
  { name: 'Batch tối thứ Hai' },
  { name: 'Batch tối thứ Hai', kind: 'batch', coach_id: me, level_id: lvBasic.id },
  'batch tối thứ Hai',
);
const batchSat = await ensure(
  'groups',
  { name: 'Batch sáng thứ Bảy' },
  { name: 'Batch sáng thứ Bảy', kind: 'batch', coach_id: me, level_id: lvBasic.id },
  'batch sáng thứ Bảy',
);

// --- Học viên (Edge Function create-student) ---------------------------------------------------
const STUDENTS = [
  ['Nguyễn Văn An', 'an.nguyen', group],
  ['Trần Thị Bình', 'binh.tran', group],
  ['Lê Minh Châu', 'chau.le', group],
  ['Phạm Quốc Dũng', 'dung.pham', batchMon],
  ['Hoàng Thị Thanh Huyền Trang Anh', 'trang.hoang', batchMon],
  ['Vũ Đức Khôi', 'khoi.vu', batchMon],
  ['Đặng Gia Hân', 'han.dang', batchSat],
  ['Bùi Anh Tuấn', 'tuan.bui', batchSat],
];
const { data: existingStudents } = await c
  .from('profiles')
  .select('username')
  .in(
    'username',
    STUDENTS.map((s) => s[1]),
  );
const have = new Set((existingStudents ?? []).map((p) => p.username));
for (const [displayName, username, g] of STUDENTS) {
  if (have.has(username)) continue;
  const r = await c.functions.invoke('create-student', {
    body: { academyId: A, displayName, username, pin: PIN, groupId: g.id },
  });
  if (r.error) {
    const detail = r.error.context ? await r.error.context.text().catch(() => '') : r.error.message;
    console.log(`LỖI học viên ${username}: ${detail}`);
  } else console.log(`ok  học viên ${username}`);
}

// Xếp cấp độ cho học viên chưa có cấp (đúng như thao tác của HLV trên giao diện)
const lvMid = await ensure('levels', { name: 'Trung cấp' }, {}, 'cấp độ Trung cấp');
const { data: roster } = await c
  .from('memberships')
  .select('user_id, level_id, profile:profiles(username)')
  .eq('academy_id', A)
  .eq('role', 'student');
for (const m of roster ?? []) {
  if (m.level_id || !STUDENTS.some((x) => x[1] === m.profile?.username)) continue;
  const idx = STUDENTS.findIndex((x) => x[1] === m.profile.username);
  const r = await c.rpc('set_student_level', {
    p_academy: A,
    p_student: m.user_id,
    p_level: (idx % 3 === 0 ? lvMid : lvBasic).id,
  });
  note(`cấp độ ${m.profile.username}`, r);
}

// --- Quiz: 1 đang mở, 1 đã đóng ----------------------------------------------------------------
async function ensureQuiz(title, row, items) {
  const q = await ensure(
    'quizzes',
    { title },
    { title, open_to_all: true, created_by: me, ...row },
    `quiz ${title}`,
  );
  if (!q) return null;
  const has = await c.from('quiz_items').select('id').eq('quiz_id', q.id).limit(1);
  if (!has.data?.length) {
    note(
      `câu hỏi của ${title}`,
      await c
        .from('quiz_items')
        .insert(items.map((it, i) => ({ quiz_id: q.id, position: i, ...it }))),
    );
  }
  return q;
}
const quizOpen = await ensureQuiz(
  'Chiến thuật cơ bản tuần 1',
  { starts_at: iso(-DAY), due_at: iso(6 * DAY), level_id: lvBasic.id, topics: ['chiến thuật'] },
  [
    { kind: 'puzzle', payload: { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', moves: ['d1d8'] } },
    {
      kind: 'mcq',
      payload: { question: 'Quân nào đi chéo?', options: ['Xe', 'Tượng', 'Mã'], correct: 1 },
    },
    {
      kind: 'mcq',
      payload: {
        question: 'Chiếu hết cần tối thiểu mấy quân (ngoài Vua)?',
        options: ['1', '2', '0'],
        correct: 0,
      },
    },
  ],
);
await ensureQuiz(
  'Tàn cuộc Vua và Tốt',
  { starts_at: iso(-10 * DAY), due_at: iso(-3 * DAY), topics: ['tàn cuộc'] },
  [
    {
      kind: 'mcq',
      payload: {
        question: 'Tốt tới hàng cuối cùng thì sao?',
        options: ['Đứng yên', 'Phong cấp', 'Bị loại'],
        correct: 1,
      },
    },
    {
      kind: 'mcq',
      payload: {
        question: 'Nhập thành cần Vua và Xe chưa di chuyển?',
        options: ['Đúng', 'Sai'],
        correct: 0,
      },
    },
  ],
);

// Học viên làm bài (đăng nhập bằng tài khoản học viên mẫu; chỉ làm khi chưa có lượt nào của quiz đó)
const ANSWERS = {
  'an.nguyen': { open: [true, true, true], closed: [true, true] },
  'binh.tran': { open: [true, true, false], closed: [true, false] },
  'chau.le': { open: [false, true, true], closed: [true, true] },
  'dung.pham': { open: [true, false, false], closed: [false, true] },
  'khoi.vu': { open: [true, true, true], closed: [true, true] },
};
async function answerAs(username, quiz, results) {
  const s = createClient(url, key);
  const { error } = await s.auth.signInWithPassword({
    email: `${username}@students.erpchess.local`,
    password: PIN,
  });
  if (error) return console.log(`bỏ qua ${username}: không đăng nhập được`);
  const items = await s.rpc('quiz_items_for_student', { p_quiz: quiz.id });
  const list = [...(items.data ?? [])].sort((a, b) => a.position - b.position);
  const prev = await s
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .in(
      'item_id',
      list.map((x) => x.id),
    );
  if ((prev.count ?? 0) > 0)
    return console.log(`đã có lượt làm của ${username} ở ${quiz.title}, bỏ qua`);
  let done = 0;
  for (const [i, it] of list.entries()) {
    const ok = results[i];
    const base = { itemId: it.id, ms: 3000 + i * 1500 };
    const body =
      it.kind === 'mcq'
        ? { ...base, choice: ok ? 1 : 0 }
        : { ...base, move: ok ? 'd1d8' : 'd1d2', step: 0 };
    if (it.kind === 'mcq' && it.payload?.correct !== undefined && !ok) {
      body.choice = (it.payload.correct + 1) % 2;
    }
    if (it.kind === 'mcq' && ok && it.payload?.correct !== undefined)
      body.choice = it.payload.correct;
    const r = await s.functions.invoke('quiz-answer', { body });
    if (!r.error) done++;
  }
  console.log(`ok  ${username} làm ${quiz.title}: ${done}/${list.length} câu`);
}
// Quiz đã đóng (quá hạn) không nhận bài nữa nên chỉ làm bài ở quiz đang mở
for (const [quiz, tag] of [[quizOpen, 'open']]) {
  if (!quiz) continue;
  for (const [u, r] of Object.entries(ANSWERS)) await answerAs(u, quiz, r[tag]);
}

// --- Giải Swiss sắp tới, simul, buổi học -------------------------------------------------------
await ensure(
  'tournaments',
  { title: 'Giải Mùa Xuân' },
  {
    title: 'Giải Mùa Xuân',
    format: 'swiss',
    rounds: 5,
    base_ms: 600000,
    inc_ms: 5000,
    rated: false,
    created_by: me,
    location: 'CLB Hà Nội',
    starts_at: iso(7 * DAY),
  },
  'giải Swiss',
);
await ensure(
  'simuls',
  { title: 'Simul cùng HLV cuối tuần' },
  {
    title: 'Simul cùng HLV cuối tuần',
    description: 'HLV đấu đồng thời với các học viên khá nhất của học viện.',
    host_id: me,
    host_color: 'w',
    starts_at: iso(3 * DAY),
    base_ms: 900000,
    inc_ms: 0,
    created_by: me,
  },
  'simul',
);
await ensure(
  'classrooms',
  { title: 'Lớp khai cuộc tối nay' },
  {
    title: 'Lớp khai cuộc tối nay',
    kind: 'online',
    starts_at: iso(36e5),
    minutes: 60,
    coach_id: me,
    created_by: me,
  },
  'buổi học tối nay',
);
await ensure(
  'classrooms',
  { title: 'Lớp tàn cuộc chiều qua' },
  {
    title: 'Lớp tàn cuộc chiều qua',
    kind: 'offline',
    starts_at: iso(-DAY),
    minutes: 60,
    coach_id: me,
    created_by: me,
  },
  'buổi học hôm qua',
);

// --- Bài tập giao cho nhóm/batch ---------------------------------------------------------------
const puzzle = await ensure(
  'puzzles',
  { title: 'Xe chiếu hết hàng cuối' },
  {
    title: 'Xe chiếu hết hàng cuối',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    moves: ['d1d8'],
    rating: 600,
    themes: ['backRankMate'],
    created_by: me,
  },
  'bài toán cờ',
);
const hw = await ensure(
  'assignments',
  { title: 'Bài tập chiếu hết tuần 1' },
  {
    title: 'Bài tập chiếu hết tuần 1',
    instructions: 'Giải bài chiếu hết bằng Xe, nộp trước hạn.',
    due_at: iso(5 * DAY),
    created_by: me,
  },
  'bài tập',
);
if (hw && puzzle) {
  const items = await c.from('assignment_items').select('id').eq('assignment_id', hw.id).limit(1);
  if (!items.data?.length) {
    note(
      'bài toán trong bài tập',
      await c
        .from('assignment_items')
        .insert({ assignment_id: hw.id, position: 0, puzzle_id: puzzle.id }),
    );
    note(
      'giao cho nhóm + batch',
      await c
        .from('assignment_targets')
        .insert([group, batchMon].map((g) => ({ assignment_id: hw.id, group_id: g.id }))),
    );
  }
}
// --- Điểm danh cho các buổi học đã diễn ra (HLV ghi, đúng như thao tác trên giao diện) ---------
const pastClass = await ensure(
  'classrooms',
  { title: 'Lớp chiến thuật ba hôm trước' },
  {
    title: 'Lớp chiến thuật ba hôm trước',
    kind: 'offline',
    starts_at: iso(-3 * DAY),
    minutes: 60,
    coach_id: me,
    created_by: me,
  },
  'buổi học ba hôm trước',
);
const yesterdayClass = await ensure(
  'classrooms',
  { title: 'Lớp tàn cuộc chiều qua' },
  {},
  'buổi học hôm qua',
);
const { data: pupils } = await c
  .from('profiles')
  .select('id, username')
  .in(
    'username',
    STUDENTS.map((x) => x[1]),
  );
const idOf = Object.fromEntries((pupils ?? []).map((p) => [p.username, p.id]));
const ATTENDANCE = [
  [
    yesterdayClass,
    {
      'an.nguyen': 'present',
      'binh.tran': 'present',
      'chau.le': 'late',
      'dung.pham': 'absent',
      'khoi.vu': 'present',
    },
  ],
  [
    pastClass,
    {
      'an.nguyen': 'present',
      'binh.tran': 'excused',
      'chau.le': 'present',
      'dung.pham': 'present',
      'khoi.vu': 'present',
      'han.dang': 'absent',
    },
  ],
];
for (const [room, marks] of ATTENDANCE) {
  if (!room) continue;
  const rows = Object.entries(marks)
    .filter(([u]) => idOf[u])
    .map(([u, status]) => ({ classroom_id: room.id, student_id: idOf[u], status, note: '' }));
  note(
    `điểm danh ${room.title}`,
    await c.from('classroom_attendance').upsert(rows, { onConflict: 'classroom_id,student_id' }),
  );
}

// --- Ván đấu: vài ván đã xong + 1 ván đang diễn ra (hai học viên đăng nhập thật, qua RPC/Edge Function) ----
const { count: gameCount } = await c
  .from('games')
  .select('id', { count: 'exact', head: true })
  .eq('academy_id', A);
if ((gameCount ?? 0) >= 4) {
  console.log('đã có ván đấu, bỏ qua');
} else {
  const sessions = {};
  const login = async (u) => {
    if (sessions[u]) return sessions[u];
    const cl = createClient(url, key);
    const { error } = await cl.auth.signInWithPassword({
      email: `${u}@students.erpchess.local`,
      password: PIN,
    });
    if (error) throw new Error(`không đăng nhập được ${u}`);
    sessions[u] = cl;
    return cl;
  };
  const move = async (cl, gameId, mv, ply) => {
    const r = await cl.functions.invoke('game-move', {
      body: { gameId, action: 'move', move: mv, ply },
    });
    if (r.error) throw new Error(`nước ${mv}: ${r.error.message}`);
  };
  // moves xen kẽ trắng/đen; sau đó (nếu có) một hành động kết thúc do `by` thực hiện
  async function playGame(white, black, moves, ending) {
    const cw = await login(white);
    const cb = await login(black);
    const gid = await cw.rpc('create_challenge', {
      p_academy: A,
      p_opponent: idOf[black],
      p_color: 'w',
      p_base_ms: null,
      p_inc_ms: 0,
      p_rated: false,
    });
    if (gid.error) throw new Error(`thách đấu: ${gid.error.message}`);
    for (const [i, mv] of moves.entries()) await move(i % 2 === 0 ? cw : cb, gid.data, mv, i);
    if (ending) {
      const [by, action] = ending;
      const cl = by === 'w' ? cw : cb;
      const r = await cl.functions.invoke('game-move', { body: { gameId: gid.data, action } });
      if (r.error) throw new Error(`${action}: ${r.error.message}`);
    }
    console.log(
      `ok  ván ${white} - ${black}${ending ? ` (${ending[1]})` : ' (chưa có kết quả hoặc chiếu hết)'}`,
    );
  }
  try {
    await playGame('an.nguyen', 'binh.tran', ['f2f3', 'e7e5', 'g2g4', 'd8h4'], null); // chiếu hết, đen thắng
    await playGame('chau.le', 'dung.pham', ['e2e4', 'e7e5'], ['b', 'resign']);
    await playGame('khoi.vu', 'trang.hoang', ['e2e4', 'e7e5'], null);
    await playGame('an.nguyen', 'khoi.vu', ['d2d4', 'd7d5', 'c2c4'], null); // đang diễn ra
  } catch (err) {
    console.log(`LỖI ván đấu (làm được tới đâu ghi tới đó): ${err.message}`);
  }
}
// --- Giảm giá (trang Học phí > Giảm giá): đang dùng theo phần trăm, số tiền cố định, và đã tắt --------------
await ensure(
  'discounts',
  { name: 'Giảm 10% học viên mới' },
  { name: 'Giảm 10% học viên mới', code: 'MOI10', kind: 'percent', value: 10, max_uses: 50 },
  'giảm giá 10%',
);
await ensure(
  'discounts',
  { name: 'Anh chị em ruột giảm 200.000đ' },
  {
    name: 'Anh chị em ruột giảm 200.000đ',
    code: 'ANHEM',
    kind: 'fixed',
    value: 200000,
    currency: 'VND',
  },
  'giảm giá cố định',
);
await ensure(
  'discounts',
  { name: 'Ưu đãi hè đã kết thúc' },
  {
    name: 'Ưu đãi hè đã kết thúc',
    code: 'HE2026',
    kind: 'percent',
    value: 15,
    active: false,
    starts_on: '2026-06-01',
    ends_on: '2026-08-31',
  },
  'giảm giá đã tắt',
);
console.log('xong');
process.exit(0);
