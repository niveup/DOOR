import React, { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
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

  React.useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(0.86, { duration: 60 }),
        withSpring(1, { damping: 14, stiffness: 220 })
      );
    } else {
      scale.value = withTiming(1, { duration: 80 });
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
      <View
        style={[
          styles.tabIconBox,
          focused && {
            backgroundColor: isDark
              ? "rgba(16, 185, 129, 0.15)"
              : "rgba(5, 150, 105, 0.10)",
          },
        ]}
      >
        <Animated.View style={animatedIconStyle}>
          <Ionicons
            name={focused ? icons.active : icons.inactive}
            color={focused ? activeColor : inactiveColor}
            size={21}
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
  const pagerRef = useRef<ScrollView>(null);

  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth > 0 ? windowWidth : 375;

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
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
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

  return (
    <TabPagerLockContext.Provider value={lockApi}>
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <GestureDetector gesture={pan}>
          <View style={styles.flex}>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={Platform.OS === "ios"}
              overScrollMode="never"
              scrollEnabled={!locked}
              keyboardShouldPersistTaps="handled"
              contentOffset={{ x: startAt * width, y: 0 }}
              onMomentumScrollEnd={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / width);
                const clamped = Math.max(0, Math.min(PAGES.length - 1, i));
                if (clamped !== active) {
                  setActive(clamped);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }
              }}
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
              borderTopColor: isDark ? "#1a1a1e" : "#e2e8f0",
            },
          ]}
        >
          {PAGES.map((page, i) => (
            <TabButton
              key={page.key}
              page={page}
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
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    height: Platform.select({ ios: 84, default: 66 }),
    paddingTop: 6,
    paddingBottom: Platform.select({ ios: 24, default: 8 }),
    borderTopWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabIconBox: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
