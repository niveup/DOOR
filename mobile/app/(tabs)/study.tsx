import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { AppScreen } from "@/src/components/screen";
import {
  ActionButton,
  Card,
  Chip,
  EmptyState,
  LoadingCard,
  ProgressBar,
} from "@/src/components/ui";
import { api } from "@/src/services/api";
import { todayInKolkata } from "@/src/lib/format";
import { StudyLog, TrackerSubject } from "@/src/types/domain";
import { colors, radii } from "@/src/theme/tokens";

type SheetMode = "log" | "goal";

function formatHours(hours: number): string {
  if (hours <= 0) return "0h";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateShort(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const mIdx = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return `${monthNames[mIdx] || parts[1]} ${d}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export default function StudyScreen() {
  const { theme, isDark } = useTheme();
  const notify = useNotify();
  const client = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("log");
  const [viewAllVisible, setViewAllVisible] = useState(false);

  const tracker = useQuery({
    queryKey: ["tracker"],
    queryFn: api.tracker.status,
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

  const readiness = tracker.data?.overallReadiness ?? 0;
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
  const top3Logs = useMemo(
    () => (tracker.data?.logs || []).slice(0, 3),
    [tracker.data?.logs]
  );

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
          {/* ========================================================= */}
          {/* LEVEL 1: TODAY'S FOCUS & GOAL GRADIENT (VISUAL HERO)      */}
          {/* ========================================================= */}
          <Card style={styles.todayHeroCard}>
            <View style={styles.todayHeaderRow}>
              <View style={styles.todayTitleGroup}>
                <View
                  style={[
                    styles.pulseDot,
                    {
                      backgroundColor:
                        progressPercent >= 100 ? colors.emerald : colors.cyan,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.sectionOverline,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                >
                  TODAY’S FOCUS
                </Text>
              </View>
              <Pressable
                onPress={() => open("goal")}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.goalBadgeButton,
                  {
                    backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                    borderColor: isDark ? "#27272A" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.goalBadgeText,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  {dailyGoal}h goal
                </Text>
                <Ionicons
                  name="pencil-outline"
                  size={12}
                  color={isDark ? "#A1A1AA" : theme.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.todayNumbersRow}>
              <View style={styles.todayHoursGroup}>
                <Text
                  style={[
                    styles.todayHoursValue,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  {formatHours(todayHours)}
                </Text>
                <Text
                  style={[
                    styles.todayHoursGoal,
                    { color: isDark ? "#71717A" : theme.textFaint },
                  ]}
                >
                  / {dailyGoal}h
                </Text>
              </View>
              <Text
                style={[
                  styles.todayPercentValue,
                  {
                    color:
                      progressPercent >= 100 ? colors.emerald : colors.cyan,
                  },
                ]}
              >
                {progressPercent}%
              </Text>
            </View>

            <ProgressBar
              value={progressPercent}
              height={6}
              tone={progressPercent >= 100 ? colors.emerald : colors.cyan}
            />

            <View style={styles.todayMetaRow}>
              <Text
                style={[
                  styles.todayMetaText,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                {remainingHours > 0
                  ? `${formatHours(remainingHours)} remaining to reach target`
                  : todayHours > 0
                  ? "Daily goal achieved! Excellent momentum."
                  : "No study logged yet today"}
              </Text>
              {todayQuestions > 0 ? (
                <Text
                  style={[
                    styles.todayQuestionsText,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  {todayQuestions} questions
                </Text>
              ) : null}
            </View>
          </Card>

          {/* ========================================================= */}
          {/* LEVEL 2: PRIMARY ACTION                                   */}
          {/* ========================================================= */}
          <Pressable
            onPress={() => open("log")}
            style={({ pressed }) => [
              styles.primaryStudyButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
            ]}
          >
            <Ionicons name="play-circle" size={19} color="#09090B" />
            <Text style={styles.primaryStudyButtonText}>
              Start Study Session
            </Text>
          </Pressable>

          {/* ========================================================= */}
          {/* LEVEL 3: QUICK STATS (SINGLE 3-COLUMN COMPONENT)          */}
          {/* ========================================================= */}
          <View
            style={[
              styles.quickStatsContainer,
              {
                backgroundColor: isDark ? "#121215" : "#ffffff",
                borderColor: isDark ? "#27272A" : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.quickStatCol}>
              <Text
                style={[
                  styles.quickStatNumber,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                {totalHours.toFixed(1)}h
              </Text>
              <Text
                style={[
                  styles.quickStatLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Study time
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDark ? "#222226" : "#e2e8f0" },
              ]}
            />

            <View style={styles.quickStatCol}>
              <Text
                style={[
                  styles.quickStatNumber,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                {totalQuestions}
              </Text>
              <Text
                style={[
                  styles.quickStatLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Questions
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDark ? "#222226" : "#e2e8f0" },
              ]}
            />

            <View style={styles.quickStatCol}>
              <Text
                style={[
                  styles.quickStatNumber,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                {totalSessions}
              </Text>
              <Text
                style={[
                  styles.quickStatLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Sessions
              </Text>
            </View>
          </View>

          {/* ========================================================= */}
          {/* LEVEL 5: RECENT STUDY LOGS (COMPACT 68PX ROWS)            */}
          {/* ========================================================= */}
          <View style={styles.sectionGroup}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionTitleText,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Recent Study
              </Text>
              {tracker.data.logs.length > 0 ? (
                <Pressable
                  onPress={() => setViewAllVisible(true)}
                  hitSlop={8}
                  style={styles.viewAllButton}
                >
                  <Text style={styles.viewAllButtonText}>View all →</Text>
                </Pressable>
              ) : null}
            </View>

            {tracker.data.logs.length > 0 ? (
              <View
                style={[
                  styles.logsContainer,
                  {
                    backgroundColor: isDark ? "#121215" : "#ffffff",
                    borderColor: isDark ? "#27272A" : "#e2e8f0",
                  },
                ]}
              >
                {top3Logs.map((log, idx) => (
                  <Pressable
                    key={log.id}
                    onPress={() => setViewAllVisible(true)}
                    style={({ pressed }) => [
                      styles.logItemRow,
                      idx > 0 && [
                        styles.logRowDivider,
                        { borderTopColor: isDark ? "#1D1D22" : "#f1f5f9" },
                      ],
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={styles.logTextContainer}>
                      <Text
                        style={[
                          styles.logSubjectTitle,
                          { color: isDark ? "#FAFAFA" : theme.text },
                        ]}
                        numberOfLines={1}
                      >
                        {log.subjectName}
                      </Text>
                      <Text
                        style={[
                          styles.logMetaSubtitle,
                          { color: isDark ? "#71717A" : theme.textFaint },
                        ]}
                        numberOfLines={1}
                      >
                        {formatDateShort(log.logDate)} · {log.questionsSolved}{" "}
                        {log.questionsSolved === 1 ? "question" : "questions"}
                        {log.notes ? ` · ${log.notes}` : ""}
                      </Text>
                    </View>

                    <Text style={styles.logDurationText}>
                      {log.hoursStudied}h
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View
                style={[
                  styles.emptyLogsCard,
                  {
                    backgroundColor: isDark ? "#121215" : "#ffffff",
                    borderColor: isDark ? "#27272A" : "#e2e8f0",
                  },
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={24}
                  color={isDark ? "#52525B" : "#a1a1aa"}
                />
                <Text
                  style={[
                    styles.emptyLogsText,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                >
                  No study sessions recorded yet. Start your first session above.
                </Text>
              </View>
            )}
          </View>

          {/* ========================================================= */}
          {/* LEVEL 6: WEEKLY INSIGHT (AI READ / CALM STATE)            */}
          {/* ========================================================= */}
          <View style={styles.sectionGroup}>
            <Text
              style={[
                styles.sectionTitleText,
                { color: isDark ? "#FAFAFA" : theme.text },
              ]}
            >
              Weekly Insight
            </Text>

            {tracker.data.weeklyAnalysis ? (
              <Card
                style={[
                  styles.insightCard,
                  {
                    backgroundColor: isDark ? "#121215" : "#ffffff",
                    borderColor: isDark ? "#27272A" : "#e2e8f0",
                  },
                ]}
              >
                <View style={styles.insightHeader}>
                  <Ionicons
                    name="sparkles-outline"
                    size={16}
                    color={colors.violet}
                  />
                  <Text style={styles.insightOverline}>WEEKLY JUJUM READ</Text>
                </View>
                <Text
                  style={[
                    styles.insightBody,
                    { color: isDark ? "#D4D4D8" : theme.textMuted },
                  ]}
                >
                  {tracker.data.weeklyAnalysis}
                </Text>
              </Card>
            ) : (
              <View
                style={[
                  styles.insightPlaceholderCard,
                  {
                    backgroundColor: isDark ? "#121215" : "#ffffff",
                    borderColor: isDark ? "#222226" : "#e2e8f0",
                  },
                ]}
              >
                <Ionicons
                  name="bulb-outline"
                  size={20}
                  color={isDark ? "#71717A" : "#a1a1aa"}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[
                      styles.insightPlaceholderTitle,
                      { color: isDark ? "#FAFAFA" : theme.text },
                    ]}
                  >
                    Building your study profile
                  </Text>
                  <Text
                    style={[
                      styles.insightPlaceholderDesc,
                      { color: isDark ? "#71717A" : theme.textFaint },
                    ]}
                  >
                    Your weekly analysis will appear here as your study history
                    builds.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {/* ========================================================= */}
      {/* FULL CHRONOLOGICAL VIEW ALL MODAL                        */}
      {/* ========================================================= */}
      {tracker.data ? (
        <ViewAllStudyModal
          visible={viewAllVisible}
          title="Study History"
          subtitle={`${tracker.data.logs.length} logged sessions · ${totalHours.toFixed(
            1
          )}h total · ${totalQuestions} questions`}
          onClose={() => setViewAllVisible(false)}
          action={
            <Pressable
              onPress={() => {
                setViewAllVisible(false);
                open("log");
              }}
              hitSlop={8}
              style={styles.textActionPill}
            >
              <Text style={[styles.textActionLabel, { fontWeight: "700" }]}>
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

      {/* ========================================================= */}
      {/* BOTTOM SHEET FOR LOGGING & GOAL SETTING                  */}
      {/* ========================================================= */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={sheetMode === "log" ? ["75%"] : ["48%"]}
        backgroundStyle={[
          styles.sheetBackground,
          { backgroundColor: isDark ? "#121215" : "#ffffff" },
        ]}
        handleIndicatorStyle={[
          styles.sheetHandle,
          { backgroundColor: isDark ? "#3f3f46" : "#cbd5e1" },
        ]}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetContent}
        >
          {sheetMode === "log" ? (
            <LogForm
              key={`log-${Date.now()}`}
              subjects={tracker.data?.subjects || []}
              busy={logMutation.isPending}
              onSave={(logData) => logMutation.mutate(logData)}
            />
          ) : (
            <GoalForm
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

// -----------------------------------------------------------------
// Reusable Full-Height View All Modal with Gesture Dismissal
// -----------------------------------------------------------------
function ViewAllStudyModal({
  visible,
  onClose,
  title,
  subtitle,
  action,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: (props: {
    scrollHandler: any;
    contentContainerStyle: any;
  }) => React.ReactNode;
}) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDraggingSheet = useSharedValue(false);

  useEffect(() => {
    if (visible) {
      scrollY.value = 0;
      translateY.value = 0;
      isDraggingSheet.value = false;
    }
  }, [visible]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const contentPanGesture = Gesture.Pan()
    .activeOffsetY([10, 100000])
    .failOffsetY([-100000, -1])
    .onUpdate((event) => {
      "worklet";
      if (scrollY.value <= 1 && event.translationY > 0) {
        isDraggingSheet.value = true;
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (isDraggingSheet.value) {
        isDraggingSheet.value = false;
        if (translateY.value > 130 && event.velocityY > -50) {
          translateY.value = withTiming(900, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(onClose)();
            }
          });
        } else {
          translateY.value = withSpring(0, {
            damping: 24,
            stiffness: 260,
            mass: 0.8,
          });
        }
      }
    });

  const headerPanGesture = Gesture.Pan()
    .activeOffsetY([6, 100000])
    .failOffsetY([-100000, -1])
    .onUpdate((event) => {
      "worklet";
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (translateY.value > 120 && event.velocityY > -50) {
        translateY.value = withTiming(900, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
      } else {
        translateY.value = withSpring(0, {
          damping: 24,
          stiffness: 260,
          mass: 0.8,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: Math.max(0, translateY.value) }],
    };
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.viewAllBackdrop}>
        <Animated.View
          style={[
            styles.viewAllContainer,
            {
              backgroundColor: isDark ? "#09090b" : "#f8fafc",
            },
            animatedStyle,
          ]}
        >
          <GestureDetector gesture={headerPanGesture}>
            <View
              style={[
                styles.detailHeaderArea,
                {
                  paddingTop: Math.max(insets.top, 14),
                  borderBottomColor: isDark ? "#18181D" : "#e2e8f0",
                  backgroundColor: isDark ? "#09090b" : "#f8fafc",
                },
              ]}
            >
              <View style={styles.sheetDragHandleWrapper}>
                <View
                  style={[
                    styles.sheetDragHandleBar,
                    { backgroundColor: isDark ? "#3f3f46" : "#cbd5e1" },
                  ]}
                />
              </View>

              <View style={styles.detailHeaderTop}>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.detailBackButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="arrow-back"
                    size={18}
                    color={isDark ? "#F5F5F7" : theme.text}
                  />
                  <Text
                    style={[
                      styles.detailHeaderTitle,
                      { color: isDark ? "#F5F5F7" : theme.text },
                    ]}
                  >
                    {title}
                  </Text>
                </Pressable>
                {action}
              </View>

              {subtitle ? (
                <Text
                  style={[
                    styles.detailHeaderSubtitle,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </GestureDetector>

          <GestureDetector gesture={contentPanGesture}>
            <View style={{ flex: 1 }}>
              {children({
                scrollHandler,
                contentContainerStyle: [
                  styles.detailScrollBody,
                  { paddingBottom: insets.bottom + 40 },
                ],
              })}
            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------
// Dedicated View: All Study Logs & Head-to-Head Comparison
// -----------------------------------------------------------------
function AllLogsContent({
  logs,
  subjects,
  totalHours,
  totalQuestions,
  weeklyAnalysis,
  scrollHandler,
  contentContainerStyle,
}: {
  logs: StudyLog[];
  subjects: TrackerSubject[];
  totalHours: number;
  totalQuestions: number;
  weeklyAnalysis?: string;
  scrollHandler: any;
  contentContainerStyle: any;
}) {
  const { theme, isDark } = useTheme();

  const subjectBreakdown = useMemo(() => {
    return subjects
      .map((sub) => {
        const subLogs = logs.filter(
          (l) =>
            l.subjectName === sub.subjectName || l.subjectId === sub.subjectId
        );
        const hours =
          subLogs.reduce((sum, l) => sum + (l.hoursStudied || 0), 0) ||
          sub.cumulativeHours ||
          0;
        const questions =
          subLogs.reduce((sum, l) => sum + (l.questionsSolved || 0), 0) ||
          sub.cumulativeQuestions ||
          0;
        const share =
          totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0;
        return {
          id: sub.subjectId,
          name: sub.subjectName,
          hours,
          questions,
          sessionsCount: subLogs.length,
          share,
        };
      })
      .filter((s) => s.hours > 0 || s.questions > 0 || s.sessionsCount > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [subjects, logs, totalHours]);

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    >
      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
            },
          ]}
        >
          <Text
            style={[
              styles.metricLabelText,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            TOTAL SESSIONS
          </Text>
          <Text style={[styles.metricNumber, { color: colors.cyan }]}>
            {logs.length}
          </Text>
        </View>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
            },
          ]}
        >
          <Text
            style={[
              styles.metricLabelText,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            HOURS LOGGED
          </Text>
          <Text style={[styles.metricNumber, { color: colors.emerald }]}>
            {totalHours.toFixed(1)}h
          </Text>
        </View>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
            },
          ]}
        >
          <Text
            style={[
              styles.metricLabelText,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            QUESTIONS
          </Text>
          <Text style={[styles.metricNumber, { color: colors.amber }]}>
            {totalQuestions}
          </Text>
        </View>
      </View>

      {subjectBreakdown.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text
            style={[
              styles.fieldLabel,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            HEAD-TO-HEAD SUBJECT BREAKDOWN
          </Text>
          <View
            style={[
              styles.unifiedCard,
              {
                backgroundColor: isDark ? "#121215" : "#ffffff",
                borderColor: isDark ? "#27272a" : "#e2e8f0",
              },
            ]}
          >
            {subjectBreakdown.map((item, idx) => (
              <View
                key={item.name}
                style={[
                  styles.subjectBreakdownRow,
                  idx > 0 && [
                    styles.hairlineDivider,
                    { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
                  ],
                ]}
              >
                <View style={styles.subjectBreakdownHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        styles.subjectBreakdownTitle,
                        { color: isDark ? "#F5F5F7" : theme.text },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.subjectBreakdownSubtext,
                        { color: isDark ? "#71717A" : theme.textFaint },
                      ]}
                    >
                      {item.sessionsCount}{" "}
                      {item.sessionsCount === 1 ? "session" : "sessions"} ·{" "}
                      {item.questions} questions
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.subjectBreakdownHours,
                      { color: colors.cyan },
                    ]}
                  >
                    {item.hours.toFixed(1)}h{" "}
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? "#71717A" : theme.textFaint,
                      }}
                    >
                      ({item.share}%)
                    </Text>
                  </Text>
                </View>
                <ProgressBar value={item.share} height={4} tone={colors.cyan} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text
          style={[
            styles.fieldLabel,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          ALL STUDY SESSIONS ({logs.length})
        </Text>
        {logs.length > 0 ? (
          <View
            style={[
              styles.unifiedCard,
              {
                backgroundColor: isDark ? "#121215" : "#ffffff",
                borderColor: isDark ? "#27272a" : "#e2e8f0",
              },
            ]}
          >
            {logs.map((log, idx) => (
              <View
                key={log.id}
                style={[
                  styles.logHistoryRow,
                  idx > 0 && [
                    styles.hairlineDivider,
                    { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
                  ],
                ]}
              >
                <View style={styles.logTextContainer}>
                  <Text
                    style={[
                      styles.logSubjectTitle,
                      { color: isDark ? "#F5F5F7" : theme.text },
                    ]}
                  >
                    {log.subjectName}
                  </Text>
                  <Text
                    style={[
                      styles.logMetaSubtitle,
                      { color: isDark ? "#71717A" : theme.textFaint },
                    ]}
                  >
                    {log.logDate} · {log.questionsSolved} questions
                  </Text>
                  {log.notes ? (
                    <Text
                      style={[
                        styles.logNotes,
                        { color: isDark ? "#A1A1AA" : theme.textMuted },
                      ]}
                    >
                      "{log.notes}"
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.logDurationText}>{log.hoursStudied}h</Text>
              </View>
            ))}
          </View>
        ) : (
          <Card>
            <Text
              style={{ color: isDark ? "#71717A" : theme.textFaint, fontSize: 13 }}
            >
              No study sessions recorded yet.
            </Text>
          </Card>
        )}
      </View>

      {weeklyAnalysis ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text
            style={[
              styles.fieldLabel,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            WEEKLY ANALYSIS
          </Text>
          <Card>
            <Text style={styles.analysisLabel}>WEEKLY JUJUM READ</Text>
            <Text style={styles.analysis}>{weeklyAnalysis}</Text>
          </Card>
        </View>
      ) : null}
    </Animated.ScrollView>
  );
}

// -----------------------------------------------------------------
// Log Study Block Form (Sheet)
// -----------------------------------------------------------------
function LogForm({
  subjects,
  busy,
  onSave,
}: {
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
}) {
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
      <Text
        style={[
          styles.sheetTitle,
          { color: isDark ? "#FAFAFA" : theme.text },
        ]}
      >
        Log Study Session
      </Text>
      <Text
        style={[
          styles.sheetSubtitle,
          { color: isDark ? "#A1A1AA" : theme.textMuted },
        ]}
      >
        Record your focused block to update readiness and track goal progress.
      </Text>

      {/* Subject Selection */}
      <Text
        style={[
          styles.fieldLabel,
          { color: isDark ? "#71717A" : theme.textFaint },
        ]}
      >
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
              tone={colors.cyan}
              onPress={() => setSelected(subject)}
            />
          ))}
        </ScrollView>
      ) : (
        <BottomSheetTextInput
          style={[
            styles.inputField,
            {
              backgroundColor: isDark ? "#18181D" : "#f4f4f5",
              borderColor: isDark ? "#27272A" : "#e4e4e7",
              color: isDark ? "#FAFAFA" : theme.text,
            },
          ]}
          value={customSubject}
          onChangeText={setCustomSubject}
          placeholder="e.g. Operating Systems"
          placeholderTextColor={isDark ? "#52525B" : "#a1a1aa"}
          autoCapitalize="sentences"
        />
      )}

      {/* Time Block Selection */}
      <Text
        style={[
          styles.fieldLabel,
          { color: isDark ? "#71717A" : theme.textFaint },
        ]}
      >
        TIME OF DAY
      </Text>
      <View style={styles.horizontalGrid}>
        {timeBlocks.map((block) => (
          <Chip
            key={block}
            label={block}
            active={timeBlock === block}
            tone={colors.emerald}
            onPress={() => setTimeBlock(block)}
          />
        ))}
      </View>

      {/* Duration Quick Presets & Manual Hours */}
      <Text
        style={[
          styles.fieldLabel,
          { color: isDark ? "#71717A" : theme.textFaint },
        ]}
      >
        DURATION (HOURS)
      </Text>
      <View style={styles.horizontalGrid}>
        {durationPresets.map((preset) => (
          <Chip
            key={preset}
            label={`${preset}h`}
            active={hours === preset}
            tone={colors.cyan}
            onPress={() => setHours(preset)}
          />
        ))}
      </View>

      <View style={styles.twoColumnFields}>
        <View style={styles.columnField}>
          <Text
            style={[
              styles.fieldLabel,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            EXACT HOURS
          </Text>
          <BottomSheetTextInput
            style={[
              styles.inputField,
              {
                backgroundColor: isDark ? "#18181D" : "#f4f4f5",
                borderColor: isDark ? "#27272A" : "#e4e4e7",
                color: isDark ? "#FAFAFA" : theme.text,
              },
            ]}
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={isDark ? "#52525B" : "#a1a1aa"}
          />
        </View>
        <View style={styles.columnField}>
          <Text
            style={[
              styles.fieldLabel,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            QUESTIONS
          </Text>
          <BottomSheetTextInput
            style={[
              styles.inputField,
              {
                backgroundColor: isDark ? "#18181D" : "#f4f4f5",
                borderColor: isDark ? "#27272A" : "#e4e4e7",
                color: isDark ? "#FAFAFA" : theme.text,
              },
            ]}
            value={questions}
            onChangeText={setQuestions}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={isDark ? "#52525B" : "#a1a1aa"}
          />
        </View>
      </View>

      {/* Note Field */}
      <Text
        style={[
          styles.fieldLabel,
          { color: isDark ? "#71717A" : theme.textFaint },
        ]}
      >
        NOTE (OPTIONAL)
      </Text>
      <BottomSheetTextInput
        style={[
          styles.inputField,
          styles.multilineInput,
          {
            backgroundColor: isDark ? "#18181D" : "#f4f4f5",
            borderColor: isDark ? "#27272A" : "#e4e4e7",
            color: isDark ? "#FAFAFA" : theme.text,
          },
        ]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Topics covered, problem areas, or formulas revised"
        placeholderTextColor={isDark ? "#52525B" : "#a1a1aa"}
      />

      <ActionButton
        label={busy ? "Saving…" : "Save Study Session"}
        icon="checkmark-circle"
        tone="emerald"
        disabled={busy}
        onPress={handleSave}
      />
    </View>
  );
}

// -----------------------------------------------------------------
// Set Daily Goal Form (Sheet)
// -----------------------------------------------------------------
function GoalForm({
  initialGoal,
  busy,
  onSave,
}: {
  initialGoal: string;
  busy: boolean;
  onSave: (val: string) => void;
}) {
  const { theme, isDark } = useTheme();
  const [goal, setGoal] = useState(initialGoal);
  const presets = ["2", "4", "6", "8"];

  return (
    <View style={styles.formContainer}>
      <Text
        style={[
          styles.sheetTitle,
          { color: isDark ? "#FAFAFA" : theme.text },
        ]}
      >
        Daily Study Goal
      </Text>
      <Text
        style={[
          styles.sheetSubtitle,
          { color: isDark ? "#A1A1AA" : theme.textMuted },
        ]}
      >
        Set a realistic daily target you can comfortably protect most days.
      </Text>

      {/* Quick Presets */}
      <View style={styles.horizontalGrid}>
        {presets.map((preset) => (
          <Chip
            key={preset}
            label={`${preset} hours`}
            active={goal === preset}
            tone={colors.emerald}
            onPress={() => setGoal(preset)}
          />
        ))}
      </View>

      <View style={styles.goalInputWrapper}>
        <BottomSheetTextInput
          style={[
            styles.goalBigInput,
            {
              backgroundColor: isDark ? "#18181D" : "#f4f4f5",
              borderColor: isDark ? "#27272A" : "#e4e4e7",
              color: isDark ? "#FAFAFA" : theme.text,
            },
          ]}
          value={goal}
          onChangeText={setGoal}
          keyboardType="decimal-pad"
          placeholder="4"
          placeholderTextColor={isDark ? "#52525B" : "#a1a1aa"}
        />
        <Text
          style={[
            styles.goalInputUnit,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          hours per day
        </Text>
      </View>

      <ActionButton
        label={busy ? "Saving…" : "Save Daily Goal"}
        icon="checkmark"
        tone="emerald"
        disabled={busy}
        onPress={() => onSave(goal)}
      />
    </View>
  );
}

// -----------------------------------------------------------------
// STYLESHEET (STRICT OBSIDIAN TOKENS & MATHEMATICAL 8-PT SPACING)
// -----------------------------------------------------------------
const styles = StyleSheet.create({
  contentContainer: {
    gap: 14,
    paddingBottom: 24,
  },

  // 1. TODAY'S HERO CARD
  todayHeroCard: {
    padding: 16,
    gap: 12,
    borderRadius: radii.lg,
  },
  todayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todayTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionOverline: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  goalBadgeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  goalBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  todayNumbersRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  todayHoursGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  todayHoursValue: {
    fontSize: 32,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  todayHoursGoal: {
    fontSize: 15,
    fontWeight: "700",
  },
  todayPercentValue: {
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  todayMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todayMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  todayQuestionsText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // 2. PRIMARY ACTION
  primaryStudyButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.emerald,
    height: 46,
    borderRadius: radii.md,
    paddingHorizontal: 16,
  },
  primaryStudyButtonText: {
    color: "#09090B",
    fontSize: 14,
    fontWeight: "800",
  },

  // 3. QUICK STATS (3-COLUMN ROW)
  quickStatsContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  quickStatCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  quickStatNumber: {
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },

  // 4. RECENT STUDY LOGS
  sectionGroup: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionTitleText: {
    fontSize: 14.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  viewAllButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewAllButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.cyan,
  },
  logsContainer: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  logItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 10,
    minHeight: 62,
  },
  logRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logIconBox: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
  },
  logTextContainer: {
    flex: 1,
    gap: 2,
  },
  logSubjectTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  logMetaSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  logDurationText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.cyan,
    fontVariant: ["tabular-nums"],
  },
  emptyLogsCard: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  emptyLogsText: {
    fontSize: 12.5,
    textAlign: "center",
    fontWeight: "500",
  },

  // 6. WEEKLY INSIGHT
  insightCard: {
    padding: 14,
    gap: 8,
    borderRadius: radii.md,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightOverline: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.violet,
    letterSpacing: 0.8,
  },
  insightBody: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "400",
  },
  insightPlaceholderCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  insightPlaceholderTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  insightPlaceholderDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },

  // BOTTOM SHEET STYLES
  sheetBackground: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 44,
  },
  formContainer: {
    gap: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  horizontalChipRow: {
    gap: 8,
    paddingBottom: 2,
  },
  horizontalGrid: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  twoColumnFields: {
    flexDirection: "row",
    gap: 10,
  },
  columnField: {
    flex: 1,
    gap: 6,
  },
  inputField: {
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  multilineInput: {
    height: 76,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  goalInputWrapper: {
    alignItems: "center",
    gap: 4,
    marginVertical: 6,
  },
  goalBigInput: {
    width: 120,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  goalInputUnit: {
    fontSize: 12,
    fontWeight: "600",
  },

  // VIEW ALL PRESENTATION MODAL
  viewAllBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  viewAllContainer: {
    flex: 1,
  },
  sheetDragHandleWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  sheetDragHandleBar: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
  },
  detailHeaderArea: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  detailHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  detailHeaderSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    paddingLeft: 26,
  },
  detailScrollBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },
  textActionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  textActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.cyan,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 3,
  },
  metricLabelText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  unifiedCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  subjectBreakdownRow: {
    padding: 12,
    gap: 6,
  },
  subjectBreakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  subjectBreakdownTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  subjectBreakdownSubtext: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  subjectBreakdownHours: {
    fontSize: 13.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  logHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 10,
  },
  logNotes: {
    fontSize: 11.5,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 16,
  },
  analysisLabel: {
    color: colors.violet,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  analysis: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
  },
});
