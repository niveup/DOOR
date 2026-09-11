import React, { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSegments } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@/src/components/app-icon";
import { useTheme } from "@/src/providers/theme-provider";
import { TabPagerLockContext } from "@/src/components/tab-pager-context";
import TodayScreen from "@/app/(tabs)/index";
import FinanceScreen from "@/app/(tabs)/finance";
import StudyScreen from "@/app/(tabs)/study";
import ProfileScreen from "@/app/(tabs)/profile";

const PAGES = [
  { key: "index", title: "Today" },
  { key: "finance", title: "Cashflow" },
  { key: "study", title: "GATE" },
  { key: "profile", title: "More" },
] as const;

const tabIcons: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  index: { active: "checkbox", inactive: "checkbox-outline" },
  finance: { active: "wallet", inactive: "wallet-outline" },
  study: { active: "book", inactive: "book-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

function initialIndex(segments: string[]): number {
  const last = segments[segments.length - 1] || "";
  const idx = PAGES.findIndex((p) => p.key === last);
  return idx >= 0 ? idx : 0;
}

const MemoTodayScreen = React.memo(TodayScreen);
const MemoFinanceScreen = React.memo(FinanceScreen);
const MemoStudyScreen = React.memo(StudyScreen);
const MemoProfileScreen = React.memo(ProfileScreen);

export function TabPager() {
  const { theme, isDark } = useTheme();
  const segments = useSegments();
  const startAt = useRef(initialIndex(segments as unknown as string[])).current;
  const [active, setActive] = useState(startAt);
  const [, setLocked] = useState(false);
  const interceptRef = useRef<(() => boolean) | null>(null);

  const lockApi = useMemo(
    () => ({
      setLocked,
      setIntercept: (fn: (() => boolean) | null) => {
        interceptRef.current = fn;
      },
    }),
    []
  );

  const go = (index: number) => {
    if (index === active) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActive(index);
  };

  const activeColor = isDark ? "#10b981" : "#059669";
  const inactiveColor = isDark ? "#71717a" : theme.textFaint;

  return (
    <TabPagerLockContext.Provider value={lockApi}>
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <View style={styles.flex}>
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { display: active === 0 ? "flex" : "none" },
            ]}
          >
            <MemoTodayScreen />
          </View>
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { display: active === 1 ? "flex" : "none" },
            ]}
          >
            <MemoFinanceScreen />
          </View>
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { display: active === 2 ? "flex" : "none" },
            ]}
          >
            <MemoStudyScreen />
          </View>
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { display: active === 3 ? "flex" : "none" },
            ]}
          >
            <MemoProfileScreen />
          </View>
        </View>

        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: isDark ? "#09090b" : "#ffffff",
              borderTopColor: isDark ? "#18181b" : "#e2e8f0",
            },
          ]}
        >
          {PAGES.map((page, i) => {
            const focused = i === active;
            const icons = tabIcons[page.key];
            const color = focused ? activeColor : inactiveColor;
            return (
              <Pressable
                key={page.key}
                onPress={() => go(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={page.title}
                style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.65 }]}
              >
                <View
                  style={[
                    styles.tabIconBox,
                    focused && {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.16)"
                        : "#ECFDF5",
                      borderColor: isDark
                        ? "rgba(16, 185, 129, 0.32)"
                        : "#A7F3D0",
                    },
                  ]}
                >
                  <Ionicons
                    name={focused ? icons.active : icons.inactive}
                    color={color}
                    size={20}
                  />
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color,
                      fontWeight: focused ? "700" : "500",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {page.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </TabPagerLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    height: Platform.select({ ios: 86, default: 68 }),
    paddingTop: 7,
    paddingBottom: Platform.select({ ios: 25, default: 9 }),
    borderTopWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabIconBox: {
    width: 42,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
    marginTop: 2,
  },
});
