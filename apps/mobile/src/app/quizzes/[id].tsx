import type { QuizAttempt, QuizQuestion } from '@erpchess/api';
import {
  useAnswerQuiz,
  useQuiz,
  useQuizAttempts,
  useQuizLeaderboard,
  useQuizPuzzle,
  useQuizQuestions,
  useSession,
} from '@erpchess/api/react';
import { Board } from '@erpchess/board-native';
import { inCheck, kingSquare, legalDests, sideToMove } from '@erpchess/chess-core';
import { quizStatus } from '@erpchess/domain';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Capture, Mcq } from '@/components/ActivityPlayer';
import { Button, Card, ErrorText, Muted, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

/** Học viên làm quiz trên điện thoại; đề không có đáp án, server chấm từng câu. */
export default function QuizScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const quiz = useQuiz(id);
  const questions = useQuizQuestions(id);
  const ids = useMemo(() => questions.data?.map((q) => q.id) ?? [], [questions.data]);
  const attempts = useQuizAttempts(id, ids, session?.user.id);
  const board = useQuizLeaderboard(id);
  const [index, setIndex] = useState(0);

  if (quiz.isPending || questions.isPending) return <Spinner />;
  if (quiz.error) return <ErrorText error={quiz.error} />;
  const status = quizStatus(quiz.data.starts_at, quiz.data.due_at);
  const list = questions.data ?? [];
  const current = list[index];
  const byItem = new Map(attempts.data?.map((a) => [a.item_id, a]));
  const score = attempts.data?.reduce((s, a) => s + a.score, 0) ?? 0;
  const max = list.reduce((s, q) => s + q.points, 0);
  const done = list.filter((q) => byItem.get(q.id)?.solved).length;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: quiz.data.title }} />
      {status === 'upcoming' ? (
        <Muted>{t('quiz.notStarted')}</Muted>
      ) : (
        <>
          <Text style={styles.text}>
            {t('quiz.summary', { done, total: list.length, score, max })}
          </Text>
          {status === 'closed' ? <Text style={styles.error}>{t('quiz.closed')}</Text> : null}
          <ScrollView horizontal contentContainerStyle={{ gap: spacing.xs }}>
            {list.map((q, i) => {
              const ok = byItem.get(q.id)?.solved;
              return (
                <Pressable
                  key={q.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('quiz.question', { n: i + 1 })}
                  accessibilityState={{ selected: i === index }}
                  onPress={() => setIndex(i)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: i === index ? 2 : 0,
                    borderColor: colors.primary,
                    backgroundColor: ok ? colors.green : `${colors.textMuted}33`,
                  }}
                >
                  <Text style={{ color: ok ? colors.textOnPrimary : colors.text }}>
                    {ok ? '✓' : i + 1}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {current ? (
            <Card title={current.title || t(`activity.${current.kind}`)}>
              <Question
                key={current.id}
                quizId={id}
                question={current}
                attempt={byItem.get(current.id)}
                closed={status === 'closed'}
              />
            </Card>
          ) : null}
        </>
      )}
      <Card title={t('dashboard.leaderboard')}>
        {(board.data ?? []).map((r, i) => (
          <View key={r.studentId} style={styles.row}>
            <Text style={[styles.text, { width: 24 }]}>{i + 1}</Text>
            <Text style={[styles.text, { flex: 1 }]}>{r.displayName}</Text>
            <Text style={[styles.text, { fontWeight: '700', color: colors.primary }]}>
              {t('dashboard.points', { count: r.score })}
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
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
  const triesLeft =
    question.maxAttempts === null
      ? null
      : Math.max(0, question.maxAttempts - (attempt?.tries ?? 0));
  const locked = closed || solved || triesLeft === 0;
  const since = useRef(Date.now());
  const ms = () => {
    const d = Date.now() - since.current;
    since.current = Date.now();
    return d;
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Text style={styles.hint}>{t('player.points', { count: question.points })}</Text>
        {triesLeft !== null && !solved ? (
          <Text style={styles.hint}>{t('player.triesLeft', { count: triesLeft })}</Text>
        ) : null}
        {solved ? (
          <Text style={[styles.hint, { color: colors.green, fontWeight: '700' }]}>
            {t('player.done', { score: attempt?.score ?? 0 })}
          </Text>
        ) : null}
      </View>
      {question.kind === 'puzzle' ? (
        <QuizPuzzle quizId={quizId} question={question} solved={solved} locked={locked} />
      ) : question.kind === 'mcq' ? (
        <Mcq
          payload={question.payload as { question: string; fen?: string; options: string[] }}
          disabled={locked || answer.isPending}
          wrong={answer.data ? !answer.data.ok : false}
          onChoose={(choice) =>
            answer.mutate({ itemId: question.id, answer: { choice }, ms: ms() })
          }
        />
      ) : (
        <Capture
          payload={question.payload as { fen: string }}
          disabled={locked}
          onSolved={(moves) => answer.mutate({ itemId: question.id, answer: { moves }, ms: ms() })}
        />
      )}
      <ErrorText error={answer.error} />
    </View>
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
    <View style={{ gap: spacing.sm }}>
      <Board
        fen={state.fen}
        orientation={side}
        lastMove={state.lastMove}
        check={inCheck(state.fen) ? kingSquare(state.fen) : undefined}
        movable={state.status === 'playing' && !locked ? { color: side, dests } : undefined}
        onMove={(from, to, promo) => void play(`${from}${to}${promo ?? ''}`)}
        label={t(`puzzle.toMove_${side}`)}
      />
      {state.status === 'waiting' ? <Muted>{t('quiz.checking')}</Muted> : null}
      {state.status === 'solved' ? (
        <Text style={{ color: colors.green, fontWeight: '700' }}>{t('puzzle.solved')}</Text>
      ) : null}
      {state.status === 'wrong' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.error}>{t('puzzle.wrong')}</Text>
          {!locked ? <Button title={t('puzzle.retry')} onPress={retry} /> : null}
        </View>
      ) : null}
      <ErrorText error={error} />
    </View>
  );
}
