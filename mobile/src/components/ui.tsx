import { ComponentProps, PropsWithChildren, ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, shadows, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/providers/theme-provider";

export type IconName = ComponentProps<typeof Ionicons>["name"];

// ============================================================================
// 1. CARD
// ============================================================================

export interface CardProps extends PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "outlined";
  onPress?: () => void;
}> {}

export function Card({ children, style, variant = "default", onPress }: CardProps) {
  const { theme, isDark } = useTheme();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: variant === "elevated" ? theme.surfaceElevated : theme.surface,
      borderColor: theme.border,
      shadowColor: isDark ? "#000000" : "#64748b",
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: isDark ? 1 : 2,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.cardPressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

// ============================================================================
// 2. BUTTON & ACTION BUTTON
// ============================================================================

export type ButtonVariant = "solid" | "soft" | "subtle" | "outline" | "ghost";
export type ButtonTone = "emerald" | "cyan" | "amber" | "rose" | "violet" | "ghost" | "default";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  icon?: IconName;
  trailingIcon?: IconName;
  onPress: () => void;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  label,
  icon,
  trailingIcon,
  onPress,
  variant = "solid",
  tone = "emerald",
  size = "md",
  compact = false,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { theme, isDark } = useTheme();

  const isCompact = compact || size === "sm";
  const isLarge = size === "lg";

  // Resolve Tone Base Colors
  const getToneColor = (t: ButtonTone): string => {
    switch (t) {
      case "emerald":
        return theme.emerald;
      case "cyan":
        return theme.cyan;
      case "amber":
        return theme.amber;
      case "rose":
        return theme.rose;
      case "violet":
        return theme.violet;
      case "ghost":
        return theme.textMuted;
      default:
        return theme.accent;
    }
  };

  const getToneSoftBg = (t: ButtonTone): string => {
    switch (t) {
      case "emerald":
        return isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(5, 150, 105, 0.12)";
      case "rose":
        return isDark ? "rgba(244, 63, 94, 0.14)" : "rgba(225, 29, 72, 0.12)";
      case "amber":
        return isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(217, 119, 6, 0.12)";
      case "cyan":
        return isDark ? "rgba(6, 182, 212, 0.14)" : "rgba(2, 132, 199, 0.12)";
      case "violet":
        return isDark ? "rgba(139, 92, 246, 0.14)" : "rgba(124, 58, 237, 0.12)";
      case "ghost":
        return theme.raised;
      default:
        return theme.accentSoft;
    }
  };

  const toneColor = getToneColor(tone);
  const toneSoftBg = getToneSoftBg(tone);

  // Compute Variant Visuals
  let backgroundColor: string;
  let borderColor: string;
  let textColor: string;
  let shadowStyle: StyleProp<ViewStyle> = undefined;

  if (variant === "solid") {
    backgroundColor = toneColor;
    borderColor = toneColor;
    // High-contrast text on solid emerald/bright tone: deep obsidian dark text (#09090b)
    textColor = tone === "emerald" || tone === "cyan" || tone === "amber" || tone === "default"
      ? theme.solidTextDark
      : "#ffffff";
    shadowStyle = {
      shadowColor: toneColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.35 : 0.22,
      shadowRadius: 8,
      elevation: 3,
    };
  } else if (variant === "outline") {
    backgroundColor = "transparent";
    borderColor = tone === "ghost" ? theme.border : toneColor;
    textColor = tone === "ghost" ? theme.text : toneColor;
  } else if (variant === "ghost") {
    backgroundColor = "transparent";
    borderColor = "transparent";
    textColor = tone === "ghost" ? theme.text : toneColor;
  } else {
    // "soft" or "subtle"
    backgroundColor = toneSoftBg;
    borderColor = tone === "ghost" ? theme.border : toneColor;
    textColor = tone === "ghost" ? theme.text : toneColor;
  }

  const iconSize = isCompact ? 16 : isLarge ? 20 : 18;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.button,
        isCompact && styles.buttonCompact,
        isLarge && styles.buttonLarge,
        fullWidth && styles.buttonFullWidth,
        {
          backgroundColor,
          borderColor,
        },
        shadowStyle,
        (pressed || disabled) && (variant === "ghost" ? styles.buttonGhostPressed : styles.buttonPressed),
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={iconSize} color={textColor} /> : null}
          <Text
            style={[
              styles.buttonText,
              isCompact && styles.buttonTextCompact,
              isLarge && styles.buttonTextLarge,
              { color: textColor },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {trailingIcon ? <Ionicons name={trailingIcon} size={iconSize} color={textColor} /> : null}
        </>
      )}
    </Pressable>
  );
}

// ActionButton maintains backwards compatibility with previous signature while supporting new solid/outline variants
export function ActionButton({
  label,
  icon,
  trailingIcon,
  onPress,
  tone = "emerald",
  disabled = false,
  compact = false,
  loading = false,
  variant = "soft",
  style,
  textStyle,
}: {
  label: string;
  icon?: IconName;
  trailingIcon?: IconName;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  compact?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Button
      label={label}
      icon={icon}
      trailingIcon={trailingIcon}
      onPress={onPress}
      tone={tone}
      variant={variant}
      compact={compact}
      disabled={disabled}
      loading={loading}
      style={style}
      textStyle={textStyle}
    />
  );
}

// ============================================================================
// 3. INPUT & LABELED INPUT
// ============================================================================

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string | null;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  rightElement?: ReactNode;
  showPasswordToggle?: boolean;
  compact?: boolean;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  helperStyle?: StyleProp<TextStyle>;
}

export function Input({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  rightElement,
  showPasswordToggle = false,
  compact = false,
  required = false,
  containerStyle,
  inputContainerStyle,
  labelStyle,
  errorStyle,
  helperStyle,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isSecured = secureTextEntry && !isPasswordVisible;

  // Determine active border & glow color
  const hasError = Boolean(error);
  const borderColor = hasError
    ? theme.rose
    : isFocused
    ? theme.borderFocus
    : theme.border;

  const leftIconColor = hasError
    ? theme.rose
    : isFocused
    ? theme.accent
    : theme.textFaint;

  return (
    <View style={[styles.inputWrapper, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.inputLabel,
              { color: hasError ? theme.rose : isFocused ? theme.accent : theme.textMuted },
              labelStyle,
            ]}
          >
            {label}
          </Text>
          {required ? <Text style={[styles.requiredAsterisk, { color: theme.rose }]}>*</Text> : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          compact && styles.inputContainerCompact,
          {
            backgroundColor: theme.surface,
            borderColor,
            shadowColor: isFocused ? (isDark ? theme.emerald : "#059669") : "transparent",
            shadowOpacity: isFocused ? (isDark ? 0.25 : 0.12) : 0,
            shadowRadius: isFocused ? 6 : 0,
            shadowOffset: { width: 0, height: 1 },
            elevation: isFocused ? 2 : 0,
          },
          inputContainerStyle,
        ]}
      >
        {leftIcon ? (
          <View style={styles.inputLeftIconWrapper}>
            <Ionicons name={leftIcon} size={compact ? 16 : 19} color={leftIconColor} />
          </View>
        ) : null}

        <TextInput
          placeholderTextColor={theme.textFaint}
          secureTextEntry={isSecured}
          style={[
            styles.inputField,
            compact && styles.inputFieldCompact,
            { color: theme.text },
            style,
          ]}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />

        {showPasswordToggle ? (
          <Pressable
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
            style={({ pressed }) => [styles.inputActionIcon, pressed && styles.buttonPressed]}
            hitSlop={8}
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={19}
              color={isFocused ? theme.accent : theme.textMuted}
            />
          </Pressable>
        ) : rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.inputActionIcon, pressed && styles.buttonPressed]}
            hitSlop={8}
          >
            <Ionicons
              name={rightIcon}
              size={19}
              color={isFocused ? theme.accent : theme.textMuted}
            />
          </Pressable>
        ) : (
          rightElement || null
        )}
      </View>

      {hasError ? (
        <View style={styles.statusRow}>
          <Ionicons name="alert-circle" size={13} color={theme.rose} style={styles.statusIcon} />
          <Text style={[styles.inputErrorText, { color: theme.rose }, errorStyle]}>{error}</Text>
        </View>
      ) : helperText ? (
        <View style={styles.statusRow}>
          <Text style={[styles.inputHelperText, { color: theme.textFaint }, helperStyle]}>
            {helperText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Backwards-compatible LabeledInput alias
export function LabeledInput({
  label,
  ...props
}: InputProps) {
  return <Input label={label} {...props} />;
}

// ============================================================================
// 4. ICON BUTTON
// ============================================================================

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: string;
  size?: "sm" | "md" | "lg";
  variant?: "surface" | "ghost" | "tonal";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  label,
  onPress,
  tone,
  size = "md",
  variant = "surface",
  disabled = false,
  style,
}: IconButtonProps) {
  const { theme } = useTheme();
  const iconColor = tone || theme.textMuted;

  const isSmall = size === "sm";
  const isLarge = size === "lg";

  const sizeStyle = isSmall
    ? styles.iconButtonSmall
    : isLarge
    ? styles.iconButtonLarge
    : styles.iconButton;

  const iconDimension = isSmall ? 16 : isLarge ? 24 : 20;

  const bgStyle =
    variant === "ghost"
      ? { backgroundColor: "transparent", borderColor: "transparent" }
      : variant === "tonal"
      ? { backgroundColor: theme.raised, borderColor: theme.borderMuted }
      : { backgroundColor: theme.surface, borderColor: theme.border };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        sizeStyle,
        bgStyle,
        (pressed || disabled) && styles.buttonPressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconDimension} color={iconColor} />
    </Pressable>
  );
}

// ============================================================================
// 5. METRIC
// ============================================================================

export function Metric({
  label,
  value,
  accent,
  sublabel,
}: {
  label: string;
  value: string | number;
  accent?: string;
  sublabel?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: accent || theme.accent }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textFaint }]}>{label}</Text>
      {sublabel ? <Text style={[styles.metricSublabel, { color: theme.textMuted }]}>{sublabel}</Text> : null}
    </View>
  );
}

// ============================================================================
// 6. PROGRESS BAR
// ============================================================================

export function ProgressBar({
  value,
  tone,
  height = 6,
  showEmptyCap = false,
}: {
  value: number;
  tone?: string;
  height?: number;
  showEmptyCap?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const fillColor = tone || (isDark ? "#3B82F6" : "#2563EB");
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <View
      style={[
        styles.progressTrack,
        {
          height,
          backgroundColor: isDark ? "#22222a" : "#e2e8f0",
          borderRadius: height / 2,
        },
      ]}
    >
      <View
        style={[
          styles.progressFill,
          {
            width: clampedValue > 0 ? `${clampedValue}%` : showEmptyCap ? 6 : 0,
            backgroundColor: fillColor,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

// ============================================================================
// 7. CHIP
// ============================================================================

export function Chip({
  label,
  icon,
  active = false,
  onPress,
  tone,
}: {
  label: string;
  icon?: IconName;
  active?: boolean;
  onPress?: () => void;
  tone?: string;
}) {
  const { theme, isDark } = useTheme();
  const activeTone = tone || theme.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active
            ? `${activeTone}${isDark ? "26" : "18"}`
            : theme.surface,
          borderColor: active ? activeTone : theme.borderMuted,
        },
        pressed && styles.buttonPressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? activeTone : theme.textMuted}
          style={styles.chipIcon}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          { color: active ? activeTone : theme.textMuted },
          active && styles.chipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ============================================================================
// 8. LOADING CARD & EMPTY STATE
// ============================================================================

export function LoadingCard({ label = "Syncing with DOOR…" }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <Card style={styles.loading}>
      <ActivityIndicator size="small" color={theme.accent} />
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
      <View style={[styles.emptyIconCircle, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name={icon} size={28} color={theme.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>{description}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </Card>
  );
}

// ============================================================================
// 9. SECTION TITLE & BADGE
// ============================================================================

export function SectionTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={[styles.sectionText, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

export function Badge({
  label,
  tone = "emerald",
  size = "md",
}: {
  label: string;
  tone?: ButtonTone;
  size?: "sm" | "md";
}) {
  const { theme, isDark } = useTheme();

  const getColor = () => {
    switch (tone) {
      case "emerald":
        return theme.emerald;
      case "rose":
        return theme.rose;
      case "amber":
        return theme.amber;
      case "cyan":
        return theme.cyan;
      case "violet":
        return theme.violet;
      default:
        return theme.accent;
    }
  };

  const color = getColor();
  const bg = isDark ? `${color}22` : `${color}14`;

  return (
    <View
      style={[
        styles.badge,
        size === "sm" && styles.badgeSmall,
        { backgroundColor: bg, borderColor: `${color}44` },
      ]}
    >
      <Text style={[styles.badgeText, size === "sm" && styles.badgeTextSmall, { color }]}>
        {label}
      </Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.borderMuted }, style]} />;
}

// ============================================================================
// STYLES
// ============================================================================

export const ui = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mono: { fontVariant: ["tabular-nums"], fontFamily: "monospace" },
});

const styles = StyleSheet.create({
  // Card
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  // Button
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCompact: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm + 2,
    gap: 6,
  },
  buttonLarge: {
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radii.lg,
    gap: 10,
  },
  buttonFullWidth: {
    width: "100%",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  buttonTextCompact: {
    fontSize: 12,
    fontWeight: "700",
  },
  buttonTextLarge: {
    fontSize: 16,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  buttonGhostPressed: {
    opacity: 0.6,
  },
  buttonDisabled: {
    opacity: 0.45,
  },

  // Icon Button
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radii.md,
  },
  iconButtonSmall: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radii.sm + 2,
  },
  iconButtonLarge: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radii.lg,
  },

  // Input
  inputWrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 2,
  },
  inputLabel: {
    fontSize: 11,
    letterSpacing: 0.7,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  requiredAsterisk: {
    fontSize: 12,
    fontWeight: "900",
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: radii.md,
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputContainerCompact: {
    minHeight: 40,
    paddingHorizontal: 11,
    borderRadius: radii.sm + 2,
    gap: 8,
  },
  inputLeftIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  inputField: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
    paddingVertical: 10,
  },
  inputFieldCompact: {
    minHeight: 36,
    fontSize: 13,
    paddingVertical: 6,
  },
  inputActionIcon: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 3,
    marginTop: 2,
  },
  statusIcon: {
    marginTop: 0.5,
  },
  inputErrorText: {
    fontSize: 12,
    fontWeight: "700",
  },
  inputHelperText: {
    fontSize: 12,
    lineHeight: 16,
  },

  // Metric
  metric: { flex: 1, gap: 4 },
  metricValue: { fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
  metricLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  metricSublabel: { fontSize: 10, marginTop: 1 },

  // Progress Bar
  progressTrack: { height: 6.5, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99 },

  // Chip
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm + 2,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chipIcon: {
    marginRight: 2,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  chipTextActive: { fontWeight: "800" },

  // Loading & Empty
  loading: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 10 },
  muted: { fontSize: 13 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 28, textAlign: "center", gap: 10 },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyDescription: { fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 280 },
  emptyAction: { marginTop: 6 },

  // Section Title
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionText: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, lineHeight: 16 },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs + 2,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",    letterSpacing: 0.3,
  },
  badgeTextSmall: {
    fontSize: 9,
    fontWeight: "800",
  },

  // Divider
  divider: {
    height: 1,
    width: "100%",
    marginVertical: spacing.xs,
  },
});
