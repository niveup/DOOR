import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FinanceCategory } from "@/src/types/domain";
import { CATEGORY_TOKENS } from "@/src/components/finance/FinanceConstants";

export interface CategoryIconBadgeProps {
  category: FinanceCategory;
  isDark: boolean;
  customIcon?: keyof typeof Ionicons.glyphMap;
}

export function CategoryIconBadge({
  category,
  isDark,
  customIcon,
}: CategoryIconBadgeProps) {
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

const styles = StyleSheet.create({
  categoryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
