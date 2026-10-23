import { useSession } from '@erpchess/api/react';
import { languages } from '@erpchess/i18n';
import { colors, fontSize, radius, spacing } from '@erpchess/ui-tokens';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Spinner } from '@/components/ui';
import { useT } from '@/lib/use-t';

export default function WelcomeScreen() {
  const { t, i18n } = useT();
  const { session, loading } = useSession();

  if (loading) return <Spinner />;
  if (session) return <Redirect href="/academies" />;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.slogan}>{t('app.slogan')}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {t('home.welcome')}
      </Text>
      <Text style={styles.description}>{t('home.description')}</Text>
      <View style={styles.actions}>
        <Button variant="cta" title={t('auth.signIn')} onPress={() => router.push('/login')} />
        <Button variant="ghost" title={t('auth.signUp')} onPress={() => router.push('/signup')} />
      </View>
      <View style={styles.actions}>
        <Button
          variant="ghost"
          title={t('analysis.title')}
          onPress={() => router.push('/analysis')}
        />
      </View>
      <Text style={styles.muted}>{t('home.platform', { platform: t('platform.mobile') })}</Text>
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
                {t(`language.${lng}`)}
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
  actions: { flexDirection: 'row', gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: fontSize.subtitle },
  languages: { flexDirection: 'row', gap: spacing.sm },
  lang: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  langActive: { backgroundColor: colors.primary },
  langTextActive: { color: colors.textOnPrimary, fontSize: fontSize.subtitle },
});
