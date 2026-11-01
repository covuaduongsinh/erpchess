import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId } from 'react';
import { useT } from '../../lib/use-t';

/**
 * Hộp thoại căn giữa: nền mờ bấm được để đóng, phím Esc đóng, `role="dialog"` có tiêu đề
 * gắn bằng `aria-labelledby`. Nội dung cuộn khi cao hơn màn hình (mobile).
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const titleId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('integrations.close')}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-black/50 backdrop-blur-xs"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('integrations.close')}
            className="rounded-md p-1 text-text-muted hover:bg-bg hover:text-text"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
