import { type ActivityAttempt, resolveMediaUrl, type StudyActivity } from '@erpchess/api';
import { useErpClient, useSubmitActivity } from '@erpchess/api/react';
import { Board } from '@erpchess/board-native';
import {
  captureDests,
  captureTargets,
  type GameTree,
  type MoveNode,
  parsePgn,
  playCaptureMove,
  sideToMove,
} from '@erpchess/chess-core';
import type { Activity, ActivityPayload } from '@erpchess/domain';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Markdown } from '@/components/Markdown';
import { PuzzleSolver } from '@/components/PuzzleSolver';
import { Button, ErrorText, Muted, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

type ValidActivity = Extract<StudyActivity, { invalid?: false }>;

export function ActivityPlayer({
  studyId,
  activity,
  attempt,
}: {
  studyId: string;
  activity: ValidActivity;
  attempt?: ActivityAttempt;
}) {
  const { t } = useT();
  const submit = useSubmitActivity(studyId);
  const solved = attempt?.solved ?? false;
  const triesLeft =
    activity.maxAttempts === null
      ? null
      : Math.max(0, activity.maxAttempts - (attempt?.tries ?? 0));
  const locked = !solved && triesLeft === 0;
  const startedAt = useRef(Date.now());

  function send(answer: Parameters<typeof submit.mutate>[0]['answer']) {
    const ms = Date.now() - startedAt.current;
    startedAt.current = Date.now();
    submit.mutate({ activityId: activity.id, answer, ms });
  }
  const viewed = !solved && (
    <Button
      variant="cta"
      title={t('player.markViewed')}
      disabled={submit.isPending}
      onPress={() => send({ viewed: true })}
    />
  );

  let body: React.ReactNode;
  switch ((activity as Activity).kind) {
    case 'puzzle': {
      const a = activity as Extract<Activity, { kind: 'puzzle' }>;
      body = (
        <PuzzleSolver
          puzzle={a.payload}
          onTryEnd={(s) => !solved && !locked && send({ moves: s.moves.map((m) => m.uci) })}
        />
      );
      break;
    }
    case 'mcq': {
      const a = activity as Extract<Activity, { kind: 'mcq' }>;
      body = (
        <Mcq
          payload={a.payload}
          disabled={solved || locked || submit.isPending}
          wrong={submit.data ? !submit.data.solvedThisTry && !submit.data.solved : false}
          onChoose={(choice) => send({ choice })}
        />
      );
      break;
    }
    case 'capture': {
      const a = activity as Extract<Activity, { kind: 'capture' }>;
      body = (
        <Capture
          payload={a.payload}
          disabled={solved || locked}
          onSolved={(moves) => send({ moves })}
        />
      );
      break;
    }
    case 'explanation': {
      const a = activity as Extract<Activity, { kind: 'explanation' }>;
      body = (
        <>
          <Markdown source={a.payload.body} />
          {a.payload.fen ? <Board fen={a.payload.fen} label={t('activity.explanation')} /> : null}
          {viewed}
        </>
      );
      break;
    }
    case 'game': {
      const a = activity as Extract<Activity, { kind: 'game' }>;
      body = (
        <>
          <GameViewer pgn={a.payload.pgn} />
          {viewed}
        </>
      );
      break;
    }
    case 'video': {
      const a = activity as Extract<Activity, { kind: 'video' }>;
      body = (
        <>
          <VideoLink url={a.payload.url} />
          {viewed}
        </>
      );
      break;
    }
    case 'engine':
      body = <Muted>{t('player.webOnly')}</Muted>;
      break;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Text style={[styles.hint, { color: colors.primary, fontWeight: '700' }]}>
          {t(`activity.${(activity as Activity).kind}`)}
        </Text>
        <Text style={styles.hint}>{t('player.points', { count: activity.points })}</Text>
        {triesLeft !== null && !solved ? (
          <Text style={styles.hint}>{t('player.triesLeft', { count: triesLeft })}</Text>
        ) : null}
        {solved ? (
          <Text
            accessibilityRole="text"
            style={[styles.hint, { color: colors.green, fontWeight: '700' }]}
          >
            {t('player.done', { score: attempt?.score ?? 0 })}
          </Text>
        ) : null}
        {locked ? (
          <Text style={[styles.hint, { color: colors.danger }]}>{t('player.noTriesLeft')}</Text>
        ) : null}
      </View>
      {body}
      {submit.isPending ? <Muted>{t('puzzle.saving')}</Muted> : null}
      <ErrorText error={submit.error} />
    </View>
  );
}

function Mcq({
  payload,
  disabled,
  wrong,
  onChoose,
}: {
  payload: ActivityPayload<'mcq'>;
  disabled: boolean;
  wrong: boolean;
  onChoose: (choice: number) => void;
}) {
  const { t } = useT();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[styles.text, { fontWeight: '600', fontSize: 18 }]}>{payload.question}</Text>
      {payload.fen ? <Board fen={payload.fen} label={payload.question} /> : null}
      {payload.options.map((opt, i) => (
        <Pressable
          // biome-ignore lint/suspicious/noArrayIndexKey: thứ tự phương án cố định
          key={i}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onChoose(i)}
          style={{
            borderWidth: 1,
            borderColor: colors.textMuted,
            borderRadius: radius.md,
            padding: spacing.md,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text style={styles.text}>{`${i + 1}. ${opt}`}</Text>
        </Pressable>
      ))}
      {wrong ? <Text style={styles.error}>{t('puzzle.wrong')}</Text> : null}
    </View>
  );
}

function Capture({
  payload,
  disabled,
  onSolved,
}: {
  payload: ActivityPayload<'capture'>;
  disabled: boolean;
  onSolved: (moves: string[]) => void;
}) {
  const { t } = useT();
  const [fen, setFen] = useState(payload.fen);
  const [moves, setMoves] = useState<string[]>([]);
  const remaining = captureTargets(fen);
  const dests = useMemo(() => captureDests(fen), [fen]);
  const side = sideToMove(payload.fen);
  const last = moves.at(-1);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.text}>{t('player.captureGoal', { count: remaining })}</Text>
      <Board
        fen={fen}
        orientation={side}
        lastMove={last ? [last.slice(0, 2), last.slice(2, 4)] : undefined}
        movable={disabled || remaining === 0 ? undefined : { color: side, dests }}
        onMove={(from, to, promo) => {
          const uci = `${from}${to}${promo ?? ''}`;
          const next = playCaptureMove(fen, uci);
          if (!next) return;
          const all = [...moves, uci];
          setFen(next.fen);
          setMoves(all);
          if (captureTargets(next.fen) === 0) onSolved(all);
        }}
        label={t('activity.capture')}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={styles.hint}>{t('player.movesUsed', { count: moves.length })}</Text>
        <Button
          variant="ghost"
          title={t('puzzle.retry')}
          disabled={!moves.length}
          onPress={() => {
            setFen(payload.fen);
            setMoves([]);
          }}
        />
      </View>
    </View>
  );
}

function GameViewer({ pgn }: { pgn: string }) {
  const { t } = useT();
  const tree = useMemo<GameTree | null>(() => {
    try {
      return parsePgn(pgn)[0] ?? null;
    } catch {
      return null;
    }
  }, [pgn]);
  const [id, setId] = useState('root');
  if (!tree) return <Text style={styles.error}>{t('database.badPgn')}</Text>;
  const node = tree.get(id) ?? tree.root;
  const move = id === 'root' ? null : (node as MoveNode);
  const line = tree.mainline();
  return (
    <View style={{ gap: spacing.sm }}>
      <Board
        fen={node.fen}
        lastMove={move ? [move.uci.slice(0, 2), move.uci.slice(2, 4)] : undefined}
        label={t('database.viewer')}
      />
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <Button
          variant="ghost"
          title="⏮"
          accessibilityLabel={t('database.first')}
          onPress={() => setId('root')}
        />
        <Button
          variant="ghost"
          title="◀"
          accessibilityLabel={t('database.prev')}
          onPress={() => setId(tree.parentOf(id)?.id ?? id)}
        />
        <Button
          variant="ghost"
          title="▶"
          accessibilityLabel={t('database.next')}
          onPress={() => setId(tree.next(id)?.id ?? id)}
        />
        <Button
          variant="ghost"
          title="⏭"
          accessibilityLabel={t('database.last')}
          onPress={() => setId(line.at(-1)?.id ?? 'root')}
        />
      </View>
      <Text style={styles.text}>
        {line.map((n) => `${n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}. ` : ''}${n.san}`).join(' ')}
      </Text>
      {move?.comment ? (
        <Text style={[styles.text, { fontStyle: 'italic' }]}>{move.comment}</Text>
      ) : null}
    </View>
  );
}

function VideoLink({ url }: { url: string }) {
  const { t } = useT();
  const client = useErpClient();
  const [error, setError] = useState<unknown>(null);
  return (
    <View style={{ gap: spacing.sm }}>
      <Button
        title={t('player.openVideo')}
        onPress={async () => {
          setError(null);
          try {
            await WebBrowser.openBrowserAsync(await resolveMediaUrl(client, url));
          } catch (e) {
            setError(e);
          }
        }}
      />
      <ErrorText error={error} />
    </View>
  );
}
