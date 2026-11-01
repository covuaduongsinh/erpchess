import { useCreateInvitation, useMembers } from '@erpchess/api/react';
import { UserPlus, Users } from 'lucide-react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { InviteLink } from '../InviteLink';
import { Button, Card, EmptyState, ErrorText, Spinner } from '../ui';

/** Danh sách huấn luyện viên (kèm chủ học viện) của học viện đang mở. */
export function CoachesList() {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  if (members.isPending) return <Spinner />;
  if (members.error) return <ErrorText error={members.error} />;
  const staff = members.data.filter((m) => m.role === 'coach' || m.role === 'owner');
  if (staff.length === 0) return <EmptyState icon={Users} title={t('coaches.none')} dashed />;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {staff.map((m) => (
        <li key={m.profile.id} className="flex items-center gap-3 py-3">
          <span
            className="flex size-9 items-center justify-center rounded-full bg-primary-soft font-bold text-primary"
            aria-hidden="true"
          >
            {(m.profile.display_name || m.profile.username || '?').trim().charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{m.profile.display_name}</span>
            {m.profile.username && (
              <span className="truncate text-xs text-text-muted">@{m.profile.username}</span>
            )}
          </span>
          <span className="text-sm text-text-muted">{t(`role.${m.role}`)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tạo link mời huấn luyện viên (chủ học viện). */
export function InviteCoachCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const invite = useCreateInvitation(academy.id);
  return (
    <Card title={t('academy.inviteCoach')}>
      <Button
        variant="cta"
        icon={UserPlus}
        className="self-start"
        disabled={invite.isPending}
        onClick={() => invite.mutate({ role: 'coach' })}
      >
        {t('academy.inviteCoach')}
      </Button>
      <ErrorText error={invite.error} />
      {invite.data && (
        <InviteLink token={invite.data.token} academyId={academy.id} inviteRole="coach" />
      )}
    </Card>
  );
}
