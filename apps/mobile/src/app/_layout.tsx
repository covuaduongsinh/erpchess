import { ErpProvider } from '@erpchess/api/react';
import { colors } from '@erpchess/ui-tokens';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { i18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    // Gốc cử chỉ cho bàn cờ (kéo-thả quân)
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <StatusBar style="light" />
        {supabase ? (
          <ErpProvider client={supabase}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.primary },
                headerTintColor: colors.textOnPrimary,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
          </ErpProvider>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
            <Text accessibilityRole="alert">{i18n.t('auth.missingConfig')}</Text>
          </View>
        )}
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}
