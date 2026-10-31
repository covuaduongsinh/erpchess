import { TIME_PRESETS } from '@erpchess/api';
import { useGameMutations, useQuickPair } from '@erpchess/api/react';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, ErrorText, Muted, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

type OnlineMember = { userId: string; name: string; role: string };

const openGame = (id: string) => router.push({ pathname: '/games/[id]', params: { id } });

/** Chọn mức thời gian (dùng chung cho tìm trận nhanh và thách đấu). */
function PresetPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {TIME_PRESETS.map((p) => {
        const active = value === p.id;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(p.id)}
            style={{
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.textMuted,
              backgroundColor: active ? colors.primary : colors.white,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Text style={{ color: active ? colors.textOnPrimary : colors.text, fontWeight: '600' }}>
              {p.id}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tìm trận nhanh trên mobile (Giai đoạn 23e): cùng hook và hàng đợi với bản web. */
export function QuickPairCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const [presetId, setPresetId] = useState<string>(TIME_PRESETS[1].id);
  const { state, start, cancel } = useQuickPair(academyId, openGame);
  const searching = state.phase === 'searching';

  return (
    <Card title={t('play.quickPairTitle')}>
      <Muted>{t('play.quickPairHint')}</Muted>
      <PresetPicker value={presetId} onChange={setPresetId} disabled={searching} />
      {searching ? (
        <View accessibilityRole="summary" style={{ gap: spacing.xs }}>
          <Text style={[styles.text, { color: colors.primary, fontWeight: '600' }]}>
            {t('play.quickPairSearching', { seconds: Math.floor(state.waitedMs / 1000) })}
          </Text>
          {state.rating !== null && state.window !== null ? (
            <Muted>
              {t('play.quickPairWindow', { rating: state.rating, window: state.window })}
            </Muted>
          ) : null}
          <Button variant="ghost" title={t('play.quickPairCancel')} onPress={() => void cancel()} />
        </View>
      ) : (
        <Button
          title={`⚡ ${t('play.quickPairStart')}`}
          onPress={() => {
            const tc = TIME_PRESETS.find((p) => p.id === presetId);
            if (tc) start(tc);
          }}
        />
      )}
      {state.phase === 'error' ? <ErrorText error={state.error} /> : null}
    </Card>
  );
}

/**
 * Thách đấu người đang online trong học viện (Giai đoạn 23e): màu bốc thăm phía server, mức thời
 * gian chọn ở trên; tạo ván xong vào thẳng ván.
 */
export function ChallengeCard({
  academyId,
  userId,
  online,
}: {
  academyId: string;
  userId: string;
  online: OnlineMember[];
}) {
  const { t } = useT();
  const { challenge } = useGameMutations(academyId, userId);
  const [presetId, setPresetId] = useState<string>(TIME_PRESETS[1].id);
  const others = online.filter((o) => o.userId !== userId && o.role !== 'parent');

  return (
    <Card title={t('play.onlineStudents', { count: others.length })}>
      {others.length === 0 ? (
        <Muted>{t('play.noneOnline')}</Muted>
      ) : (
        <>
          <PresetPicker value={presetId} onChange={setPresetId} disabled={challenge.isPending} />
          {others.map((o) => (
            <View key={o.userId} style={styles.row}>
              <Text style={[styles.text, { flex: 1 }]}>{o.name || '—'}</Text>
              <Button
                variant="ghost"
                title={`⚔️ ${t('play.challenge')}`}
                disabled={challenge.isPending}
                onPress={() => {
                  const tc = TIME_PRESETS.find((p) => p.id === presetId);
                  challenge.mutate(
                    {
                      opponentId: o.userId,
                      color: 'random',
                      baseMs: tc?.baseMs ?? null,
                      incMs: tc?.incMs ?? 0,
                      rated: !!tc,
                    },
                    { onSuccess: openGame },
                  );
                }}
              />
            </View>
          ))}
        </>
      )}
      <ErrorText error={challenge.error} />
    </Card>
  );
}
