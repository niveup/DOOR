import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { useTheme } from "@/src/providers/theme-provider";

const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "grid-outline",
  finance: "wallet-outline",
  study: "school-outline",
  mentor: "sparkles-outline",
  profile: "person-circle-outline",
};

export default function TabLayout() {
  const { theme, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: isDark ? "#18B887" : "#059669",
        tabBarInactiveTintColor: isDark ? "#71717A" : theme.textFaint,
        tabBarStyle: [
          styles.tabBar,
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: isDark ? "#08080A" : "#ffffff",
            borderTopColor: isDark ? "#202025" : "#e2e8f0",
            shadowColor: isDark ? "#000000" : "#64748b",
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 10,
            elevation: 8,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, focused }) => (
          <Ionicons
            name={
              focused
                ? (tabIcons[route.name].replace("-outline", "") as keyof typeof Ionicons.glyphMap)
                : tabIcons[route.name]
            }
            color={color}
            size={22}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="finance" options={{ title: "Cashflow" }} />
      <Tabs.Screen name="study" options={{ title: "GATE" }} />
      <Tabs.Screen name="mentor" options={{ title: "Mentor" }} />
      <Tabs.Screen name="profile" options={{ title: "More" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.select({ ios: 82, default: 62 }),
    paddingTop: 6,
    paddingBottom: Platform.select({ ios: 24, default: 8 }),
    borderTopWidth: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
