import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen } from "@/src/components/screen";
import { ActionButton, EmptyState, LoadingCard } from "@/src/components/ui";
import { api } from "@/src/services/api";
import { formatINR, todayInKolkata } from "@/src/lib/format";
import { Bill, Expense, FinanceCategory, financeCategories } from "@/src/types/domain";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { useAuth } from "@/src/providers/auth-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";
import { getDateLabel } from "@/src/components/finance/FinanceConstants";
import { FinanceHeroRunway } from "@/src/components/finance/FinanceHeroRunway";
import { FinanceActions } from "@/src/components/finance/FinanceActions";
import { FinanceSpendingOverview } from "@/src/components/finance/FinanceSpendingOverview";
import { FinanceUpcomingBills } from "@/src/components/finance/FinanceUpcomingBills";
import { FinanceRecentActivity } from "@/src/components/finance/FinanceRecentActivity";
import { ExpenseForm } from "@/src/components/finance/ExpenseForm";
import { BillForm } from "@/src/components/finance/BillForm";
import { FinanceModalWrapper } from "@/src/components/finance/FinanceModalWrapper";
import { BudgetFormModal } from "@/src/components/finance/BudgetFormModal";
import { CategoryDetailModal } from "@/src/components/finance/CategoryDetailModal";
import { AllSpendingModal } from "@/src/components/finance/AllSpendingModal";
import { AllBillsModal } from "@/src/components/finance/AllBillsModal";
import { AllActivityModal } from "@/src/components/finance/AllActivityModal";

type FormMode = "expense" | "bill" | null;
type DetailMode = "budget" | "all-spending" | "all-bills" | "all-activity" | null;

export default function FinanceScreen() {
  const client = useQueryClient();
  const notify = useNotify();
  const formSheetRef = useRef<BottomSheetModal>(null);

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<FinanceCategory | null>(null);
  const [categoryOrigin, setCategoryOrigin] = useState<"home" | "all-spending" | null>(null);
  const [preselectedCategory, setPreselectedCategory] = useState<FinanceCategory | undefined>(undefined);
  const [formSessionKey, setFormSessionKey] = useState(1);
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const openCategoryDetail = (category: FinanceCategory, origin: "home" | "all-spending" = "home") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCategoryOrigin(origin);
    setSelectedCategory(category);
    setFormSessionKey((prev) => prev + 1);
  };

  const handleCloseCategoryDetail = () => {
    setSelectedCategory(null);
    setCategoryOrigin(null);
  };

  // Intercept Android hardware back press
  useEffect(() => {
    if (!detailMode && !formMode && !selectedCategory) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedCategory) {
        handleCloseCategoryDetail();
        return true;
      }
      if (detailMode) {
        setDetailMode(null);
        return true;
      }
      if (formMode) {
        formSheetRef.current?.dismiss();
        setFormMode(null);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [detailMode, formMode, selectedCategory, categoryOrigin]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        opacity={isDark ? 0.65 : 0.4}
      />
    ),
    [isDark]
  );

  const { unlocked } = useAuth();
  const finance = useQuery({
    queryKey: ["finance"],
    queryFn: api.finance.get,
    enabled: unlocked,
    staleTime: 5_000,
  });
  const data = finance.data;

  const openForm = (mode: "expense" | "bill", initialCategory?: FinanceCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFormMode(mode);
    setPreselectedCategory(initialCategory);
    setFormSessionKey((prev) => prev + 1);
    formSheetRef.current?.present();
  };

  const openDetail = (mode: NonNullable<DetailMode>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDetailMode(mode);
    setFormSessionKey((prev) => prev + 1);
  };

  const refresh = () => client.invalidateQueries({ queryKey: ["finance"] });

  // 1. Optimistic Expense Mutation
  const expenseMutation = useMutation({
    mutationFn: api.finance.saveExpense,
    onMutate: async (newExpense) => {
      formSheetRef.current?.dismiss();
      setFormMode(null);

      await client.cancelQueries({ queryKey: ["finance"] });
      const previous = client.getQueryData<typeof data>(["finance"]);
      const optimisticEntry: Expense = {
        id: `temp-${Date.now()}`,
        title: newExpense.title,
        amount: Number(newExpense.amount),
        category: newExpense.category,
        payment: newExpense.payment || "UPI",
        date: newExpense.date || todayInKolkata(),
      };

      client.setQueryData<typeof data>(["finance"], (current) =>
        current
          ? { ...current, expenses: [optimisticEntry, ...current.expenses] }
          : { expenses: [optimisticEntry], bills: [], budget: { allowance: 0, caps: {} as any } }
      );
      return { previous };
    },
    onSuccess: (res, newExpense) => {
      notify.success("Expense Recorded", `${newExpense.title} (${formatINR(Number(newExpense.amount))})`);
    },
    onError: (_error, _variables, context) => {
      client.setQueryData(["finance"], context?.previous);
      notify.error("Save Failed", "Could not reach cloud database. Please try again.");
    },
    onSettled: refresh,
  });

  // 2. Optimistic Budget Mutation
  const budgetMutation = useMutation({
    mutationFn: api.finance.saveBudget,
    onMutate: async (newBudget) => {
      setDetailMode(null);

      await client.cancelQueries({ queryKey: ["finance"] });
      const previous = client.getQueryData<typeof data>(["finance"]);
      client.setQueryData<typeof data>(["finance"], (current) => {
        if (!current) {
          return { expenses: [], bills: [], budget: newBudget };
        }
        return {
          ...current,
          budget: {
            allowance: Number(newBudget.allowance || 0),
            caps: newBudget.caps || ({} as any),
          },
        };
      });
      return { previous };
    },
    onSuccess: () => {
      notify.success("Budget Saved", "Monthly allocation plan updated.");
    },
    onError: (_error, _variables, context) => {
      client.setQueryData(["finance"], context?.previous);
      notify.error("Budget Save Failed", "Could not sync budget with cloud.");
    },
    onSettled: refresh,
  });

  // 3. Optimistic Bill Mutation
  const billMutation = useMutation({
    mutationFn: api.finance.saveBill,
    onMutate: async (newBill) => {
      formSheetRef.current?.dismiss();
      setFormMode(null);

      await client.cancelQueries({ queryKey: ["finance"] });
      const previous = client.getQueryData<typeof data>(["finance"]);
      const optimisticBill: Bill = {
        id: `temp-${Date.now()}`,
        title: newBill.title,
        amount: Number(newBill.amount),
        category: newBill.category,
        date: newBill.date || todayInKolkata(),
        paid: false,
      };

      client.setQueryData<typeof data>(["finance"], (current) =>
        current
          ? { ...current, bills: [optimisticBill, ...current.bills] }
          : { expenses: [], bills: [optimisticBill], budget: { allowance: 0, caps: {} as any } }
      );
      return { previous };
    },
    onSuccess: (res, newBill) => {
      notify.success("Bill Scheduled", `${newBill.title} (${formatINR(Number(newBill.amount))})`);
    },
    onError: (_error, _variables, context) => {
      client.setQueryData(["finance"], context?.previous);
      notify.error("Bill Save Failed", "Could not save bill to cloud.");
    },
    onSettled: refresh,
  });

  // 4. Pay Bill Mutation
  const payMutation = useMutation({
    mutationFn: api.finance.payBill,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ["finance"] });
      const previous = client.getQueryData<typeof data>(["finance"]);
      client.setQueryData<typeof data>(["finance"], (current) => {
        if (!current) return current;
        return {
          ...current,
          bills: current.bills.map((b) => (b.id === id ? { ...b, paid: true } : b)),
        };
      });
      return { previous };
    },
    onSuccess: () => {
      notify.success("Bill Paid", "Payment recorded in ledger.");
    },
    onError: (_error, _variables, context) => {
      client.setQueryData(["finance"], context?.previous);
      notify.error("Payment Failed", "Could not record payment. Please try again.");
    },
    onSettled: refresh,
  });

  // 5. Delete Expense Mutation
  const deleteExpense = useMutation({
    mutationFn: api.finance.deleteExpense,
    onMutate: async (id) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      await client.cancelQueries({ queryKey: ["finance"] });
      const previous = client.getQueryData<typeof data>(["finance"]);
      client.setQueryData<typeof data>(["finance"], (current) =>
        current
          ? {
              ...current,
              expenses: current.expenses.filter((e) => e.id !== id),
            }
          : current
      );
      return { previous };
    },
    onSettled: refresh,
  });

  // 6. Delete Bill Mutation
  const deleteBill = useMutation({
    mutationFn: api.finance.deleteBill,
    onMutate: async (id) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      await client.cancelQueries({ queryKey: ["finance"] });
      const previous = client.getQueryData<typeof data>(["finance"]);
      client.setQueryData<typeof data>(["finance"], (current) =>
        current
          ? {
              ...current,
              bills: current.bills.filter((b) => b.id !== id),
            }
          : current
      );
      return { previous };
    },
    onSettled: refresh,
  });

  const month = todayInKolkata().slice(0, 7);
  const expensesList = useMemo(() => data?.expenses || [], [data?.expenses]);
  const billsList = useMemo(() => data?.bills || [], [data?.bills]);
  const budgetData = data?.budget || { allowance: 0, caps: {} as any };

  const spent = useMemo(
    () =>
      expensesList
        .filter((item) => item?.date?.startsWith(month))
        .reduce((sum, item) => sum + (Number(item?.amount) || 0), 0),
    [expensesList, month]
  );

  const allowance = Number(budgetData.allowance || 0);
  const isOverBudget = allowance > 0 && spent > allowance;
  const overBudgetAmount = isOverBudget ? spent - allowance : 0;
  const remaining = allowance > spent ? allowance - spent : 0;

  const daysLeft = Math.max(
    1,
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1
  );
  const safeDailySpend = allowance && !isOverBudget ? Math.floor(remaining / daysLeft) : 0;
  const rawSpendPercent = allowance > 0 ? Math.round((spent / allowance) * 100) : 0;

  // All Categories with Spending & Caps (Complete 8-category breakdown)
  const allCategoryStats = useMemo(() => {
    return financeCategories
      .map((category) => {
        const cap = Number((budgetData.caps as any)?.[category] || 0);
        const total = expensesList
          .filter((item) => item?.date?.startsWith(month) && item?.category === category)
          .reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
        return {
          category,
          cap,
          total,
          percent: cap ? Math.round((total / cap) * 100) : 0,
          isOver: cap > 0 && total > cap,
        };
      })
      .sort((a, b) => {
        if (a.isOver && !b.isOver) return -1;
        if (!a.isOver && b.isOver) return 1;
        if (a.total > 0 || b.total > 0) return b.total - a.total;
        if (a.cap > 0 || b.cap > 0) return b.cap - a.cap;
        return 0;
      });
  }, [budgetData.caps, expensesList, month]);

  // Categories with activity or caps for home preview
  const activeCategoryStats = useMemo(() => {
    return allCategoryStats.filter((c) => c.cap > 0 || c.total > 0);
  }, [allCategoryStats]);

  // Dashboard Capped Previews (Top 3 on home screen)
  const top3Spending = useMemo(() => {
    if (activeCategoryStats.length > 0) {
      return activeCategoryStats.slice(0, 3);
    }
    return allCategoryStats.slice(0, 3);
  }, [activeCategoryStats, allCategoryStats]);

  const selectedCategoryStats = useMemo(() => {
    if (!selectedCategory) return null;
    const found = allCategoryStats.find((s) => s.category === selectedCategory);
    if (found) return found;
    const cap = Number((budgetData.caps as any)?.[selectedCategory] || 0);
    const total = expensesList
      .filter((item) => item?.date?.startsWith(month) && item?.category === selectedCategory)
      .reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
    return {
      category: selectedCategory,
      cap,
      total,
      percent: cap ? Math.round((total / cap) * 100) : 0,
      isOver: cap > 0 && total > cap,
    };
  }, [allCategoryStats, selectedCategory, budgetData.caps, expensesList, month]);

  const unpaidBills = useMemo(() => {
    return (billsList || [])
      .filter((item) => !item?.paid)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [billsList]);
  const top2Bills = useMemo(() => unpaidBills.slice(0, 2), [unpaidBills]);

  const top5Expenses = useMemo(() => expensesList.slice(0, 5), [expensesList]);

  const groupedTop5Expenses = useMemo(() => {
    const groups: { dateLabel: string; items: Expense[] }[] = [];
    top5Expenses.forEach((item) => {
      const label = getDateLabel(item.date);
      const existing = groups.find((g) => g.dateLabel === label);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ dateLabel: label, items: [item] });
      }
    });
    return groups;
  }, [top5Expenses]);

  return (
    <AppScreen
      title="Campus Cashflow"
      subtitle="Student runway & spending ledger"
      refreshing={finance.isRefetching}
      onRefresh={finance.refetch}
      overlay={
        <>
          {/* Quick Form Bottom Sheet (Log Expense & Add Bill) */}
          <BottomSheetModal
            ref={formSheetRef}
            snapPoints={formMode === "bill" ? ["75%", "94%"] : ["80%", "95%"]}
            topInset={insets.top + 16}
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="none"
            android_keyboardInputMode="adjustResize"
            handleComponent={() => null}
            onDismiss={() => setFormMode(null)}
            backgroundStyle={{
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
            }}
          >
            <BottomSheetScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.sheetContent,
                { paddingBottom: insets.bottom + 120 },
              ]}
            >
              <View style={styles.sheetDragHandleWrapper}>
                <View
                  style={[
                    styles.sheetDragHandleBar,
                    { backgroundColor: isDark ? theme.borderHover : theme.borderMuted },
                  ]}
                />
              </View>

              {formMode === "expense" ? (
                <ExpenseForm
                  key={`expense-${formSessionKey}`}
                  initialCategory={preselectedCategory}
                  onClose={() => {
                    formSheetRef.current?.dismiss();
                    setFormMode(null);
                  }}
                  onSave={(expense) => {
                    const amount = Number(expense.amount);
                    if (!expense.title.trim() || !Number.isFinite(amount) || amount <= 0) {
                      return notify.warning("Check Expense", "Enter a title and an amount above ₹0.");
                    }
                    expenseMutation.mutate({ ...expense, title: expense.title.trim(), amount });
                  }}
                  busy={expenseMutation.isPending}
                />
              ) : formMode === "bill" ? (
                <BillForm
                  key={`bill-${formSessionKey}`}
                  onClose={() => {
                    formSheetRef.current?.dismiss();
                    setFormMode(null);
                  }}
                  onSave={(bill) => {
                    const amount = Number(bill.amount);
                    if (!bill.title.trim() || amount <= 0) {
                      return notify.warning("Check Bill", "Enter a bill title and an amount above ₹0.");
                    }
                    billMutation.mutate({ ...bill, title: bill.title.trim(), amount, paid: false });
                  }}
                  busy={billMutation.isPending}
                />
              ) : null}
            </BottomSheetScrollView>
          </BottomSheetModal>

          {/* Dedicated View All Full-Height Sheets with Robust Gesture Arbitration */}
          <FinanceModalWrapper
            visible={detailMode === "budget"}
            title="Plan Budget"
            subtitle="Set your monthly allowance and category limits."
            onClose={() => setDetailMode(null)}
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <BudgetFormModal
                key={`budget-${formSessionKey}`}
                initialBudget={data?.budget || { allowance: 0, caps: {} as any }}
                onSave={(budget) => {
                  budgetMutation.mutate(budget);
                }}
                busy={budgetMutation.isPending}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </FinanceModalWrapper>

          <FinanceModalWrapper
            visible={detailMode === "all-spending"}
            title="Spending Breakdown"
            subtitle={`${formatINR(spent)} total spent across categories this month.`}
            onClose={() => setDetailMode(null)}
            action={
              <Pressable onPress={() => setDetailMode("budget")} hitSlop={8} style={styles.textActionPill}>
                <Text style={[styles.textActionLabel, { color: isDark ? "#FAFBFD" : theme.text }]}>
                  Edit budgets →
                </Text>
              </Pressable>
            }
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <AllSpendingModal
                key={`spending-${formSessionKey}`}
                allStats={allCategoryStats}
                onSelectCategory={(cat) => openCategoryDetail(cat, "all-spending")}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </FinanceModalWrapper>

          <FinanceModalWrapper
            visible={detailMode === "all-bills"}
            title="Upcoming & Paid Bills"
            subtitle={`${unpaidBills.length} upcoming bill${unpaidBills.length === 1 ? "" : "s"} due.`}
            onClose={() => setDetailMode(null)}
            action={
              <Pressable
                onPress={() => {
                  setDetailMode(null);
                  setTimeout(() => openForm("bill"), 250);
                }}
                hitSlop={8}
                style={styles.textActionPill}
              >
                <Text style={[styles.textActionLabel, { color: isDark ? "#FAFBFD" : theme.text }]}>
                  + Add bill
                </Text>
              </Pressable>
            }
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <AllBillsModal
                key={`bills-${formSessionKey}`}
                bills={billsList}
                onPay={(id) => payMutation.mutate(id)}
                onDelete={(id) => deleteBill.mutate(id)}
                payingId={payMutation.isPending ? payMutation.variables : null}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </FinanceModalWrapper>

          <FinanceModalWrapper
            visible={detailMode === "all-activity"}
            title="Transaction History"
            subtitle={`${expensesList.length} total transaction${expensesList.length === 1 ? "" : "s"} recorded.`}
            onClose={() => setDetailMode(null)}
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <AllActivityModal
                key={`activity-${formSessionKey}`}
                expenses={expensesList}
                onDelete={(id) => deleteExpense.mutate(id)}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </FinanceModalWrapper>

          {/* Dedicated View: Specific Category Detail & Transactions (Always Topmost) */}
          <FinanceModalWrapper
            visible={selectedCategory !== null}
            title={selectedCategory || "Category Details"}
            subtitle={
              selectedCategoryStats
                ? selectedCategoryStats.cap > 0
                  ? `${formatINR(selectedCategoryStats.total)} spent of ${formatINR(selectedCategoryStats.cap)} limit`
                  : `${formatINR(selectedCategoryStats.total)} total spent · No limit set`
                : undefined
            }
            onClose={handleCloseCategoryDetail}
            action={
              <Pressable
                onPress={() => {
                  const cat = selectedCategory;
                  handleCloseCategoryDetail();
                  setTimeout(() => openForm("expense", cat || undefined), 250);
                }}
                hitSlop={8}
                style={styles.textActionPill}
              >
                <Text style={[styles.textActionLabel, { color: isDark ? "#FAFBFD" : theme.text }]}>
                  + Log expense
                </Text>
              </Pressable>
            }
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <CategoryDetailModal
                key={`cat-${selectedCategory}-${formSessionKey}`}
                category={selectedCategory!}
                stats={
                  selectedCategoryStats || {
                    category: selectedCategory!,
                    cap: 0,
                    total: 0,
                    percent: 0,
                    isOver: false,
                  }
                }
                expenses={expensesList.filter((e) => e.category === selectedCategory)}
                onDeleteExpense={(id) => deleteExpense.mutate(id)}
                onLogExpense={(cat) => {
                  handleCloseCategoryDetail();
                  setTimeout(() => openForm("expense", cat), 250);
                }}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </FinanceModalWrapper>
        </>
      }
    >
      {finance.isLoading && !data ? (
        <LoadingCard label="Loading financial runway…" />
      ) : null}

      {finance.error && !data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Ledger is offline"
          description="Your cached transactions will return when the server reconnects."
          action={
            <ActionButton
              label="Retry"
              compact
              onPress={() => finance.refetch()}
            />
          }
        />
      ) : null}

      {/* Section 1 — Major: Monthly Runway Hero */}
      <FinanceHeroRunway
        isOverBudget={isOverBudget}
        overBudgetAmount={overBudgetAmount}
        allowance={allowance}
        remaining={remaining}
        spent={spent}
        safeDailySpend={safeDailySpend}
        daysLeft={daysLeft}
        rawSpendPercent={rawSpendPercent}
        onOpenBudget={() => openDetail("budget")}
      />

      {/* Section 2 — Primary Actions */}
      <FinanceActions
        onLogExpense={() => openForm("expense")}
        onPlanBudget={() => openDetail("budget")}
      />

      {/* Section 3 — Spending Overview */}
      <FinanceSpendingOverview
        allCategoryStats={allCategoryStats}
        top3Spending={top3Spending}
        spent={spent}
        onOpenAllSpending={() => openDetail("all-spending")}
        onSelectCategory={(cat) => openCategoryDetail(cat, "home")}
        onLogExpense={() => openForm("expense")}
      />

      {/* Section 4 — Upcoming Bills */}
      <FinanceUpcomingBills
        unpaidBills={unpaidBills}
        top2Bills={top2Bills}
        onOpenAllBills={() => openDetail("all-bills")}
        onOpenAddBill={() => openForm("bill")}
        onPayBill={(id) => payMutation.mutate(id)}
        payingId={payMutation.isPending ? payMutation.variables : null}
      />

      {/* Section 5 — Recent Activity */}
      <FinanceRecentActivity
        expensesList={expensesList}
        groupedTop5Expenses={groupedTop5Expenses}
        onOpenAllActivity={() => openDetail("all-activity")}
        onLogExpense={() => openForm("expense")}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  textActionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  textActionLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
  },
  sheetDragHandleWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.xs,
  },
  sheetDragHandleBar: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
  },
  sheetContent: {
    padding: spacing.md,
  },
});
