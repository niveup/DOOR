import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/src/components/app-icon";
import * as Haptics from "expo-haptics";
import { AppScreen } from "@/src/components/screen";
import { useAuth } from "@/src/providers/auth-provider";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { colors } from "@/src/theme/tokens";
import { queryPersister } from "@/src/services/query-client";
import { api } from "@/src/services/api";
import { AppSettings, TrackerStatus } from "@/src/types/domain";
import {
  SettingsRow,
  SettingsGroup,
  SettingsDivider,
} from "@/src/components/profile/settings-row";

const backendUrl = process.env.EXPO_PUBLIC_API_URL || "https://api.door.app";

const EXAM_PRESETS = ["GATE", "ISRO", "BARC", "PSU", "ESE / IES", "Other"];
const YEAR_PRESETS = [2026, 2027, 2028, 2029];
const STREAM_PRESETS = [
  "Mechanical",
  "Computer Science / IT",
  "Electrical (EE)",
  "Electronics (ECE)",
  "Civil",
  "Chemical",
];
const STAGE_PRESETS = [
  "Concept Building",
  "Problem Solving & PYQs",
  "Test Series & Mocks",
  "Final Revision",
];
const HOUR_PRESETS = [2.0, 4.0, 6.0, 8.0, 10.0, 12.0];
const WAKE_PRESETS = ["05:00", "05:30", "06:00", "06:30", "07:00"];
const SLEEP_PRESETS = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00"];
const EXERCISE_PRESETS = [
  "30 min Morning Workout",
  "Evening Run / Jog",
  "Yoga & Stretching",
  "Light Walk & Core",
  "Rest / Active Recovery",
];

type ActiveSheet =
  | null
  | "name"
  | "exam_year"
  | "stream_level"
  | "daily_goal"
  | "sleep_routine"
  | "target_rank"
  | "fitness"
  | "full_cockpit"
  | "score_weights"
  | "streak_freeze"
  | "comeback_protocol"
  | "full_engine";

const STREAK_REASONS = [
  "Semester Exams",
  "Illness / Recovery",
  "Travel / Family",
  "Mental Rest & Reset",
  "Emergency",
];

const STREAK_DURATIONS = [3, 7, 14, 30];
const COMEBACK_THRESHOLDS = [2, 3, 5, 7];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function calculateSleepDuration(wake: string, sleep: string): string {
  try {
    const [wH, wM] = wake.split(":").map(Number);
    const [sH, sM] = sleep.split(":").map(Number);
    let wakeMin = (wH || 0) * 60 + (wM || 0);
    let sleepMin = (sH || 0) * 60 + (sM || 0);
    if (wakeMin <= sleepMin) {
      wakeMin += 24 * 60;
    }
    const diffMin = wakeMin - sleepMin;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } catch {
    return "8h";
  }
}

function InfoButton({
  title,
  message,
  isDark,
  color,
}: {
  title: string;
  message: string;
  isDark: boolean;
  color?: string;
}) {
  const notify = useNotify();
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        notify.info(title, message);
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Info about ${title}`}
      style={styles.infoCircleBtn}
    >
      <Ionicons
        name="information-circle-outline"
        size={16}
        color={color || (isDark ? "#71717A" : "#94a3b8")}
      />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { lock, unlocked } = useAuth();
  const client = useQueryClient();
  const notify = useNotify();
  const { theme, isDark } = useTheme();

  const [testingPing, setTestingPing] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // Form State
  const [formName, setFormName] = useState("GATE Aspirant");
  const [formExam, setFormExam] = useState("GATE");
  const [formYear, setFormYear] = useState(2026);
  const [formStream, setFormStream] = useState("Mechanical");
  const [formStage, setFormStage] = useState("Concept Building");
  const [formTargetRank, setFormTargetRank] = useState("AIR < 100");
  const [formHours, setFormHours] = useState(4.0);
  const [formWakeTime, setFormWakeTime] = useState("06:00");
  const [formSleepTime, setFormSleepTime] = useState("22:00");
  const [formExerciseGoal, setFormExerciseGoal] = useState("30 min Morning Workout");

  // Tracker & Engine Form State
  const [formStudyWeight, setFormStudyWeight] = useState(60);
  const [formExerciseWeight, setFormExerciseWeight] = useState(15);
  const [formReadingWeight, setFormReadingWeight] = useState(10);
  const [formRoutineWeight, setFormRoutineWeight] = useState(15);

  const [formStreakActive, setFormStreakActive] = useState(false);
  const [formStreakReason, setFormStreakReason] = useState("Semester Exams");
  const [formStreakDurationDays, setFormStreakDurationDays] = useState(7);

  const [formComebackThreshold, setFormComebackThreshold] = useState(3);
  const [formComebackAuto, setFormComebackAuto] = useState(true);

  // Fetch settings & tracker info
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
    enabled: unlocked,
    staleTime: 10_000,
  });

  const trackerQuery = useQuery({
    queryKey: ["tracker"],
    queryFn: api.tracker.status,
    enabled: unlocked,
    staleTime: 10_000,
  });

  // Effective values
  const currentName = settingsQuery.data?.name || "GATE Aspirant";
  const currentExam = settingsQuery.data?.targetExam || "GATE";
  const currentYear = settingsQuery.data?.targetYear || 2026;
  const currentStream = settingsQuery.data?.otherGoals?.branch || "Mechanical";
  const currentStage = settingsQuery.data?.prepLevel || "Concept Building";
  const currentTargetRank = settingsQuery.data?.otherGoals?.targetRank || "AIR < 100";
  const dailyGoal = Number(
    settingsQuery.data?.dailyAvailableHours ?? trackerQuery.data?.dailyAvailableHours ?? 4
  );
  const currentWakeTime = settingsQuery.data?.wakeTime || "06:00";
  const currentSleepTime = settingsQuery.data?.sleepTime || "22:00";
  const currentExerciseGoal = settingsQuery.data?.exerciseGoal || "30 min Morning Workout";
  const sleepWindow = calculateSleepDuration(currentWakeTime, currentSleepTime);

  // Engine effective values
  const currentScoreWeights = {
    study: Number(settingsQuery.data?.scoreWeights?.study ?? 60),
    exercise: Number(settingsQuery.data?.scoreWeights?.exercise ?? 15),
    reading: Number(settingsQuery.data?.scoreWeights?.reading ?? 10),
    routine: Number(settingsQuery.data?.scoreWeights?.routine ?? 15),
  };

  const currentStreakFreeze = {
    active: Boolean(settingsQuery.data?.otherGoals?.streakFreeze?.active),
    reason: settingsQuery.data?.otherGoals?.streakFreeze?.reason || "Semester Exams",
    durationDays: Number(settingsQuery.data?.otherGoals?.streakFreeze?.durationDays ?? 7),
    untilDate: settingsQuery.data?.otherGoals?.streakFreeze?.untilDate || null,
    leftCount: Number(settingsQuery.data?.otherGoals?.streakFreeze?.leftCount ?? 2),
  };

  const currentComeback = {
    thresholdDays: Number(settingsQuery.data?.otherGoals?.comeback?.thresholdDays ?? 3),
    autoTrigger: settingsQuery.data?.otherGoals?.comeback?.autoTrigger !== false,
  };

  const totalWeights =
    formStudyWeight + formExerciseWeight + formReadingWeight + formRoutineWeight;

  // Open focused sheet
  const openSheet = (sheet: ActiveSheet) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFormName(currentName);
    setFormExam(currentExam);
    setFormYear(currentYear);
    setFormStream(currentStream);
    setFormStage(currentStage);
    setFormTargetRank(currentTargetRank);
    setFormHours(dailyGoal);
    setFormWakeTime(currentWakeTime);
    setFormSleepTime(currentSleepTime);
    setFormExerciseGoal(currentExerciseGoal);

    // Engine fields
    setFormStudyWeight(currentScoreWeights.study);
    setFormExerciseWeight(currentScoreWeights.exercise);
    setFormReadingWeight(currentScoreWeights.reading);
    setFormRoutineWeight(currentScoreWeights.routine);

    setFormStreakActive(currentStreakFreeze.active);
    setFormStreakReason(currentStreakFreeze.reason);
    setFormStreakDurationDays(currentStreakFreeze.durationDays);

    setFormComebackThreshold(currentComeback.thresholdDays);
    setFormComebackAuto(currentComeback.autoTrigger);

    setActiveSheet(sheet);
  };

  // Quick adjust study hours (+/- 0.5h) directly from row
  const adjustDailyHours = (delta: number) => {
    const currentVal = Number(
      settingsQuery.data?.dailyAvailableHours ?? trackerQuery.data?.dailyAvailableHours ?? 4
    );
    const nextHours = Math.max(1.0, Math.min(16.0, Number((currentVal + delta).toFixed(1))));
    if (nextHours === currentVal) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Instantly update React Query caches for 0ms UI lag
    client.setQueryData<AppSettings>(["settings"], (old) =>
      old ? { ...old, dailyAvailableHours: nextHours } : undefined
    );
    client.setQueryData<TrackerStatus>(["tracker"], (old) =>
      old ? { ...old, dailyAvailableHours: nextHours } : undefined
    );

    // Persist to API in background without blocking UI or showing spam toasts
    Promise.all([
      api.settings.save({
        name: currentName || "GATE Aspirant",
        dailyAvailableHours: nextHours,
      }),
      api.tracker.goal(nextHours),
    ]).catch(() => {
      // Revert on failure
      client.invalidateQueries({ queryKey: ["settings"] });
      client.invalidateQueries({ queryKey: ["tracker"] });
    });
  };

  // Quick trigger comeback routine
  const handleTriggerComebackRoutine = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await api.routine.addTask({
        title: "⚡ 30-Min Re-entry Momentum Session (Key PYQs Review)",
        durationMin: 30,
      });
      client.invalidateQueries({ queryKey: ["routine"] });
      notify.success(
        "Comeback Plan Active",
        "30-min low-friction momentum task added to your dashboard."
      );
      setActiveSheet(null);
    } catch (err: any) {
      notify.error("Trigger Failed", err?.message || "Could not add comeback task.");
    }
  };

  // Save specific focused sheet
  const handleSave = async (sheetType: ActiveSheet) => {
    if (!sheetType) return;
    try {
      setSavingField(true);
      const payload: Partial<AppSettings> = {
        name: formName.trim() || currentName || "GATE Aspirant",
      };

      if (sheetType === "name" || sheetType === "full_cockpit") {
        payload.name = formName.trim() || "GATE Aspirant";
      }
      if (sheetType === "exam_year" || sheetType === "full_cockpit") {
        payload.targetExam = formExam;
        payload.targetYear = Number(formYear);
      }
      if (sheetType === "stream_level" || sheetType === "full_cockpit") {
        payload.prepLevel = formStage;
        payload.otherGoals = {
          ...(settingsQuery.data?.otherGoals || {}),
          branch: formStream,
        };
      }
      if (sheetType === "daily_goal" || sheetType === "full_cockpit") {
        payload.dailyAvailableHours = formHours;
        await api.tracker.goal(formHours);
      }
      if (sheetType === "sleep_routine" || sheetType === "full_cockpit") {
        payload.wakeTime = formWakeTime.trim() || "06:00";
        payload.sleepTime = formSleepTime.trim() || "22:00";
      }
      if (sheetType === "target_rank" || sheetType === "full_cockpit") {
        payload.otherGoals = {
          ...(settingsQuery.data?.otherGoals || {}),
          targetRank: formTargetRank.trim(),
        };
      }
      if (sheetType === "fitness" || sheetType === "full_cockpit") {
        payload.exerciseGoal = formExerciseGoal.trim();
      }

      // Engine sheets
      if (sheetType === "score_weights" || sheetType === "full_engine") {
        if (totalWeights !== 100) {
          notify.error(
            "Weights Total Must Be 100%",
            `Current total is ${totalWeights}%. Please adjust the sliders to equal 100%.`
          );
          setSavingField(false);
          return;
        }
        payload.scoreWeights = {
          study: formStudyWeight,
          exercise: formExerciseWeight,
          reading: formReadingWeight,
          routine: formRoutineWeight,
        };
      }

      if (sheetType === "streak_freeze" || sheetType === "full_engine") {
        const untilStr = formStreakActive
          ? new Date(Date.now() + formStreakDurationDays * 86400000).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : null;

        payload.otherGoals = {
          ...(payload.otherGoals || settingsQuery.data?.otherGoals || {}),
          streakFreeze: {
            active: formStreakActive,
            reason: formStreakReason,
            durationDays: formStreakDurationDays,
            untilDate: untilStr,
            leftCount: formStreakActive
              ? Math.max(0, currentStreakFreeze.leftCount - 1)
              : currentStreakFreeze.leftCount,
          },
        };
      }

      if (sheetType === "comeback_protocol" || sheetType === "full_engine") {
        payload.otherGoals = {
          ...(payload.otherGoals || settingsQuery.data?.otherGoals || {}),
          comeback: {
            thresholdDays: formComebackThreshold,
            autoTrigger: formComebackAuto,
          },
        };
      }

      // Optimistically update React Query cache immediately
      client.setQueryData<AppSettings>(["settings"], (old) => {
        if (!old) return old;
        return {
          ...old,
          ...payload,
          name: payload.name ?? old.name,
        };
      });
      if (typeof payload.dailyAvailableHours === "number") {
        client.setQueryData<TrackerStatus>(["tracker"], (old) => {
          if (!old) return old;
          return {
            ...old,
            dailyAvailableHours: payload.dailyAvailableHours!,
          };
        });
      }

      await api.settings.save(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      client.invalidateQueries({ queryKey: ["settings"] });
      client.invalidateQueries({ queryKey: ["tracker"] });
      setActiveSheet(null);

      if (sheetType === "streak_freeze" && formStreakActive) {
        notify.info("Streak Freeze Active", `Protected for ${formStreakDurationDays} days.`);
      } else if (sheetType === "comeback_protocol") {
        notify.info("Comeback Configured", `Sensitivity set to ${formComebackThreshold} days.`);
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      notify.error("Save Failed", error?.message || "Failed to update settings.");
    } finally {
      setSavingField(false);
    }
  };

  const testBackendPing = async () => {
    try {
      setTestingPing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const startTime = Date.now();
      await api.health();
      const latency = Date.now() - startTime;
      notify.success("Backend Connected", `Health check passed · ${latency}ms latency`);
    } catch {
      notify.error("Connection Failed", "Could not reach backend API. Check network.");
    } finally {
      setTestingPing(false);
    }
  };

  const handleClearCache = () => {
    notify.confirm({
      title: "Clear Offline Cache?",
      message: "This clears cached screen data on this device. Cloud data remains untouched.",
      confirmLabel: "Clear Cache",
      tone: "warning",
      icon: "refresh-outline",
      onConfirm: async () => {
        client.clear();
        await queryPersister.removeClient();
        notify.success("Cache Cleared", "Offline data flushed. Re-fetching fresh state…");
        client.invalidateQueries();
      },
    });
  };

  const handleLockDevice = () => {
    notify.confirm({
      title: "Lock DOOR?",
      message:
        "This clears the active session and passcode from this device. Cloud data is safely preserved.",
      confirmLabel: "Lock Device",
      tone: "destructive",
      icon: "lock-closed-outline",
      onConfirm: async () => {
        await lock();
        client.clear();
        await queryPersister.removeClient();
        router.replace("/passcode");
      },
    });
  };

  return (
    <AppScreen
      title="More"
      subtitle="Profile, preferences & app settings"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Compact Profile Summary Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.profileHeaderRow}>
            {/* Neutral Avatar */}
            <Pressable
              onPress={() => openSheet("name")}
              accessibilityRole="button"
              accessibilityLabel="Edit profile name"
              style={({ pressed }) => [styles.avatarPressable, pressed && { opacity: 0.8 }]}
              hitSlop={8}
            >
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                    borderColor: isDark ? "#26262D" : "#e2e8f0",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarInitials,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  {getInitials(currentName)}
                </Text>
              </View>
            </Pressable>

            {/* Profile Identity Details */}
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Pressable
                  onPress={() => openSheet("name")}
                  accessibilityRole="button"
                  accessibilityLabel="Edit name"
                  style={({ pressed }) => [styles.namePressable, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.profileName,
                      { color: isDark ? "#FAFAFA" : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {currentName}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => openSheet("name")}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                  style={({ pressed }) => [styles.editBadge, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.editText,
                      { color: isDark ? "#A1A1AA" : theme.textMuted },
                    ]}
                  >
                    Edit
                  </Text>
                </Pressable>
              </View>

              {/* Sub-identity row: Exam and Discipline */}
              <View style={styles.metaRow}>
                <Pressable
                  onPress={() => openSheet("exam_year")}
                  accessibilityRole="button"
                  accessibilityLabel="Edit exam and year"
                  style={({ pressed }) => pressed && { opacity: 0.7 }}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.metaText,
                      { color: isDark ? "#A1A1AA" : theme.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {currentExam} {currentYear} · {currentStream}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* 3-Column Neutral Metric Inset Bar */}
          <View
            style={[
              styles.metricsBar,
              {
                backgroundColor: isDark ? "#0E0E11" : "#f8fafc",
                borderColor: isDark ? "#1F1F24" : "#e2e8f0",
              },
            ]}
          >
            {/* Daily Goal */}
            <Pressable
              onPress={() => openSheet("daily_goal")}
              accessibilityRole="button"
              accessibilityLabel={`Daily goal: ${dailyGoal} hours`}
              style={({ pressed }) => [styles.metricCol, pressed && { opacity: 0.7 }]}
            >
              <Text
                style={[
                  styles.metricValue,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                {dailyGoal}h
              </Text>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Daily Goal
              </Text>
            </Pressable>

            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDark ? "#222226" : "#e2e8f0" },
              ]}
            />

            {/* Sleep Rest */}
            <Pressable
              onPress={() => openSheet("sleep_routine")}
              accessibilityRole="button"
              accessibilityLabel={`Sleep rest: ${sleepWindow}`}
              style={({ pressed }) => [styles.metricCol, pressed && { opacity: 0.7 }]}
            >
              <Text
                style={[
                  styles.metricValue,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                {sleepWindow}
              </Text>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Sleep Rest
              </Text>
            </Pressable>

            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDark ? "#222226" : "#e2e8f0" },
              ]}
            />

            {/* Target Rank */}
            <Pressable
              onPress={() => openSheet("target_rank")}
              accessibilityRole="button"
              accessibilityLabel={`Target benchmark: ${currentTargetRank}`}
              style={({ pressed }) => [styles.metricCol, pressed && { opacity: 0.7 }]}
            >
              <Text
                style={[
                  styles.metricValue,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
                numberOfLines={1}
              >
                {currentTargetRank}
              </Text>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Target Rank
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 1. Profile & Exam */}
        <SettingsGroup title="PROFILE & EXAM">
          <SettingsRow
            icon="school-outline"
            title="Target exam"
            subtitle={`${currentExam} ${currentYear}`}
            onPress={() => openSheet("exam_year")}
            accessibilityHint="Opens target exam and year picker"
          />
          <SettingsDivider />
          <SettingsRow
            icon="layers-outline"
            title="Discipline & stage"
            subtitle={`${currentStream} · ${currentStage}`}
            onPress={() => openSheet("stream_level")}
            accessibilityHint="Opens branch and preparation stage picker"
          />
          <SettingsDivider />
          <SettingsRow
            icon="trophy-outline"
            title="Target benchmark"
            subtitle={currentTargetRank}
            onPress={() => openSheet("target_rank")}
            accessibilityHint="Opens target rank and benchmark editor"
          />
          <SettingsDivider />
          <SettingsRow
            icon="person-outline"
            title="Edit profile"
            subtitle={currentName}
            onPress={() => openSheet("name")}
            accessibilityHint="Opens name editor"
          />
        </SettingsGroup>

        {/* 2. Study Plan */}
        <SettingsGroup title="STUDY PLAN">
          <SettingsRow
            icon="time-outline"
            title="Daily study goal"
            subtitle="Daily focus allocation"
            onPress={() => openSheet("daily_goal")}
            accessory="none"
          >
            {/* Inline Quick Stepper */}
            <View style={styles.quickStepperWrapper}>
              <Pressable
                onPress={() => adjustDailyHours(-0.5)}
                accessibilityRole="button"
                accessibilityLabel="Decrease study goal by 30 minutes"
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                    borderColor: isDark ? "#26262D" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={6}
              >
                <Ionicons name="remove" size={15} color={isDark ? "#FAFAFA" : theme.text} />
              </Pressable>

              <Pressable
                onPress={() => openSheet("daily_goal")}
                accessibilityRole="button"
                accessibilityLabel={`Current goal: ${dailyGoal} hours. Tap to customize`}
              >
                <Text
                  style={[
                    styles.stepperValueText,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  {dailyGoal}h
                </Text>
              </Pressable>

              <Pressable
                onPress={() => adjustDailyHours(0.5)}
                accessibilityRole="button"
                accessibilityLabel="Increase study goal by 30 minutes"
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                    borderColor: isDark ? "#26262D" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={6}
              >
                <Ionicons name="add" size={15} color={isDark ? "#FAFAFA" : theme.text} />
              </Pressable>
            </View>
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow
            icon="alarm-outline"
            title="Sleep & wake"
            subtitle={`${currentWakeTime} – ${currentSleepTime} (${sleepWindow})`}
            onPress={() => openSheet("sleep_routine")}
            accessibilityHint="Opens sleep and wake schedule settings"
          />
          <SettingsDivider />
          <SettingsRow
            icon="fitness-outline"
            title="Daily fitness"
            subtitle={currentExerciseGoal}
            onPress={() => openSheet("fitness")}
            accessibilityHint="Opens daily fitness habit settings"
          />
          <SettingsDivider />
          <SettingsRow
            icon="options-outline"
            title="Review study plan"
            subtitle="Configure all study targets & discipline"
            onPress={() => openSheet("full_cockpit")}
            accessibilityHint="Opens comprehensive study plan editor"
          />
        </SettingsGroup>

        {/* 3. Routine & Progress */}
        <SettingsGroup title="ROUTINE & PROGRESS">
          <SettingsRow
            icon="speedometer-outline"
            title="Score formula"
            titleExtra={
              <InfoButton
                title="Daily Score Formula"
                message="Defines how your 100-point performance score is calculated nightly across Study (60%), Health (15%), Reading (10%), and Routine (15%)."
                isDark={isDark}
              />
            }
            subtitle={`${currentScoreWeights.study}% Study · ${currentScoreWeights.exercise}% Health · ${currentScoreWeights.reading}% Read · ${currentScoreWeights.routine}% Routine`}
            onPress={() => openSheet("score_weights")}
          />
          <SettingsDivider />
          <SettingsRow
            icon="snow-outline"
            title="Streak freeze"
            titleExtra={
              <InfoButton
                title="Streak Freeze Mode"
                message="Freezes your streak without resetting to 0 during university semester exams, illness, or family travel."
                isDark={isDark}
              />
            }
            subtitle={
              currentStreakFreeze.active
                ? `Active · Until ${currentStreakFreeze.untilDate || "date"}`
                : `Inactive · ${currentStreakFreeze.leftCount} Available`
            }
            status={currentStreakFreeze.active ? "success" : undefined}
            value={currentStreakFreeze.active ? "Active" : undefined}
            onPress={() => openSheet("streak_freeze")}
          />
          <SettingsDivider />
          <SettingsRow
            icon="refresh-circle-outline"
            title="Comeback mode"
            titleExtra={
              <InfoButton
                title="Comeback Protocol"
                message="Detects missed days and automatically prepares an easy 30-min momentum plan to eliminate friction and rebuild your streak."
                isDark={isDark}
              />
            }
            subtitle={`Trigger: ${currentComeback.thresholdDays}d inactive · ${
              currentComeback.autoTrigger ? "Auto" : "Manual"
            }`}
            onPress={() => openSheet("comeback_protocol")}
          />
          <SettingsDivider />
          <SettingsRow
            icon="hardware-chip-outline"
            title="Review routine setup"
            subtitle="Tune weights, freeze & sensitivity"
            onPress={() => openSheet("full_engine")}
          />
        </SettingsGroup>

        {/* 4. AI & Insights */}
        <SettingsGroup title="AI & INSIGHTS">
          <SettingsRow
            icon="sparkles-outline"
            title="AI assistant"
            subtitle="Available"
            status="success"
            value="Active"
            accessory="none"
          />
          <SettingsDivider />
          <SettingsRow
            icon="bulb-outline"
            title="Weekly insights"
            subtitle="Weekly performance summary"
            value="Daily"
            accessory="none"
          />
        </SettingsGroup>

        {/* 5. App, Privacy & Data */}
        <SettingsGroup title="APP, PRIVACY & DATA">
          <SettingsRow
            icon="server-outline"
            title="Connection status"
            subtitle="Connected"
            accessory={
              testingPing ? (
                <ActivityIndicator size="small" color={colors.emerald} />
              ) : (
                <Pressable
                  onPress={testBackendPing}
                  accessibilityRole="button"
                  accessibilityLabel="Test API connection"
                  style={({ pressed }) => [
                    styles.testActionBtn,
                    {
                      backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                      borderColor: isDark ? "#26262D" : "#e2e8f0",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.testActionText,
                      { color: isDark ? "#FAFAFA" : theme.text },
                    ]}
                  >
                    Test
                  </Text>
                </Pressable>
              )
            }
          />
          <SettingsDivider />
          <SettingsRow
            icon="shield-checkmark"
            title="Privacy"
            subtitle="Encrypted on this device · Zero tracking"
            accessory="none"
          />
          <SettingsDivider />
          <SettingsRow
            icon="refresh-outline"
            title="Clear offline cache"
            subtitle="Purges local query persister store"
            onPress={handleClearCache}
          />
        </SettingsGroup>

        {/* 6. Danger Zone */}
        <SettingsGroup title="DANGER ZONE">
          <SettingsRow
            icon="log-out-outline"
            title="Lock & Sign Out"
            subtitle="Flushes passcode session from this device"
            destructive={true}
            onPress={handleLockDevice}
          />
        </SettingsGroup>

        {/* Diagnostics Collapsible Disclosure */}
        <View style={styles.diagnosticsWrapper}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setDiagnosticsOpen(!diagnosticsOpen);
            }}
            accessibilityRole="button"
            accessibilityLabel="Toggle diagnostics details"
            style={({ pressed }) => [
              styles.diagnosticsToggle,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name="server-outline"
              size={14}
              color={isDark ? "#71717A" : theme.textFaint}
            />
            <Text
              style={[
                styles.diagnosticsToggleText,
                { color: isDark ? "#71717A" : theme.textFaint },
              ]}
            >
              Diagnostics
            </Text>
            <Ionicons
              name={diagnosticsOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          {diagnosticsOpen && (
            <View
              style={[
                styles.diagnosticsCard,
                {
                  backgroundColor: isDark ? "#121215" : "#ffffff",
                  borderColor: isDark ? "#222226" : "#e2e8f0",
                },
              ]}
            >
              <View style={styles.diagRow}>
                <Text
                  style={[
                    styles.diagLabel,
                    { color: isDark ? "#71717A" : theme.textFaint },
                  ]}
                >
                  API Gateway
                </Text>
                <Text
                  style={[
                    styles.diagValue,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                  numberOfLines={1}
                >
                  {backendUrl}
                </Text>
              </View>

              <View
                style={[
                  styles.diagDivider,
                  { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
                ]}
              />

              <View style={styles.diagRow}>
                <Text
                  style={[
                    styles.diagLabel,
                    { color: isDark ? "#71717A" : theme.textFaint },
                  ]}
                >
                  Primary Database
                </Text>
                <Text
                  style={[
                    styles.diagValue,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  PostgreSQL via Prisma ORM
                </Text>
              </View>

              <View
                style={[
                  styles.diagDivider,
                  { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
                ]}
              />

              <View style={styles.diagRow}>
                <Text
                  style={[
                    styles.diagLabel,
                    { color: isDark ? "#71717A" : theme.textFaint },
                  ]}
                >
                  Framework
                </Text>
                <Text
                  style={[
                    styles.diagValue,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  React Native 0.76 · Expo SDK 54
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Quiet Footer */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            DOOR Mobile Suite · Private & Local
          </Text>
          <Text
            style={[
              styles.footerSubtext,
              { color: isDark ? "#52525B" : theme.textFaint },
            ]}
          >
            Engineered for GATE Aspirants
          </Text>
        </View>
      </ScrollView>

      {/* Contextual Focus Modal Sheet */}
      <Modal
        visible={activeSheet !== null}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setActiveSheet(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: isDark ? "#121215" : "#ffffff",
                borderColor: isDark ? "#24242A" : "#e2e8f0",
              },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandleWrapper}>
              <View
                style={[
                  styles.sheetHandleBar,
                  { backgroundColor: isDark ? "#3F3F46" : "#cbd5e1" },
                ]}
              />
            </View>

            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderContent}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  {activeSheet === "name" && "Aspirant Name"}
                  {activeSheet === "exam_year" && "Target Exam & Year"}
                  {activeSheet === "stream_level" && "Discipline & Stage"}
                  {activeSheet === "daily_goal" && "Daily Study Target"}
                  {activeSheet === "sleep_routine" && "Sleep & Wake Schedule"}
                  {activeSheet === "target_rank" && "Target Goal / Rank"}
                  {activeSheet === "fitness" && "Daily Fitness Target"}
                  {activeSheet === "full_cockpit" && "Review Study Plan"}
                  {activeSheet === "score_weights" && "Daily Score Weights"}
                  {activeSheet === "streak_freeze" && "Streak Freeze & Vacation"}
                  {activeSheet === "comeback_protocol" && "Comeback Protocol"}
                  {activeSheet === "full_engine" && "Review Routine Setup"}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                >
                  {activeSheet === "name" && "Update your display identifier across DOOR"}
                  {activeSheet === "exam_year" && "Select competitive exam & target year"}
                  {activeSheet === "stream_level" && "Set engineering branch & preparation stage"}
                  {activeSheet === "daily_goal" && "Adjust focus study hours allocated for routine AI"}
                  {activeSheet === "sleep_routine" && "Configure circadian sleep and wake targets"}
                  {activeSheet === "target_rank" && "Define your target rank, score or ambition"}
                  {activeSheet === "fitness" && "Set physical health habit to maintain mental focus"}
                  {activeSheet === "full_cockpit" && "Configure all academic targets & discipline"}
                  {activeSheet === "score_weights" && "Customize 100-point performance score calculation"}
                  {activeSheet === "streak_freeze" && "Protect your streak during exams or illness"}
                  {activeSheet === "comeback_protocol" && "Configure momentum triggers when returning from breaks"}
                  {activeSheet === "full_engine" && "Fine-tune scoring formulas, streak protection, & comeback"}
                </Text>
              </View>
              <Pressable
                onPress={() => setActiveSheet(null)}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                style={({ pressed }) => [
                  styles.modalCloseBtn,
                  {
                    backgroundColor: isDark ? "#1A1A20" : "#f1f5f9",
                    borderColor: isDark ? "#282830" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={isDark ? "#A1A1AA" : theme.textMuted}
                />
              </Pressable>
            </View>

            {/* Scrollable Form Content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalFormContent}
            >
              {/* 1. Name Form */}
              {(activeSheet === "name" || activeSheet === "full_cockpit") && (
                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.formSectionLabel,
                      { color: isDark ? "#71717A" : theme.textFaint },
                    ]}
                  >
                    ASPIRANT NAME
                  </Text>
                  <View
                    style={[
                      styles.textInputWrapper,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={16}
                      color={colors.emerald}
                      style={styles.inputLeadingIcon}
                    />
                    <TextInput
                      value={formName}
                      onChangeText={setFormName}
                      placeholder="Enter your name"
                      placeholderTextColor={isDark ? "#52525B" : "#94a3b8"}
                      style={[
                        styles.textInput,
                        { color: isDark ? "#FAFAFA" : theme.text },
                      ]}
                      autoFocus={activeSheet === "name"}
                    />
                  </View>
                </View>
              )}

              {/* 2. Target Exam & Year Form */}
              {(activeSheet === "exam_year" || activeSheet === "full_cockpit") && (
                <>
                  <View style={styles.formSection}>
                    <Text
                      style={[
                        styles.formSectionLabel,
                        { color: isDark ? "#71717A" : theme.textFaint },
                      ]}
                    >
                      TARGET EXAMINATION
                    </Text>
                    <View style={styles.chipRow}>
                      {EXAM_PRESETS.map((exam) => {
                        const isSelected = formExam === exam;
                        return (
                          <Pressable
                            key={exam}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setFormExam(exam);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            style={[
                              styles.chipPill,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.2)"
                                    : "rgba(5, 150, 105, 0.12)"
                                  : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                                borderColor: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#26262D"
                                  : "#e2e8f0",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: isSelected
                                    ? colors.emerald
                                    : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                  fontWeight: isSelected ? "700" : "500",
                                },
                              ]}
                            >
                              {exam}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text
                      style={[
                        styles.formSectionLabel,
                        { color: isDark ? "#71717A" : theme.textFaint },
                      ]}
                    >
                      TARGET YEAR
                    </Text>
                    <View style={styles.chipRow}>
                      {YEAR_PRESETS.map((yr) => {
                        const isSelected = formYear === yr;
                        return (
                          <Pressable
                            key={yr}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setFormYear(yr);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            style={[
                              styles.chipPill,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.2)"
                                    : "rgba(5, 150, 105, 0.12)"
                                  : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                                borderColor: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#26262D"
                                  : "#e2e8f0",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: isSelected
                                    ? colors.emerald
                                    : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                  fontWeight: isSelected ? "700" : "500",
                                },
                              ]}
                            >
                              {yr}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {/* 3. Discipline & Prep Level Form */}
              {(activeSheet === "stream_level" || activeSheet === "full_cockpit") && (
                <>
                  <View style={styles.formSection}>
                    <Text
                      style={[
                        styles.formSectionLabel,
                        { color: isDark ? "#71717A" : theme.textFaint },
                      ]}
                    >
                      ENGINEERING DISCIPLINE / STREAM
                    </Text>
                    <View style={styles.chipRow}>
                      {STREAM_PRESETS.map((stream) => {
                        const isSelected = formStream === stream;
                        return (
                          <Pressable
                            key={stream}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setFormStream(stream);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            style={[
                              styles.chipPill,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.2)"
                                    : "rgba(5, 150, 105, 0.12)"
                                  : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                                borderColor: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#26262D"
                                  : "#e2e8f0",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: isSelected
                                    ? colors.emerald
                                    : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                  fontWeight: isSelected ? "700" : "500",
                                },
                              ]}
                            >
                              {stream}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text
                      style={[
                        styles.formSectionLabel,
                        { color: isDark ? "#71717A" : theme.textFaint },
                      ]}
                    >
                      PREPARATION STAGE / LEVEL
                    </Text>
                    <View style={styles.chipRow}>
                      {STAGE_PRESETS.map((stage) => {
                        const isSelected = formStage === stage;
                        return (
                          <Pressable
                            key={stage}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setFormStage(stage);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            style={[
                              styles.chipPill,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.2)"
                                    : "rgba(5, 150, 105, 0.12)"
                                  : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                                borderColor: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#26262D"
                                  : "#e2e8f0",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: isSelected
                                    ? colors.emerald
                                    : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                  fontWeight: isSelected ? "700" : "500",
                                },
                              ]}
                            >
                              {stage}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {/* 4. Target Rank Form */}
              {(activeSheet === "target_rank" || activeSheet === "full_cockpit") && (
                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.formSectionLabel,
                      { color: isDark ? "#71717A" : theme.textFaint },
                    ]}
                  >
                    TARGET GOAL / RANK / SCORE
                  </Text>
                  <View
                    style={[
                      styles.textInputWrapper,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <Ionicons
                      name="trophy-outline"
                      size={16}
                      color={colors.emerald}
                      style={styles.inputLeadingIcon}
                    />
                    <TextInput
                      value={formTargetRank}
                      onChangeText={setFormTargetRank}
                      placeholder="e.g. AIR < 100 or Marks: 85+"
                      placeholderTextColor={isDark ? "#52525B" : "#94a3b8"}
                      style={[
                        styles.textInput,
                        { color: isDark ? "#FAFAFA" : theme.text },
                      ]}
                      autoFocus={activeSheet === "target_rank"}
                    />
                  </View>
                  {/* Suggestion Chips */}
                  <View style={[styles.chipRow, { marginTop: 6 }]}>
                    {["AIR < 50", "AIR < 100", "AIR < 500", "Marks: 85+", "PSU Direct"].map(
                      (r) => {
                        const isMatch = formTargetRank === r;
                        return (
                          <Pressable
                            key={r}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setFormTargetRank(r);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isMatch }}
                            style={[
                              styles.chipPill,
                              {
                                backgroundColor: isMatch
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.2)"
                                    : "rgba(5, 150, 105, 0.12)"
                                  : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                                borderColor: isMatch
                                  ? colors.emerald
                                  : isDark
                                  ? "#26262D"
                                  : "#e2e8f0",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: isMatch
                                    ? colors.emerald
                                    : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                  fontWeight: isMatch ? "700" : "500",
                                },
                              ]}
                            >
                              {r}
                            </Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                </View>
              )}

              {/* 5. Daily Study Goal Form */}
              {(activeSheet === "daily_goal" || activeSheet === "full_cockpit") && (
                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.formSectionLabel,
                      { color: isDark ? "#71717A" : theme.textFaint },
                    ]}
                  >
                    DAILY AVAILABLE STUDY HOURS
                  </Text>

                  <View
                    style={[
                      styles.modalStepperContainer,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setFormHours((prev) => Math.max(1.0, Number((prev - 0.5).toFixed(1))));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease study hours by 0.5"
                      style={({ pressed }) => [
                        styles.modalStepperBtn,
                        {
                          backgroundColor: isDark ? "#202026" : "#e2e8f0",
                        },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Ionicons name="remove" size={18} color={isDark ? "#FAFAFA" : theme.text} />
                    </Pressable>

                    <View style={styles.modalStepperCenter}>
                      <Text
                        style={[
                          styles.modalStepperVal,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        {formHours} hrs
                      </Text>
                      <Text
                        style={[
                          styles.modalStepperSub,
                          { color: isDark ? "#71717A" : theme.textFaint },
                        ]}
                      >
                        per day target
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setFormHours((prev) => Math.min(16.0, Number((prev + 0.5).toFixed(1))));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Increase study hours by 0.5"
                      style={({ pressed }) => [
                        styles.modalStepperBtn,
                        {
                          backgroundColor: isDark ? "#202026" : "#e2e8f0",
                        },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Ionicons name="add" size={18} color={isDark ? "#FAFAFA" : theme.text} />
                    </Pressable>
                  </View>

                  <View style={[styles.chipRow, { marginTop: 8 }]}>
                    {HOUR_PRESETS.map((h) => {
                      const isSelected = formHours === h;
                      return (
                        <Pressable
                          key={h}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setFormHours(h);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "rgba(5, 150, 105, 0.12)"
                                : isDark
                                ? "#18181D"
                                : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.emerald
                                : isDark
                                ? "#26262D"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#A1A1AA"
                                  : theme.textMuted,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {h}h
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 6. Sleep & Wake Routine Form */}
              {(activeSheet === "sleep_routine" || activeSheet === "full_cockpit") && (
                <View style={styles.formSection}>
                  <View style={styles.sectionHeaderBetween}>
                    <Text
                      style={[
                        styles.formSectionLabel,
                        { color: isDark ? "#71717A" : theme.textFaint },
                      ]}
                    >
                      SLEEP & WAKE ROUTINE
                    </Text>
                    <View
                      style={[
                        styles.sleepBadge,
                        {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.04)",
                          borderColor: isDark ? "#26262D" : "#e2e8f0",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sleepBadgeText,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        {calculateSleepDuration(formWakeTime, formSleepTime)} rest
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.formSubLabel,
                      { color: isDark ? "#A1A1AA" : theme.textMuted },
                    ]}
                  >
                    Wake Up Target:
                  </Text>
                  <View style={styles.chipRow}>
                    {WAKE_PRESETS.map((t) => {
                      const isSelected = formWakeTime === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setFormWakeTime(t);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "rgba(5, 150, 105, 0.12)"
                                : isDark
                                ? "#18181D"
                                : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.emerald
                                : isDark
                                ? "#26262D"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#A1A1AA"
                                  : theme.textMuted,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text
                    style={[
                      styles.formSubLabel,
                      { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 10 },
                    ]}
                  >
                    Bedtime Target:
                  </Text>
                  <View style={styles.chipRow}>
                    {SLEEP_PRESETS.map((t) => {
                      const isSelected = formSleepTime === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setFormSleepTime(t);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "rgba(5, 150, 105, 0.12)"
                                : isDark
                                ? "#18181D"
                                : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.emerald
                                : isDark
                                ? "#26262D"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#A1A1AA"
                                  : theme.textMuted,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 7. Health & Fitness Form */}
              {(activeSheet === "fitness" || activeSheet === "full_cockpit") && (
                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.formSectionLabel,
                      { color: isDark ? "#71717A" : theme.textFaint },
                    ]}
                  >
                    DAILY FITNESS & HABIT TARGET
                  </Text>
                  <View style={styles.chipRow}>
                    {EXERCISE_PRESETS.map((item) => {
                      const isSelected = formExerciseGoal === item;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setFormExerciseGoal(item);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "rgba(5, 150, 105, 0.12)"
                                : isDark
                                ? "#18181D"
                                : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.emerald
                                : isDark
                                ? "#26262D"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#A1A1AA"
                                  : theme.textMuted,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {item}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View
                    style={[
                      styles.textInputWrapper,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                        marginTop: 8,
                      },
                    ]}
                  >
                    <Ionicons
                      name="fitness-outline"
                      size={16}
                      color={colors.emerald}
                      style={styles.inputLeadingIcon}
                    />
                    <TextInput
                      value={formExerciseGoal}
                      onChangeText={setFormExerciseGoal}
                      placeholder="Custom exercise or habit target"
                      placeholderTextColor={isDark ? "#52525B" : "#94a3b8"}
                      style={[
                        styles.textInput,
                        { color: isDark ? "#FAFAFA" : theme.text },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* 8. Daily Score Weights Form */}
              {(activeSheet === "score_weights" || activeSheet === "full_engine") && (
                <View style={styles.formSection}>
                  <View
                    style={[
                      styles.infoBanner,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={isDark ? "#A1A1AA" : theme.textMuted}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.infoBannerTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        How Daily Score Formula Works
                      </Text>
                      <Text
                        style={[
                          styles.infoBannerText,
                          { color: isDark ? "#A1A1AA" : theme.textMuted },
                        ]}
                      >
                        Every night, DOOR computes your 100-point performance score based on tasks
                        you finished. Adjust these percentages to allocate credit. Total must equal
                        100%.
                      </Text>
                    </View>
                  </View>

                  {/* Total Weight Validation Pill */}
                  <View
                    style={[
                      styles.totalWeightBadge,
                      {
                        backgroundColor:
                          totalWeights === 100
                            ? isDark
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(5, 150, 105, 0.12)"
                            : isDark
                            ? "rgba(244, 63, 94, 0.15)"
                            : "rgba(244, 63, 94, 0.12)",
                        borderColor: totalWeights === 100 ? colors.emerald : colors.rose,
                      },
                    ]}
                  >
                    <Ionicons
                      name={totalWeights === 100 ? "checkmark-circle" : "alert-circle"}
                      size={16}
                      color={totalWeights === 100 ? colors.emerald : colors.rose}
                    />
                    <Text
                      style={[
                        styles.totalWeightText,
                        { color: totalWeights === 100 ? colors.emerald : colors.rose },
                      ]}
                    >
                      {totalWeights === 100
                        ? "Total: 100% (Balanced & Valid)"
                        : `Total: ${totalWeights}% (Adjust to equal 100%)`}
                    </Text>
                  </View>

                  {/* Dimension 1: Study */}
                  <View
                    style={[
                      styles.weightTunerRow,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.weightTunerTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        Study Focus Hours
                      </Text>
                      <Text
                        style={[
                          styles.weightTunerSubtitle,
                          { color: isDark ? "#71717A" : theme.textFaint },
                        ]}
                      >
                        Deep work & problem solving
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormStudyWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text
                        style={[
                          styles.weightValueText,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        {formStudyWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormStudyWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="add" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Dimension 2: Exercise */}
                  <View
                    style={[
                      styles.weightTunerRow,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.weightTunerTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        Exercise & Health
                      </Text>
                      <Text
                        style={[
                          styles.weightTunerSubtitle,
                          { color: isDark ? "#71717A" : theme.textFaint },
                        ]}
                      >
                        Physical stamina & workout
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormExerciseWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text
                        style={[
                          styles.weightValueText,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        {formExerciseWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormExerciseWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="add" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Dimension 3: Reading */}
                  <View
                    style={[
                      styles.weightTunerRow,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.weightTunerTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        Reading & Discipline
                      </Text>
                      <Text
                        style={[
                          styles.weightTunerSubtitle,
                          { color: isDark ? "#71717A" : theme.textFaint },
                        ]}
                      >
                        Self-growth & mental discipline
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormReadingWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text
                        style={[
                          styles.weightValueText,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        {formReadingWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormReadingWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="add" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Dimension 4: Routine */}
                  <View
                    style={[
                      styles.weightTunerRow,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.weightTunerTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        Daily Routine Tasks
                      </Text>
                      <Text
                        style={[
                          styles.weightTunerSubtitle,
                          { color: isDark ? "#71717A" : theme.textFaint },
                        ]}
                      >
                        Habits, review & admin tasks
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormRoutineWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text
                        style={[
                          styles.weightValueText,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        {formRoutineWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormRoutineWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[
                          styles.smallStepBtn,
                          { backgroundColor: isDark ? "#202026" : "#e2e8f0" },
                        ]}
                      >
                        <Ionicons name="add" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Weight Presets */}
                  <Text
                    style={[
                      styles.formSubLabel,
                      { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 4 },
                    ]}
                  >
                    Formula Presets:
                  </Text>
                  <View style={styles.chipRow}>
                    {[
                      { name: "Standard (60/15/10/15)", s: 60, e: 15, r: 10, ro: 15 },
                      { name: "Study Intensive (75/10/5/10)", s: 75, e: 10, r: 5, ro: 10 },
                      { name: "Balanced (50/20/15/15)", s: 50, e: 20, r: 15, ro: 15 },
                      { name: "Sprint (80/10/0/10)", s: 80, e: 10, r: 0, ro: 10 },
                    ].map((preset) => {
                      const isMatch =
                        formStudyWeight === preset.s &&
                        formExerciseWeight === preset.e &&
                        formReadingWeight === preset.r &&
                        formRoutineWeight === preset.ro;
                      return (
                        <Pressable
                          key={preset.name}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setFormStudyWeight(preset.s);
                            setFormExerciseWeight(preset.e);
                            setFormReadingWeight(preset.r);
                            setFormRoutineWeight(preset.ro);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isMatch }}
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isMatch
                                ? isDark
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "rgba(5, 150, 105, 0.12)"
                                : isDark
                                ? "#18181D"
                                : "#f1f5f9",
                              borderColor: isMatch
                                ? colors.emerald
                                : isDark
                                ? "#26262D"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isMatch
                                  ? colors.emerald
                                  : isDark
                                  ? "#A1A1AA"
                                  : theme.textMuted,
                                fontWeight: isMatch ? "700" : "500",
                              },
                            ]}
                          >
                            {preset.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 9. Streak Freeze & Vacation Mode Form */}
              {(activeSheet === "streak_freeze" || activeSheet === "full_engine") && (
                <View style={styles.formSection}>
                  <View
                    style={[
                      styles.infoBanner,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <Ionicons
                      name="snow-outline"
                      size={18}
                      color={isDark ? "#A1A1AA" : theme.textMuted}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.infoBannerTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        Streak Freeze Protection
                      </Text>
                      <Text
                        style={[
                          styles.infoBannerText,
                          { color: isDark ? "#A1A1AA" : theme.textMuted },
                        ]}
                      >
                        Freezing your streak prevents your study streak from breaking and resetting
                        to 0 during university semester exams, illness, or travel.
                      </Text>
                    </View>
                  </View>

                  {/* Active Toggle */}
                  <View style={styles.sectionHeaderBetween}>
                    <View style={styles.titleWithInfoRow}>
                      <Text
                        style={[
                          styles.formSectionLabel,
                          { color: isDark ? "#71717A" : theme.textFaint },
                        ]}
                      >
                        FREEZE STATUS
                      </Text>
                      <InfoButton
                        title="Streak Freeze Status"
                        message="While active, your study streak will not break or reset to 0 even if you log zero hours."
                        isDark={isDark}
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        setFormStreakActive(!formStreakActive);
                      }}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: formStreakActive }}
                      style={[
                        styles.toggleSwitchBtn,
                        {
                          backgroundColor: formStreakActive
                            ? colors.emerald
                            : isDark
                            ? "#26262D"
                            : "#cbd5e1",
                        },
                      ]}
                    >
                      <Text style={styles.toggleSwitchText}>
                        {formStreakActive ? "Active" : "Disabled"}
                      </Text>
                    </Pressable>
                  </View>

                  {formStreakActive && (
                    <>
                      <Text
                        style={[
                          styles.formSubLabel,
                          { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 6 },
                        ]}
                      >
                        Reason for Freeze:
                      </Text>
                      <View style={styles.chipRow}>
                        {STREAK_REASONS.map((r) => {
                          const isSelected = formStreakReason === r;
                          return (
                            <Pressable
                              key={r}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setFormStreakReason(r);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                              style={[
                                styles.chipPill,
                                {
                                  backgroundColor: isSelected
                                    ? isDark
                                      ? "rgba(16, 185, 129, 0.2)"
                                      : "rgba(5, 150, 105, 0.12)"
                                    : isDark
                                    ? "#18181D"
                                    : "#f1f5f9",
                                  borderColor: isSelected
                                    ? colors.emerald
                                    : isDark
                                    ? "#26262D"
                                    : "#e2e8f0",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    color: isSelected
                                      ? colors.emerald
                                      : isDark
                                      ? "#A1A1AA"
                                      : theme.textMuted,
                                    fontWeight: isSelected ? "700" : "500",
                                  },
                                ]}
                              >
                                {r}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Text
                        style={[
                          styles.formSubLabel,
                          { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 8 },
                        ]}
                      >
                        Freeze Duration:
                      </Text>
                      <View style={styles.chipRow}>
                        {STREAK_DURATIONS.map((d) => {
                          const isSelected = formStreakDurationDays === d;
                          return (
                            <Pressable
                              key={d}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setFormStreakDurationDays(d);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                              style={[
                                styles.chipPill,
                                {
                                  backgroundColor: isSelected
                                    ? isDark
                                      ? "rgba(16, 185, 129, 0.2)"
                                      : "rgba(5, 150, 105, 0.12)"
                                    : isDark
                                    ? "#18181D"
                                    : "#f1f5f9",
                                  borderColor: isSelected
                                    ? colors.emerald
                                    : isDark
                                    ? "#26262D"
                                    : "#e2e8f0",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    color: isSelected
                                      ? colors.emerald
                                      : isDark
                                      ? "#A1A1AA"
                                      : theme.textMuted,
                                    fontWeight: isSelected ? "700" : "500",
                                  },
                                ]}
                              >
                                {d} Days
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* 10. Comeback Protocol Form */}
              {(activeSheet === "comeback_protocol" || activeSheet === "full_engine") && (
                <View style={styles.formSection}>
                  <View
                    style={[
                      styles.infoBanner,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f8fafc",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                    ]}
                  >
                    <Ionicons
                      name="refresh-circle-outline"
                      size={18}
                      color={isDark ? "#A1A1AA" : theme.textMuted}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.infoBannerTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                      >
                        Comeback Re-entry Protocol
                      </Text>
                      <Text
                        style={[
                          styles.infoBannerText,
                          { color: isDark ? "#A1A1AA" : theme.textMuted },
                        ]}
                      >
                        When inactivity is detected, DOOR automatically prepares a gentle 30-minute
                        re-entry routine to eliminate burnout, overcome procrastination, and rebuild
                        your streak.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.titleWithInfoRow}>
                    <Text
                      style={[
                        styles.formSubLabel,
                        { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 4 },
                      ]}
                    >
                      Inactivity Trigger Sensitivity:
                    </Text>
                    <InfoButton
                      title="Trigger Sensitivity"
                      message="Number of consecutive inactive study days before DOOR enters Comeback Re-entry mode."
                      isDark={isDark}
                    />
                  </View>
                  <View style={styles.chipRow}>
                    {COMEBACK_THRESHOLDS.map((t) => {
                      const isSelected = formComebackThreshold === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setFormComebackThreshold(t);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "rgba(5, 150, 105, 0.12)"
                                : isDark
                                ? "#18181D"
                                : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.emerald
                                : isDark
                                ? "#26262D"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected
                                  ? colors.emerald
                                  : isDark
                                  ? "#A1A1AA"
                                  : theme.textMuted,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {t} Days Inactive
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Auto Trigger Toggle */}
                  <View style={[styles.sectionHeaderBetween, { marginTop: 8 }]}>
                    <View style={styles.titleWithInfoRow}>
                      <Text
                        style={[
                          styles.formSubLabel,
                          { color: isDark ? "#A1A1AA" : theme.textMuted },
                        ]}
                      >
                        Auto-activate Comeback Plan:
                      </Text>
                      <InfoButton
                        title="Auto-activate Comeback"
                        message="When enabled, DOOR automatically schedules an easy 30-min momentum session on your dashboard after missed days."
                        isDark={isDark}
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        setFormComebackAuto(!formComebackAuto);
                      }}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: formComebackAuto }}
                      style={[
                        styles.toggleSwitchBtn,
                        {
                          backgroundColor: formComebackAuto
                            ? colors.emerald
                            : isDark
                            ? "#26262D"
                            : "#cbd5e1",
                        },
                      ]}
                    >
                      <Text style={styles.toggleSwitchText}>
                        {formComebackAuto ? "Enabled" : "Manual"}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Manual trigger button */}
                  <Pressable
                    onPress={handleTriggerComebackRoutine}
                    accessibilityRole="button"
                    accessibilityLabel="Trigger 30-minute momentum session now"
                    style={({ pressed }) => [
                      styles.comebackTriggerBtn,
                      {
                        backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                        borderColor: isDark ? "#26262D" : "#e2e8f0",
                      },
                      pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={18}
                      color={isDark ? "#FAFAFA" : theme.text}
                    />
                    <Text
                      style={[
                        styles.comebackTriggerText,
                        { color: isDark ? "#FAFAFA" : theme.text },
                      ]}
                    >
                      Trigger 30-Min Re-entry Momentum Task Now
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* Bottom Actions */}
            <View
              style={[
                styles.modalActionBar,
                {
                  borderTopColor: isDark ? "#222226" : "#e2e8f0",
                  backgroundColor: isDark ? "#121215" : "#ffffff",
                },
              ]}
            >
              <Pressable
                onPress={() => setActiveSheet(null)}
                accessibilityRole="button"
                accessibilityLabel="Discard changes"
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  {
                    backgroundColor: isDark ? "#1A1A20" : "#f1f5f9",
                    borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                >
                  Discard
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSave(activeSheet)}
                disabled={savingField}
                accessibilityRole="button"
                accessibilityLabel="Save settings"
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  {
                    backgroundColor: colors.emerald,
                  },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                {savingField ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.modalSaveText}>Save Settings</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    gap: 12,
  },

  // Compact Profile Card
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarPressable: {
    position: "relative",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  namePressable: {
    flex: 1,
    marginRight: 8,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  editBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  editText: {
    fontSize: 13,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 12.5,
    fontWeight: "500",
  },

  // 3-Column Metrics Inset Bar
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricCol: {
    alignItems: "center",
    gap: 2,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  metricDivider: {
    width: 1,
    height: 20,
  },

  // Quick Stepper on Row
  quickStepperWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValueText: {
    fontSize: 13.5,
    fontWeight: "700",
    paddingHorizontal: 2,
  },

  // Test Action button
  testActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  testActionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Info Button
  infoCircleBtn: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  // Diagnostics
  diagnosticsWrapper: {
    marginTop: 12,
    gap: 8,
  },
  diagnosticsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  diagnosticsToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  diagnosticsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  diagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  diagLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  diagValue: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: "60%",
  },
  diagDivider: {
    height: StyleSheet.hairlineWidth,
  },

  // Footer
  footer: {
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  footerSubtext: {
    fontSize: 10.5,
    fontWeight: "500",
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 8,
  },
  sheetHandleWrapper: {
    alignItems: "center",
    paddingVertical: 6,
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalHeaderContent: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: "400",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalFormContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 18,
  },
  formSection: {
    gap: 8,
  },
  sectionHeaderBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWithInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  formSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  formSubLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  textInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },

  // Modal Stepper
  modalStepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
  },
  modalStepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalStepperCenter: {
    alignItems: "center",
    gap: 2,
  },
  modalStepperVal: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalStepperSub: {
    fontSize: 11,
    fontWeight: "500",
  },

  // Sleep Badge
  sleepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  sleepBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Info Banner
  infoBanner: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    alignItems: "flex-start",
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  infoBannerText: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "400",
  },

  // Weight Tuner
  totalWeightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  totalWeightText: {
    fontSize: 12,
    fontWeight: "700",
  },
  weightTunerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  weightTunerTitle: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  weightTunerSubtitle: {
    fontSize: 11,
    fontWeight: "400",
  },
  weightStepperGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  weightValueText: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 38,
    textAlign: "center",
  },

  // Toggle switch button
  toggleSwitchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  toggleSwitchText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  // Comeback trigger button
  comebackTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  comebackTriggerText: {
    fontSize: 12.5,
    fontWeight: "600",
  },

  // Modal Action Bar
  modalActionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalSaveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  modalSaveText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
