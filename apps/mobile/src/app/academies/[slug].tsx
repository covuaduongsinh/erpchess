import { certificateVerifyUrl, formatCertificateCode, invoicePayUrl } from '@erpchess/api';
import {
  useAcademyPresence,
  useAssignments,
  useCertificates,
  useClassrooms,
  useConversations,
  useCourseCompletions,
  useCourseProgress,
  useCourses,
  useCreateGroup,
  useCreateStudent,
  useGroups,
  useInvoices,
  useLeaderboard,
  useLevels,
  useMarkNotificationsRead,
  useMembers,
  useMyAcademies,
  useMyNotifications,
  usePlayGames,
  usePracticeChapters,
  useProgress,
  useQuizzes,
  useSession,
  useStudentReportSummary,
  useStudentXp,
  useStudies,
  useTournaments,
} from '@erpchess/api/react';
import {
  academyRoles,
  formatMoney,
  isStaff,
  type Period,
  periodRange,
  periods,
  quizStatus,
  streakFrom,
  vnToday,
} from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { colors, radius, spacing } from '@erpchess/ui-tokens';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { chatPreview } from '@/components/ChatMessageBody';
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
  // Mở màn học viện là báo mình đang online (HLV thấy ở Game Area để ghép cặp)
  useAcademyPresence(
    academy?.id,
    session
      ? {
          userId: session.user.id,
          name: String(session.user.user_metadata?.display_name ?? ''),
          role: academy?.role ?? '',
        }
      : undefined,
  );

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
      <MobileQuickActions slug={academy.slug} />
      {academy.role === 'student' && <MyLevel academyId={academy.id} userId={session?.user.id} />}

      <LeaderboardCard academyId={academy.id} userId={session?.user.id} />

      <AssignmentsCard academyId={academy.id} slug={academy.slug} staff={staff} />

      <QuizzesCard academyId={academy.id} />
      <MyGamesCard academyId={academy.id} />
      <TournamentsCard academyId={academy.id} />
      <ClassesCard academyId={academy.id} />
      <PracticeCard academyId={academy.id} />

      <StudiesCard academyId={academy.id} userId={session?.user.id} />

      <CoursesCard academyId={academy.id} />

      <StudentReportCard academyId={academy.id} userId={session?.user.id} />

      {academy.role === 'student' ? <XpCard academyId={academy.id} /> : null}
      {academy.role === 'student' ? <CertificatesCard academyId={academy.id} /> : null}
      {academy.role === 'student' || academy.role === 'parent' ? (
        <InvoicesCard academyId={academy.id} />
      ) : null}
      <NotificationsCard academyId={academy.id} />
      <ChatsCard academyId={academy.id} />

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

function QuizzesCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const quizzes = useQuizzes(academyId);
  const list = (quizzes.data ?? []).filter((q) => quizStatus(q.starts_at, q.due_at) !== 'closed');
  return (
    <Card title={t('quiz.title')}>
      {quizzes.isPending ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Muted>{t('quiz.none')}</Muted>
      ) : (
        list.map((q) => (
          <Pressable
            key={q.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/quizzes/[id]', params: { id: q.id } })}
            style={styles.row}
          >
            <Text style={[styles.text, { flex: 1, fontWeight: '500', color: colors.primary }]}>
              {q.title}
            </Text>
            <Text style={styles.hint}>{t(`quiz.status_${quizStatus(q.starts_at, q.due_at)}`)}</Text>
          </Pressable>
        ))
      )}
      <ErrorText error={quizzes.error} />
    </Card>
  );
}

/** Practice: liệt kê chương với số lượng thế cờ và phân loại học viện/riêng tư. */
function PracticeCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const chapters = usePracticeChapters(academyId);
  if (!chapters.isPending && (chapters.data?.length ?? 0) === 0) return null;
  return (
    <Card title={t('practice.title')}>
      {chapters.isPending ? (
        <Spinner />
      ) : (
        chapters.data?.map((c) => (
          <View key={c.id} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.text, { fontWeight: '600' }]}>{c.title}</Text>
              <Text style={styles.hint}>
                {c.visibility === 'academy' ? 'Học viện' : 'Riêng tư'} ·{' '}
                {t('practice.positionCount', { count: c.positionCount })}
              </Text>
            </View>
            <View
              style={{
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: radius.sm,
                backgroundColor: `${colors.primary}15`,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                {c.positionCount > 0 ? `${c.positionCount} thế cờ` : 'Trống'}
              </Text>
            </View>
          </View>
        ))
      )}
      <Muted>{t('practice.webOnly')}</Muted>
      <ErrorText error={chapters.error} />
    </Card>
  );
}

/** Buổi học trong 30 ngày tới; học viên thấy trạng thái điểm danh của mình. */
function ClassesCard({ academyId }: { academyId: string }) {
  const { t, i18n } = useT();
  const [range] = useState(() => {
    const from = new Date();
    from.setHours(from.getHours() - 3);
    return { from, to: new Date(from.getTime() + 30 * 86_400_000) };
  });
  const classes = useClassrooms(academyId, range);
  const { session } = useSession();
  return (
    <Card title={t('classroom.upcoming')}>
      {classes.isPending ? (
        <Spinner />
      ) : (classes.data?.length ?? 0) === 0 ? (
        <Muted>{t('classroom.noUpcoming')}</Muted>
      ) : (
        classes.data?.slice(0, 10).map((c) => {
          const mine = c.attendance.find((a) => a.student_id === session?.user.id)?.status as
            | 'present'
            | 'late'
            | 'absent'
            | 'excused'
            | undefined;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/classes/[id]', params: { id: c.id } })}
              style={styles.row}
            >
              <Text style={[styles.text, { flex: 1, color: colors.primary }]}>
                {c.title} ·{' '}
                {new Date(c.starts_at).toLocaleString(i18n.language, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </Text>
              {mine && <Text style={styles.hint}>{t(`classroom.status_${mine}`)}</Text>}
            </Pressable>
          );
        })
      )}
      <ErrorText error={classes.error} />
    </Card>
  );
}

/** Ván 1–1 đang chơi của mình (HLV ghép cặp); đánh máy chỉ có trên web/desktop. */
function MyGamesCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const { session } = useSession();
  const games = usePlayGames(academyId, { status: ['active'], playerId: session?.user.id });
  return (
    <Card title={t('play.myGames')}>
      {games.isPending ? (
        <Spinner />
      ) : (games.data?.length ?? 0) === 0 ? (
        <Muted>{t('play.noMyGames')}</Muted>
      ) : (
        games.data?.map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/games/[id]', params: { id: g.id } })}
            style={styles.row}
          >
            <Text style={[styles.text, { flex: 1, color: colors.primary }]}>
              {g.white_id === session?.user.id ? `♔ ${t('play.white')}` : `♚ ${t('play.black')}`}
              {g.base_ms ? ` · ${g.base_ms / 60000}+${g.inc_ms / 1000}` : ''}
            </Text>
          </Pressable>
        ))
      )}
      <Muted>{t('play.botWebOnly')}</Muted>
      <ErrorText error={games.error} />
    </Card>
  );
}

/** Giải đang diễn ra / sắp tới; ván giải của mình hiện ở thẻ "Ván của tôi". */
function TournamentsCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const { session } = useSession();
  const list = useTournaments(academyId);
  const shown = (list.data ?? []).filter((x) => x.status !== 'finished').slice(0, 5);
  if (!list.isPending && shown.length === 0) return null;
  return (
    <Card title={t('tournament.title')}>
      {list.isPending ? (
        <Spinner />
      ) : (
        shown.map((x) => (
          <View key={x.id} style={styles.row}>
            <Text style={[styles.text, { flex: 1 }]}>
              {x.title}
              {x.playerIds.includes(session?.user.id ?? '') ? ' ★' : ''}
            </Text>
            <Text style={styles.hint}>
              {x.status === 'active'
                ? `${t('tournament.roundN', { n: x.current_round })}/${x.rounds}`
                : t('tournament.upcoming')}
            </Text>
          </View>
        ))
      )}
      <ErrorText error={list.error} />
    </Card>
  );
}

/** Khoá học đã xuất bản (học viên thấy % hoàn thành của mình). */
function CoursesCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const { session } = useSession();
  const list = useCourses(academyId);
  const shown = (list.data ?? []).filter((c) => c.status === 'published');
  const ids = shown.map((c) => c.id);
  const progress = useCourseProgress(ids);
  const done = useCourseCompletions(ids);
  if (!list.isPending && shown.length === 0) return null;
  return (
    <Card title={t('course.title')}>
      {list.isPending ? (
        <Spinner />
      ) : (
        shown.map((c) => {
          const p = progress.data?.find(
            (x) => x.course_id === c.id && x.student_id === session?.user.id,
          );
          const finished = done.data?.some(
            (x) => x.course_id === c.id && x.student_id === session?.user.id,
          );
          const pct = p?.required_total
            ? Math.round(((p.required_done ?? 0) / p.required_total) * 100)
            : 0;
          return (
            <View key={c.id} style={styles.row}>
              <Text style={[styles.text, { flex: 1 }]}>{c.title}</Text>
              <Text style={styles.hint}>
                {finished ? t('course.completed') : t('course.percent', { percent: pct })}
              </Text>
            </View>
          );
        })
      )}
      <ErrorText error={list.error} />
    </Card>
  );
}

/** XP hôm nay, tổng XP và chuỗi ngày học của học viên. */
function XpCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const { session } = useSession();
  const xp = useStudentXp(session?.user.id, academyId);
  if (!xp.data) return null;
  const streak = streakFrom(xp.data.days, vnToday());
  return (
    <Card title={t('xp.title')}>
      <Text style={styles.text}>
        {`${t('xp.today')}: +${xp.data.today} · ${t('xp.total')}: ${xp.data.total} · 🔥 ${t('xp.days', { count: streak.current })}`}
      </Text>
      <Muted>{t('xp.longest', { count: streak.longest })}</Muted>
    </Card>
  );
}

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Chứng chỉ của tôi; chạm để mở trang xác minh công khai. */
function CertificatesCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const { session } = useSession();
  const list = useCertificates(session ? { academyId, studentId: session.user.id } : undefined);
  if (!list.data?.length) return null;
  return (
    <Card title={t('cert.title')}>
      {list.data.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(certificateVerifyUrl(SITE_URL, c.code))}
          style={styles.row}
        >
          <Text style={[styles.text, { flex: 1, color: colors.primary }]}>🎓 {c.title}</Text>
          <Text style={styles.hint}>
            {c.revoked_at ? t('cert.revoked') : formatCertificateCode(c.code)}
          </Text>
        </Pressable>
      ))}
    </Card>
  );
}

function InvoicesCard({ academyId }: { academyId: string }) {
  const { t, i18n } = useT();
  const list = useInvoices({ academyId });
  if (!list.data?.length) return null;
  return (
    <Card title={t('bill.myInvoices')}>
      {list.data.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(invoicePayUrl(SITE_URL, i.pay_token))}
          style={styles.row}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { color: colors.primary }]}>{i.number}</Text>
            <Text style={styles.hint}>{i.student?.display_name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.text}>{formatMoney(i.total, i.currency, i18n.language)}</Text>
            <Text style={[styles.hint, i.status === 'open' ? { color: colors.orange } : null]}>
              {t(`bill.status_${i.status as 'open'}`)}
            </Text>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

function NotificationsCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const { session } = useSession();
  const userId = session?.user.id;
  const list = useMyNotifications(userId, { academyId, limit: 10 });
  const markRead = useMarkNotificationsRead(userId);
  const unread = (list.data ?? []).filter((n) => !n.read_at);
  if (unread.length === 0) return null;
  return (
    <Card title={`🔔 ${t('notify.title')} (${unread.length})`}>
      {unread.map((n) => (
        <Pressable
          key={n.id}
          accessibilityRole="button"
          onPress={() => markRead.mutate({ ids: [n.id] })}
          style={styles.row}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { fontWeight: '500' }]}>{n.title}</Text>
            {n.body ? <Text style={styles.hint}>{n.body}</Text> : null}
          </View>
        </Pressable>
      ))}
      <Button
        title={t('notify.markAll')}
        variant="ghost"
        onPress={() => markRead.mutate({ academyId })}
      />
    </Card>
  );
}

function ChatsCard({ academyId }: { academyId: string }) {
  const { t } = useT();
  const list = useConversations(academyId);
  if (!list.data?.length) return null;
  return (
    <Card title={`💬 ${t('chat.title')}`}>
      {list.data.slice(0, 8).map((c) => {
        const title = (c.kind === 'group' ? c.group_name : c.other_name) ?? '—';
        return (
          <Pressable
            key={c.id}
            accessibilityRole="link"
            onPress={() =>
              router.push({
                pathname: '/chats/[id]',
                params: { id: c.id, academy: academyId, title },
              })
            }
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.text, { fontWeight: '500' }]}>
                {c.kind === 'group' ? '👥 ' : ''}
                {title}
              </Text>
              <Text style={styles.hint} numberOfLines={1}>
                {chatPreview(c.last_body, t) ?? t('chat.empty')}
              </Text>
            </View>
            {c.unread > 0 ? (
              <Text style={[styles.hint, { color: colors.orange, fontWeight: '700' }]}>
                {c.unread}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

function StudentReportCard({ academyId, userId }: { academyId: string; userId?: string }) {
  const { t } = useT();
  const summary = useStudentReportSummary(academyId, userId);

  return (
    <Card title={t('reports.title')}>
      {summary.isPending ? (
        <Spinner />
      ) : summary.error ? (
        <ErrorText error={summary.error} />
      ) : !summary.data ? (
        <Muted>{t('reports.noData')}</Muted>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.row}>
            <Text style={styles.text}>{t('reports.assignmentsTitle')}</Text>
            <Text style={[styles.text, { fontWeight: '600' }]}>
              {summary.data.assignments.completed}/{summary.data.assignments.totalAssigned} (
              {summary.data.assignments.solvedRate.toFixed(0)}%)
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.text}>{t('reports.quizzesTitle')}</Text>
            <Text style={[styles.text, { fontWeight: '600' }]}>
              {summary.data.quizzes.completed} bài · {summary.data.quizzes.avgScore.toFixed(1)}đ
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.text}>{t('reports.attendanceTitle')}</Text>
            <Text style={[styles.text, { fontWeight: '600' }]}>
              {summary.data.classrooms.attendanceRate.toFixed(0)}% (
              {summary.data.classrooms.presentCount}/{summary.data.classrooms.totalSessions})
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.text}>{t('reports.gamesTitle')}</Text>
            <Text style={[styles.text, { fontWeight: '600' }]}>
              {summary.data.games.wins}W / {summary.data.games.draws}D / {summary.data.games.losses}
              L
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.text}>{t('reports.tournamentsTitle')}</Text>
            <Text style={[styles.text, { fontWeight: '600' }]}>
              {summary.data.tournaments.totalJoined} giải · {summary.data.tournaments.totalPoints}đ
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}

function MobileQuickActions({ slug }: { slug: string }) {
  const { t } = useT();
  return (
    <View style={quickStyles.container}>
      <Pressable
        accessibilityRole="button"
        style={quickStyles.button}
        onPress={() => router.push('/analysis')}
      >
        <Text style={quickStyles.icon}>♟️</Text>
        <Text style={quickStyles.label}>{t('analysis.title')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={quickStyles.button}
        onPress={() => router.push({ pathname: '/academies/[slug]', params: { slug } })}
      >
        <Text style={quickStyles.icon}>🧩</Text>
        <Text style={quickStyles.label}>{t('assignments.title')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={quickStyles.button}
        onPress={() => router.push({ pathname: '/academies/[slug]', params: { slug } })}
      >
        <Text style={quickStyles.icon}>🏫</Text>
        <Text style={quickStyles.label}>{t('classroom.room')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={quickStyles.button}
        onPress={() => router.push({ pathname: '/academies/[slug]', params: { slug } })}
      >
        <Text style={quickStyles.icon}>⚔️</Text>
        <Text style={quickStyles.label}>{t('play.title')}</Text>
      </Pressable>
    </View>
  );
}

const quickStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  icon: {
    fontSize: 20,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
});
