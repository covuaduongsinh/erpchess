import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';

export const Route = createRootRoute({
  component: () => (
    <AppErrorBoundary>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AppErrorBoundary>
  ),
});
