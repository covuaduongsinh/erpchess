import { isStudentEmail, signOut } from '@erpchess/api';
import { useCreateAcademy, useErpClient, useMyAcademies, useSession } from '@erpchess/api/react';
import { slugify } from '@erpchess/domain';
import { colors } from '@erpchess/ui-tokens';
import { Redirect, router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text } from 'react-native';
import { Button, Card, ErrorText, Field, Muted, Spinner, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

export default function AcademiesScreen() {
  const { t } = useT();
  const client = useErpClient();
  const { session, loading } = useSession();
  const academies = useMyAcademies(session?.user.id);

  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/" />;
  const isStudent = isStudentEmail(session.user.email);

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      refreshControl={
        <RefreshControl
          refreshing={academies.isRefetching}
          onRefresh={() => void academies.refetch()}
        />
      }
    >
      <Stack.Screen
        options={{
          title: t('academy.mine'),
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => void signOut(client)}>
              <Text style={{ color: colors.textOnPrimary }}>{t('common.signOut')}</Text>
            </Pressable>
          ),
        }}
      />
      <Card>
        {academies.isPending ? (
          <Spinner />
        ) : academies.error ? (
          <ErrorText error={academies.error} />
        ) : academies.data.length === 0 ? (
          <Muted>{isStudent ? t('academy.noneStudent') : t('academy.none')}</Muted>
        ) : (
          academies.data.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="link"
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/academies/[slug]', params: { slug: a.slug } })
              }
            >
              <Text style={[styles.text, { fontWeight: '500' }]}>{a.name}</Text>
              <Muted>{t(`role.${a.role}`)}</Muted>
            </Pressable>
          ))
        )}
      </Card>
      {!isStudent && <CreateAcademyCard />}
    </ScrollView>
  );
}

function CreateAcademyCard() {
  const { t } = useT();
  const create = useCreateAcademy();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <Card title={t('academy.create')}>
      <Field
        label={t('academy.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (!slugEdited) setSlug(slugify(v));
        }}
      />
      <Field
        label={t('academy.slug')}
        hint={t('validation.slug')}
        value={slug}
        autoCapitalize="none"
        onChangeText={(v) => {
          setSlug(v);
          setSlugEdited(true);
        }}
      />
      <ErrorText error={create.error} />
      <Button
        variant="cta"
        title={t('common.create')}
        disabled={create.isPending}
        onPress={() =>
          create.mutate(
            { name, slug },
            {
              onSuccess: (a) =>
                router.push({ pathname: '/academies/[slug]', params: { slug: a.slug } }),
            },
          )
        }
      />
    </Card>
  );
}
