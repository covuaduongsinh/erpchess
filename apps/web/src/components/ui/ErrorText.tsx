import { ZodError } from 'zod';
import { useT, validationKey } from '../../lib/use-t';

/** Hiển thị lỗi: lỗi validate được dịch theo trường, lỗi khác hiện nguyên thông điệp. */
export function ErrorText({ error }: { error: unknown }) {
  const { t } = useT();
  if (!error) return null;
  let message: string;
  if (error instanceof ZodError) {
    const key = validationKey(error.issues[0]?.message ?? '');
    message = key ? t(key) : error.message;
  } else if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    // Lỗi kiểm tra tự ném ở tầng API (vd. `new Error('location')`) dùng chung mã với Zod
    const known = validationKey(error.message);
    if (known) message = t(known);
    else if (code === 'username_taken') message = t('students.usernameTaken');
    else if (code === 'lichess_not_found') message = t('database.lichessNotFound');
    else if (code === 'sync_not_found') message = t('gameSync.sync_not_found');
    else if (code === 'sync_unreachable') message = t('gameSync.sync_unreachable');
    else if (code?.startsWith('sync_')) message = t('gameSync.sync_error');
    else if (code === 'lichess_unreachable' || code === 'lichess_error')
      message = t('database.lichessUnavailable');
    else if (code === '23505') message = t('academy.slugTaken');
    else if (/invalid login credentials/i.test(error.message))
      message = t('auth.invalidCredentials');
    else message = t('common.error', { message: error.message });
  } else {
    message = String(error);
  }
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}
