/** Exercise (bài tập dùng lại, giao nhiều lần) và Practice (chương thế cờ luyện với máy). */
import {
  type ExerciseInput,
  exerciseInputSchema,
  type PracticePositionInput,
  practicePositionSchema,
} from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { type Assignment, createAssignment, unwrap } from './queries';

export type ExerciseRow = Tables<'exercises'>;
export type ExerciseSummary = ExerciseRow & { puzzleIds: string[]; assignedCount: number };
export type PracticeChapter = Tables<'practice_chapters'>;
export type PracticePosition = Tables<'practice_positions'>;
export type PracticeResult = Tables<'practice_results'>;

// ── Exercise ──

export async function fetchExercises(
  client: ErpClient,
  academyId: string,
): Promise<ExerciseSummary[]> {
  const rows = unwrap(
    await client
      .from('exercises')
      .select('*, exercise_items(position, puzzle_id), assignments(count)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );
  return rows.map(({ exercise_items, assignments, ...e }) => ({
    ...e,
    puzzleIds: [...exercise_items].sort((a, b) => a.position - b.position).map((i) => i.puzzle_id),
    assignedCount: assignments[0]?.count ?? 0,
  }));
}

export async function createExercise(
  client: ErpClient,
  userId: string,
  input: ExerciseInput,
): Promise<ExerciseRow> {
  const v = exerciseInputSchema.parse(input);
  const exercise = unwrap(
    await client
      .from('exercises')
      .insert({
        academy_id: v.academyId,
        title: v.title,
        description: v.description,
        level_id: v.levelId,
        tags: v.tags,
        created_by: userId,
      })
      .select()
      .single(),
  );
  try {
    unwrap(
      await client.from('exercise_items').insert(
        v.puzzleIds.map((puzzle_id, position) => ({
          exercise_id: exercise.id,
          position,
          puzzle_id,
        })),
      ),
    );
  } catch (err) {
    await client.from('exercises').delete().eq('id', exercise.id);
    throw err;
  }
  return exercise;
}

export async function deleteExercise(client: ErpClient, id: string) {
  unwrap(await client.from('exercises').delete().eq('id', id));
}

/** Giao một Exercise: tạo bài tập (chép puzzle) rồi ghi lại Exercise gốc. */
export async function assignExercise(
  client: ErpClient,
  exercise: ExerciseSummary,
  opts: { dueAt?: string; groupIds: string[]; studentIds: string[]; title?: string },
): Promise<Assignment> {
  const assignment = await createAssignment(client, {
    academyId: exercise.academy_id,
    title: opts.title || exercise.title,
    instructions: exercise.description || undefined,
    dueAt: opts.dueAt,
    puzzleIds: exercise.puzzleIds,
    groupIds: opts.groupIds,
    studentIds: opts.studentIds,
  });
  unwrap(
    await client.from('assignments').update({ exercise_id: exercise.id }).eq('id', assignment.id),
  );
  return { ...assignment, exercise_id: exercise.id };
}

// ── Practice ──

export async function fetchPracticeChapters(
  client: ErpClient,
  academyId: string,
): Promise<(PracticeChapter & { positionCount: number })[]> {
  const rows = unwrap(
    await client
      .from('practice_chapters')
      .select('*, practice_positions(count)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );
  return rows.map(({ practice_positions, ...c }) => ({
    ...c,
    positionCount: practice_positions[0]?.count ?? 0,
  }));
}

export async function createPracticeChapter(
  client: ErpClient,
  academyId: string,
  userId: string,
  input: { title: string; description?: string; visibility?: 'private' | 'academy' },
): Promise<PracticeChapter> {
  const title = input.title.trim();
  if (!title) throw new Error('title');
  return unwrap(
    await client
      .from('practice_chapters')
      .insert({
        academy_id: academyId,
        title,
        description: input.description?.trim() ?? '',
        visibility: input.visibility ?? 'academy',
        created_by: userId,
      })
      .select()
      .single(),
  );
}

export async function deletePracticeChapter(client: ErpClient, id: string) {
  unwrap(await client.from('practice_chapters').delete().eq('id', id));
}

export async function fetchPracticeChapter(
  client: ErpClient,
  id: string,
): Promise<PracticeChapter & { positions: PracticePosition[] }> {
  const { practice_positions, ...chapter } = unwrap(
    await client.from('practice_chapters').select('*, practice_positions(*)').eq('id', id).single(),
  );
  return {
    ...chapter,
    positions: [...practice_positions].sort((a, b) => a.position - b.position),
  };
}

export async function addPracticePosition(
  client: ErpClient,
  chapterId: string,
  input: PracticePositionInput,
  position: number,
): Promise<PracticePosition> {
  const v = practicePositionSchema.parse(input);
  return unwrap(
    await client
      .from('practice_positions')
      .insert({ chapter_id: chapterId, position, ...v })
      .select()
      .single(),
  );
}

export async function deletePracticePosition(client: ErpClient, id: string) {
  unwrap(await client.from('practice_positions').delete().eq('id', id));
}

/** Ghi kết quả luyện tập (tự báo). */
export async function recordPracticeResult(
  client: ErpClient,
  userId: string,
  positionId: string,
  result: 'win' | 'draw' | 'loss',
  moves: number,
) {
  unwrap(
    await client
      .from('practice_results')
      .insert({ position_id: positionId, student_id: userId, result, moves }),
  );
}

export async function fetchPracticeResults(
  client: ErpClient,
  positionIds: readonly string[],
): Promise<PracticeResult[]> {
  if (positionIds.length === 0) return [];
  return unwrap(
    await client
      .from('practice_results')
      .select('*')
      .in('position_id', [...positionIds])
      .order('created_at', { ascending: false })
      .limit(500),
  );
}
