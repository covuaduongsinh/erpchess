import { useBilling, useBillingMutations } from '@erpchess/api/react';
import { VN_BANKS } from '@erpchess/domain';
import { type FormEvent, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { Button, ErrorText, Field, Modal, Spinner } from '../ui';

/**
 * Cấu hình tài khoản nhận chuyển khoản (VietQR). Dùng đúng dữ liệu `academy_billing` của trang Học phí
 * (một nguồn duy nhất); khi lưu giữ nguyên tiền tệ, mã số thuế và tiền tố hoá đơn đang có.
 */
export function VietQrModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const billing = useBilling(academy.id);
  return (
    <Modal title={t('integrations.vietqrTitle')} onClose={onClose}>
      {billing.isPending ? (
        <Spinner />
      ) : billing.error ? (
        <ErrorText error={billing.error} />
      ) : (
        <VietQrForm initial={billing.data} onClose={onClose} />
      )}
    </Modal>
  );
}

function VietQrForm({
  initial,
  onClose,
}: {
  initial: ReturnType<typeof useBilling>['data'];
  onClose: () => void;
}) {
  const { t } = useT();
  const { academy } = useAcademy();
  const { saveSettings } = useBillingMutations(academy.id);
  const [bankBin, setBankBin] = useState(initial?.bank_bin ?? '');
  const [bankAccount, setBankAccount] = useState(initial?.bank_account ?? '');
  const [bankHolder, setBankHolder] = useState(initial?.bank_holder ?? '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveSettings.mutate(
      {
        currency: initial?.currency ?? 'VND',
        taxId: initial?.tax_id ?? null,
        invoicePrefix: initial?.invoice_prefix ?? 'HD',
        bankBin,
        bankAccount,
        bankHolder,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{t('bill.bankHint')}</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t('bill.bank')}</span>
        <select
          value={bankBin}
          onChange={(e) => setBankBin(e.target.value)}
          className="rounded-md border border-text-muted/30 bg-surface px-3 py-2"
        >
          <option value="">{t('bill.pickBank')}</option>
          {VN_BANKS.map((b) => (
            <option key={b.bin} value={b.bin}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={t('bill.account')}
        value={bankAccount}
        onChange={(e) => setBankAccount(e.target.value.replace(/\s/g, ''))}
        pattern="[0-9A-Za-z]{1,19}"
        required={!!bankBin}
      />
      <Field
        label={t('bill.holder')}
        value={bankHolder}
        onChange={(e) => setBankHolder(e.target.value.toUpperCase())}
        maxLength={80}
      />
      <ErrorText error={saveSettings.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="cta" disabled={saveSettings.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
