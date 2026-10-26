/**
 * Module telemetry và ghi nhận lỗi client cho ERPChess Web App.
 * Tích hợp sẵn sàng cho Sentry hoặc console logger có cấu trúc.
 */

export interface TelemetryEvent {
  name: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// Khai báo kiểu mở rộng cho window trong trường hợp dùng Sentry CDN hoặc SDK
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: unknown, context?: Record<string, unknown>) => void;
      captureMessage: (message: string) => void;
    };
  }
}

/**
 * Ghi nhận ngoại lệ runtime từ ErrorBoundary hoặc các tác vụ bất đồng bộ.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): ErrorReport {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const report: ErrorReport = {
    message,
    stack,
    timestamp: new Date().toISOString(),
    context,
  };

  // Nếu có Sentry SDK trên window
  if (typeof window !== 'undefined' && window.Sentry) {
    try {
      window.Sentry.captureException(error, { extra: context });
    } catch {
      // Bỏ qua lỗi gửi telemetry để không làm crash ứng dụng
    }
  }

  // Luôn log ra console khi ở môi trường phát triển hoặc kiểm thử
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Telemetry Error]', report);
  }

  return report;
}

/**
 * Ghi nhận sự kiện telemetry người dùng (ví dụ: mở trang, bắt đầu trận đấu).
 */
export function reportEvent(name: string, data?: Record<string, unknown>): TelemetryEvent {
  const event: TelemetryEvent = {
    name,
    timestamp: new Date().toISOString(),
    data,
  };

  if (typeof window !== 'undefined' && window.Sentry) {
    try {
      window.Sentry.captureMessage(`[Event] ${name}`);
    } catch {
      // Bỏ qua
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[Telemetry Event]', event);
  }

  return event;
}
