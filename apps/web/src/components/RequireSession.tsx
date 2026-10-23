import { useSession } from '@erpchess/api/react';
import type { Session } from '@supabase/supabase-js';
import { Navigate, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Spinner } from './ui';

/** Chưa đăng nhập thì chuyển sang /login, kèm đường dẫn để quay lại sau khi đăng nhập. */
export function RequireSession({ children }: { children: (session: Session) => ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" search={{ redirect: location.href }} />;
  return <>{children(session)}</>;
}
