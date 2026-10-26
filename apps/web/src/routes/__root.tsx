import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { Shell } from '../components/Shell';

export const Route = createRootRoute({
  component: () => (
    <AppErrorBoundary>
      <Shell>
        <Outlet />
      </Shell>
    </AppErrorBoundary>
  ),
});
