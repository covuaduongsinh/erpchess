/**
 * Kiểm tích hợp Giai đoạn 9a trên Supabase thật: trọng tài `game-move` (lượt, lệch bước, nước sai,
 * hoà, đầu hàng, huỷ), PGN, rating, Realtime `game:<id>`. Ghép owner (Trắng) với học viên thử (Đen).
 * Ván đã chơi ở lại học viện thử (staff không xoá được ván đã có nước đi).
 */
import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import { createPairing, fetchGame, type GameRow, gameAction, subscribeGame } from './games';
import { joinAcademyPresence, type OnlineMember } from './presence';
import { fetchMyAcademies, signInStudent, signInWithEmail } from './queries';

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!ready)('Giai đoạn 9 trên Supabase thật', () => {
  it('trọng tài ván đấu, hoà, rating, Realtime', { timeout: 120_000 }, async () => {
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

    const game = await createPairing(owner, user.id, {
      academyId: academy.id,
      whiteId: user.id,
      blackId: su.id,
      baseMs: 180_000,
      incMs: 2_000,
      rated: true,
    });
    expect(game).toMatchObject({ status: 'active', category: 'blitz', white_ms: 180_000 });

    const pushed: Partial<GameRow>[] = [];
    const stop = subscribeGame(student, game.id, (p) => pushed.push(p));
    try {
      await wait(2000);
      await expect(
        gameAction(student, game.id, 'move', { move: 'e7e5', ply: 0 }),
      ).rejects.toMatchObject({
        code: 'not_your_turn',
      });
      const afterE4 = (await gameAction(owner, game.id, 'move', {
        move: 'e2e4',
        ply: 0,
      })) as GameRow;
      expect(afterE4).toMatchObject({ moves: ['e2e4'], version: 1 });
      await expect(
        gameAction(owner, game.id, 'move', { move: 'd2d4', ply: 1 }),
      ).rejects.toMatchObject({
        code: 'not_your_turn',
      });
      await expect(
        gameAction(student, game.id, 'move', { move: 'e7e5', ply: 0 }),
      ).rejects.toMatchObject({
        code: 'out_of_sync',
      });
      await expect(
        gameAction(student, game.id, 'move', { move: 'e7e4', ply: 1 }),
      ).rejects.toMatchObject({
        code: 'illegal_move',
      });
      const afterE5 = (await gameAction(student, game.id, 'move', {
        move: 'e7e5',
        ply: 1,
      })) as GameRow;
      expect(afterE5.turn_started_at).not.toBeNull();

      // Realtime: học viên nhận trạng thái mới do trigger phát
      for (let t = 0; t < 50 && !pushed.some((p) => p.version === 2); t++) await wait(100);
      expect(pushed.find((p) => p.version === 2)).toMatchObject({ moves: ['e2e4', 'e7e5'] });

      await gameAction(owner, game.id, 'offer_draw');
      const drawn = (await gameAction(student, game.id, 'accept_draw')) as GameRow;
      expect(drawn).toMatchObject({ status: 'finished', result: '1/2-1/2', reason: 'agreement' });
      expect(drawn.pgn).toContain('1. e4 e5 1/2-1/2');
      const final = await fetchGame(student, game.id);
      expect(final.rating_change).toMatchObject({
        white: expect.any(Number),
        black: expect.any(Number),
      });
      await expect(gameAction(owner, game.id, 'resign')).rejects.toMatchObject({
        code: 'game_over',
      });
    } finally {
      stop();
    }

    // Đầu hàng và huỷ ván
    const g2 = await createPairing(owner, user.id, {
      academyId: academy.id,
      whiteId: user.id,
      blackId: su.id,
      baseMs: null,
      incMs: 0,
      rated: false,
    });
    await gameAction(owner, g2.id, 'move', { move: 'd2d4', ply: 0 });
    expect(await gameAction(student, g2.id, 'resign')).toMatchObject({
      result: '1-0',
      reason: 'resign',
    });

    const g3 = await createPairing(owner, user.id, {
      academyId: academy.id,
      whiteId: su.id,
      blackId: user.id,
      baseMs: 300_000,
      incMs: 0,
      rated: false,
    });
    expect(await gameAction(student, g3.id, 'abort')).toMatchObject({ status: 'aborted' });
  });

  it('presence học viện: thành viên thấy nhau, người ngoài không vào được', {
    timeout: 60_000,
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
    let seen: OnlineMember[] = [];
    const a = joinAcademyPresence(
      owner,
      academy.id,
      { userId: user.id, name: 'HLV', role: 'owner' },
      (l) => {
        seen = l;
      },
    );
    const b = joinAcademyPresence(
      student,
      academy.id,
      { userId: su.id, name: 'HV', role: 'student' },
      () => undefined,
    );
    // Học viện không phải của học viên → bị từ chối
    const outsider = joinAcademyPresence(
      student,
      '00000000-0000-4000-8000-000000000000',
      { userId: su.id, name: 'HV', role: 'student' },
      () => undefined,
    );
    const outsiderResult = outsider.ready.then(
      () => 'joined',
      () => 'denied',
    );
    try {
      await a.ready;
      await b.ready;
      for (let t = 0; t < 50 && !seen.some((m) => m.userId === su.id); t++) await wait(100);
      expect(seen.find((m) => m.userId === su.id)).toMatchObject({ role: 'student' });
      expect(await outsiderResult).toBe('denied');
    } finally {
      await outsider.leave();
      await b.leave();
      await a.leave();
    }
  });
});
