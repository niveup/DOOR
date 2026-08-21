import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { ActionButton, Chip } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";
import { todayInKolkata } from "@/src/lib/format";
import { TrackerSubject } from "@/src/types/domain";

export interface StudyLogFormProps {
  subjects: TrackerSubject[];
  busy: boolean;
  onSave: (data: {
    logDate: string;
    timeBlock: string;
    subjectId: number;
    subjectName: string;
    hoursStudied: number;
    questionsSolved: number;
    notes: string;
  }) => void;
}

export function StudyLogForm({ subjects, busy, onSave }: StudyLogFormProps) {
  const { theme, isDark } = useTheme();
  const [selected, setSelected] = useState<TrackerSubject | null>(
    subjects[0] || null
  );
  const [customSubject, setCustomSubject] = useState("");
  const [timeBlock, setTimeBlock] = useState("Morning");
  const [hours, setHours] = useState("1");
  const [questions, setQuestions] = useState("0");
  const [notes, setNotes] = useState("");

  const timeBlocks = ["Morning", "Afternoon", "Evening", "Night"];
  const durationPresets = ["0.5", "1", "1.5", "2", "3"];

  const handleSave = () => {
    const finalSubjectName =
      selected?.subjectName || customSubject.trim() || "General Study";
    const finalSubjectId = selected?.subjectId || 1;
    onSave({
      logDate: todayInKolkata(),
      timeBlock,
      subjectId: finalSubjectId,
      subjectName: finalSubjectName,
      hoursStudied: Math.max(0.1, Number(hours) || 1),
      questionsSolved: Math.max(0, Number(questions) || 0),
      notes: notes.trim(),
    });
  };

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
          Log Study Session
        </Text>
        <Text
          style={[
            styles.sheetSubtitle,
            { color: theme.textMuted },
          ]}
        >
          Record your focused block to update readiness and track goal progress.
        </Text>
      </View>

      {/* 2. Subject Selection */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
          SUBJECT
        </Text>
        {subjects.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalChipRow}
          >
            {subjects.map((subject) => (
              <Chip
                key={subject.subjectId}
                label={subject.subjectName}
                active={selected?.subjectId === subject.subjectId}
                tone={theme.cyan}
                onPress={() => setSelected(subject)}
              />
            ))}
          </ScrollView>
        ) : (
          <BottomSheetTextInput
            style={[
              styles.inputField,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.border : theme.borderMuted,
                color: isDark ? "#fafafa" : theme.text,
              },
            ]}
            value={customSubject}
            onChangeText={setCustomSubject}
            placeholder="e.g. Operating Systems"
            placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
            autoCapitalize="sentences"
          />
        )}
      </View>

      {/* 3. Duration Presets */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
          DURATION PRESET
        </Text>
        <View style={styles.horizontalGrid}>
          {durationPresets.map((preset) => (
            <Chip
              key={preset}
              label={`${preset}h`}
              active={hours === preset}
              tone={theme.cyan}
              onPress={() => setHours(preset)}
            />
          ))}
        </View>
      </View>

      {/* 4. Time Block Selection */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
          TIME OF DAY
        </Text>
        <View style={styles.horizontalGrid}>
          {timeBlocks.map((block) => (
            <Chip
              key={block}
              label={block}
              active={timeBlock === block}
              tone={theme.emerald}
              onPress={() => setTimeBlock(block)}
            />
          ))}
        </View>
      </View>

      {/* 5. Exact Numbers Row (Hours & Questions) */}
      <View style={styles.twoColumnFields}>
        <View style={styles.columnField}>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
            EXACT HOURS
          </Text>
          <BottomSheetTextInput
            style={[
              styles.inputField,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.border : theme.borderMuted,
                color: isDark ? "#fafafa" : theme.text,
              },
            ]}
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          />
        </View>

        <View style={styles.columnField}>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
            QUESTIONS SOLVED
          </Text>
          <BottomSheetTextInput
            style={[
              styles.inputField,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.border : theme.borderMuted,
                color: isDark ? "#fafafa" : theme.text,
              },
            ]}
            value={questions}
            onChangeText={setQuestions}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          />
        </View>
      </View>

      {/* 6. Notes Field */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
          NOTE (OPTIONAL)
        </Text>
        <BottomSheetTextInput
          style={[
            styles.inputField,
            styles.multilineInput,
            {
              backgroundColor: isDark
                ? theme.surfaceElevated
                : theme.surfaceSubtle,
              borderColor: isDark ? theme.border : theme.borderMuted,
              color: isDark ? "#fafafa" : theme.text,
            },
          ]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Topics covered, problem areas, or formulas revised"
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
        />
      </View>

      {/* 7. Save Action Button */}
      <View style={styles.actionBlock}>
        <ActionButton
          label={busy ? "Saving…" : "Save Study Session"}
          icon="checkmark-circle"
          tone="emerald"
          disabled={busy}
          onPress={handleSave}
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
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  horizontalChipRow: {
    gap: spacing.xs,
    paddingBottom: 2,
  },
  horizontalGrid: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  twoColumnFields: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  columnField: {
    flex: 1,
    gap: spacing.xs,
  },
  inputField: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 13.5,
  },
  multilineInput: {
    height: 76,
    textAlignVertical: "top",
    paddingTop: spacing.xs,
  },
  actionBlock: {
    paddingTop: spacing.xxs,
  },
});
