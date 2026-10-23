import { signUp } from '@erpchess/api';
import { useErpClient } from '@erpchess/api/react';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, Card, ErrorText, Field, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

export default function SignUpScreen() {
  const { t } = useT();
  const client = useErpClient();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const { session } = await signUp(client, { displayName, email: email.trim(), password });
      if (session) router.replace('/academies');
      else setSentTo(email.trim());
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('auth.signUp') }} />
      <Card>
        {sentTo ? (
          <Text style={styles.text}>{t('auth.checkEmail', { email: sentTo })}</Text>
        ) : (
          <>
            <Field
              label={t('auth.displayName')}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <Field
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label={t('auth.password')}
              hint={t('validation.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <ErrorText error={error} />
            <Button
              variant="cta"
              title={t('auth.signUp')}
              onPress={() => void submit()}
              disabled={pending}
            />
          </>
        )}
      </Card>
    </ScrollView>
  );
}
