import {
  useAcademyStudentsReport,
  useGroupStudentIds,
  useGroups,
  useLevels,
  useMembers,
  useRatings,
} from '@erpchess/api/react';
import { academyStudentsReportToCsv, hasFide, isStaff, withRealRatings } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { BarChart3, Download, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AllStudentsReportView } from '../components/reports/ReportViews';
import { StudentPicker } from '../components/reports/StudentPicker';
import { StudentReportPane } from '../components/reports/StudentReportPane';
import { ReportRangePicker, useReportRange } from '../components/reports/useReportRange';
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  PageHeader,
  SelectField,
  Spinner,
  Tabs,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { downloadCsv } from '../lib/download';
import { useT } from '../lib/use-t';

type ReportView = 'student' | 'academy';

export const Route = createFileRoute('/a/$slug/reports')({
  // `student`: học viên đang xem (chia sẻ được qua link); `view=academy`: bảng toàn học viện
  validateSearch: (s: Record<string, unknown>): { student?: string; view?: 'academy' } => ({
    ...(typeof s.student === 'string' && s.student ? { student: s.student.slice(0, 64) } : {}),
    ...(s.view === 'academy' ? { view: 'academy' as const } : {}),
  }),
  component: ReportsPage,
});

/**
 * Báo cáo: nhân sự có hai tab "Theo học viên" (mặc định: danh sách bên trái, báo cáo chi tiết bên
 * phải) và "Toàn học viện" (bảng). Học viên vào thẳng báo cáo của mình; phụ huynh chọn trong các con.
 */
function ReportsPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const { student: studentParam, view: viewParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const view: ReportView = staff && viewParam === 'academy' ? 'academy' : 'student';

  const members = useMembers(academy.id);
  const groups = useGroups(academy.id);
  const levels = useLevels(academy.id);
  const range = useReportRange();
  const [batchId, setBatchId] = useState('all');
  const [search, setSearch] = useState('');

  const batches = useMemo(
    () => (groups.data ?? []).filter((g) => g.kind === 'batch'),
    [groups.data],
  );
  const students = useMemo(
    () => members.data?.filter((m) => m.role === 'student') ?? [],
    [members.data],
  );
  const batchStudentIds = useGroupStudentIds(batchId !== 'all' ? batchId : undefined);
  const listed = useMemo(() => {
    if (batchId === 'all') return students;
    const ids = new Set(batchStudentIds.data ?? []);
    return students.filter((s) => ids.has(s.profile.id));
  }, [students, batchId, batchStudentIds.data]);

  // Học viên tự xem báo cáo của mình; phụ huynh có đúng một con thì vào thẳng báo cáo con
  const isStudent = academy.role === 'student';
  const selectedId = isStudent
    ? session.user.id
    : studentParam && students.some((s) => s.profile.id === studentParam)
      ? studentParam
      : academy.role === 'parent' && students.length === 1
        ? students[0]?.profile.id
        : undefined;
  const selected = students.find((s) => s.profile.id === selectedId);

  const academyReport = useAcademyStudentsReport(staff ? academy.id : undefined, range.filter);
  const ratings = useRatings(staff ? academy.id : undefined);
  const summaries = useMemo(() => {
    // Rating lấy từ bảng `ratings` (giống trang Học viên): chưa có dòng thì là "Chưa có", không phải 1200
    const all = withRealRatings(academyReport.data ?? [], ratings.data ?? []);
    if (batchId === 'all') return all;
    const ids = new Set(batchStudentIds.data ?? []);
    return all.filter((s) => ids.has(s.studentId));
  }, [academyReport.data, ratings.data, batchId, batchStudentIds.data]);

  function select(studentId: string | undefined, nextView: ReportView = 'student') {
    void navigate({
      search: {
        ...(studentId ? { student: studentId } : {}),
        ...(nextView === 'academy' ? { view: 'academy' as const } : {}),
      },
    });
  }

  function exportAcademyCsv() {
    if (!academyReport.data) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `bao-cao-hoc-vien-${academy.slug}-${dateStr}.csv`,
      academyStudentsReportToCsv(summaries),
    );
  }

  const contact = (academy.contact ?? {}) as { address?: string; phone?: string };
  const me = members.data?.find((m) => m.profile.id === session.user.id);
  const pane = selectedId ? (
    <StudentReportPane
      key={selectedId}
      academy={{
        id: academy.id,
        slug: academy.slug,
        name: academy.name,
        logoUrl: academy.logo_url,
        address: contact.address,
        phone: contact.phone,
      }}
      studentId={selectedId}
      filter={range.filter}
      periodLabel={range.periodLabel}
      levelName={levels.data?.find((l) => l.id === selected?.levelId)?.name}
      batchName={batchId !== 'all' ? batches.find((b) => b.id === batchId)?.name : undefined}
      fide={academy.fide_enabled && hasFide(selected?.fide) ? selected?.fide : undefined}
      signerName={staff ? me?.profile.display_name || me?.profile.username || undefined : undefined}
      onBack={isStudent ? undefined : () => select(undefined)}
    />
  ) : null;

  const batchSelect = staff && (
    <SelectField
      label={t('reports.filterBatch')}
      value={batchId}
      onChange={setBatchId}
      options={[
        { value: 'all', label: t('reports.allBatches') },
        ...batches.map((b) => ({ value: b.id, label: b.name })),
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={BarChart3} title={t('reports.title')} subtitle={t('reports.subtitle')} />

      {/* Học viên: chỉ báo cáo của mình */}
      {isStudent && (
        <>
          <Card className="p-4">
            <ReportRangePicker range={range} />
          </Card>
          {pane}
        </>
      )}

      {!isStudent && (
        <>
          {staff && (
            <Tabs
              variant="underline"
              ariaLabel={t('reports.tabsLabel')}
              value={view}
              onChange={(next) => select(next === 'student' ? studentParam : undefined, next)}
              items={[
                { value: 'student', label: t('reports.tabByStudent') },
                { value: 'academy', label: t('reports.tabWholeAcademy') },
              ]}
            />
          )}

          {view === 'academy' ? (
            <>
              <Card className="flex flex-wrap items-end gap-4 p-4">
                {batchSelect}
                <ReportRangePicker range={range} />
                <Button
                  className="ml-auto"
                  icon={Download}
                  onClick={exportAcademyCsv}
                  disabled={academyReport.isPending || !!academyReport.error}
                >
                  {t('reports.exportAcademyCsv')}
                </Button>
              </Card>
              {academyReport.isPending && <Spinner />}
              {academyReport.error && <ErrorText error={academyReport.error} />}
              {!academyReport.isPending && !academyReport.error && (
                <AllStudentsReportView students={summaries} onSelectStudent={(id) => select(id)} />
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              {/* Cột trái: bộ lọc + danh sách; màn hẹp thì ẩn khi đã chọn học viên (xem chi tiết) */}
              <div className={`min-w-0 ${selected ? 'hidden lg:block' : ''}`}>
                <Card className="gap-4 p-4 lg:max-h-[calc(100vh-14rem)]">
                  {batchSelect}
                  <ReportRangePicker range={range} />
                  {staff && (
                    <Button
                      variant="ghost"
                      icon={Download}
                      onClick={exportAcademyCsv}
                      disabled={academyReport.isPending || !!academyReport.error}
                    >
                      {t('reports.exportAcademyCsv')}
                    </Button>
                  )}
                  {members.isPending ? (
                    <Spinner />
                  ) : (
                    <StudentPicker
                      students={listed}
                      selectedId={selectedId}
                      onSelect={(id) => select(id)}
                      search={search}
                      onSearch={setSearch}
                    />
                  )}
                </Card>
              </div>
              {/* Cột phải: báo cáo của học viên đang chọn, chưa chọn thì lời nhắc (chỉ desktop) */}
              <div className={`min-w-0 ${selected ? '' : 'hidden lg:block'}`}>
                {pane ?? (
                  <EmptyState
                    dashed
                    icon={FileText}
                    title={t('reports.pickStudent')}
                    description={t('reports.pickStudentHint')}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
