import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSegments } from "expo-router";
import * as Haptics from "expo-haptics";
import { runOnJS } from "react-native-reanimated";
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
];

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

export function TabPager() {
  const { theme, isDark } = useTheme();
  const segments = useSegments();
  const startAt = useRef(initialIndex(segments as unknown as string[])).current;
  const [active, setActive] = useState(startAt);
  const activeRef = useRef(active);
  activeRef.current = active;

  const [locked, setLocked] = useState(false);
  const interceptRef = useRef<(() => boolean) | null>(null);
  const pagerRef = useRef<ScrollView>(null);
  const width = Dimensions.get("window").width;

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
    if (index === activeRef.current) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    activeRef.current = index;
    setActive(index);
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    const clamped = Math.max(0, Math.min(PAGES.length - 1, i));
    if (clamped !== activeRef.current) {
      activeRef.current = clamped;
      setActive(clamped);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    const clamped = Math.max(0, Math.min(PAGES.length - 1, i));
    if (clamped !== activeRef.current) {
      activeRef.current = clamped;
      setActive(clamped);
    }
  };

  const dismiss = () => {
    try {
      interceptRef.current?.();
    } catch {}
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .maxPointers(1)
    .enabled(locked)
    .onEnd((e) => {
      const dx = e.translationX;
      const vx = e.velocityX;
      if (dx <= -110 || (dx <= -40 && vx <= -500) || dx >= 110 || (dx >= 40 && vx >= 500)) {
        runOnJS(dismiss)();
      }
    });

  const activeColor = isDark ? "#10b981" : "#059669";
  const inactiveColor = isDark ? "#71717a" : theme.textFaint;

  return (
    <TabPagerLockContext.Provider value={lockApi}>
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <GestureDetector gesture={pan}>
          <View style={styles.flex}>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              scrollEventThrottle={16}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              showsHorizontalScrollIndicator={false}
              bounces={Platform.OS === "ios"}
              overScrollMode="never"
              scrollEnabled={!locked}
              keyboardShouldPersistTaps="handled"
              contentOffset={{ x: startAt * width, y: 0 }}
              style={styles.flex}
            >
              <View style={{ width, height: "100%" }}>
                <TodayScreen />
              </View>
              <View style={{ width, height: "100%" }}>
                <FinanceScreen />
              </View>
              <View style={{ width, height: "100%" }}>
                <StudyScreen />
              </View>
              <View style={{ width, height: "100%" }}>
                <ProfileScreen />
              </View>
            </ScrollView>
          </View>
        </GestureDetector>

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
                    styles.tabIcon,
                    focused && {
                      backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#ECFDF5",
                      borderColor: isDark ? "rgba(16, 185, 129, 0.32)" : "#A7F3D0",
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
    borderRadius: 14,
  },
  tabIcon: {
    width: 38,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
    marginTop: 3,
  },
});
