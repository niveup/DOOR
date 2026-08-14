import { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/src/theme/tokens";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ActionButton({ label, icon, onPress, tone = "cyan", disabled = false, compact = false }: { label: string; icon?: IconName; onPress: () => void; tone?: "cyan" | "emerald" | "ghost" | "rose"; disabled?: boolean; compact?: boolean }) {
  const palette = tone === "emerald" ? [colors.emerald, "#042f2e"] : tone === "rose" ? [colors.rose, "#4c0519"] : tone === "ghost" ? [colors.border, colors.surface] : [colors.cyan, "#083344"];
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, compact && styles.compactButton, { borderColor: palette[0], backgroundColor: palette[1] }, (pressed || disabled) && styles.buttonPressed]}>
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={tone === "ghost" ? colors.text : palette[0]} /> : null}
      <Text style={[styles.buttonText, { color: tone === "ghost" ? colors.text : palette[0] }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tone = colors.textMuted }: { icon: IconName; label: string; onPress: () => void; tone?: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}><Ionicons name={icon} size={21} color={tone} /></Pressable>;
}

export function Metric({ label, value, accent = colors.cyan }: { label: string; value: string | number; accent?: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: accent }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

export function ProgressBar({ value, tone = colors.cyan }: { value: number; tone?: string }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: tone }]} /></View>;
}

export function Chip({ label, active = false, onPress, tone = colors.cyan }: { label: string; active?: boolean; onPress?: () => void; tone?: string }) {
  return <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.chip, active && { borderColor: tone, backgroundColor: `${tone}22` }, pressed && styles.buttonPressed]}><Text style={[styles.chipText, active && { color: tone }]}>{label}</Text></Pressable>;
}

export function LabeledInput({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.inputGroup}><Text style={styles.inputLabel}>{label}</Text><TextInput placeholderTextColor={colors.textFaint} style={[styles.input, style]} {...props} /></View>;
}

export function LoadingCard({ label = "Syncing with DOOR…" }: { label?: string }) {
  return <Card style={styles.loading}><ActivityIndicator color={colors.cyan} /><Text style={styles.muted}>{label}</Text></Card>;
}

export function EmptyState({ icon = "sparkles-outline", title, description, action }: { icon?: IconName; title: string; description: string; action?: ReactNode }) {
  return <Card style={styles.empty}><Ionicons name={icon} size={26} color={colors.cyan} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDescription}>{description}</Text>{action}</Card>;
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionText}>{title}</Text>{trailing}</View>;
}

export const ui = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  muted: { color: colors.textMuted, fontSize: 13 },
  text: { color: colors.text },
  mono: { fontVariant: ["tabular-nums"], fontFamily: "monospace" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderMuted },
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted, borderRadius: 18, padding: spacing.md, gap: spacing.sm },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  compactButton: { minHeight: 36, paddingHorizontal: 11, borderRadius: 10 },
  buttonText: { fontSize: 13, fontWeight: "800" },
  buttonPressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14 },
  metric: { flex: 1, gap: 4 },
  metricValue: { fontSize: 23, fontWeight: "800", fontVariant: ["tabular-nums"] },
  metricLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  progressTrack: { height: 8, borderRadius: 99, overflow: "hidden", backgroundColor: colors.raised },
  progressFill: { height: "100%", borderRadius: 99 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  inputGroup: { gap: 7 },
  inputLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "800" },
  input: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 13, backgroundColor: colors.canvas, fontSize: 14 },
  loading: { minHeight: 120, justifyContent: "center", alignItems: "center" },
  muted: { color: colors.textMuted, fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: 30, textAlign: "center" },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 5 },
  emptyDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionText: { color: colors.text, fontSize: 15, fontWeight: "800" },
});
