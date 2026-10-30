import { type ChessShare, detectChessShare, sideToMove } from '@erpchess/chess-core';
import { useMemo } from 'react';
import { useT } from '../../lib/use-t';
import { PreferredBoard } from '../board/PreferredBoard';

/** Phần xem trước ngắn cho danh sách hội thoại: thay chuỗi FEN/PGN thô bằng nhãn. */
export function useChatPreview() {
  const { t } = useT();
  return (body: string | null): string | null => {
    if (!body) return body;
    const share = detectChessShare(body);
    if (!share) return body;
    return share.kind === 'fen' ? t('chat.sharedPosition') : t('chat.sharedGame');
  };
}

/**
 * Nội dung một tin nhắn chat: văn bản thường, hoặc bàn cờ nhỏ (FEN) / thẻ ván (PGN) bấm vào để mở
 * bàn phân tích (Giai đoạn 21a).
 */
export function ChatMessageBody({
  body,
  mine,
  onOpen,
}: {
  body: string;
  mine: boolean;
  onOpen: (share: ChessShare) => void;
}) {
  const { t } = useT();
  const share = useMemo(() => detectChessShare(body), [body]);
  const bubble = `max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
    mine ? 'bg-primary text-text-on-primary' : 'bg-bg'
  }`;

  if (!share) return <p className={bubble}>{body}</p>;

  if (share.kind === 'fen') {
    return (
      <div className={`${bubble} flex flex-col gap-2`}>
        {share.before && <span>{share.before}</span>}
        <button
          type="button"
          onClick={() => onOpen(share)}
          aria-label={t('chat.openPosition')}
          title={t('chat.openPosition')}
          className="w-48 cursor-pointer overflow-hidden rounded-md shadow-sm hover:opacity-90"
        >
          <PreferredBoard
            fen={share.fen}
            orientation={sideToMove(share.fen)}
            coordinates={false}
            sound={false}
            label={t('chat.sharedPosition')}
          />
        </button>
        <span className="text-xs opacity-80">{t('chat.openPosition')}</span>
        {share.after && <span>{share.after}</span>}
      </div>
    );
  }

  const { summary } = share;
  const moves = Math.ceil(summary.plyCount / 2);
  return (
    <button
      type="button"
      onClick={() => onOpen(share)}
      title={t('chat.openGame')}
      className={`${bubble} flex cursor-pointer items-center gap-3 text-left hover:opacity-90`}
    >
      <span className="w-24 shrink-0 overflow-hidden rounded-md shadow-sm">
        <PreferredBoard
          fen={share.finalFen}
          coordinates={false}
          sound={false}
          label={t('chat.sharedGame')}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-bold uppercase opacity-80">{t('chat.sharedGame')}</span>
        <span className="font-semibold">
          {summary.white || t('chat.unknownPlayer')} – {summary.black || t('chat.unknownPlayer')}
        </span>
        <span>
          {summary.result} · {t('chat.gameMoves', { count: moves })}
        </span>
        {summary.event && <span className="truncate text-xs opacity-80">{summary.event}</span>}
        <span className="text-xs underline opacity-80">{t('chat.openGame')}</span>
      </span>
    </button>
  );
}
