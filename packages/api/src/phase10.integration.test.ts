/**
 * Kiểm tích hợp Giai đoạn 10a trên Supabase thật: tạo giải, bắt đầu (ghép vòng 1 phía server), luật
 * không cho hoà, tự hoàn tất vòng và ghép vòng kế, kết thúc giải, điều khiển tay, bảng xếp hạng.
 * Học viện thử chỉ có owner + 1 học viên nên giải 2 người; giải đông người kiểm bằng test thuần
 * của hàm ghép cặp (chess-core). Giải đã chơi ở lại học viện thử.
 */
import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import { type GameRow, gameAction } from './games';
import { fetchMyAcademies, signInStudent, signInWithEmail, unwrap } from './queries';
import type { Tournament } from './tournaments';
import {
  createTournament,
  fetchTournament,
  tournamentAction,
  tournamentStandings,
} from './tournaments';

const env: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const ready = [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'OWNER_EMAIL',
  'OWNER_PASSWORD',
  'STUDENT_USERNAME',
  'STUDENT_PIN',
  'ACADEMY_SLUG',
].every((k) => env[k]);

function newClient() {
  const store = new Map<string, string>();
  return createErpClient({
    url: env.SUPABASE_URL ?? '',
    key: env.SUPABASE_KEY ?? '',
    detectSessionInUrl: false,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
  });
}

describe.skipIf(!ready)('Giai đoạn 10 trên Supabase thật', () => {
  it('giải Swiss tự hoàn tất vòng, không cho hoà, bảng xếp hạng', {
    timeout: 120_000,
  }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const student = newClient();
    const { user: su } = await signInStudent(
      student,
      env.STUDENT_USERNAME ?? '',
      env.STUDENT_PIN ?? '',
    );

    const t = await createTournament(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ10 — tự động',
      format: 'swiss',
      rounds: 2,
      baseMs: null,
      allowDraw: false,
      control: 'auto_finish',
      playerIds: [user.id, su.id],
    });
    await expect(tournamentAction(student, t.id, 'start')).rejects.toMatchObject({
      code: 'forbidden',
    });
    await tournamentAction(owner, t.id, 'start');

    let d = await fetchTournament(student, t.id);
    expect(d).toMatchObject({ status: 'active', current_round: 1 });
    const g1 = d.games.find((g) => g.round === 1) as GameRow;
    expect(g1).toBeDefined();
    const white1 = g1.white_id === user.id ? owner : student;
    await expect(gameAction(white1, g1.id, 'offer_draw')).rejects.toMatchObject({
      code: 'draw_not_allowed',
    });
    // Đen đầu hàng → vòng 1 xong → server tự ghép vòng 2
    const black1 = g1.black_id === user.id ? owner : student;
    await gameAction(black1, g1.id, 'resign');
    d = await fetchTournament(student, t.id);
    expect(d.current_round).toBe(2);
    expect(d.roundList.map((r) => r.status)).toEqual(['finished', 'active']);
    const g2 = d.games.find((g) => g.round === 2) as GameRow;
    expect(g2).toBeDefined();

    const resigner = g2.white_id === user.id ? owner : student;
    await gameAction(resigner, g2.id, 'resign');
    d = await fetchTournament(owner, t.id);
    expect(d.status).toBe('finished');
    const table = tournamentStandings(d);
    expect(table.map((r) => r.points).sort()).toEqual([1, 1]);
    expect(table.every((r) => r.played === 2)).toBe(true);
  });

  it('giải điều khiển tay: chỉ người tổ chức ghép vòng kế', { timeout: 120_000 }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const student = newClient();
    const { user: su } = await signInStudent(
      student,
      env.STUDENT_USERNAME ?? '',
      env.STUDENT_PIN ?? '',
    );
    const t = await createTournament(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ10 — tay',
      format: 'round_robin',
      baseMs: 300_000,
      rated: false,
      playerIds: [user.id, su.id],
    });
    await tournamentAction(owner, t.id, 'start');
    let d = await fetchTournament(owner, t.id);
    // Vòng tròn 2 người: 1 vòng
    expect(d.rounds).toBe(1);
    await expect(tournamentAction(owner, t.id, 'next_round')).rejects.toMatchObject({
      code: 'round_in_progress',
    });
    await tournamentAction(owner, t.id, 'finish');
    d = await fetchTournament(owner, t.id);
    expect(d.status).toBe('finished');
    expect(d.games.every((g) => g.status === 'aborted')).toBe(true);
  });

  it('cron: giải tự lên lịch tới giờ thì bắt đầu, giải lặp lại sinh lần kế tiếp', {
    timeout: 200_000,
  }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const student = newClient();
    const { user: su } = await signInStudent(
      student,
      env.STUDENT_USERNAME ?? '',
      env.STUDENT_PIN ?? '',
    );
    const t = await createTournament(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ10c — cron',
      format: 'swiss',
      rounds: 1,
      baseMs: null,
      control: 'auto_schedule',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      repeat: 'weekly',
      repeatUntil: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      playerIds: [user.id, su.id],
    });
    // pg_cron chạy mỗi phút: đợi tối đa ~2 phút cho giải bắt đầu và bản lặp kế tiếp được tạo
    let started = false;
    let child: Pick<Tournament, 'id' | 'starts_at' | 'status'> | undefined;
    for (let i = 0; i < 30 && !(started && child); i++) {
      await new Promise((r) => setTimeout(r, 5000));
      started = (await fetchTournament(owner, t.id)).status !== 'upcoming';
      child = unwrap(
        await owner.from('tournaments').select('id, starts_at, status').eq('parent_id', t.id),
      )[0];
    }
    expect(started).toBe(true);
    expect(child).toMatchObject({ status: 'upcoming' });
    const gap = Date.parse(child?.starts_at ?? '') - Date.parse(t.starts_at ?? '');
    expect(Math.round(gap / 86_400_000)).toBe(7);
    const childDetail = await fetchTournament(owner, child?.id ?? '');
    expect(childDetail.players.map((p) => p.player_id).sort()).toEqual([user.id, su.id].sort());
    // Dọn: xoá giải gốc (bản lặp mất liên kết) rồi xoá bản lặp chưa bắt đầu
    await owner.from('tournaments').delete().eq('id', t.id);
    await owner
      .from('tournaments')
      .delete()
      .eq('id', child?.id ?? '');
  });
});
