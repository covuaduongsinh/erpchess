import { certificateVerifyUrl, formatCertificateCode } from '@erpchess/api';
import { useCertificate, useCertificateMutations } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDate } from '../lib/format';
import { useT } from '../lib/use-t';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:3000';

export const Route = createFileRoute('/a/$slug/certificates/$id')({
  component: CertificatePage,
});

/** Chứng chỉ in được (A4 ngang) theo nhận diện Dương Sinh, có mã QR trỏ tới trang xác minh. */
function CertificatePage() {
  const { t, i18n } = useT();
  const { id } = Route.useParams();
  const { academy } = useAcademy();
  const cert = useCertificate(id);
  const { revoke } = useCertificateMutations(academy.id);
  const [confirm, setConfirm] = useState(false);
  const [qr, setQr] = useState<string>();
  const url = cert.data ? certificateVerifyUrl(SITE_URL, cert.data.code) : '';

  useEffect(() => {
    if (!url) return;
    let alive = true;
    void QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#2B3990' } }).then(
      (d) => alive && setQr(d),
    );
    return () => {
      alive = false;
    };
  }, [url]);

  if (cert.isPending) return <Spinner />;
  if (cert.error) return <ErrorText error={cert.error} />;
  const c = cert.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/a/$slug/certificates"
          params={{ slug: academy.slug }}
          className="text-sm text-primary hover:underline"
        >
          ← {t('cert.title')}
        </Link>
        <Button variant="cta" className="ml-auto" onClick={() => window.print()}>
          {t('cert.print')}
        </Button>
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
          {t('cert.verifyPage')}
        </a>
        {isStaff(academy.role) && !c.revoked_at && (
          <Button
            variant="ghost"
            disabled={revoke.isPending}
            onClick={() => (confirm ? revoke.mutate(c.id) : setConfirm(true))}
          >
            {confirm ? t('cert.confirmRevoke') : t('cert.revoke')}
          </Button>
        )}
      </div>
      <ErrorText error={revoke.error} />

      <style>{'@media print { @page { size: A4 landscape; margin: 0; } }'}</style>
      <div className="overflow-x-auto">
        <article className="certificate-print relative mx-auto flex h-[679px] w-[960px] shrink-0 flex-col items-center overflow-hidden bg-white p-10 text-center font-sans text-text print:h-[210mm] print:w-[297mm]">
          <div aria-hidden className="chess-pattern absolute inset-0 opacity-[0.05]" />
          <div className="absolute inset-4 border-4 border-primary" />
          <div className="absolute inset-7 border border-primary/40" />
          <div aria-hidden className="chess-pattern absolute top-4 left-4 size-24 opacity-80" />
          <div aria-hidden className="chess-pattern absolute top-4 right-4 size-24 opacity-80" />

          <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-16">
            <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
              {c.academy_name}
            </p>
            <h1 className="text-6xl font-black tracking-[0.08em] text-primary uppercase">
              {t('cert.heading')}
            </h1>
            <p className="text-lg text-text-muted">{t('cert.awardedTo')}</p>
            <p className="border-b-2 border-orange px-8 pb-2 text-5xl font-bold text-text">
              {c.student_name}
            </p>
            {c.course_id && <p className="text-lg text-text-muted">{t('cert.forCompleting')}</p>}
            <p className="max-w-[720px] text-3xl font-medium text-primary">{c.title}</p>
            <p className="text-base text-text-muted">
              {t('cert.issuedOn', { date: formatDate(c.issued_at, i18n.language) })}
            </p>
          </div>

          <div className="relative flex w-full items-end justify-between px-10">
            <div className="text-left">
              <p className="text-xl font-bold text-primary">{t('app.name')}</p>
              <p className="text-xs tracking-[0.05em] text-text-muted uppercase">
                {t('app.slogan')}
              </p>
            </div>
            <div className="flex items-end gap-3 text-right">
              <div className="flex flex-col text-xs text-text-muted">
                <span>{t('cert.verifyAt')}</span>
                <span className="font-mono text-base font-bold tracking-wider text-primary">
                  {formatCertificateCode(c.code)}
                </span>
              </div>
              {qr && <img src={qr} alt={url} className="size-24" />}
            </div>
          </div>

          {c.revoked_at && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 rounded-md border-8 border-orange px-8 py-2 text-6xl font-black text-orange uppercase opacity-80">
                {t('cert.revoked')}
              </span>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
