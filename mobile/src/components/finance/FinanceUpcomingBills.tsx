import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR, shortDate } from "@/src/lib/format";
import { Bill } from "@/src/types/domain";
import { SEMANTIC } from "@/src/components/finance/FinanceConstants";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface FinanceUpcomingBillsProps {
  unpaidBills: Bill[];
  top2Bills: Bill[];
  onOpenAllBills: () => void;
  onOpenAddBill: () => void;
  onPayBill: (id: string) => void;
  payingId: string | null;
}

export function FinanceUpcomingBills({
  unpaidBills,
  top2Bills,
  onOpenAllBills,
  onOpenAddBill,
  onPayBill,
  payingId,
}: FinanceUpcomingBillsProps) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(160).duration(320)}
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
          Upcoming Bills
        </Text>

        <Pressable
          onPress={onOpenAddBill}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Add an upcoming recurring bill"
          style={({ pressed }) => [
            styles.headerActionPill,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.headerActionText, { color: theme.cyan }]}>
            + Add bill
          </Text>
        </Pressable>
      </View>

      {/* 2. Bills Surface List or Calm Empty State */}
      {unpaidBills.length > 0 ? (
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          {top2Bills.map((item, idx) => {
            const isPaying = payingId === item.id;

            return (
              <Pressable
                key={item.id}
                onPress={onOpenAllBills}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${formatINR(item.amount)}, due ${
                  item.date ? shortDate(item.date) : "soon"
                }. Category: ${item.category}.`}
                style={({ pressed }) => [
                  styles.unifiedItemRow,
                  idx > 0 && [
                    styles.hairlineDivider,
                    {
                      borderTopColor: isDark
                        ? theme.borderMuted
                        : theme.divider,
                    },
                  ],
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={styles.itemLeftBlock}>
                  <CategoryIconBadge
                    category={item.category}
                    isDark={isDark}
                    customIcon="calendar-outline"
                  />

                  <View style={styles.itemDetails}>
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: isDark ? "#fafafa" : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.itemSubtext,
                        { color: theme.textMuted },
                      ]}
                    >
                      {item.date ? `${shortDate(item.date)} · ` : ""}
                      {item.category}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemRightActionBlock}>
                  <Text
                    style={[
                      styles.itemAmount,
                      { color: isDark ? "#fafafa" : theme.text },
                    ]}
                  >
                    {formatINR(item.amount)}
                  </Text>

                  <Pressable
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => onPayBill(item.id)}
                    disabled={isPaying}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay ${item.title} bill of ${formatINR(item.amount)}`}
                    style={({ pressed }) => [
                      styles.payButton,
                      {
                        backgroundColor: isDark
                          ? theme.surfaceElevated
                          : "#0f172a",
                        borderColor: isDark ? theme.border : "#0f172a",
                      },
                      pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                    ]}
                  >
                    {isPaying ? (
                      <ActivityIndicator
                        size="small"
                        color={isDark ? "#fafafa" : "#ffffff"}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.payButtonText,
                          { color: isDark ? "#fafafa" : "#ffffff" },
                        ]}
                      >
                        Pay
                      </Text>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {unpaidBills.length > 2 ? (
            <Pressable
              onPress={onOpenAllBills}
              accessibilityRole="button"
              accessibilityLabel={`View all ${unpaidBills.length} upcoming bills`}
              style={({ pressed }) => [
                styles.collapseBottomButton,
                {
                  borderTopColor: isDark
                    ? theme.borderMuted
                    : theme.divider,
                },
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={[styles.collapseBottomText, { color: theme.cyan }]}>
                View all {unpaidBills.length} bills →
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View
          style={[
            styles.emptyStateBlock,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.emptyStateIconBadge,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.borderMuted : theme.borderMuted,
              },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={SEMANTIC.emerald}
            />
          </View>
          <Text
            style={[
              styles.emptyStateHeadline,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            All clear · No upcoming bills
          </Text>
          <Text
            style={[
              styles.emptyStateSubtext,
              { color: theme.textMuted },
            ]}
          >
            You have no unpaid bills scheduled for this month.
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxs,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerActionPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
  },
  headerActionText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  itemDetails: {
    gap: 2,
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
  },
  itemSubtext: {
    ...typography.caption,
    fontSize: 11.5,
  },
  itemRightActionBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemAmount: {
    ...typography.metric,
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  payButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    minWidth: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  payButtonText: {
    ...typography.button,
    fontSize: 12,
    fontWeight: "700",
  },
  collapseBottomButton: {
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  collapseBottomText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: "700",
  },
  emptyStateBlock: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  emptyStateIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
  },
  emptyStateHeadline: {
    ...typography.bodyMedium,
    fontSize: 14.5,
    fontWeight: "700",
  },
  emptyStateSubtext: {
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
  },
});
