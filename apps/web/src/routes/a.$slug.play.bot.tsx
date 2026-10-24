import { useGameMutations } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { inCheck, kingSquare, legalDests, START_FEN } from '@erpchess/chess-core';
import { BOT_LEVELS } from '@erpchess/engine';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { resultText } from '../components/play/gameText';
import { useBotGame } from '../components/play/useBotGame';
import { Button, Card, ErrorText } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/play/bot')({
  component: BotPage,
});

type Setup = { color: 'w' | 'b'; elo: number | null };

function BotPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [round, setRound] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/a/$slug/play"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('play.title')}
      </Link>
      {setup ? (
        <BotBoard
          key={round}
          setup={setup}
          onNew={() => {
            setSetup(null);
            setRound((r) => r + 1);
          }}
        />
      ) : (
        <SetupForm onStart={setSetup} />
      )}
    </div>
  );
}

function SetupForm({ onStart }: { onStart: (s: Setup) => void }) {
  const { t } = useT();
  const [elo, setElo] = useState<string>(String(BOT_LEVELS[1].elo));
  const [color, setColor] = useState<'w' | 'b' | 'random'>('w');
  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';
  return (
    <Card title={t('play.playBot')}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t('play.level')}</span>
        <select value={elo} onChange={(e) => setElo(e.target.value)} className={select}>
          {BOT_LEVELS.map(({ id, elo: e }) => (
            <option key={id} value={e === null ? '' : String(e)}>
              {e === null ? t('play.botMax') : t('play.bot', { elo: e })}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-2 font-medium">{t('play.yourColor')}</legend>
        {(['w', 'b', 'random'] as const).map((c) => (
          <label key={c} className="flex items-center gap-2">
            <input type="radio" name="color" checked={color === c} onChange={() => setColor(c)} />
            {c === 'w' ? t('play.white') : c === 'b' ? t('play.black') : t('play.randomColor')}
          </label>
        ))}
      </fieldset>
      <Button
        variant="cta"
        className="self-start"
        onClick={() =>
          onStart({
            elo: elo ? Number(elo) : null,
            color: color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color,
          })
        }
      >
        {t('play.start')}
      </Button>
    </Card>
  );
}

function BotBoard({ setup, onNew }: { setup: Setup; onNew: () => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { saveBot } = useGameMutations(academy.id, session.user.id);
  const game = useBotGame({
    initialFen: START_FEN,
    color: setup.color,
    elo: setup.elo,
    onFinish: (f) =>
      saveBot.mutate({
        color: setup.color,
        botElo: setup.elo,
        initialFen: START_FEN,
        moves: f.moves,
        fen: f.fen,
        result: f.result,
        reason: f.reason,
        pgn: f.pgn,
      }),
  });
  const last = game.moves.at(-1);
  const canMove =
    game.engineState === 'ready' && !game.thinking && !game.finished && game.turn === setup.color;
  const botLabel = setup.elo === null ? t('play.botMax') : t('play.bot', { elo: setup.elo });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2">
        <p className="font-medium">{botLabel}</p>
        <Board
          fen={game.fen}
          orientation={setup.color}
          lastMove={last ? [last.slice(0, 2), last.slice(2, 4)] : undefined}
          check={inCheck(game.fen) ? kingSquare(game.fen) : undefined}
          movable={canMove ? { color: setup.color, dests: legalDests(game.fen) } : undefined}
          onMove={(from, to, promo) => game.play(`${from}${to}${promo ?? ''}`)}
          label={botLabel}
        />
      </div>
      <Card
        title={
          game.finished
            ? resultText(
                { status: 'finished', result: game.finished.result, reason: game.finished.reason },
                t,
              )
            : t('play.inProgress')
        }
      >
        {game.engineState === 'loading' && (
          <p className="text-sm text-text-muted">{t('play.engineLoading')}</p>
        )}
        {game.engineState === 'unavailable' && (
          <p className="text-sm text-danger">{t('play.engineUnavailable')}</p>
        )}
        {game.thinking && (
          <p role="status" className="text-sm text-text-muted">
            {t('play.botThinking')}
          </p>
        )}
        {saveBot.isSuccess && (
          <p role="status" className="text-sm text-green">
            {t('play.saved')}
          </p>
        )}
        <ErrorText error={saveBot.error} />
        <p className="text-sm">
          {game.sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).join(' ')}
        </p>
        <div className="flex gap-2">
          {game.finished ? (
            <Button variant="cta" onClick={onNew}>
              {t('play.newGame')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-danger"
              onClick={game.resign}
              disabled={game.moves.length === 0}
            >
              {t('play.resign')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
