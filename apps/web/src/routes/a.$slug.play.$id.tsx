import { useGame, useGameAction, useMembers } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { inCheck, kingSquare, legalDests, replayGame } from '@erpchess/chess-core';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { GameClock } from '../components/play/GameClock';
import { actionErrorKey, resultText } from '../components/play/gameText';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/play/$id')({
  component: GamePage,
});

function GamePage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const game = useGame(id);
  const members = useMembers(academy.id);
  const act = useGameAction(id);
  const [confirmResign, setConfirmResign] = useState(false);
  const [copied, setCopied] = useState(false);
  const claimed = useRef(-1);
  const me = session.user.id;
  const g = game.data;
  const replay = useMemo(() => (g ? replayGame(g.initial_fen, g.moves) : null), [g]);
  const turn = replay?.turn ?? 'w';
  const myColor = g?.white_id === me ? 'w' : g?.black_id === me ? 'b' : null;
  const active = g?.status === 'active';

  // Đồng hồ đối thủ về 0 → nhờ trọng tài xác nhận hết giờ (mỗi lượt một lần)
  const onFlag = useCallback(() => {
    if (!g || !myColor || turn === myColor || claimed.current === g.moves.length) return;
    claimed.current = g.moves.length;
    act.mutate({ action: 'claim_timeout' });
  }, [g, myColor, turn, act]);

  if (game.isPending) return <Spinner />;
  if (game.error || !g || !replay) return <ErrorText error={game.error} />;

  const name = (uid: string | null) =>
    uid === null && g.bot_elo !== null
      ? g.bot_elo
        ? t('play.bot', { elo: g.bot_elo })
        : t('play.botMax')
      : (members.data?.find((m) => m.profile.id === uid)?.profile.display_name ?? '?');
  const orientation = myColor ?? 'w';
  const top = orientation === 'w' ? 'b' : 'w';
  const bottom = orientation;
  const myTurn = active && myColor === turn && !act.isPending;
  const lastUci = g.moves.at(-1);
  const clockRunning = (side: 'w' | 'b') =>
    active && g.base_ms !== null && turn === side && !!g.turn_started_at;
  const clock = (side: 'w' | 'b') => (
    <GameClock
      ms={(side === 'w' ? g.white_ms : g.black_ms) ?? 0}
      running={clockRunning(side)}
      since={g.turn_started_at}
      label={`${side === 'w' ? '♔' : '♚'} ${name(side === 'w' ? g.white_id : g.black_id)}`}
      onFlag={side !== myColor ? onFlag : undefined}
    />
  );
  const playerRow = (side: 'w' | 'b') =>
    g.base_ms !== null ? (
      clock(side)
    ) : (
      <p className="font-medium">
        {side === 'w' ? '♔' : '♚'} {name(side === 'w' ? g.white_id : g.black_id)}
      </p>
    );
  const errKey = actionErrorKey((act.error as { code?: string } | null)?.code);
  const opponentOffered = !!g.draw_offer_by && g.draw_offer_by !== me;
  const change = g.rating_change as { white?: number; black?: number } | null;
  const fmt = (x: number) => (x > 0 ? `+${x}` : String(x));

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/a/$slug/play"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('play.title')}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2">
          {playerRow(top)}
          <Board
            fen={replay.fen}
            orientation={orientation}
            lastMove={lastUci ? [lastUci.slice(0, 2), lastUci.slice(2, 4)] : undefined}
            check={inCheck(replay.fen) ? kingSquare(replay.fen) : undefined}
            movable={myTurn ? { color: turn, dests: legalDests(replay.fen) } : undefined}
            onMove={(from, to, promo) =>
              act.mutate({
                action: 'move',
                move: `${from}${to}${promo ?? ''}`,
                ply: g.moves.length,
              })
            }
            label={`${name(g.white_id)} – ${name(g.black_id)}`}
          />
          {playerRow(bottom)}
        </div>
        <div className="flex flex-col gap-4">
          <Card title={resultText(g, t)}>
            {active && myColor && (
              <p role="status" className="text-sm font-medium">
                {myColor === turn ? t('play.yourTurn') : t('play.opponentTurn')}
              </p>
            )}
            {!myColor && active && <p className="text-sm text-text-muted">{t('play.spectator')}</p>}
            {change && g.white_id && g.black_id && (
              <ul className="text-sm">
                <li>
                  {t('play.ratingChange', {
                    name: name(g.white_id),
                    change: fmt(change.white ?? 0),
                  })}
                </li>
                <li>
                  {t('play.ratingChange', {
                    name: name(g.black_id),
                    change: fmt(change.black ?? 0),
                  })}
                </li>
              </ul>
            )}
            {active && myColor && (
              <div className="flex flex-wrap gap-2">
                {opponentOffered ? (
                  <>
                    <span className="self-center text-sm font-medium">{t('play.drawOfferIn')}</span>
                    <Button
                      variant="primary"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: 'accept_draw' })}
                    >
                      {t('play.accept')}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: 'decline_draw' })}
                    >
                      {t('play.decline')}
                    </Button>
                  </>
                ) : g.draw_offer_by === me ? (
                  <span className="text-sm text-text-muted">{t('play.drawOffered')}</span>
                ) : (
                  <Button
                    variant="ghost"
                    disabled={act.isPending || g.moves.length < 2}
                    onClick={() => act.mutate({ action: 'offer_draw' })}
                  >
                    {t('play.offerDraw')}
                  </Button>
                )}
                {g.moves.length < 2 ? (
                  <Button
                    variant="ghost"
                    className="text-danger"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: 'abort' })}
                  >
                    {t('play.abort')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-danger"
                    disabled={act.isPending}
                    onClick={() =>
                      confirmResign ? act.mutate({ action: 'resign' }) : setConfirmResign(true)
                    }
                  >
                    {confirmResign ? t('play.confirmResign') : t('play.resign')}
                  </Button>
                )}
              </div>
            )}
            {errKey ? (
              <p role="alert" className="text-sm text-danger">
                {t(errKey)}
              </p>
            ) : (
              <ErrorText error={act.error} />
            )}
            {g.pgn && (
              <Button
                variant="ghost"
                className="self-start text-sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(g.pgn ?? '');
                  setCopied(true);
                }}
              >
                {copied ? t('play.copied') : t('play.copyPgn')}
              </Button>
            )}
          </Card>
          <Card title={t('play.moves')}>
            <ol className="grid grid-cols-[2rem_1fr_1fr] gap-x-2 text-sm">
              {Array.from({ length: Math.ceil(replay.sans.length / 2) }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: số thứ tự nước đi là khoá ổn định
                <li key={i} className="contents">
                  <span className="text-text-muted">{i + 1}.</span>
                  <span>{replay.sans[i * 2]}</span>
                  <span>{replay.sans[i * 2 + 1] ?? ''}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
