import { colors, fontSize, radius, spacing } from '@erpchess/ui-tokens';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { errorMessage, useT } from '@/lib/use-t';

export function Button({
  title,
  variant = 'primary',
  ...props
}: PressableProps & { title: string; variant?: 'primary' | 'cta' | 'ghost' }) {
  const bg = { primary: colors.primary, cta: colors.orange, ghost: 'transparent' }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: props.disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
      {...props}
    >
      <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.primary }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? (
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  const { t } = useT();
  if (!error) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {errorMessage(t, error)}
    </Text>
  );
}

export function Spinner() {
  return <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} />;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { padding: spacing.md, gap: spacing.md },
  button: {
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: fontSize.body },
  field: { gap: spacing.xs },
  label: { fontWeight: '500', color: colors.text, fontSize: fontSize.subtitle },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    backgroundColor: colors.white,
    color: colors.text,
  },
  hint: { color: colors.textMuted, fontSize: fontSize.emphasis },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTitle: { fontSize: fontSize.body + 2, fontWeight: '700', color: colors.primary },
  error: { color: colors.danger, fontSize: fontSize.subtitle },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  text: { color: colors.text, fontSize: fontSize.body },
});
