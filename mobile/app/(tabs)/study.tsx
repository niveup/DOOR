import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { useAuth } from "@/src/providers/auth-provider";
import { AppScreen } from "@/src/components/screen";
import { ActionButton, EmptyState, LoadingCard } from "@/src/components/ui";
import { api } from "@/src/services/api";
import { todayInKolkata } from "@/src/lib/format";
import { layout, radii, spacing, typography } from "@/src/theme/tokens";
import { StudyHeroFocus } from "@/src/components/study/StudyHeroFocus";
import { StudyQuickStats } from "@/src/components/study/StudyQuickStats";
import { StudyRecentLogs } from "@/src/components/study/StudyRecentLogs";
import { StudyWeeklyInsight } from "@/src/components/study/StudyWeeklyInsight";
import { StudyLogForm } from "@/src/components/study/StudyLogForm";
import { StudyGoalForm } from "@/src/components/study/StudyGoalForm";
import {
  AllLogsContent,
  ViewAllStudyModal,
} from "@/src/components/study/ViewAllStudyModal";

type SheetMode = "log" | "goal";

export default function StudyScreen() {
  const { theme, isDark } = useTheme();
  const { unlocked } = useAuth();
  const notify = useNotify();
  const client = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("log");
  const [viewAllVisible, setViewAllVisible] = useState(false);

  const tracker = useQuery({
    queryKey: ["tracker"],
    queryFn: api.tracker.status,
    enabled: unlocked,
    staleTime: 5_000,
  });

  const open = (mode: SheetMode) => {
    setSheetMode(mode);
    sheetRef.current?.present();
  };

  const logMutation = useMutation({
    mutationFn: api.tracker.log,
    onSuccess: async () => {
      sheetRef.current?.dismiss();
      notify.success("Study Session Logged", "Progress and daily goal updated.");
      client.invalidateQueries({ queryKey: ["tracker"] });
    },
    onError: () => {
      notify.error("Save Failed", "Could not record study session.");
    },
  });

  const goalMutation = useMutation({
    mutationFn: api.tracker.goal,
    onSuccess: async () => {
      sheetRef.current?.dismiss();
      notify.success("Goal Updated", "Daily study target updated.");
      client.invalidateQueries({ queryKey: ["tracker"] });
    },
    onError: () => {
      notify.error("Update Failed", "Could not update daily goal.");
    },
  });

  // Real data calculations
  const todayStr = todayInKolkata();
  const todayLogs = useMemo(() => {
    return (tracker.data?.logs || []).filter(
      (l) => (l.logDate || "").slice(0, 10) === todayStr
    );
  }, [tracker.data?.logs, todayStr]);

  const todayHours = useMemo(() => {
    return todayLogs.reduce((sum, l) => sum + (Number(l.hoursStudied) || 0), 0);
  }, [todayLogs]);

  const todayQuestions = useMemo(() => {
    return todayLogs.reduce((sum, l) => sum + (Number(l.questionsSolved) || 0), 0);
  }, [todayLogs]);

  const dailyGoal = Number(tracker.data?.dailyAvailableHours) || 4;
  const remainingHours = Math.max(0, dailyGoal - todayHours);
  const progressPercent =
    dailyGoal > 0 ? Math.min(100, Math.round((todayHours / dailyGoal) * 100)) : 0;

  const totalHours = useMemo(() => {
    return (
      tracker.data?.subjects.reduce(
        (sum, subject) => sum + (Number(subject.cumulativeHours) || 0),
        0
      ) || 0
    );
  }, [tracker.data?.subjects]);

  const totalQuestions = useMemo(() => {
    return (
      tracker.data?.subjects.reduce(
        (sum, subject) => sum + (Number(subject.cumulativeQuestions) || 0),
        0
      ) || 0
    );
  }, [tracker.data?.subjects]);

  const totalSessions = tracker.data?.logs.length || 0;

  return (
    <AppScreen
      title="GATE Progress"
      subtitle="Personal study companion"
      refreshing={tracker.isRefetching}
      onRefresh={tracker.refetch}
    >
      {tracker.isLoading ? (
        <LoadingCard label="Loading your GATE progress…" />
      ) : null}

      {tracker.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Tracker is offline"
          description="Your cached progress will return when the server reconnects."
          action={
            <ActionButton
              label="Retry"
              compact
              onPress={() => tracker.refetch()}
            />
          }
        />
      ) : null}

      {tracker.data ? (
        <View style={styles.contentContainer}>
          {/* LEVEL 1: TODAY'S FOCUS HERO CARD */}
          <StudyHeroFocus
            todayHours={todayHours}
            dailyGoal={dailyGoal}
            progressPercent={progressPercent}
            remainingHours={remainingHours}
            todayQuestions={todayQuestions}
            onOpenGoal={() => open("goal")}
          />

          {/* LEVEL 2: PRIMARY ACTION BUTTON */}
          <Pressable
            onPress={() => open("log")}
            accessibilityRole="button"
            accessibilityLabel="Start and log a new study session"
            style={({ pressed }) => [
              styles.primaryStudyButton,
              { backgroundColor: theme.accent },
              pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
            ]}
          >
            <Ionicons name="play-circle" size={19} color="#09090B" />
            <Text style={styles.primaryStudyButtonText}>
              Start Study Session
            </Text>
          </Pressable>

          {/* LEVEL 3: QUICK STATS */}
          <StudyQuickStats
            totalHours={totalHours}
            totalQuestions={totalQuestions}
            totalSessions={totalSessions}
          />

          {/* LEVEL 4: RECENT STUDY LOGS */}
          <StudyRecentLogs
            logs={tracker.data.logs}
            onViewAll={() => setViewAllVisible(true)}
          />

          {/* LEVEL 5: WEEKLY INSIGHT */}
          <StudyWeeklyInsight
            weeklyAnalysis={tracker.data.weeklyAnalysis}
          />
        </View>
      ) : null}

      {/* FULL CHRONOLOGICAL VIEW ALL MODAL */}
      {tracker.data ? (
        <ViewAllStudyModal
          visible={viewAllVisible}
          title="Study History"
          subtitle={`${tracker.data.logs.length} logged sessions · ${totalHours.toFixed(
            1
          )}h total · ${totalQuestions.toLocaleString()} questions`}
          onClose={() => setViewAllVisible(false)}
          action={
            <Pressable
              onPress={() => {
                setViewAllVisible(false);
                open("log");
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Log a new study session"
              style={styles.textActionPill}
            >
              <Text style={[styles.textActionLabel, { color: theme.cyan }]}>
                + Log session
              </Text>
            </Pressable>
          }
        >
          {({ scrollHandler, contentContainerStyle }) => (
            <AllLogsContent
              logs={tracker.data.logs}
              subjects={tracker.data.subjects}
              totalHours={totalHours}
              totalQuestions={totalQuestions}
              weeklyAnalysis={tracker.data.weeklyAnalysis}
              scrollHandler={scrollHandler}
              contentContainerStyle={contentContainerStyle}
            />
          )}
        </ViewAllStudyModal>
      ) : null}

      {/* BOTTOM SHEET FOR LOGGING & GOAL SETTING */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={sheetMode === "log" ? ["75%"] : ["48%"]}
        backgroundStyle={[
          styles.sheetBackground,
          { backgroundColor: isDark ? "#121216" : theme.surface },
        ]}
        handleIndicatorStyle={[
          styles.sheetHandle,
          { backgroundColor: isDark ? theme.borderHover : theme.borderMuted },
        ]}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetContent}
        >
          {sheetMode === "log" ? (
            <StudyLogForm
              key={`log-${Date.now()}`}
              subjects={tracker.data?.subjects || []}
              busy={logMutation.isPending}
              onSave={(logData) => logMutation.mutate(logData)}
            />
          ) : (
            <StudyGoalForm
              key={`goal-${tracker.data?.dailyAvailableHours || 4}`}
              initialGoal={String(tracker.data?.dailyAvailableHours || 4)}
              busy={goalMutation.isPending}
              onSave={(goalVal) => goalMutation.mutate(Number(goalVal))}
            />
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    gap: spacing.md,
    paddingBottom: layout.bottomScrollPadding,
  },
  primaryStudyButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: layout.buttonHeight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  primaryStudyButtonText: {
    color: "#09090B",
    ...typography.button,
    fontSize: 14,
    fontWeight: "800",
  },
  textActionPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
  },
  textActionLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
  },
  sheetBackground: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
  },
  sheetContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
});
