import { Tabs } from "expo-router";
import { Ionicons } from "@/src/components/app-icon";
import { Platform, StyleSheet, View } from "react-native";
import { useTheme } from "@/src/providers/theme-provider";

const tabIcons: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  index: { active: "checkbox", inactive: "checkbox-outline" },
  finance: { active: "wallet", inactive: "wallet-outline" },
  study: { active: "book", inactive: "book-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

function TabIcon({
  routeName,
  color,
  focused,
  isDark,
}: {
  routeName: string;
  color: string;
  focused: boolean;
  isDark: boolean;
}) {
  const icons = tabIcons[routeName];

  return (
    <View
      style={[
        styles.tabIcon,
        focused && [
          styles.tabIconActive,
          {
            backgroundColor: isDark ? "rgba(24, 184, 135, 0.17)" : "#ECFDF5",
            borderColor: isDark ? "rgba(78, 211, 166, 0.2)" : "#A7F3D0",
          },
        ],
      ]}
    >
      <Ionicons name={focused ? icons.active : icons.inactive} color={color} size={20} />
    </View>
  );
}

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
            backgroundColor: isDark ? "#09090b" : "#ffffff",
            borderTopColor: isDark ? "#222226" : "#e2e8f0",
            shadowColor: isDark ? "#000000" : "#64748b",
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 10,
            elevation: 8,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, focused }) => (
          <TabIcon routeName={route.name} color={color} focused={focused} isDark={isDark} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="finance" options={{ title: "Cashflow" }} />
      <Tabs.Screen name="study" options={{ title: "GATE" }} />
      <Tabs.Screen name="profile" options={{ title: "More" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.select({ ios: 86, default: 68 }),
    paddingTop: 7,
    paddingBottom: Platform.select({ ios: 25, default: 9 }),
    borderTopWidth: 1,
  },
  tabItem: {
    borderRadius: 14,
  },
  tabIcon: {
    width: 34,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabIconActive: {
    shadowColor: "#18B887",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.1,
    marginTop: 3,
  },
});
