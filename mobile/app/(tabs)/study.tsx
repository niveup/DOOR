import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
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
import { AppScreen } from "@/src/components/screen";
import { ActionButton, Card, Chip, EmptyState, IconButton, LoadingCard, Metric, ProgressBar, SectionTitle, ui } from "@/src/components/ui";
import { api } from "@/src/services/api";
import { todayInKolkata } from "@/src/lib/format";
import { StudyLog, TrackerSubject } from "@/src/types/domain";
import { colors } from "@/src/theme/tokens";

type SheetMode = "log" | "goal";

export default function StudyScreen() {
  const client = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("log");
  const [viewAllVisible, setViewAllVisible] = useState(false);
  const tracker = useQuery({ queryKey: ["tracker"], queryFn: api.tracker.status });

  const open = (mode: SheetMode) => {
    setSheetMode(mode);
    sheetRef.current?.present();
  };

  const logMutation = useMutation({
    mutationFn: api.tracker.log,
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      client.invalidateQueries({ queryKey: ["tracker"] });
    },
  });

  const goalMutation = useMutation({
    mutationFn: api.tracker.goal,
    onSuccess: () => {
      sheetRef.current?.dismiss();
      client.invalidateQueries({ queryKey: ["tracker"] });
    },
  });

  const readiness = tracker.data?.overallReadiness || 0;
  const totalHours = tracker.data?.subjects.reduce((sum, subject) => sum + subject.cumulativeHours, 0) || 0;
  const totalQuestions = tracker.data?.subjects.reduce((sum, subject) => sum + subject.cumulativeQuestions, 0) || 0;
  const top3Logs = useMemo(() => (tracker.data?.logs || []).slice(0, 3), [tracker.data?.logs]);

  return (
    <AppScreen
      title="GATE Progress"
      subtitle="Your honest signal—not just a streak."
      refreshing={tracker.isRefetching}
      onRefresh={tracker.refetch}
      action={<IconButton icon="add" label="Log study session" onPress={() => open("log")} tone={colors.cyan} />}
    >
      {tracker.isLoading ? <LoadingCard label="Loading your GATE signal…" /> : null}
      {tracker.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Tracker is offline"
          description="Your cached progress will return when the server reconnects."
          action={<ActionButton label="Retry" compact onPress={() => tracker.refetch()} />}
        />
      ) : null}
      {tracker.data ? (
        <>
          <Card style={styles.readiness}>
            <View style={ui.spread}>
              <View>
                <Text style={styles.overline}>OVERALL READINESS</Text>
                <Text style={styles.readinessValue}>{readiness}%</Text>
              </View>
              <View style={styles.goalBox}>
                <Text style={styles.goalLabel}>DAILY GOAL</Text>
                <Text style={styles.goalValue}>{tracker.data.dailyAvailableHours}h</Text>
                <ActionButton label="Edit" compact tone="ghost" onPress={() => open("goal")} />
              </View>
            </View>
            <ProgressBar value={readiness} tone={readiness >= 65 ? colors.emerald : colors.cyan} />
          </Card>
          <Card style={styles.metrics}>
            <Metric label="Cumulative hours" value={`${totalHours.toFixed(1)}h`} accent={colors.cyan} />
            <Metric label="Questions solved" value={totalQuestions} accent={colors.emerald} />
            <Metric label="Logged sessions" value={tracker.data.logs.length} accent={colors.violet} />
          </Card>
          <SectionTitle
            title="Recent study logs"
            trailing={
              tracker.data.logs.length > 0 ? (
                <Pressable
                  onPress={() => setViewAllVisible(true)}
                  hitSlop={8}
                  style={styles.textActionPill}
                >
                  <Text style={styles.textActionLabel}>
                    View all →
                  </Text>
                </Pressable>
              ) : (
                <ActionButton label="Log session" compact onPress={() => open("log")} />
              )
            }
          />
          {tracker.data.logs.length ? (
            <Card style={styles.logsCard}>
              {top3Logs.map((log, idx) => (
                <View
                  key={log.id}
                  style={[
                    styles.logRow,
                    idx > 0 && styles.logRowDivider,
                  ]}
                >
                  <View style={styles.logIcon}>
                    <Ionicons name="time-outline" color={colors.cyan} size={17} />
                  </View>
                  <View style={styles.logCopy}>
                    <Text style={styles.logTitle}>{log.subjectName}</Text>
                    <Text style={styles.logMeta}>
                      {log.logDate} · {log.questionsSolved} questions {log.notes ? `· ${log.notes}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.logHours}>{log.hoursStudied}h</Text>
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Text style={styles.muted}>Log your first focused block—the tracker will handle the aggregation.</Text>
            </Card>
          )}
          {tracker.data.weeklyAnalysis ? (
            <Card>
              <Text style={styles.analysisLabel}>WEEKLY JUJUM READ</Text>
              <Text style={styles.analysis}>{tracker.data.weeklyAnalysis}</Text>
            </Card>
          ) : null}
        </>
      ) : null}

      {/* Dedicated Full View All Modal */}
      {tracker.data ? (
        <ViewAllStudyModal
          visible={viewAllVisible}
          title="Study History"
          subtitle={`${tracker.data.logs.length} logged sessions · ${totalHours.toFixed(1)}h total · ${totalQuestions} questions`}
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

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["72%"]}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={styles.handle}
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
              backgroundColor: isDark ? "#08080A" : "#f8fafc",
            },
            animatedStyle,
          ]}
        >
          {/* Header with HeaderPanGesture */}
          <GestureDetector gesture={headerPanGesture}>
            <View
              style={[
                styles.detailHeaderArea,
                {
                  paddingTop: Math.max(insets.top, 14),
                  borderBottomColor: isDark ? "#18181D" : "#e2e8f0",
                  backgroundColor: isDark ? "#08080A" : "#f8fafc",
                },
              ]}
            >
              {/* Drag Handle Bar */}
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
                  style={({ pressed }) => [styles.detailBackButton, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="arrow-back" size={18} color={isDark ? "#F5F5F7" : theme.text} />
                  <Text style={[styles.detailHeaderTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>
                    {title}
                  </Text>
                </Pressable>
                {action}
              </View>

              {subtitle ? (
                <Text style={[styles.detailHeaderSubtitle, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </GestureDetector>

          {/* Content with ContentPanGesture */}
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

  // Head-to-Head Subject Aggregation
  const subjectBreakdown = useMemo(() => {
    return subjects
      .map((sub) => {
        const subLogs = logs.filter((l) => l.subjectName === sub.subjectName || l.subjectId === sub.subjectId);
        const hours = subLogs.reduce((sum, l) => sum + (l.hoursStudied || 0), 0) || sub.cumulativeHours || 0;
        const questions = subLogs.reduce((sum, l) => sum + (l.questionsSolved || 0), 0) || sub.cumulativeQuestions || 0;
        const share = totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0;
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
      {/* 1. Summary Highlights */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: isDark ? "#121215" : "#ffffff", borderColor: isDark ? "#27272a" : "#e2e8f0" }]}>
          <Text style={[styles.metricLabelText, { color: isDark ? "#71717A" : theme.textFaint }]}>TOTAL SESSIONS</Text>
          <Text style={[styles.metricNumber, { color: colors.cyan }]}>{logs.length}</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: isDark ? "#121215" : "#ffffff", borderColor: isDark ? "#27272a" : "#e2e8f0" }]}>
          <Text style={[styles.metricLabelText, { color: isDark ? "#71717A" : theme.textFaint }]}>HOURS LOGGED</Text>
          <Text style={[styles.metricNumber, { color: colors.emerald }]}>{totalHours.toFixed(1)}h</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: isDark ? "#121215" : "#ffffff", borderColor: isDark ? "#27272a" : "#e2e8f0" }]}>
          <Text style={[styles.metricLabelText, { color: isDark ? "#71717A" : theme.textFaint }]}>QUESTIONS</Text>
          <Text style={[styles.metricNumber, { color: colors.amber }]}>{totalQuestions}</Text>
        </View>
      </View>

      {/* 2. Head-to-Head Subject Comparison */}
      {subjectBreakdown.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
            HEAD-TO-HEAD SUBJECT BREAKDOWN
          </Text>
          <View style={[styles.unifiedCard, { backgroundColor: isDark ? "#121215" : "#ffffff", borderColor: isDark ? "#27272a" : "#e2e8f0" }]}>
            {subjectBreakdown.map((item, idx) => (
              <View
                key={item.name}
                style={[
                  styles.subjectBreakdownRow,
                  idx > 0 && [styles.hairlineDivider, { borderTopColor: isDark ? "#18181D" : "#f1f5f9" }],
                ]}
              >
                <View style={styles.subjectBreakdownHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.subjectBreakdownTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.subjectBreakdownSubtext, { color: isDark ? "#71717A" : theme.textFaint }]}>
                      {item.sessionsCount} {item.sessionsCount === 1 ? "session" : "sessions"} · {item.questions} questions
                    </Text>
                  </View>
                  <Text style={[styles.subjectBreakdownHours, { color: colors.cyan }]}>
                    {item.hours.toFixed(1)}h <Text style={{ fontSize: 11, color: isDark ? "#71717A" : theme.textFaint }}>({item.share}%)</Text>
                  </Text>
                </View>
                <ProgressBar value={item.share} height={4} tone={colors.cyan} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 3. All Chronological Study Logs */}
      <View style={{ gap: 8 }}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
          ALL STUDY SESSIONS ({logs.length})
        </Text>
        {logs.length > 0 ? (
          <View style={[styles.unifiedCard, { backgroundColor: isDark ? "#121215" : "#ffffff", borderColor: isDark ? "#27272a" : "#e2e8f0" }]}>
            {logs.map((log, idx) => (
              <View
                key={log.id}
                style={[
                  styles.logHistoryRow,
                  idx > 0 && [styles.hairlineDivider, { borderTopColor: isDark ? "#18181D" : "#f1f5f9" }],
                ]}
              >
                <View style={styles.logIcon}>
                  <Ionicons name="time-outline" color={colors.cyan} size={17} />
                </View>
                <View style={styles.logCopy}>
                  <Text style={[styles.logTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>{log.subjectName}</Text>
                  <Text style={[styles.logMeta, { color: isDark ? "#71717A" : theme.textFaint }]}>
                    {log.logDate} · {log.questionsSolved} questions
                  </Text>
                  {log.notes ? (
                    <Text style={[styles.logNotes, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                      "{log.notes}"
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.logHours}>{log.hoursStudied}h</Text>
              </View>
            ))}
          </View>
        ) : (
          <Card>
            <Text style={styles.muted}>No study sessions recorded yet.</Text>
          </Card>
        )}
      </View>

      {/* 4. Weekly Jujum Read if present */}
      {weeklyAnalysis ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
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
  const [selected, setSelected] = useState<TrackerSubject | null>(subjects[0] || null);
  const [customSubject, setCustomSubject] = useState("");
  const [hours, setHours] = useState("1");
  const [questions, setQuestions] = useState("0");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    const finalSubjectName = selected?.subjectName || customSubject.trim() || "General Study";
    const finalSubjectId = selected?.subjectId || 1;
    onSave({
      logDate: todayInKolkata(),
      timeBlock: "Mobile log",
      subjectId: finalSubjectId,
      subjectName: finalSubjectName,
      hoursStudied: Math.max(0, Number(hours) || 0),
      questionsSolved: Math.max(0, Number(questions) || 0),
      notes: notes.trim(),
    });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.sheetTitle}>Log study block</Text>
      <Text style={styles.sheetSubtitle}>
        The dashboard updates optimistically, then securely syncs in the background.
      </Text>
      <Text style={styles.fieldLabel}>SUBJECT</Text>
      {subjects.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker}>
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
          style={styles.input}
          value={customSubject}
          onChangeText={setCustomSubject}
          placeholder="e.g. Operating Systems"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="sentences"
        />
      )}
      <View style={styles.fields}>
        <View style={styles.smallField}>
          <Text style={styles.fieldLabel}>HOURS</Text>
          <BottomSheetTextInput
            style={styles.input}
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={colors.textFaint}
          />
        </View>
        <View style={styles.smallField}>
          <Text style={styles.fieldLabel}>QUESTIONS</Text>
          <BottomSheetTextInput
            style={styles.input}
            value={questions}
            onChangeText={setQuestions}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textFaint}
          />
        </View>
      </View>
      <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
      <BottomSheetTextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="What did you learn or get stuck on?"
        placeholderTextColor={colors.textFaint}
      />
      <ActionButton
        label={busy ? "Logging…" : "Save study log"}
        icon="checkmark"
        disabled={busy}
        onPress={handleSave}
      />
    </View>
  );
}

function GoalForm({
  initialGoal,
  busy,
  onSave,
}: {
  initialGoal: string;
  busy: boolean;
  onSave: (val: string) => void;
}) {
  const [goal, setGoal] = useState(initialGoal);

  return (
    <View style={styles.form}>
      <Text style={styles.sheetTitle}>Set daily availability</Text>
      <Text style={styles.sheetSubtitle}>This is capacity, not pressure. Pick the time you can protect most days.</Text>
      <BottomSheetTextInput
        style={styles.goalInput}
        value={goal}
        onChangeText={setGoal}
        keyboardType="decimal-pad"
        placeholder="4"
        placeholderTextColor={colors.textFaint}
      />
      <Text style={styles.goalHint}>hours per day</Text>
      <ActionButton
        label={busy ? "Saving…" : "Save daily goal"}
        icon="checkmark"
        disabled={busy}
        onPress={() => onSave(goal)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  readiness: { backgroundColor: colors.surface, borderColor: colors.border, gap: 13 },
  overline: { color: colors.cyan, fontSize: 10, letterSpacing: 1, fontWeight: "900" },
  readinessValue: { color: colors.text, fontSize: 39, fontWeight: "900", fontVariant: ["tabular-nums"] },
  goalBox: { alignItems: "flex-end", gap: 5 },
  goalLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 0.8, fontWeight: "900" },
  goalValue: { color: colors.amber, fontSize: 19, fontWeight: "900" },
  metrics: { flexDirection: "row", gap: 8 },

  // Single Merged Logs Card on Main Screen
  logsCard: {
    padding: 0,
    overflow: "hidden",
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  logRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  logIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderWidth: 1,
  },
  logCopy: { flex: 1, gap: 3 },
  logTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  logMeta: { color: colors.textFaint, fontSize: 10, lineHeight: 14 },
  logHours: { color: colors.cyan, fontWeight: "900", fontSize: 13 },
  analysisLabel: { color: colors.violet, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  analysis: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: 13 },
  sheet: { backgroundColor: colors.surface },
  handle: { backgroundColor: colors.border },
  sheetContent: { padding: 20, paddingBottom: 48 },
  form: { gap: 13 },
  sheetTitle: { color: colors.text, fontSize: 23, fontWeight: "900" },
  sheetSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 5 },
  fieldLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" },
  picker: { gap: 8 },
  fields: { flexDirection: "row", gap: 10 },
  smallField: { flex: 1, gap: 7 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  multiline: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
  goalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 14,
    textAlign: "center",
    fontSize: 40,
    fontWeight: "900",
    paddingVertical: 12,
  },
  goalHint: { color: colors.textMuted, textAlign: "center", fontSize: 13, marginTop: -7 },

  // Action Pills
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

  // View All Presentation Layer
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
    paddingHorizontal: 20,
    paddingBottom: 14,
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
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  detailHeaderSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    paddingLeft: 26,
  },
  detailScrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },

  // Metrics Highlights Row
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  metricLabelText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  unifiedCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  // Head-to-Head Subject Breakdown
  subjectBreakdownRow: {
    padding: 14,
    gap: 8,
  },
  subjectBreakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  subjectBreakdownTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  subjectBreakdownSubtext: {
    fontSize: 12,
    fontWeight: "500",
  },
  subjectBreakdownHours: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  // Log History Rows in View All
  logHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 10,
  },
  logNotes: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 16,
  },
});
