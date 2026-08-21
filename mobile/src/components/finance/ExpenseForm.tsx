import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/providers/theme-provider";
import { shortDate, todayInKolkata } from "@/src/lib/format";
import { Expense, FinanceCategory } from "@/src/types/domain";
import { CategoryPicker } from "@/src/components/finance/CategoryPicker";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface ExpenseFormProps {
  initialCategory?: FinanceCategory;
  onSave: (val: {
    title: string;
    amount: string;
    category: FinanceCategory;
    payment: Expense["payment"];
    date: string;
  }) => void;
  onClose: () => void;
  busy: boolean;
}

const PAYMENT_METHODS: Expense["payment"][] = ["UPI", "Cash", "Card"];

export function ExpenseForm({
  initialCategory,
  onSave,
  onClose,
  busy,
}: ExpenseFormProps) {
  const { theme, isDark } = useTheme();
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: initialCategory || ("Food & mess" as FinanceCategory),
    payment: "UPI" as Expense["payment"],
    date: todayInKolkata(),
  });

  const todayStr = todayInKolkata();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const isFormValid = form.title.trim().length > 0 && Number(form.amount) > 0;

  const handleAmountChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    setForm((prev) => ({ ...prev, amount: clean }));
  };

  const handleDateSelect = (date: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setForm((prev) => ({ ...prev, date }));
  };

  const handlePaymentSelect = (payment: Expense["payment"]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setForm((prev) => ({ ...prev, payment }));
  };

  const handleSubmit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSave(form);
  };

  return (
    <View style={styles.formContainer}>
      {/* 1. Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextGroup}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? "#FAFBFD" : theme.text },
            ]}
          >
            Log Expense
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? "#A1A1AA" : theme.textMuted },
            ]}
          >
            Record an expense in your campus ledger
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Close form"
          style={({ pressed }) => [
            styles.closeButton,
            {
              backgroundColor: isDark ? "#1E1E24" : theme.surfaceSubtle,
              borderColor: isDark ? "#2A2A32" : theme.borderMuted,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="close"
            size={18}
            color={isDark ? "#A1A1AA" : theme.textMuted}
          />
        </Pressable>
      </View>

      {/* 2. Hero Primary Field: Amount (Strongest Visual Emphasis) */}
      <View
        style={[
          styles.amountCard,
          {
            backgroundColor: isDark ? "#121216" : theme.surface,
            borderColor: isDark ? "#1F1F26" : theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.amountLabel,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          AMOUNT
        </Text>

        <View style={styles.amountInputRow}>
          <Text
            style={[
              styles.amountCurrencySymbol,
              { color: isDark ? "#FAFBFD" : theme.text },
            ]}
          >
            ₹
          </Text>
          <BottomSheetTextInput
            style={[
              styles.amountTextInput,
              { color: isDark ? "#FAFBFD" : theme.text },
            ]}
            value={form.amount}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={isDark ? "#3F3F46" : "#CBD5E1"}
            keyboardType="numeric"
            accessibilityLabel="Expense amount in Rupees"
            maxLength={7}
          />
        </View>
      </View>

      {/* 3. Title / Description Input */}
      <View style={styles.fieldGroup}>
        <Text
          style={[
            styles.fieldLabel,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          DESCRIPTION
        </Text>
        <BottomSheetTextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1F1F26" : theme.border,
              color: isDark ? "#FAFBFD" : theme.text,
            },
          ]}
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder="e.g. Mess lunch, Auto to campus, Stationery"
          placeholderTextColor={isDark ? "#52525B" : theme.textFaint}
          autoCapitalize="sentences"
          accessibilityLabel="Expense item description"
        />
      </View>

      {/* 4. Category Selector */}
      <View style={styles.fieldGroup}>
        <Text
          style={[
            styles.fieldLabel,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          CATEGORY
        </Text>
        <CategoryPicker
          value={form.category}
          onChange={(category) => setForm((prev) => ({ ...prev, category }))}
        />
      </View>

      {/* 5. Date & Payment Selection Grid */}
      <View style={styles.dualOptionsRow}>
        {/* Date Column */}
        <View style={styles.halfColumn}>
          <Text
            style={[
              styles.fieldLabel,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            DATE
          </Text>
          <View style={styles.pillSelectorRow}>
            <Pressable
              onPress={() => handleDateSelect(todayStr)}
              accessibilityRole="button"
              accessibilityLabel={`Set date to today, ${shortDate(todayStr)}`}
              style={[
                styles.optionPill,
                {
                  backgroundColor:
                    form.date === todayStr
                      ? isDark
                        ? "#1E293B"
                        : "#EFF6FF"
                      : isDark
                      ? "#121216"
                      : theme.surface,
                  borderColor:
                    form.date === todayStr
                      ? theme.cyan
                      : isDark
                      ? "#1F1F26"
                      : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionPillText,
                  {
                    color:
                      form.date === todayStr
                        ? theme.cyan
                        : isDark
                        ? "#A1A1AA"
                        : theme.textMuted,
                    fontWeight: form.date === todayStr ? "700" : "500",
                  },
                ]}
              >
                Today
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleDateSelect(yesterdayStr)}
              accessibilityRole="button"
              accessibilityLabel={`Set date to yesterday, ${shortDate(yesterdayStr)}`}
              style={[
                styles.optionPill,
                {
                  backgroundColor:
                    form.date === yesterdayStr
                      ? isDark
                        ? "#1E293B"
                        : "#EFF6FF"
                      : isDark
                      ? "#121216"
                      : theme.surface,
                  borderColor:
                    form.date === yesterdayStr
                      ? theme.cyan
                      : isDark
                      ? "#1F1F26"
                      : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionPillText,
                  {
                    color:
                      form.date === yesterdayStr
                        ? theme.cyan
                        : isDark
                        ? "#A1A1AA"
                        : theme.textMuted,
                    fontWeight: form.date === yesterdayStr ? "700" : "500",
                  },
                ]}
              >
                Yesterday
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Payment Method Column */}
        <View style={styles.halfColumn}>
          <Text
            style={[
              styles.fieldLabel,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            PAYMENT MODE
          </Text>
          <View style={styles.pillSelectorRow}>
            {PAYMENT_METHODS.map((method) => {
              const active = form.payment === method;
              return (
                <Pressable
                  key={method}
                  onPress={() => handlePaymentSelect(method)}
                  accessibilityRole="button"
                  accessibilityLabel={`Payment method ${method}`}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: active
                        ? isDark
                          ? "#1E293B"
                          : "#EFF6FF"
                        : isDark
                        ? "#121216"
                        : theme.surface,
                      borderColor: active
                        ? theme.cyan
                        : isDark
                        ? "#1F1F26"
                        : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      {
                        color: active
                          ? theme.cyan
                          : isDark
                          ? "#A1A1AA"
                          : theme.textMuted,
                        fontWeight: active ? "700" : "500",
                      },
                    ]}
                  >
                    {method}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* 6. Primary Action: Add to Ledger */}
      <Pressable
        onPress={handleSubmit}
        disabled={busy || !isFormValid}
        accessibilityRole="button"
        accessibilityLabel={busy ? "Saving expense to ledger" : "Add expense to ledger"}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: isDark ? "#FAFBFD" : "#0F172A",
            borderColor: isDark ? "#FAFBFD" : "#0F172A",
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
          (!isFormValid || busy) && { opacity: 0.45 },
        ]}
      >
        <Ionicons
          name="checkmark-circle-outline"
          size={18}
          color={isDark ? "#09090B" : "#FFFFFF"}
        />
        <Text
          style={[
            styles.submitButtonText,
            { color: isDark ? "#09090B" : "#FFFFFF" },
          ]}
        >
          {busy ? "Saving to Ledger..." : "Add to Ledger"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 2,
  },
  headerTextGroup: {
    flex: 1,
    gap: 3,
  },
  headerTitle: {
    ...typography.subheading,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    ...typography.caption,
    fontSize: 12.5,
    lineHeight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  amountCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  amountLabel: {
    ...typography.label,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  amountCurrencySymbol: {
    ...typography.heading,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  amountTextInput: {
    ...typography.heading,
    flex: 1,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
    paddingVertical: 0,
    fontVariant: ["tabular-nums"],
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    ...typography.label,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  textInput: {
    ...typography.bodyMedium,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  dualOptionsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfColumn: {
    flex: 1,
    gap: 6,
  },
  pillSelectorRow: {
    flexDirection: "row",
    gap: 6,
  },
  optionPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  optionPillText: {
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    fontSize: 14,
    fontWeight: "800",
  },
});
