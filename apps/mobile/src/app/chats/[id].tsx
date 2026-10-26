import { useChatMessages, useChatMutations, useMembers, useSession } from '@erpchess/api/react';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { Stack, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Button, ErrorText, Muted, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

/** Một hội thoại (lớp hoặc nhắn riêng): tin nhắn realtime + ô gửi. */
export default function ChatScreen() {
  const { t } = useT();
  const { id, academy, title } = useLocalSearchParams<{
    id: string;
    academy: string;
    title?: string;
  }>();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const members = useMembers(academy);
  const messages = useChatMessages(id, academy);
  const { send } = useChatMutations(academy, userId);
  const [text, setText] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const name = (uid: string | null) => {
    const m = members.data?.find((x) => x.profile.id === uid);
    return m ? m.profile.display_name || m.profile.username : '—';
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: title ?? t('chat.title') }} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.screen, { gap: spacing.sm }]}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {messages.isPending ? (
          <Spinner />
        ) : messages.error ? (
          <ErrorText error={messages.error} />
        ) : messages.data.length === 0 ? (
          <Muted>{t('chat.empty')}</Muted>
        ) : (
          messages.data.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {!mine && <Text style={styles.hint}>{name(m.sender_id)}</Text>}
                <Text
                  style={{
                    maxWidth: '85%',
                    paddingHorizontal: spacing.sm + spacing.xs,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.lg,
                    backgroundColor: mine ? colors.primary : colors.white,
                    color: mine ? colors.white : colors.text,
                  }}
                >
                  {m.body}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.sm }}>
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={2000}
          placeholder={t('chat.placeholder')}
          style={[styles.input, { flex: 1 }]}
        />
        <Button
          title={t('chat.send')}
          disabled={send.isPending || !text.trim()}
          onPress={() =>
            send.mutate({ conversationId: id, body: text }, { onSuccess: () => setText('') })
          }
        />
      </View>
      <ErrorText error={send.error} />
    </View>
  );
}
