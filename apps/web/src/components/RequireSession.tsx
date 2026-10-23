import { useSession } from '@erpchess/api/react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Spinner } from './ui';

/** Chưa đăng nhập thì chuyển sang /login, kèm đường dẫn để quay lại sau khi đăng nhập. */
export function RequireSession({ children }: { children: (session: Session) => ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const navigate = useNavigate();
  // Đọc location một lần, không subscribe: component này còn render trong lúc route /login
  // đang tải, nên mỗi lần location đổi mà điều hướng lại sẽ thành vòng lặp vô hạn.
  const [from] = useState(() => router.state.location.href);
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || session || redirected.current) return;
    redirected.current = true;
    void navigate({
      to: '/login',
      search: { redirect: from.startsWith('/login') ? undefined : from },
      replace: true,
    });
  }, [loading, session, from, navigate]);

  if (loading || !session) return <Spinner />;
  return <>{children(session)}</>;
}
