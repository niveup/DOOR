import React, { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSegments } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
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

  // High-contrast monochromatic palette: crisp pure white in dark mode, deep obsidian in light mode
  const activeColor = isDark ? "#ffffff" : "#09090b";
  const inactiveColor = isDark ? "#71717a" : "#94a3b8";
  const bottomPadding = Math.max(insets.bottom, Platform.select({ ios: 20, default: 8 }));
  const barHeight = 54 + bottomPadding;

  return (
    <TabPagerLockContext.Provider value={lockApi}>
      <View style={[styles.root, { backgroundColor: isDark ? "#09090b" : "#f8fafc" }]}>
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
              height: barHeight,
              paddingBottom: bottomPadding,
              backgroundColor: isDark
                ? "rgba(9, 9, 11, 0.92)"
                : "rgba(255, 255, 255, 0.94)",
              borderTopColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : "rgba(0, 0, 0, 0.06)",
            },
          ]}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={85}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null}

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
                style={({ pressed }) => [
                  styles.tabItem,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                ]}
              >
                <View style={styles.tabIconContainer}>
                  <Ionicons
                    name={focused ? icons.active : icons.inactive}
                    color={color}
                    size={23}
                  />
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color,
                      fontWeight: focused ? "600" : "500",
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
    borderTopWidth: 1,
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  tabIconContainer: {
    width: 28,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.15,
    marginTop: 3,
  },
});
