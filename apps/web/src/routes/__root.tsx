import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Shell } from '../components/Shell';

export const Route = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});
