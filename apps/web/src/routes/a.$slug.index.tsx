import { useCreateInvitation, useMembers } from '@erpchess/api/react';
import { academyRoles } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { InviteLink } from '../components/InviteLink';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/')({
  component: OverviewPage,
});

function OverviewPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  const invite = useCreateInvitation(academy.id);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title={t('academy.members')}>
        {members.isPending ? (
          <Spinner />
        ) : members.error ? (
          <ErrorText error={members.error} />
        ) : (
          <dl className="flex flex-col gap-3">
            {academyRoles.map((role) => {
              const list = members.data.filter((m) => m.role === role);
              if (list.length === 0) return null;
              return (
                <div key={role}>
                  <dt className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
                    {t(`role.${role}`)} ({list.length})
                  </dt>
                  <dd>
                    {list.map((m) => (
                      <p key={m.profile.id}>
                        {m.profile.display_name}
                        {m.profile.username && (
                          <span className="text-text-muted"> · @{m.profile.username}</span>
                        )}
                      </p>
                    ))}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </Card>

      {academy.role === 'owner' && (
        <Card title={t('academy.inviteCoach')}>
          <Button
            variant="cta"
            className="self-start"
            disabled={invite.isPending}
            onClick={() => invite.mutate({ role: 'coach' })}
          >
            {t('academy.inviteCoach')}
          </Button>
          <ErrorText error={invite.error} />
          {invite.data && <InviteLink token={invite.data.token} />}
        </Card>
      )}
    </div>
  );
}
