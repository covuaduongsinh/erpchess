/** Simul (Giai đoạn 9c): một HLV đấu cùng lúc nhiều học viên; mỗi bàn là một ván `games`. */
import { START_FEN } from '@erpchess/chess-core';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import type { GameRow } from './games';
import { unwrap } from './queries';

export type Simul = Tables<'simuls'>;
export type SimulWithGames = Simul & { games: GameRow[] };

export async function fetchSimuls(
  client: ErpClient,
  academyId: string,
): Promise<(Simul & { boardCount: number })[]> {
  const rows = unwrap(
    await client
      .from('simuls')
      .select('*, games(count)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );
  return rows.map(({ games, ...s }) => ({ ...s, boardCount: games[0]?.count ?? 0 }));
}

export async function fetchSimul(client: ErpClient, id: string): Promise<SimulWithGames> {
  const { games, ...simul } = unwrap(
    await client.from('simuls').select('*, games(*)').eq('id', id).single(),
  );
  return { ...simul, games: [...games].sort((a, b) => a.created_at.localeCompare(b.created_at)) };
}

/**
 * Tạo simul và sẵn một bàn (ván pending) cho mỗi học viên: học viên chọn trực tiếp cộng học viên
 * trong các lớp/Batch được chọn. Lỗi giữa chừng thì xoá simul (các ván xoá theo).
 */
export async function createSimul(
  client: ErpClient,
  userId: string,
  v: {
    academyId: string;
    title: string;
    description?: string;
    hostId: string;
    hostColor: 'w' | 'b';
    startsAt: string | null;
    baseMs: number | null;
    incMs: number;
    groupIds: string[];
    studentIds: string[];
  },
): Promise<Simul> {
  const title = v.title.trim();
  if (!title) throw new Error('title');
  const ids = new Set(v.studentIds);
  if (v.groupIds.length) {
    const rows = unwrap(
      await client.from('group_members').select('student_id').in('group_id', v.groupIds),
    );
    for (const r of rows) ids.add(r.student_id);
  }
  ids.delete(v.hostId);
  if (ids.size === 0) throw new Error('targets');
  const simul = unwrap(
    await client
      .from('simuls')
      .insert({
        academy_id: v.academyId,
        title,
        description: v.description?.trim() ?? '',
        host_id: v.hostId,
        host_color: v.hostColor,
        starts_at: v.startsAt,
        base_ms: v.baseMs,
        inc_ms: v.incMs,
        created_by: userId,
      })
      .select()
      .single(),
  );
  try {
    unwrap(
      await client.from('games').insert(
        [...ids].map((sid) => ({
          academy_id: v.academyId,
          simul_id: simul.id,
          white_id: v.hostColor === 'w' ? v.hostId : sid,
          black_id: v.hostColor === 'w' ? sid : v.hostId,
          fen: START_FEN,
          status: 'pending',
          base_ms: v.baseMs,
          inc_ms: v.incMs,
          white_ms: v.baseMs,
          black_ms: v.baseMs,
          rated: false,
          created_by: userId,
        })),
      ),
    );
  } catch (err) {
    await client.from('simuls').delete().eq('id', simul.id);
    throw err;
  }
  return simul;
}

export async function startSimul(client: ErpClient, id: string) {
  unwrap(await client.rpc('start_simul', { p_simul: id }));
}

export async function deleteSimul(client: ErpClient, id: string) {
  unwrap(await client.from('simuls').delete().eq('id', id));
}
