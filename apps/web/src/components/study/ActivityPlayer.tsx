import { type ActivityAttempt, resolveMediaUrl, type SubmitActivityResult } from '@erpchess/api';
import { useErpClient, useSubmitActivity } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import {
  captureDests,
  captureTargets,
  gameStatus,
  inCheck,
  kingSquare,
  legalDests,
  playCaptureMove,
  playMove,
  sideToMove,
} from '@erpchess/chess-core';
import { type Activity, type ActivityPayload, videoEmbed } from '@erpchess/domain';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { getEngine } from '../../lib/engine';
import { useT } from '../../lib/use-t';
import { PuzzleSolver } from '../puzzle/PuzzleSolver';
import { Button, ErrorText } from '../ui';
import { GameViewer } from './GameViewer';
import { Markdown } from './Markdown';

type Props = {
  studyId: string;
  activity: Activity & { id: string };
  attempt?: ActivityAttempt;
};

/** Một hoạt động trong trình học: phần chung (trạng thái, điểm, lượt) + phần riêng theo loại. */
export function ActivityPlayer({ studyId, activity, attempt }: Props) {
  const { t } = useT();
  const submit = useSubmitActivity(studyId);
  const solved = attempt?.solved ?? false;
  const triesLeft =
    activity.maxAttempts === null
      ? null
      : Math.max(0, activity.maxAttempts - (attempt?.tries ?? 0));
  const locked = !solved && triesLeft === 0;
  const startedAt = useRef(Date.now());

  function send(
    answer: Parameters<typeof submit.mutate>[0]['answer'],
    onDone?: (r: SubmitActivityResult) => void,
  ) {
    const ms = Date.now() - startedAt.current;
    startedAt.current = Date.now();
    submit.mutate({ activityId: activity.id, answer, ms }, { onSuccess: onDone });
  }

  let body: ReactNode;
  switch (activity.kind) {
    case 'puzzle':
      body = (
        <PuzzleSolver
          puzzle={activity.payload}
          onTryEnd={(s) => !solved && !locked && send({ moves: s.moves.map((m) => m.uci) })}
        />
      );
      break;
    case 'mcq':
      body = (
        <Mcq
          payload={activity.payload}
          disabled={solved || locked || submit.isPending}
          feedback={
            submit.data
              ? submit.data.solvedThisTry
                ? 'right'
                : submit.data.solved
                  ? null
                  : 'wrong'
              : null
          }
          onChoose={(choice) => send({ choice })}
        />
      );
      break;
    case 'capture':
      body = (
        <Capture
          payload={activity.payload}
          disabled={solved || locked}
          onSolved={(moves) => send({ moves })}
        />
      );
      break;
    case 'explanation':
      body = (
        <>
          <Markdown source={activity.payload.body} />
          {activity.payload.fen && (
            <div className="max-w-sm">
              <Board
                fen={activity.payload.fen}
                label={t('activity.explanation')}
                drawings={{ arrows: activity.payload.arrows ?? [], highlights: [] }}
              />
            </div>
          )}
          <Viewed done={solved} pending={submit.isPending} onClick={() => send({ viewed: true })} />
        </>
      );
      break;
    case 'video':
      body = (
        <>
          <Video url={activity.payload.url} />
          <Viewed done={solved} pending={submit.isPending} onClick={() => send({ viewed: true })} />
        </>
      );
      break;
    case 'game':
      body = (
        <>
          <div className="max-w-md">
            <GameViewer pgn={activity.payload.pgn} />
          </div>
          <Viewed done={solved} pending={submit.isPending} onClick={() => send({ viewed: true })} />
        </>
      );
      break;
    case 'engine':
      body = (
        <EngineGame
          payload={activity.payload}
          disabled={solved || locked}
          onFinish={(result) => send({ result })}
        />
      );
      break;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
          {t(`activity.${activity.kind}`)}
        </span>
        <span>{t('player.points', { count: activity.points })}</span>
        {triesLeft !== null && !solved && (
          <span className="text-text-muted">{t('player.triesLeft', { count: triesLeft })}</span>
        )}
        {solved && (
          <span role="status" className="font-bold text-green">
            {t('player.done', { score: attempt?.score ?? 0 })}
          </span>
        )}
        {locked && <span className="font-bold text-danger">{t('player.noTriesLeft')}</span>}
      </div>
      {body}
      {submit.isPending && <p className="text-sm text-text-muted">{t('puzzle.saving')}</p>}
      <ErrorText error={submit.error} />
    </div>
  );
}

function Viewed({
  done,
  pending,
  onClick,
}: {
  done: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const { t } = useT();
  if (done) return null;
  return (
    <Button variant="cta" className="self-start" disabled={pending} onClick={onClick}>
      {t('player.markViewed')}
    </Button>
  );
}

/** Trắc nghiệm; `feedback` là kết quả lần chọn gần nhất (đúng/sai), dùng chung cho Study và Quiz. */
export function Mcq({
  payload,
  disabled,
  feedback,
  onChoose,
}: {
  payload: { question: string; fen?: string; options: string[] };
  disabled: boolean;
  feedback?: 'right' | 'wrong' | null;
  onChoose: (choice: number) => void;
}) {
  const { t } = useT();
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-medium">{payload.question}</p>
      {payload.fen && (
        <div className="max-w-sm">
          <Board fen={payload.fen} label={payload.question} />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {payload.options.map((opt, i) => {
          const wrong = feedback === 'wrong' && picked === i;
          const right = feedback === 'right' && picked === i;
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: thứ tự phương án cố định
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => {
                setPicked(i);
                onChoose(i);
              }}
              className={`rounded-md border px-4 py-3 text-left ${right ? 'border-green bg-green/10' : wrong ? 'border-danger bg-danger/10' : 'border-text-muted/30 hover:bg-bg'}`}
            >
              {i + 1}. {opt}
            </button>
          );
        })}
      </div>
      {feedback === 'wrong' && <p className="font-medium text-danger">{t('puzzle.wrong')}</p>}
    </div>
  );
}

/** Bắt quân trên bàn không vua; gọi `onSolved` với chuỗi nước khi đã bắt hết. */
export function Capture({
  payload,
  disabled,
  onSolved,
}: {
  payload: { fen: string };
  disabled: boolean;
  onSolved: (moves: string[]) => void;
}) {
  const { t } = useT();
  const [fen, setFen] = useState(payload.fen);
  const [moves, setMoves] = useState<string[]>([]);
  const remaining = captureTargets(fen);
  const dests = useMemo(() => captureDests(fen), [fen]);
  const last = moves.at(-1);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{t('player.captureGoal', { count: remaining })}</p>
      <div className="max-w-md">
        <Board
          fen={fen}
          orientation={sideToMove(payload.fen)}
          lastMove={last ? [last.slice(0, 2), last.slice(2, 4)] : undefined}
          movable={
            disabled || remaining === 0 ? undefined : { color: sideToMove(payload.fen), dests }
          }
          onMove={(from, to, promo) => {
            const next = playCaptureMove(fen, `${from}${to}${promo ?? ''}`);
            if (!next) return;
            const all = [...moves, `${from}${to}${promo ?? ''}`];
            setFen(next.fen);
            setMoves(all);
            if (captureTargets(next.fen) === 0) onSolved(all);
          }}
          label={t('activity.capture')}
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span>{t('player.movesUsed', { count: moves.length })}</span>
        <Button
          variant="ghost"
          disabled={!moves.length}
          onClick={() => {
            setFen(payload.fen);
            setMoves([]);
          }}
        >
          {t('puzzle.retry')}
        </Button>
      </div>
    </div>
  );
}

function Video({ url }: { url: string }) {
  const { t } = useT();
  const client = useErpClient();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    resolveMediaUrl(client, url).then(
      (s) => active && setSrc(s),
      (e) => active && setError(e),
    );
    return () => {
      active = false;
    };
  }, [client, url]);

  if (error) return <ErrorText error={error} />;
  if (!src) return <p className="text-text-muted">{t('common.loading')}</p>;
  const embed = videoEmbed(src);
  if (!embed) return <p className="text-danger">{t('player.badVideo')}</p>;
  return embed.kind === 'file' ? (
    // biome-ignore lint/a11y/useMediaCaption: video bài giảng do HLV tải lên, chưa có phụ đề
    <video src={embed.src} controls className="aspect-video w-full rounded-md bg-black" />
  ) : (
    <iframe
      src={embed.src}
      title={t('activity.video')}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="fullscreen; picture-in-picture"
      className="aspect-video w-full rounded-md"
    />
  );
}

type EngineState = 'loading' | 'ready' | 'unavailable';

function EngineGame({
  payload,
  disabled,
  onFinish,
}: {
  payload: ActivityPayload<'engine'>;
  disabled: boolean;
  onFinish: (result: 'win' | 'draw' | 'loss') => void;
}) {
  const { t } = useT();
  const [fen, setFen] = useState(payload.fen);
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [state, setState] = useState<EngineState>('loading');
  const [result, setResult] = useState<'win' | 'draw' | 'loss' | null>(null);
  const engineRef = useRef<Awaited<ReturnType<typeof getEngine>> | null>(null);
  const status = gameStatus(fen);
  const turn = sideToMove(fen);
  const dests = useMemo(() => legalDests(fen), [fen]);

  useEffect(() => {
    let active = true;
    getEngine().then(
      (e) => {
        if (!active) return;
        engineRef.current = e;
        setState('ready');
      },
      () => active && setState('unavailable'),
    );
    return () => {
      active = false;
    };
  }, []);

  function finish(r: 'win' | 'draw' | 'loss') {
    setResult(r);
    onFinish(r);
  }

  /** Sau mỗi nước: kiểm kết thúc ván, đến lượt máy thì để máy đi. */
  async function afterMove(next: string) {
    const s = gameStatus(next);
    if (s !== 'ongoing') {
      const studentMoved = sideToMove(next) !== payload.side;
      finish(s === 'checkmate' ? (studentMoved ? 'win' : 'loss') : 'draw');
      return;
    }
    if (sideToMove(next) === payload.side || !engineRef.current) return;
    setThinking(true);
    try {
      const best = await engineRef.current.play(next, {
        elo: payload.elo ?? undefined,
        movetimeMs: 800,
      });
      const played = best.move ? playMove(next, best.move) : null;
      if (played) {
        setFen(played.fen);
        setLastMove(played.uci);
        await afterMove(played.fen);
      }
    } finally {
      setThinking(false);
    }
  }

  // Thế đầu là lượt máy thì máy đi trước
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy khi engine sẵn sàng lần đầu
  useEffect(() => {
    if (state === 'ready' && turn !== payload.side && !result) void afterMove(fen);
  }, [state]);

  if (state === 'unavailable')
    return <p className="text-danger">{t('player.engineUnavailable')}</p>;
  const canMove =
    state === 'ready' &&
    !thinking &&
    !result &&
    !disabled &&
    turn === payload.side &&
    status === 'ongoing';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {payload.goal === 'win' ? t('player.engineGoalWin') : t('player.engineGoalDraw')}
      </p>
      <div className="max-w-md">
        <Board
          fen={fen}
          orientation={payload.side}
          lastMove={lastMove ? [lastMove.slice(0, 2), lastMove.slice(2, 4)] : undefined}
          check={inCheck(fen) ? kingSquare(fen) : undefined}
          movable={canMove ? { color: payload.side, dests } : undefined}
          onMove={(from, to, promo) => {
            const played = playMove(fen, `${from}${to}${promo ?? ''}`);
            if (!played) return;
            setFen(played.fen);
            setLastMove(played.uci);
            void afterMove(played.fen);
          }}
          label={t('activity.engine')}
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        {state === 'loading' && <span>{t('common.loading')}</span>}
        {thinking && <span>{t('player.engineThinking')}</span>}
        {result && <span className="font-bold">{t(`player.result_${result}`)}</span>}
        {!result && !disabled && state === 'ready' && (
          <Button variant="ghost" onClick={() => finish('loss')}>
            {t('player.resign')}
          </Button>
        )}
        {result && !disabled && (
          <Button
            variant="ghost"
            onClick={() => {
              setFen(payload.fen);
              setLastMove(null);
              setResult(null);
              if (sideToMove(payload.fen) !== payload.side) void afterMove(payload.fen);
            }}
          >
            {t('puzzle.retry')}
          </Button>
        )}
      </div>
    </div>
  );
}
