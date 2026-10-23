import { languages, type TranslationKey } from '@erpchess/i18n';
import { colors, fontSize, radius, spacing } from '@erpchess/ui-tokens';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const tk = (key: TranslationKey, opts?: Record<string, string>) => t(key, opts);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.slogan}>{tk('app.slogan')}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {tk('home.welcome')}
      </Text>
      <Text style={styles.description}>{tk('home.description')}</Text>
      <Pressable style={styles.cta} accessibilityRole="button">
        <Text style={styles.ctaText}>{tk('home.getStarted')}</Text>
      </Pressable>
      <Text style={styles.muted}>{tk('home.platform', { platform: tk('platform.mobile') })}</Text>
      <View style={styles.languages}>
        {languages.map((lng) => {
          const active = i18n.language === lng;
          return (
            <Pressable
              key={lng}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => void i18n.changeLanguage(lng)}
              style={[styles.lang, active && styles.langActive]}
            >
              <Text style={active ? styles.langTextActive : styles.muted}>
                {tk(`language.${lng}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
  },
  slogan: {
    fontSize: fontSize.subtitle,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  title: {
    fontSize: fontSize.h2,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  description: { fontSize: fontSize.body, color: colors.textMuted, textAlign: 'center' },
  cta: {
    backgroundColor: colors.orange,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: fontSize.body },
  muted: { color: colors.textMuted, fontSize: fontSize.subtitle },
  languages: { flexDirection: 'row', gap: spacing.sm },
  lang: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  langActive: { backgroundColor: colors.primary },
  langTextActive: { color: colors.textOnPrimary, fontSize: fontSize.subtitle },
});
