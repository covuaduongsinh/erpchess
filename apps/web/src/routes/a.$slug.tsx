import { useAcademyPresence, useMyAcademies } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import type { Session } from '@supabase/supabase-js';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
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

  const tabs = [
    { to: '/a/$slug', label: t('academy.overview'), exact: true },
    { to: '/a/$slug/groups', label: t('groups.title'), exact: false },
    { to: '/a/$slug/assignments', label: t('assignments.title'), exact: false },
    { to: '/a/$slug/studies', label: t('studies.title'), exact: false },
    { to: '/a/$slug/courses', label: t('course.title'), exact: false },
    { to: '/a/$slug/certificates', label: t('cert.title'), exact: false },
    { to: '/a/$slug/quizzes', label: t('quiz.title'), exact: false },
    { to: '/a/$slug/classes', label: t('classroom.title'), exact: false },
    { to: '/a/$slug/practice', label: t('practice.title'), exact: false },
    { to: '/a/$slug/play', label: t('play.title'), exact: false },
    { to: '/a/$slug/tournaments', label: t('tournament.title'), exact: false },
    ...(academy.role !== 'coach'
      ? [{ to: '/a/$slug/billing', label: t('bill.title'), exact: false }]
      : []),
    { to: '/a/$slug/chat', label: t('chat.title'), exact: false },
    ...(academy.role !== 'parent'
      ? [{ to: '/a/$slug/database', label: t('database.title'), exact: false }]
      : []),
    { to: '/a/$slug/reports', label: t('reports.navReports'), exact: false },
    ...(academy.role === 'owner'
      ? [{ to: '/a/$slug/notifications', label: t('notify.title'), exact: false }]
      : []),
    ...(academy.role === 'owner' || (academy.role === 'coach' && academy.leads_enabled)
      ? [{ to: '/a/$slug/leads', label: t('lead.title'), exact: false }]
      : []),
    ...(isStaff(academy.role)
      ? [
          { to: '/a/$slug/calendar', label: t('calendar.title'), exact: false },
          { to: '/a/$slug/students', label: t('students.title'), exact: false },
          { to: '/a/$slug/levels', label: t('levels.title'), exact: false },
          { to: '/a/$slug/locations', label: t('location.title'), exact: false },
        ]
      : []),
  ] as const;

  return (
    <AcademyContext value={{ academy, session, online }}>
      {/* `contents` để không đổi bố cục, chỉ truyền biến màu thương hiệu xuống các trang con */}
      <div className="contents" style={academyBrandStyle(academy.brand_color)}>
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-primary">
            {academy.logo_url && (
              <img src={academy.logo_url} alt="" className="size-10 rounded-md object-contain" />
            )}
            {academy.name}
          </h1>
          <p className="text-sm text-text-muted">{t(`role.${academy.role}`)}</p>
        </div>
        <nav className="flex gap-1 border-b border-text-muted/20">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ slug }}
              activeOptions={{ exact: tab.exact }}
              className="-mb-px border-b-2 border-transparent px-4 py-2 text-text-muted data-[status=active]:border-primary data-[status=active]:font-medium data-[status=active]:text-primary"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </AcademyContext>
  );
}
