import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportError, reportEvent } from './telemetry';

describe('telemetry', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { Sentry?: unknown }).Sentry;
  });

  it('ghi nhận lỗi từ Error object đúng cấu trúc', () => {
    const error = new Error('Test runtime failure');
    const report = reportError(error, { screen: 'lesson' });

    expect(report.message).toBe('Test runtime failure');
    expect(report.stack).toBeDefined();
    expect(report.context).toEqual({ screen: 'lesson' });
    expect(report.timestamp).toBeTypeOf('string');
  });

  it('ghi nhận lỗi từ non-Error object đúng cấu trúc', () => {
    const report = reportError('Chuỗi lỗi bất thường');
    expect(report.message).toBe('Chuỗi lỗi bất thường');
    expect(report.stack).toBeUndefined();
  });

  it('gọi Sentry.captureException nếu window.Sentry tồn tại', () => {
    const captureException = vi.fn();
    window.Sentry = {
      captureException,
      captureMessage: vi.fn(),
    };

    const error = new Error('Crash');
    reportError(error, { foo: 'bar' });

    expect(captureException).toHaveBeenCalledWith(error, { extra: { foo: 'bar' } });
  });

  it('ghi nhận sự kiện telemetry thành công', () => {
    const event = reportEvent('lesson_started', { lessonId: '123' });

    expect(event.name).toBe('lesson_started');
    expect(event.data).toEqual({ lessonId: '123' });
    expect(event.timestamp).toBeTypeOf('string');
  });

  it('gọi Sentry.captureMessage khi reportEvent', () => {
    const captureMessage = vi.fn();
    window.Sentry = {
      captureException: vi.fn(),
      captureMessage,
    };

    reportEvent('board_flipped');
    expect(captureMessage).toHaveBeenCalledWith('[Event] board_flipped');
  });
});
