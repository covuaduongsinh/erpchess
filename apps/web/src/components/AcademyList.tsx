import { isStudentEmail } from '@erpchess/api';
import { useMyAcademies } from '@erpchess/api/react';
import type { Session } from '@supabase/supabase-js';
import { Link } from '@tanstack/react-router';
import { useT } from '../lib/use-t';
import { Card, ErrorText, Spinner } from './ui';

export function AcademyList({ session }: { session: Session }) {
  const { t } = useT();
  const academies = useMyAcademies(session.user.id);
  const isStudent = isStudentEmail(session.user.email);

  return (
    <Card title={t('academy.mine')}>
      {academies.isPending ? (
        <Spinner />
      ) : academies.error ? (
        <ErrorText error={academies.error} />
      ) : academies.data.length === 0 ? (
        <p className="text-text-muted">
          {isStudent ? t('academy.noneStudent') : t('academy.none')}
        </p>
      ) : (
        <ul className="divide-y divide-text-muted/15">
          {academies.data.map((a) => (
            <li key={a.id}>
              <Link
                to="/a/$slug"
                params={{ slug: a.slug }}
                className="flex items-center justify-between py-3 hover:text-primary"
              >
                <span className="font-medium">{a.name}</span>
                <span className="text-sm text-text-muted">{t(`role.${a.role}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!isStudent && (
        <Link
          to="/academies/new"
          className="self-start rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
        >
          {t('academy.create')}
        </Link>
      )}
    </Card>
  );
}
