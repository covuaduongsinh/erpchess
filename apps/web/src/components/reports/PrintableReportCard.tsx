import type { StudentDetailedReport } from '@erpchess/domain';
import { type ReactNode, useState } from 'react';
import { formatDate } from '../../lib/format';
import { useT } from '../../lib/use-t';
import { Button } from '../ui';

/** Thông tin học viện in ở đầu phiếu (white-label, Giai đoạn 22a/22b). */
export type ReportAcademy = {
  name: string;
  logoUrl?: string | null;
  address?: string;
  phone?: string;
};

export interface PrintableReportCardProps {
  report: StudentDetailedReport;
  academy: ReportAcademy;
  levelName?: string;
  batchName?: string;
  /** Khoảng thời gian của báo cáo, vd. "Tháng này". */
  periodLabel?: string;
  /** Tên HLV ký phiếu (người đang xem nếu là staff). */
  signerName?: string;
  onClose: () => void;
}

const MAX_ROWS = { assignments: 8, quizzes: 5, classrooms: 8, games: 6, tournaments: 3 } as const;

/** Tên tệp gợi ý khi lưu PDF: trình duyệt lấy theo tiêu đề trang. */
export function reportFileTitle(username: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `phieu-bao-cao-${username}-${day}`;
}

/**
 * Phiếu báo cáo học viên khổ A4 (Giai đoạn 18b, làm lại ở 22b): chỉ dùng số liệu thật của học viên.
 * "Xuất PDF" dùng hộp thoại in của trình duyệt (chọn "Lưu dưới dạng PDF").
 */
export function PrintableReportCard({
  report,
  academy,
  levelName,
  batchName,
  periodLabel,
  signerName,
  onClose,
}: PrintableReportCardProps) {
  const { t, i18n } = useT();
  const { student, summary } = report;
  const [coachNote, setCoachNote] = useState('');
  const date = (iso: string) => formatDate(iso, i18n.language);

  const handlePrint = () => {
    // Đặt tiêu đề trang thành tên tệp gợi ý, trả lại sau khi in xong
    const previous = document.title;
    document.title = reportFileTitle(student.username);
    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const { games } = summary;
  const scoreRate =
    games.totalGames > 0
      ? (((games.wins + games.draws * 0.5) / games.totalGames) * 100).toFixed(1)
      : '0.0';
  const rating = games.ratings.rapid ?? games.ratings.blitz ?? games.ratings.classical;
  const contactLine = [academy.address, academy.phone].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs print:static print:inset-auto print:bg-white print:p-0">
      <style>{'@media print { @page { size: A4 portrait; margin: 12mm; } }'}</style>
      <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 text-slate-800 shadow-2xl print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-slate-800">{t('reports.printPreview')}</h2>
            <p className="text-xs text-text-muted">{t('reports.printHint')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="cta" onClick={handlePrint}>
              {t('reports.printPdf')}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t('reports.printClose')}
            </Button>
          </div>
        </div>

        <article id="printable-report" className="report-print flex flex-col gap-5 bg-white">
          <header className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              {academy.logoUrl ? (
                <img src={academy.logoUrl} alt="" className="size-14 rounded-lg object-contain" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-lg bg-primary text-2xl font-black text-text-on-primary">
                  ♔
                </div>
              )}
              <div>
                <h1 className="text-xl font-extrabold tracking-wide text-slate-900 uppercase">
                  {academy.name}
                </h1>
                {contactLine && <p className="text-xs text-slate-500">{contactLine}</p>}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>
                {t('reports.printIssued')}: {date(new Date().toISOString())}
              </p>
              {periodLabel && (
                <p>
                  {t('reports.dateRange')}: {periodLabel}
                </p>
              )}
            </div>
          </header>

          <h2 className="text-center text-2xl font-black tracking-tight text-slate-900 uppercase">
            {t('reports.printTitle')}
          </h2>

          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-4">
            <Info label={t('reports.colStudent')} value={student.displayName} strong />
            <Info label={t('reports.printAccount')} value={`@${student.username}`} />
            <Info label={t('reports.colLevel')} value={levelName || '—'} />
            <Info label={t('reports.printBatch')} value={batchName || '—'} />
          </dl>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label={t('reports.tabAssignments')}
              value={`${summary.assignments.completed}/${summary.assignments.totalAssigned}`}
              sub={`${t('reports.printSolvedRate')}: ${summary.assignments.solvedRate}%`}
            />
            <Metric
              label={t('reports.tabQuizzes')}
              value={summary.quizzes.avgScore.toFixed(0)}
              sub={`${t('reports.printDone')}: ${summary.quizzes.completed}/${summary.quizzes.totalAssigned}`}
            />
            <Metric
              label={t('reports.tabAttendance')}
              value={`${summary.classrooms.attendanceRate}%`}
              sub={`${summary.classrooms.presentCount}/${summary.classrooms.totalSessions}`}
            />
            <Metric
              label={t('reports.tabGames')}
              value={rating ? String(rating) : '—'}
              sub={`${t('reports.printScoreRate')}: ${scoreRate}% (${games.totalGames})`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <Section title={t('reports.tabAssignments')} empty={report.assignments.length === 0}>
              {report.assignments.slice(0, MAX_ROWS.assignments).map((a) => (
                <Row key={a.id} left={a.title} right={a.solved ? '✓' : '✗'} />
              ))}
            </Section>
            <Section title={t('reports.tabQuizzes')} empty={report.quizzes.length === 0}>
              {report.quizzes.slice(0, MAX_ROWS.quizzes).map((q) => (
                <Row key={q.id} left={q.title} right={`${q.score}/${q.maxScore}`} />
              ))}
            </Section>
            <Section title={t('reports.tabAttendance')} empty={report.classrooms.length === 0}>
              {report.classrooms.slice(0, MAX_ROWS.classrooms).map((c) => (
                <Row
                  key={c.id}
                  left={`${date(c.startsAt)} · ${c.title}`}
                  right={t(`reports.printStatus_${c.status}`)}
                />
              ))}
            </Section>
            <Section title={t('reports.tabGames')} empty={report.games.length === 0}>
              {report.games.slice(0, MAX_ROWS.games).map((g) => (
                <Row
                  key={g.id}
                  left={`${date(g.playedAt)} · ${g.color === 'white' ? '♔' : '♚'} ${g.opponent}`}
                  right={g.result}
                />
              ))}
            </Section>
            {report.tournaments.length > 0 && (
              <Section title={t('reports.tabTournaments')} empty={false}>
                {report.tournaments.slice(0, MAX_ROWS.tournaments).map((tr) => (
                  <Row
                    key={tr.id}
                    left={tr.title}
                    right={
                      tr.rank ? `#${tr.rank}/${tr.totalPlayers} · ${tr.points}` : String(tr.points)
                    }
                  />
                ))}
              </Section>
            )}
          </div>

          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-2 text-sm font-bold tracking-wider text-slate-900 uppercase">
              {t('reports.printCoachNote')}
            </h3>
            <textarea
              value={coachNote}
              onChange={(e) => setCoachNote(e.target.value)}
              rows={3}
              placeholder={t('reports.printCoachNotePlaceholder')}
              aria-label={t('reports.printCoachNote')}
              className="w-full rounded-md border border-slate-200 p-2 text-sm print:hidden"
            />
            {/* Bản in: nhận xét đã gõ, hoặc dòng kẻ để HLV viết tay */}
            <div className="hidden text-sm whitespace-pre-wrap print:block">
              {coachNote || (
                <div className="flex flex-col gap-6 pt-4">
                  <span className="border-b border-dotted border-slate-400" />
                  <span className="border-b border-dotted border-slate-400" />
                  <span className="border-b border-dotted border-slate-400" />
                </div>
              )}
            </div>
          </section>

          <footer className="grid grid-cols-2 pt-2 text-center text-xs">
            <div>
              <p className="font-semibold tracking-wider text-slate-500 uppercase">
                {t('reports.printSignStudent')}
              </p>
              <div className="h-16" />
              <p className="font-medium text-slate-700">{student.displayName}</p>
            </div>
            <div>
              <p className="font-semibold tracking-wider text-slate-500 uppercase">
                {t('reports.printSignCoach')}
              </p>
              <div className="h-16" />
              <p className="font-medium text-slate-700">{signerName || academy.name}</p>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 uppercase">{label}</dt>
      <dd className={strong ? 'text-base font-bold text-slate-900' : 'font-semibold'}>{value}</dd>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-bold tracking-wider text-primary uppercase">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs text-slate-600">{sub}</p>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <section className="rounded-lg border border-slate-200 p-3 break-inside-avoid">
      <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-900 uppercase">{title}</h3>
      {empty ? (
        <p className="text-xs text-slate-400">{t('reports.printNoData')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 text-xs">{children}</ul>
      )}
    </section>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <li className="flex justify-between gap-2 py-1">
      <span className="truncate">{left}</span>
      <span className="shrink-0 font-semibold">{right}</span>
    </li>
  );
}
