import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/providers/theme-provider";
import { FinanceCategory, financeCategories } from "@/src/types/domain";
import { CATEGORY_TOKENS } from "@/src/components/finance/FinanceConstants";

export interface CategoryPickerProps {
  value: FinanceCategory;
  onChange: (category: FinanceCategory) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
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

const styles = StyleSheet.create({
  pickerContent: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
  },
});
