import { createFileRoute } from '@tanstack/react-router';
import { Palette } from 'lucide-react';
import { AcademyBoardDefaultsCard } from '../components/academy/AcademyBoardDefaultsCard';
import { BrandingCard } from '../components/academy/BrandingCard';
import { PageHeader } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/settings')({
  component: SettingsPage,
});

/** Quản trị → Học viện → Thông tin & Branding: gom các thẻ cấu hình học viện (chỉ chủ học viện). */
function SettingsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  if (academy.role !== 'owner') return <p className="text-text-muted">{t('settings.ownerOnly')}</p>;
  return (
    <>
      <PageHeader icon={Palette} title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <BrandingCard />
        <AcademyBoardDefaultsCard />
      </div>
    </>
  );
}
