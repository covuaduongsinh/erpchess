import { type Inline, parseMarkdown } from '@erpchess/domain';
import { colors, spacing } from '@erpchess/ui-tokens';
import { Text, View } from 'react-native';
import { styles } from '@/components/ui';

function Inlines({ parts }: { parts: Inline[] }) {
  return parts.map((p, i) => (
    <Text
      // biome-ignore lint/suspicious/noArrayIndexKey: đoạn chữ sinh lại toàn bộ khi nội dung đổi
      key={i}
      style={p.bold ? { fontWeight: '700' } : p.italic ? { fontStyle: 'italic' } : undefined}
    >
      {p.text}
    </Text>
  ));
}

/** Markdown rút gọn vẽ bằng <Text> (dùng chung bộ phân tích với web, không có HTML). */
export function Markdown({ source }: { source: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {parseMarkdown(source).map((block, i) => {
        const key = i;
        if (block.type === 'heading') {
          return (
            <Text
              key={key}
              accessibilityRole="header"
              style={[
                styles.text,
                { fontWeight: '700', color: colors.primary, fontSize: 22 - block.level * 2 },
              ]}
            >
              <Inlines parts={block.inline} />
            </Text>
          );
        }
        if (block.type === 'paragraph') {
          return (
            <Text key={key} style={styles.text}>
              <Inlines parts={block.inline} />
            </Text>
          );
        }
        return (
          <View key={key} style={{ gap: spacing.xs }}>
            {block.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: như trên
              <Text key={j} style={styles.text}>
                {block.ordered ? `${j + 1}. ` : '• '}
                <Inlines parts={item} />
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}
