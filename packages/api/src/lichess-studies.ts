/**
 * Nhập hàng loạt study Lichess công khai thành study erpchess (Giai đoạn 24c, đặc tả REA: Study →
 * Import from Lichess → Public studies). Gọi thẳng API công khai của Lichess (cho phép CORS).
 */
import { chapterToActivity, lichessStudyName, splitPgn } from '@erpchess/chess-core';
import type { ErpClient } from './client';
import { fetchLichessStudyPgn, lichessStudyId, lichessUsername } from './databases';
import { ApiError } from './queries';
import { addActivity, createStudy } from './studies';

export type LichessStudySummary = { id: string; name: string; updatedAt: number };

/** Ô nhập nhận tên người dùng, @tên, link hồ sơ hoặc link study. */
export function parseLichessStudyInput(
  input: string,
): { kind: 'study'; id: string } | { kind: 'user'; username: string } | null {
  const study = lichessStudyId(input);
  if (study) return { kind: 'study', id: study };
  const user = lichessUsername(input.trim().replace(/^@/, ''));
  return user ? { kind: 'user', username: user } : null;
}

/** Study công khai của một người dùng Lichess (NDJSON), mới cập nhật trước. */
export async function listLichessStudies(username: string): Promise<LichessStudySummary[]> {
  let res: Response;
  try {
    res = await fetch(`https://lichess.org/api/study/by/${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/x-ndjson' },
    });
  } catch {
    throw new ApiError('lichess_unreachable', 'lichess_unreachable');
  }
  if (res.status === 404) throw new ApiError('lichess_not_found', 'lichess_not_found');
  if (!res.ok) throw new ApiError(`lichess_${res.status}`, 'lichess_error');
  return (await res.text())
    .split('\n')
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        const o = JSON.parse(l) as { id?: string; name?: string; updatedAt?: number };
        return o.id ? [{ id: o.id, name: o.name ?? o.id, updatedAt: o.updatedAt ?? 0 }] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export type LichessImportResult = {
  lichessId: string;
  studyId: string | null;
  title: string;
  activities: number;
  skipped: number;
  error?: string;
};

/**
 * Nhập từng study: mỗi chương thành một hoạt động (puzzle hoặc xem ván). Một study lỗi không dừng
 * cả lô; study không có chương dùng được thì không tạo.
 */
export async function importLichessStudies(
  client: ErpClient,
  userId: string,
  academyId: string,
  studyIds: readonly string[],
  onProgress?: (done: number, total: number) => void,
): Promise<LichessImportResult[]> {
  const results: LichessImportResult[] = [];
  for (const [i, lichessId] of studyIds.entries()) {
    try {
      const pgn = await fetchLichessStudyPgn(lichessId);
      const chapters = splitPgn(pgn);
      const activities = chapters.flatMap((c) => {
        const a = chapterToActivity(c);
        return a ? [a] : [];
      });
      const title = lichessStudyName(pgn) || lichessId;
      if (activities.length === 0) {
        results.push({ lichessId, studyId: null, title, activities: 0, skipped: chapters.length });
      } else {
        const study = await createStudy(client, userId, {
          academyId,
          title,
          description: `Nhập từ Lichess: https://lichess.org/study/${lichessId}`,
        });
        for (const [pos, a] of activities.entries()) {
          await addActivity(client, study.id, a, pos);
        }
        results.push({
          lichessId,
          studyId: study.id,
          title,
          activities: activities.length,
          skipped: chapters.length - activities.length,
        });
      }
    } catch (err) {
      results.push({
        lichessId,
        studyId: null,
        title: lichessId,
        activities: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    onProgress?.(i + 1, studyIds.length);
  }
  return results;
}
