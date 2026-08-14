import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { colors } from "@/src/theme/tokens";
const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = { index: "grid-outline", finance: "wallet-outline", study: "school-outline", mentor: "sparkles-outline", profile: "person-circle-outline" };
export default function TabLayout() {
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.cyan, tabBarInactiveTintColor: colors.textFaint, tabBarStyle: styles.tabBar, tabBarLabelStyle: styles.tabLabel, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? tabIcons[route.name].replace("-outline", "") as keyof typeof Ionicons.glyphMap : tabIcons[route.name]} color={color} size={21} /> })}>
    <Tabs.Screen name="index" options={{ title: "Today" }} /><Tabs.Screen name="finance" options={{ title: "Cashflow" }} /><Tabs.Screen name="study" options={{ title: "GATE" }} /><Tabs.Screen name="mentor" options={{ title: "Mentor" }} /><Tabs.Screen name="profile" options={{ title: "More" }} />
  </Tabs>;
}
const styles = StyleSheet.create({ tabBar: { height: Platform.select({ ios: 88, default: 70 }), paddingTop: 8, paddingBottom: Platform.select({ ios: 25, default: 8 }), backgroundColor: colors.surface, borderTopColor: colors.borderMuted }, tabLabel: { fontSize: 10, fontWeight: "700" } });
