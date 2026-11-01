import { useStudentReportDetails, useStudentReportSummary } from '@erpchess/api/react';
import { type MemberFide, studentDetailedReportToCsv } from '@erpchess/domain';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { downloadCsv } from '../../lib/download';
import { fideParts } from '../../lib/fide-text';
import { useT } from '../../lib/use-t';
import { Button, ErrorText, Spinner } from '../ui';
import { PrintableReportCard } from './PrintableReportCard';
import { SingleStudentReportView, type Tab } from './ReportViews';
import type { ReportFilter } from './useReportRange';

/**
 * Báo cáo chi tiết của một học viên (cột phải của trang Báo cáo): các khối GĐ22b, nút In phiếu,
 * nút Xuất CSV của học viên. `onBack` (chỉ có trên màn hẹp) quay về danh sách học viên.
 */
export function StudentReportPane({
  academy,
  studentId,
  filter,
  periodLabel,
  levelName,
  batchName,
  fide,
  signerName,
  onBack,
}: {
  academy: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    address?: string;
    phone?: string;
  };
  studentId: string;
  filter: ReportFilter;
  periodLabel: string | undefined;
  levelName: string | undefined;
  batchName: string | undefined;
  /** FIDE của học viên; chỉ truyền khi học viện bật FIDE và học viên có dữ liệu. */
  fide?: MemberFide;
  /** Tên HLV ký phiếu; học viên/phụ huynh tự xem thì không truyền. */
  signerName: string | undefined;
  onBack?: () => void;
}) {
  const { t } = useT();
  const summary = useStudentReportSummary(academy.id, studentId, filter);
  const details = useStudentReportDetails(academy.id, studentId, filter);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showPrint, setShowPrint] = useState(false);
  const fideText = fideParts(fide, {
    id: t('fide.idInline'),
    standard: t('fide.standardShort'),
    rapid: t('fide.rapidShort'),
    blitz: t('fide.blitzShort'),
  });
  const pending = summary.isPending || details.isPending;
  const error = summary.error || details.error;

  function exportCsv() {
    if (!details.data) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `bao-cao-${details.data.student.username}-${dateStr}.csv`,
      studentDetailedReportToCsv(details.data),
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="lg:hidden" icon={ArrowLeft}>
            {t('reports.backToList')}
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {details.data && (
            <Button variant="ghost" icon={Printer} onClick={() => setShowPrint(true)}>
              {t('reports.printReport')}
            </Button>
          )}
          <Button icon={Download} onClick={exportCsv} disabled={pending || !!error}>
            {t('reports.exportCsv')}
          </Button>
        </div>
      </div>
      {fideText && <p className="text-sm text-text-muted">{t('fide.line', { parts: fideText })}</p>}
      {pending && <Spinner />}
      {error && <ErrorText error={error} />}
      {!pending && !error && details.data && (
        <SingleStudentReportView
          report={details.data}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
      {showPrint && details.data && (
        <PrintableReportCard
          report={details.data}
          academy={{
            name: academy.name,
            logoUrl: academy.logoUrl,
            address: academy.address,
            phone: academy.phone,
          }}
          levelName={levelName}
          batchName={batchName}
          fide={fide}
          periodLabel={periodLabel}
          signerName={signerName}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}
