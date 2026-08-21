import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { formatINR, shortDate } from "@/src/lib/format";
import { Bill } from "@/src/types/domain";
import { SEMANTIC } from "@/src/components/finance/FinanceConstants";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii } from "@/src/theme/tokens";

export interface AllBillsModalProps {
  bills: Bill[];
  onPay: (id: string) => void;
  onDelete: (id: string) => void;
  payingId: string | null;
  scrollHandler: any;
  contentContainerStyle: any;
}

export function AllBillsModal({
  bills,
  onPay,
  onDelete,
  payingId,
  scrollHandler,
  contentContainerStyle,
}: AllBillsModalProps) {
  const { theme, isDark } = useTheme();
  const notify = useNotify();

  const unpaid = bills.filter((b) => !b.paid).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const paid = bills.filter((b) => b.paid).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    >
      <View style={{ gap: 8 }}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
          DUE & UPCOMING
        </Text>
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#111113" : "#ffffff",
              borderColor: isDark ? "#1F1F24" : "#e2e8f0",
            },
          ]}
        >
          {unpaid.length > 0 ? (
            unpaid.map((item, idx) => {
              return (
                <Pressable
                  key={item.id}
                  onLongPress={() => {
                    notify.confirm({
                      title: "Delete Bill?",
                      message: `Remove "${item.title}" from your upcoming bills?`,
                      confirmLabel: "Delete Bill",
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
                  <View style={styles.itemLeftBlock}>
                    <CategoryIconBadge
                      category={item.category}
                      isDark={isDark}
                      customIcon="calendar-outline"
                    />
                    <View style={styles.itemDetails}>
                      <Text style={[styles.itemTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.itemSubtext, { color: isDark ? "#71717A" : theme.textFaint }]}>
                        {item.date ? `${shortDate(item.date)} · ` : ""}{item.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemRightActionBlock}>
                    <Text style={[styles.itemAmount, { color: isDark ? "#F5F5F7" : theme.text }]}>
                      {formatINR(item.amount)}
                    </Text>
                    <Pressable
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => onPay(item.id)}
                      disabled={payingId === item.id}
                      style={[
                        styles.payButton,
                        {
                          backgroundColor: isDark ? "#1f1f26" : "#0f172a",
                          borderColor: isDark ? "#353540" : "#0f172a",
                        },
                      ]}
                    >
                      {payingId === item.id ? (
                        <ActivityIndicator size="small" color={isDark ? "#fafafa" : "#ffffff"} />
                      ) : (
                        <Text style={[styles.payButtonText, { color: isDark ? "#fafafa" : "#ffffff" }]}>
                          Pay
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyEnvelopesPrompt}>
              <Text style={[styles.quietStatusText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                No unpaid bills remaining.
              </Text>
            </View>
          )}
        </View>
      </View>

      {paid.length > 0 ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
            PAID BILLS
          </Text>
          <View
            style={[
              styles.unifiedCard,
              {
                backgroundColor: isDark ? "#111113" : "#ffffff",
                borderColor: isDark ? "#1F1F24" : "#e2e8f0",
              },
            ]}
          >
            {paid.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.unifiedItemRow,
                  idx > 0 && [
                    styles.hairlineDivider,
                    { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
                  ],
                ]}
              >
                <View style={styles.itemLeftBlock}>
                  <Ionicons name="checkmark-circle" size={20} color={SEMANTIC.emerald} />
                  <View style={styles.itemDetails}>
                    <Text style={[styles.itemTitle, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemSubtext, { color: isDark ? "#71717A" : theme.textFaint }]}>
                      Paid · {item.category}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.itemAmount, { color: isDark ? "#71717A" : theme.textMuted }]}>
                  {formatINR(item.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  unifiedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
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
  itemLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
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
  itemRightActionBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  payButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: "700",
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
