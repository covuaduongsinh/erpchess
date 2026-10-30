import {
  useClassroom,
  useClassroomRoom,
  useJoinClassroom,
  useMyAcademies,
  useSession,
} from '@erpchess/api/react';
import { legalDests, sideToMove } from '@erpchess/chess-core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PreferredBoard } from '@/components/PreferredBoard';
import { Button, Card, ErrorText, Field, Muted, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

/**
 * Buổi học trên điện thoại: lớp offline thì tự điểm danh; lớp online thì theo dõi bàn cờ của HLV,
 * đi quân khi được trao quyền và chat. Mũi tên/tô ô chỉ hiện trên web (bàn cờ native chưa vẽ).
 */
export default function ClassScreen() {
  const { t, i18n } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const classroom = useClassroom(id);
  const academies = useMyAcademies(session?.user.id);
  const c = classroom.data;
  const academy = academies.data?.find((a) => a.id === c?.academy_id);
  const me = session?.user.id;
  const online = c?.kind === 'online';
  const { room, snapshot, chat, peers, status } = useClassroomRoom(
    online ? c : undefined,
    me ? { userId: me, name: session?.user.user_metadata?.display_name ?? '' } : undefined,
    false,
  );
  const join = useJoinClassroom(id);
  const joined = useRef(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (status === 'live' && academy?.role === 'student' && !joined.current) {
      joined.current = true;
      join.mutate();
    }
  }, [status, academy?.role, join]);

  if (classroom.isPending) return <Spinner />;
  if (classroom.error || !c) return <ErrorText error={classroom.error} />;
  const iControl = !!snapshot && snapshot.controller === me;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: c.title }} />
      <Text style={styles.hint}>
        {`${new Date(c.starts_at).toLocaleString(i18n.language, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })} · ${c.minutes}′ · ${t(`classroom.kind_${online ? 'online' : 'offline'}`)}`}
      </Text>
      {!online ? (
        <Card title={t('classroom.attendance')}>
          <Button
            title={t('classroom.join')}
            variant="cta"
            onPress={() => join.mutate()}
            disabled={join.isPending}
          />
          {join.isSuccess ? (
            <Text style={styles.text}>
              {join.data
                ? t('classroom.joined', { status: t(`classroom.status_${join.data}`) })
                : t('classroom.notInvited')}
            </Text>
          ) : null}
          <ErrorText error={join.error} />
        </Card>
      ) : (
        <>
          <Text style={styles.hint}>
            {status === 'live'
              ? t('classroom.live')
              : status === 'error'
                ? t('classroom.roomError')
                : t('classroom.connecting')}
            {' · '}
            {t('classroom.people', { count: peers.length })}
          </Text>
          {snapshot ? (
            <PreferredBoard
              fen={snapshot.fen}
              lastMove={snapshot.lastMove ?? undefined}
              movable={
                iControl
                  ? { color: sideToMove(snapshot.fen), dests: legalDests(snapshot.fen) }
                  : undefined
              }
              onMove={(from, to, promotion) =>
                void room?.requestMove(`${from}${to}${promotion ?? ''}`)
              }
              label={c.title}
            />
          ) : (
            <Spinner />
          )}
          {iControl ? (
            <Text style={[styles.text, { fontWeight: '600' }]}>{t('classroom.yourTurn')}</Text>
          ) : null}
          <Card title={t('classroom.chat')}>
            {chat.length === 0 ? <Muted>{t('classroom.noChat')}</Muted> : null}
            {chat.slice(-30).map((m) => (
              <View key={m.id}>
                <Text style={styles.hint}>{m.name}</Text>
                <Text style={styles.text}>{m.text}</Text>
              </View>
            ))}
            <Field
              label={t('classroom.chatPlaceholder')}
              value={text}
              onChangeText={setText}
              maxLength={500}
              onSubmitEditing={() => {
                if (!text.trim()) return;
                void room?.chat(text);
                setText('');
              }}
            />
            <Button
              title={t('classroom.send')}
              disabled={!text.trim()}
              onPress={() => {
                void room?.chat(text);
                setText('');
              }}
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}
