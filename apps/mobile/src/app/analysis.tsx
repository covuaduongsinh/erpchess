import {
  gameStatus,
  inCheck,
  kingSquare,
  legalDests,
  type MoveNode,
  sideToMove,
} from '@erpchess/chess-core';
import { useGameTree } from '@erpchess/chess-core/react';
import type { TranslationKey } from '@erpchess/i18n';
import { colors, spacing } from '@erpchess/ui-tokens';
import { Stack } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PreferredBoard } from '@/components/PreferredBoard';
import { Button, Card, Field, Muted, styles } from '@/components/ui';
import { errorMessage, useT } from '@/lib/use-t';

export default function AnalysisScreen() {
  const { t } = useT();
  const game = useGameTree();
  const { tree, current } = game;
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<unknown>(null);

  const fen = current.fen;
  const side = sideToMove(fen);
  const status = gameStatus(fen);
  const dests = useMemo(() => legalDests(fen), [fen]);
  const lastMove =
    current.id === 'root'
      ? undefined
      : ([(current as MoveNode).uci.slice(0, 2), (current as MoveNode).uci.slice(2, 4)] as [
          string,
          string,
        ]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('analysis.title') }} />
      <PreferredBoard
        fen={fen}
        orientation={orientation}
        lastMove={lastMove}
        check={inCheck(fen) ? kingSquare(fen) : undefined}
        movable={status === 'ongoing' ? { color: side, dests } : undefined}
        onMove={(from, to, promo) => game.play(`${from}${to}${promo ?? ''}`)}
        label={t('analysis.title')}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Button
          variant="ghost"
          title="⏮"
          accessibilityLabel={t('analysis.start')}
          onPress={game.toStart}
        />
        <Button
          variant="ghost"
          title="◀"
          accessibilityLabel={t('analysis.prev')}
          onPress={game.back}
        />
        <Button
          variant="ghost"
          title="▶"
          accessibilityLabel={t('analysis.next')}
          onPress={game.forward}
        />
        <Button
          variant="ghost"
          title="⏭"
          accessibilityLabel={t('analysis.end')}
          onPress={game.toEnd}
        />
        <Button
          variant="ghost"
          title={t('analysis.flip')}
          onPress={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
        />
      </View>
      {status !== 'ongoing' && (
        <Text
          accessibilityRole="alert"
          style={[styles.text, { color: colors.danger, fontWeight: '700' }]}
        >
          {t(`analysis.status_${status}` as TranslationKey)}
        </Text>
      )}

      <Card title={t('analysis.moves')}>
        {tree.root.children.length === 0 ? (
          <Muted>{t('analysis.noMoves')}</Muted>
        ) : (
          <View testID="move-list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {renderLine(tree.root.children, true, true, current.id, game.goTo)}
          </View>
        )}
      </Card>

      <Card>
        <Field
          label={t('analysis.importLabel')}
          value={importText}
          onChangeText={setImportText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        {importError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('analysis.importError', { message: errorMessage(t, importError) })}
          </Text>
        ) : null}
        <Button
          title={t('analysis.import')}
          disabled={!importText.trim()}
          onPress={() => {
            try {
              game.load(importText);
              setImportError(null);
              setImportText('');
            } catch (err) {
              setImportError(err);
            }
          }}
        />
      </Card>
    </ScrollView>
  );
}

/** Danh sách nước đi dạng cây (như bản web): nhánh chính, biến trong ngoặc, chạm để nhảy tới. */
function renderLine(
  nodes: readonly MoveNode[],
  mainline: boolean,
  forceNumber: boolean,
  currentId: string,
  onSelect: (id: string) => void,
): ReactNode[] {
  const out: ReactNode[] = [];
  let current = nodes;
  let force = forceNumber;
  while (current.length) {
    const [main, ...alts] = current as [MoveNode, ...MoveNode[]];
    const moveNo = Math.ceil(main.ply / 2);
    const white = main.ply % 2 === 1;
    const prefix = white ? `${moveNo}.` : force ? `${moveNo}…` : '';
    const active = main.id === currentId;
    out.push(
      <Pressable
        key={main.id}
        testID={`move-${main.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(main.id)}
        style={{
          paddingHorizontal: 4,
          borderRadius: 4,
          backgroundColor: active ? colors.primary : 'transparent',
        }}
      >
        <Text
          style={{
            color: active ? colors.textOnPrimary : mainline ? colors.text : colors.textMuted,
            fontWeight: mainline ? '500' : '400',
          }}
        >
          {prefix}
          {main.san}
        </Text>
      </Pressable>,
    );
    if (main.comment) {
      out.push(
        <Text key={`${main.id}-c`} style={{ color: colors.green, fontStyle: 'italic' }}>
          {main.comment}
        </Text>,
      );
    }
    force = Boolean(main.comment);
    for (const alt of alts) {
      out.push(
        <Text key={`open-${alt.id}`} style={{ color: colors.textMuted }}>
          (
        </Text>,
      );
      out.push(...renderLine([alt], false, true, currentId, onSelect));
      out.push(
        <Text key={`close-${alt.id}`} style={{ color: colors.textMuted }}>
          )
        </Text>,
      );
      force = true;
    }
    current = main.children;
  }
  return out;
}
