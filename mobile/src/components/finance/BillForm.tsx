import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@/src/components/app-icon";
import { useTheme } from "@/src/providers/theme-provider";
import { todayInKolkata } from "@/src/lib/format";
import { FinanceCategory } from "@/src/types/domain";
import { SEMANTIC } from "@/src/components/finance/FinanceConstants";
import { CategoryPicker } from "@/src/components/finance/CategoryPicker";
import { radii } from "@/src/theme/tokens";

export interface BillFormProps {
  onSave: (val: {
    title: string;
    amount: string;
    category: FinanceCategory;
    date: string;
  }) => void;
  onClose: () => void;
  busy: boolean;
}

export function BillForm({ onSave, onClose, busy }: BillFormProps) {
  const { theme, isDark } = useTheme();
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "Subscriptions" as FinanceCategory,
    date: todayInKolkata(),
  });

  const translateY = useSharedValue(0);
  const subtitleHeight = useSharedValue(18);
  const subtitleOpacity = useSharedValue(1);
  const isShiftedRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [extraBottomPadding, setExtraBottomPadding] = useState(0);

  const shiftUpward = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    isShiftedRef.current = true;
    translateY.value = withTiming(-42, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    subtitleHeight.value = withTiming(0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    subtitleOpacity.value = withTiming(0, {
      duration: 180,
    });
    setExtraBottomPadding(Platform.OS === "android" ? 220 : 160);
  };

  const resetDownward = () => {
    isShiftedRef.current = false;
    translateY.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    subtitleHeight.value = withTiming(18, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    subtitleOpacity.value = withTiming(1, {
      duration: 220,
    });
    setExtraBottomPadding(0);
  };

  const handleBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      resetDownward();
    }, 120);
  };

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      shiftUpward();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      resetDownward();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const animatedFieldsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedSubtitleStyle = useAnimatedStyle(() => ({
    height: subtitleHeight.value,
    opacity: subtitleOpacity.value,
    overflow: "hidden",
  }));

  return (
    <View style={[styles.formContainer, { paddingBottom: extraBottomPadding }]}>
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

      <Animated.View style={animatedSubtitleStyle}>
        <Text style={[styles.sheetSubtitle, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
          Track upcoming recurring payments.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.fieldsContainer, animatedFieldsStyle]}>
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
            onFocus={shiftUpward}
            onBlur={handleBlur}
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
            onFocus={shiftUpward}
            onBlur={handleBlur}
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
            {busy ? "Saving..." : "Schedule Bill"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 18,
    fontWeight: "800",
  },
  sheetSubtitle: {
    fontSize: 12.5,
    marginTop: -4,
  },
  fieldsContainer: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  sheetTextInput: {
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitSheetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 4,
  },
  submitSheetText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
