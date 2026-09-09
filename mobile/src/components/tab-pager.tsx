import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSegments } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
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

interface TabButtonProps {
  page: (typeof PAGES)[number];
  index: number;
  focused: boolean;
  onPress: () => void;
  isDark: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}

function TabButton({
  page,
  focused,
  onPress,
  isDark,
  theme,
}: TabButtonProps) {
  const icons = tabIcons[page.key];
  const activeColor = isDark ? "#10b981" : "#059669";
  const inactiveColor = isDark ? "#71717a" : theme.textFaint;

  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(0.85, { duration: 60 }),
        withSpring(1, { damping: 14, stiffness: 220 })
      );
    } else {
      scale.value = withTiming(1, { duration: 90 });
    }
  }, [focused]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={page.title}
      style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.tabIconBox}>
        {focused ? (
          <View
            style={[
              styles.tabIconGlow,
              {
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.14)"
                  : "rgba(5, 150, 105, 0.10)",
              },
            ]}
          />
        ) : null}
        <Animated.View style={animatedIconStyle}>
          <Ionicons
            name={focused ? icons.active : icons.inactive}
            color={focused ? activeColor : inactiveColor}
            size={22}
          />
        </Animated.View>
      </View>

      <Text
        style={[
          styles.tabLabel,
          {
            color: focused ? activeColor : inactiveColor,
            fontWeight: focused ? "700" : "500",
          },
        ]}
        numberOfLines={1}
      >
        {page.title}
      </Text>
    </Pressable>
  );
}

export function TabPager() {
  const { theme, isDark } = useTheme();
  const segments = useSegments();
  const startAt = useRef(initialIndex(segments as unknown as string[])).current;
  const [active, setActive] = useState(startAt);
  const [locked, setLocked] = useState(false);
  const interceptRef = useRef<(() => boolean) | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth > 0 ? windowWidth : 375;

  const translateX = useSharedValue(-startAt * width);
  const startX = useSharedValue(-startAt * width);

  useEffect(() => {
    translateX.value = -active * width;
  }, [width]);

  const lockApi = useMemo(
    () => ({
      setLocked,
      setIntercept: (fn: (() => boolean) | null) => {
        interceptRef.current = fn;
      },
    }),
    []
  );

  const syncActiveTab = (index: number) => {
    setActive(index);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const go = (index: number) => {
    if (index === active) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActive(index);
    translateX.value = withSpring(-index * width, {
      damping: 26,
      stiffness: 240,
      mass: 0.6,
      overshootClamping: false,
    });
  };

  const dismiss = () => {
    try {
      interceptRef.current?.();
    } catch {}
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .enabled(!locked)
    .onStart(() => {
      "worklet";
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      "worklet";
      const rawX = startX.value + e.translationX;
      const minX = -(PAGES.length - 1) * width;
      const maxX = 0;

      if (rawX > maxX) {
        // High-end rubberband resistance at left boundary
        translateX.value = maxX + (rawX - maxX) * 0.28;
      } else if (rawX < minX) {
        // High-end rubberband resistance at right boundary
        translateX.value = minX + (rawX - minX) * 0.28;
      } else {
        translateX.value = rawX;
      }
    })
    .onEnd((e) => {
      "worklet";
      const currentPos = -translateX.value;
      const progress = currentPos / width;
      const velocity = -e.velocityX;

      // Inertial snapping with gesture fling velocity
      let target = Math.round(progress);
      if (velocity > 350 && progress > target - 0.45) {
        target = Math.ceil(progress);
      } else if (velocity < -350 && progress < target + 0.45) {
        target = Math.floor(progress);
      }

      target = Math.max(0, Math.min(PAGES.length - 1, target));

      translateX.value = withSpring(
        -target * width,
        {
          damping: 25,
          stiffness: 230,
          mass: 0.55,
          velocity: -velocity,
          overshootClamping: false,
        },
        (finished) => {
          if (finished) {
            runOnJS(syncActiveTab)(target);
          }
        }
      );
    });

  const dismissPanGesture = Gesture.Pan()
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

  const composedGesture = Gesture.Race(panGesture, dismissPanGesture);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const tabWidth = width / PAGES.length;
  const indicatorWidth = 32;
  const indicatorOffset = (tabWidth - indicatorWidth) / 2;

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const progress = -translateX.value / (width || 1);
    const clamped = Math.max(0, Math.min(PAGES.length - 1, progress));
    const tx = indicatorOffset + clamped * tabWidth;
    return {
      transform: [{ translateX: tx }],
    };
  });

  return (
    <TabPagerLockContext.Provider value={lockApi}>
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <GestureDetector gesture={composedGesture}>
          <View style={styles.flex}>
            <Animated.View
              style={[
                styles.pagesRow,
                { width: width * PAGES.length },
                containerAnimatedStyle,
              ]}
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
            </Animated.View>
          </View>
        </GestureDetector>

        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: isDark ? "#09090b" : "#ffffff",
              borderTopColor: isDark ? "#1f1f23" : "#e2e8f0",
              shadowColor: isDark ? "#000000" : "#64748b",
            },
          ]}
        >
          {/* Top glowing accent bar tracking swipe 1:1 */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.topIndicator,
              {
                width: indicatorWidth,
                backgroundColor: isDark ? "#10b981" : "#059669",
                shadowColor: isDark ? "#10b981" : "#059669",
              },
              indicatorAnimatedStyle,
            ]}
          />

          {PAGES.map((page, i) => (
            <TabButton
              key={page.key}
              page={page}
              index={i}
              focused={i === active}
              onPress={() => go(i)}
              isDark={isDark}
              theme={theme}
            />
          ))}
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
    overflow: "hidden",
  },
  pagesRow: {
    flex: 1,
    flexDirection: "row",
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    height: Platform.select({ ios: 86, default: 68 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 25, default: 9 }),
    borderTopWidth: 1,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  topIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 3,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  tabIconBox: {
    width: 44,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabIconGlow: {
    position: "absolute",
    width: 40,
    height: 28,
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.15,
    marginTop: 2,
  },
});
