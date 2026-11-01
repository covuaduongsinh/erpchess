import type { LeaderboardRow } from '@erpchess/api';
import { useAcademyQuizBoard } from '@erpchess/api/react';
import { type Period, periodRange, periods } from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { LeaderboardPodium } from '../dashboard/LeaderboardPodium';
import { Card, EmptyState, ErrorText, Spinner, Tabs } from '../ui';

const PERIOD_LABEL: Record<Period, TranslationKey> = {
  week: 'dashboard.week',
  month: 'dashboard.month',
  sixMonths: 'dashboard.sixMonths',
};

/** Tab "Bảng xếp hạng" của trang Quiz: điểm quiz toàn học viện (mọi thành viên xem được). */
export function QuizBoardTab() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const [period, setPeriod] = useState<Period>('week');
  // Tính một lần cho mỗi lựa chọn để khoá truy vấn ổn định giữa các lần render
  const { from, to } = useMemo(() => periodRange(period), [period]);
  const board = useAcademyQuizBoard(academy.id, from, to);

  // Bục podium dùng chung với bảng xếp hạng ở Tổng quan: `solved` là số câu đúng
  const ranked: LeaderboardRow[] = (board.data ?? [])
    .filter((r) => r.points > 0)
    .map((r) => ({
      studentId: r.studentId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      points: r.points,
      solved: r.correct,
      tries: 0,
    }));

  return (
    <Card title={t('learnPage.quizTabBoard')}>
      <Tabs
        variant="pills"
        ariaLabel={t('learnPage.quizBoardPeriods')}
        value={period}
        onChange={setPeriod}
        items={periods.map((p) => ({ value: p, label: t(PERIOD_LABEL[p]) }))}
      />
      {board.isPending ? (
        <Spinner />
      ) : board.error ? (
        <ErrorText error={board.error} />
      ) : ranked.length === 0 ? (
        <EmptyState dashed icon={Trophy} title={t('learnPage.quizBoardEmpty')} />
      ) : (
        <LeaderboardPodium rows={ranked} currentUserId={session.user.id} />
      )}
      <p className="text-xs text-text-muted">{t('learnPage.quizBoardRule')}</p>
    </Card>
  );
}
