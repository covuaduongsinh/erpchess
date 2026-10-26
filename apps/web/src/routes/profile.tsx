import { useErpClient, useProfile, useUpdateProfile } from '@erpchess/api/react';
import { formatSanList } from '@erpchess/chess-core';
import { COMMON_TIMEZONES, type MoveNotation } from '@erpchess/domain';
import type { Session } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { RequireSession } from '../components/RequireSession';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/profile')({
  component: () => (
    <RequireSession>{(session) => <ProfilePage session={session} />}</RequireSession>
  ),
});

const PREVIEW_MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'e8=Q#'];

function ProfilePage({ session }: { session: Session }) {
  const { t, i18n } = useT();
  const client = useErpClient();
  const profileQuery = useProfile(session.user.id);
  const updateMutation = useUpdateProfile(session.user.id);

  const profile = profileQuery.data;

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [locale, setLocale] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [moveNotation, setMoveNotation] = useState<MoveNotation | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (profileQuery.isPending) return <Spinner />;
  if (profileQuery.error) return <ErrorText error={profileQuery.error} />;

  const curDisplayName = displayName ?? profile?.display_name ?? '';
  const curUsername = username ?? profile?.username ?? '';
  const curLocale = locale ?? profile?.locale ?? i18n.language ?? 'vi';
  const curTimezone = timezone ?? profile?.timezone ?? 'Asia/Ho_Chi_Minh';
  const curNotation = (moveNotation ?? profile?.move_notation ?? 'letters') as MoveNotation;
  const curCountry = country ?? profile?.country ?? '';
  const curBio = bio ?? profile?.bio ?? '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    await updateMutation.mutateAsync({
      displayName: curDisplayName,
      username: curUsername || undefined,
      locale: curLocale as 'vi' | 'en',
      timezone: curTimezone,
      moveNotation: curNotation,
      country: curCountry || null,
      bio: curBio || null,
    });
    if (curLocale !== i18n.language) {
      await i18n.changeLanguage(curLocale);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) {
      setPasswordMsg({ ok: false, text: t('validation.password') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ ok: true, text: t('profile.passwordUpdated') });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{t('profile.title')}</h1>
        <p className="text-sm text-text-muted">{t('profile.subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Card title={t('profile.personalInfo')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('profile.displayName')}
              value={curDisplayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Field
              label={t('profile.username')}
              value={curUsername}
              onChange={(e) => setUsername(e.target.value)}
              disabled={Boolean(profile?.username)}
              hint={profile?.username ? 'Tên đăng nhập không thể thay đổi sau khi tạo' : undefined}
            />
            <Field
              label={t('profile.email')}
              value={session.user.email ?? ''}
              disabled
              hint="Email quản lý bởi hệ thống đăng nhập"
            />
            <Field
              label={t('profile.country')}
              value={curCountry}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Việt Nam"
            />
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('profile.bio')}</span>
            <textarea
              rows={3}
              className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base outline-primary"
              value={curBio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Giới thiệu ngắn về bạn…"
              maxLength={500}
            />
          </label>
        </Card>

        <Card title={t('profile.preferences')}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="pref-language" className="text-sm font-medium">
                {t('profile.language')}
              </label>
              <select
                id="pref-language"
                value={curLocale}
                onChange={(e) => setLocale(e.target.value)}
                className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base outline-primary"
              >
                <option value="vi">Tiếng Việt (vi)</option>
                <option value="en">English (en)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="pref-timezone" className="text-sm font-medium">
                {t('profile.timezone')}
              </label>
              <select
                id="pref-timezone"
                value={curTimezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base outline-primary"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label} ({tz.value})
                  </option>
                ))}
              </select>
              <span className="text-xs text-text-muted">{t('profile.timezoneHint')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-text-muted/20 pt-4">
            <span className="text-sm font-medium">{t('profile.notation')}</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="move_notation"
                  value="letters"
                  checked={curNotation === 'letters'}
                  onChange={() => setMoveNotation('letters')}
                  className="size-4 text-primary"
                />
                <span>{t('profile.notationLetters')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="move_notation"
                  value="figurine"
                  checked={curNotation === 'figurine'}
                  onChange={() => setMoveNotation('figurine')}
                  className="size-4 text-primary"
                />
                <span>{t('profile.notationFigurine')}</span>
              </label>
            </div>

            <div className="rounded-md bg-stone-100 p-3 text-sm dark:bg-stone-800">
              <span className="mr-2 text-xs font-semibold text-text-muted">
                {t('profile.notationPreview')}
              </span>
              <span className="font-mono text-primary font-medium">
                {formatSanList(PREVIEW_MOVES, curNotation).join(' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-text-muted/20 pt-4">
            {saveSuccess && (
              <span className="text-sm font-medium text-green">{t('profile.saveSuccess')}</span>
            )}
            {updateMutation.error && <ErrorText error={updateMutation.error} />}
            <div className="ml-auto">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('common.loading') : t('profile.save')}
              </Button>
            </div>
          </div>
        </Card>
      </form>

      <Card title={t('profile.changePassword')}>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              type="password"
              label={t('profile.newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Field
              type="password"
              label={t('profile.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.ok ? 'text-green font-medium' : 'text-red'}`}>
              {passwordMsg.text}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" variant="cta" disabled={passwordLoading}>
              {passwordLoading ? t('common.loading') : t('profile.changePassword')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
