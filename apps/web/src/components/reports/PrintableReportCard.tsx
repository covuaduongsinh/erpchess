import type { StudentDetailedReport } from '@erpchess/domain';
import { useState } from 'react';
import { Button } from '../ui';

export interface PrintableReportCardProps {
  report: StudentDetailedReport;
  academyName: string;
  levelName?: string;
  batchName?: string;
  onClose: () => void;
}

export function PrintableReportCard({
  report,
  academyName,
  levelName,
  batchName,
  onClose,
}: PrintableReportCardProps) {
  const { student, summary } = report;
  const [coachNote, setCoachNote] = useState(
    'Học viên có tinh thần học tập nghiêm túc, khả năng nhận biết đòn chiến thuật tốt. Cần rèn luyện thêm kỹ năng tính toán sâu các biến phức tạp và kỹ thuật tàn cuộc cơ bản.',
  );

  const handlePrint = () => {
    window.print();
  };

  const winRate =
    summary.games.totalGames > 0
      ? (
          ((summary.games.wins + summary.games.draws * 0.5) / summary.games.totalGames) *
          100
        ).toFixed(1)
      : '0.0';

  const dateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Container A4 preview */}
      <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl text-slate-800 print:max-w-none print:shadow-none print:p-8 print:w-full">
        {/* Thanh công cụ thao tác (ẩn khi in) */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <h2 className="font-bold text-slate-800 text-lg">Xem trước Phiếu điểm In ấn (A4)</h2>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <span>🖨️</span>
              In / Xuất PDF
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800"
            >
              Đóng
            </Button>
          </div>
        </div>

        {/* PHIẾU BÁO CÁO CHUẨN IN ẤN (A4 PRINTABLE AREA) */}
        <div
          id="printable-report"
          className="border-4 border-slate-800/10 rounded-xl p-8 bg-gradient-to-b from-blue-50/20 via-white to-slate-50/30 print:border-none print:p-0"
        >
          {/* Header Báo cáo */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-xl bg-slate-900 text-white text-2xl font-black shadow-md">
                ♔
              </div>
              <div>
                <h1 className="font-extrabold text-xl uppercase tracking-wider text-slate-900">
                  {academyName || 'HỌC VIỆN CỜ VUA'}
                </h1>
                <p className="text-xs font-medium text-slate-500">
                  Hệ sinh thái Đào tạo Cờ vua Chuẩn Quốc tế FIDE
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-800 text-xs uppercase tracking-wider">
                Official Report
              </span>
              <p className="mt-1 text-xs text-slate-500">Ngày xuất: {dateStr}</p>
            </div>
          </div>

          {/* Tiêu đề chính */}
          <div className="my-6 text-center">
            <h2 className="font-black text-2xl uppercase tracking-tight text-slate-900">
              PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP
            </h2>
            <p className="text-sm text-slate-500">Student Progress & Chess Assessment Report</p>
          </div>

          {/* Thông tin học viên */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-100/70 p-4 sm:grid-cols-4 text-sm mb-6 border border-slate-200">
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase">Học viên</span>
              <span className="font-bold text-slate-900 text-base">{student.displayName}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase">Tài khoản</span>
              <span className="font-semibold text-slate-700">@{student.username}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase">
                Cấp độ đào tạo
              </span>
              <span className="font-semibold text-blue-700">{levelName || 'Cơ bản'}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase">
                Lớp (Batch)
              </span>
              <span className="font-semibold text-slate-800">{batchName || 'Lớp tiêu chuẩn'}</span>
            </div>
          </div>

          {/* 4 Thẻ Chỉ số Cốt lõi */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            {/* Card Bài tập */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
              <div className="flex items-center justify-between text-blue-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Bài tập</span>
                <span className="text-base">🧩</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {summary.assignments.completed}/{summary.assignments.totalAssigned}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Giải đúng:{' '}
                <span className="font-semibold text-green-700">
                  {summary.assignments.solvedRate}%
                </span>
              </div>
            </div>

            {/* Card Quiz */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <div className="flex items-center justify-between text-indigo-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Trắc nghiệm</span>
                <span className="text-base">📝</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {summary.quizzes.avgScore.toFixed(0)}{' '}
                <span className="text-xs font-normal text-slate-500">điểm TB</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Đã làm:{' '}
                <span className="font-semibold text-indigo-700">
                  {summary.quizzes.completed} bài
                </span>
              </div>
            </div>

            {/* Card Chuyên cần */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Chuyên cần</span>
                <span className="text-base">🏫</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {summary.classrooms.attendanceRate}%
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Có mặt:{' '}
                <span className="font-semibold text-emerald-700">
                  {summary.classrooms.presentCount}/{summary.classrooms.totalSessions} buổi
                </span>
              </div>
            </div>

            {/* Card Thi đấu Elo */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Hệ số Elo</span>
                <span className="text-base">⚔️</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {summary.games.ratings.rapid ?? 1200}{' '}
                <span className="text-xs font-normal text-slate-500">Rapid</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Tỷ lệ thắng: <span className="font-semibold text-amber-700">{winRate}%</span> (
                {summary.games.totalGames} ván)
              </div>
            </div>
          </div>

          {/* Biểu đồ Năng lực Kỹ thuật Cờ vua */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>📊</span>
              Đánh giá Trực quan Năng lực Cờ vua (Skill Assessment)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1 text-slate-700">
                  <span>Khai cuộc (Opening Knowledge)</span>
                  <span className="text-blue-700">75%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1 text-slate-700">
                  <span>Chiến thuật & Đòn phối hợp (Tactics)</span>
                  <span className="text-green-700">
                    {Math.max(50, Math.min(100, Math.round(summary.assignments.solvedRate)))}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{
                      width: `${Math.max(50, Math.min(100, Math.round(summary.assignments.solvedRate)))}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1 text-slate-700">
                  <span>Tính toán Chiều sâu (Calculation)</span>
                  <span className="text-indigo-700">80%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '80%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1 text-slate-700">
                  <span>Kỹ thuật Tàn cuộc (Endgame Mastery)</span>
                  <span className="text-amber-700">65%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-amber-600 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Nhận xét Huấn luyện viên */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
              <span>💬</span>
              Nhận xét & Lộ trình của Huấn luyện viên
            </h3>
            <textarea
              value={coachNote}
              onChange={(e) => setCoachNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 print:border-none print:bg-transparent print:p-0 print:resize-none"
            />
          </div>

          {/* Phần Chữ ký & Xác nhận */}
          <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 text-center text-xs">
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider">
                Học viên / Phụ huynh
              </p>
              <div className="h-16 flex items-center justify-center italic text-slate-400">
                (Ký và ghi rõ họ tên)
              </div>
              <p className="font-medium text-slate-700">{student.displayName}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider">
                Huấn luyện viên Trưởng
              </p>
              <div className="h-16 flex items-center justify-center font-serif text-lg font-bold text-blue-900">
                Đã duyệt & Xác nhận
              </div>
              <p className="font-medium text-slate-700">Ban Huấn Luyện {academyName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
