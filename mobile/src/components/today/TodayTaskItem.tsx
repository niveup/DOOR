import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/providers/theme-provider";
import { fontWeights, radii, spacing, typography } from "@/src/theme/tokens";
import { TagConfigItem, TodoTag } from "./TodayAddTaskForm";

export interface PersonalTodoItem {
  id: string;
  text: string;
  completed: boolean;
  tag: TodoTag;
  durationMin: number;
  createdAt: number;
}

export interface TodayTaskItemProps {
  item: PersonalTodoItem;
  isJustAdded?: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onOpenDurationPicker: () => void;
  tagConfig: Record<TodoTag, TagConfigItem>;
}

export function TodayTaskItem({
  item,
  isJustAdded = false,
  onToggle,
  onLongPress,
  onOpenDurationPicker,
  tagConfig,
}: TodayTaskItemProps) {
  const { theme, isDark } = useTheme();
  const tagCfg = tagConfig[item.tag] || tagConfig.GATE;
  const duration = item.durationMin || 30;

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.completed }}
      accessibilityLabel={`${item.text}, ${duration} minutes, ${tagCfg.label}`}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: isDark ? "#1f1f25" : theme.border,
        },
        isJustAdded && {
          borderColor: isDark ? "rgba(56, 189, 248, 0.5)" : "rgba(2, 132, 199, 0.4)",
          backgroundColor: isDark ? "rgba(56, 189, 248, 0.06)" : "rgba(238, 242, 255, 0.4)",
        },
        item.completed && {
          backgroundColor: isDark ? "#0c0c0f" : "#f8fafc",
          borderColor: isDark ? "#18181c" : theme.borderMuted,
          opacity: 0.65,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* Smooth Circular Checkbox */}
      <View
        style={[
          styles.checkCircle,
          {
            borderColor: isDark ? "#3f3f46" : "#cbd5e1",
          },
          item.completed && {
            borderColor: theme.accent,
            backgroundColor: theme.accent,
          },
        ]}
      >
        {item.completed ? (
          <Ionicons name="checkmark" size={14} color={theme.solidTextDark} />
        ) : null}
      </View>

      {/* Task Content Block */}
      <View style={styles.copyBlock}>
        <Text
          style={[
            styles.titleText,
            { color: isDark ? "#f5f5f7" : theme.text },
            item.completed && [
              styles.titleCompleted,
              { color: theme.textFaint, textDecorationColor: theme.accent },
            ],
          ]}
        >
          {item.text}
        </Text>

        <View style={styles.metaRow}>
          {/* Category Tag Badge */}
          <View
            style={[
              styles.tagBadge,
              {
                backgroundColor: tagCfg.bg,
                borderColor: `${tagCfg.color}35`,
              },
            ]}
          >
            <Ionicons name={tagCfg.icon} size={10} color={tagCfg.color} />
            <Text style={[styles.tagBadgeText, { color: tagCfg.color }]}>
              {tagCfg.label}
            </Text>
          </View>

          {/* Interactive Duration Chip */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onOpenDurationPicker();
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.durationChip,
              {
                backgroundColor: isDark ? "#18181d" : theme.raised,
                borderColor: isJustAdded
                  ? isDark
                    ? theme.cyan
                    : theme.cyan
                  : isDark
                  ? "#2a2a32"
                  : theme.border,
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={11}
              color={isDark ? theme.cyan : theme.accent}
            />
            <Text
              style={[
                styles.durationChipText,
                { color: theme.text },
              ]}
            >
              {duration}m
            </Text>
            <Ionicons
              name="chevron-down"
              size={9}
              color={theme.textFaint}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  copyBlock: {
    flex: 1,
    gap: spacing.xxs,
  },
  titleText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    lineHeight: 20,
  },
  titleCompleted: {
    textDecorationLine: "line-through",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs - 1,
    paddingHorizontal: spacing.xs - 2,
    paddingVertical: spacing.xxs - 2,
    borderRadius: radii.xs + 2,
    borderWidth: 1,
  },
  tagBadgeText: {
    ...typography.label,
    fontSize: 9.5,
  },
  durationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs - 1,
    paddingHorizontal: spacing.xs - 2,
    paddingVertical: spacing.xxs - 2,
    borderRadius: radii.xs + 2,
    borderWidth: 1,
  },
  durationChipText: {
    ...typography.caption,
    fontWeight: fontWeights.bold,
  },
});
