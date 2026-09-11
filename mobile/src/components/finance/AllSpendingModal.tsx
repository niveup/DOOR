import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated from "react-native-reanimated";
import { ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR } from "@/src/lib/format";
import { FinanceCategory } from "@/src/types/domain";
import { CATEGORY_TOKENS, SEMANTIC, getBudgetHealthColor } from "@/src/components/finance/FinanceConstants";
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

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    >
      <View style={{ gap: 12 }}>
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
