import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { fontWeights, layout, radii, spacing, typography } from "@/src/theme/tokens";

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
  onCancel: () => void;
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

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#141418" : theme.surface,
          borderColor: isDark ? "#24242a" : theme.border,
        },
      ]}
    >
      {/* Input Field Container */}
      <View
        style={[
          styles.inputRowContainer,
          {
            backgroundColor: isDark ? "#09090b" : theme.canvas,
            borderColor: hasText
              ? isDark
                ? theme.borderFocus
                : theme.borderFocus
              : theme.borderMuted,
          },
        ]}
      >
        <TextInput
          style={[styles.inputField, { color: theme.text }]}
          value={newTodoText}
          onChangeText={setNewTodoText}
          placeholder="What do you need to focus on?"
          placeholderTextColor={theme.textFaint}
          autoFocus={true}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={onSave}
        />

        <Pressable
          onPress={onSave}
          disabled={!hasText}
          accessibilityRole="button"
          accessibilityLabel="Save task"
          style={({ pressed }) => [
            styles.doneButton,
            hasText
              ? {
                  backgroundColor: theme.accent,
                  borderColor: theme.accent,
                }
              : {
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : theme.raised,
                  borderColor: theme.borderMuted,
                  opacity: 0.4,
                },
            pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
          ]}
        >
          <Ionicons
            name="checkmark"
            size={16}
            color={hasText ? theme.solidTextDark : theme.textFaint}
          />
        </Pressable>
      </View>

      {/* Tag Selection & Duration Trigger Row */}
      <View style={styles.tagAndDurationRow}>
        {/* 3 Tag Chips: GATE, College, Personal */}
        <View style={styles.tagChipsContainer}>
          {(["GATE", "College", "Personal"] as const).map((t) => {
            const active = selectedTag === t;
            const cfg = tagConfig[t];
            return (
              <Pressable
                key={t}
                onPress={() => onSelectTag(t)}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: active
                      ? cfg.bg
                      : isDark
                      ? "#18181d"
                      : theme.canvas,
                    borderColor: active
                      ? cfg.color
                      : theme.borderMuted,
                  },
                ]}
              >
                <Ionicons
                  name={cfg.icon}
                  size={13}
                  color={active ? cfg.color : theme.textFaint}
                />
                <Text
                  style={[
                    styles.tagChipText,
                    { color: active ? cfg.color : theme.textMuted },
                    active && { fontWeight: "800" },
                  ]}
                  numberOfLines={1}
                >
                  {cfg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Target Duration Selector Button */}
        <Pressable
          onPress={onOpenDurationDialer}
          style={[
            styles.durationTrigger,
            {
              backgroundColor: isDark ? "#18181d" : theme.raised,
              borderColor: isDark ? "#2a2a32" : theme.border,
            },
          ]}
        >
          <Ionicons
            name="time-outline"
            size={13}
            color={isDark ? theme.cyan : theme.accent}
          />
          <Text
            style={[
              styles.durationTriggerText,
              { color: theme.text },
            ]}
          >
            {customDuration}m
          </Text>
          <Ionicons
            name="chevron-down"
            size={11}
            color={theme.textFaint}
          />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.sm,
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    width: "100%",
  },
  inputRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.control + 2,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xxs,
    height: layout.inputHeightCompact + 4,
    width: "100%",
    gap: spacing.xs,
  },
  inputField: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    ...typography.body,
    paddingVertical: 0,
    paddingRight: spacing.xxs,
  },
  doneButton: {
    width: 32,
    height: 32,
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tagAndDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tagChipsContainer: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xxs + 2,
  },
  tagChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs,
    paddingVertical: spacing.xs - 1,
    borderRadius: radii.control,
    borderWidth: 1,
  },
  tagChipText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
  },
  durationTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: spacing.xs - 2,
    borderRadius: radii.control,
    borderWidth: 1,
  },
  durationTriggerText: {
    ...typography.caption,
    fontWeight: fontWeights.bold,
  },
});
