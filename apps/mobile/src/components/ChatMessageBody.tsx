import { type ChessShare, detectChessShare, sideToMove } from '@erpchess/chess-core';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PreferredBoard } from '@/components/PreferredBoard';
import { useT } from '@/lib/use-t';

/** Nhãn ngắn cho danh sách hội thoại thay vì chuỗi FEN/PGN thô. */
export function chatPreview(body: string | null, t: ReturnType<typeof useT>['t']): string | null {
  if (!body) return body;
  const share = detectChessShare(body);
  if (!share) return body;
  return share.kind === 'fen' ? t('chat.sharedPosition') : t('chat.sharedGame');
}

function openShare(share: ChessShare) {
  router.push({
    pathname: '/analysis',
    params: share.kind === 'fen' ? { fen: share.fen } : { pgn: share.pgn },
  });
}

/** Tin nhắn chat: văn bản, hoặc bàn cờ nhỏ (FEN) / thẻ ván (PGN) chạm để mở bàn phân tích. */
export function ChatMessageBody({ body, mine }: { body: string; mine: boolean }) {
  const { t } = useT();
  const share = useMemo(() => detectChessShare(body), [body]);
  const bubble = {
    maxWidth: '85%' as const,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: mine ? colors.primary : colors.white,
    gap: spacing.xs,
  };
  const textColor = { color: mine ? colors.white : colors.text };

  if (!share) return <Text style={[bubble, textColor]}>{body}</Text>;

  if (share.kind === 'fen') {
    return (
      <View style={bubble}>
        {share.before ? <Text style={textColor}>{share.before}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.openPosition')}
          onPress={() => openShare(share)}
          style={{ width: 180 }}
        >
          <View pointerEvents="none">
            <PreferredBoard
              fen={share.fen}
              orientation={sideToMove(share.fen)}
              coordinates={false}
              label={t('chat.sharedPosition')}
            />
          </View>
        </Pressable>
        <Text style={[textColor, { fontSize: 12, opacity: 0.8 }]}>{t('chat.openPosition')}</Text>
        {share.after ? <Text style={textColor}>{share.after}</Text> : null}
      </View>
    );
  }

  const { summary } = share;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chat.openGame')}
      onPress={() => openShare(share)}
      style={[bubble, { flexDirection: 'row', alignItems: 'center' }]}
    >
      <View pointerEvents="none" style={{ width: 90 }}>
        <PreferredBoard fen={share.finalFen} coordinates={false} label={t('chat.sharedGame')} />
      </View>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text style={[textColor, { fontSize: 11, fontWeight: '700', opacity: 0.8 }]}>
          {t('chat.sharedGame')}
        </Text>
        <Text style={[textColor, { fontWeight: '600' }]}>
          {summary.white || t('chat.unknownPlayer')} – {summary.black || t('chat.unknownPlayer')}
        </Text>
        <Text style={textColor}>
          {summary.result} · {t('chat.gameMoves', { count: Math.ceil(summary.plyCount / 2) })}
        </Text>
        {summary.event ? (
          <Text numberOfLines={1} style={[textColor, { fontSize: 12, opacity: 0.8 }]}>
            {summary.event}
          </Text>
        ) : null}
        <Text style={[textColor, { fontSize: 12, textDecorationLine: 'underline' }]}>
          {t('chat.openGame')}
        </Text>
      </View>
    </Pressable>
  );
}
