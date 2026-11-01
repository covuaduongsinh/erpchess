import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Palette } from 'lucide-react';
import { AcademyBoardDefaultsCard } from '../components/academy/AcademyBoardDefaultsCard';
import { BrandingCard } from '../components/academy/BrandingCard';
import { PageHeader, Tabs } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

const TABS = ['info', 'brand', 'login', 'board'] as const;
type SettingsTab = (typeof TABS)[number];

export const Route = createFileRoute('/a/$slug/settings')({
  // `tab`: mở sẵn một nhóm cấu hình (chia sẻ được qua link); giá trị lạ thì về tab đầu
  validateSearch: (s: Record<string, unknown>): { tab?: SettingsTab } =>
    typeof s.tab === 'string' && (TABS as readonly string[]).includes(s.tab)
      ? { tab: s.tab as SettingsTab }
      : {},
  component: SettingsPage,
});

/** Quản trị → Học viện → Thông tin & Branding: các nhóm cấu hình học viện chia tab (chỉ chủ học viện). */
function SettingsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const { tab = 'info' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  if (academy.role !== 'owner') return <p className="text-text-muted">{t('settings.ownerOnly')}</p>;
  return (
    <>
      <PageHeader icon={Palette} title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Tabs
        variant="underline"
        ariaLabel={t('settings.tabsLabel')}
        value={tab}
        onChange={(next) =>
          void navigate({ search: { tab: next === 'info' ? undefined : next }, replace: true })
        }
        items={[
          { value: 'info', label: t('settings.tabInfo') },
          { value: 'brand', label: t('settings.tabBrand') },
          { value: 'login', label: t('settings.tabLogin') },
          { value: 'board', label: t('settings.tabBoard') },
        ]}
      />
      {/* Thẻ thương hiệu luôn gắn sẵn (ẩn ở tab Bàn cờ) để đổi tab không mất phần đang nhập dở */}
      <div hidden={tab === 'board'}>
        <BrandingCard section={tab === 'board' ? 'info' : tab} />
      </div>
      {tab === 'board' && <AcademyBoardDefaultsCard />}
    </>
  );
}
