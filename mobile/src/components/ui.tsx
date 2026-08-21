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
import {
  fontWeights,
  layout,
  radii,
  shadows,
  spacing,
  typography,
} from "@/src/theme/tokens";
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

  const isElevated = variant === "elevated";
  const isOutlined = variant === "outlined";

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: isElevated
        ? theme.surfaceElevated
        : isOutlined
        ? "transparent"
        : theme.surface,
      borderColor: isOutlined ? theme.border : theme.border,
      shadowColor: isDark ? "#000000" : "#64748b",
      shadowOpacity: isElevated ? (isDark ? 0.35 : 0.12) : isDark ? 0.22 : 0.06,
      shadowRadius: isElevated ? 12 : 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: isElevated ? (isDark ? 3 : 3) : isDark ? 1 : 2,
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
        return theme.successSoft;
      case "rose":
        return theme.errorSoft;
      case "amber":
        return theme.warningSoft;
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

// ActionButton maintains backwards compatibility with previous signature
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
            backgroundColor: theme.inputBg || theme.surface,
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
            hitSlop={layout.minTouchTarget ? 8 : 8}
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
  const fillColor = tone || theme.accent;
  const numericVal = Number(value) || 0;
  const clampedValue = Math.min(Math.max(numericVal, 0), 100);

  return (
    <View
      style={[
        styles.progressTrack,
        {
          height,
          backgroundColor: isDark ? theme.surfaceSubtle : theme.raised,
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
  return <View style={[styles.divider, { backgroundColor: theme.divider || theme.borderMuted }, style]} />;
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
    borderRadius: radii.card,
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
    minHeight: layout.buttonHeight,
    borderWidth: 1,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCompact: {
    minHeight: layout.buttonHeightSm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    borderRadius: radii.control,
    gap: spacing.xxs + 2,
  },
  buttonLarge: {
    minHeight: layout.buttonHeightLg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  buttonFullWidth: {
    width: "100%",
  },
  buttonText: {
    ...typography.button,
  },
  buttonTextCompact: {
    ...typography.buttonSmall,
  },
  buttonTextLarge: {
    ...typography.buttonLarge,
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
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radii.button,
  },
  iconButtonSmall: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radii.control,
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
    gap: spacing.xxs + 2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: 2,
  },
  inputLabel: {
    ...typography.label,
  },
  requiredAsterisk: {
    fontSize: 12,
    fontWeight: fontWeights.black,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: radii.input,
    minHeight: layout.inputHeight,
    paddingHorizontal: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  inputContainerCompact: {
    minHeight: layout.inputHeightCompact,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control,
    gap: spacing.xs,
  },
  inputLeftIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  inputField: {
    flex: 1,
    minHeight: 44,
    ...typography.body,
    paddingVertical: spacing.xs,
  },
  inputFieldCompact: {
    minHeight: 36,
    ...typography.bodySmall,
    paddingVertical: spacing.xxs,
  },
  inputActionIcon: {
    padding: spacing.xxs,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs + 1,
    paddingHorizontal: 3,
    marginTop: 2,
  },
  statusIcon: {
    marginTop: 0.5,
  },
  inputErrorText: {
    ...typography.caption,
    fontWeight: fontWeights.bold,
  },
  inputHelperText: {
    ...typography.caption,
  },

  // Metric
  metric: { flex: 1, gap: spacing.xxs },
  metricValue: { ...typography.metric },
  metricLabel: { ...typography.label },
  metricSublabel: { ...typography.caption, marginTop: 1 },

  // Progress Bar
  progressTrack: { height: 6.5, borderRadius: radii.full, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radii.full },

  // Chip
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs - 2,
  },
  chipIcon: {
    marginRight: 2,
  },
  chipText: { ...typography.caption, fontWeight: fontWeights.semibold },
  chipTextActive: { fontWeight: fontWeights.heavy },

  // Loading & Empty
  loading: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  muted: { ...typography.bodySmall },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl, textAlign: "center", gap: spacing.sm },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
  },
  emptyTitle: { ...typography.subheading, fontWeight: fontWeights.heavy, textAlign: "center" },
  emptyDescription: { ...typography.bodySmall, textAlign: "center", maxWidth: 280 },
  emptyAction: { marginTop: spacing.xs },

  // Section Title
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: spacing.xxs,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionText: { ...typography.subheading, fontWeight: fontWeights.heavy },
  sectionSubtitle: { ...typography.caption },

  // Badge
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs - 1,
    borderRadius: radii.xs + 2,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeSmall: {
    paddingHorizontal: spacing.xs - 2,
    paddingVertical: spacing.xxs - 2,
    borderRadius: radii.xs,
  },
  badgeText: {
    ...typography.label,
  },
  badgeTextSmall: {
    ...typography.label,
    fontSize: 9,
  },

  // Divider
  divider: {
    height: 1,
    width: "100%",
    marginVertical: spacing.xs,
  },
});

