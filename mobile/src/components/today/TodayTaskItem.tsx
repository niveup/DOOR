import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@/src/components/app-icon";
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
  editing?: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onOpenDurationPicker: () => void;
  onBeginEdit?: () => void;
  onEndEdit?: () => void;
  onRename: (newTitle: string) => void;
  tagConfig: Record<TodoTag, TagConfigItem>;
}

export function TodayTaskItem({
  item,
  isJustAdded = false,
  editing = false,
  onToggle,
  onLongPress,
  onOpenDurationPicker,
  onBeginEdit,
  onEndEdit,
  onRename,
  tagConfig,
}: TodayTaskItemProps) {
  const { theme, isDark } = useTheme();
  const tagCfg = tagConfig[item.tag] || tagConfig.GATE;
  const duration = item.durationMin || 30;
  const [draft, setDraft] = useState(item.text);
  const lastInnerTap = useRef(0);

  const markInnerTap = () => {
    lastInnerTap.current = Date.now();
  };

  const handleRowPress = () => {
    if (Date.now() - lastInnerTap.current < 500) return;
    if (editing) commitEdit();
    else onToggle();
  };

  useEffect(() => {
    if (!editing) setDraft(item.text);
  }, [editing, item.text]);

  const beginEdit = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setDraft(item.text);
    onBeginEdit?.();
  };

  const commitEdit = () => {
    if (!editing) return;
    onEndEdit?.();
    const title = draft.trim();
    if (title && title !== item.text) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onRename(title);
    }
  };

  return (
    <Pressable
      onPress={handleRowPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.completed }}
      accessibilityLabel={`${item.text}, ${duration} minutes, ${tagCfg.label}`}
      style={[
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
      ]}
    >
      <Animated.View
        entering={isJustAdded ? FadeInDown.duration(220) : undefined}
        style={styles.rowInner}
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
        {editing ? (
          <TextInput
            style={[
              styles.titleText,
              styles.titleInput,
              {
                color: isDark ? "#f5f5f7" : theme.text,
                borderColor: theme.accent,
              },
            ]}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
            maxLength={180}
            onSubmitEditing={commitEdit}
            onBlur={commitEdit}
          />
        ) : (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              markInnerTap();
              beginEdit();
            }}
            onLongPress={(e) => {
              e.stopPropagation();
              onLongPress();
            }}
            delayLongPress={250}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            accessibilityRole="button"
            accessibilityLabel={`Edit task ${item.text}`}
          >
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
          </Pressable>
        )}

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            markInnerTap();
            onOpenDurationPicker();
          }}
          onLongPress={(e) => {
            e.stopPropagation();
            onLongPress();
          }}
          delayLongPress={250}
          hitSlop={{ top: 6, bottom: 6, left: 2, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Change duration, currently ${duration} minutes`}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.metaText, { color: theme.textFaint }]}>
            {tagCfg.label} · {duration}m
          </Text>
        </Pressable>
      </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: 0,
  },
  copyBlock: {
    flex: 1,
    gap: spacing.xxs,
    paddingLeft: 2,
  },
  titleText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    lineHeight: 20,
  },
  titleCompleted: {
    textDecorationLine: "line-through",
  },
  titleInput: {
    borderBottomWidth: 1,
    paddingVertical: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    marginBottom: -1,
    marginRight: 8,
  },
  metaText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: fontWeights.medium,
    fontVariant: ["tabular-nums"],
  },
});
