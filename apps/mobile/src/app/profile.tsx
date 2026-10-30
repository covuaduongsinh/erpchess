import { signOut } from '@erpchess/api';
import { useErpClient, useProfile, useSession, useUpdateProfile } from '@erpchess/api/react';
import { BOARD_THEMES } from '@erpchess/board-native';
import { formatSanList } from '@erpchess/chess-core';
import {
  BOARD_THEME_KEYS,
  type BoardPreferences,
  COMMON_TIMEZONES,
  type MoveNotation,
  normalizeBoardPreferences,
  PIECE_SET_KEYS,
} from '@erpchess/domain';
import { colors, spacing } from '@erpchess/ui-tokens';
import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PreferredBoard } from '@/components/PreferredBoard';
import { Button, styles as baseStyles, Card, Field, Muted, Spinner } from '@/components/ui';
import { useT } from '@/lib/use-t';

const PREVIEW_MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'e8=Q#'];
const PREVIEW_FEN = 'r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQ1RK1 w kq - 3 9';

export default function ProfileScreen() {
  const { t, i18n } = useT();
  const client = useErpClient();
  const { session, loading } = useSession();
  const profileQuery = useProfile(session?.user.id);
  const updateMutation = useUpdateProfile(session?.user.id);

  const profile = profileQuery.data;

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [locale, setLocale] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [moveNotation, setMoveNotation] = useState<MoveNotation | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [boardPatch, setBoardPatch] = useState<Partial<BoardPreferences>>({});

  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/" />;
  if (profileQuery.isPending) return <Spinner />;

  const curDisplayName = displayName ?? profile?.display_name ?? '';
  const curLocale = locale ?? profile?.locale ?? i18n.language ?? 'vi';
  const curTimezone = timezone ?? profile?.timezone ?? 'Asia/Ho_Chi_Minh';
  const curNotation = (moveNotation ?? profile?.move_notation ?? 'letters') as MoveNotation;
  const curCountry = country ?? profile?.country ?? '';
  // Giữ nguyên các trường mobile chưa chỉnh (âm thanh, tự xoay) khi lưu lại
  const curBoard: BoardPreferences = {
    ...normalizeBoardPreferences(profile?.board_preferences),
    ...boardPatch,
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        displayName: curDisplayName,
        locale: curLocale as 'vi' | 'en',
        timezone: curTimezone,
        moveNotation: curNotation,
        country: curCountry || null,
        boardPreferences: curBoard,
      });
      if (curLocale !== i18n.language) {
        await i18n.changeLanguage(curLocale);
      }
      Alert.alert('Thành công', t('profile.saveSuccess'));
    } catch (err: unknown) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ScrollView contentContainerStyle={baseStyles.screen}>
      <Stack.Screen options={{ title: t('profile.title') }} />

      <Card>
        <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>
        <Field
          label={t('profile.displayName')}
          value={curDisplayName}
          onChangeText={setDisplayName}
        />
        <Field label={t('profile.username')} value={profile?.username ?? ''} editable={false} />
        <Field label={t('profile.email')} value={session.user.email ?? ''} editable={false} />
        <Field label={t('profile.country')} value={curCountry} onChangeText={setCountry} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('profile.preferences')}</Text>

        <Text style={styles.fieldLabel}>{t('profile.language')}</Text>
        <View style={styles.radioRow}>
          <Pressable
            style={[styles.radioItem, curLocale === 'vi' && styles.radioActive]}
            onPress={() => setLocale('vi')}
          >
            <Text style={curLocale === 'vi' ? styles.radioTextActive : styles.radioText}>
              Tiếng Việt
            </Text>
          </Pressable>
          <Pressable
            style={[styles.radioItem, curLocale === 'en' && styles.radioActive]}
            onPress={() => setLocale('en')}
          >
            <Text style={curLocale === 'en' ? styles.radioTextActive : styles.radioText}>
              English
            </Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>{t('profile.timezone')}</Text>
        <View style={[styles.radioRow, { flexWrap: 'wrap' }]}>
          {COMMON_TIMEZONES.slice(0, 4).map((tz) => (
            <Pressable
              key={tz.value}
              style={[styles.radioItem, curTimezone === tz.value && styles.radioActive]}
              onPress={() => setTimezone(tz.value)}
            >
              <Text style={curTimezone === tz.value ? styles.radioTextActive : styles.radioText}>
                {tz.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t('profile.notation')}</Text>
        <View style={styles.radioRow}>
          <Pressable
            style={[styles.radioItem, curNotation === 'letters' && styles.radioActive]}
            onPress={() => setMoveNotation('letters')}
          >
            <Text style={curNotation === 'letters' ? styles.radioTextActive : styles.radioText}>
              {t('profile.notationLetters')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.radioItem, curNotation === 'figurine' && styles.radioActive]}
            onPress={() => setMoveNotation('figurine')}
          >
            <Text style={curNotation === 'figurine' ? styles.radioTextActive : styles.radioText}>
              {t('profile.notationFigurine')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.previewBox}>
          <Muted>{t('profile.notationPreview')}</Muted>
          <Text style={styles.previewText}>
            {formatSanList(PREVIEW_MOVES, curNotation).join(' ')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{t('profile.boardCustomizerTitle')}</Text>
        <Muted>{t('profile.boardSyncHint')}</Muted>

        <Text style={styles.fieldLabel}>{t('profile.boardTheme')}</Text>
        <View style={[styles.radioRow, { flexWrap: 'wrap' }]}>
          {BOARD_THEME_KEYS.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: curBoard.theme === key }}
              style={[
                styles.radioItem,
                styles.themeItem,
                curBoard.theme === key && styles.radioActive,
              ]}
              onPress={() => setBoardPatch((p) => ({ ...p, theme: key }))}
            >
              <View style={[styles.swatch, { backgroundColor: BOARD_THEMES[key].light }]} />
              <View style={[styles.swatch, { backgroundColor: BOARD_THEMES[key].dark }]} />
              <Text style={curBoard.theme === key ? styles.radioTextActive : styles.radioText}>
                {t(`profile.boardTheme_${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t('profile.boardPieceSet')}</Text>
        <View style={styles.radioRow}>
          {PIECE_SET_KEYS.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: curBoard.pieceSet === key }}
              style={[styles.radioItem, curBoard.pieceSet === key && styles.radioActive]}
              onPress={() => setBoardPatch((p) => ({ ...p, pieceSet: key }))}
            >
              <Text style={curBoard.pieceSet === key ? styles.radioTextActive : styles.radioText}>
                {t(`profile.boardPieceSet_${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t('profile.boardCoordinates')}</Text>
        <View style={styles.radioRow}>
          {([true, false] as const).map((on) => (
            <Pressable
              key={String(on)}
              accessibilityRole="button"
              accessibilityState={{ selected: curBoard.coordinates === on }}
              style={[styles.radioItem, curBoard.coordinates === on && styles.radioActive]}
              onPress={() => setBoardPatch((p) => ({ ...p, coordinates: on }))}
            >
              <Text style={curBoard.coordinates === on ? styles.radioTextActive : styles.radioText}>
                {on ? t('profile.boardOn') : t('profile.boardOff')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Muted>{t('profile.liveBoardPreview')}</Muted>
        <PreferredBoard
          fen={PREVIEW_FEN}
          theme={curBoard.theme}
          pieceSet={curBoard.pieceSet}
          coordinates={curBoard.coordinates}
          label={t('profile.liveBoardPreview')}
        />

        <View style={{ marginTop: spacing.md }}>
          <Button
            title={updateMutation.isPending ? t('common.loading') : t('profile.save')}
            onPress={() => void handleSave()}
            disabled={updateMutation.isPending}
          />
        </View>
      </Card>

      <Card>
        <Button variant="ghost" title={t('common.signOut')} onPress={() => void signOut(client)} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  radioRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  radioItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  radioActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioText: {
    color: colors.text,
    fontSize: 13,
  },
  radioTextActive: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  previewBox: {
    backgroundColor: '#f5f5f4',
    padding: spacing.sm,
    borderRadius: 6,
    marginTop: spacing.xs,
    gap: 4,
  },
  previewText: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: colors.primary,
  },
});
