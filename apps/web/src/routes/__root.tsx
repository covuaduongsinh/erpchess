import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { NotFound } from '../components/NotFound';

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  component: () => (
    <AppErrorBoundary>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AppErrorBoundary>
  ),
});
