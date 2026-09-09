import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
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
}

const TAGS: { key: TodoTag; label: string }[] = [
  { key: "GATE", label: "GATE" },
  { key: "College", label: "College" },
  { key: "Personal", label: "Personal" },
];

export function TodayAddTaskForm({
  newTodoText,
  setNewTodoText,
  selectedTag,
  onSelectTag,
  customDuration,
  onOpenDurationDialer,
  onSave,
}: TodayAddTaskFormProps) {
  const { theme, isDark } = useTheme();
  const hasText = newTodoText.trim().length > 0;

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
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(140)}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: isDark ? "#27272a" : theme.border,
        },
      ]}
    >
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: isDark ? "#fafafa" : theme.text }]}
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
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onOpenDurationDialer();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Set target duration, currently ${customDuration} minutes`}
          style={({ pressed }) => [
            styles.durationPill,
            { backgroundColor: isDark ? "#1b1b20" : theme.surfaceSubtle },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.durationText, { color: theme.textMuted }]}>
            {customDuration}m
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={!hasText}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Save task"
          style={({ pressed }) => [
            styles.actionCircle,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.10)"
                : "rgba(0, 0, 0, 0.07)",
              opacity: hasText ? 1 : 0.45,
            },
            pressed && hasText && { transform: [{ scale: 0.92 }], opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={16}
            color={hasText ? (isDark ? "#fafafa" : theme.text) : theme.textFaint}
          />
        </Pressable>
      </View>

      {hasText ? (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOutDown.duration(120)}
          style={[
            styles.segRow,
            { backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle },
          ]}
        >
          {TAGS.map((t) => {
            const active = selectedTag === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => handleSelectTag(t.key)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${t.label} category`}
                style={({ pressed }) => [
                  styles.segItem,
                  active && {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.09)"
                      : "rgba(0, 0, 0, 0.06)",
                  },
                  pressed && !active && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    { color: active ? (isDark ? "#fafafa" : theme.text) : theme.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    width: "100%",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: "500",
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  durationPill: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  durationText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: fontWeights.semibold,
    fontVariant: ["tabular-nums"],
  },
  actionCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  segRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: radii.full,
  },
  segItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: radii.full,
  },
  segText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: fontWeights.semibold,
  },
});
