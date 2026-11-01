import { useMembers, useSetAcademyFideEnabled } from '@erpchess/api/react';
import { hasFide, isStaff, ratingCategories } from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { createFileRoute, Link } from '@tanstack/react-router';
import { TrendingUp } from 'lucide-react';
import { Badge, Card, ErrorText, PageHeader, Switch } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/rating')({
  component: RatingPage,
});

/**
 * Quản trị → Học viện → Rating: thẻ Nội bộ (luôn bật, 3 loại theo mức thời gian) và thẻ FIDE có công tắc
 * (chủ học viện bật/tắt; HLV chỉ xem). FIDE nhập tay, không gọi API của FIDE.
 */
function RatingPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const owner = academy.role === 'owner';
  const setEnabled = useSetAcademyFideEnabled(academy.id);
  const members = useMembers(isStaff(academy.role) ? academy.id : undefined);
  if (!isStaff(academy.role)) return <p className="text-text-muted">{t('ratingPage.staffOnly')}</p>;

  const enabled = academy.fide_enabled;
  const entered = (members.data ?? []).filter(
    (m) => m.role === 'student' && hasFide(m.fide),
  ).length;

  return (
    <>
      <PageHeader
        icon={TrendingUp}
        title={t('ratingPage.title')}
        subtitle={t('ratingPage.subtitle')}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t('ratingPage.internalTitle')}>
          <div className="flex items-center gap-2">
            <Badge tone="success">{t('ratingPage.fideOn')}</Badge>
            <p className="text-sm text-text-muted">{t('ratingPage.internalDesc')}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {ratingCategories.map((c) => (
              <li key={c} className="flex flex-col rounded-md bg-bg px-3 py-2">
                <span className="font-semibold">{t(`ratingPage.cat_${c}` as TranslationKey)}</span>
                <span className="text-sm text-text-muted">
                  {t(`ratingPage.cat_${c}_desc` as TranslationKey)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">{t('ratingPage.internalNote')}</p>
        </Card>

        <Card title={t('ratingPage.fideTitle')}>
          <p className="text-sm text-text-muted">{t('ratingPage.fideDesc')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={enabled}
              onChange={(next) => setEnabled.mutate(next)}
              label={t('ratingPage.fideSwitch')}
              disabled={!owner || setEnabled.isPending}
            />
            <Badge tone={enabled ? 'success' : 'muted'}>
              {enabled ? t('ratingPage.fideOn') : t('ratingPage.fideOff')}
            </Badge>
          </div>
          {!owner && <p className="text-xs text-text-muted">{t('ratingPage.ownerOnlyToggle')}</p>}
          <ErrorText error={setEnabled.error} />
          <p className="text-sm text-text-muted">{t('ratingPage.fideHowTo')}</p>
          {enabled && (
            <>
              <p className="text-sm">{t('ratingPage.fideCount', { count: entered })}</p>
              <Link
                to="/a/$slug/students"
                params={{ slug: academy.slug }}
                className="self-start text-sm font-medium text-primary underline"
              >
                {t('ratingPage.openStudents')}
              </Link>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
