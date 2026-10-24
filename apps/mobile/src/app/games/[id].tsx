import { useGame, useGameAction, useMembers, useSession } from '@erpchess/api/react';
import { Board } from '@erpchess/board-native';
import { inCheck, kingSquare, legalDests, replayGame } from '@erpchess/chess-core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, ErrorText, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

function clockText(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Ván 1–1 trên điện thoại: mọi nước đi qua trọng tài server, trạng thái đẩy về qua Realtime. */
export default function GameScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const game = useGame(id);
  const g = game.data;
  const members = useMembers(g?.academy_id);
  const act = useGameAction(id);
  const [now, setNow] = useState(() => Date.now());
  const [confirmResign, setConfirmResign] = useState(false);
  const claimed = useRef(-1);
  const replay = useMemo(() => (g ? replayGame(g.initial_fen, g.moves) : null), [g]);
  const me = session?.user.id;
  const myColor = g?.white_id === me ? 'w' : g?.black_id === me ? 'b' : null;
  const active = g?.status === 'active';
  const turn = replay?.turn ?? 'w';
  const running = active && g?.base_ms !== null && !!g?.turn_started_at;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);

  const left = (side: 'w' | 'b') => {
    if (!g) return 0;
    const base = (side === 'w' ? g.white_ms : g.black_ms) ?? 0;
    return running && turn === side && g.turn_started_at
      ? base - (now - Date.parse(g.turn_started_at))
      : base;
  };
  // Đồng hồ đối thủ về 0 → nhờ trọng tài xác nhận hết giờ
  const opponentFlagged = !!g && !!myColor && turn !== myColor && running && left(turn) <= 0;
  useEffect(() => {
    if (!opponentFlagged || !g || claimed.current === g.moves.length) return;
    claimed.current = g.moves.length;
    act.mutate({ action: 'claim_timeout' });
  }, [opponentFlagged, g, act]);

  if (game.isPending) return <Spinner />;
  if (game.error || !g || !replay) return <ErrorText error={game.error} />;
  const name = (uid: string | null) =>
    members.data?.find((m) => m.profile.id === uid)?.profile.display_name ?? '?';
  const orientation = myColor ?? 'w';
  const row = (side: 'w' | 'b') => (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <Text style={[styles.text, { fontWeight: turn === side && active ? '700' : '400' }]}>
        {`${side === 'w' ? '♔' : '♚'} ${name(side === 'w' ? g.white_id : g.black_id)}`}
      </Text>
      {g.base_ms !== null ? (
        <Text style={[styles.text, { fontVariant: ['tabular-nums'] }]}>
          {clockText(left(side))}
        </Text>
      ) : null}
    </View>
  );
  const last = g.moves.at(-1);
  const result =
    g.status === 'aborted'
      ? t('play.aborted')
      : g.status === 'finished'
        ? g.result === '1-0'
          ? t('play.resultWhite')
          : g.result === '0-1'
            ? t('play.resultBlack')
            : t('play.resultDraw')
        : myColor === turn
          ? t('play.yourTurn')
          : t('play.opponentTurn');

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: `${name(g.white_id)} – ${name(g.black_id)}` }} />
      {row(orientation === 'w' ? 'b' : 'w')}
      <Board
        fen={replay.fen}
        orientation={orientation}
        lastMove={last ? [last.slice(0, 2), last.slice(2, 4)] : undefined}
        check={inCheck(replay.fen) ? kingSquare(replay.fen) : undefined}
        movable={
          active && myColor === turn && !act.isPending
            ? { color: turn, dests: legalDests(replay.fen) }
            : undefined
        }
        onMove={(from, to, promo) =>
          act.mutate({ action: 'move', move: `${from}${to}${promo ?? ''}`, ply: g.moves.length })
        }
        label={`${name(g.white_id)} – ${name(g.black_id)}`}
      />
      {row(orientation)}
      <Card title={result}>
        {active && myColor ? (
          <View style={{ gap: 8 }}>
            {g.draw_offer_by && g.draw_offer_by !== me ? (
              <>
                <Text style={styles.text}>{t('play.drawOfferIn')}</Text>
                <Button
                  title={t('play.accept')}
                  onPress={() => act.mutate({ action: 'accept_draw' })}
                />
                <Button
                  title={t('play.decline')}
                  variant="ghost"
                  onPress={() => act.mutate({ action: 'decline_draw' })}
                />
              </>
            ) : g.moves.length >= 2 && g.draw_offer_by !== me ? (
              <Button
                title={t('play.offerDraw')}
                variant="ghost"
                onPress={() => act.mutate({ action: 'offer_draw' })}
              />
            ) : null}
            {g.moves.length < 2 ? (
              <Button
                title={t('play.abort')}
                variant="ghost"
                onPress={() => act.mutate({ action: 'abort' })}
              />
            ) : (
              <Button
                title={confirmResign ? t('play.confirmResign') : t('play.resign')}
                variant="ghost"
                onPress={() =>
                  confirmResign ? act.mutate({ action: 'resign' }) : setConfirmResign(true)
                }
              />
            )}
          </View>
        ) : null}
        <Text style={styles.hint}>
          {replay.sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).join(' ')}
        </Text>
        <ErrorText error={act.error} />
      </Card>
    </ScrollView>
  );
}
