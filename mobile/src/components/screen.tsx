import { PropsWithChildren, ReactNode } from "react";
import { RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { layout, spacing, typography } from "@/src/theme/tokens";
import { useTheme } from "@/src/providers/theme-provider";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  overlay?: ReactNode;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  headerCopyStyle?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
}>;

export function AppScreen({
  title,
  subtitle,
  action,
  refreshing,
  onRefresh,
  overlay,
  keyboardShouldPersistTaps = "handled",
  titleStyle,
  subtitleStyle,
  headerCopyStyle,
  headerStyle,
  children,
}: ScreenProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          nestedScrollEnabled={true}
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
          <View style={[styles.header, headerStyle]}>
            <View style={[styles.headerCopy, headerCopyStyle]}>
              <Text style={[styles.title, { color: theme.text }, titleStyle]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: theme.textMuted }, subtitleStyle]}>
                  {subtitle}
                </Text>
              ) : null}
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
  scroll: { flex: 1 },
  content: {
    padding: layout.screenPadding,
    paddingBottom: layout.bottomScrollPadding,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xxs,
    paddingTop: 2,
  },
  headerCopy: { flex: 1, gap: 2 },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 1,
  },
});
