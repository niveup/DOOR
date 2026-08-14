import { PropsWithChildren, ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme/tokens";

type ScreenProps = PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode; refreshing?: boolean; onRefresh?: () => void }>;

export function AppScreen({ title, subtitle, action, refreshing, onRefresh, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.cyan} colors={[colors.cyan]} /> : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>DOOR / JUJUM AI</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm, marginBottom: 2 },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.cyan, fontSize: 10, letterSpacing: 1.6, fontWeight: "800" },
  title: { color: colors.text, fontSize: 28, letterSpacing: -0.7, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 2 },
});
