import {
  formatPgn,
  type GameEnd,
  type GameResultCode,
  lossFor,
  playMove,
  replayGame,
  resultOf,
} from '@erpchess/chess-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEngine } from '../../lib/engine';

type EngineState = 'loading' | 'ready' | 'unavailable';
export type BotFinish = { result: GameResultCode; reason: GameEnd | 'resign' };

/**
 * Ván với máy Arasan chạy trong trình duyệt: danh sách nước là nguồn sự thật, đi lại để biết thế
 * cờ và kết thúc (kể cả lặp 3 lần). `elo` null = mạnh nhất. Ván xong gọi `onFinish` một lần.
 */
export function useBotGame(opts: {
  initialFen: string;
  color: 'w' | 'b';
  elo: number | null;
  onFinish: (f: BotFinish & { moves: string[]; fen: string; pgn: string }) => void;
}) {
  const [moves, setMoves] = useState<string[]>([]);
  const [engineState, setEngineState] = useState<EngineState>('loading');
  const [thinking, setThinking] = useState(false);
  const [finished, setFinished] = useState<BotFinish | null>(null);
  const engineRef = useRef<Awaited<ReturnType<typeof getEngine>> | null>(null);
  const replay = useMemo(() => replayGame(opts.initialFen, moves), [opts.initialFen, moves]);
  const onFinish = useRef(opts.onFinish);
  onFinish.current = opts.onFinish;

  useEffect(() => {
    let alive = true;
    getEngine().then(
      (e) => {
        if (!alive) return;
        engineRef.current = e;
        setEngineState('ready');
      },
      () => alive && setEngineState('unavailable'),
    );
    return () => {
      alive = false;
    };
  }, []);

  const end = useCallback(
    (f: BotFinish, list: string[]) => {
      setFinished(f);
      const r = replayGame(opts.initialFen, list);
      onFinish.current({
        ...f,
        moves: list,
        fen: r?.fen ?? opts.initialFen,
        pgn: formatPgn({
          headers: {
            Event: 'ERPChess',
            White: opts.color === 'w' ? 'Bạn' : 'Arasan',
            Black: opts.color === 'b' ? 'Bạn' : 'Arasan',
          },
          initialFen: opts.initialFen,
          sans: r?.sans ?? [],
          result: f.result,
        }),
      });
    },
    [opts.initialFen, opts.color],
  );

  // Sau mỗi nước: kiểm kết thúc; đến lượt máy thì máy đi
  useEffect(() => {
    if (!replay || finished) return;
    if (replay.status !== 'ongoing') {
      end({ result: resultOf(replay.status, replay.turn), reason: replay.status }, moves);
      return;
    }
    if (replay.turn === opts.color || engineState !== 'ready' || !engineRef.current) return;
    let alive = true;
    setThinking(true);
    engineRef.current
      .play(replay.fen, { elo: opts.elo ?? undefined, movetimeMs: 800 })
      .then((best) => {
        const played = best.move ? playMove(replay.fen, best.move) : null;
        if (alive && played) setMoves((m) => [...m, played.uci]);
      })
      .finally(() => alive && setThinking(false));
    return () => {
      alive = false;
    };
  }, [replay, finished, engineState, opts.color, opts.elo, moves, end]);

  return {
    fen: replay?.fen ?? opts.initialFen,
    moves,
    sans: replay?.sans ?? [],
    turn: replay?.turn ?? 'w',
    engineState,
    thinking,
    finished,
    play(uci: string) {
      if (finished || !replay || replay.turn !== opts.color) return;
      if (playMove(replay.fen, uci)) setMoves((m) => [...m, uci]);
    },
    resign() {
      if (!finished) end({ result: lossFor(opts.color), reason: 'resign' }, moves);
    },
  };
}
