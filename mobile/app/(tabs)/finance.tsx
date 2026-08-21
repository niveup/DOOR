import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen } from "@/src/components/screen";
import { ProgressBar, SectionTitle } from "@/src/components/ui";
import { api } from "@/src/services/api";
import { formatINR, shortDate, todayInKolkata } from "@/src/lib/format";
import { Bill, Budget, Expense, FinanceCategory, financeCategories } from "@/src/types/domain";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { useAuth } from "@/src/providers/auth-provider";

// -------------------------------------------------------------
// Centralized Fintech Design & Category Color Tokens
// -------------------------------------------------------------
const SEMANTIC = {
  crimson: "#D94A62", // Muted crimson for over-budget & warnings (financial state ONLY)
  amber: "#C58A2A",   // Muted amber for near-limit
  emerald: "#18B887", // Restrained accent green for on-track / positive state
};

const CATEGORY_TOKENS: Record<
  FinanceCategory,
  {
    icon: keyof typeof Ionicons.glyphMap;
    darkIcon: string;
    darkBg: string;
    darkBorder: string;
    lightIcon: string;
    lightBg: string;
    lightBorder: string;
    barColor: string;
  }
> = {
  "Food & mess": {
    icon: "restaurant-outline",
    darkIcon: "#C98A3A",
    darkBg: "#241F18",
    darkBorder: "#342C22",
    lightIcon: "#9A6218",
    lightBg: "#FDF6EC",
    lightBorder: "#F3E2CC",
    barColor: "#F59E0B",
  },
  Subscriptions: {
    icon: "tv-outline",
    darkIcon: "#8B7CF6",
    darkBg: "#1F1C2B",
    darkBorder: "#2D283E",
    lightIcon: "#6355D8",
    lightBg: "#F4F2FD",
    lightBorder: "#E2DCFA",
    barColor: "#A855F7",
  },
  "Hostel & utilities": {
    icon: "home-outline",
    darkIcon: "#6F8FAF",
    darkBg: "#1B2025",
    darkBorder: "#272E36",
    lightIcon: "#486B8C",
    lightBg: "#F0F4F8",
    lightBorder: "#DCE5EE",
    barColor: "#38BDF8",
  },
  "Travel & commute": {
    icon: "car-outline",
    darkIcon: "#4FA39A",
    darkBg: "#182321",
    darkBorder: "#233330",
    lightIcon: "#2E7C74",
    lightBg: "#EEF7F6",
    lightBorder: "#D2EBE8",
    barColor: "#14B8A6",
  },
  Academics: {
    icon: "school-outline",
    darkIcon: "#7180B5",
    darkBg: "#1C1E27",
    darkBorder: "#282C3A",
    lightIcon: "#4E5F97",
    lightBg: "#F1F3F9",
    lightBorder: "#DCE1F1",
    barColor: "#6366F1",
  },
  "Personal & health": {
    icon: "fitness-outline",
    darkIcon: "#FB7185",
    darkBg: "#2A161E",
    darkBorder: "#4A2030",
    lightIcon: "#E11D48",
    lightBg: "#FFF1F2",
    lightBorder: "#FECDD3",
    barColor: "#F43F5E",
  },
  "Fun & social": {
    icon: "game-controller-outline",
    darkIcon: "#8B78B0",
    darkBg: "#211D26",
    darkBorder: "#302A37",
    lightIcon: "#6E5A93",
    lightBg: "#F5F2F9",
    lightBorder: "#E5DEEF",
    barColor: "#FB923C",
  },
  Others: {
    icon: "receipt-outline",
    darkIcon: "#85858F",
    darkBg: "#1B1B20",
    darkBorder: "#26262D",
    lightIcon: "#5C5C66",
    lightBg: "#F3F3F6",
    lightBorder: "#E1E1E6",
    barColor: "#94A3B8",
  },
};

type FormMode = "expense" | "bill" | null;
type DetailMode = "budget" | "all-spending" | "all-bills" | "all-activity" | null;

function getDateLabel(dateStr: string): string {
  const today = todayInKolkata();
  if (dateStr === today) return `Today · ${shortDate(dateStr)}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  if (dateStr === yStr) return `Yesterday · ${shortDate(dateStr)}`;
  try {
    return shortDate(dateStr);
  } catch {
    return dateStr;
  }
}

// -------------------------------------------------------------
// Standardized Category Icon Badge Component (Monochrome)
// -------------------------------------------------------------
function CategoryIconBadge({
  category,
  isDark,
  customIcon,
}: {
  category: FinanceCategory;
  isDark: boolean;
  customIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const meta = CATEGORY_TOKENS[category] || CATEGORY_TOKENS.Others;
  const iconName = customIcon || meta.icon;
  const iconColor = isDark ? "#A1A1AA" : "#64748b";
  const bgColor = isDark ? "#16161A" : "#f1f5f9";
  const borderColor = isDark ? "#24242A" : "#e2e8f0";

  return (
    <View
      style={[
        styles.categoryIconBadge,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
        },
      ]}
    >
      <Ionicons name={iconName} size={18} color={iconColor} />
    </View>
  );
}

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
              backgroundColor: isDark ? "#0E0E11" : "#ffffff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
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
                    { backgroundColor: isDark ? "#3f3f46" : "#cbd5e1" },
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
          <ViewAllModal
            visible={detailMode === "budget"}
            title="Plan Budget"
            subtitle="Set your monthly allowance and category limits."
            onClose={() => setDetailMode(null)}
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <BudgetFormContent
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
          </ViewAllModal>

          <ViewAllModal
            visible={detailMode === "all-spending"}
            title="Spending Breakdown"
            subtitle={`${formatINR(spent)} total spent across categories this month.`}
            onClose={() => setDetailMode(null)}
            action={
              <Pressable onPress={() => setDetailMode("budget")} hitSlop={8} style={styles.textActionPill}>
                <Text style={[styles.textActionLabel, { color: isDark ? "#FAFBFD" : theme.text, fontWeight: "700" }]}>
                  Edit budgets →
                </Text>
              </Pressable>
            }
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <AllSpendingContent
                key={`spending-${formSessionKey}`}
                allStats={allCategoryStats}
                onSelectCategory={(cat) => openCategoryDetail(cat, "all-spending")}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </ViewAllModal>

          <ViewAllModal
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
                <Text style={[styles.textActionLabel, { color: isDark ? "#FAFBFD" : theme.text, fontWeight: "700" }]}>
                  + Add bill
                </Text>
              </Pressable>
            }
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <AllBillsContent
                key={`bills-${formSessionKey}`}
                bills={billsList}
                onPay={(id) => payMutation.mutate(id)}
                onDelete={(id) => deleteBill.mutate(id)}
                payingId={payMutation.isPending ? payMutation.variables : null}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </ViewAllModal>

          <ViewAllModal
            visible={detailMode === "all-activity"}
            title="Transaction History"
            subtitle={`${expensesList.length} total transaction${expensesList.length === 1 ? "" : "s"} recorded.`}
            onClose={() => setDetailMode(null)}
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <AllActivityContent
                key={`activity-${formSessionKey}`}
                expenses={expensesList}
                onDelete={(id) => deleteExpense.mutate(id)}
                scrollHandler={scrollHandler}
                contentContainerStyle={contentContainerStyle}
              />
            )}
          </ViewAllModal>

          {/* Dedicated View: Specific Category Detail & Transactions (Always Topmost) */}
          <ViewAllModal
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
                <Text style={[styles.textActionLabel, { color: isDark ? "#FAFBFD" : theme.text, fontWeight: "700" }]}>
                  + Log expense
                </Text>
              </Pressable>
            }
          >
            {({ scrollHandler, contentContainerStyle }) => (
              <CategoryDetailContent
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
          </ViewAllModal>
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenScrollContent}
      >
        {/* Section 1 — Major: Monthly Runway Hero */}
        <Animated.View
          entering={FadeInDown.delay(40).duration(320)}
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? "#151518" : "#ffffff",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeftCol}>
              <Text style={[styles.heroLabel, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                MONTHLY RUNWAY
              </Text>
              
              <Text
                style={[
                  styles.heroBalanceValue,
                  {
                    color: isOverBudget
                      ? SEMANTIC.crimson
                      : isDark
                      ? "#F5F5F7"
                      : theme.text,
                  },
                ]}
              >
                {isOverBudget
                  ? `- ${formatINR(overBudgetAmount)}`
                  : allowance > 0
                  ? formatINR(remaining)
                  : formatINR(spent)}
              </Text>

              <Text
                style={[
                  styles.heroRemainingSub,
                  {
                    color: isOverBudget
                      ? SEMANTIC.crimson
                      : isDark
                      ? "#71717A"
                      : theme.textFaint,
                  },
                ]}
              >
                {isOverBudget
                  ? "Over monthly allowance"
                  : allowance > 0
                  ? "Remaining this month"
                  : "Spent this month (No allowance set)"}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetricRow}>
            <Text style={[styles.heroMetricPrimary, { color: isDark ? "#F5F5F7" : theme.text }]}>
              {allowance
                ? isOverBudget
                  ? "₹0/day safe spend"
                  : `${formatINR(safeDailySpend)}/day`
                : "No budget limit set"}
            </Text>
            <Text style={[styles.heroMetricDot, { color: isDark ? "#71717A" : theme.textFaint }]}>·</Text>
            <Text style={[styles.heroMetricSecondary, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left
            </Text>
          </View>

          <ProgressBar
            value={rawSpendPercent}
            height={4.5}
            tone={isOverBudget ? SEMANTIC.crimson : rawSpendPercent >= 80 ? SEMANTIC.amber : SEMANTIC.emerald}
          />

          <View style={styles.heroCollapsedFooter}>
            <Text style={[styles.heroFooterMeta, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
              <Text style={{ fontWeight: "700", color: isDark ? "#F5F5F7" : theme.text }}>
                {rawSpendPercent}% spent
              </Text>
              {allowance ? ` · ${formatINR(spent)} of ${formatINR(allowance)}` : ` · ${formatINR(spent)}`}
            </Text>

            {isOverBudget ? (
              <Text style={[styles.heroStatusWarning, { color: SEMANTIC.crimson }]}>
                ● {formatINR(overBudgetAmount)} over allowance
              </Text>
            ) : rawSpendPercent >= 80 ? (
              <Text style={[styles.heroStatusWarning, { color: SEMANTIC.amber }]}>
                ● Near monthly limit
              </Text>
            ) : allowance > 0 ? (
              <Text style={[styles.heroStatusHealthy, { color: SEMANTIC.emerald }]}>
                ● On track this month
              </Text>
            ) : (
              <Pressable onPress={() => openDetail("budget")} hitSlop={6}>
                <Text style={[styles.heroStatusHealthy, { color: isDark ? "#A1A1AA" : theme.textMuted, fontWeight: "600" }]}>
                  ● Set monthly limit →
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Section 2 — Primary Actions */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(320)}
          style={styles.actionRow}
        >
          <Pressable
            onPress={() => openForm("expense")}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: isDark ? "#FAFBFD" : "#0f172a",
                borderColor: isDark ? "#FAFBFD" : "#0f172a",
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View
              style={[
                styles.actionBtnIconBadge,
                { backgroundColor: isDark ? "#09090b" : "#ffffff" },
              ]}
            >
              <Ionicons name="add" size={13} color={isDark ? "#ffffff" : "#0f172a"} />
            </View>
            <Text style={[styles.primaryButtonText, { color: isDark ? "#09090b" : "#ffffff" }]}>
              Log Expense
            </Text>
          </Pressable>

          <Pressable
            onPress={() => openDetail("budget")}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: isDark ? "#151518" : "#ffffff",
                borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#cbd5e1",
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons name="options-outline" size={15} color={isDark ? "#A1A1AA" : theme.textMuted} />
            <Text style={[styles.secondaryButtonText, { color: isDark ? "#F5F5F7" : theme.text }]}>
              Plan Budget
            </Text>
          </Pressable>
        </Animated.View>

        {/* Section 3 — Spending Overview */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(320)}
          style={styles.sectionContainer}
        >
          <SectionTitle
            title="Spending"
            trailing={
              allCategoryStats.length > 3 ? (
                <Pressable
                  onPress={() => openDetail("all-spending")}
                  hitSlop={8}
                  style={styles.textActionPill}
                >
                  <Text style={[styles.textActionLabel, { color: isDark ? "#60A5FA" : "#2563EB" }]}>
                    View all →
                  </Text>
                </Pressable>
              ) : null
            }
          />

          {allCategoryStats.length > 0 ? (
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? "#151518" : "#ffffff",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                },
              ]}
            >
              {/* Vibrant, bold category allocation strip */}
              {spent > 0 ? (
                <View style={styles.spendingBarContainer}>
                  <View style={styles.segmentedProgressBar}>
                    {allCategoryStats.map((item) => {
                      const flexShare = Math.max(item.total / spent, 0.05);
                      const meta = CATEGORY_TOKENS[item.category] || CATEGORY_TOKENS.Others;
                      return (
                        <View
                          key={`seg-${item.category}`}
                          style={[
                            styles.segmentBarSlice,
                            {
                              flex: flexShare,
                              backgroundColor: meta.barColor,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {top3Spending.map((item, idx) => {
                const meta = CATEGORY_TOKENS[item.category] || CATEGORY_TOKENS.Others;
                return (
                  <Pressable
                    key={item.category}
                    onPress={() => openCategoryDetail(item.category, "home")}
                    style={({ pressed }) => [
                      styles.spendingRowItem,
                      (idx > 0 || (spent > 0 && allCategoryStats.length > 0)) && [
                        styles.hairlineDivider,
                        { borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" },
                      ],
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={styles.spendingRowLeft}>
                      <CategoryIconBadge category={item.category} isDark={isDark} />
                      <View style={{ gap: 2, flex: 1 }}>
                        <Text style={[styles.itemTitle, { color: isDark ? meta.darkIcon : meta.lightIcon }]}>
                          {item.category}
                        </Text>
                        {item.cap > 0 ? (
                          item.isOver ? (
                            <Text style={{ color: SEMANTIC.crimson, fontSize: 12, fontWeight: "600" }}>
                              {formatINR(item.total - item.cap)} over limit · Cap: {formatINR(item.cap)}
                            </Text>
                          ) : (
                            <Text style={{ color: isDark ? "#71717A" : theme.textFaint, fontSize: 12, fontWeight: "500" }}>
                              {item.total > 0
                                ? `${formatINR(item.cap - item.total)} left of ${formatINR(item.cap)} limit`
                                : `Limit: ${formatINR(item.cap)} · ₹0 spent`}
                            </Text>
                          )
                        ) : (
                          <Text style={{ color: isDark ? "#71717A" : theme.textFaint, fontSize: 12, fontWeight: "500" }}>
                            No limit set
                          </Text>
                        )}
                        {item.cap > 0 ? (
                          <View style={{ marginTop: 4 }}>
                            <ProgressBar
                              value={item.percent}
                              height={3.5}
                              tone={item.isOver ? SEMANTIC.crimson : item.percent >= 80 ? SEMANTIC.amber : SEMANTIC.emerald}
                            />
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.spendingRowRight}>
                      <Text style={[styles.itemAmount, { color: isDark ? "#F5F5F7" : theme.text }]}>
                        {formatINR(item.total)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {allCategoryStats.length > 3 ? (
                <Pressable
                  onPress={() => openDetail("all-spending")}
                  style={({ pressed }) => [
                    styles.collapseBottomButton,
                    {
                      borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
                    },
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Text style={[styles.collapseBottomText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>
                    View all {allCategoryStats.length} categories →
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={() => openForm("expense")}
              style={({ pressed }) => [
                styles.emptyStateBlock,
                {
                  backgroundColor: isDark ? "#151518" : "#ffffff",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                },
                pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
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
                <Ionicons name="pie-chart-outline" size={20} color={isDark ? "#60A5FA" : "#2563EB"} />
              </View>
              <Text style={[styles.emptyStateHeadline, { color: isDark ? "#F5F5F7" : theme.text }]}>
                No spending yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                Log your first expense to see where it's going
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Section 4 — Upcoming Bills */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(320)}
          style={styles.sectionContainer}
        >
          <SectionTitle
            title="Upcoming bills"
            trailing={
              <Pressable
                onPress={() => openForm("bill")}
                hitSlop={8}
                style={styles.textActionPill}
              >
                <Text style={[styles.textActionLabel, { color: isDark ? "#60A5FA" : "#2563EB" }]}>
                  + Add bill
                </Text>
              </Pressable>
            }
          />

          {unpaidBills.length > 0 ? (
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? "#151518" : "#ffffff",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                },
              ]}
            >
              {top2Bills.map((item, idx) => {
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openDetail("all-bills")}
                    style={({ pressed }) => [
                      styles.unifiedItemRow,
                      idx > 0 && [
                        styles.hairlineDivider,
                        { borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" },
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
                        <Text style={[styles.itemTitle, { color: isDark ? "#F5F5F7" : theme.text }]} numberOfLines={1}>
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
                        onPress={() => payMutation.mutate(item.id)}
                        disabled={payMutation.isPending && payMutation.variables === item.id}
                        style={({ pressed }) => [
                          styles.payButton,
                          {
                            backgroundColor: isDark ? "#1f1f26" : "#0f172a",
                            borderColor: isDark ? "#353540" : "#0f172a",
                          },
                          pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
                        ]}
                      >
                        {payMutation.isPending && payMutation.variables === item.id ? (
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
              })}

              {unpaidBills.length > 2 ? (
                <Pressable
                  onPress={() => openDetail("all-bills")}
                  style={({ pressed }) => [
                    styles.collapseBottomButton,
                    {
                      borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
                    },
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Text style={[styles.collapseBottomText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>
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
                  backgroundColor: isDark ? "#151518" : "#ffffff",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                },
              ]}
            >
              <View
                style={[
                  styles.emptyStateIconBadge,
                  {
                    backgroundColor: isDark ? "rgba(24, 184, 135, 0.12)" : "rgba(5, 150, 105, 0.08)",
                    borderColor: isDark ? "rgba(24, 184, 135, 0.22)" : "rgba(5, 150, 105, 0.15)",
                  },
                ]}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color={SEMANTIC.emerald} />
              </View>
              <Text style={[styles.emptyStateHeadline, { color: isDark ? "#F5F5F7" : theme.text }]}>
                All clear · No upcoming bills
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                You have no unpaid bills scheduled for this month.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Section 5 — Recent Activity */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(320)}
          style={styles.sectionContainer}
        >
          <SectionTitle
            title="Recent activity"
            trailing={
              expensesList.length > 5 ? (
                <Pressable
                  onPress={() => openDetail("all-activity")}
                  hitSlop={8}
                  style={styles.textActionPill}
                >
                  <Text style={[styles.textActionLabel, { color: isDark ? "#60A5FA" : "#2563EB" }]}>
                    View all →
                  </Text>
                </Pressable>
              ) : null
            }
          />

          {expensesList.length > 0 ? (
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? "#151518" : "#ffffff",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                },
              ]}
            >
              {groupedTop5Expenses.map((group, gIdx) => (
                <View key={group.dateLabel}>
                  <View
                    style={[
                      styles.dateHeaderRow,
                      {
                        backgroundColor: isDark ? "#1a1a20" : "#f8fafc",
                        borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
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
                        onPress={() => openDetail("all-activity")}
                        style={({ pressed }) => [
                          styles.unifiedItemRow,
                          idx > 0 && [
                            styles.hairlineDivider,
                            { borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" },
                          ],
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <View style={styles.itemDetails}>
                          <Text style={[styles.itemTitle, { color: isDark ? "#F5F5F7" : theme.text }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.itemSubtext, { color: isDark ? "#71717A" : theme.textFaint }]}>
                            {shortDate(item.date)} · {item.category}
                          </Text>
                        </View>

                        <Text style={[styles.itemAmount, { color: isDark ? "#F5F5F7" : theme.text }]}>
                          - {formatINR(item.amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              {expensesList.length > 5 ? (
                <Pressable
                  onPress={() => openDetail("all-activity")}
                  style={({ pressed }) => [
                    styles.collapseBottomButton,
                    {
                      borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
                    },
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Text style={[styles.collapseBottomText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>
                    View all {expensesList.length} transactions →
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={() => openForm("expense")}
              style={({ pressed }) => [
                styles.emptyStateBlock,
                {
                  backgroundColor: isDark ? "#151518" : "#ffffff",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                },
                pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
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
                <Ionicons name="receipt-outline" size={19} color={isDark ? "#60A5FA" : "#2563EB"} />
              </View>
              <Text style={[styles.emptyStateHeadline, { color: isDark ? "#F5F5F7" : theme.text }]}>
                Nothing here yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                Your logged expenses will show up here.
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>
    </AppScreen>
  );
}

// -----------------------------------------------------------------
// Educational Swipe-Down Hint Bar
// -----------------------------------------------------------------
function SwipeHintBanner({ isDark }: { isDark: boolean }) {
  const [visible, setVisible] = useState(false);
  const opacity = useSharedValue(0);

  const dismissBanner = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem("door_swipe_hint_dismissed_v5", "true").catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("door_swipe_hint_dismissed_v5").then((val) => {
      if (!val) {
        setVisible(true);
        opacity.value = withTiming(1, { duration: 250 });
        const timer = setTimeout(() => {
          opacity.value = withTiming(0, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(dismissBanner)();
            }
          });
        }, 4500);
        return () => clearTimeout(timer);
      }
    });
  }, [dismissBanner]);

  const handleManualDismiss = () => {
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(dismissBanner)();
      }
    });
  };

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.swipeHintBar,
        {
          backgroundColor: isDark ? "#18181E" : "#f1f5f9",
          borderColor: isDark ? "#282832" : "#e2e8f0",
        },
        animStyle,
      ]}
    >
      <Ionicons name="arrow-down" size={12} color="#38BDF8" />
      <Text style={[styles.swipeHintBarText, { color: isDark ? "#A1A1AA" : "#64748b" }]}>
        Swipe down from top anytime to dismiss
      </Text>
      <Pressable onPress={handleManualDismiss} hitSlop={8} style={{ padding: 2 }}>
        <Ionicons name="close" size={13} color={isDark ? "#71717A" : "#94a3b8"} />
      </Pressable>
    </Animated.View>
  );
}

// -----------------------------------------------------------------
// Reusable Full-Height View All Modal with Gesture Arbitration
// -----------------------------------------------------------------
function ViewAllModal({
  visible,
  onClose,
  title,
  subtitle,
  action,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: (props: {
    scrollHandler: any;
    contentContainerStyle: any;
  }) => React.ReactNode;
}) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDraggingSheet = useSharedValue(false);

  useEffect(() => {
    if (visible) {
      scrollY.value = 0;
      translateY.value = 0;
      isDraggingSheet.value = false;
    }
  }, [visible]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const contentPanGesture = Gesture.Pan()
    .activeOffsetY([10, 100000])
    .failOffsetY([-100000, -1])
    .onUpdate((event) => {
      "worklet";
      if (scrollY.value <= 1 && event.translationY > 0) {
        isDraggingSheet.value = true;
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (isDraggingSheet.value) {
        isDraggingSheet.value = false;
        if (translateY.value > 130 && event.velocityY > -50) {
          translateY.value = withTiming(900, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(onClose)();
            }
          });
        } else {
          translateY.value = withSpring(0, {
            damping: 24,
            stiffness: 260,
            mass: 0.8,
          });
        }
      }
    });

  const headerPanGesture = Gesture.Pan()
    .activeOffsetY([6, 100000])
    .failOffsetY([-100000, -1])
    .onUpdate((event) => {
      "worklet";
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (translateY.value > 120 && event.velocityY > -50) {
        translateY.value = withTiming(900, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
      } else {
        translateY.value = withSpring(0, {
          damping: 24,
          stiffness: 260,
          mass: 0.8,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: Math.max(0, translateY.value) }],
    };
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.viewAllBackdrop}>
        <Animated.View
          style={[
            styles.viewAllContainer,
            {
              backgroundColor: isDark ? "#08080A" : "#f8fafc",
            },
            animatedStyle,
          ]}
        >
          {/* Header with HeaderPanGesture */}
          <GestureDetector gesture={headerPanGesture}>
            <View
              style={[
                styles.detailHeaderArea,
                {
                  paddingTop: Math.max(insets.top, 14),
                  borderBottomColor: isDark ? "#18181D" : "#e2e8f0",
                  backgroundColor: isDark ? "#08080A" : "#f8fafc",
                },
              ]}
            >
              {/* Drag Handle Bar */}
              <View style={styles.sheetDragHandleWrapper}>
                <View
                  style={[
                    styles.sheetDragHandleBar,
                    { backgroundColor: isDark ? "#3f3f46" : "#cbd5e1" },
                  ]}
                />
              </View>

              <View style={styles.detailHeaderTop}>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [styles.detailBackButton, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="arrow-back" size={18} color={isDark ? "#F5F5F7" : theme.text} />
                  <Text style={[styles.detailHeaderTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>
                    {title}
                  </Text>
                </Pressable>
                {action}
              </View>

              {subtitle ? (
                <Text style={[styles.detailHeaderSubtitle, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  {subtitle}
                </Text>
              ) : null}

              <SwipeHintBanner isDark={isDark} />
            </View>
          </GestureDetector>

          {/* Content with ContentPanGesture (simultaneous with inner scroll) */}
          <GestureDetector gesture={contentPanGesture}>
            <View style={{ flex: 1 }}>
              {children({
                scrollHandler,
                contentContainerStyle: [
                  styles.detailScrollBody,
                  { paddingBottom: insets.bottom + 40 },
                ],
              })}
            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------
// 0. Dedicated View: Specific Category Detail & Transactions Content
// -----------------------------------------------------------------
function CategoryDetailContent({
  category,
  stats,
  expenses,
  onDeleteExpense,
  onLogExpense,
  scrollHandler,
  contentContainerStyle,
}: {
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
}) {
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

// -----------------------------------------------------------------
// 1. Dedicated View: All Spending Categories Content
// -----------------------------------------------------------------
function AllSpendingContent({
  allStats,
  onSelectCategory,
  scrollHandler,
  contentContainerStyle,
}: {
  allStats: {
    category: FinanceCategory;
    cap: number;
    total: number;
    percent: number;
    isOver: boolean;
  }[];
  onSelectCategory?: (category: FinanceCategory) => void;
  scrollHandler: any;
  contentContainerStyle: any;
}) {
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

// -----------------------------------------------------------------
// 2. Dedicated View: All Bills Content
// -----------------------------------------------------------------
function AllBillsContent({
  bills,
  onPay,
  onDelete,
  payingId,
  scrollHandler,
  contentContainerStyle,
}: {
  bills: Bill[];
  onPay: (id: string) => void;
  onDelete: (id: string) => void;
  payingId: string | null;
  scrollHandler: any;
  contentContainerStyle: any;
}) {
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

// -----------------------------------------------------------------
// 3. Dedicated View: All Activity Content
// -----------------------------------------------------------------
function AllActivityContent({
  expenses,
  onDelete,
  scrollHandler,
  contentContainerStyle,
}: {
  expenses: Expense[];
  onDelete: (id: string) => void;
  scrollHandler: any;
  contentContainerStyle: any;
}) {
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

// -----------------------------------------------------------------
// 4. Dedicated View: Plan Budget Content
// -----------------------------------------------------------------
function BudgetFormContent({
  initialBudget,
  onSave,
  busy,
  scrollHandler,
  contentContainerStyle,
}: {
  initialBudget: Budget;
  onSave: (val: Budget) => void;
  busy: boolean;
  scrollHandler: any;
  contentContainerStyle: any;
}) {
  const { theme, isDark } = useTheme();
  const notify = useNotify();
  const insets = useSafeAreaInsets();

  const [allowanceText, setAllowanceText] = useState<string>(
    initialBudget?.allowance ? String(initialBudget.allowance) : ""
  );

  const [capsText, setCapsText] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    financeCategories.forEach((cat) => {
      const val = initialBudget?.caps?.[cat];
      initial[cat] = typeof val === "number" && val > 0 ? String(val) : "";
    });
    return initial;
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const numericAllowance = allowanceText ? parseInt(allowanceText, 10) || 0 : 0;

  const totalAllocated = useMemo(() => {
    return Object.values(capsText).reduce((sum, str) => {
      const n = str ? parseInt(str, 10) || 0 : 0;
      return sum + n;
    }, 0);
  }, [capsText]);

  const effectiveAllowance = numericAllowance > 0 ? numericAllowance : totalAllocated;
  const difference = effectiveAllowance - totalAllocated;
  const isOverAllocated = difference < 0;
  const isExact = difference === 0 && effectiveAllowance > 0;

  const allocationPercent = effectiveAllowance > 0
    ? Math.round((totalAllocated / effectiveAllowance) * 100)
    : 0;

  const handleCapTextChange = (cat: string, text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    setCapsText((prev) => ({
      ...prev,
      [cat]: digitsOnly,
    }));
  };

  const handleAllowanceTextChange = (text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    setAllowanceText(digitsOnly);
  };

  const handleSubmit = () => {
    let finalAllowance = numericAllowance;
    if (finalAllowance === 0 && totalAllocated > 0) {
      finalAllowance = totalAllocated;
    }

    if (totalAllocated > finalAllowance && finalAllowance > 0) {
      notify.confirm({
        title: "Category Caps Exceed Allowance",
        message: `Your category caps total ₹${totalAllocated.toLocaleString("en-IN")}, but your monthly allowance is set to ₹${finalAllowance.toLocaleString("en-IN")}. Update allowance to match caps?`,
        confirmLabel: "Update Allowance",
        cancelLabel: "Adjust Caps",
        tone: "primary",
        onConfirm: () => {
          const finalCaps: Record<string, number> = {};
          financeCategories.forEach((cat) => {
            finalCaps[cat] = capsText[cat] ? parseInt(capsText[cat], 10) || 0 : 0;
          });
          onSave({ allowance: totalAllocated, caps: finalCaps as any });
        },
      });
      return;
    }

    const finalCaps: Record<string, number> = {};
    financeCategories.forEach((cat) => {
      const num = capsText[cat] ? parseInt(capsText[cat], 10) || 0 : 0;
      finalCaps[cat] = num;
    });

    onSave({
      allowance: finalAllowance,
      caps: finalCaps as any,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: insets.bottom + 90 }]}
      >
        <View style={styles.budgetSectionGroup}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
            MONTHLY ALLOWANCE
          </Text>

          <View
            style={[
              styles.allowanceInputBox,
              {
                backgroundColor: isDark ? "#111113" : "#ffffff",
                borderColor: focusedField === "allowance"
                  ? SEMANTIC.emerald
                  : isDark
                  ? "#24242A"
                  : "#e2e8f0",
              },
            ]}
          >
            <Text style={[styles.allowancePrefix, { color: isDark ? "#71717A" : theme.textFaint }]}>
              ₹
            </Text>
            <TextInput
              style={[styles.allowanceInput, { color: isDark ? "#F5F5F7" : theme.text }]}
              value={allowanceText}
              onChangeText={handleAllowanceTextChange}
              onFocus={() => setFocusedField("allowance")}
              onBlur={() => setFocusedField(null)}
              placeholder="0"
              placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
              keyboardType="numeric"
              selectTextOnFocus
            />
          </View>

          <View style={styles.allocationStatusBlock}>
            <View style={styles.allocationStatusRow}>
              <Text style={[styles.allocationMetaText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                {formatINR(totalAllocated)} allocated
              </Text>
              <Text
                style={[
                  styles.allocationRemainingText,
                  {
                    color: isOverAllocated
                      ? SEMANTIC.crimson
                      : isExact
                      ? SEMANTIC.emerald
                      : isDark
                      ? "#A1A1AA"
                      : theme.textMuted,
                    fontWeight: isOverAllocated || isExact ? "700" : "500",
                  },
                ]}
              >
                {isOverAllocated
                  ? `${formatINR(Math.abs(difference))} over allocated`
                  : isExact
                  ? "✓ Fully allocated"
                  : effectiveAllowance > 0
                  ? `${formatINR(difference)} remaining`
                  : "Set allowance to plan"}
              </Text>
            </View>

            {effectiveAllowance > 0 ? (
              <ProgressBar
                value={isOverAllocated ? 100 : allocationPercent}
                height={4.5}
                tone={isOverAllocated ? SEMANTIC.crimson : SEMANTIC.emerald}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.budgetSectionGroup}>
          <View style={{ gap: 2 }}>
            <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
              CATEGORY BUDGETS
            </Text>
            <Text style={[styles.budgetSectionSubhead, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
              Set a monthly limit for each category.
            </Text>
          </View>

          <View
            style={[
              styles.budgetUnifiedCard,
              {
                backgroundColor: isDark ? "#111113" : "#ffffff",
                borderColor: isDark ? "#1F1F24" : "#e2e8f0",
              },
            ]}
          >
            {financeCategories.map((category, idx) => {
              const valStr = capsText[category] || "";
              const isFocused = focusedField === category;

              return (
                <View
                  key={category}
                  style={[
                    styles.categoryRowItem,
                    idx > 0 && [
                      styles.categoryRowDivider,
                      { borderTopColor: isDark ? "#18181D" : "#f1f5f9" },
                    ],
                  ]}
                >
                  <View style={styles.categoryRowLeft}>
                    <CategoryIconBadge category={category} isDark={isDark} />
                    <Text style={[styles.categoryTitleText, { color: isDark ? "#F5F5F7" : theme.text }]}>
                      {category}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.categoryInputContainer,
                      {
                        backgroundColor: isDark ? "#151519" : "#f8fafc",
                        borderColor: isFocused
                          ? SEMANTIC.emerald
                          : isDark
                          ? "#24242A"
                          : "#e2e8f0",
                      },
                    ]}
                  >
                    <Text style={[styles.categoryInputPrefix, { color: isDark ? "#71717A" : theme.textFaint }]}>
                      ₹
                    </Text>
                    <TextInput
                      style={[styles.categoryNumericInput, { color: isDark ? "#F5F5F7" : theme.text }]}
                      value={valStr}
                      onChangeText={(text) => handleCapTextChange(category, text)}
                      onFocus={() => setFocusedField(category)}
                      onBlur={() => setFocusedField(null)}
                      placeholder="0"
                      placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.ScrollView>

      <View
        style={[
          styles.budgetStickyBottom,
          {
            backgroundColor: isDark ? "#111113" : "#ffffff",
            borderTopColor: isDark ? "#18181D" : "#e2e8f0",
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={busy}
          style={({ pressed }) => [
            styles.budgetSaveCta,
            {
              backgroundColor: isDark ? "#FAFBFD" : "#0f172a",
              borderColor: isDark ? "#FAFBFD" : "#0f172a",
            },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            busy && { opacity: 0.5 },
          ]}
        >
          <Text style={[styles.budgetSaveCtaText, { color: isDark ? "#09090b" : "#ffffff" }]}>
            {busy ? "Saving..." : "Save Budget"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Category Picker for Expense & Bill Forms
function CategoryPicker({
  value,
  onChange,
}: {
  value: FinanceCategory;
  onChange: (category: FinanceCategory) => void;
}) {
  const { theme, isDark } = useTheme();

  return (
    <GHScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled={true}
      directionalLockEnabled={true}
      overScrollMode="never"
      keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.pickerContent}
    >
      {financeCategories.map((category) => {
        const active = value === category;
        const meta = CATEGORY_TOKENS[category] || CATEGORY_TOKENS.Others;
        const iconColor = isDark ? meta.darkIcon : meta.lightIcon;
        const bgColor = active
          ? isDark
            ? meta.darkBg
            : meta.lightBg
          : isDark
          ? "#16161A"
          : "#f8fafc";
        const borderColor = active
          ? isDark
            ? meta.darkIcon
            : meta.lightIcon
          : isDark
          ? "#232329"
          : "#e2e8f0";

        return (
          <Pressable
            key={category}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onChange(category);
            }}
            style={[
              styles.categoryChip,
              {
                backgroundColor: bgColor,
                borderColor: borderColor,
              },
            ]}
          >
            <Ionicons
              name={meta.icon}
              size={13}
              color={iconColor}
            />
            <Text
              style={[
                styles.categoryChipText,
                {
                  color: active
                    ? isDark
                      ? "#FAFBFD"
                      : "#0f172a"
                    : isDark
                    ? "#A1A1AA"
                    : theme.textMuted,
                  fontWeight: active ? "700" : "500",
                },
              ]}
            >
              {category.replace(" & ", " + ")}
            </Text>
          </Pressable>
        );
      })}
    </GHScrollView>
  );
}

// 1. Log Expense Form
function ExpenseForm({
  initialCategory,
  onSave,
  onClose,
  busy,
}: {
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
}) {
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

  return (
    <View style={styles.formContainer}>
      <View style={styles.sheetHeaderRow}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [styles.sheetBackButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={18} color={isDark ? "#F5F5F7" : theme.text} />
          <Text style={[styles.sheetTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>Log Expense</Text>
        </Pressable>
      </View>
      <Text style={[styles.sheetSubtitle, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
        Record a student expense in your ledger.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>ITEM / TITLE</Text>
        <BottomSheetTextInput
          style={[
            styles.sheetTextInput,
            {
              backgroundColor: isDark ? "#09090b" : "#f8fafc",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
              color: isDark ? "#F5F5F7" : theme.text,
            },
          ]}
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder="e.g. Mess lunch, Auto to college, Stationery"
          placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>AMOUNT (₹)</Text>
        <BottomSheetTextInput
          style={[
            styles.sheetTextInput,
            {
              backgroundColor: isDark ? "#09090b" : "#f8fafc",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
              color: isDark ? "#F5F5F7" : theme.text,
            },
          ]}
          value={form.amount}
          onChangeText={(amount) =>
            setForm((prev) => ({ ...prev, amount: amount.replace(/[^0-9]/g, "") }))
          }
          placeholder="0"
          placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>DATE</Text>
        <View style={styles.dateSelectorRow}>
          <Pressable
            onPress={() => setForm((prev) => ({ ...prev, date: todayStr }))}
            style={[
              styles.dateOptionPill,
              {
                backgroundColor: form.date === todayStr ? (isDark ? "#24242A" : "#e2e8f0") : (isDark ? "#121215" : "#f8fafc"),
                borderColor: form.date === todayStr ? (isDark ? "#60A5FA" : "#2563EB") : (isDark ? "#27272a" : "#e2e8f0"),
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={form.date === todayStr ? (isDark ? "#60A5FA" : "#2563EB") : (isDark ? "#71717A" : theme.textFaint)}
            />
            <Text
              style={[
                styles.dateOptionText,
                {
                  color: form.date === todayStr ? (isDark ? "#F5F5F7" : "#0f172a") : (isDark ? "#71717A" : theme.textFaint),
                  fontWeight: form.date === todayStr ? "700" : "500",
                },
              ]}
            >
              Today ({shortDate(todayStr)})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setForm((prev) => ({ ...prev, date: yesterdayStr }))}
            style={[
              styles.dateOptionPill,
              {
                backgroundColor: form.date === yesterdayStr ? (isDark ? "#24242A" : "#e2e8f0") : (isDark ? "#121215" : "#f8fafc"),
                borderColor: form.date === yesterdayStr ? (isDark ? "#60A5FA" : "#2563EB") : (isDark ? "#27272a" : "#e2e8f0"),
              },
            ]}
          >
            <Text
              style={[
                styles.dateOptionText,
                {
                  color: form.date === yesterdayStr ? (isDark ? "#F5F5F7" : "#0f172a") : (isDark ? "#71717A" : theme.textFaint),
                  fontWeight: form.date === yesterdayStr ? "700" : "500",
                },
              ]}
            >
              Yesterday ({shortDate(yesterdayStr)})
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>CATEGORY</Text>
        <CategoryPicker
          value={form.category}
          onChange={(category) => setForm((prev) => ({ ...prev, category }))}
        />
      </View>

      <Pressable
        onPress={() => onSave(form)}
        disabled={busy}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          styles.submitSheetButton,
          {
            backgroundColor: isDark ? SEMANTIC.emerald : "#059669",
            borderColor: isDark ? SEMANTIC.emerald : "#059669",
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
          busy && { opacity: 0.5 },
        ]}
      >
        <Ionicons name="checkmark-circle" size={18} color={isDark ? "#09090B" : "#ffffff"} />
        <Text style={[styles.submitSheetText, { color: isDark ? "#09090B" : "#ffffff" }]}>
          {busy ? "Saving..." : "Add to Ledger"}
        </Text>
      </Pressable>
    </View>
  );
}

// 3. Add Bill Form
function BillForm({
  onSave,
  onClose,
  busy,
}: {
  onSave: (val: {
    title: string;
    amount: string;
    category: FinanceCategory;
    date: string;
  }) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { theme, isDark } = useTheme();
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "Subscriptions" as FinanceCategory,
    date: todayInKolkata(),
  });

  return (
    <View style={styles.formContainer}>
      <View style={styles.sheetHeaderRow}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [styles.sheetBackButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={18} color={isDark ? "#F5F5F7" : theme.text} />
          <Text style={[styles.sheetTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>Add Bill</Text>
        </Pressable>
      </View>
      <Text style={[styles.sheetSubtitle, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
        Track upcoming recurring payments.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>BILL NAME</Text>
        <BottomSheetTextInput
          style={[
            styles.sheetTextInput,
            {
              backgroundColor: isDark ? "#09090b" : "#f8fafc",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
              color: isDark ? "#F5F5F7" : theme.text,
            },
          ]}
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder="e.g. WiFi, Mess Advance, Spotify"
          placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>AMOUNT (₹)</Text>
        <BottomSheetTextInput
          style={[
            styles.sheetTextInput,
            {
              backgroundColor: isDark ? "#09090b" : "#f8fafc",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
              color: isDark ? "#F5F5F7" : theme.text,
            },
          ]}
          value={form.amount}
          onChangeText={(amount) =>
            setForm((prev) => ({ ...prev, amount: amount.replace(/[^0-9]/g, "") }))
          }
          placeholder="0"
          placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>CATEGORY</Text>
        <CategoryPicker
          value={form.category}
          onChange={(category) => setForm((prev) => ({ ...prev, category }))}
        />
      </View>

      <Pressable
        onPress={() => onSave(form)}
        disabled={busy}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          styles.submitSheetButton,
          {
            backgroundColor: isDark ? SEMANTIC.emerald : "#059669",
            borderColor: isDark ? SEMANTIC.emerald : "#059669",
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
          busy && { opacity: 0.5 },
        ]}
      >
        <Ionicons name="checkmark-circle" size={18} color={isDark ? "#09090B" : "#ffffff"} />
        <Text style={[styles.submitSheetText, { color: isDark ? "#09090B" : "#ffffff" }]}>
          {busy ? "Saving..." : "Add Bill"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  themeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  screenScrollContent: {
    gap: 28,
    paddingBottom: 90,
  },

  // View All Presentation Layer
  viewAllBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  viewAllContainer: {
    flex: 1,
  },

  // Slide Down Grabber Bar
  sheetDragHandleWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  sheetDragHandleBar: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
  },

  // Floating Educational Hint Bar
  swipeHintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  swipeHintBarText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },

  // Section 1 — Major: Monthly Runway Hero
  heroCard: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroLeftCol: {
    gap: 2,
  },
  heroContextLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  heroNoLimitHeadlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 3,
    marginBottom: 3,
  },
  heroNoLimitTitle: {
    fontSize: 18.5,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  heroNoLimitDot: {
    fontSize: 13,
    fontWeight: "600",
  },
  heroNoLimitSecondary: {
    fontSize: 13,
    fontWeight: "500",
  },
  heroProgressWrapper: {
    marginVertical: 2,
  },
  heroSetLimitCta: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  heroSetLimitText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  heroBalanceValue: {
    fontSize: 44,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  heroRemainingSub: {
    fontSize: 13.5,
    fontWeight: "500",
  },
  heroMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    marginBottom: 2,
  },
  heroMetricPrimary: {
    fontSize: 13.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  heroMetricDot: {
    fontSize: 13,
    fontWeight: "600",
  },
  heroMetricSecondary: {
    fontSize: 13,
    fontWeight: "500",
  },
  heroCollapsedFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 2,
  },
  heroFooterMeta: {
    fontSize: 12.5,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  heroStatusWarning: {
    fontSize: 12.5,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  heroStatusHealthy: {
    fontSize: 12.5,
    fontWeight: "600",
  },

  // Section 2 — Action Row
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: -10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Section Headers
  sectionContainer: {
    gap: 10,
  },
  textActionPill: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  textActionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Single Unified Section Surfaces
  unifiedCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 15.5,
    fontWeight: "600",
  },
  itemSubtext: {
    fontSize: 13,
    fontWeight: "500",
  },
  itemAmount: {
    fontSize: 15.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // Bold, vibrant category breakdown bar
  spendingBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 6,
  },
  segmentedProgressBar: {
    flexDirection: "row",
    height: 5.5,
    borderRadius: 3,
    overflow: "hidden",
    gap: 2,
  },
  segmentBarSlice: {
    height: "100%",
    borderRadius: 2,
  },

  // Spending Rows
  spendingRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  spendingRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  spendingRowRight: {
    alignItems: "flex-end",
  },
  emptyEnvelopesPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  collapseBottomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  collapseBottomText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Upcoming Bills & Recent Activity Rows
  unifiedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  itemLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  itemDetails: {
    flex: 1,
    gap: 2,
  },
  itemRightActionBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  payButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 52,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  payButtonText: {
    fontSize: 11.5,
    fontWeight: "800",
  },

  // Elevated Empty State Block
  emptyStateBlock: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
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
    fontSize: 14.5,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  emptyStateSubtext: {
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 280,
  },

  compactEmptyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  quietStatusText: {
    fontSize: 12.5,
    fontWeight: "500",
  },

  // Date Group Header inside Recent Activity
  dateHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dateHeaderText: {
    fontSize: 11.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Category Picker
  pickerContent: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 11.5,
  },

  // Sheet Content for Expense & Bill Forms
  sheetContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
  },
  formContainer: {
    gap: 12,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: -8,
    lineHeight: 16,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  sheetTextInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  submitSheetButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  submitSheetText: {
    fontSize: 13.5,
    fontWeight: "800",
  },

  // -------------------------------------------------------------
  // Dedicated Detail Screens (Spending, Bills, Activity, Budget)
  // -------------------------------------------------------------
  detailHeaderArea: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  detailHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  detailHeaderSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    paddingLeft: 26,
  },
  detailScrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  detailEnvelopeItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  envelopeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  envelopeLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  // Search Bar for Activity History
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    gap: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 13.5,
  },

  // Full-Page Budget Plan Styles
  budgetScrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 22,
  },
  budgetSectionGroup: {
    gap: 8,
  },
  budgetSectionSubhead: {
    fontSize: 12,
    fontWeight: "500",
  },
  allowanceInputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  allowancePrefix: {
    fontSize: 18,
    fontWeight: "700",
    marginRight: 8,
  },
  allowanceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  allocationStatusBlock: {
    gap: 6,
    paddingTop: 2,
    paddingHorizontal: 2,
  },
  allocationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  allocationMetaText: {
    fontSize: 12.5,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  allocationRemainingText: {
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  budgetUnifiedCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  categoryRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  categoryTitleText: {
    fontSize: 15,
    fontWeight: "600",
  },
  categoryInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 92,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  categoryInputPrefix: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 3,
  },
  categoryNumericInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  budgetStickyBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  budgetSaveCta: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetSaveCtaText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  dateSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateOptionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateOptionText: {
    fontSize: 12,
  },
});
