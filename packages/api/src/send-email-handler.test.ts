import { describe, expect, it, vi } from 'vitest';
import {
  type AcademyRow,
  type Db,
  type Deps,
  handleSendEmail,
  type InvitationRow,
  type LogRow,
  type PendingNotification,
  SANDBOX_FROM,
} from '../../../supabase/functions/send-email/handler';

const ACADEMY = '10000000-0000-0000-0000-00000000000a';
const OWNER = { id: 'u-owner', email: 'owner@clb.vn' };
const OWNER_TOKEN = 'jwt-owner';
const SERVICE = 'service-key-xyz';

const academyRow: AcademyRow = {
  id: ACADEMY,
  name: 'CLB Dương Sinh',
  slug: 'clb',
  contact: { senderName: 'Thầy Sinh', replyTo: 'hi@clb.vn' },
};
const invite = (over: Partial<InvitationRow> = {}): InvitationRow => ({
  id: 'inv1',
  academy_id: ACADEMY,
  role: 'coach',
  email: null,
  student_id: null,
  accepted_at: null,
  expires_at: '2099-01-01T00:00:00Z',
  ...over,
});

function setup(over: Partial<Db> = {}, env: Partial<Deps['env']> = {}) {
  const logs: LogRow[] = [];
  const db: Db = {
    userFromJwt: async (jwt) => (jwt === OWNER_TOKEN ? OWNER : null),
    staffRole: async (uid, aid) => (uid === OWNER.id && aid === ACADEMY ? 'owner' : null),
    academy: async (id) => (id === ACADEMY ? academyRow : null),
    categoryEnabled: async () => true,
    sentInLastHour: async () => 0,
    invitationByToken: async () => invite(),
    setInvitationEmail: vi.fn(async () => {}),
    displayName: async (id) => (id === 'stu1' ? 'Nguyễn Văn An' : 'Chủ CLB'),
    insertLog: async (row) => {
      logs.push(row);
    },
    pendingNotifications: async () => [],
    userEmail: async () => null,
    markEmailed: vi.fn(async () => {}),
    ...over,
  };
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ id: 'resend-1' }), { status: 200 }),
  );
  const deps: Deps = {
    env: { resendKey: 're_secret_key', appUrl: 'https://app.clb.vn', serviceKey: SERVICE, ...env },
    fetch: fetchMock as unknown as typeof fetch,
    now: () => new Date('2026-11-02T10:00:00Z'),
    db,
  };
  const call = (body: unknown, token: string | null = OWNER_TOKEN, method = 'POST') =>
    handleSendEmail(deps, {
      method,
      authorization: token ? `Bearer ${token}` : null,
      body,
    });
  return { deps, db, logs, fetchMock, call };
}

const sentBody = (fetchMock: ReturnType<typeof setup>['fetchMock']) =>
  JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body) as Record<
    string,
    unknown
  >;

describe('send-email: xác thực và trạng thái', () => {
  it('thiếu Authorization → 401; sai phương thức → 405; JWT sai → 401', async () => {
    const { call } = setup();
    expect((await call({}, null)).status).toBe(401);
    expect((await call({}, OWNER_TOKEN, 'GET')).status).toBe(405);
    expect((await call({ academy_id: ACADEMY, mode: 'status' }, 'jwt-la')).status).toBe(401);
  });

  it('không phải nhân sự của học viện → 403', async () => {
    const { call } = setup({ staffRole: async () => null });
    expect((await call({ academy_id: ACADEMY, mode: 'status' })).status).toBe(403);
  });

  it('status: cấu hình hay chưa, địa chỉ gửi, KHÔNG bao giờ trả khoá', async () => {
    const a = setup();
    const r = await a.call({ academy_id: ACADEMY, mode: 'status' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ configured: true, from: SANDBOX_FROM, sandbox: true });
    expect(JSON.stringify(r.body)).not.toContain('re_secret_key');
    const b = setup({}, { resendKey: undefined, from: 'ERPChess <no-reply@duongsinh.vn>' });
    const r2 = await b.call({ academy_id: ACADEMY, mode: 'status' });
    expect(r2.body).toMatchObject({
      configured: false,
      from: 'no-reply@duongsinh.vn',
      sandbox: false,
    });
  });
});

describe('send-email: gửi thử và lời mời', () => {
  it('gửi thử tới chính mình: gọi Resend đúng, ghi nhật ký sent, khoá chỉ nằm trong header', async () => {
    const { call, fetchMock, logs } = setup();
    const r = await call({ academy_id: ACADEMY, kind: 'test', to: 'Owner@CLB.vn' });
    expect(r).toEqual({ status: 200, body: { ok: true, id: 'resend-1' } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_secret_key');
    const sent = sentBody(fetchMock);
    expect(sent.from).toBe(`Thầy Sinh <${SANDBOX_FROM}>`);
    expect(sent.to).toEqual(['owner@clb.vn']);
    expect(sent.reply_to).toBe('hi@clb.vn');
    expect(JSON.stringify(sent)).not.toContain('re_secret_key');
    expect(logs).toEqual([
      expect.objectContaining({
        kind: 'test',
        to_email: 'owner@clb.vn',
        status: 'sent',
        provider_id: 'resend-1',
        created_by: 'u-owner',
      }),
    ]);
  });

  it('gửi thử tới người khác → 403 và không gọi Resend', async () => {
    const { call, fetchMock } = setup();
    const r = await call({ academy_id: ACADEMY, kind: 'test', to: 'nguoi.la@gmail.com' });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('recipient_not_allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('chưa có RESEND_API_KEY → 503 not_configured, không gọi Resend, không ghi nhật ký', async () => {
    const { call, fetchMock, logs } = setup({}, { resendKey: undefined });
    const r = await call({ academy_id: ACADEMY, kind: 'test', to: 'owner@clb.vn' });
    expect(r).toEqual({ status: 503, body: { error: 'not_configured' } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs).toHaveLength(0);
  });

  it('Resend trả lỗi → 502 send_failed, nhật ký failed kèm mã lỗi (không chứa khoá)', async () => {
    const { call, fetchMock, logs } = setup();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'validation_error', message: 'domain not verified' }), {
        status: 403,
      }),
    );
    const r = await call({ academy_id: ACADEMY, kind: 'test', to: 'owner@clb.vn' });
    expect(r.status).toBe(502);
    expect(String(r.body.detail)).toContain('domain not verified');
    expect(logs[0]).toMatchObject({ status: 'failed' });
    expect(logs[0]?.error).toContain('403');
    expect(JSON.stringify(logs)).not.toContain('re_secret_key');
  });

  it('lỗi mạng khi gọi Resend → 502 và nhật ký failed', async () => {
    const { call, fetchMock, logs } = setup();
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    const r = await call({ academy_id: ACADEMY, kind: 'test', to: 'owner@clb.vn' });
    expect(r.status).toBe(502);
    expect(logs[0]?.error).toContain('ECONNRESET');
  });

  it('lời mời HLV: gắn email vào lời mời, link tuyệt đối theo APP_URL, người mời là tên người gửi', async () => {
    const { call, fetchMock, db } = setup();
    const r = await call({
      academy_id: ACADEMY,
      kind: 'invite_coach',
      to: 'hlv@gmail.com',
      data: { token: 'tok123' },
    });
    expect(r.status).toBe(200);
    expect(db.setInvitationEmail).toHaveBeenCalledWith('inv1', 'hlv@gmail.com');
    const sent = sentBody(fetchMock);
    expect(String(sent.html)).toContain('https://app.clb.vn/invite/tok123');
    expect(String(sent.subject)).toContain('Thầy Sinh');
  });

  it('lời mời phụ huynh: nêu tên học viên; vai trò lời mời phải khớp loại email', async () => {
    const a = setup({
      invitationByToken: async () => invite({ role: 'parent', student_id: 'stu1' }),
    });
    const ok = await a.call({
      academy_id: ACADEMY,
      kind: 'invite_parent',
      to: 'ph@gmail.com',
      data: { token: 't' },
    });
    expect(ok.status).toBe(200);
    expect(String(sentBody(a.fetchMock).subject)).toContain('Nguyễn Văn An');
    const b = setup({ invitationByToken: async () => invite({ role: 'coach' }) });
    const bad = await b.call({
      academy_id: ACADEMY,
      kind: 'invite_parent',
      to: 'ph@gmail.com',
      data: { token: 't' },
    });
    expect(bad.status).toBe(400);
    expect(b.fetchMock).not.toHaveBeenCalled();
  });

  it('chỉ gửi tới email của lời mời: lời mời đã có email khác → 403', async () => {
    const { call, fetchMock } = setup({
      invitationByToken: async () => invite({ email: 'dung@gmail.com' }),
    });
    const r = await call({
      academy_id: ACADEMY,
      kind: 'invite_coach',
      to: 'khac@gmail.com',
      data: { token: 't' },
    });
    expect(r.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lời mời của học viện khác, đã chấp nhận, hết hạn hoặc không có → lỗi, không gửi', async () => {
    const cases: [Partial<InvitationRow> | null, number, string][] = [
      [null, 404, 'invitation_not_found'],
      [{ academy_id: 'khac' }, 404, 'invitation_not_found'],
      [{ accepted_at: '2026-11-01T00:00:00Z' }, 409, 'invitation_closed'],
      [{ expires_at: '2026-10-01T00:00:00Z' }, 409, 'invitation_closed'],
    ];
    for (const [over, status, error] of cases) {
      const { call, fetchMock } = setup({
        invitationByToken: async () => (over ? invite(over) : null),
      });
      const r = await call({
        academy_id: ACADEMY,
        kind: 'invite_coach',
        to: 'a@b.vn',
        data: { token: 't' },
      });
      expect([r.status, r.body.error], JSON.stringify(over)).toEqual([status, error]);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it('email lạ, loại lạ, thiếu học viện → 400; email giả của học viên không gửi được', async () => {
    const { call } = setup();
    expect((await call({ academy_id: ACADEMY, kind: 'test', to: 'khong-phai-email' })).status).toBe(
      400,
    );
    expect(
      (await call({ academy_id: ACADEMY, kind: 'test', to: 'an@students.erpchess.local' })).status,
    ).toBe(400);
    expect((await call({ academy_id: ACADEMY, kind: 'spam', to: 'owner@clb.vn' })).status).toBe(
      400,
    );
    expect((await call({ kind: 'test', to: 'owner@clb.vn' })).status).toBe(400);
  });

  it('giới hạn tần suất: đủ N email/giờ → 429, không gọi Resend', async () => {
    const { call, fetchMock } = setup({ sentInLastHour: async () => 30 });
    const r = await call({ academy_id: ACADEMY, kind: 'test', to: 'owner@clb.vn' });
    expect(r.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('học viện tắt loại thông báo hệ thống thì email lời mời không gửi (email thử vẫn gửi)', async () => {
    const a = setup({ categoryEnabled: async () => false });
    const off = await a.call({
      academy_id: ACADEMY,
      kind: 'invite_coach',
      to: 'a@b.vn',
      data: { token: 't' },
    });
    expect([off.status, off.body.error]).toEqual([409, 'category_disabled']);
    const test = await a.call({ academy_id: ACADEMY, kind: 'test', to: 'owner@clb.vn' });
    expect(test.status).toBe(200);
  });

  it('service role không được dùng chế độ send/status (chỉ flush)', async () => {
    const { call } = setup();
    const r = await call({ academy_id: ACADEMY, kind: 'test', to: 'owner@clb.vn' }, SERVICE);
    expect(r.status).toBe(403);
  });
});

describe('send-email: flush (cron)', () => {
  const note = (over: Partial<PendingNotification> = {}): PendingNotification => ({
    id: 'n1',
    academy_id: ACADEMY,
    user_id: 'parent1',
    category: 'invoice_reminder',
    title: 'Nhắc đóng học phí HD-2026-0001',
    body: '1.500.000 VND · đến hạn sau 3 ngày',
    link: '/a/clb/billing/inv1',
    ...over,
  });

  it('chỉ service role được flush', async () => {
    const { call } = setup();
    expect((await call({ mode: 'flush' }, OWNER_TOKEN)).status).toBe(403);
    expect((await call({ mode: 'flush' }, 'jwt-la')).status).toBe(403);
  });

  it('chưa có khoá → 503 và không đánh dấu đã gửi (để lượt sau gửi)', async () => {
    const { call, db } = setup(
      { pendingNotifications: async () => [note()] },
      { resendKey: undefined },
    );
    const r = await call({ mode: 'flush' }, SERVICE);
    expect(r.status).toBe(503);
    expect(db.markEmailed).not.toHaveBeenCalled();
  });

  it('gửi nhắc học phí và quiz tới email thật, bỏ qua học viên PIN và loại khác; đánh dấu đã xử lý', async () => {
    const emails: Record<string, string | null> = {
      parent1: 'phuhuynh@gmail.com',
      stu1: 'an@students.erpchess.local',
      parent2: null,
    };
    const { call, db, fetchMock, logs } = setup({
      pendingNotifications: async () => [
        note({ id: 'n1' }),
        note({
          id: 'n2',
          category: 'quiz',
          title: 'Quiz mới: Chiến thuật',
          user_id: 'parent1',
          link: '/a/clb/quizzes/q1',
        }),
        note({ id: 'n3', user_id: 'stu1' }),
        note({ id: 'n4', user_id: 'parent2' }),
        note({ id: 'n5', category: 'class' }),
      ],
      userEmail: async (id) => (id in emails ? (emails[id] ?? null) : 'khac@gmail.com'),
    });
    const r = await call({ mode: 'flush' }, SERVICE);
    expect(r).toEqual({
      status: 200,
      body: { ok: true, sent: 2, failed: 0, skipped: 3, deferred: 0 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logs.map((l) => [l.kind, l.notification_id, l.status])).toEqual([
      ['invoice_reminder', 'n1', 'sent'],
      ['quiz_assigned', 'n2', 'sent'],
    ]);
    expect(String(sentBody(fetchMock).html)).toContain('https://app.clb.vn/a/clb/billing/inv1');
    expect(db.markEmailed).toHaveBeenCalledWith(['n1', 'n2', 'n3', 'n4', 'n5']);
  });

  it('vượt giới hạn giờ thì hoãn phần còn lại (không đánh dấu)', async () => {
    const { call, db, fetchMock } = setup({
      pendingNotifications: async () => [note({ id: 'n1' }), note({ id: 'n2' })],
      userEmail: async () => 'ph@gmail.com',
      sentInLastHour: async () => 29,
    });
    const r = await call({ mode: 'flush' }, SERVICE);
    expect(r.body).toMatchObject({ sent: 1, deferred: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.markEmailed).toHaveBeenCalledWith(['n1']);
  });

  it('gửi lỗi thì ghi failed và vẫn đánh dấu (không thử lại vô hạn)', async () => {
    const { call, db, fetchMock, logs } = setup({
      pendingNotifications: async () => [note()],
      userEmail: async () => 'ph@gmail.com',
    });
    fetchMock.mockResolvedValueOnce(new Response('{"message":"x"}', { status: 500 }));
    const r = await call({ mode: 'flush' }, SERVICE);
    expect(r.body).toMatchObject({ sent: 0, failed: 1 });
    expect(logs[0]?.status).toBe('failed');
    expect(db.markEmailed).toHaveBeenCalledWith(['n1']);
  });
});
