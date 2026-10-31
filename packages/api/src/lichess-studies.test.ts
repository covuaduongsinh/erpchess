import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import {
  importLichessStudies,
  listLichessStudies,
  parseLichessStudyInput,
} from './lichess-studies';

const ACADEMY = '00000000-0000-4000-8000-000000000001';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(handler: (url: string) => { status?: number; text: string }) {
  const fn = vi.fn(async (url: string) => {
    const r = handler(url);
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      text: async () => r.text,
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('parseLichessStudyInput', () => {
  it('nhận link study, tên, @tên; từ chối chuỗi sai', () => {
    expect(parseLichessStudyInput('https://lichess.org/study/AbCdEfGh/xyz12345')).toEqual({
      kind: 'study',
      id: 'AbCdEfGh',
    });
    expect(parseLichessStudyInput('@thibault')).toEqual({ kind: 'user', username: 'thibault' });
    expect(parseLichessStudyInput('có dấu cách')).toBeNull();
  });
});

describe('listLichessStudies', () => {
  it('đọc NDJSON, bỏ dòng hỏng, mới cập nhật trước', async () => {
    stubFetch(() => ({
      text: [
        '{"id":"aaaaaaaa","name":"Cũ","updatedAt":1}',
        'không phải json',
        '{"id":"bbbbbbbb","name":"Mới","updatedAt":5}',
      ].join('\n'),
    }));
    expect(await listLichessStudies('thibault')).toEqual([
      { id: 'bbbbbbbb', name: 'Mới', updatedAt: 5 },
      { id: 'aaaaaaaa', name: 'Cũ', updatedAt: 1 },
    ]);
  });

  it('báo không tìm thấy người dùng', async () => {
    stubFetch(() => ({ status: 404, text: '' }));
    await expect(listLichessStudies('khongco')).rejects.toMatchObject({
      code: 'lichess_not_found',
    });
  });
});

describe('importLichessStudies', () => {
  const STUDY = `[Event "Chiến thuật: Đòn ghim"]
[StudyName "Chiến thuật"]
[ChapterName "Đòn ghim"]
[FEN "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"]
[SetUp "1"]

3... Nf6 4. Ng5 d5 *

[Event "Chiến thuật: Trống"]
[StudyName "Chiến thuật"]
[ChapterName "Trống"]

*`;

  it('tạo study, thêm hoạt động theo chương, bỏ chương trống; lỗi một study không dừng lô', async () => {
    stubFetch((url) => (url.includes('BADBADBA') ? { status: 500, text: '' } : { text: STUDY }));
    const studies: unknown[] = [];
    const activities: unknown[] = [];
    const client = {
      from: (table: string) => ({
        insert: (row: unknown) => {
          (table === 'studies' ? studies : activities).push(row);
          return {
            select: () => ({
              single: async () => ({
                data:
                  table === 'studies'
                    ? { id: 'st1' }
                    : { id: 'act1', kind: 'puzzle', payload: {}, position: 0 },
                error: null,
              }),
            }),
          };
        },
      }),
    } as unknown as ErpClient;
    const progress = vi.fn();

    const r = await importLichessStudies(client, 'u1', ACADEMY, ['GOODGOOD', 'BADBADBA'], progress);
    expect(studies[0]).toMatchObject({
      academy_id: ACADEMY,
      title: 'Chiến thuật',
      created_by: 'u1',
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ study_id: 'st1', position: 0, kind: 'puzzle' });
    expect(r[0]).toMatchObject({
      lichessId: 'GOODGOOD',
      studyId: 'st1',
      activities: 1,
      skipped: 1,
    });
    expect(r[1]).toMatchObject({ lichessId: 'BADBADBA', studyId: null });
    expect(r[1]?.error).toBeTruthy();
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });
});
