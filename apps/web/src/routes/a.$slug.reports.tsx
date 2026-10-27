import {
  useAcademyStudentsReport,
  useGroupStudentIds,
  useGroups,
  useLevels,
  useMembers,
  useStudentReportDetails,
  useStudentReportSummary,
} from '@erpchess/api/react';
import {
  type AcademyStudentSummary,
  academyStudentsReportToCsv,
  isStaff,
  type ReportPreset,
  studentDetailedReportToCsv,
} from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { PrintableReportCard } from '../components/reports/PrintableReportCard';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { downloadCsv } from '../lib/download';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/reports')({
  component: ReportsPage,
});

type Tab = 'overview' | 'assignments' | 'quizzes' | 'attendance' | 'games' | 'tournaments';

function ReportsPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const members = useMembers(academy.id);
  const groups = useGroups(academy.id);
  const levels = useLevels(academy.id);

  const batches = useMemo(
    () => (groups.data ?? []).filter((g) => g.kind === 'batch'),
    [groups.data],
  );

  const students = useMemo(
    () => members.data?.filter((m) => m.role === 'student') ?? [],
    [members.data],
  );

  // Chọn học viên (với staff: 'all' hoặc ID học viên; với học viên: ID của chính mình)
  const defaultStudentId = staff ? 'all' : session.user.id;
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(defaultStudentId);
  const [preset, setPreset] = useState<ReportPreset | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Lọc học viên theo batch
  const batchStudentIds = useGroupStudentIds(
    selectedBatchId !== 'all' ? selectedBatchId : undefined,
  );

  const filteredStudents = useMemo(() => {
    if (selectedBatchId === 'all') return students;
    if (!batchStudentIds.data) return [];
    const set = new Set(batchStudentIds.data);
    return students.filter((s) => set.has(s.profile.id));
  }, [students, selectedBatchId, batchStudentIds.data]);

  // Tính khoảng ngày filter
  const filter = useMemo(() => {
    const now = new Date();
    if (preset === 'all') return {};
    if (preset === 'month') {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to: now.toISOString(),
      };
    }
    if (preset === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        from: new Date(now.getFullYear(), qMonth, 1).toISOString(),
        to: now.toISOString(),
      };
    }
    if (preset === 'year') {
      return {
        from: new Date(now.getFullYear(), 0, 1).toISOString(),
        to: now.toISOString(),
      };
    }
    return {
      from: customFrom ? new Date(customFrom).toISOString() : undefined,
      to: customTo ? new Date(`${customTo}T23:59:59.999Z`).toISOString() : undefined,
    };
  }, [preset, customFrom, customTo]);

  // Dữ liệu cho toàn học viện (khi staff chọn 'all')
  const academyReport = useAcademyStudentsReport(
    staff && selectedStudentId === 'all' ? academy.id : undefined,
    filter,
  );

  // Lọc danh sách summary theo batch
  const filteredAcademySummaries = useMemo(() => {
    const list = academyReport.data ?? [];
    if (selectedBatchId === 'all') return list;
    if (!batchStudentIds.data) return [];
    const set = new Set(batchStudentIds.data);
    return list.filter((s) => set.has(s.studentId));
  }, [academyReport.data, selectedBatchId, batchStudentIds.data]);

  // Dữ liệu chi tiết cho một học viên
  const isSingleStudent = selectedStudentId !== 'all';
  const targetStudentId = isSingleStudent ? selectedStudentId : undefined;

  const summary = useStudentReportSummary(
    isSingleStudent ? academy.id : undefined,
    targetStudentId,
    filter,
  );

  const details = useStudentReportDetails(
    isSingleStudent ? academy.id : undefined,
    targetStudentId,
    filter,
  );

  // Thông tin cấp độ và lớp của học viên đang chọn
  const currentMember = useMemo(
    () => members.data?.find((m) => m.profile.id === selectedStudentId),
    [members.data, selectedStudentId],
  );
  const currentLevelName = useMemo(
    () => levels.data?.find((l) => l.id === currentMember?.levelId)?.name,
    [levels.data, currentMember?.levelId],
  );
  const currentBatchName = useMemo(
    () =>
      selectedBatchId !== 'all' ? batches.find((b) => b.id === selectedBatchId)?.name : undefined,
    [batches, selectedBatchId],
  );

  // Xuất CSV
  const handleExportCsv = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    if (selectedStudentId === 'all') {
      if (!academyReport.data) return;
      const csv = academyStudentsReportToCsv(filteredAcademySummaries);
      downloadCsv(`bao-cao-hoc-vien-${academy.slug}-${dateStr}.csv`, csv);
    } else {
      if (!details.data) return;
      const csv = studentDetailedReportToCsv(details.data);
      downloadCsv(`bao-cao-${details.data.student.username}-${dateStr}.csv`, csv);
    }
  };

  const isPending =
    selectedStudentId === 'all' ? academyReport.isPending : summary.isPending || details.isPending;
  const error = selectedStudentId === 'all' ? academyReport.error : summary.error || details.error;

  return (
    <div className="flex flex-col gap-6">
      {/* Tiêu đề & thanh điều khiển */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary">{t('reports.title')}</h2>
          <p className="text-sm text-text-muted">{t('reports.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {isSingleStudent && details.data && (
            <Button
              variant="ghost"
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-2 border border-primary/30 text-primary hover:bg-primary/10"
            >
              <span>🖨️</span>
              {t('reports.printReport')}
            </Button>
          )}
          <Button
            onClick={handleExportCsv}
            disabled={isPending || !!error}
            className="flex items-center gap-2"
          >
            <span>📥</span>
            {t('reports.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Thanh bộ lọc */}
      <Card className="flex flex-wrap items-center gap-4 bg-muted/20 p-4">
        {/* Bộ chọn Lớp / Nhóm (Batch) */}
        {staff && (
          <div className="flex items-center gap-2">
            <label htmlFor="select-batch" className="text-sm font-medium text-text-muted">
              {t('reports.filterBatch')}:
            </label>
            <select
              id="select-batch"
              value={selectedBatchId}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                if (selectedStudentId !== 'all') {
                  setSelectedStudentId('all');
                }
              }}
              className="rounded-md border border-text-muted/30 bg-white px-3 py-1.5 text-sm"
            >
              <option value="all">{t('reports.allBatches')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bộ chọn học viên */}
        {(staff || academy.role === 'parent') && (
          <div className="flex items-center gap-2">
            <label htmlFor="select-student" className="text-sm font-medium text-text-muted">
              {t('reports.filterStudent')}:
            </label>
            <select
              id="select-student"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-md border border-text-muted/30 bg-white px-3 py-1.5 text-sm"
            >
              {staff && <option value="all">{t('reports.allStudents')}</option>}
              {filteredStudents.map((s) => (
                <option key={s.profile.id} value={s.profile.id}>
                  {s.profile.display_name} (@{s.profile.username})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bộ chọn thời gian */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-muted">{t('reports.dateRange')}:</span>
          <div className="inline-flex rounded-md shadow-xs">
            {(
              [
                ['all', t('reports.presetAll')],
                ['month', t('reports.presetMonth')],
                ['quarter', t('reports.presetQuarter')],
                ['year', t('reports.presetYear')],
                ['custom', t('reports.customRange')],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`border border-text-muted/30 px-3 py-1 text-xs font-medium first:rounded-l-md last:rounded-r-md ${
                  preset === p
                    ? 'bg-primary text-white'
                    : 'bg-white text-text-muted hover:bg-muted/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
                aria-label={t('reports.fromDate')}
              />
              <span>→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
                aria-label={t('reports.toDate')}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Hiển thị lỗi hoặc loading */}
      {isPending && <Spinner />}
      {error && <ErrorText error={error} />}

      {/* CHẾ ĐỘ 1: TẤT CẢ HỌC VIÊN (Staff view) */}
      {!isPending && !error && selectedStudentId === 'all' && (
        <AllStudentsReportView
          students={filteredAcademySummaries}
          onSelectStudent={(id) => setSelectedStudentId(id)}
        />
      )}

      {/* CHẾ ĐỘ 2: MỘT HỌC VIÊN CỤ THỂ */}
      {!isPending && !error && selectedStudentId !== 'all' && details.data && (
        <SingleStudentReportView
          report={details.data}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}

      {/* MODAL IN PHIẾU ĐIỂM HỌC VIÊN */}
      {showPrintModal && details.data && (
        <PrintableReportCard
          report={details.data}
          academyName={academy.name}
          levelName={currentLevelName}
          batchName={currentBatchName}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}

/** Chế độ xem bảng toàn học viện */
function AllStudentsReportView({
  students,
  onSelectStudent,
}: {
  students: AcademyStudentSummary[];
  onSelectStudent: (studentId: string) => void;
}) {
  const { t } = useT();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q),
    );
  }, [students, search]);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold">
          {t('reports.tabAllStudents')} ({students.length})
        </h3>
        <input
          type="search"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-text-muted/30 bg-white px-3 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-text-muted/20 text-xs font-semibold uppercase text-text-muted">
              <th className="py-2.5 px-3">{t('reports.colStudent')}</th>
              <th className="py-2.5 px-3">{t('reports.colLevel')}</th>
              <th className="py-2.5 px-3">{t('reports.colAssignments')}</th>
              <th className="py-2.5 px-3">{t('reports.colQuiz')}</th>
              <th className="py-2.5 px-3">{t('reports.colAttendance')}</th>
              <th className="py-2.5 px-3">{t('reports.colGames')}</th>
              <th className="py-2.5 px-3">{t('reports.colBlitz')}</th>
              <th className="py-2.5 px-3">{t('reports.colRapid')}</th>
              <th className="py-2.5 px-3">{t('reports.colClassical')}</th>
              <th className="py-2.5 px-3 text-right">{t('reports.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-text-muted/10">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-text-muted">
                  {t('reports.noData')}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.studentId} className="hover:bg-muted/10">
                  <td className="py-3 px-3">
                    <div className="font-medium text-primary">{s.displayName}</div>
                    <div className="text-xs text-text-muted">@{s.username}</div>
                  </td>
                  <td className="py-3 px-3 text-text-muted">{s.levelName ?? '-'}</td>
                  <td className="py-3 px-3">
                    <span className="font-medium">
                      {s.assignmentsCompleted}/{s.assignmentsTotal}
                    </span>
                    {s.assignmentsTotal > 0 && (
                      <span className="ml-1 text-xs text-text-muted">
                        ({((s.assignmentsCompleted / s.assignmentsTotal) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium">{s.quizAvgScore.toFixed(1)}</span>
                    <span className="ml-1 text-xs text-text-muted">({s.quizCompleted} bài)</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium">{s.attendanceRate.toFixed(1)}%</span>
                    <span className="ml-1 text-xs text-text-muted">
                      ({s.sessionsPresent}/{s.sessionsTotal})
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium">{s.gamesWdl}</span>
                    <span className="ml-1 text-xs text-text-muted">(Tổng {s.gamesTotal})</span>
                  </td>
                  <td className="py-3 px-3">{s.blitzRating}</td>
                  <td className="py-3 px-3">{s.rapidRating}</td>
                  <td className="py-3 px-3">{s.classicalRating}</td>
                  <td className="py-3 px-3 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => onSelectStudent(s.studentId)}
                      className="text-xs"
                    >
                      {t('reports.viewDetails')}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Chế độ xem chi tiết 1 học viên */
function SingleStudentReportView({
  report,
  activeTab,
  onTabChange,
}: {
  report: ReturnType<typeof useStudentReportDetails>['data'] & object;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const { t } = useT();
  const { summary, assignments, quizzes, classrooms, games, tournaments } = report;

  return (
    <div className="flex flex-col gap-6">
      {/* 5 Thẻ KPI Tóm Tắt */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Bài tập */}
        <Card className="flex flex-col gap-1 border-l-4 border-l-blue-500 p-4">
          <div className="text-xs font-semibold text-text-muted">
            {t('reports.assignmentsTitle')}
          </div>
          <div className="text-2xl font-bold">
            {summary.assignments.completed}/{summary.assignments.totalAssigned}
          </div>
          <div className="text-xs text-text-muted">
            Tỉ lệ: {summary.assignments.solvedRate.toFixed(1)}% · Thử TB:{' '}
            {summary.assignments.avgTries.toFixed(1)}
          </div>
        </Card>

        {/* Quiz */}
        <Card className="flex flex-col gap-1 border-l-4 border-l-purple-500 p-4">
          <div className="text-xs font-semibold text-text-muted">{t('reports.quizzesTitle')}</div>
          <div className="text-2xl font-bold">
            {summary.quizzes.completed}/{summary.quizzes.totalAssigned}
          </div>
          <div className="text-xs text-text-muted">
            Điểm TB: {summary.quizzes.avgScore.toFixed(1)} · TB:{' '}
            {(summary.quizzes.avgTimeMs / 1000).toFixed(0)}s
          </div>
        </Card>

        {/* Chuyên cần */}
        <Card className="flex flex-col gap-1 border-l-4 border-l-green-500 p-4">
          <div className="text-xs font-semibold text-text-muted">
            {t('reports.attendanceTitle')}
          </div>
          <div className="text-2xl font-bold">{summary.classrooms.attendanceRate.toFixed(1)}%</div>
          <div className="text-xs text-text-muted">
            Có mặt: {summary.classrooms.presentCount} · Muộn: {summary.classrooms.lateCount} · Vắng:{' '}
            {summary.classrooms.absentCount}
          </div>
        </Card>

        {/* Ván cờ */}
        <Card className="flex flex-col gap-1 border-l-4 border-l-amber-500 p-4">
          <div className="text-xs font-semibold text-text-muted">{t('reports.gamesTitle')}</div>
          <div className="text-2xl font-bold">
            {summary.games.wins}W / {summary.games.draws}D / {summary.games.losses}L
          </div>
          <div className="text-xs text-text-muted">
            Blitz: {summary.games.ratings.blitz ?? '-'} · Rapid:{' '}
            {summary.games.ratings.rapid ?? '-'}
          </div>
        </Card>

        {/* Giải đấu */}
        <Card className="flex flex-col gap-1 border-l-4 border-l-rose-500 p-4">
          <div className="text-xs font-semibold text-text-muted">
            {t('reports.tournamentsTitle')}
          </div>
          <div className="text-2xl font-bold">{summary.tournaments.totalJoined} giải</div>
          <div className="text-xs text-text-muted">
            Điểm: {summary.tournaments.totalPoints} · Hạng cao nhất:{' '}
            {summary.tournaments.bestRank ?? '-'}
          </div>
        </Card>
      </div>

      {/* Điều hướng Tabs chi tiết */}
      <div className="flex gap-2 border-b border-text-muted/20">
        {(
          [
            ['overview', t('reports.tabOverview')],
            ['assignments', `${t('reports.tabAssignments')} (${assignments.length})`],
            ['quizzes', `${t('reports.tabQuizzes')} (${quizzes.length})`],
            ['attendance', `${t('reports.tabAttendance')} (${classrooms.length})`],
            ['games', `${t('reports.tabGames')} (${games.length})`],
            ['tournaments', `${t('reports.tabTournaments')} (${tournaments.length})`],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Nội dung Tab */}
      <Card className="p-4">
        {/* TAB 1: TỔNG QUAN */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-primary">{t('reports.tabOverview')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-md border border-text-muted/20 p-3">
                <div className="font-semibold text-text-muted mb-2">
                  {t('reports.assignmentsTitle')}
                </div>
                <p>Tổng số bài tập được giao: {summary.assignments.totalAssigned}</p>
                <p>Đã hoàn thành: {summary.assignments.completed}</p>
                <p>Tỉ lệ hoàn thành: {summary.assignments.solvedRate.toFixed(1)}%</p>
                <p>Số lần thử trung bình: {summary.assignments.avgTries.toFixed(1)}</p>
              </div>

              <div className="rounded-md border border-text-muted/20 p-3">
                <div className="font-semibold text-text-muted mb-2">
                  {t('reports.quizzesTitle')}
                </div>
                <p>Tổng số quiz: {summary.quizzes.totalAssigned}</p>
                <p>Đã nộp bài: {summary.quizzes.completed}</p>
                <p>Điểm trung bình: {summary.quizzes.avgScore.toFixed(1)}</p>
              </div>

              <div className="rounded-md border border-text-muted/20 p-3">
                <div className="font-semibold text-text-muted mb-2">
                  {t('reports.attendanceTitle')}
                </div>
                <p>Tổng số buổi học: {summary.classrooms.totalSessions}</p>
                <p>Có mặt: {summary.classrooms.presentCount}</p>
                <p>Đi muộn: {summary.classrooms.lateCount}</p>
                <p>Vắng mặt: {summary.classrooms.absentCount}</p>
                <p>Tỉ lệ chuyên cần: {summary.classrooms.attendanceRate.toFixed(1)}%</p>
              </div>

              <div className="rounded-md border border-text-muted/20 p-3">
                <div className="font-semibold text-text-muted mb-2">
                  {t('reports.gamesTitle')} & Rating
                </div>
                <p>Tổng số ván: {summary.games.totalGames}</p>
                <p>
                  Thắng: {summary.games.wins} · Hoà: {summary.games.draws} · Thua:{' '}
                  {summary.games.losses}
                </p>
                <p>
                  Rating: Blitz {summary.games.ratings.blitz ?? '-'} | Rapid{' '}
                  {summary.games.ratings.rapid ?? '-'} | Classical{' '}
                  {summary.games.ratings.classical ?? '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BÀI TẬP */}
        {activeTab === 'assignments' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-text-muted/20 text-xs font-semibold uppercase text-text-muted">
                  <th className="py-2.5 px-3">{t('reports.taskTitle')}</th>
                  <th className="py-2.5 px-3">{t('reports.assignedAt')}</th>
                  <th className="py-2.5 px-3">{t('reports.dueDate')}</th>
                  <th className="py-2.5 px-3">{t('reports.status')}</th>
                  <th className="py-2.5 px-3">{t('reports.tries')}</th>
                  <th className="py-2.5 px-3">{t('reports.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text-muted/10">
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-text-muted">
                      {t('reports.noData')}
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/10">
                      <td className="py-3 px-3 font-medium">{a.title}</td>
                      <td className="py-3 px-3 text-text-muted">
                        {new Date(a.assignedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-text-muted">
                        {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.solved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {a.solved ? t('reports.solved') : t('reports.unsolved')}
                        </span>
                      </td>
                      <td className="py-3 px-3">{a.tries}</td>
                      <td className="py-3 px-3">{(a.timeMs / 1000).toFixed(1)}s</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: QUIZ */}
        {activeTab === 'quizzes' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-text-muted/20 text-xs font-semibold uppercase text-text-muted">
                  <th className="py-2.5 px-3">{t('reports.quizTitle')}</th>
                  <th className="py-2.5 px-3">{t('reports.submittedAt')}</th>
                  <th className="py-2.5 px-3">{t('reports.score')}</th>
                  <th className="py-2.5 px-3">{t('reports.status')}</th>
                  <th className="py-2.5 px-3">{t('reports.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text-muted/10">
                {quizzes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-muted">
                      {t('reports.noData')}
                    </td>
                  </tr>
                ) : (
                  quizzes.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/10">
                      <td className="py-3 px-3 font-medium">{q.title}</td>
                      <td className="py-3 px-3 text-text-muted">
                        {q.submittedAt ? new Date(q.submittedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {q.score} / {q.maxScore}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            q.solved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {q.solved ? t('reports.solved') : t('reports.unsolved')}
                        </span>
                      </td>
                      <td className="py-3 px-3">{(q.timeMs / 1000).toFixed(1)}s</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: CHUYÊN CẦN */}
        {activeTab === 'attendance' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-text-muted/20 text-xs font-semibold uppercase text-text-muted">
                  <th className="py-2.5 px-3">{t('reports.classTitle')}</th>
                  <th className="py-2.5 px-3">{t('reports.classTime')}</th>
                  <th className="py-2.5 px-3">{t('reports.attendanceStatus')}</th>
                  <th className="py-2.5 px-3">{t('reports.note')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text-muted/10">
                {classrooms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-text-muted">
                      {t('reports.noData')}
                    </td>
                  </tr>
                ) : (
                  classrooms.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/10">
                      <td className="py-3 px-3 font-medium">{c.title}</td>
                      <td className="py-3 px-3 text-text-muted">
                        {new Date(c.startsAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.status === 'present'
                              ? 'bg-green-100 text-green-800'
                              : c.status === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t(`reports.${c.status}`)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-text-muted">{c.note || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: VÁN ĐẤU */}
        {activeTab === 'games' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-text-muted/20 text-xs font-semibold uppercase text-text-muted">
                  <th className="py-2.5 px-3">{t('reports.gameDate')}</th>
                  <th className="py-2.5 px-3">{t('reports.opponent')}</th>
                  <th className="py-2.5 px-3">{t('reports.color')}</th>
                  <th className="py-2.5 px-3">{t('reports.speed')}</th>
                  <th className="py-2.5 px-3">{t('reports.result')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text-muted/10">
                {games.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-muted">
                      {t('reports.noData')}
                    </td>
                  </tr>
                ) : (
                  games.map((g) => (
                    <tr key={g.id} className="hover:bg-muted/10">
                      <td className="py-3 px-3 text-text-muted">
                        {new Date(g.playedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-medium">{g.opponent}</td>
                      <td className="py-3 px-3">{t(`reports.${g.color}`)}</td>
                      <td className="py-3 px-3 capitalize">{g.speed}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                            g.won === true
                              ? 'bg-green-100 text-green-800'
                              : g.won === false
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {g.result}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 6: GIẢI ĐẤU */}
        {activeTab === 'tournaments' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-text-muted/20 text-xs font-semibold uppercase text-text-muted">
                  <th className="py-2.5 px-3">{t('reports.tournamentTitle')}</th>
                  <th className="py-2.5 px-3">{t('reports.classTime')}</th>
                  <th className="py-2.5 px-3">{t('reports.rank')}</th>
                  <th className="py-2.5 px-3">{t('reports.points')}</th>
                  <th className="py-2.5 px-3">{t('reports.totalPlayers')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text-muted/10">
                {tournaments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-muted">
                      {t('reports.noData')}
                    </td>
                  </tr>
                ) : (
                  tournaments.map((tr) => (
                    <tr key={tr.id} className="hover:bg-muted/10">
                      <td className="py-3 px-3 font-medium">{tr.title}</td>
                      <td className="py-3 px-3 text-text-muted">
                        {new Date(tr.startsAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-bold">{tr.rank ?? '-'}</td>
                      <td className="py-3 px-3 font-semibold">{tr.points}</td>
                      <td className="py-3 px-3 text-text-muted">{tr.totalPlayers}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
