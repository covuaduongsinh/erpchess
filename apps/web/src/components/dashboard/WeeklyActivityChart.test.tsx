import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { type DayActivity, WeeklyActivityChart } from './WeeklyActivityChart';

const MOCK_DATA: DayActivity[] = [
  { day: 'T2', label: 'Thứ Hai', count: 10 },
  { day: 'T3', label: 'Thứ Ba', count: 20 },
  { day: 'T4', label: 'Thứ Tư', count: 30, isToday: true },
  { day: 'T5', label: 'Thứ Năm', count: 15 },
  { day: 'T6', label: 'Thứ Sáu', count: 25 },
  { day: 'T7', label: 'Thứ Bảy', count: 40 },
  { day: 'CN', label: 'Chủ Nhật', count: 35 },
];

describe('WeeklyActivityChart', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị tiêu đề biểu đồ và tổng số bài', () => {
    render(<WeeklyActivityChart data={MOCK_DATA} totalSolved={175} trendPercent={20} />);
    expect(screen.getByText('Hoạt động giải bài tập trong tuần')).toBeTruthy();
    expect(screen.getByText('175')).toBeTruthy();
    expect(screen.getByText('▲ +20%')).toBeTruthy();
  });

  it('hiển thị đầy đủ 7 ngày trong tuần và số bài tương ứng', () => {
    render(<WeeklyActivityChart data={MOCK_DATA} />);
    for (const d of MOCK_DATA) {
      expect(screen.getAllByText(d.day).length).toBeGreaterThan(0);
      expect(screen.getAllByText(String(d.count)).length).toBeGreaterThan(0);
    }
  });

  it('hiển thị ngày tích cực nhất và trung bình ngày ở footer', () => {
    render(<WeeklyActivityChart data={MOCK_DATA} />);
    expect(screen.getByText('Thứ Bảy')).toBeTruthy();
    expect(screen.getByText('Trung bình:')).toBeTruthy();
  });

  it('không còn dữ liệu mẫu và không có huy hiệu xu hướng khi không truyền trendPercent', () => {
    render(<WeeklyActivityChart data={MOCK_DATA} />);
    expect(screen.queryByText(/[▲▼]/)).toBeNull();
    expect(screen.queryByText('▲ +14.5%')).toBeNull();
  });

  it('xu hướng âm hiện mũi tên xuống; null thì ẩn', () => {
    const { rerender } = render(<WeeklyActivityChart data={MOCK_DATA} trendPercent={-12} />);
    expect(screen.getByText('▼ -12%')).toBeTruthy();
    rerender(<WeeklyActivityChart data={MOCK_DATA} trendPercent={null} />);
    expect(screen.queryByText(/[▲▼]/)).toBeNull();
  });

  it('tiêu đề, chú thích và đơn vị tuỳ biến; khoá cột theo date khi nhãn ngày trùng', () => {
    const rows: DayActivity[] = [
      { day: 'T2', date: '2026-05-04', label: 'Thứ Hai 4/5', count: 3 },
      { day: 'T2', date: '2026-05-11', label: 'Thứ Hai 11/5', count: 5 },
    ];
    render(
      <WeeklyActivityChart data={rows} title="Quiz hoàn thành" subtitle="Mỗi ngày" unit="quiz" />,
    );
    expect(screen.getByText('Quiz hoàn thành')).toBeTruthy();
    expect(screen.getByText('Mỗi ngày')).toBeTruthy();
    expect(screen.getAllByText('T2')).toHaveLength(2);
    expect(screen.getAllByText(/quiz/).length).toBeGreaterThan(0);
  });
});
