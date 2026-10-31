import { useLoginBranding } from '@erpchess/api/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LoginForm } from '../components/auth/LoginForm';
import { Spinner } from '../components/ui';
import { academyBrandStyle, useAcademyFavicon } from '../lib/academy-branding';
import { useT } from '../lib/use-t';

/**
 * Trang đăng nhập riêng của học viện (Giai đoạn 23d, đặc tả REA: Branding → Login Page): logo,
 * ảnh nền, giới thiệu, các mục nội dung, màu thương hiệu và favicon của học viện. Mặc định mở tab
 * học viên (username + PIN) và đăng nhập xong vào thẳng học viện.
 */
export const Route = createFileRoute('/login_/$slug')({
  component: AcademyLoginPage,
});

function AcademyLoginPage() {
  const { t } = useT();
  const { slug } = Route.useParams();
  const branding = useLoginBranding(slug);
  const b = branding.data;
  useAcademyFavicon(b?.faviconUrl);

  if (branding.isPending) return <Spinner />;
  if (!b) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <p className="text-text-muted">{t('loginPage.notFound')}</p>
        <LoginForm />
      </div>
    );
  }

  return (
    <div
      style={academyBrandStyle(b.brandColor)}
      className="grid overflow-hidden rounded-xl bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_420px]"
    >
      <section
        className="relative flex min-h-64 flex-col justify-end gap-4 bg-primary p-8 text-text-on-primary"
        style={
          b.backgroundUrl
            ? {
                backgroundImage: `linear-gradient(to top, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0.15)), url("${b.backgroundUrl}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#ffffff',
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3">
          {b.logoUrl && (
            <img
              src={b.logoUrl}
              alt=""
              className="size-14 rounded-lg bg-white object-contain p-1"
            />
          )}
          <h1 className="text-3xl font-bold">{b.name}</h1>
        </div>
        {b.description && <p className="max-w-xl whitespace-pre-line text-sm">{b.description}</p>}
        {b.sections.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {b.sections.map((s) => (
              <div key={s.title} className="rounded-lg bg-white/15 p-3 backdrop-blur-xs">
                <h2 className="font-semibold">{s.title}</h2>
                {s.body && <p className="whitespace-pre-line text-sm opacity-90">{s.body}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="flex flex-col justify-center gap-3 p-6">
        <LoginForm redirect={`/a/${b.slug}`} defaultMode="student" showSignUp={false} />
        <p className="text-center text-xs text-text-muted">
          {t('loginPage.poweredBy')}{' '}
          <Link to="/login" className="underline">
            {t('app.name')}
          </Link>
        </p>
      </div>
    </div>
  );
}
