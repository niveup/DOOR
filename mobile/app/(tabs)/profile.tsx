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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AppScreen } from "@/src/components/screen";
import { useAuth } from "@/src/providers/auth-provider";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { colors, radii } from "@/src/theme/tokens";
import { queryPersister } from "@/src/services/query-client";
import { api } from "@/src/services/api";
import { AppSettings } from "@/src/types/domain";

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
      style={styles.infoCircleBtn}
    >
      <Ionicons
        name="information-circle-outline"
        size={15}
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

  // Cockpit Form State
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
  const dailyGoal = Number(settingsQuery.data?.dailyAvailableHours ?? trackerQuery.data?.dailyAvailableHours ?? 4);
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

  const totalWeights = formStudyWeight + formExerciseWeight + formReadingWeight + formRoutineWeight;

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
  const adjustDailyHours = async (delta: number) => {
    const nextHours = Math.max(1.0, Math.min(16.0, Number((dailyGoal + delta).toFixed(1))));
    if (nextHours === dailyGoal) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await api.settings.save({
        name: currentName || "GATE Aspirant",
        dailyAvailableHours: nextHours,
      });
      await api.tracker.goal(nextHours);
      client.setQueryData<AppSettings>(["settings"], (old) =>
        old ? { ...old, dailyAvailableHours: nextHours } : undefined
      );
      client.invalidateQueries({ queryKey: ["settings"] });
      client.invalidateQueries({ queryKey: ["tracker"] });
      notify.success("Daily Goal Updated", `Target set to ${nextHours}h / day`);
    } catch {
      notify.error("Update Failed", "Could not save daily study hours.");
    }
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
      notify.success("Comeback Plan Active", "30-min low-friction momentum task added to your dashboard.");
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
          notify.error("Weights Total Must Be 100%", `Current total is ${totalWeights}%. Please adjust the sliders to equal 100%.`);
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

      // Optimistically update React Query cache immediately for instant zero-lag UI response
      client.setQueryData<AppSettings>(["settings"], (old) => {
        if (!old) return old;
        return {
          ...old,
          ...payload,
          name: payload.name ?? old.name,
        };
      });

      await api.settings.save(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      client.invalidateQueries({ queryKey: ["settings"] });
      client.invalidateQueries({ queryKey: ["tracker"] });
      setActiveSheet(null);

      // Only notify for rare/high-impact actions
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
      message: "This clears the active session and passcode from this device. Cloud data is safely preserved.",
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
      title="Settings & Hub"
      subtitle="Academic cockpit · Private & local"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Dynamic Hero Identity Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            {/* Tapping Avatar opens Name editor */}
            <Pressable
              onPress={() => openSheet("name")}
              style={({ pressed }) => [styles.avatarGlowWrapper, pressed && { opacity: 0.8 }]}
              hitSlop={6}
            >
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                    borderColor: colors.emerald,
                  },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {getInitials(currentName)}
                </Text>
              </View>
              <View style={styles.onlineBadge} />
            </Pressable>

            <View style={styles.heroDetails}>
              <View style={styles.heroTitleRow}>
                {/* Tapping Name opens Name editor */}
                <Pressable
                  onPress={() => openSheet("name")}
                  style={({ pressed }) => [styles.heroNamePressable, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.heroName,
                      { color: isDark ? "#FAFAFA" : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {currentName}
                  </Text>
                </Pressable>

                {/* Tapping Exam/Year pill opens Exam & Year editor */}
                <Pressable
                  onPress={() => openSheet("exam_year")}
                  style={({ pressed }) => [
                    styles.tierPill,
                    {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(5, 150, 105, 0.10)",
                      borderColor: isDark
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(5, 150, 105, 0.25)",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  hitSlop={6}
                >
                  <Text style={styles.tierText}>
                    {currentExam} {currentYear}
                  </Text>
                </Pressable>
              </View>

              {/* Tapping Stream & Stage opens Discipline & Level editor */}
              <Pressable
                onPress={() => openSheet("stream_level")}
                style={({ pressed }) => pressed && { opacity: 0.7 }}
                hitSlop={6}
              >
                <Text
                  style={[
                    styles.heroSubtitle,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {currentStream} · {currentStage}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Quick Metrics Bar - Direct Clickable Single-Purpose Targets */}
          <View
            style={[
              styles.metricsBar,
              {
                backgroundColor: isDark ? "#0D0D10" : "#f8fafc",
                borderColor: isDark ? "#1F1F24" : "#e2e8f0",
              },
            ]}
          >
            {/* Tapping Daily Goal opens Daily Goal editor ONLY */}
            <Pressable
              onPress={() => openSheet("daily_goal")}
              style={({ pressed }) => [styles.metricItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.metricValue}>{dailyGoal}h</Text>
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

            {/* Tapping Sleep Rest opens Sleep Routine editor ONLY */}
            <Pressable
              onPress={() => openSheet("sleep_routine")}
              style={({ pressed }) => [styles.metricItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.metricValue, { color: colors.violet }]}>
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

            {/* Tapping Target Rank opens Target Rank editor ONLY */}
            <Pressable
              onPress={() => openSheet("target_rank")}
              style={({ pressed }) => [styles.metricItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.metricValue, { color: colors.cyan }]} numberOfLines={1}>
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

        {/* Group 0: Academic Cockpit & Daily Discipline */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          ACADEMIC COCKPIT & DISCIPLINE
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          {/* Row 1: Exam & Year */}
          <Pressable
            onPress={() => openSheet("exam_year")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                },
              ]}
            >
              <Ionicons name="school-outline" size={18} color={colors.emerald} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Target Exam
                </Text>
                <InfoButton
                  title="Target Exam"
                  message="Your target competitive exam and graduation year used to personalize PYQs, syllabus coverage, and timetable pacing."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                {currentExam} {currentYear}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 2: Discipline & Prep Level */}
          <Pressable
            onPress={() => openSheet("stream_level")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(139, 92, 246, 0.12)",
                  borderColor: "rgba(139, 92, 246, 0.25)",
                },
              ]}
            >
              <Ionicons name="layers-outline" size={18} color={colors.violet} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Discipline & Stage
                </Text>
                <InfoButton
                  title="Discipline & Stage"
                  message="Your branch curriculum and current phase (Concept Building, PYQs, Test Series) to tailor daily focus areas."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                {currentStream} · {currentStage}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 3: Daily Study Goal with Stepper */}
          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                },
              ]}
            >
              <Ionicons name="time-outline" size={18} color={colors.amber} />
            </View>
            <Pressable
              onPress={() => openSheet("daily_goal")}
              style={[styles.rowContent, { flex: 1 }]}
            >
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Daily Study Goal
                </Text>
                <InfoButton
                  title="Daily Study Goal"
                  message="Allocated study focus per day for the AI routine engine to build your daily schedule and compute consistency scores."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Daily focus allocation
              </Text>
            </Pressable>

            {/* Inline Quick Stepper */}
            <View style={styles.quickStepperWrapper}>
              <Pressable
                onPress={() => adjustDailyHours(-0.5)}
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: isDark ? "#1A1A20" : "#f1f5f9",
                    borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={6}
              >
                <Ionicons name="remove" size={15} color={isDark ? "#FAFAFA" : theme.text} />
              </Pressable>

              <Pressable onPress={() => openSheet("daily_goal")}>
                <Text style={[styles.stepperValueText, { color: colors.amber }]}>
                  {dailyGoal}h
                </Text>
              </Pressable>

              <Pressable
                onPress={() => adjustDailyHours(0.5)}
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: isDark ? "#1A1A20" : "#f1f5f9",
                    borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={6}
              >
                <Ionicons name="add" size={15} color={isDark ? "#FAFAFA" : theme.text} />
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 4: Sleep & Wake Schedule */}
          <Pressable
            onPress={() => openSheet("sleep_routine")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(139, 92, 246, 0.12)",
                  borderColor: "rgba(139, 92, 246, 0.25)",
                },
              ]}
            >
              <Ionicons name="alarm-outline" size={18} color={colors.violet} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Sleep & Wake
                </Text>
                <InfoButton
                  title="Sleep & Wake"
                  message="Circadian rest routine to maintain high mental stamina, memory consolidation, and prevent fatigue."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                {currentWakeTime} – {currentSleepTime} ({sleepWindow})
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 5: Target Goal & Rank */}
          <Pressable
            onPress={() => openSheet("target_rank")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  borderColor: "rgba(6, 182, 212, 0.25)",
                },
              ]}
            >
              <Ionicons name="trophy-outline" size={18} color={colors.cyan} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Target Benchmark
                </Text>
                <InfoButton
                  title="Target Benchmark"
                  message="Your primary exam target (e.g. AIR < 100 or 85+ marks) for readiness scoring and milestone tracking."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                {currentTargetRank}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 6: Daily Fitness & Habit */}
          <Pressable
            onPress={() => openSheet("fitness")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(244, 63, 94, 0.12)",
                  borderColor: "rgba(244, 63, 94, 0.25)",
                },
              ]}
            >
              <Ionicons name="fitness-outline" size={18} color={colors.rose} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Daily Fitness
                </Text>
                <InfoButton
                  title="Daily Fitness"
                  message="Daily physical workout or walk to maintain focus, energy, and cardiovascular health during intense study."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
                numberOfLines={1}
              >
                {currentExerciseGoal}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 7: Comprehensive Setup at VERY BOTTOM of Academic Section */}
          <Pressable
            onPress={() => openSheet("full_cockpit")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              {
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.04)"
                  : "rgba(5, 150, 105, 0.03)",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  borderColor: "rgba(16, 185, 129, 0.3)",
                },
              ]}
            >
              <Ionicons name="options-outline" size={18} color={colors.emerald} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.emerald },
                  ]}
                >
                  Full Cockpit Setup
                </Text>
                <InfoButton
                  title="Academic Cockpit"
                  message="All-in-one comprehensive setup for your target exam, discipline, available study hours, and habits."
                  isDark={isDark}
                  color={colors.emerald}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Tune all targets, habits & routine
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.emerald}
            />
          </Pressable>
        </View>

        {/* Group 1: Exam Tracker & Routine Engine (Customizer) */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          EXAM TRACKER & ROUTINE ENGINE
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          {/* Row 1: Daily Score Formula / Weights */}
          <Pressable
            onPress={() => openSheet("score_weights")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                },
              ]}
            >
              <Ionicons name="speedometer-outline" size={18} color={colors.amber} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Score Formula
                </Text>
                <InfoButton
                  title="Daily Score Formula"
                  message="Defines how your 100-point performance score is calculated nightly across Study (60%), Health (15%), Reading (10%), and Routine (15%)."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                {currentScoreWeights.study}% Study · {currentScoreWeights.exercise}% Health · {currentScoreWeights.reading}% Read · {currentScoreWeights.routine}% Routine
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 2: Streak Freeze & Vacation Mode */}
          <Pressable
            onPress={() => openSheet("streak_freeze")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  borderColor: "rgba(6, 182, 212, 0.25)",
                },
              ]}
            >
              <Ionicons name="snow-outline" size={18} color={colors.cyan} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Streak Freeze
                </Text>
                <InfoButton
                  title="Streak Freeze Mode"
                  message="Freezes your streak without resetting to 0 during university semester exams, illness, or family travel."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                {currentStreakFreeze.active
                  ? `Active · Until ${currentStreakFreeze.untilDate || "date"}`
                  : `Inactive · ${currentStreakFreeze.leftCount} Available`}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 3: Comeback Protocol & Inactivity Sensitivity */}
          <Pressable
            onPress={() => openSheet("comeback_protocol")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(139, 92, 246, 0.12)",
                  borderColor: "rgba(139, 92, 246, 0.25)",
                },
              ]}
            >
              <Ionicons name="refresh-circle-outline" size={18} color={colors.violet} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  Comeback Mode
                </Text>
                <InfoButton
                  title="Comeback Protocol"
                  message="Detects missed days and automatically prepares an easy 30-min momentum plan to eliminate friction and rebuild your streak."
                  isDark={isDark}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Trigger: {currentComeback.thresholdDays}d inactive · {currentComeback.autoTrigger ? "Auto" : "Manual"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          {/* Row 4: Comprehensive Engine Setup at Bottom */}
          <Pressable
            onPress={() => openSheet("full_engine")}
            style={({ pressed }) => [
              styles.groupRowPressable,
              {
                backgroundColor: isDark
                  ? "rgba(245, 158, 11, 0.04)"
                  : "rgba(245, 158, 11, 0.03)",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  borderColor: "rgba(245, 158, 11, 0.3)",
                },
              ]}
            >
              <Ionicons name="hardware-chip-outline" size={18} color={colors.amber} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleWithInfoRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.amber },
                  ]}
                >
                  Full Engine Setup
                </Text>
                <InfoButton
                  title="Routine & Tracker Engine"
                  message="Complete customizer for score weights, streak freeze protection, and inactivity comeback sensitivity."
                  isDark={isDark}
                  color={colors.amber}
                />
              </View>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Tune weights, freeze & sensitivity
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.amber}
            />
          </Pressable>
        </View>

        {/* Group 2: Intelligence & AI Mentor */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          AI MENTOR & INTELLIGENCE
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(139, 92, 246, 0.12)",
                  borderColor: "rgba(139, 92, 246, 0.25)",
                },
              ]}
            >
              <Ionicons name="sparkles" size={18} color="#A78BFA" />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                AI Reasoning Engine
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                OpenRouter / Cerebras / NVIDIA
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isDark
                    ? "rgba(139, 92, 246, 0.12)"
                    : "rgba(139, 92, 246, 0.08)",
                },
              ]}
            >
              <Text style={[styles.statusPillText, { color: "#A78BFA" }]}>
                Active
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  borderColor: "rgba(6, 182, 212, 0.25)",
                },
              ]}
            >
              <Ionicons name="bulb-outline" size={18} color="#22D3EE" />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Weekly Jujum Analysis
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                7-day rolling performance mentor
              </Text>
            </View>
            <Text
              style={[
                styles.rowValueText,
                { color: isDark ? "#71717A" : theme.textFaint },
              ]}
            >
              Daily Auto
            </Text>
          </View>
        </View>

        {/* Group 3: System Health & Connection */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          SYSTEM HEALTH & NETWORK
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <Pressable
            onPress={testBackendPing}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                },
              ]}
            >
              <Ionicons name="server-outline" size={18} color={colors.emerald} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Express API Gateway
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
                numberOfLines={1}
              >
                {backendUrl}
              </Text>
            </View>
            {testingPing ? (
              <ActivityIndicator size="small" color={colors.emerald} />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isDark
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(16, 185, 129, 0.08)",
                  },
                ]}
              >
                <Text style={[styles.statusPillText, { color: colors.emerald }]}>
                  Test Ping
                </Text>
              </View>
            )}
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                },
              ]}
            >
              <Ionicons name="cube-outline" size={18} color={colors.amber} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Primary Database
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                PostgreSQL via Prisma ORM
              </Text>
            </View>
            <Text
              style={[
                styles.rowValueText,
                { color: isDark ? "#71717A" : theme.textFaint },
              ]}
            >
              Online
            </Text>
          </View>
        </View>

        {/* Group 4: Security & Cryptography */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          SECURITY & PRIVACY
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                },
              ]}
            >
              <Ionicons name="shield-checkmark" size={18} color={colors.emerald} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Encrypted Session
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Android Keystore & Expo SecureStore
              </Text>
            </View>
            <Ionicons
              name="lock-closed"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </View>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  borderColor: "rgba(6, 182, 212, 0.25)",
                },
              ]}
            >
              <Ionicons name="finger-print-outline" size={18} color={colors.cyan} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Minimal Permissions
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Zero tracking, no location/camera sensors
              </Text>
            </View>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.emerald}
            />
          </View>
        </View>

        {/* Group 5: Data & Maintenance Controls */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          DATA & ACTIONS
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <Pressable
            onPress={handleClearCache}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                },
              ]}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.amber} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Clear Offline Cache
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Purges local query persister store
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <Pressable
            onPress={handleLockDevice}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(244, 63, 94, 0.12)",
                  borderColor: "rgba(244, 63, 94, 0.25)",
                },
              ]}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.rose} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.rose }]}>
                Lock & Sign Out
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Flushes passcode session from this device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.rose} />
          </Pressable>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            DOOR Mobile Suite · React Native 0.76 · Expo SDK 54
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
                  {activeSheet === "stream_level" && "Discipline & Level"}
                  {activeSheet === "daily_goal" && "Daily Study Target"}
                  {activeSheet === "sleep_routine" && "Sleep & Wake Schedule"}
                  {activeSheet === "target_rank" && "Target Goal / Rank"}
                  {activeSheet === "fitness" && "Daily Fitness Target"}
                  {activeSheet === "full_cockpit" && "Academic Cockpit Setup"}
                  {activeSheet === "score_weights" && "Daily Score Weights"}
                  {activeSheet === "streak_freeze" && "Streak Freeze & Vacation"}
                  {activeSheet === "comeback_protocol" && "Comeback Protocol"}
                  {activeSheet === "full_engine" && "Routine & Tracker Engine"}
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
                                  fontWeight: isSelected ? "800" : "600",
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
                            style={[
                              styles.chipPill,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "rgba(6, 182, 212, 0.2)"
                                    : "rgba(6, 182, 212, 0.12)"
                                  : isDark
                                    ? "#18181D"
                                    : "#f1f5f9",
                                borderColor: isSelected
                                  ? colors.cyan
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
                                    ? colors.cyan
                                    : isDark
                                      ? "#A1A1AA"
                                      : theme.textMuted,
                                  fontWeight: isSelected ? "800" : "600",
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
                            style={[
                              styles.chipPill,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "rgba(139, 92, 246, 0.2)"
                                    : "rgba(139, 92, 246, 0.12)"
                                  : isDark
                                    ? "#18181D"
                                    : "#f1f5f9",
                                borderColor: isSelected
                                  ? colors.violet
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
                                    ? colors.violet
                                    : isDark
                                      ? "#A1A1AA"
                                      : theme.textMuted,
                                  fontWeight: isSelected ? "800" : "600",
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
                                  fontWeight: isSelected ? "800" : "600",
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
                      color={colors.cyan}
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
                    {["AIR < 50", "AIR < 100", "AIR < 500", "Marks: 85+", "PSU Direct"].map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormTargetRank(r);
                        }}
                        style={[
                          styles.chipPill,
                          {
                            backgroundColor: formTargetRank === r
                              ? isDark ? "rgba(6, 182, 212, 0.2)" : "rgba(6, 182, 212, 0.12)"
                              : isDark ? "#18181D" : "#f1f5f9",
                            borderColor: formTargetRank === r
                              ? colors.cyan
                              : isDark ? "#26262D" : "#e2e8f0",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: formTargetRank === r ? colors.cyan : isDark ? "#A1A1AA" : theme.textMuted,
                              fontWeight: formTargetRank === r ? "800" : "600",
                            },
                          ]}
                        >
                          {r}
                        </Text>
                      </Pressable>
                    ))}
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
                      <Text style={[styles.modalStepperVal, { color: colors.amber }]}>
                        {formHours} hrs
                      </Text>
                      <Text style={[styles.modalStepperSub, { color: isDark ? "#71717A" : theme.textFaint }]}>
                        per day target
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setFormHours((prev) => Math.min(16.0, Number((prev + 0.5).toFixed(1))));
                      }}
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
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(245, 158, 11, 0.2)"
                                  : "rgba(245, 158, 11, 0.12)"
                                : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.amber
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
                                  ? colors.amber
                                  : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                fontWeight: isSelected ? "800" : "600",
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
                            ? "rgba(139, 92, 246, 0.15)"
                            : "rgba(139, 92, 246, 0.10)",
                          borderColor: isDark
                            ? "rgba(139, 92, 246, 0.3)"
                            : "rgba(139, 92, 246, 0.2)",
                        },
                      ]}
                    >
                      <Text style={[styles.sleepBadgeText, { color: colors.violet }]}>
                        🌙 {calculateSleepDuration(formWakeTime, formSleepTime)} rest
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
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(139, 92, 246, 0.2)"
                                  : "rgba(139, 92, 246, 0.12)"
                                : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.violet
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
                                  ? colors.violet
                                  : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                fontWeight: isSelected ? "800" : "600",
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
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(139, 92, 246, 0.2)"
                                  : "rgba(139, 92, 246, 0.12)"
                                : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.violet
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
                                  ? colors.violet
                                  : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                fontWeight: isSelected ? "800" : "600",
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
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "rgba(244, 63, 94, 0.2)"
                                  : "rgba(244, 63, 94, 0.12)"
                                : isDark
                                  ? "#18181D"
                                  : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.rose
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
                                  ? colors.rose
                                  : isDark
                                    ? "#A1A1AA"
                                    : theme.textMuted,
                                fontWeight: isSelected ? "800" : "600",
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
                      name="barbell-outline"
                      size={16}
                      color={colors.rose}
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
                  {/* Educational explanation banner for weights */}
                  <View
                    style={[
                      styles.infoBanner,
                      {
                        backgroundColor: isDark ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.08)",
                        borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.3)",
                      },
                    ]}
                  >
                    <Ionicons name="information-circle" size={18} color={colors.amber} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.infoBannerTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        How Daily Score Formula Works
                      </Text>
                      <Text style={[styles.infoBannerText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                        Every night, DOOR computes your 100-point performance score based on tasks you finished. Adjust these percentages to allocate more credit to the areas you want to prioritize. Total must equal 100%.
                      </Text>
                    </View>
                  </View>

                  {/* Total Weight Validation Pill */}
                  <View
                    style={[
                      styles.totalWeightBadge,
                      {
                        backgroundColor: totalWeights === 100
                          ? isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(5, 150, 105, 0.12)"
                          : isDark ? "rgba(244, 63, 94, 0.15)" : "rgba(244, 63, 94, 0.12)",
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
                      <Text style={[styles.weightTunerTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        📚 Study Focus Hours
                      </Text>
                      <Text style={[styles.weightTunerSubtitle, { color: isDark ? "#71717A" : theme.textFaint }]}>
                        Deep work & problem solving
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormStudyWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text style={[styles.weightValueText, { color: colors.emerald }]}>
                        {formStudyWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormStudyWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
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
                      <Text style={[styles.weightTunerTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        🏃 Exercise & Health
                      </Text>
                      <Text style={[styles.weightTunerSubtitle, { color: isDark ? "#71717A" : theme.textFaint }]}>
                        Physical stamina & workout
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormExerciseWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text style={[styles.weightValueText, { color: colors.rose }]}>
                        {formExerciseWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormExerciseWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
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
                      <Text style={[styles.weightTunerTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        📖 Reading & Discipline
                      </Text>
                      <Text style={[styles.weightTunerSubtitle, { color: isDark ? "#71717A" : theme.textFaint }]}>
                        Self-growth & mental discipline
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormReadingWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text style={[styles.weightValueText, { color: colors.cyan }]}>
                        {formReadingWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormReadingWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
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
                      <Text style={[styles.weightTunerTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        📋 Daily Routine Tasks
                      </Text>
                      <Text style={[styles.weightTunerSubtitle, { color: isDark ? "#71717A" : theme.textFaint }]}>
                        Habits, review & admin tasks
                      </Text>
                    </View>
                    <View style={styles.weightStepperGroup}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormRoutineWeight((prev) => Math.max(0, prev - 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
                      >
                        <Ionicons name="remove" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                      <Text style={[styles.weightValueText, { color: colors.violet }]}>
                        {formRoutineWeight}%
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setFormRoutineWeight((prev) => Math.min(100, prev + 5));
                        }}
                        style={[styles.smallStepBtn, { backgroundColor: isDark ? "#202026" : "#e2e8f0" }]}
                      >
                        <Ionicons name="add" size={14} color={isDark ? "#FAFAFA" : theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Weight Presets */}
                  <Text style={[styles.formSubLabel, { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 4 }]}>
                    Formula Presets:
                  </Text>
                  <View style={styles.chipRow}>
                    {[
                      { name: "Standard Academic (60/15/10/15)", s: 60, e: 15, r: 10, ro: 15 },
                      { name: "Study Intensive (75/10/5/10)", s: 75, e: 10, r: 5, ro: 10 },
                      { name: "Balanced Wellness (50/20/15/15)", s: 50, e: 20, r: 15, ro: 15 },
                      { name: "Exam Sprint (80/10/0/10)", s: 80, e: 10, r: 0, ro: 10 },
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
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isMatch
                                ? isDark ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.12)"
                                : isDark ? "#18181D" : "#f1f5f9",
                              borderColor: isMatch
                                ? colors.amber
                                : isDark ? "#26262D" : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isMatch ? colors.amber : isDark ? "#A1A1AA" : theme.textMuted,
                                fontWeight: isMatch ? "800" : "600",
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
                        backgroundColor: isDark ? "rgba(6, 182, 212, 0.08)" : "rgba(6, 182, 212, 0.08)",
                        borderColor: isDark ? "rgba(6, 182, 212, 0.25)" : "rgba(6, 182, 212, 0.3)",
                      },
                    ]}
                  >
                    <Ionicons name="snow-outline" size={18} color={colors.cyan} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.infoBannerTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        Streak Freeze Protection
                      </Text>
                      <Text style={[styles.infoBannerText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                        Freezing your streak prevents your study streak from breaking and resetting to 0 during university semester exams, illness, or travel.
                      </Text>
                    </View>
                  </View>

                  {/* Active Toggle */}
                  <View style={styles.sectionHeaderBetween}>
                    <View style={styles.titleWithInfoRow}>
                      <Text style={[styles.formSectionLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
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
                      style={[
                        styles.toggleSwitchBtn,
                        {
                          backgroundColor: formStreakActive
                            ? colors.cyan
                            : isDark ? "#26262D" : "#cbd5e1",
                        },
                      ]}
                    >
                      <Text style={styles.toggleSwitchText}>
                        {formStreakActive ? "❄️ Active" : "Disabled"}
                      </Text>
                    </Pressable>
                  </View>

                  {formStreakActive && (
                    <>
                      <Text style={[styles.formSubLabel, { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 6 }]}>
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
                              style={[
                                styles.chipPill,
                                {
                                  backgroundColor: isSelected
                                    ? isDark ? "rgba(6, 182, 212, 0.2)" : "rgba(6, 182, 212, 0.12)"
                                    : isDark ? "#18181D" : "#f1f5f9",
                                  borderColor: isSelected
                                    ? colors.cyan
                                    : isDark ? "#26262D" : "#e2e8f0",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    color: isSelected ? colors.cyan : isDark ? "#A1A1AA" : theme.textMuted,
                                    fontWeight: isSelected ? "800" : "600",
                                  },
                                ]}
                              >
                                {r}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Text style={[styles.formSubLabel, { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 8 }]}>
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
                              style={[
                                styles.chipPill,
                                {
                                  backgroundColor: isSelected
                                    ? isDark ? "rgba(6, 182, 212, 0.2)" : "rgba(6, 182, 212, 0.12)"
                                    : isDark ? "#18181D" : "#f1f5f9",
                                  borderColor: isSelected
                                    ? colors.cyan
                                    : isDark ? "#26262D" : "#e2e8f0",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    color: isSelected ? colors.cyan : isDark ? "#A1A1AA" : theme.textMuted,
                                    fontWeight: isSelected ? "800" : "600",
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
                        backgroundColor: isDark ? "rgba(139, 92, 246, 0.08)" : "rgba(139, 92, 246, 0.08)",
                        borderColor: isDark ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.3)",
                      },
                    ]}
                  >
                    <Ionicons name="sparkles-outline" size={18} color={colors.violet} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.infoBannerTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        Comeback Re-entry Protocol
                      </Text>
                      <Text style={[styles.infoBannerText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                        When inactivity is detected, DOOR automatically prepares a gentle 30-minute re-entry routine to eliminate burnout, overcome procrastination, and rebuild your daily study streak.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.titleWithInfoRow}>
                    <Text style={[styles.formSubLabel, { color: isDark ? "#A1A1AA" : theme.textMuted, marginTop: 4 }]}>
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
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected
                                ? isDark ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.12)"
                                : isDark ? "#18181D" : "#f1f5f9",
                              borderColor: isSelected
                                ? colors.violet
                                : isDark ? "#26262D" : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected ? colors.violet : isDark ? "#A1A1AA" : theme.textMuted,
                                fontWeight: isSelected ? "800" : "600",
                              },
                            ]}
                          >
                            {t} Days Inactive {t === 3 ? "⭐" : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Auto Trigger Toggle */}
                  <View style={[styles.sectionHeaderBetween, { marginTop: 8 }]}>
                    <View style={styles.titleWithInfoRow}>
                      <Text style={[styles.formSubLabel, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
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
                      style={[
                        styles.toggleSwitchBtn,
                        {
                          backgroundColor: formComebackAuto
                            ? colors.violet
                            : isDark ? "#26262D" : "#cbd5e1",
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
                    style={({ pressed }) => [
                      styles.comebackTriggerBtn,
                      {
                        backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.10)",
                        borderColor: isDark ? "rgba(139, 92, 246, 0.35)" : "rgba(139, 92, 246, 0.25)",
                      },
                      pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons name="flash-outline" size={18} color={colors.violet} />
                    <Text style={[styles.comebackTriggerText, { color: colors.violet }]}>
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
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  {
                    backgroundColor: isDark ? "#1A1A20" : "#f1f5f9",
                    borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.modalCancelText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  Discard
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSave(activeSheet)}
                disabled={savingField}
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
    gap: 16,
  },

  // Hero Card
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarGlowWrapper: {
    position: "relative",
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: colors.emerald,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.emerald,
    borderWidth: 2,
    borderColor: "#121215",
  },
  heroDetails: {
    flex: 1,
    gap: 3,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroNamePressable: {
    flex: 1,
    marginRight: 8,
  },
  heroName: {
    fontSize: 16.5,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierText: {
    color: colors.emerald,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricItem: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  metricValue: {
    color: "#FAFAFA",
    fontSize: 14,
    fontWeight: "800",
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  metricDivider: {
    width: 1,
    height: 22,
  },

  // Quick Stepper on Main Row
  quickStepperWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValueText: {
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 2,
  },

  // Inset Groups (Apple Settings style)
  groupHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  insetGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  groupRowPressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  titleWithInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoCircleBtn: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  rowValueText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: "700",
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
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  infoBannerText: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
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
    fontWeight: "800",
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
    fontWeight: "700",
  },
  weightTunerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
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
    fontWeight: "900",
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
    fontWeight: "800",
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
    fontWeight: "800",
  },

  // Footer
  footer: {
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 11,
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
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: "500",
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
  formSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
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
    fontWeight: "600",
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
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  modalStepperSub: {
    fontSize: 11,
    fontWeight: "600",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "800",
  },
});

