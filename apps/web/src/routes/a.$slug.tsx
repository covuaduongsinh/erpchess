import { useAcademyPresence, useMyAcademies } from '@erpchess/api/react';
import type { Session } from '@supabase/supabase-js';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RequireSession } from '../components/RequireSession';
import { ErrorText, Spinner } from '../components/ui';
import { academyBrandStyle, useAcademyFavicon } from '../lib/academy-branding';
import { AcademyContext } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug')({
  component: () => (
    <RequireSession>{(session) => <AcademyLayout session={session} />}</RequireSession>
  ),
});

function AcademyLayout({ session }: { session: Session }) {
  const { t } = useT();
  const { slug } = Route.useParams();
  const academies = useMyAcademies(session.user.id);
  const current = academies.data?.find((a) => a.slug === slug);
  // Mở bất kỳ trang nào của học viện là báo mình đang online
  const online = useAcademyPresence(current?.id, {
    userId: session.user.id,
    name: String(session.user.user_metadata?.display_name ?? ''),
    role: current?.role ?? '',
  });
  useAcademyFavicon(current?.favicon_url);

  if (academies.isPending) return <Spinner />;
  if (academies.error) return <ErrorText error={academies.error} />;

  const academy = academies.data.find((a) => a.slug === slug);
  if (!academy) return <p className="text-text-muted">{t('academy.none')}</p>;

  return (
    <AcademyContext value={{ academy, session, online }}>
      {/* `contents` để không đổi bố cục, chỉ truyền biến màu thương hiệu xuống các trang con */}
      <div className="contents" style={academyBrandStyle(academy.brand_color)}>
        <Outlet />
      </div>
    </AcademyContext>
  );
}
