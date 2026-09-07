import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !(globalThis as any)?.nativeFabricUIManager
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ParsedSection {
  num: string;
  title: string;
  body: string;
  type: "weak" | "strong" | "neglected" | "recommended" | "plan" | "velocity" | "avoidance" | "general";
  subjects: string[];
  suffixText: string;
  recommendedSubject?: string;
  readinessPercent?: string | null;
  velocityHours?: string | null;
  planDailyHours?: string | null;
  planInterval?: string | null;
  isOptimal: boolean;
}

export interface ParsedWeeklyInsight {
  sections: ParsedSection[];
  summaryMetrics: {
    readiness: string | null;
    velocityHours: string | null;
    dailyTarget: string | null;
    interval: string | null;
  };
  recommendedSubject: string | null;
}

export function parseWeeklyInsight(raw?: string): ParsedWeeklyInsight | null {
  if (!raw || !raw.trim()) return null;

  const regex = /(?:^|\n)###\s*(?:(\d+)\.\s*)?([^\n]+)\n+([\s\S]*?)(?=(?:\n###|$))/g;
  let m: RegExpExecArray | null;
  const sections: ParsedSection[] = [];

  while ((m = regex.exec(raw)) !== null) {
    const num = m[1] || "";
    const title = m[2].trim();
    const body = m[3].trim();
    const titleLower = title.toLowerCase();

    let sectionType: ParsedSection["type"] = "general";
    if (titleLower.includes("weak")) sectionType = "weak";
    else if (titleLower.includes("strong")) sectionType = "strong";
    else if (titleLower.includes("neglected")) sectionType = "neglected";
    else if (titleLower.includes("recommended") || titleLower.includes("next topic")) sectionType = "recommended";
    else if (titleLower.includes("study plan") || titleLower.includes("daily")) sectionType = "plan";
    else if (titleLower.includes("readiness") || titleLower.includes("velocity")) sectionType = "velocity";
    else if (titleLower.includes("avoidance") || titleLower.includes("warning")) sectionType = "avoidance";

    // Extract subjects if comma-separated
    let subjects: string[] = [];
    let suffixText = "";
    const suffixRegex = /(have not been logged in over \d+ weeks?|need focused practice|are currently your highest rated areas)/i;
    const suffixMatch = body.match(suffixRegex);

    if (suffixMatch && suffixMatch.index !== undefined) {
      const subjectPart = body.slice(0, suffixMatch.index).trim();
      suffixText = body.slice(suffixMatch.index).trim();
      subjects = subjectPart
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    // Extract recommended subject
    let recommendedSubject: string | undefined;
    if (sectionType === "recommended") {
      const recMatch = body.match(/Focus next study blocks on (.+?)\.?$/i);
      if (recMatch) {
        recommendedSubject = recMatch[1].trim();
      }
    }

    // Extract metrics if velocity
    let readinessPercent: string | null = null;
    let velocityHours: string | null = null;
    if (sectionType === "velocity") {
      const pMatch = body.match(/(\d+(?:\.\d+)?)%/);
      if (pMatch) readinessPercent = pMatch[1];
      const hMatch = body.match(/([\d.]+)h\s+logged/);
      if (hMatch) velocityHours = hMatch[1];
    }

    // Extract metrics if plan
    let planDailyHours: string | null = null;
    let planInterval: string | null = null;
    if (sectionType === "plan") {
      const hMatch = body.match(/Target\s+([\d.]+)\s*hours?/i);
      if (hMatch) planDailyHours = hMatch[1];
      const iMatch = body.match(/(\d+)-minute\s+focus/i);
      if (iMatch) planInterval = iMatch[1];
    }

    const isOptimal =
      body.toLowerCase().includes("no critical weak") ||
      body.toLowerCase().includes("all subjects are being actively revised") ||
      body.toLowerCase().includes("no avoidance warnings active");

    sections.push({
      num,
      title,
      body,
      type: sectionType,
      subjects,
      suffixText,
      recommendedSubject,
      readinessPercent,
      velocityHours,
      planDailyHours,
      planInterval,
      isOptimal,
    });
  }

  // Fallback: If no markdown headers were matched, treat whole text as general body
  if (sections.length === 0 && raw.trim().length > 0) {
    sections.push({
      num: "",
      title: "Coaching Summary",
      body: raw.trim(),
      type: "general",
      subjects: [],
      suffixText: "",
      isOptimal: false,
    });
  }

  // Summary Metrics
  const velocitySec = sections.find((s) => s.type === "velocity");
  const planSec = sections.find((s) => s.type === "plan");
  const recSec = sections.find((s) => s.type === "recommended");

  return {
    sections,
    summaryMetrics: {
      readiness: velocitySec?.readinessPercent || null,
      velocityHours: velocitySec?.velocityHours || null,
      dailyTarget: planSec?.planDailyHours || null,
      interval: planSec?.planInterval || null,
    },
    recommendedSubject: recSec?.recommendedSubject || null,
  };
}

/** Helper to strip markdown artifacts from plain text */
function cleanMarkdown(text: string): string {
  return text.replace(/###\s*/g, "").replace(/\*\*/g, "").trim();
}

/** Formatted text renderer supporting **bold** */
function FormattedBodyText({
  text,
  textColor,
  boldColor,
}: {
  text: string;
  textColor: string;
  boldColor: string;
}) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={[styles.bodyText, { color: textColor }]}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text
              key={i}
              style={[styles.boldText, { color: boldColor }]}
            >
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export interface WeeklyInsightCardProps {
  weeklyAnalysis?: string;
}

export function WeeklyInsightCard({ weeklyAnalysis }: WeeklyInsightCardProps) {
  const { theme, isDark } = useTheme();
  const [showAllNeglected, setShowAllNeglected] = useState(false);

  const parsed = useMemo(
    () => parseWeeklyInsight(weeklyAnalysis),
    [weeklyAnalysis]
  );

  const toggleNeglected = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      Haptics.selectionAsync();
    } catch {}
    setShowAllNeglected((prev) => !prev);
  };

  if (!parsed || parsed.sections.length === 0) {
    return (
      <View
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="Building your study profile. Your weekly analysis will appear here as your study history builds."
        style={[
          styles.placeholderCard,
          {
            backgroundColor: isDark ? "#121215" : theme.surface,
            borderColor: isDark ? "#27272a" : theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: isDark
                ? theme.surfaceElevated
                : theme.surfaceSubtle,
              borderColor: isDark ? theme.borderMuted : theme.border,
            },
          ]}
        >
          <Ionicons name="bulb-outline" size={15} color={theme.textFaint} />
        </View>

        <View style={styles.placeholderTextBlock}>
          <Text
            style={[
              styles.placeholderTitle,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
            numberOfLines={1}
          >
            Building your study profile
          </Text>
          <Text style={[styles.placeholderDesc, { color: theme.textMuted }]}>
            Weekly AI analysis will appear as your study logs build.
          </Text>
        </View>
      </View>
    );
  }

  const { sections, summaryMetrics } = parsed;
  const hasSummaryMetrics =
    summaryMetrics.readiness !== null ||
    summaryMetrics.velocityHours !== null ||
    summaryMetrics.dailyTarget !== null;

  const weakSec = sections.find((s) => s.type === "weak");
  const strongSec = sections.find((s) => s.type === "strong");
  const neglectedSec = sections.find((s) => s.type === "neglected");
  const recSec = sections.find((s) => s.type === "recommended");
  const avoidanceSec = sections.find((s) => s.type === "avoidance");
  const generalSecs = sections.filter(
    (s) =>
      s.type === "general" ||
      (s.type !== "weak" &&
        s.type !== "strong" &&
        s.type !== "neglected" &&
        s.type !== "recommended" &&
        s.type !== "plan" &&
        s.type !== "velocity" &&
        s.type !== "avoidance")
  );

  return (
    <View
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Weekly Study Insight: ${weeklyAnalysis}`}
      style={[
        styles.insightCard,
        {
          backgroundColor: isDark ? "#121215" : theme.surface,
          borderColor: isDark ? "#27272a" : theme.border,
        },
      ]}
    >
      {/* 1. Header Banner */}
      <View style={styles.insightHeader}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconMiniBadge,
              {
                backgroundColor: isDark
                  ? "rgba(139, 92, 246, 0.12)"
                  : "rgba(124, 58, 237, 0.08)",
                borderColor: isDark
                  ? "rgba(139, 92, 246, 0.25)"
                  : "rgba(124, 58, 237, 0.15)",
              },
            ]}
          >
            <Ionicons name="sparkles" size={13} color={theme.violet} />
          </View>
          <View>
            <Text style={[styles.insightOverline, { color: theme.violet }]}>
              WEEKLY MENTOR READ
            </Text>
            <Text style={[styles.insightSubtitle, { color: theme.textFaint }]}>
              AI-Synthesized GATE Roadmap
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isDark
                ? "rgba(16, 185, 129, 0.10)"
                : "rgba(16, 185, 129, 0.08)",
              borderColor: isDark
                ? "rgba(16, 185, 129, 0.25)"
                : "rgba(16, 185, 129, 0.15)",
            },
          ]}
        >
          <View
            style={[styles.statusDot, { backgroundColor: theme.accent }]}
          />
          <Text style={[styles.statusPillText, { color: theme.accent }]}>
            Active Plan
          </Text>
        </View>
      </View>

      {/* 2. Executive Metrics Strip */}
      {hasSummaryMetrics ? (
        <View style={styles.metricsRow}>
          {summaryMetrics.readiness !== null ? (
            <View
              style={[
                styles.metricCard,
                {
                  backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
                  borderColor: isDark ? "#27272a" : theme.border,
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textFaint }]}>
                READINESS
              </Text>
              <Text style={[styles.metricValue, { color: theme.cyan }]}>
                {summaryMetrics.readiness}%
              </Text>
              <Text style={[styles.metricSub, { color: theme.textMuted }]}>
                Syllabus cover
              </Text>
            </View>
          ) : null}

          {summaryMetrics.dailyTarget !== null ? (
            <View
              style={[
                styles.metricCard,
                {
                  backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
                  borderColor: isDark ? "#27272a" : theme.border,
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textFaint }]}>
                DAILY TARGET
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: isDark ? "#fafafa" : theme.text },
                ]}
              >
                {summaryMetrics.dailyTarget}h
              </Text>
              <Text style={[styles.metricSub, { color: theme.textMuted }]}>
                {summaryMetrics.interval
                  ? `${summaryMetrics.interval}m blocks`
                  : "Focus blocks"}
              </Text>
            </View>
          ) : null}

          {summaryMetrics.velocityHours !== null ? (
            <View
              style={[
                styles.metricCard,
                {
                  backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
                  borderColor: isDark ? "#27272a" : theme.border,
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textFaint }]}>
                7-DAY HOURS
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: isDark ? "#fafafa" : theme.text },
                ]}
              >
                {summaryMetrics.velocityHours}h
              </Text>
              <Text style={[styles.metricSub, { color: theme.textMuted }]}>
                Recent velocity
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 3. Recommended Next Topics (Hero Callout) */}
      {recSec ? (
        <View
          style={[
            styles.heroActionBox,
            {
              backgroundColor: isDark
                ? "rgba(6, 182, 212, 0.05)"
                : "rgba(2, 132, 199, 0.04)",
              borderColor: isDark
                ? "rgba(6, 182, 212, 0.25)"
                : "rgba(2, 132, 199, 0.18)",
            },
          ]}
        >
          <View style={styles.heroActionTop}>
            <View
              style={[
                styles.iconMiniBadge,
                {
                  backgroundColor: isDark
                    ? "rgba(6, 182, 212, 0.12)"
                    : "rgba(2, 132, 199, 0.10)",
                  borderColor: isDark
                    ? "rgba(6, 182, 212, 0.25)"
                    : "rgba(2, 132, 199, 0.15)",
                },
              ]}
            >
              <Ionicons name="bulb-outline" size={13} color={theme.cyan} />
            </View>
            <Text style={[styles.subCardOverline, { color: theme.cyan }]}>
              RECOMMENDED NEXT FOCUS
            </Text>
          </View>

          {recSec.recommendedSubject ? (
            <View style={styles.focusTopicBadge}>
              <Ionicons name="play-circle" size={14} color={theme.cyan} />
              <Text style={[styles.focusTopicText, { color: theme.cyan }]}>
                {recSec.recommendedSubject}
              </Text>
            </View>
          ) : null}

          <Text
            style={[
              styles.heroActionDesc,
              { color: isDark ? "#d4d4d8" : theme.textMuted },
            ]}
          >
            {recSec.recommendedSubject
              ? "Prioritize this topic in your upcoming study session for maximum syllabus leverage."
              : cleanMarkdown(recSec.body)}
          </Text>
        </View>
      ) : null}

      {/* 4. Neglected Subjects (Interactive Chips instead of comma-blob) */}
      {neglectedSec ? (
        <View
          style={[
            styles.tacticalCard,
            {
              backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
              borderColor: isDark ? "#27272a" : theme.border,
            },
          ]}
        >
          <View style={styles.tacticalHeaderRow}>
            <View style={styles.tacticalTitleGroup}>
              <Ionicons name="time-outline" size={15} color={theme.amber} />
              <Text
                style={[
                  styles.tacticalTitle,
                  { color: isDark ? "#fafafa" : theme.text },
                ]}
              >
                Neglected Subjects
              </Text>
            </View>

            {neglectedSec.subjects.length > 0 ? (
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.12)"
                      : "rgba(217, 119, 6, 0.08)",
                    borderColor: isDark
                      ? "rgba(245, 158, 11, 0.25)"
                      : "rgba(217, 119, 6, 0.15)",
                  },
                ]}
              >
                <Text style={[styles.statusTagText, { color: theme.amber }]}>
                  {neglectedSec.subjects.length} Inactive {">"} 3 wks
                </Text>
              </View>
            ) : null}
          </View>

          {neglectedSec.subjects.length > 0 ? (
            <View style={styles.chipContainer}>
              <View style={styles.chipWrap}>
                {(showAllNeglected
                  ? neglectedSec.subjects
                  : neglectedSec.subjects.slice(0, 6)
                ).map((sub, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.subjectChip,
                      {
                        backgroundColor: isDark
                          ? "#121215"
                          : theme.surface,
                        borderColor: isDark ? "#27272a" : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subjectChipText,
                        { color: isDark ? "#d4d4d8" : theme.text },
                      ]}
                    >
                      {sub}
                    </Text>
                  </View>
                ))}

                {neglectedSec.subjects.length > 6 ? (
                  <Pressable
                    onPress={toggleNeglected}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={({ pressed }) => [
                      styles.moreChip,
                      {
                        backgroundColor: isDark
                          ? "rgba(245, 158, 11, 0.12)"
                          : "rgba(217, 119, 6, 0.08)",
                        borderColor: isDark
                          ? "rgba(245, 158, 11, 0.3)"
                          : "rgba(217, 119, 6, 0.2)",
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.moreChipText, { color: theme.amber }]}
                    >
                      {showAllNeglected
                        ? "Show less ▴"
                        : `+${neglectedSec.subjects.length - 6} more ▾`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Text
                style={[styles.tacticalNote, { color: theme.textFaint }]}
              >
                No study logs recorded for these subjects in over 21 days.
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.bodyText,
                { color: isDark ? "#a1a1aa" : theme.textMuted },
              ]}
            >
              {cleanMarkdown(neglectedSec.body)}
            </Text>
          )}
        </View>
      ) : null}

      {/* 5. Weak & Strong Dual Status Row */}
      {(weakSec || strongSec) ? (
        <View style={styles.dualCardRow}>
          {/* Weak Subjects Card */}
          {weakSec ? (
            <View
              style={[
                styles.dualCard,
                {
                  backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
                  borderColor: isDark ? "#27272a" : theme.border,
                },
              ]}
            >
              <View style={styles.dualCardTop}>
                <Ionicons
                  name={
                    weakSec.isOptimal
                      ? "checkmark-circle-outline"
                      : "alert-circle-outline"
                  }
                  size={15}
                  color={weakSec.isOptimal ? theme.emerald : theme.rose}
                />
                <Text
                  style={[
                    styles.dualCardTitle,
                    { color: isDark ? "#fafafa" : theme.text },
                  ]}
                >
                  Weak Subjects
                </Text>
              </View>

              {weakSec.isOptimal ? (
                <View style={styles.optimalStateBlock}>
                  <View
                    style={[
                      styles.microTag,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.12)"
                          : "rgba(5, 150, 105, 0.08)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.microTagText,
                        { color: theme.emerald },
                      ]}
                    >
                      Clear
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.dualCardBody,
                      { color: theme.textMuted },
                    ]}
                  >
                    No critical weak subjects flagged.
                  </Text>
                </View>
              ) : weakSec.subjects.length > 0 ? (
                <View style={styles.chipWrap}>
                  {weakSec.subjects.map((sub, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: isDark
                            ? "rgba(244, 63, 94, 0.10)"
                            : "rgba(225, 29, 72, 0.06)",
                          borderColor: isDark
                            ? "rgba(244, 63, 94, 0.25)"
                            : "rgba(225, 29, 72, 0.15)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subjectChipText,
                          { color: theme.rose },
                        ]}
                      >
                        {sub}
                      </Text>
                    </View>
                  ))}
                  {weakSec.suffixText ? (
                    <Text
                      style={[
                        styles.tacticalNote,
                        { color: theme.textFaint },
                      ]}
                    >
                      {weakSec.suffixText}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text
                  style={[
                    styles.dualCardBody,
                    { color: theme.textMuted },
                  ]}
                >
                  {cleanMarkdown(weakSec.body)}
                </Text>
              )}
            </View>
          ) : null}

          {/* Strong Subjects Card */}
          {strongSec ? (
            <View
              style={[
                styles.dualCard,
                {
                  backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
                  borderColor: isDark ? "#27272a" : theme.border,
                },
              ]}
            >
              <View style={styles.dualCardTop}>
                <Ionicons
                  name="shield-checkmark"
                  size={15}
                  color={theme.emerald}
                />
                <Text
                  style={[
                    styles.dualCardTitle,
                    { color: isDark ? "#fafafa" : theme.text },
                  ]}
                >
                  Strong Subjects
                </Text>
              </View>

              {strongSec.subjects.length > 0 ? (
                <View style={styles.chipWrap}>
                  {strongSec.subjects.map((sub, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: isDark
                            ? "rgba(16, 185, 129, 0.10)"
                            : "rgba(5, 150, 105, 0.06)",
                          borderColor: isDark
                            ? "rgba(16, 185, 129, 0.25)"
                            : "rgba(5, 150, 105, 0.15)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subjectChipText,
                          { color: theme.emerald },
                        ]}
                      >
                        {sub}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.optimalStateBlock}>
                  <View
                    style={[
                      styles.microTag,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.12)"
                          : "rgba(5, 150, 105, 0.08)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.microTagText,
                        { color: theme.emerald },
                      ]}
                    >
                      Building
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.dualCardBody,
                      { color: theme.textMuted },
                    ]}
                  >
                    {cleanMarkdown(strongSec.body)}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 6. Avoidance Warnings Status */}
      {avoidanceSec ? (
        <View
          style={[
            styles.avoidanceBanner,
            {
              backgroundColor: isDark
                ? avoidanceSec.isOptimal
                  ? "rgba(16, 185, 129, 0.06)"
                  : "rgba(245, 158, 11, 0.08)"
                : avoidanceSec.isOptimal
                ? "rgba(5, 150, 105, 0.04)"
                : "rgba(217, 119, 6, 0.06)",
              borderColor: isDark
                ? avoidanceSec.isOptimal
                  ? "rgba(16, 185, 129, 0.20)"
                  : "rgba(245, 158, 11, 0.25)"
                : avoidanceSec.isOptimal
                ? "rgba(5, 150, 105, 0.15)"
                : "rgba(217, 119, 6, 0.18)",
            },
          ]}
        >
          <Ionicons
            name={avoidanceSec.isOptimal ? "shield-checkmark" : "alert-circle"}
            size={16}
            color={avoidanceSec.isOptimal ? theme.emerald : theme.amber}
          />
          <View style={styles.avoidanceContent}>
            <View style={styles.avoidanceTitleRow}>
              <Text
                style={[
                  styles.avoidanceTitle,
                  {
                    color: avoidanceSec.isOptimal
                      ? theme.emerald
                      : theme.amber,
                  },
                ]}
              >
                {avoidanceSec.isOptimal
                  ? "No Avoidance Detected"
                  : "Avoidance Alert"}
              </Text>
            </View>
            <Text
              style={[
                styles.avoidanceDesc,
                { color: isDark ? "#a1a1aa" : theme.textMuted },
              ]}
            >
              {cleanMarkdown(avoidanceSec.body)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 7. Extra General Sections (if custom/unstructured) */}
      {generalSecs.map((sec, idx) => (
        <View
          key={idx}
          style={[
            styles.tacticalCard,
            {
              backgroundColor: isDark ? "#18181d" : theme.surfaceSubtle,
              borderColor: isDark ? "#27272a" : theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.tacticalTitle,
              { color: isDark ? "#fafafa" : theme.text, marginBottom: 4 },
            ]}
          >
            {sec.title}
          </Text>
          <FormattedBodyText
            text={sec.body}
            textColor={isDark ? "#d4d4d8" : theme.text}
            boldColor={isDark ? "#fafafa" : theme.text}
          />
        </View>
      ))}
    </View>
  );
}

export interface StudyWeeklyInsightProps {
  weeklyAnalysis?: string;
}

export function StudyWeeklyInsight({ weeklyAnalysis }: StudyWeeklyInsightProps) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(120).duration(300)}
      style={styles.sectionGroup}
    >
      {/* 1. Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitleText,
            { color: isDark ? "#fafafa" : theme.text },
          ]}
        >
          Weekly Insight
        </Text>
      </View>

      {/* 2. Formatted Insight Card */}
      <WeeklyInsightCard weeklyAnalysis={weeklyAnalysis} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionHeaderRow: {
    paddingHorizontal: spacing.xxs,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  insightCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.xxs,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  iconMiniBadge: {
    width: 24,
    height: 24,
    borderRadius: radii.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  insightOverline: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  insightSubtitle: {
    ...typography.caption,
    fontSize: 10.5,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  metricCard: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 2,
  },
  metricLabel: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  metricValue: {
    ...typography.metric,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
  },
  metricSub: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 13,
  },
  heroActionBox: {
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  heroActionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  subCardOverline: {
    ...typography.label,
    fontSize: 9.5,
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  focusTopicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    alignSelf: "flex-start",
  },
  focusTopicText: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "700",
  },
  heroActionDesc: {
    ...typography.caption,
    fontSize: 11.5,
    lineHeight: 16,
  },
  tacticalCard: {
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  tacticalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tacticalTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tacticalTitle: {
    ...typography.bodyMedium,
    fontSize: 12.5,
    fontWeight: "700",
  },
  statusTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusTagText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
  },
  chipContainer: {
    gap: 6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  subjectChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  subjectChipText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "500",
  },
  moreChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  moreChipText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "700",
  },
  tacticalNote: {
    ...typography.caption,
    fontSize: 11,
    fontStyle: "italic",
  },
  dualCardRow: {
    flexDirection: "column",
    gap: spacing.xs,
  },
  dualCard: {
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 6,
  },
  dualCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dualCardTitle: {
    ...typography.bodyMedium,
    fontSize: 12.5,
    fontWeight: "700",
  },
  dualCardBody: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
  },
  optimalStateBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  microTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  microTagText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
  },
  avoidanceBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  avoidanceContent: {
    flex: 1,
    gap: 2,
  },
  avoidanceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avoidanceTitle: {
    ...typography.bodyMedium,
    fontSize: 12,
    fontWeight: "700",
  },
  avoidanceDesc: {
    ...typography.caption,
    fontSize: 11.5,
    lineHeight: 16,
  },
  bodyText: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  boldText: {
    fontWeight: "700",
  },
  placeholderCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTextBlock: {
    flex: 1,
    gap: 2,
  },
  placeholderTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  placeholderDesc: {
    ...typography.caption,
    fontSize: 11.5,
    lineHeight: 16,
  },
});
