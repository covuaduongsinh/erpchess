import { useActivityAttempts, useSession, useStudy } from '@erpchess/api/react';
import type { ActivityKind } from '@erpchess/domain';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActivityPlayer } from '@/components/ActivityPlayer';
import { Button, Card, ErrorText, Muted, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

export default function StudyScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const study = useStudy(id);
  const attempts = useActivityAttempts(study.data, session?.user.id);
  const [index, setIndex] = useState(0);

  if (study.isPending) return <Spinner />;
  if (study.error) return <ErrorText error={study.error} />;
  const activities = study.data.activities;
  const current = activities[index];
  const byActivity = new Map(attempts.data?.map((a) => [a.activity_id, a]));
  const done = activities.filter((a) => byActivity.get(a.id)?.solved).length;
  const score = attempts.data?.reduce((s, a) => s + a.score, 0) ?? 0;
  const max = activities.reduce((s, a) => s + (a.invalid ? 0 : a.points), 0);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: study.data.title }} />
      {study.data.description ? <Muted>{study.data.description}</Muted> : null}
      <Text style={styles.text}>
        {t('player.summary', { done, total: activities.length, score, max })}
      </Text>
      <ScrollView horizontal contentContainerStyle={{ gap: spacing.xs }}>
        {activities.map((a, i) => {
          const ok = byActivity.get(a.id)?.solved;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={a.title || t(`activity.${a.kind as ActivityKind}`)}
              onPress={() => setIndex(i)}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: i === index ? 2 : 0,
                borderColor: colors.primary,
                backgroundColor: ok ? colors.green : `${colors.textMuted}33`,
              }}
            >
              <Text style={{ color: ok ? colors.textOnPrimary : colors.text }}>
                {ok ? '✓' : i + 1}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {current ? (
        <Card title={current.title || t(`activity.${current.kind as ActivityKind}`)}>
          {current.invalid ? (
            <Text style={styles.error}>{t('studies.invalidActivity')}</Text>
          ) : (
            <ActivityPlayer
              key={current.id}
              studyId={id}
              activity={current}
              attempt={byActivity.get(current.id)}
            />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Button
              variant="ghost"
              title={`← ${t('puzzle.prev')}`}
              disabled={index === 0}
              onPress={() => setIndex((i) => i - 1)}
            />
            <Button
              variant="ghost"
              title={`${t('puzzle.next')} →`}
              disabled={index >= activities.length - 1}
              onPress={() => setIndex((i) => i + 1)}
            />
          </View>
        </Card>
      ) : (
        <Muted>{t('studies.noActivities')}</Muted>
      )}
    </ScrollView>
  );
}
