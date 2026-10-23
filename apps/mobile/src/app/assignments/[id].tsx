import type { AssignmentDetail } from '@erpchess/api';
import {
  useAssignment,
  useAttempts,
  useMembers,
  useMyAcademies,
  useProgress,
  useSession,
  useSubmitAttempt,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { colors, spacing } from '@erpchess/ui-tokens';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PuzzleSolver } from '@/components/PuzzleSolver';
import { Button, Card, ErrorText, Muted, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function AssignmentScreen() {
  const { t } = useT();
  const { id, slug } = useLocalSearchParams<{ id: string; slug: string }>();
  const { session } = useSession();
  const academies = useMyAcademies(session?.user.id);
  const academy = academies.data?.find((a) => a.slug === slug);
  const assignment = useAssignment(id);

  if (assignment.isPending || academies.isPending) return <Spinner />;
  if (assignment.error) return <ErrorText error={assignment.error} />;
  if (!academy || !session) return <Muted>{t('academy.none')}</Muted>;
  const a = assignment.data;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: a.title }} />
      {a.instructions ? <Text style={styles.text}>{a.instructions}</Text> : null}
      {academy.role === 'student' ? (
        <StudentWork assignment={a} studentId={session.user.id} />
      ) : (
        <Report assignment={a} academyId={isStaff(academy.role) ? academy.id : undefined} />
      )}
    </ScrollView>
  );
}

function StudentWork({
  assignment,
  studentId,
}: {
  assignment: AssignmentDetail;
  studentId: string;
}) {
  const { t } = useT();
  const attempts = useAttempts(assignment, studentId);
  const submit = useSubmitAttempt(assignment.id);
  const [index, setIndex] = useState<number | null>(null);

  if (attempts.isPending) return <Spinner />;
  const byItem = new Map(attempts.data?.map((x) => [x.item_id, x]));
  const items = assignment.items;
  if (items.length === 0) return <Muted>{t('common.empty')}</Muted>;
  const current =
    index ??
    Math.max(
      0,
      items.findIndex((i) => !byItem.get(i.id)?.solved),
    );
  const item = items[current];
  if (!item) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[styles.text, { fontWeight: '500' }]}>
        {t('puzzle.item', { n: current + 1, total: items.length })}: {item.puzzle.title}
      </Text>
      <PuzzleSolver
        key={item.id}
        puzzle={item.puzzle}
        onTryEnd={(s) => {
          // Giữ nguyên câu đang làm khi danh sách lần làm được tải lại
          setIndex(current);
          submit.reset();
          submit.mutate({ itemId: item.id, moves: s.moves });
        }}
      >
        {submit.isPending && <Muted>{t('puzzle.saving')}</Muted>}
        {submit.isSuccess && <Muted>{t('puzzle.saved')}</Muted>}
        <ErrorText error={submit.error} />
      </PuzzleSolver>
      {current < items.length - 1 && (
        <Button
          variant="ghost"
          title={`${t('puzzle.next')} →`}
          onPress={() => {
            submit.reset();
            setIndex(current + 1);
          }}
        />
      )}
      <Card title={t('assignments.items')}>
        {items.map((it, i) => {
          const att = byItem.get(it.id);
          return (
            <Pressable
              key={it.id}
              accessibilityRole="button"
              accessibilityState={{ selected: i === current }}
              onPress={() => {
                submit.reset();
                setIndex(i);
              }}
              style={[
                styles.row,
                i === current && { backgroundColor: `${colors.primary}1A`, borderRadius: 8 },
              ]}
            >
              <Text style={[styles.text, { flex: 1 }]}>
                {i + 1}. {it.puzzle.title}
              </Text>
              <Text style={{ color: att?.solved ? colors.green : colors.danger }}>
                {att?.solved ? '✓' : att ? '✗' : ''}
              </Text>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

function Report({
  assignment,
  academyId,
}: {
  assignment: AssignmentDetail;
  /** Chỉ staff mới tra được tên thành viên. */
  academyId?: string;
}) {
  const { t } = useT();
  const progress = useProgress({ assignmentId: assignment.id });
  const members = useMembers(academyId);
  const names = new Map(members.data?.map((m) => [m.profile.id, m.profile.display_name]));

  return (
    <Card title={t('assignments.report')}>
      {progress.isPending ? (
        <Spinner />
      ) : progress.error ? (
        <ErrorText error={progress.error} />
      ) : progress.data.length === 0 ? (
        <Muted>{t('assignments.noReport')}</Muted>
      ) : (
        progress.data.map((row) => (
          <View key={row.studentId} style={styles.row}>
            <Text style={[styles.text, { flex: 1, fontWeight: '500' }]}>
              {names.get(row.studentId) ?? row.studentId.slice(0, 8)}
            </Text>
            <Muted>
              {`${t('assignments.progress', { solved: row.solvedItems, total: row.totalItems })} · ${row.tries} · ${formatDuration(row.timeMs)}`}
            </Muted>
          </View>
        ))
      )}
    </Card>
  );
}
