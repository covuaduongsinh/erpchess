import type {
  AcademyStudentSummary,
  StudentDetailedReport,
  StudentReportSummary,
} from '@erpchess/domain';
import type { ErpClient } from './client';
import { unwrap } from './queries';

export type ReportDateFilter = {
  from?: string;
  to?: string;
};

/** Lấy chỉ số KPI tổng quan của học viên */
export async function getStudentReportSummary(
  client: ErpClient,
  academyId: string,
  studentId: string,
  filter?: ReportDateFilter,
): Promise<StudentReportSummary> {
  const data = unwrap(
    await client.rpc('get_student_report_summary', {
      p_academy_id: academyId,
      p_student_id: studentId,
      p_from: filter?.from ?? null,
      p_to: filter?.to ?? null,
    }),
  );
  return data as unknown as StudentReportSummary;
}

/** Lấy chi tiết báo cáo học viên (bài tập, quiz, chuyên cần, ván cờ, giải đấu) */
export async function getStudentReportDetails(
  client: ErpClient,
  academyId: string,
  studentId: string,
  filter?: ReportDateFilter,
): Promise<StudentDetailedReport> {
  const data = unwrap(
    await client.rpc('get_student_report_details', {
      p_academy_id: academyId,
      p_student_id: studentId,
      p_from: filter?.from ?? null,
      p_to: filter?.to ?? null,
    }),
  );
  return data as unknown as StudentDetailedReport;
}

/** Lấy danh sách báo cáo tóm tắt của tất cả học viên trong học viện (dành cho quản lý) */
export async function getAcademyStudentsReport(
  client: ErpClient,
  academyId: string,
  filter?: ReportDateFilter,
): Promise<AcademyStudentSummary[]> {
  const data = unwrap(
    await client.rpc('get_academy_students_report', {
      p_academy_id: academyId,
      p_from: filter?.from ?? null,
      p_to: filter?.to ?? null,
    }),
  );
  return (data as unknown as AcademyStudentSummary[]) ?? [];
}
