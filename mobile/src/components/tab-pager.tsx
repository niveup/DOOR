import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSegments } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  translateX: SharedValue<number>;
  width: number;
  onPress: () => void;
  isDark: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}

function TabButton({
  page,
  index,
  translateX,
  width,
  onPress,
  isDark,
  theme,
}: TabButtonProps) {
  const icons = tabIcons[page.key];
  const activeColor = isDark ? "#18B887" : "#059669";
  const inactiveColor = isDark ? "#71717A" : theme.textFaint;

  const activeIconStyle = useAnimatedStyle(() => {
    const w = width > 0 ? width : 1;
    const progress = -translateX.value / w;
    const diff = Math.abs(progress - index);
    const opacity = interpolate(diff, [0, 0.55], [1, 0], Extrapolation.CLAMP);
    const scale = interpolate(diff, [0, 0.55], [1.06, 0.94], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const inactiveIconStyle = useAnimatedStyle(() => {
    const w = width > 0 ? width : 1;
    const progress = -translateX.value / w;
    const diff = Math.abs(progress - index);
    const opacity = interpolate(diff, [0, 0.55], [0, 1], Extrapolation.CLAMP);
    return {
      opacity,
    };
  });

  const activeLabelStyle = useAnimatedStyle(() => {
    const w = width > 0 ? width : 1;
    const progress = -translateX.value / w;
    const diff = Math.abs(progress - index);
    const opacity = interpolate(diff, [0, 0.5], [1, 0], Extrapolation.CLAMP);
    return {
      opacity,
    };
  });

  const inactiveLabelStyle = useAnimatedStyle(() => {
    const w = width > 0 ? width : 1;
    const progress = -translateX.value / w;
    const diff = Math.abs(progress - index);
    const opacity = interpolate(diff, [0, 0.5], [0, 1], Extrapolation.CLAMP);
    return {
      opacity,
    };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={page.title}
      style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.tabIcon}>
        <Animated.View style={[styles.tabIconLayer, inactiveIconStyle]}>
          <Ionicons name={icons.inactive} color={inactiveColor} size={20} />
        </Animated.View>
        <Animated.View style={[styles.tabIconLayer, activeIconStyle]}>
          <Ionicons name={icons.active} color={activeColor} size={20} />
        </Animated.View>
      </View>

      <View style={styles.tabLabelContainer}>
        <Animated.Text
          style={[styles.tabLabel, { color: inactiveColor }, inactiveLabelStyle]}
          numberOfLines={1}
        >
          {page.title}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.tabLabel,
            styles.tabLabelActiveOverlay,
            { color: activeColor },
            activeLabelStyle,
          ]}
          numberOfLines={1}
        >
          {page.title}
        </Animated.Text>
      </View>
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
        // Subtle, high-end rubberband resistance at left boundary
        translateX.value = maxX + (rawX - maxX) * 0.28;
      } else if (rawX < minX) {
        // Subtle, high-end rubberband resistance at right boundary
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

      // Inertial snapping with gesture fling velocity support
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
  const pillWidth = 38;
  const pillOffset = (tabWidth - pillWidth) / 2;

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const progress = -translateX.value / (width || 1);
    const clamped = Math.max(0, Math.min(PAGES.length - 1, progress));
    const tx = pillOffset + clamped * tabWidth;
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
              borderTopColor: isDark ? "#222226" : "#e2e8f0",
              shadowColor: isDark ? "#000000" : "#64748b",
            },
          ]}
        >
          {/* Real-time 120fps synchronized sliding pill indicator */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicatorPill,
              {
                width: pillWidth,
                backgroundColor: isDark ? "rgba(24, 184, 135, 0.17)" : "#ECFDF5",
                borderColor: isDark ? "rgba(78, 211, 166, 0.2)" : "#A7F3D0",
              },
              indicatorAnimatedStyle,
            ]}
          />

          {PAGES.map((page, i) => (
            <TabButton
              key={page.key}
              page={page}
              index={i}
              translateX={translateX}
              width={width}
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
    paddingTop: 7,
    paddingBottom: Platform.select({ ios: 25, default: 9 }),
    borderTopWidth: 1,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  indicatorPill: {
    position: "absolute",
    top: 7,
    left: 0,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: "#18B887",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
  },
  tabIcon: {
    width: 34,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabelContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  tabLabelActiveOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    textAlign: "center",
  },
});
