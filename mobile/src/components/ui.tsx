import { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/providers/theme-provider";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { theme, isDark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: isDark ? "#000" : "#64748b",
          shadowOpacity: isDark ? 0.2 : 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: isDark ? 1 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  tone = "emerald",
  disabled = false,
  compact = false,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: "cyan" | "emerald" | "ghost" | "rose" | "amber";
  disabled?: boolean;
  compact?: boolean;
}) {
  const { theme, isDark } = useTheme();

  const palette =
    tone === "emerald"
      ? [theme.emerald, isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(5, 150, 105, 0.12)"]
      : tone === "rose"
      ? [theme.rose, isDark ? "rgba(244, 63, 94, 0.14)" : "rgba(225, 29, 72, 0.12)"]
      : tone === "amber"
      ? [theme.amber, isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(217, 119, 6, 0.12)"]
      : tone === "ghost"
      ? [theme.border, theme.raised]
      : [theme.cyan, isDark ? "rgba(6, 182, 212, 0.14)" : "rgba(2, 132, 199, 0.12)"];

  const textColor = tone === "ghost" ? theme.text : palette[0];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        { borderColor: palette[0], backgroundColor: palette[1] },
        (pressed || disabled) && styles.buttonPressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={textColor} /> : null}
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: string;
}) {
  const { theme } = useTheme();
  const iconColor = tone || theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.buttonPressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
    </Pressable>
  );
}

export function Metric({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: accent || theme.accent }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textFaint }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: string }) {
  const { theme } = useTheme();
  const fillColor = tone || theme.accent;

  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.raised }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

export function Chip({
  label,
  active = false,
  onPress,
  tone,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: string;
}) {
  const { theme } = useTheme();
  const activeTone = tone || theme.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.surface, borderColor: theme.borderMuted },
        active && { borderColor: activeTone, backgroundColor: `${activeTone}22` },
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.chipText, { color: theme.textMuted }, active && { color: activeTone, fontWeight: "700" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LabeledInput({ label, style, ...props }: TextInputProps & { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textFaint}
        style={[styles.input, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.text }, style]}
        {...props}
      />
    </View>
  );
}

export function LoadingCard({ label = "Syncing with DOOR…" }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <Card style={styles.loading}>
      <ActivityIndicator color={theme.accent} />
      <Text style={[styles.muted, { color: theme.textMuted }]}>{label}</Text>
    </Card>
  );
}

export function EmptyState({
  icon = "sparkles-outline",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Card style={styles.empty}>
      <Ionicons name={icon} size={28} color={theme.accent} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>{description}</Text>
      {action}
    </Card>
  );
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionText, { color: theme.text }]}>{title}</Text>
      {trailing}
    </View>
  );
}

export const ui = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mono: { fontVariant: ["tabular-nums"], fontFamily: "monospace" },
});

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  compactButton: { minHeight: 36, paddingHorizontal: 11, borderRadius: 10 },
  buttonText: { fontSize: 13, fontWeight: "800" },
  buttonPressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
  },
  metric: { flex: 1, gap: 4 },
  metricValue: { fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
  metricLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  progressTrack: { height: 7, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 10, letterSpacing: 0.8, fontWeight: "900" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  loading: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 10 },
  muted: { fontSize: 13 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 28, textAlign: "center", gap: 9 },
  emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyDescription: { fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 280 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionText: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
});
