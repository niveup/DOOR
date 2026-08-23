import React, { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, IconName } from "@/src/components/app-icon";
import { useTheme } from "@/src/providers/theme-provider";
import { colors } from "@/src/theme/tokens";

export interface SettingsRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  accessory?: "chevron" | "none" | ReactNode;
  destructive?: boolean;
  status?: "success" | "warning" | "error" | "neutral";
  titleExtra?: ReactNode;
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  accessory = "chevron",
  destructive = false,
  status,
  titleExtra,
  children,
  accessibilityLabel,
  accessibilityHint,
}: SettingsRowProps) {
  const { theme, isDark } = useTheme();

  const isInteractive = Boolean(onPress);

  const iconColor = destructive
    ? colors.rose
    : isDark
    ? "#A1A1AA"
    : theme.textMuted;

  const iconTileBg = destructive
    ? isDark
      ? "rgba(244, 63, 94, 0.12)"
      : "rgba(244, 63, 94, 0.08)"
    : isDark
    ? "#18181D"
    : "#f1f5f9";

  const iconTileBorder = destructive
    ? isDark
      ? "rgba(244, 63, 94, 0.25)"
      : "rgba(244, 63, 94, 0.20)"
    : isDark
    ? "#26262D"
    : "#e2e8f0";

  const titleColor = destructive
    ? colors.rose
    : isDark
    ? "#FAFAFA"
    : theme.text;

  const chevronColor = destructive
    ? colors.rose
    : isDark
    ? "#71717A"
    : theme.textFaint;

  const content = (
    <View style={styles.innerContainer}>
      {/* Neutral Icon Tile */}
      <View
        style={[
          styles.iconTile,
          {
            backgroundColor: iconTileBg,
            borderColor: iconTileBorder,
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      {/* Title & Subtitle Column */}
      <View style={styles.textColumn}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, { color: titleColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {titleExtra}
        </View>
        {Boolean(subtitle) && (
          <Text
            style={[
              styles.subtitle,
              { color: isDark ? "#A1A1AA" : theme.textMuted },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Trailing Accessory / Value / Children */}
      {children ? (
        <View style={styles.trailingWrapper}>{children}</View>
      ) : (
        <View style={styles.trailingWrapper}>
          {status && (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    status === "success"
                      ? isDark
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(5, 150, 105, 0.08)"
                      : status === "warning"
                      ? isDark
                        ? "rgba(245, 158, 11, 0.12)"
                        : "rgba(217, 119, 6, 0.08)"
                      : status === "error"
                      ? isDark
                        ? "rgba(244, 63, 94, 0.12)"
                        : "rgba(225, 29, 72, 0.08)"
                      : isDark
                      ? "#18181D"
                      : "#f1f5f9",
                  borderColor:
                    status === "success"
                      ? colors.emerald
                      : status === "warning"
                      ? colors.amber
                      : status === "error"
                      ? colors.rose
                      : isDark
                      ? "#26262D"
                      : "#e2e8f0",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      status === "success"
                        ? colors.emerald
                        : status === "warning"
                        ? colors.amber
                        : status === "error"
                        ? colors.rose
                        : isDark
                        ? "#A1A1AA"
                        : theme.textMuted,
                  },
                ]}
              >
                {value || (status === "success" ? "Active" : status)}
              </Text>
            </View>
          )}

          {!status && Boolean(value) && (
            <Text
              style={[
                styles.valueText,
                { color: isDark ? "#A1A1AA" : theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {value}
            </Text>
          )}

          {typeof accessory === "string" ? (
            accessory === "chevron" ? (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={chevronColor}
                style={styles.chevron}
              />
            ) : null
          ) : (
            accessory
          )}
        </View>
      )}
    </View>
  );

  if (isInteractive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          styles.rowPressable,
          pressed && {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.03)"
              : "rgba(0, 0, 0, 0.02)",
            opacity: 0.85,
          },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.rowStatic}>{content}</View>;
}

export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.groupContainer}>
      {Boolean(title) && (
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          {title}
        </Text>
      )}
      <View
        style={[
          styles.groupCard,
          {
            backgroundColor: isDark ? "#121215" : "#ffffff",
            borderColor: isDark ? "#222226" : "#e2e8f0",
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function SettingsDivider() {
  const { isDark } = useTheme();
  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  groupContainer: {
    gap: 8,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    marginTop: 12,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  rowPressable: {
    minHeight: 60,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowStatic: {
    minHeight: 60,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  innerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 14.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "400",
  },
  trailingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 4,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "500",
  },
  chevron: {
    marginLeft: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
});
