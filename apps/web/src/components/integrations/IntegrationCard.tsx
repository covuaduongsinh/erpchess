import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../lib/use-t';
import { Badge, Button } from '../ui';

/**
 * Thẻ một tích hợp: icon, tên, mô tả, huy hiệu trạng thái và nút cấu hình.
 * `status` "soon" = chưa làm: chỉ hiện huy hiệu "Sắp có", không có nút nào.
 */
export function IntegrationCard({
  icon: Icon,
  title,
  description,
  status,
  summary,
  onConfigure,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  status: 'configured' | 'notConfigured' | 'soon';
  /** Dòng tóm tắt cấu hình hiện tại (chỉ hiện khi đã cấu hình). */
  summary?: ReactNode;
  onConfigure?: () => void;
}) {
  const { t } = useT();
  return (
    <li className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-semibold text-text">{title}</h3>
          <p className="text-sm text-text-muted">{description}</p>
        </div>
      </div>
      {status === 'configured' && summary && (
        <p className="break-words text-sm text-text">{summary}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2">
        <Badge tone={status === 'configured' ? 'success' : status === 'soon' ? 'new' : 'muted'}>
          {status === 'configured'
            ? t('integrations.configured')
            : status === 'soon'
              ? t('integrations.comingSoon')
              : t('integrations.notConfigured')}
        </Badge>
        {status !== 'soon' && onConfigure && (
          <Button variant="ghost" onClick={onConfigure}>
            {status === 'configured' ? t('integrations.edit') : t('integrations.configure')}
          </Button>
        )}
      </div>
    </li>
  );
}
