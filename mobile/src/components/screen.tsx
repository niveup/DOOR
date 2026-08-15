import { PropsWithChildren, ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/providers/theme-provider";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  overlay?: ReactNode;
}>;

export function AppScreen({ title, subtitle, action, refreshing, onRefresh, overlay, children }: ScreenProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={theme.accent}
                colors={[theme.accent]}
              />
            ) : undefined
          }
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
            </View>
            {action}
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 4,
    paddingTop: 2,
  },
  headerCopy: { flex: 1, gap: 2 },
  title: { fontSize: 30, letterSpacing: -0.6, fontWeight: "700" },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 1 },
});
