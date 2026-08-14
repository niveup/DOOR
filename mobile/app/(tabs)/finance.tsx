import { useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen } from "@/src/components/screen";
import { ActionButton, Card, Chip, EmptyState, IconButton, LoadingCard, ProgressBar, SectionTitle, ui } from "@/src/components/ui";
import { api } from "@/src/services/api";
import { formatINR, shortDate, todayInKolkata } from "@/src/lib/format";
import { Bill, Budget, Expense, FinanceCategory, financeCategories } from "@/src/types/domain";
import { categoryColors, colors } from "@/src/theme/tokens";

type SheetMode = "expense" | "budget" | "bill";

export default function FinanceScreen() {
  const client = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [mode, setMode] = useState<SheetMode>("expense");
  const finance = useQuery({ queryKey: ["finance"], queryFn: api.finance.get });
  const data = finance.data;

  const open = (next: SheetMode) => {
    setMode(next);
    sheetRef.current?.present();
  };

  const refresh = () => client.invalidateQueries({ queryKey: ["finance"] });

  const expenseMutation = useMutation({
    mutationFn: api.finance.saveExpense,
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      refresh();
    },
  });

  const budgetMutation = useMutation({
    mutationFn: api.finance.saveBudget,
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      refresh();
    },
  });

  const billMutation = useMutation({
    mutationFn: api.finance.saveBill,
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      refresh();
    },
  });

  const payMutation = useMutation({
    mutationFn: api.finance.payBill,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ["finance"] });
      const previous = client.getQueryData<typeof data>(["finance"]);
      client.setQueryData<typeof data>(["finance"], (current) =>
        current
          ? {
              ...current,
              bills: current.bills.map((item) => (item.id === id ? { ...item, paid: true } : item)),
            }
          : current
      );
      return { previous };
    },
    onError: (_error, _id, context) => client.setQueryData(["finance"], context?.previous),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: refresh,
  });

  const deleteExpense = useMutation({ mutationFn: api.finance.deleteExpense, onSuccess: refresh });
  const deleteBill = useMutation({ mutationFn: api.finance.deleteBill, onSuccess: refresh });

  const month = todayInKolkata().slice(0, 7);
  const expensesList = data?.expenses || [];
  const billsList = data?.bills || [];
  const budgetData = data?.budget || { allowance: 0, caps: {} };
  const spent = expensesList
    .filter((item) => item?.date?.startsWith(month))
    .reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  const allowance = Number(budgetData.allowance || 0);
  const remaining = Math.max(allowance - spent, 0);
  const daysLeft = Math.max(
    1,
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1
  );

  return (
    <AppScreen
      title="Campus Cashflow"
      subtitle="Calm money decisions, one ledger at a time."
      refreshing={finance.isRefetching}
      onRefresh={finance.refetch}
      action={<IconButton icon="add" label="Add expense" onPress={() => open("expense")} tone={colors.emerald} />}
    >
      {finance.isLoading ? <LoadingCard /> : null}
      {finance.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Cashflow is offline"
          description="Pull down when your connection returns. Your last synced ledger remains available."
          action={<ActionButton label="Retry" compact onPress={() => finance.refetch()} />}
        />
      ) : null}
      {data ? (
        <>
          <Card style={styles.balance}>
            <Text style={styles.balanceLabel}>MONTHLY RUNWAY</Text>
            <Text style={styles.balanceValue}>{formatINR(remaining)}</Text>
            <Text style={styles.balanceNote}>
              {allowance
                ? `${formatINR(Math.floor(remaining / daysLeft))} safe to spend per day for ${daysLeft} days`
                : "Set your allowance to unlock a daily runway."}
            </Text>
            <ProgressBar value={allowance ? (spent / allowance) * 100 : 0} tone={spent > allowance ? colors.rose : colors.emerald} />
            <View style={styles.balanceRow}>
              <Text style={styles.balanceMeta}>{formatINR(spent)} used</Text>
              <Text style={styles.balanceMeta}>{formatINR(allowance)} allowance</Text>
            </View>
          </Card>
          <View style={styles.actions}>
            <ActionButton label="Add expense" icon="add-circle-outline" tone="emerald" onPress={() => open("expense")} />
            <ActionButton label="Plan budget" icon="pie-chart-outline" tone="ghost" onPress={() => open("budget")} />
          </View>
          <SectionTitle title="Category envelopes" />
          <Card>
            {financeCategories.map((category) => {
              const cap = Number((budgetData.caps as any)?.[category] || 0);
              const total = expensesList
                .filter((item) => item?.date?.startsWith(month) && item?.category === category)
                .reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
              const tone = total > cap && cap ? colors.rose : categoryColors[category];
              return cap ? (
                <View key={category} style={styles.envelope}>
                  <View style={ui.spread}>
                    <Text style={styles.envelopeLabel}>{category}</Text>
                    <Text style={[styles.envelopeValue, { color: tone }]}>
                      {formatINR(total)} / {formatINR(cap)}
                    </Text>
                  </View>
                  <ProgressBar value={(total / cap) * 100} tone={tone} />
                </View>
              ) : null;
            })}
          </Card>
          <SectionTitle
            title="Upcoming bills"
            trailing={<ActionButton label="Add bill" compact tone="ghost" onPress={() => open("bill")} />}
          />
          {billsList.filter((item) => !item?.paid).length ? (
            <View style={styles.list}>
              {billsList
                .filter((item) => !item?.paid)
                .slice(0, 3)
                .map((item) => (
                  <BillRow
                    key={item.id}
                    bill={item}
                    busy={payMutation.isPending}
                    onPay={() => payMutation.mutate(item.id)}
                    onDelete={() =>
                      Alert.alert("Delete bill?", item.title, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deleteBill.mutate(item.id) },
                      ])
                    }
                  />
                ))}
            </View>
          ) : (
            <Card>
              <Text style={styles.muted}>No unpaid bills. Nice—your payment calendar is clear.</Text>
            </Card>
          )}
          <SectionTitle title="Recent ledger" />
          {expensesList.length ? (
            <View style={styles.list}>
              {expensesList.slice(0, 8).map((item) => (
                <ExpenseRow
                  key={item.id}
                  expense={item}
                  onDelete={() =>
                    Alert.alert("Delete expense?", item.title, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteExpense.mutate(item.id) },
                    ])
                  }
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No expenses yet"
              description="Your money story starts with one honest entry."
              action={<ActionButton label="Log first expense" compact tone="emerald" onPress={() => open("expense")} />}
            />
          )}
        </>
      ) : null}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["78%"]}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetContent}
        >
          {mode === "expense" ? (
            <ExpenseForm
              key={`expense-${Date.now()}`}
              onSave={(expense) => {
                const amount = Number(expense.amount);
                if (!expense.title.trim() || !Number.isFinite(amount) || amount <= 0) {
                  return Alert.alert("Check the expense", "Add a title and an amount above ₹0.");
                }
                expenseMutation.mutate({ ...expense, title: expense.title.trim(), amount });
              }}
              busy={expenseMutation.isPending}
            />
          ) : mode === "budget" ? (
            <BudgetForm
              key={`budget-${data?.budget?.allowance || 0}`}
              initialBudget={data?.budget || { allowance: 0, caps: {} }}
              onSave={(budget) => {
                if (budget.allowance <= 0) {
                  return Alert.alert("Set an allowance", "Your monthly allowance needs to be above ₹0.");
                }
                if (
                  Object.values(budget.caps).reduce((sum, value) => sum + Number(value || 0), 0) >
                  budget.allowance
                ) {
                  return Alert.alert("Caps are too high", "Category caps cannot exceed your total allowance.");
                }
                budgetMutation.mutate(budget);
              }}
              busy={budgetMutation.isPending}
            />
          ) : (
            <BillForm
              key={`bill-${Date.now()}`}
              onSave={(bill) => {
                const amount = Number(bill.amount);
                if (!bill.title.trim() || amount <= 0) {
                  return Alert.alert("Check the bill", "Add a title and valid amount.");
                }
                billMutation.mutate({ ...bill, title: bill.title.trim(), amount, paid: false });
              }}
              busy={billMutation.isPending}
            />
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </AppScreen>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: FinanceCategory;
  onChange: (category: FinanceCategory) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker}>
      {financeCategories.map((category) => (
        <Chip
          key={category}
          label={category.replace(" & ", " + ")}
          active={value === category}
          onPress={() => onChange(category)}
          tone={categoryColors[category]}
        />
      ))}
    </ScrollView>
  );
}

function ExpenseForm({
  onSave,
  busy,
}: {
  onSave: (val: { title: string; amount: string; category: FinanceCategory; payment: Expense["payment"]; date: string }) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "Food & mess" as FinanceCategory,
    payment: "UPI" as Expense["payment"],
    date: todayInKolkata(),
  });

  return (
    <View style={styles.form}>
      <Text style={styles.sheetTitle}>Log an expense</Text>
      <Text style={styles.sheetSubtitle}>It updates immediately and syncs with your secure backend.</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>WHAT DID YOU PAY FOR?</Text>
        <BottomSheetTextInput
          style={styles.sheetTextInput}
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder="e.g. Mess top-up"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
        <BottomSheetTextInput
          style={styles.sheetTextInput}
          value={form.amount}
          onChangeText={(amount) => setForm((prev) => ({ ...prev, amount }))}
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
        />
      </View>

      <Text style={styles.fieldLabel}>CATEGORY</Text>
      <CategoryPicker
        value={form.category}
        onChange={(category) => setForm((prev) => ({ ...prev, category }))}
      />

      <View style={styles.payment}>
        <Text style={styles.fieldLabel}>PAID WITH</Text>
        <View style={styles.chipRow}>
          {(["UPI", "Cash", "Card"] as const).map((payment) => (
            <Chip
              key={payment}
              label={payment}
              active={form.payment === payment}
              onPress={() => setForm((prev) => ({ ...prev, payment }))}
              tone={colors.emerald}
            />
          ))}
        </View>
      </View>

      <ActionButton
        label={busy ? "Saving…" : "Add to ledger"}
        icon="checkmark"
        tone="emerald"
        disabled={busy}
        onPress={() => onSave(form)}
      />
    </View>
  );
}

function BudgetForm({
  initialBudget,
  onSave,
  busy,
}: {
  initialBudget: { allowance: number; caps?: any };
  onSave: (val: Budget) => void;
  busy: boolean;
}) {
  const [allowance, setAllowance] = useState(initialBudget.allowance ? String(initialBudget.allowance) : "");
  const [caps, setCaps] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const c of financeCategories) {
      base[c] = initialBudget.caps?.[c] || 0;
    }
    return base;
  });

  return (
    <View style={styles.form}>
      <Text style={styles.sheetTitle}>Set monthly budget</Text>
      <Text style={styles.sheetSubtitle}>Every rupee gets a job before the month takes it.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>MONTHLY ALLOWANCE (₹)</Text>
        <BottomSheetTextInput
          style={styles.sheetTextInput}
          value={allowance}
          onChangeText={setAllowance}
          keyboardType="decimal-pad"
          placeholder="12000"
          placeholderTextColor={colors.textFaint}
        />
      </View>

      {financeCategories.map((category) => (
        <View key={category} style={styles.capRow}>
          <Text style={styles.capLabel}>{category}</Text>
          <BottomSheetTextInput
            style={styles.capInput}
            value={caps[category] ? String(caps[category]) : ""}
            placeholder="₹ 0"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            onChangeText={(input) =>
              setCaps((prev) => ({ ...prev, [category]: Number(input) || 0 }))
            }
          />
        </View>
      ))}

      <ActionButton
        label={busy ? "Saving…" : "Save budget"}
        icon="checkmark"
        disabled={busy}
        onPress={() =>
          onSave({
            allowance: Number(allowance) || 0,
            caps: caps as any,
          })
        }
      />
    </View>
  );
}

function BillForm({
  onSave,
  busy,
}: {
  onSave: (val: { title: string; amount: string; category: FinanceCategory; date: string }) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "Subscriptions" as FinanceCategory,
    date: todayInKolkata(),
  });

  return (
    <View style={styles.form}>
      <Text style={styles.sheetTitle}>Add a bill</Text>
      <Text style={styles.sheetSubtitle}>Marking it paid will automatically add it to your ledger.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>BILL NAME</Text>
        <BottomSheetTextInput
          style={styles.sheetTextInput}
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder="e.g. Data recharge"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
        <BottomSheetTextInput
          style={styles.sheetTextInput}
          value={form.amount}
          onChangeText={(amount) => setForm((prev) => ({ ...prev, amount }))}
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
        />
      </View>

      <Text style={styles.fieldLabel}>CATEGORY</Text>
      <CategoryPicker
        value={form.category}
        onChange={(category) => setForm((prev) => ({ ...prev, category }))}
      />

      <ActionButton
        label={busy ? "Saving…" : "Add bill"}
        icon="add"
        disabled={busy}
        onPress={() => onSave(form)}
      />
    </View>
  );
}

function ExpenseRow({ expense, onDelete }: { expense: Expense; onDelete: () => void }) {
  const tone = categoryColors[expense.category] || colors.textMuted;
  return (
    <Card style={styles.row}>
      <View style={[styles.rowBadge, { backgroundColor: `${tone}22` }]}>
        <Ionicons name="receipt-outline" color={tone} size={18} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{expense.title}</Text>
        <Text style={styles.rowMeta}>
          {shortDate(expense.date)} · {expense.category} · {expense.payment}
        </Text>
      </View>
      <Text style={styles.amount}>{formatINR(expense.amount)}</Text>
      <IconButton icon="trash-outline" label={`Delete ${expense.title}`} onPress={onDelete} tone={colors.textFaint} />
    </Card>
  );
}

function BillRow({
  bill,
  onPay,
  onDelete,
  busy,
}: {
  bill: Bill;
  onPay: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <Card style={styles.row}>
      <View style={[styles.rowBadge, { backgroundColor: `${colors.amber}22` }]}>
        <Ionicons name="calendar-outline" color={colors.amber} size={18} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{bill.title}</Text>
        <Text style={styles.rowMeta}>
          Due {shortDate(bill.date)} · {bill.category}
        </Text>
      </View>
      <Text style={styles.amount}>{formatINR(bill.amount)}</Text>
      <ActionButton label="Pay" compact tone="emerald" disabled={busy} onPress={onPay} />
      <IconButton icon="close" label={`Delete ${bill.title}`} onPress={onDelete} tone={colors.textFaint} />
    </Card>
  );
}

const styles = StyleSheet.create({
  balance: { backgroundColor: "#062c26", borderColor: "#065f46", gap: 9 },
  balanceLabel: { color: colors.emerald, fontSize: 10, letterSpacing: 1, fontWeight: "900" },
  balanceValue: { color: colors.text, fontSize: 35, fontWeight: "900", fontVariant: ["tabular-nums"] },
  balanceNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between" },
  balanceMeta: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10 },
  envelope: { gap: 7, paddingVertical: 5 },
  envelopeLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  envelopeValue: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", padding: 10, gap: 9 },
  rowBadge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  rowMeta: { color: colors.textFaint, fontSize: 10, lineHeight: 14 },
  amount: { color: colors.text, fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  muted: { color: colors.textMuted, fontSize: 13 },
  sheet: { backgroundColor: colors.surface },
  handle: { backgroundColor: colors.border },
  sheetContent: { padding: 20, paddingBottom: 48 },
  form: { gap: 14 },
  sheetTitle: { color: colors.text, fontSize: 23, fontWeight: "900" },
  sheetSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  fieldLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" },
  inputGroup: { gap: 6 },
  sheetTextInput: {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  picker: { gap: 8 },
  payment: { gap: 8 },
  chipRow: { flexDirection: "row", gap: 8 },
  capRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
    paddingVertical: 8,
  },
  capLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  capInput: {
    color: colors.text,
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
  },
});
