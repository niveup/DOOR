import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { ActionButton, Chip } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface StudyGoalFormProps {
  initialGoal: string;
  busy: boolean;
  onSave: (val: string) => void;
}

export function StudyGoalForm({ initialGoal, busy, onSave }: StudyGoalFormProps) {
  const { theme, isDark } = useTheme();
  const [goal, setGoal] = useState(initialGoal);
  const presets = ["2", "4", "6", "8"];

  return (
    <View style={styles.formContainer}>
      {/* 1. Header Area */}
      <View style={styles.headerBlock}>
        <Text
          style={[
            styles.sheetTitle,
            { color: isDark ? "#fafafa" : theme.text },
          ]}
        >
          Daily Study Goal
        </Text>
        <Text
          style={[
            styles.sheetSubtitle,
            { color: theme.textMuted },
          ]}
        >
          Set a realistic daily target you can comfortably protect most days.
        </Text>
      </View>

      {/* 2. Quick Presets */}
      <View style={styles.presetsSection}>
        <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
          RECOMMENDED TARGETS
        </Text>
        <View style={styles.horizontalGrid}>
          {presets.map((preset) => (
            <Chip
              key={preset}
              label={`${preset} hours`}
              active={goal === preset}
              tone={theme.emerald}
              onPress={() => setGoal(preset)}
            />
          ))}
        </View>
      </View>

      {/* 3. Custom Goal Numeric Input */}
      <View style={styles.goalInputWrapper}>
        <BottomSheetTextInput
          style={[
            styles.goalBigInput,
            {
              backgroundColor: isDark
                ? theme.surfaceElevated
                : theme.surfaceSubtle,
              borderColor: isDark ? theme.border : theme.borderMuted,
              color: isDark ? "#fafafa" : theme.text,
            },
          ]}
          value={goal}
          onChangeText={setGoal}
          keyboardType="decimal-pad"
          placeholder="4"
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          accessibilityLabel="Daily study goal in hours"
        />
        <Text style={[styles.goalInputUnit, { color: theme.textMuted }]}>
          hours per day
        </Text>
      </View>

      {/* 4. Save Action Button */}
      <View style={styles.actionBlock}>
        <ActionButton
          label={busy ? "Saving…" : "Save Daily Goal"}
          icon="checkmark-circle"
          tone="emerald"
          disabled={busy}
          onPress={() => onSave(goal)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: spacing.md,
  },
  headerBlock: {
    gap: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  sheetTitle: {
    ...typography.largeHeading,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    ...typography.caption,
    fontSize: 12.5,
    lineHeight: 18,
  },
  presetsSection: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  horizontalGrid: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  goalInputWrapper: {
    alignItems: "center",
    gap: spacing.xxs,
    marginVertical: spacing.xs,
  },
  goalBigInput: {
    width: 120,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  goalInputUnit: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "600",
  },
  actionBlock: {
    paddingTop: spacing.xxs,
  },
});
