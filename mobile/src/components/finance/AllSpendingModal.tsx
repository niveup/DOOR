import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR } from "@/src/lib/format";
import { FinanceCategory } from "@/src/types/domain";
import { CATEGORY_TOKENS, SEMANTIC } from "@/src/components/finance/FinanceConstants";
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
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 9,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#e2e8f0",
          }}
        >
          <Ionicons name="information-circle-outline" size={15} color={isDark ? "#60A5FA" : "#2563EB"} />
          <Text style={{ fontSize: 11.5, color: isDark ? "#A1A1AA" : theme.textMuted, fontWeight: "500", flex: 1 }}>
            Tap any category to inspect its full transaction ledger & budget breakdown.
          </Text>
        </View>

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
            const meta = CATEGORY_TOKENS[item.category] || CATEGORY_TOKENS.Others;
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
                    <View style={{ gap: 2 }}>
                      <Text style={[styles.itemTitle, { color: isDark ? meta.darkIcon : meta.lightIcon }]}>
                        {item.category}
                      </Text>
                      <Text style={styles.itemSubtext}>
                        {item.cap > 0 ? (
                          item.isOver ? (
                            <Text style={{ color: SEMANTIC.crimson, fontWeight: "600" }}>
                              {formatINR(item.total - item.cap)} over limit (Cap: {formatINR(item.cap)})
                            </Text>
                          ) : (
                            <Text style={{ color: isDark ? "#71717A" : theme.textFaint, fontWeight: "500" }}>
                              {item.total > 0
                                ? `${formatINR(item.cap - item.total)} left of ${formatINR(item.cap)} limit`
                                : `Limit: ${formatINR(item.cap)} · ₹0 spent`}
                            </Text>
                          )
                        ) : (
                          <Text style={{ color: isDark ? "#71717A" : theme.textFaint, fontWeight: "500" }}>
                            No limit set
                          </Text>
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.itemAmount, { color: isDark ? "#F5F5F7" : theme.text }]}>
                      {formatINR(item.total)}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={isDark ? "#71717A" : theme.textFaint} />
                  </View>
                </View>

                {item.cap > 0 ? (
                  <ProgressBar
                    value={item.percent}
                    height={4.5}
                    tone={item.isOver ? SEMANTIC.crimson : item.percent >= 80 ? SEMANTIC.amber : SEMANTIC.emerald}
                  />
                ) : null}
              </Pressable>
            );
          })}
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
});
