import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as telemetry from '../lib/telemetry';
import { AppErrorBoundary } from './AppErrorBoundary';

function ProblemChild({ shouldThrow }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Cố ý ném ngoại lệ trong test');
  }
  return <div>Nội dung bình thường</div>;
}

let shouldFailDynamic = true;
function DynamicChild() {
  if (shouldFailDynamic) {
    throw new Error('Lỗi động');
  }
  return <div>Đã phục hồi</div>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    shouldFailDynamic = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hiển thị children khi không có lỗi', () => {
    render(
      <AppErrorBoundary>
        <ProblemChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Nội dung bình thường')).toBeTruthy();
  });

  it('bắt ngoại lệ và hiển thị UI thông báo lỗi dự phòng', () => {
    const reportErrorSpy = vi.spyOn(telemetry, 'reportError');

    render(
      <AppErrorBoundary>
        <ProblemChild shouldThrow />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Đã xảy ra sự cố không mong muốn' })).toBeTruthy();
    expect(reportErrorSpy).toHaveBeenCalled();
  });

  it('hiển thị custom fallback nếu được cung cấp', () => {
    render(
      <AppErrorBoundary fallback={<div>Fallback tùy chỉnh</div>}>
        <ProblemChild shouldThrow />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Fallback tùy chỉnh')).toBeTruthy();
  });

  it('nút Thử lại cho phép reset trạng thái lỗi', () => {
    shouldFailDynamic = true;

    render(
      <AppErrorBoundary>
        <DynamicChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Đã xảy ra sự cố không mong muốn' })).toBeTruthy();

    shouldFailDynamic = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(screen.getByText('Đã phục hồi')).toBeTruthy();
  });
});
