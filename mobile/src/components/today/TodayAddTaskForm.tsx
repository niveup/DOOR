import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/providers/theme-provider";
import { fontWeights, radii, spacing, typography } from "@/src/theme/tokens";

export type TodoTag = "GATE" | "College" | "Personal";

export interface TagConfigItem {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface TodayAddTaskFormProps {
  newTodoText: string;
  setNewTodoText: (text: string) => void;
  selectedTag: TodoTag;
  onSelectTag: (tag: TodoTag) => void;
  customDuration: number;
  onOpenDurationDialer: () => void;
  onSave: () => void;
  tagConfig: Record<TodoTag, TagConfigItem>;
}

export function TodayAddTaskForm({
  newTodoText,
  setNewTodoText,
  selectedTag,
  onSelectTag,
  customDuration,
  onOpenDurationDialer,
  onSave,
  tagConfig,
}: TodayAddTaskFormProps) {
  const { theme, isDark } = useTheme();
  const hasText = newTodoText.trim().length > 0;
  const activeCfg = tagConfig[selectedTag] || tagConfig.GATE;

  const handleSelectTag = (t: TodoTag) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onSelectTag(t);
  };

  const handleSave = () => {
    if (!hasText) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onSave();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: hasText
            ? isDark
              ? "rgba(16, 185, 129, 0.4)"
              : theme.accent
            : isDark
            ? "#27272a"
            : theme.border,
        },
      ]}
    >
      {/* 1. Header Micro-Bar: Category context, Duration Selector & Dismiss */}
      <View style={styles.topBar}>
        <View
          style={[
            styles.activeTagBadge,
            {
              backgroundColor: activeCfg.bg,
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : activeCfg.color,
            },
          ]}
        >
          <Ionicons name={activeCfg.icon} size={11} color={activeCfg.color} />
          <Text style={[styles.activeTagBadgeText, { color: activeCfg.color }]}>
            {activeCfg.label.toUpperCase()} FOCUS
          </Text>
        </View>

        <View style={styles.topBarRight}>
          {/* Duration Selector placed in top bar to prevent any overlap with category pills */}
          <Pressable
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              onOpenDurationDialer();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Set target duration, currently ${customDuration} minutes`}
            style={({ pressed }) => [
              styles.durationPill,
              {
                backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
                borderColor: isDark ? "#27272a" : theme.border,
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={12}
              color={isDark ? theme.cyan : theme.accent}
            />
            <Text
              style={[
                styles.durationPillText,
                { color: isDark ? "#fafafa" : theme.text },
              ]}
            >
              {customDuration}m
            </Text>
            <Ionicons name="chevron-down" size={10} color={theme.textFaint} />
          </Pressable>

        </View>
      </View>

      {/* 2. Spacious Unboxed Input Row with Floating Submit Action */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.inputField, { color: isDark ? "#fafafa" : theme.text }]}
          value={newTodoText}
          onChangeText={setNewTodoText}
          placeholder="What do you need to focus on?"
          placeholderTextColor={theme.textFaint}
          autoFocus={true}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Pressable
          onPress={handleSave}
          disabled={!hasText}
          accessibilityRole="button"
          accessibilityLabel="Save task"
          style={({ pressed }) => [
            styles.actionCircle,
            hasText
              ? {
                  backgroundColor: theme.accent,
                  borderColor: theme.accent,
                  shadowColor: theme.accent,
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 3,
                }
              : {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.04)"
                    : "rgba(0, 0, 0, 0.04)",
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.07)"
                    : "rgba(0, 0, 0, 0.06)",
                },
            pressed && hasText && { transform: [{ scale: 0.92 }], opacity: 0.88 },
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={16}
            color={hasText ? theme.solidTextDark : theme.textFaint}
          />
        </Pressable>
      </View>

      {/* 3. Subtle Hairline Divider */}
      <View
        style={[
          styles.divider,
          { backgroundColor: isDark ? "#1f1f25" : theme.borderMuted },
        ]}
      />

      {/* 4. Category Selector Row (Full-width 3-segment pills, zero overlap!) */}
      <View style={styles.categoryRow}>
        {(["GATE", "College", "Personal"] as const).map((t) => {
          const active = selectedTag === t;
          const cfg = tagConfig[t];
          return (
            <Pressable
              key={t}
              onPress={() => handleSelectTag(t)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${cfg.label} category`}
              style={({ pressed }) => [
                styles.categoryPill,
                {
                  backgroundColor: active
                    ? cfg.bg
                    : isDark
                    ? "#18181d"
                    : theme.surfaceSubtle,
                  borderColor: active
                    ? cfg.color
                    : isDark
                    ? "#27272a"
                    : theme.border,
                },
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons
                name={cfg.icon}
                size={13}
                color={active ? cfg.color : theme.textFaint}
              />
              <Text
                style={[
                  styles.categoryPillText,
                  { color: active ? cfg.color : theme.textMuted },
                  active && { fontWeight: "700" },
                ]}
                numberOfLines={1}
              >
                {cfg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs + 2,
    width: "100%",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  activeTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  activeTagBadgeText: {
    ...typography.caption,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  durationPillText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: fontWeights.bold,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  inputField: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: "500",
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  actionCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    width: "100%",
  },
  categoryPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  categoryPillText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: fontWeights.semibold,
  },
});
