import { useSetMemberFide } from '@erpchess/api/react';
import type { MemberFide } from '@erpchess/domain';
import { type FormEvent, useState } from 'react';
import { useT } from '../../lib/use-t';
import { Button, ErrorText } from '../ui';

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

/**
 * Sửa tại chỗ mã FIDE và 3 Elo FIDE của một học viên (nhân sự nhập tay). Nút Lưu chỉ hiện khi có
 * thay đổi; lưu thành công thì dữ liệu học viên được tải lại và nút tự ẩn.
 */
export function FideEditor({
  academyId,
  studentId,
  name,
  fide,
}: {
  academyId: string;
  studentId: string;
  name: string;
  fide: MemberFide | undefined;
}) {
  const { t } = useT();
  const set = useSetMemberFide(academyId);
  const saved = {
    id: fide?.id ?? '',
    standard: text(fide?.standard),
    rapid: text(fide?.rapid),
    blitz: text(fide?.blitz),
  };
  const [draft, setDraft] = useState(saved);
  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some((k) => draft[k] !== saved[k]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    set.mutate({
      studentId,
      fideId: draft.id,
      standard: num(draft.standard),
      rapid: num(draft.rapid),
      blitz: num(draft.blitz),
    });
  }

  const field = (key: keyof typeof saved, label: string, width: string, props = {}) => (
    <input
      aria-label={`${label} — ${name}`}
      placeholder={label}
      value={draft[key]}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      className={`${width} rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-text focus:border-primary focus:outline-hidden`}
      {...props}
    />
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {field('id', t('fide.idShort'), 'w-24', { inputMode: 'numeric', maxLength: 12 })}
        {field('standard', t('fide.standardShort'), 'w-16', {
          type: 'number',
          min: 1000,
          max: 3300,
        })}
        {field('rapid', t('fide.rapidShort'), 'w-16', { type: 'number', min: 1000, max: 3300 })}
        {field('blitz', t('fide.blitzShort'), 'w-16', { type: 'number', min: 1000, max: 3300 })}
        {dirty && (
          <Button
            type="submit"
            variant="cta"
            disabled={set.isPending}
            className="px-2.5 py-1 text-xs"
          >
            {t('common.save')}
          </Button>
        )}
      </div>
      <ErrorText error={set.error} />
    </form>
  );
}
