import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { formatINR, shortDate } from "@/src/lib/format";
import { Expense, FinanceCategory } from "@/src/types/domain";
import { CATEGORY_TOKENS, getDateLabel, SEMANTIC } from "@/src/components/finance/FinanceConstants";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii } from "@/src/theme/tokens";

export interface CategoryDetailModalProps {
  category: FinanceCategory;
  stats: {
    category: FinanceCategory;
    cap: number;
    total: number;
    percent: number;
    isOver: boolean;
  };
  expenses: Expense[];
  onDeleteExpense: (id: string) => void;
  onLogExpense: (category: FinanceCategory) => void;
  scrollHandler: any;
  contentContainerStyle: any;
}

export function CategoryDetailModal({
  category,
  stats,
  expenses,
  onDeleteExpense,
  onLogExpense,
  scrollHandler,
  contentContainerStyle,
}: CategoryDetailModalProps) {
  const { theme, isDark } = useTheme();
  const notify = useNotify();
  const meta = CATEGORY_TOKENS[category] || CATEGORY_TOKENS.Others;

  const grouped = useMemo(() => {
    const groups: { dateLabel: string; items: Expense[] }[] = [];
    expenses.forEach((item) => {
      const label = getDateLabel(item.date);
      const existing = groups.find((g) => g.dateLabel === label);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ dateLabel: label, items: [item] });
      }
    });
    return groups;
  }, [expenses]);

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    >
      <View style={{ gap: 16 }}>
        {/* Category Hero Summary Card */}
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
              padding: 16,
              gap: 14,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <CategoryIconBadge category={category} isDark={isDark} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroLabel, { color: isDark ? meta.darkIcon : meta.lightIcon }]}>
                  CATEGORY OVERVIEW
                </Text>
                <Text style={[styles.itemTitle, { fontSize: 18, color: isDark ? "#F5F5F7" : theme.text }]}>
                  {category}
                </Text>
              </View>
            </View>

            <Text style={[styles.heroBalanceValue, { fontSize: 22, color: isDark ? "#F5F5F7" : theme.text }]}>
              {formatINR(stats.total)}
            </Text>
          </View>

          {/* Progress / Status */}
          {stats.cap > 0 ? (
            <View style={{ gap: 6 }}>
              <ProgressBar
                value={stats.percent}
                height={6}
                tone={stats.isOver ? SEMANTIC.crimson : stats.percent >= 80 ? SEMANTIC.amber : SEMANTIC.emerald}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: stats.isOver ? SEMANTIC.crimson : isDark ? "#A1A1AA" : theme.textMuted,
                  }}
                >
                  {stats.isOver
                    ? `${formatINR(stats.total - stats.cap)} over monthly cap`
                    : `${formatINR(stats.cap - stats.total)} remaining (${stats.percent}% used)`}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#71717A" : theme.textFaint }}>
                  Cap: {formatINR(stats.cap)}
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#f8fafc",
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isDark ? "#222226" : "#e2e8f0",
              }}
            >
              <Text style={{ fontSize: 12, color: isDark ? "#A1A1AA" : theme.textMuted, fontWeight: "500" }}>
                No spending limit set for this category. You can configure one in Plan Budget.
              </Text>
            </View>
          )}

          {/* Mini 3-Item Metrics Bar */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              paddingTop: 10,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: isDark ? "#1F1F24" : "#f1f5f9",
            }}
          >
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "800", color: isDark ? "#FAFAFA" : theme.text }}>
                {formatINR(stats.total)}
              </Text>
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: isDark ? "#71717A" : theme.textFaint }}>
                Total Spent
              </Text>
            </View>

            <View style={{ width: 1, height: 20, backgroundColor: isDark ? "#222226" : "#e2e8f0" }} />

            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "800", color: isDark ? "#FAFAFA" : theme.text }}>
                {stats.cap > 0 ? formatINR(stats.cap) : "None"}
              </Text>
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: isDark ? "#71717A" : theme.textFaint }}>
                Budget Cap
              </Text>
            </View>

            <View style={{ width: 1, height: 20, backgroundColor: isDark ? "#222226" : "#e2e8f0" }} />

            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "800", color: isDark ? "#FAFAFA" : theme.text }}>
                {expenses.length}
              </Text>
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: isDark ? "#71717A" : theme.textFaint }}>
                Transactions
              </Text>
            </View>
          </View>
        </View>

        {/* Transactions in Category */}
        <View style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint, paddingHorizontal: 4 }]}>
            TRANSACTIONS IN {category.toUpperCase()} ({expenses.length})
          </Text>

          {grouped.length > 0 ? (
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? "#111113" : "#ffffff",
                  borderColor: isDark ? "#1F1F24" : "#e2e8f0",
                },
              ]}
            >
              {grouped.map((group, gIdx) => (
                <View key={group.dateLabel}>
                  <View
                    style={[
                      styles.dateHeaderRow,
                      {
                        backgroundColor: isDark ? "#141418" : "#f8fafc",
                        borderTopColor: isDark ? "#18181D" : "#f1f5f9",
                        borderTopWidth: gIdx > 0 ? StyleSheet.hairlineWidth : 0,
                      },
                    ]}
                  >
                    <Text style={[styles.dateHeaderText, { color: isDark ? "#71717A" : theme.textFaint }]}>
                      {group.dateLabel}
                    </Text>
                  </View>

                  {group.items.map((item, idx) => {
                    return (
                      <Pressable
                        key={item.id}
                        onLongPress={() => {
                          notify.confirm({
                            title: "Delete Expense?",
                            message: `Remove "${item.title}" (${formatINR(item.amount)}) from your ${category} ledger?`,
                            confirmLabel: "Delete",
                            tone: "destructive",
                            icon: "trash-outline",
                            onConfirm: () => onDeleteExpense(item.id),
                          });
                        }}
                        style={({ pressed }) => [
                          styles.unifiedItemRow,
                          idx > 0 && [
                            styles.hairlineDivider,
                            { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
                          ],
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <CategoryIconBadge category={item.category} isDark={isDark} />
                        <View style={styles.itemDetails}>
                          <Text style={[styles.itemTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>
                            {item.title}
                          </Text>
                          <Text style={[styles.itemSubtext, { color: isDark ? "#71717A" : theme.textFaint }]}>
                            {item.date ? `${shortDate(item.date)} · ` : ""}{item.payment || "UPI"}
                          </Text>
                        </View>
                        <Text style={[styles.itemAmount, { color: isDark ? "#F5F5F7" : theme.text }]}>
                          {formatINR(item.amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : (
            <Pressable
              onPress={() => onLogExpense(category)}
              style={({ pressed }) => [
                styles.emptyStateBlock,
                {
                  backgroundColor: isDark ? "#151518" : "#ffffff",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                },
                pressed && { opacity: 0.82 },
              ]}
            >
              <View
                style={[
                  styles.emptyStateIconBadge,
                  {
                    backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.08)",
                    borderColor: isDark ? "rgba(59, 130, 246, 0.22)" : "rgba(37, 99, 235, 0.15)",
                  },
                ]}
              >
                <Ionicons name="receipt-outline" size={20} color={isDark ? "#60A5FA" : "#2563EB"} />
              </View>
              <Text style={[styles.emptyStateHeadline, { color: isDark ? "#F5F5F7" : theme.text }]}>
                No expenses in {category}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                Tap here to log your first {category.toLowerCase()} transaction.
              </Text>
            </Pressable>
          )}
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
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  heroBalanceValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  dateHeaderRow: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  dateHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  unifiedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemDetails: {
    gap: 2,
    flex: 1,
  },
  itemSubtext: {
    fontSize: 12,
    fontWeight: "500",
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  emptyStateBlock: {
    padding: 24,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyStateIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyStateHeadline: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyStateSubtext: {
    fontSize: 12.5,
    textAlign: "center",
  },
});
