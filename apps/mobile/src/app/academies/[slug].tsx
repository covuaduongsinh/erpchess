import {
  useAssignments,
  useCreateGroup,
  useCreateStudent,
  useGroups,
  useLeaderboard,
  useLevels,
  useMembers,
  useMyAcademies,
  useProgress,
  useSession,
  useStudies,
} from '@erpchess/api/react';
import { academyRoles, isStaff, type Period, periodRange, periods } from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, Muted, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

export default function AcademyScreen() {
  const { t } = useT();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useSession();
  const academies = useMyAcademies(session?.user.id);
  const academy = academies.data?.find((a) => a.slug === slug);
  const members = useMembers(academy?.id);
  const groups = useGroups(academy?.id);

  if (academies.isPending) return <Spinner />;
  if (!academy) return <Muted>{t('academy.none')}</Muted>;
  const staff = isStaff(academy.role);

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={members.isRefetching || groups.isRefetching}
          onRefresh={() => {
            void members.refetch();
            void groups.refetch();
          }}
        />
      }
    >
      <Stack.Screen options={{ title: academy.name }} />
      <Muted>{t(`role.${academy.role}`)}</Muted>
      {academy.role === 'student' && <MyLevel academyId={academy.id} userId={session?.user.id} />}

      <LeaderboardCard academyId={academy.id} userId={session?.user.id} />

      <AssignmentsCard academyId={academy.id} slug={academy.slug} staff={staff} />

      <StudiesCard academyId={academy.id} userId={session?.user.id} />

      <Card title={t('groups.title')}>
        {groups.isPending ? (
          <Spinner />
        ) : groups.error ? (
          <ErrorText error={groups.error} />
        ) : groups.data.length === 0 ? (
          <Muted>{t('groups.none')}</Muted>
        ) : (
          groups.data.map((g) => (
            <View key={g.id} style={styles.row}>
              <Text style={[styles.text, { fontWeight: '500' }]}>{g.name}</Text>
              {staff && <Muted>{t('groups.studentCount', { count: g.studentCount })}</Muted>}
            </View>
          ))
        )}
        {staff && <CreateGroupForm academyId={academy.id} coach={academy.role === 'coach'} />}
      </Card>

      {staff && (
        <Card title={t('academy.members')}>
          {members.isPending ? (
            <Spinner />
          ) : (
            academyRoles.map((role) => {
              const list = members.data?.filter((m) => m.role === role) ?? [];
              if (list.length === 0) return null;
              return (
                <View key={role} style={{ gap: spacing.xs }}>
                  <Text style={[styles.hint, { fontWeight: '700', textTransform: 'uppercase' }]}>
                    {t(`role.${role}`)} ({list.length})
                  </Text>
                  {list.map((m) => (
                    <Text key={m.profile.id} style={styles.text}>
                      {m.profile.display_name}
                      {m.profile.username ? (
                        <Text style={styles.hint}> · @{m.profile.username}</Text>
                      ) : null}
                    </Text>
                  ))}
                </View>
              );
            })
          )}
        </Card>
      )}

      {staff && (
        <CreateStudentForm
          academyId={academy.id}
          groups={groups.data?.map((g) => ({ id: g.id, name: g.name })) ?? []}
        />
      )}
    </ScrollView>
  );
}

function CreateGroupForm({ academyId, coach }: { academyId: string; coach: boolean }) {
  const { t } = useT();
  const { session } = useSession();
  const create = useCreateGroup(academyId);
  const [name, setName] = useState('');

  return (
    <View style={{ gap: spacing.sm }}>
      <Field label={t('groups.name')} value={name} onChangeText={setName} />
      <ErrorText error={create.error} />
      <Button
        variant="cta"
        title={t('groups.create')}
        disabled={create.isPending}
        onPress={() =>
          create.mutate(
            { name, coachId: coach ? session?.user.id : undefined },
            { onSuccess: () => setName('') },
          )
        }
      />
    </View>
  );
}

function CreateStudentForm({
  academyId,
  groups,
}: {
  academyId: string;
  groups: { id: string; name: string }[];
}) {
  const { t } = useT();
  const create = useCreateStudent(academyId);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [groupId, setGroupId] = useState<string | undefined>();

  return (
    <Card title={t('students.create')}>
      <Field label={t('auth.displayName')} value={displayName} onChangeText={setDisplayName} />
      <Field
        label={t('auth.username')}
        hint={t('validation.username')}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field
        label={t('auth.pin')}
        hint={t('validation.pin')}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
      />
      {groups.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.label}>{t('students.group')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {[{ id: undefined, name: t('students.noGroup') }, ...groups].map((g) => {
              const active = groupId === g.id;
              return (
                <Pressable
                  key={g.id ?? 'none'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => setGroupId(g.id)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: active ? colors.primary : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? colors.textOnPrimary : colors.primary }}>
                    {g.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <ErrorText error={create.error} />
      {create.data && (
        <Text accessibilityRole="text" style={{ color: colors.green }}>
          {t('students.created', { username: create.data.username })}
        </Text>
      )}
      <Button
        variant="cta"
        title={t('students.create')}
        disabled={create.isPending}
        onPress={() =>
          create.mutate(
            { displayName, username, pin, groupId },
            {
              onSuccess: () => {
                setDisplayName('');
                setUsername('');
                setPin('');
              },
            },
          )
        }
      />
    </Card>
  );
}

function AssignmentsCard({
  academyId,
  slug,
  staff,
}: {
  academyId: string;
  slug: string;
  staff: boolean;
}) {
  const { t } = useT();
  const assignments = useAssignments(academyId);
  const progress = useProgress({ academyId });

  return (
    <Card title={t('assignments.title')}>
      {assignments.isPending ? (
        <Spinner />
      ) : assignments.error ? (
        <ErrorText error={assignments.error} />
      ) : assignments.data.length === 0 ? (
        <Muted>{staff ? t('assignments.none') : t('assignments.noneStudent')}</Muted>
      ) : (
        assignments.data.map((a) => {
          // RLS: học viên chỉ thấy dòng của mình, phụ huynh thấy của con
          const rows = progress.data?.filter((p) => p.assignmentId === a.id) ?? [];
          const done = rows.filter((r) => r.totalItems > 0 && r.solvedItems === r.totalItems);
          const mine = !staff && rows.length === 1 ? rows[0] : undefined;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="link"
              onPress={() =>
                router.push({ pathname: '/assignments/[id]', params: { id: a.id, slug } })
              }
              style={styles.row}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.text, { fontWeight: '500', color: colors.primary }]}>
                  {a.title}
                </Text>
                <Muted>{t('assignments.puzzleCount', { count: a.itemCount })}</Muted>
              </View>
              <Text style={styles.hint}>
                {staff
                  ? `${t('assignments.done')}: ${done.length}/${rows.length}`
                  : mine
                    ? mine.solvedItems === mine.totalItems
                      ? t('assignments.done')
                      : t('assignments.progress', {
                          solved: mine.solvedItems,
                          total: mine.totalItems,
                        })
                    : ''}
              </Text>
            </Pressable>
          );
        })
      )}
    </Card>
  );
}

function MyLevel({ academyId, userId }: { academyId: string; userId?: string }) {
  const { t } = useT();
  const members = useMembers(academyId);
  const levels = useLevels(academyId);
  const levelId = members.data?.find((m) => m.profile.id === userId)?.levelId;
  const level = levels.data?.find((l) => l.id === levelId);
  if (!level) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Text style={styles.hint}>{t('students.level')}:</Text>
      <Text
        style={{
          color: colors.textOnPrimary,
          backgroundColor: level.color,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.xs,
          overflow: 'hidden',
        }}
      >
        {level.name}
      </Text>
    </View>
  );
}

const PERIOD_LABEL: Record<Period, TranslationKey> = {
  week: 'dashboard.week',
  month: 'dashboard.month',
  sixMonths: 'dashboard.sixMonths',
};

function LeaderboardCard({ academyId, userId }: { academyId: string; userId?: string }) {
  const { t } = useT();
  const [period, setPeriod] = useState<Period>('week');
  const { from, to } = useMemo(() => periodRange(period), [period]);
  const board = useLeaderboard(academyId, from, to);
  const ranked = board.data?.filter((r) => r.points > 0).slice(0, 10) ?? [];

  return (
    <Card title={t('dashboard.leaderboard')}>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {periods.map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setPeriod(p)}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: active ? colors.primary : 'transparent',
              }}
            >
              <Text style={{ color: active ? colors.textOnPrimary : colors.textMuted }}>
                {t(PERIOD_LABEL[p])}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {board.isPending ? (
        <Spinner />
      ) : board.error ? (
        <ErrorText error={board.error} />
      ) : ranked.length === 0 ? (
        <Muted>{t('dashboard.empty')}</Muted>
      ) : (
        ranked.map((row, i) => (
          <View
            key={row.studentId}
            style={[
              styles.row,
              row.studentId === userId ? { backgroundColor: `${colors.yellow}33` } : null,
            ]}
          >
            <Text style={[styles.text, { width: 28, fontWeight: '700' }]}>{i + 1}</Text>
            <Text style={[styles.text, { flex: 1 }]}>{row.displayName}</Text>
            <Text style={[styles.text, { fontWeight: '700', color: colors.primary }]}>
              {t('dashboard.points', { count: row.points })}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

function StudiesCard({ academyId, userId }: { academyId: string; userId?: string }) {
  const { t } = useT();
  const academyStudies = useStudies({ scope: 'academy', academyId, userId });
  const publicStudies = useStudies({ scope: 'public', academyId, userId });
  const list = [...(academyStudies.data ?? []), ...(publicStudies.data ?? [])].filter(
    (s) => s.activityCount > 0,
  );

  return (
    <Card title={t('studies.title')}>
      {academyStudies.isPending ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Muted>{t('studies.none')}</Muted>
      ) : (
        list.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/studies/[id]', params: { id: s.id } })}
            style={styles.row}
          >
            <Text style={[styles.text, { flex: 1, fontWeight: '500', color: colors.primary }]}>
              {s.title}
            </Text>
            <Text style={styles.hint}>
              {t('studies.activityCount', { count: s.activityCount })}
            </Text>
          </Pressable>
        ))
      )}
      <ErrorText error={academyStudies.error ?? publicStudies.error} />
    </Card>
  );
}
