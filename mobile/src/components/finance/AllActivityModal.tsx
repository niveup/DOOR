import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { formatINR, shortDate } from "@/src/lib/format";
import { Expense } from "@/src/types/domain";
import { getDateLabel } from "@/src/components/finance/FinanceConstants";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii } from "@/src/theme/tokens";

export interface AllActivityModalProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
  scrollHandler: any;
  contentContainerStyle: any;
}

export function AllActivityModal({
  expenses,
  onDelete,
  scrollHandler,
  contentContainerStyle,
}: AllActivityModalProps) {
  const { theme, isDark } = useTheme();
  const notify = useNotify();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      return search.trim() === "" || e.title.toLowerCase().includes(search.toLowerCase());
    });
  }, [expenses, search]);

  const grouped = useMemo(() => {
    const groups: { dateLabel: string; items: Expense[] }[] = [];
    filtered.forEach((item) => {
      const label = getDateLabel(item.date);
      const existing = groups.find((g) => g.dateLabel === label);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ dateLabel: label, items: [item] });
      }
    });
    return groups;
  }, [filtered]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBarContainer}>
        <Ionicons name="search-outline" size={16} color={isDark ? "#71717A" : theme.textFaint} />
        <TextInput
          style={[styles.searchInputText, { color: isDark ? "#F5F5F7" : theme.text }]}
          placeholder="Search transactions..."
          placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={isDark ? "#71717A" : theme.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
      >
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#111113" : "#ffffff",
              borderColor: isDark ? "#1F1F24" : "#e2e8f0",
            },
          ]}
        >
          {grouped.length > 0 ? (
            grouped.map((group, gIdx) => (
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
                          message: `Remove "${item.title}" (${formatINR(item.amount)}) from your ledger?`,
                          confirmLabel: "Delete",
                          tone: "destructive",
                          icon: "trash-outline",
                          onConfirm: () => onDelete(item.id),
                        });
                      }}
                      style={[
                        styles.unifiedItemRow,
                        idx > 0 && [
                          styles.hairlineDivider,
                          { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
                        ],
                      ]}
                    >
                      <CategoryIconBadge category={item.category} isDark={isDark} />

                      <View style={styles.itemDetails}>
                        <Text style={[styles.itemTitle, { color: isDark ? "#F5F5F7" : theme.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.itemSubtext, { color: isDark ? "#71717A" : theme.textFaint }]}>
                          {shortDate(item.date)} · {item.category} · {item.payment || "UPI"}
                        </Text>
                      </View>

                      <Text style={[styles.itemAmount, { color: isDark ? "#F5F5F7" : theme.text }]}>
                        - {formatINR(item.amount)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.emptyEnvelopesPrompt}>
              <Text style={[styles.quietStatusText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                No matching transactions found.
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInputText: {
    flex: 1,
    fontSize: 13,
  },
  unifiedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
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
  itemTitle: {
    fontSize: 13.5,
    fontWeight: "700",
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
  emptyEnvelopesPrompt: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quietStatusText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
