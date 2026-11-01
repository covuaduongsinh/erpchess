import { useT } from '../../lib/use-t';

export function Spinner() {
  const { t } = useT();
  return <p className="text-text-muted">{t('common.loading')}</p>;
}
