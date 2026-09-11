import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
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

const PILL_WIDTH = 42;
const PILL_HEIGHT = 30;

interface TabButtonProps {
  index: number;
  page: (typeof PAGES)[number];
  width: number;
  scrollX: SharedValue<number>;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
}

const TabButton = React.memo(function TabButton({
  index,
  page,
  width,
  scrollX,
  onPress,
  activeColor,
  inactiveColor,
}: TabButtonProps) {
  const icons = tabIcons[page.key];

  const activeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={page.title}
      style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.65 }]}
    >
      <View style={styles.tabContentContainer}>
        {/* Inactive base */}
        <View style={styles.tabIconBox}>
          <Ionicons name={icons.inactive} color={inactiveColor} size={20} />
        </View>
        <Text
          style={[styles.tabLabel, { color: inactiveColor, fontWeight: "500" }]}
          numberOfLines={1}
        >
          {page.title}
        </Text>

        {/* Active cross-fade layer on UI thread */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, styles.tabContentContainer, activeOverlayStyle]}
        >
          <View style={styles.tabIconBox}>
            <Ionicons name={icons.active} color={activeColor} size={20} />
          </View>
          <Text
            style={[styles.tabLabel, { color: activeColor, fontWeight: "700" }]}
            numberOfLines={1}
          >
            {page.title}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
});

export function TabPager() {
  const { theme, isDark } = useTheme();
  const segments = useSegments();
  const startAt = useRef(initialIndex(segments as unknown as string[])).current;
  const [active, setActive] = useState(startAt);
  const activeRef = useRef(active);
  activeRef.current = active;

  const [locked, setLocked] = useState(false);
  const interceptRef = useRef<(() => boolean) | null>(null);
  const pagerRef = useRef<Animated.ScrollView>(null);

  const width = Dimensions.get("window").width || 375;
  const tabWidth = width / PAGES.length;

  const scrollX = useSharedValue(startAt * width);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const lockApi = useMemo(
    () => ({
      setLocked,
      setIntercept: (fn: (() => boolean) | null) => {
        interceptRef.current = fn;
      },
    }),
    []
  );

  useEffect(() => {
    if (startAt > 0) {
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({ x: startAt * width, animated: false });
      });
    }
  }, [width, startAt]);

  const go = (index: number) => {
    if (index === activeRef.current) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    activeRef.current = index;
    setActive(index);
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const syncActivePage = (x: number) => {
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
    syncActivePage(e.nativeEvent.contentOffset.x);
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncActivePage(e.nativeEvent.contentOffset.x);
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

  const indicatorStyle = useAnimatedStyle(() => {
    const translateX = (scrollX.value / width) * tabWidth;
    return {
      transform: [{ translateX }],
    };
  });

  const scrollElement = (
    <Animated.ScrollView
      ref={pagerRef}
      horizontal
      pagingEnabled={false}
      snapToInterval={width}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum={true}
      scrollEventThrottle={16}
      onScroll={scrollHandler}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onScrollEndDrag={handleScrollEndDrag}
      showsHorizontalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      scrollEnabled={!locked}
      keyboardShouldPersistTaps="handled"
      style={styles.flex}
    >
      <View style={{ width, height: "100%" }}>
        <MemoTodayScreen />
      </View>
      <View style={{ width, height: "100%" }}>
        <MemoFinanceScreen />
      </View>
      <View style={{ width, height: "100%" }}>
        <MemoStudyScreen />
      </View>
      <View style={{ width, height: "100%" }}>
        <MemoProfileScreen />
      </View>
    </Animated.ScrollView>
  );

  return (
    <TabPagerLockContext.Provider value={lockApi}>
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        {locked ? (
          <GestureDetector gesture={pan}>
            <View style={styles.flex}>{scrollElement}</View>
          </GestureDetector>
        ) : (
          <View style={styles.flex}>{scrollElement}</View>
        )}

        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: isDark ? "#09090b" : "#ffffff",
              borderTopColor: isDark ? "#18181b" : "#e2e8f0",
            },
          ]}
        >
          {/* Real-time hardware-accelerated sliding green pill */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicatorPill,
              {
                left: (tabWidth - PILL_WIDTH) / 2,
                backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#ECFDF5",
                borderColor: isDark ? "rgba(16, 185, 129, 0.32)" : "#A7F3D0",
              },
              indicatorStyle,
            ]}
          />

          {PAGES.map((page, i) => (
            <TabButton
              key={page.key}
              index={i}
              page={page}
              width={width}
              scrollX={scrollX}
              onPress={() => go(i)}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
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
    height: Platform.select({ ios: 86, default: 68 }),
    paddingTop: 7,
    paddingBottom: Platform.select({ ios: 25, default: 9 }),
    borderTopWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabContentContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconBox: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  indicatorPill: {
    position: "absolute",
    top: 7,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
  },
});
