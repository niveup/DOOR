import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated from "react-native-reanimated";
import { ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR } from "@/src/lib/format";
import { FinanceCategory } from "@/src/types/domain";
import { SEMANTIC, getBudgetHealthColor } from "@/src/components/finance/FinanceConstants";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { CategoryStat } from "@/src/components/finance/FinanceSpendingOverview";
import { radii } from "@/src/theme/tokens";

export interface AllSpendingModalProps {
  allStats: CategoryStat[];
  onSelectCategory?: (category: FinanceCategory) => void;
  scrollHandler: any;
  contentContainerStyle: any;
}

export function AllSpendingModal({
  allStats,
  onSelectCategory,
  scrollHandler,
  contentContainerStyle,
}: AllSpendingModalProps) {
  const { theme, isDark } = useTheme();

  const grandTotal = useMemo(
    () => allStats.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    [allStats]
  );
  const totalBudget = useMemo(
    () => allStats.reduce((sum, item) => sum + (Number(item.cap) || 0), 0),
    [allStats]
  );
  const activeCount = useMemo(
    () => allStats.filter((item) => item.total > 0).length,
    [allStats]
  );
  const budgetPercent = useMemo(
    () => (totalBudget > 0 ? Math.round((grandTotal / totalBudget) * 100) : 0),
    [grandTotal, totalBudget]
  );

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    >
      <View style={{ gap: 14 }}>
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#111113" : "#ffffff",
              borderColor: isDark ? "#1F1F24" : "#e2e8f0",
            },
          ]}
        >
          {allStats.map((item, idx) => {
            return (
              <Pressable
                key={item.category}
                onPress={() => onSelectCategory?.(item.category)}
                style={({ pressed }) => [
                  styles.detailEnvelopeItem,
                  idx > 0 && [
                    styles.hairlineDivider,
                    { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
                  ],
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={styles.envelopeTopRow}>
                  <View style={styles.envelopeLeftBlock}>
                    <CategoryIconBadge category={item.category} isDark={isDark} />
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: isDark ? "#FAFAFA" : theme.text }]}>
                        {item.category}
                      </Text>
                      <Text style={styles.itemSubtext}>
                        {item.cap > 0 ? (
                          item.isOver ? (
                            <Text style={{ color: SEMANTIC.crimson, fontWeight: "600" }}>
                              {formatINR(item.total - item.cap)} over {formatINR(item.cap)} budget
                            </Text>
                          ) : (
                            <Text style={{ color: isDark ? "#71717A" : theme.textFaint, fontWeight: "500" }}>
                              {item.total > 0
                                ? `${formatINR(item.cap - item.total)} remaining of ${formatINR(item.cap)} budget`
                                : `Budget: ${formatINR(item.cap)} · ₹0 spent`}
                            </Text>
                          )
                        ) : (
                          <Text style={{ color: isDark ? "#71717A" : theme.textFaint, fontWeight: "500" }}>
                            No budget set
                          </Text>
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={[styles.itemAmount, { color: isDark ? "#F5F5F7" : theme.text }]}>
                        {formatINR(item.total)}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={isDark ? "#71717A" : theme.textFaint} />
                    </View>
                    <Text style={[styles.itemShareText, { color: isDark ? "#71717A" : theme.textMuted }]}>
                      {item.cap > 0 ? `${item.percent}%` : "—"}
                    </Text>
                  </View>
                </View>

                {item.cap > 0 ? (
                  <View style={styles.envelopeProgressWrapper}>
                    <ProgressBar
                      value={item.percent}
                      height={4}
                      tone={getBudgetHealthColor(item.percent, item.isOver)}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Apple-Style Total Spending Summary Section */}
        <View
          style={[
            styles.totalCard,
            {
              backgroundColor: isDark ? "#111113" : "#ffffff",
              borderColor: isDark ? "#1F1F24" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.totalHeaderRow}>
            <View style={styles.totalLeftInfo}>
              <View
                style={[
                  styles.totalIconBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(56, 189, 248, 0.12)"
                      : "rgba(14, 165, 233, 0.08)",
                  },
                ]}
              >
                <Ionicons
                  name="receipt-outline"
                  size={18}
                  color={isDark ? "#38BDF8" : "#0284C7"}
                />
              </View>
              <View style={{ gap: 2 }}>
                <Text
                  style={[
                    styles.totalBadgeLabel,
                    { color: isDark ? "#71717A" : theme.textFaint },
                  ]}
                >
                  TOTAL EXPENSES
                </Text>
                <Text
                  style={[
                    styles.totalSubtext,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                >
                  {activeCount} active categor{activeCount === 1 ? "y" : "ies"} this month
                </Text>
              </View>
            </View>

            <View style={{ alignItems: "flex-end", gap: 1 }}>
              <Text
                style={[
                  styles.totalAmountValue,
                  { color: isDark ? "#FAFBFD" : theme.text },
                ]}
              >
                {formatINR(grandTotal)}
              </Text>
              {totalBudget > 0 ? (
                <Text
                  style={[
                    styles.totalPercentText,
                    {
                      color:
                        grandTotal > totalBudget
                          ? SEMANTIC.crimson
                          : isDark
                          ? "#71717A"
                          : theme.textMuted,
                    },
                  ]}
                >
                  {budgetPercent}% of budget
                </Text>
              ) : null}
            </View>
          </View>

          {totalBudget > 0 ? (
            <View
              style={[
                styles.totalProgressDivider,
                { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
              ]}
            >
              <ProgressBar
                value={budgetPercent}
                height={5}
                tone={grandTotal > totalBudget ? SEMANTIC.crimson : SEMANTIC.emerald}
              />
              <View style={styles.totalBudgetFooterRow}>
                <Text
                  style={[
                    styles.totalBudgetFooterStatus,
                    {
                      color:
                        grandTotal > totalBudget
                          ? SEMANTIC.crimson
                          : isDark
                          ? "#A1A1AA"
                          : theme.textMuted,
                    },
                  ]}
                >
                  {grandTotal > totalBudget
                    ? `${formatINR(grandTotal - totalBudget)} over limit`
                    : `${formatINR(totalBudget - grandTotal)} remaining`}
                </Text>
                <Text
                  style={[
                    styles.totalBudgetFooterCap,
                    { color: isDark ? "#71717A" : theme.textFaint },
                  ]}
                >
                  Total Budget: {formatINR(totalBudget)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.footerHintRow}>
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={isDark ? "#71717A" : theme.textFaint}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.footerHintText,
              { color: isDark ? "#71717A" : theme.textMuted },
            ]}
          >
            Tap any category to inspect transaction ledger
          </Text>
        </View>
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  unifiedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailEnvelopeItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  envelopeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  envelopeLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  itemSubtext: {
    fontSize: 12,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  itemShareText: {
    fontSize: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  envelopeProgressWrapper: {
    marginLeft: 48,
  },
  totalCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  totalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLeftInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  totalIconBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  totalBadgeLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  totalSubtext: {
    fontSize: 12,
    fontWeight: "500",
  },
  totalAmountValue: {
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  totalPercentText: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  totalProgressDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 8,
  },
  totalBudgetFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalBudgetFooterStatus: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  totalBudgetFooterCap: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  footerHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  footerHintText: {
    fontSize: 11.5,
    fontWeight: "400",
    letterSpacing: -0.1,
  },
});
