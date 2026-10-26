import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/telemetry';
import { Button, Card } from './ui';

export interface AppErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(error, {
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = (): void => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <Card
            title="Đã xảy ra sự cố không mong muốn"
            className="max-w-md w-full border border-red-200"
          >
            <p className="text-sm text-text-muted">
              Ứng dụng gặp lỗi trong quá trình xử lý. Đội ngũ kỹ thuật đã được thông báo để khắc
              phục sự cố.
            </p>

            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <pre className="max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs text-red-600">
                {this.state.error.message}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
              </pre>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="primary" onClick={this.handleReset}>
                Thử lại
              </Button>
              <Button variant="cta" onClick={this.handleReload}>
                Tải lại trang
              </Button>
              <Button variant="ghost" onClick={this.handleGoHome}>
                Về trang chủ
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
