import { useGameMutations } from '@erpchess/api/react';
import { inCheck, kingSquare, legalDests, START_FEN } from '@erpchess/chess-core';
import type { TranslationKey } from '@erpchess/i18n';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PreferredBoard } from '../components/board/PreferredBoard';
import { useBotGame } from '../components/play/useBotGame';
import { Button, Card } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/play/bot')({
  component: BotPage,
});

type Setup = { color: 'w' | 'b'; elo: number | null };

const BOT_PRESETS = [
  {
    id: 'l1',
    elo: 800,
    icon: '🐣',
    title: 'Tân binh',
    desc: 'Thích hợp cho học viên mới bắt đầu làm quen với cờ vua',
    badge: 'Cơ bản',
    badgeColor: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'l2',
    elo: 1100,
    icon: '♟️',
    title: 'Nghiệp dư',
    desc: 'Biết triển khai quân cơ bản, rèn luyện đòn chiến thuật đơn giản',
    badge: 'Sơ cấp',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'l3',
    elo: 1400,
    icon: '🥉',
    title: 'Trung cấp',
    desc: 'Cờ chớp cấp câu lạc bộ, tính toán 2-3 nước đi',
    badge: 'Phong trào',
    badgeColor: 'bg-cyan-100 text-cyan-800',
  },
  {
    id: 'l4',
    elo: 1700,
    icon: '🥈',
    title: 'Nâng cao',
    desc: 'Trình độ tuyển chọn cấp quận/huyện, ít khi mắc lỗi sơ đẳng',
    badge: 'Nâng cao',
    badgeColor: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'l5',
    elo: 2000,
    icon: '🥇',
    title: 'Kiện tướng CLB',
    desc: 'Chiến lược khai cuộc bài bản, chuyển hoá ưu thế chặt chẽ',
    badge: 'Kiện tướng',
    badgeColor: 'bg-purple-100 text-purple-800',
  },
  {
    id: 'l6',
    elo: 2300,
    icon: '🏆',
    title: 'Đại kiện tướng',
    desc: 'Kỹ năng tàn cuộc mẫu mực, tính toán chuẩn xác và sâu sắc',
    badge: 'Cao thủ',
    badgeColor: 'bg-rose-100 text-rose-800',
  },
  {
    id: 'max',
    elo: null,
    icon: '⚡',
    title: 'Arasan Tối thượng',
    desc: 'Sức mạnh động cơ tối đa (Elo 2600+), không giới hạn độ sâu',
    badge: 'Bất bại',
    badgeColor: 'bg-red-100 text-red-800',
  },
];

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
  const [selectedElo, setSelectedElo] = useState<number | null>(1100);
  const [color, setColor] = useState<'w' | 'b' | 'random'>('w');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">{t('play.playBot')}</h2>
        <p className="mt-1 text-sm text-text-muted">
          Chọn độ khó của động cơ cờ vua Arasan để luyện tập kỹ năng thi đấu thực chiến.
        </p>
      </div>

      {/* Grid lựa chọn Bot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {BOT_PRESETS.map((bot) => {
          const isSelected = selectedElo === bot.elo;
          return (
            <button
              key={bot.id}
              type="button"
              onClick={() => setSelectedElo(bot.elo)}
              className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary'
                  : 'border-text-muted/20 bg-white hover:border-primary/50 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-3xl" aria-hidden="true">
                    {bot.icon}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${bot.badgeColor}`}
                  >
                    {bot.badge}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-text">{bot.title}</h3>
                <div className="text-sm font-semibold text-primary">
                  {bot.elo ? `Elo ~${bot.elo}` : 'Elo 2600+ (Max)'}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">{bot.desc}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-text-muted/10 pt-2 text-xs font-medium">
                <span className={isSelected ? 'text-primary font-bold' : 'text-text-muted'}>
                  {isSelected ? '✓ Đang chọn' : 'Nhấp để chọn'}
                </span>
                <span className="text-primary font-semibold">Chọn →</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tùy chọn Màu quân & Nút bắt đầu */}
      <Card title={t('play.yourColor')}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setColor('w')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                color === 'w'
                  ? 'border-primary bg-primary text-white shadow-xs'
                  : 'border-text-muted/20 bg-white text-text hover:bg-bg'
              }`}
            >
              <span className="inline-block size-4 rounded-full border border-gray-300 bg-white" />
              {t('play.white')} (Đi trước)
            </button>
            <button
              type="button"
              onClick={() => setColor('b')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                color === 'b'
                  ? 'border-primary bg-primary text-white shadow-xs'
                  : 'border-text-muted/20 bg-white text-text hover:bg-bg'
              }`}
            >
              <span className="inline-block size-4 rounded-full bg-black" />
              {t('play.black')} (Đi sau)
            </button>
            <button
              type="button"
              onClick={() => setColor('random')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                color === 'random'
                  ? 'border-primary bg-primary text-white shadow-xs'
                  : 'border-text-muted/20 bg-white text-text hover:bg-bg'
              }`}
            >
              <span>🎲</span>
              {t('play.randomColor')}
            </button>
          </div>

          <Button
            variant="cta"
            className="px-6 py-2.5 text-base font-semibold shadow-md"
            onClick={() =>
              onStart({
                elo: selectedElo,
                color: color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color,
              })
            }
          >
            Bắt đầu thi đấu →
          </Button>
        </div>
      </Card>
    </div>
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
        botElo: setup.elo,
        color: setup.color,
        initialFen: START_FEN,
        fen: f.fen,
        moves: f.moves,
        pgn: f.pgn,
        result: f.result,
        reason: f.reason,
      }),
  });

  const canMove =
    game.engineState === 'ready' && !game.thinking && !game.finished && game.turn === setup.color;
  const check = game.fen && inCheck(game.fen);
  const checkSquare = check ? kingSquare(game.fen) : undefined;
  const lastMoveUci = game.moves.at(-1);
  const lastMove = lastMoveUci
    ? ([lastMoveUci.slice(0, 2), lastMoveUci.slice(2, 4)] as [string, string])
    : undefined;
  const botTitle = setup.elo ? `Bot Arasan (Elo ${setup.elo})` : 'Bot Arasan Tối thượng';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={botTitle}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-[520px]">
            <PreferredBoard
              fen={game.fen}
              orientation={setup.color}
              movable={canMove ? { color: setup.color, dests: legalDests(game.fen) } : undefined}
              check={checkSquare}
              lastMove={lastMove}
              onMove={(from, to, promo) => game.play(`${from}${to}${promo ?? ''}`)}
              label={botTitle}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title={t('play.title')}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-text-muted/15 pb-2 text-sm">
              <span className="text-text-muted">Đối thủ</span>
              <span className="font-bold text-primary">{botTitle}</span>
            </div>
            <div className="flex items-center justify-between border-b border-text-muted/15 pb-2 text-sm">
              <span className="text-text-muted">Bạn cầm quân</span>
              <span className="font-semibold">
                {setup.color === 'w' ? 'Trắng (đi trước)' : 'Đen (đi sau)'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-text-muted/15 pb-2 text-sm">
              <span className="text-text-muted">Lượt đi</span>
              <span className="font-semibold text-primary">
                {canMove ? t('play.yourTurn') : 'Bot đang nghĩ...'}
              </span>
            </div>

            {game.finished && (
              <div className="my-2 rounded-lg bg-primary/10 p-3 text-center">
                <div className="text-base font-bold text-primary">
                  {game.finished.result === '1-0'
                    ? t('play.resultWhite')
                    : game.finished.result === '0-1'
                      ? t('play.resultBlack')
                      : t('play.resultDraw')}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  Lý do:{' '}
                  {t(`play.reason_${game.finished.reason}` as TranslationKey) ||
                    game.finished.reason}
                </div>
              </div>
            )}

            <div className="mt-2 flex gap-2">
              {!game.finished ? (
                <Button
                  variant="ghost"
                  className="w-full text-danger hover:bg-danger/10"
                  onClick={() => game.resign()}
                >
                  {t('play.resign')}
                </Button>
              ) : (
                <Button variant="cta" className="w-full" onClick={onNew}>
                  Ván mới
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Danh sách nước đi */}
        <Card title={t('play.moves')}>
          <div className="max-h-60 overflow-y-auto font-mono text-xs leading-relaxed text-text">
            {game.moves.length === 0 ? (
              <span className="text-text-muted">Chưa có nước đi nào.</span>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {game.moves
                  .reduce<string[][]>((acc, m, i) => {
                    if (i % 2 === 0) acc.push([`${Math.floor(i / 2) + 1}. ${m}`]);
                    else {
                      const last = acc.at(-1);
                      if (last) last.push(m);
                    }
                    return acc;
                  }, [])
                  .map((pair) => (
                    <div key={pair[0]} className="flex gap-2">
                      <span className="font-semibold text-primary">{pair[0]}</span>
                      <span>{pair[1] || ''}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
