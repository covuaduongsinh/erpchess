import type { QuizAttempt, QuizQuestion } from '@erpchess/api';
import {
  useAnswerQuiz,
  useQuizAttempts,
  useQuizPuzzle,
  useQuizQuestions,
} from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { inCheck, kingSquare, legalDests, sideToMove } from '@erpchess/chess-core';
import { quizStatus } from '@erpchess/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRemaining } from '../../lib/format';
import { useT } from '../../lib/use-t';
import { Capture, Mcq } from '../study/ActivityPlayer';
import { Button, Card, ErrorText, Spinner } from '../ui';

const QUESTION_TIME_LIMIT_SEC = 60;

/** Học viên làm quiz: đề không có đáp án, mọi câu chấm ở server qua `quiz-answer`. */
export function QuizTaker({
  quizId,
  userId,
  startsAt,
  dueAt,
}: {
  quizId: string;
  userId: string;
  startsAt: string | null;
  dueAt: string | null;
}) {
  const { t } = useT();
  const questions = useQuizQuestions(quizId);
  const ids = useMemo(() => questions.data?.map((q) => q.id) ?? [], [questions.data]);
  const attempts = useQuizAttempts(quizId, ids, userId);
  const [index, setIndex] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const status = quizStatus(startsAt, dueAt);

  if (status === 'upcoming') return <p className="text-text-muted">{t('quiz.notStarted')}</p>;
  if (questions.isPending) return <Spinner />;
  if (questions.error) return <ErrorText error={questions.error} />;
  const list = questions.data;
  const current = list[index];
  const byItem = new Map(attempts.data?.map((a) => [a.item_id, a]));
  const score = attempts.data?.reduce((s, a) => s + a.score, 0) ?? 0;
  const max = list.reduce((s, q) => s + q.points, 0);
  const done = list.filter((q) => byItem.get(q.id)?.solved).length;
  const allCompleted = done === list.length && list.length > 0;

  const content = (
    <div className={`flex flex-col gap-4 ${focusMode ? 'w-full max-w-4xl mx-auto' : ''}`}>
      {/* Header trạng thái Quiz & chế độ tập trung */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-primary">
            {t('quiz.summary', { done, total: list.length, score, max })}
          </span>
          {dueAt && <Countdown dueAt={dueAt} />}
          {status === 'closed' && <span className="font-bold text-danger">{t('quiz.closed')}</span>}
        </div>

        <div className="flex items-center gap-2">
          {allCompleted && (
            <Button
              variant="ghost"
              onClick={() => setShowSummary(true)}
              className="text-xs px-2.5 py-1 text-primary font-medium"
            >
              🏆 {t('quiz.scoreSummary', { score, max })}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => setFocusMode(!focusMode)}
            className="text-xs px-2.5 py-1 flex items-center gap-1.5"
            title={focusMode ? t('quiz.exitFocus') : t('quiz.focusMode')}
          >
            <span>{focusMode ? '🗗' : '⛶'}</span>
            <span>{focusMode ? t('quiz.exitFocus') : t('quiz.focusMode')}</span>
          </Button>
        </div>
      </div>

      {/* Danh sách câu hỏi (Progress steps) */}
      <div className="flex flex-wrap gap-1.5">
        {list.map((q, i) => {
          const ok = byItem.get(q.id)?.solved;
          return (
            <button
              key={q.id}
              type="button"
              aria-current={i === index ? 'step' : undefined}
              aria-label={t('quiz.question', { n: i + 1 })}
              onClick={() => {
                setIndex(i);
                setShowSummary(false);
              }}
              className={`flex size-9 items-center justify-center rounded-xl font-medium text-sm transition-all aria-[current=step]:ring-2 aria-[current=step]:ring-primary ${
                ok
                  ? 'bg-green text-white shadow-xs'
                  : 'bg-text-muted/15 hover:bg-text-muted/25 text-slate-700 dark:text-slate-200'
              }`}
            >
              {ok ? '✓' : i + 1}
            </button>
          );
        })}
      </div>

      {/* Hiển thị tóm tắt hoàn thành hoặc câu hỏi hiện tại */}
      {showSummary ? (
        <QuizSummaryCard
          done={done}
          total={list.length}
          score={score}
          max={max}
          onReview={() => setShowSummary(false)}
        />
      ) : current ? (
        <Card title={current.title || t(`activity.${current.kind}`)}>
          <Question
            key={current.id}
            quizId={quizId}
            question={current}
            attempt={byItem.get(current.id)}
            closed={status === 'closed'}
          />
          <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
            <Button
              variant="ghost"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              className="flex items-center gap-1"
            >
              ← {t('puzzle.prev')}
            </Button>
            {index < list.length - 1 ? (
              <Button
                variant="ghost"
                onClick={() => setIndex((i) => i + 1)}
                className="flex items-center gap-1 text-primary font-medium"
              >
                {t('puzzle.next')} →
              </Button>
            ) : (
              <Button
                onClick={() => setShowSummary(true)}
                className="flex items-center gap-1 bg-green hover:bg-green/90 text-white font-medium"
              >
                ✓ Hoàn thành
              </Button>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );

  if (focusMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 text-slate-100 overflow-y-auto p-4 sm:p-8 backdrop-blur-md flex flex-col justify-center">
        {content}
      </div>
    );
  }

  return content;
}

function Countdown({ dueAt }: { dueAt: string }) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Date.parse(dueAt) - now;
  if (left <= 0) return null;
  return (
    <span className="font-medium text-orange">
      {t('quiz.timeLeft', { time: formatRemaining(left) })}
    </span>
  );
}

/** Đồng hồ đếm ngược từng câu hỏi (60 giây) */
function QuestionTimer({ solved, onTimeUp }: { solved: boolean; onTimeUp: () => void }) {
  const { t } = useT();
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_LIMIT_SEC);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (solved) return;
    setSecondsLeft(QUESTION_TIME_LIMIT_SEC);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onTimeUpRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [solved]);

  if (solved) return null;

  const isLow = secondsLeft <= 15;
  const isCritical = secondsLeft <= 5;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-full border transition-all ${
          isCritical
            ? 'bg-red-500/20 text-red-600 border-red-500 animate-pulse font-bold'
            : isLow
              ? 'bg-amber-500/20 text-amber-600 border-amber-500 font-semibold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
        }`}
      >
        <span>⏱️</span>
        <span>{t('quiz.perQuestionTimer', { seconds: secondsLeft })}</span>
      </div>
      {secondsLeft === 0 && (
        <span className="text-xs font-bold text-red-600">{t('quiz.timeUp')}</span>
      )}
    </div>
  );
}

function QuizSummaryCard({
  done,
  total,
  score,
  max,
  onReview,
}: {
  done: number;
  total: number;
  score: number;
  max: number;
  onReview: () => void;
}) {
  const { t } = useT();
  const accuracy = total > 0 ? Math.round((done / total) * 100) : 0;
  const isExcellent = accuracy >= 80;
  const isGood = accuracy >= 50 && accuracy < 80;

  return (
    <Card className="p-8 text-center flex flex-col items-center gap-6 bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-800/60 dark:to-slate-900 border-2 border-primary/20">
      <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-4xl shadow-inner">
        {isExcellent ? '🏆' : isGood ? '⭐' : '🎯'}
      </div>

      <div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
          {t('quiz.completedTitle')}
        </h3>
        <p className="mt-1 text-sm text-text-muted">{t('quiz.completedSubtitle')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="block text-xs uppercase font-semibold text-text-muted">
            {t('reports.score')}
          </span>
          <span className="text-2xl font-black text-primary">
            {score}/{max}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="block text-xs uppercase font-semibold text-text-muted">
            {t('quiz.accuracy', { percent: accuracy }).split(':')[0]}
          </span>
          <span className="text-2xl font-black text-green">{accuracy}%</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs col-span-2 sm:col-span-1">
          <span className="block text-xs uppercase font-semibold text-text-muted">
            {t('quiz.report')}
          </span>
          <span className="text-2xl font-black text-indigo-600">
            {done}/{total}
          </span>
        </div>
      </div>

      <Button onClick={onReview} className="px-6 py-2.5 font-medium">
        🔍 Xem lại câu hỏi
      </Button>
    </Card>
  );
}

function Question({
  quizId,
  question,
  attempt,
  closed,
}: {
  quizId: string;
  question: QuizQuestion;
  attempt?: QuizAttempt;
  closed: boolean;
}) {
  const { t } = useT();
  const answer = useAnswerQuiz(quizId);
  const solved = attempt?.solved ?? false;
  const [timeExpired, setTimeExpired] = useState(false);
  const triesLeft =
    question.maxAttempts === null
      ? null
      : Math.max(0, question.maxAttempts - (attempt?.tries ?? 0));
  const locked = closed || solved || triesLeft === 0 || timeExpired;
  const since = useRef(Date.now());
  const ms = () => {
    const d = Date.now() - since.current;
    since.current = Date.now();
    return d;
  };
  const p = question.payload;

  let body = null;
  if (question.kind === 'puzzle') {
    body = <QuizPuzzle quizId={quizId} question={question} solved={solved} locked={locked} />;
  } else if (question.kind === 'mcq') {
    const last = answer.data;
    body = (
      <Mcq
        payload={p as { question: string; fen?: string; options: string[] }}
        disabled={locked || answer.isPending}
        feedback={last ? (last.ok ? 'right' : 'wrong') : null}
        onChoose={(choice) => answer.mutate({ itemId: question.id, answer: { choice }, ms: ms() })}
      />
    );
  } else {
    body = (
      <Capture
        payload={p as { fen: string }}
        disabled={locked}
        onSolved={(moves) => answer.mutate({ itemId: question.id, answer: { moves }, ms: ms() })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {t(`activity.${question.kind}`)}
          </span>
          <span>{t('player.points', { count: question.points })}</span>
          {triesLeft !== null && !solved && (
            <span className="text-text-muted">{t('player.triesLeft', { count: triesLeft })}</span>
          )}
          {solved && (
            <span role="status" className="font-bold text-green">
              {t('player.done', { score: attempt?.score ?? 0 })}
            </span>
          )}
        </div>

        <QuestionTimer solved={solved} onTimeUp={() => setTimeExpired(true)} />
      </div>
      {body}
      <ErrorText error={answer.error} />
    </div>
  );
}

function QuizPuzzle({
  quizId,
  question,
  solved,
  locked,
}: {
  quizId: string;
  question: QuizQuestion;
  solved: boolean;
  locked: boolean;
}) {
  const { t } = useT();
  const startFen = String(question.payload.fen ?? '');
  const { state, play, retry, error } = useQuizPuzzle(quizId, question.id, startFen, solved);
  const side = sideToMove(startFen);
  const dests = useMemo(() => legalDests(state.fen), [state.fen]);

  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-md">
        <Board
          fen={state.fen}
          orientation={side}
          lastMove={state.lastMove}
          check={inCheck(state.fen) ? kingSquare(state.fen) : undefined}
          movable={state.status === 'playing' && !locked ? { color: side, dests } : undefined}
          onMove={(from, to, promo) => void play(`${from}${to}${promo ?? ''}`)}
          label={t(`puzzle.toMove_${side}`)}
        />
      </div>
      <div className="flex min-h-10 items-center gap-3" aria-live="polite">
        {state.status === 'playing' && (
          <span className="text-text-muted">{t(`puzzle.toMove_${side}`)}</span>
        )}
        {state.status === 'waiting' && (
          <span className="text-text-muted">{t('quiz.checking')}</span>
        )}
        {state.status === 'solved' && (
          <span role="status" className="font-bold text-green">
            {t('puzzle.solved')}
          </span>
        )}
        {state.status === 'wrong' && (
          <>
            <span role="status" className="font-bold text-danger">
              {t('puzzle.wrong')}
            </span>
            {!locked && <Button onClick={retry}>{t('puzzle.retry')}</Button>}
          </>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  );
}
