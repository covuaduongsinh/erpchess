import { useLevels, useMembers, usePuzzles, useQuizMutations } from '@erpchess/api/react';
import { pickAutoQuizPuzzles } from '@erpchess/domain';
import { type FormEvent, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { localInputToIso } from '../../lib/format';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText, Field } from '../ui';

/**
 * Quiz tự động: lấy ngẫu nhiên N puzzle trong khoảng rating của một cấp độ và giao cho các học viên
 * đang ở cấp đó. Chưa tự chạy theo lịch (để Giai đoạn 12).
 */
export function AutoQuiz({ onDone }: { onDone: (quizId: string) => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const levels = useLevels(academy.id);
  const members = useMembers(academy.id);
  const puzzles = usePuzzles(academy.id);
  const { create } = useQuizMutations(academy.id, session.user.id);
  const [levelId, setLevelId] = useState('');
  const [count, setCount] = useState(10);
  const [due, setDue] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    const level = levels.data?.find((l) => l.id === levelId);
    if (!level) return;
    const students = (members.data ?? []).filter(
      (m) => m.role === 'student' && m.levelId === level.id,
    );
    if (students.length === 0) return setProblem(t('quiz.autoNoStudents'));
    const picked = pickAutoQuizPuzzles(
      puzzles.data ?? [],
      { minRating: level.min_rating, maxRating: level.max_rating },
      count,
    );
    if (picked.length === 0) return setProblem(t('quiz.autoNoPuzzles'));
    create.mutate(
      {
        title: `${t('quiz.autoTitle')} — ${level.name} — ${new Date().toLocaleDateString()}`,
        levelId: level.id,
        auto: true,
        studentIds: students.map((s) => s.profile.id),
        dueAt: localInputToIso(due) ?? null,
        items: picked.map((p) => ({
          kind: 'puzzle',
          title: p.title,
          payload: { fen: p.fen, moves: p.moves },
          sourceActivityId: null,
        })),
      },
      { onSuccess: (q) => onDone(q.id) },
    );
  }

  return (
    <Card title={t('quiz.auto')}>
      <p className="text-sm text-text-muted">{t('quiz.autoHint')}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('groups.level')}</span>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            required
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">—</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('quiz.autoCount')}
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        <Field
          label={t('quiz.dueAt')}
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
        <ErrorText error={create.error} />
        <Button
          type="submit"
          variant="cta"
          className="self-start"
          disabled={create.isPending || !levelId}
        >
          {t('quiz.autoCreate')}
        </Button>
      </form>
    </Card>
  );
}
