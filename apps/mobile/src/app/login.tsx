import { signInStudent, signInWithEmail } from '@erpchess/api';
import { useErpClient } from '@erpchess/api/react';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

export default function LoginScreen() {
  const { t } = useT();
  const client = useErpClient();
  const [mode, setMode] = useState<'email' | 'student'>('student');
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      if (mode === 'email') await signInWithEmail(client, id.trim(), secret);
      else await signInStudent(client, id, secret);
      router.replace('/academies');
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: t('auth.signIn') }} />
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Card>
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: 'row',
              backgroundColor: colors.bg,
              borderRadius: radius.md,
              padding: spacing.xs,
            }}
          >
            {(['student', 'email'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => {
                  setMode(m);
                  setError(null);
                  setId('');
                  setSecret('');
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: mode === m ? colors.white : 'transparent',
                }}
              >
                <Text style={styles.text}>
                  {m === 'email' ? t('auth.tabEmail') : t('auth.tabStudent')}
                </Text>
              </Pressable>
            ))}
          </View>
          {mode === 'email' ? (
            <>
              <Field
                label={t('auth.email')}
                value={id}
                onChangeText={setId}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Field
                label={t('auth.password')}
                value={secret}
                onChangeText={setSecret}
                secureTextEntry
                autoComplete="current-password"
              />
            </>
          ) : (
            <>
              <Field
                label={t('auth.username')}
                value={id}
                onChangeText={setId}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
              />
              <Field
                label={t('auth.pin')}
                value={secret}
                onChangeText={setSecret}
                secureTextEntry
                keyboardType="number-pad"
              />
            </>
          )}
          <ErrorText error={error} />
          <Button title={t('auth.signIn')} onPress={() => void submit()} disabled={pending} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
