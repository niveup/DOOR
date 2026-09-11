import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { formatINR } from "@/src/lib/format";
import { Budget, financeCategories } from "@/src/types/domain";
import { CATEGORY_ALIASES, SEMANTIC } from "@/src/components/finance/FinanceConstants";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii } from "@/src/theme/tokens";

export interface BudgetFormModalProps {
  initialBudget: Budget;
  onSave: (val: Budget) => void;
  busy: boolean;
  scrollHandler: any;
  contentContainerStyle: any;
}

export function BudgetFormModal({
  initialBudget,
  onSave,
  busy,
  scrollHandler,
  contentContainerStyle,
}: BudgetFormModalProps) {
  const { theme, isDark } = useTheme();
  const notify = useNotify();
  const insets = useSafeAreaInsets();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const currentScrollY = useSharedValue(0);
  const keyboardSpacerHeight = useSharedValue(0);
  const originalScrollY = useRef(0);
  const hasShiftedUp = useRef(false);
  const keyboardHeightRef = useRef(0);
  const focusedFieldRef = useRef<string | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const animatedSpacerStyle = useAnimatedStyle(() => ({
    height: keyboardSpacerHeight.value,
  }));

  // Layout positions relative to ScrollView
  const allowanceSectionY = useRef(0);
  const categoriesSectionY = useRef(0);
  const cardInsideSectionY = useRef(0);
  const rowOffsets = useRef<Record<string, number>>({});
  const rowHeights = useRef<Record<string, number>>({});

  const windowHeight = Dimensions.get("window").height;

  const scrollTarget = useCallback(
    (y: number) => {
      const safeY = Math.max(0, Math.round(y));
      runOnUI(() => {
        "worklet";
        scrollTo(scrollRef, 0, safeY, true);
      })();
    },
    [scrollRef]
  );

  const combinedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      currentScrollY.value = event.contentOffset.y;
      if (scrollHandler) {
        if (typeof (scrollHandler as any)?.onScroll === "function") {
          (scrollHandler as any).onScroll(event);
        } else if (typeof scrollHandler === "function") {
          (scrollHandler as any)(event);
        }
      }
    },
  });

  const performSmoothScroll = useCallback(
    (fieldKey: string, customKbHeight?: number) => {
      if (!fieldKey) return;

      const curScroll = currentScrollY.value || 0;
      const modalHeaderHeight = insets.top + 64;
      const kbH = customKbHeight || (keyboardHeightRef.current > 0 ? keyboardHeightRef.current : 290);
      const keyboardTopOnScreen = windowHeight - kbH;
      const desiredBottomLimit = keyboardTopOnScreen - 20;

      let rowTopInScroll = 0;
      let rowH = 52;

      if (fieldKey === "allowance") {
        rowTopInScroll = allowanceSectionY.current;
        rowH = 56;
      } else {
        const rowRelY = rowOffsets.current[fieldKey] ?? 0;
        rowH = rowHeights.current[fieldKey] ?? 52;
        rowTopInScroll = categoriesSectionY.current + cardInsideSectionY.current + rowRelY;
      }

      const rowTopOnScreen = modalHeaderHeight + rowTopInScroll - curScroll;
      const rowBottomOnScreen = rowTopOnScreen + rowH;

      // 1. If row is behind or clipped by keyboard:
      if (rowBottomOnScreen > desiredBottomLimit) {
        const delta = rowBottomOnScreen - desiredBottomLimit;
        if (!hasShiftedUp.current) {
          originalScrollY.current = curScroll;
          hasShiftedUp.current = true;
        }
        scrollTarget(curScroll + delta);
      }
      // 2. If row was shifted too far up and clipped under header:
      else if (rowTopOnScreen < modalHeaderHeight + 10 && hasShiftedUp.current) {
        const delta = modalHeaderHeight + 10 - rowTopOnScreen;
        const newTarget = Math.max(0, curScroll - delta);
        scrollTarget(newTarget);
      }
    },
    [insets.top, windowHeight, scrollTarget, currentScrollY]
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbH = e.endCoordinates.height;
      keyboardHeightRef.current = kbH;

      // Micro-adjust only if actual keyboard height differs significantly from estimated 290px
      if (focusedFieldRef.current && Math.abs(kbH - 290) > 15) {
        performSmoothScroll(focusedFieldRef.current, kbH);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      focusedFieldRef.current = null;
      setFocusedField(null);
      if (hasShiftedUp.current) {
        scrollTarget(originalScrollY.current);
        hasShiftedUp.current = false;
      }
      setTimeout(() => {
        if (!focusedFieldRef.current) {
          keyboardSpacerHeight.value = 0;
        }
      }, 220);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [performSmoothScroll, scrollTarget, keyboardSpacerHeight]);

  const handleCategoryFocus = (category: string) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setFocusedField(category);
    focusedFieldRef.current = category;

    // Expand keyboard spacer dynamically only while keyboard is active
    keyboardSpacerHeight.value = 280;

    // Immediately trigger smooth scroll in parallel with keyboard opening!
    performSmoothScroll(category);
  };

  const handleFieldBlur = (fieldKey: string) => {
    if (focusedFieldRef.current === fieldKey) {
      focusedFieldRef.current = null;
    }
    setFocusedField((prev) => (prev === fieldKey ? null : prev));

    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      if (!focusedFieldRef.current) {
        if (hasShiftedUp.current) {
          scrollTarget(originalScrollY.current);
          hasShiftedUp.current = false;
        }
        setTimeout(() => {
          if (!focusedFieldRef.current) {
            keyboardSpacerHeight.value = 0;
          }
        }, 220);
      }
    }, 120);
  };

  const [allowanceText, setAllowanceText] = useState<string>(
    initialBudget?.allowance ? String(initialBudget.allowance) : ""
  );

  const [capsText, setCapsText] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    financeCategories.forEach((cat) => {
      const alias = Object.entries(CATEGORY_ALIASES).find(([, target]) => target === cat)?.[0];
      const val = initialBudget?.caps?.[cat] ?? (alias ? (initialBudget?.caps as any)?.[alias] : undefined);
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
        ref={scrollRef}
        onScroll={combinedScrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          contentContainerStyle,
          {
            paddingBottom: Math.max(insets.bottom + 90, 90),
          },
        ]}
      >
        <View
          onLayout={(e) => {
            allowanceSectionY.current = e.nativeEvent.layout.y;
          }}
          style={styles.budgetSectionGroup}
        >
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
              onFocus={() => {
                if (blurTimeoutRef.current) {
                  clearTimeout(blurTimeoutRef.current);
                  blurTimeoutRef.current = null;
                }
                setFocusedField("allowance");
                focusedFieldRef.current = "allowance";
                keyboardSpacerHeight.value = 280;
                performSmoothScroll("allowance");
              }}
              onBlur={() => handleFieldBlur("allowance")}
              placeholder="0"
              placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
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

        <View
          onLayout={(e) => {
            categoriesSectionY.current = e.nativeEvent.layout.y;
          }}
          style={styles.budgetSectionGroup}
        >
          <Text style={[styles.fieldLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
            CATEGORY BUDGETS
          </Text>

          <View
            onLayout={(e) => {
              cardInsideSectionY.current = e.nativeEvent.layout.y;
            }}
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
                  onLayout={(e) => {
                    rowOffsets.current[category] = e.nativeEvent.layout.y;
                    rowHeights.current[category] = e.nativeEvent.layout.height;
                  }}
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
                      onFocus={() => handleCategoryFocus(category)}
                      onBlur={() => handleFieldBlur(category)}
                      placeholder="0"
                      placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      selectTextOnFocus
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Dynamic keyboard spacer: 0 when no keyboard, 280 only when editing */}
        <Animated.View style={animatedSpacerStyle} />
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

const styles = StyleSheet.create({
  budgetSectionGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  allowanceInputBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 8,
  },
  allowancePrefix: {
    fontSize: 20,
    fontWeight: "700",
  },
  allowanceInput: {
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
  allocationStatusBlock: {
    gap: 6,
    paddingHorizontal: 2,
  },
  allocationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  allocationMetaText: {
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  allocationRemainingText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  budgetUnifiedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
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
    fontSize: 13.5,
    fontWeight: "700",
  },
  categoryInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    width: 100,
  },
  categoryInputPrefix: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryNumericInput: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  budgetStickyBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  budgetSaveCta: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetSaveCtaText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
