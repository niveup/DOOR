import React, { useEffect, useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { Card, ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";
import { StudyLog, TrackerSubject } from "@/src/types/domain";
import { shortDate, todayInKolkata } from "@/src/lib/format";

export function formatLogDate(dateStr: string): string {
  try {
    const today = todayInKolkata();
    const cleanDate = (dateStr || "").slice(0, 10);
    if (cleanDate === today) {
      return "Today";
    }
    return shortDate(cleanDate);
  } catch {
    return dateStr;
  }
}

export interface ViewAllStudyModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: (props: {
    scrollHandler: any;
    contentContainerStyle: any;
  }) => React.ReactNode;
}

export function ViewAllStudyModal({
  visible,
  onClose,
  title,
  subtitle,
  action,
  children,
}: ViewAllStudyModalProps) {
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
              backgroundColor: isDark ? theme.canvas : theme.surfaceSubtle,
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
                  borderBottomColor: isDark ? theme.borderMuted : theme.border,
                  backgroundColor: isDark ? theme.canvas : theme.surface,
                },
              ]}
            >
              <View style={styles.sheetDragHandleWrapper}>
                <View
                  style={[
                    styles.sheetDragHandleBar,
                    {
                      backgroundColor: isDark
                        ? theme.borderHover
                        : theme.borderMuted,
                    },
                  ]}
                />
              </View>

              <View style={styles.detailHeaderTop}>
                <Pressable
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close study history"
                  style={({ pressed }) => [
                    styles.detailBackButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="arrow-back"
                    size={18}
                    color={isDark ? "#fafafa" : theme.text}
                  />
                  <Text
                    style={[
                      styles.detailHeaderTitle,
                      { color: isDark ? "#fafafa" : theme.text },
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
                    { color: theme.textMuted },
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

export interface AllLogsContentProps {
  logs: StudyLog[];
  subjects: TrackerSubject[];
  totalHours: number;
  totalQuestions: number;
  weeklyAnalysis?: string;
  scrollHandler: any;
  contentContainerStyle: any;
}

export function AllLogsContent({
  logs,
  subjects,
  totalHours,
  totalQuestions,
  weeklyAnalysis,
  scrollHandler,
  contentContainerStyle,
}: AllLogsContentProps) {
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
      {/* 1. Quick Metrics Summary */}
      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          <Text
            style={[styles.metricLabelText, { color: theme.textFaint }]}
          >
            TOTAL SESSIONS
          </Text>
          <Text style={[styles.metricNumber, { color: theme.cyan }]}>
            {logs.length}
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          <Text
            style={[styles.metricLabelText, { color: theme.textFaint }]}
          >
            HOURS LOGGED
          </Text>
          <Text style={[styles.metricNumber, { color: theme.accent }]}>
            {totalHours.toFixed(1)}h
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          <Text
            style={[styles.metricLabelText, { color: theme.textFaint }]}
          >
            QUESTIONS
          </Text>
          <Text style={[styles.metricNumber, { color: theme.amber }]}>
            {totalQuestions.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 2. Head-to-Head Subject Breakdown */}
      {subjectBreakdown.length > 0 ? (
        <View style={styles.sectionGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
            HEAD-TO-HEAD SUBJECT BREAKDOWN
          </Text>
          <View
            style={[
              styles.unifiedCard,
              {
                backgroundColor: isDark ? "#121216" : theme.surface,
                borderColor: isDark ? "#1f1f25" : theme.border,
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
                    {
                      borderTopColor: isDark
                        ? theme.borderMuted
                        : theme.divider,
                    },
                  ],
                ]}
              >
                <View style={styles.subjectBreakdownHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        styles.subjectBreakdownTitle,
                        { color: isDark ? "#fafafa" : theme.text },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.subjectBreakdownSubtext,
                        { color: theme.textMuted },
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
                      { color: theme.cyan },
                    ]}
                  >
                    {item.hours.toFixed(1)}h{" "}
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textMuted,
                        fontWeight: "500",
                      }}
                    >
                      ({item.share}%)
                    </Text>
                  </Text>
                </View>
                <ProgressBar
                  value={item.share}
                  height={4}
                  tone={theme.cyan}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 3. All Study Sessions Ledger */}
      <View style={styles.sectionGroup}>
        <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
          ALL STUDY SESSIONS ({logs.length})
        </Text>
        {logs.length > 0 ? (
          <View
            style={[
              styles.unifiedCard,
              {
                backgroundColor: isDark ? "#121216" : theme.surface,
                borderColor: isDark ? "#1f1f25" : theme.border,
              },
            ]}
          >
            {logs.map((log, idx) => (
              <View
                key={log.id || `hist-${idx}`}
                style={[
                  styles.logHistoryRow,
                  idx > 0 && [
                    styles.hairlineDivider,
                    {
                      borderTopColor: isDark
                        ? theme.borderMuted
                        : theme.divider,
                    },
                  ],
                ]}
              >
                <View style={styles.logTextContainer}>
                  <Text
                    style={[
                      styles.logSubjectTitle,
                      { color: isDark ? "#fafafa" : theme.text },
                    ]}
                  >
                    {log.subjectName}
                  </Text>
                  <Text
                    style={[
                      styles.logMetaSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    {formatLogDate(log.logDate)}
                    {log.timeBlock ? ` · ${log.timeBlock}` : ""} ·{" "}
                    {log.questionsSolved} questions
                  </Text>
                  {log.notes ? (
                    <Text
                      style={[
                        styles.logNotes,
                        { color: theme.textMuted },
                      ]}
                    >
                      "{log.notes}"
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.logDurationText, { color: theme.cyan }]}>
                  {log.hoursStudied}h
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Card>
            <Text
              style={{ color: theme.textFaint, fontSize: 13 }}
            >
              No study sessions recorded yet.
            </Text>
          </Card>
        )}
      </View>

      {/* 4. Weekly Coaching Analysis Footer */}
      {weeklyAnalysis ? (
        <View style={styles.sectionGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
            WEEKLY COACHING ANALYSIS
          </Text>
          <Card
            style={{
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            }}
          >
            <View style={styles.analysisHeader}>
              <Ionicons
                name="sparkles"
                size={13}
                color={theme.violet}
              />
              <Text style={[styles.analysisLabel, { color: theme.violet }]}>
                WEEKLY JUJUM READ
              </Text>
            </View>
            <Text
              style={[
                styles.analysis,
                { color: isDark ? "#e4e4e7" : theme.text },
              ]}
            >
              {weeklyAnalysis}
            </Text>
          </Card>
        </View>
      ) : null}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: spacing.xs,
  },
  sheetDragHandleBar: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
  },
  detailHeaderArea: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xxs,
  },
  detailHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailHeaderTitle: {
    ...typography.subheading,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  detailHeaderSubtitle: {
    ...typography.caption,
    fontSize: 12,
    paddingLeft: 26,
  },
  detailScrollBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  metricCard: {
    flex: 1,
    padding: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.xxs,
  },
  metricLabelText: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  metricNumber: {
    ...typography.metric,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  sectionGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  unifiedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  subjectBreakdownRow: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  subjectBreakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  subjectBreakdownTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "700",
  },
  subjectBreakdownSubtext: {
    ...typography.caption,
    fontSize: 11.5,
  },
  subjectBreakdownHours: {
    ...typography.metric,
    fontSize: 13.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  logHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.sm,
    gap: spacing.sm,
  },
  logTextContainer: {
    flex: 1,
    gap: 2,
  },
  logSubjectTitle: {
    ...typography.bodyMedium,
    fontSize: 13,
    fontWeight: "700",
  },
  logMetaSubtitle: {
    ...typography.caption,
    fontSize: 11.5,
  },
  logNotes: {
    ...typography.caption,
    fontSize: 11.5,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 16,
  },
  logDurationText: {
    ...typography.metric,
    fontSize: 13.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  analysisLabel: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  analysis: {
    ...typography.body,
    fontSize: 12.5,
    lineHeight: 19,
  },
});
