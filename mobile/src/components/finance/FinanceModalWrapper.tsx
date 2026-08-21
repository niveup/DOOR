import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";

export function SwipeHintBanner({ isDark }: { isDark: boolean }) {
  const [visible, setVisible] = useState(false);
  const opacity = useSharedValue(0);

  const dismissBanner = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem("door_swipe_hint_dismissed_v5", "true").catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("door_swipe_hint_dismissed_v5").then((val) => {
      if (!val) {
        setVisible(true);
        opacity.value = withTiming(1, { duration: 250 });
        const timer = setTimeout(() => {
          opacity.value = withTiming(0, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(dismissBanner)();
            }
          });
        }, 4500);
        return () => clearTimeout(timer);
      }
    });
  }, [dismissBanner]);

  const handleManualDismiss = () => {
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(dismissBanner)();
      }
    });
  };

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.swipeHintBar,
        {
          backgroundColor: isDark ? "#18181E" : "#f1f5f9",
          borderColor: isDark ? "#282832" : "#e2e8f0",
        },
        animStyle,
      ]}
    >
      <Ionicons name="arrow-down" size={12} color="#38BDF8" />
      <Text style={[styles.swipeHintBarText, { color: isDark ? "#A1A1AA" : "#64748b" }]}>
        Swipe down from top anytime to dismiss
      </Text>
      <Pressable onPress={handleManualDismiss} hitSlop={8} style={{ padding: 2 }}>
        <Ionicons name="close" size={13} color={isDark ? "#71717A" : "#94a3b8"} />
      </Pressable>
    </Animated.View>
  );
}

export interface FinanceModalWrapperProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: (props: {
    scrollHandler: any;
    contentContainerStyle: any;
  }) => React.ReactNode;
}

export function FinanceModalWrapper({
  visible,
  onClose,
  title,
  subtitle,
  action,
  children,
}: FinanceModalWrapperProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDraggingSheet = useSharedValue(false);

  useEffect(() => {
    if (visible) {
      scrollY.value = 0;
      translateY.value = 0;
      isDraggingSheet.value = false;
    }
  }, [visible]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const contentPanGesture = Gesture.Pan()
    .activeOffsetY([10, 100000])
    .failOffsetY([-100000, -1])
    .onUpdate((event) => {
      "worklet";
      if (scrollY.value <= 1 && event.translationY > 0) {
        isDraggingSheet.value = true;
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (isDraggingSheet.value) {
        isDraggingSheet.value = false;
        if (translateY.value > 130 && event.velocityY > -50) {
          translateY.value = withTiming(900, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(onClose)();
            }
          });
        } else {
          translateY.value = withSpring(0, {
            damping: 24,
            stiffness: 260,
            mass: 0.8,
          });
        }
      }
    });

  const headerPanGesture = Gesture.Pan()
    .activeOffsetY([6, 100000])
    .failOffsetY([-100000, -1])
    .onUpdate((event) => {
      "worklet";
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (translateY.value > 120 && event.velocityY > -50) {
        translateY.value = withTiming(900, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
      } else {
        translateY.value = withSpring(0, {
          damping: 24,
          stiffness: 260,
          mass: 0.8,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: Math.max(0, translateY.value) }],
    };
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.viewAllBackdrop}>
        <Animated.View
          style={[
            styles.viewAllContainer,
            {
              backgroundColor: isDark ? "#08080A" : "#f8fafc",
            },
            animatedStyle,
          ]}
        >
          {/* Header with HeaderPanGesture */}
          <GestureDetector gesture={headerPanGesture}>
            <View
              style={[
                styles.detailHeaderArea,
                {
                  paddingTop: Math.max(insets.top, 14),
                  borderBottomColor: isDark ? "#18181D" : "#e2e8f0",
                  backgroundColor: isDark ? "#08080A" : "#f8fafc",
                },
              ]}
            >
              {/* Drag Handle Bar */}
              <View style={styles.sheetDragHandleWrapper}>
                <View
                  style={[
                    styles.sheetDragHandleBar,
                    { backgroundColor: isDark ? "#3f3f46" : "#cbd5e1" },
                  ]}
                />
              </View>

              <View style={styles.detailHeaderTop}>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [styles.detailBackButton, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="arrow-back" size={18} color={isDark ? "#F5F5F7" : theme.text} />
                  <Text style={[styles.detailHeaderTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>
                    {title}
                  </Text>
                </Pressable>
                {action}
              </View>

              {subtitle ? (
                <Text style={[styles.detailHeaderSubtitle, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  {subtitle}
                </Text>
              ) : null}

              <SwipeHintBanner isDark={isDark} />
            </View>
          </GestureDetector>

          {/* Content with ContentPanGesture (simultaneous with inner scroll) */}
          <GestureDetector gesture={contentPanGesture}>
            <View style={{ flex: 1 }}>
              {children({
                scrollHandler,
                contentContainerStyle: [
                  styles.detailScrollBody,
                  { paddingBottom: insets.bottom + 40 },
                ],
              })}
            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewAllBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  viewAllContainer: {
    flex: 1,
  },
  sheetDragHandleWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  sheetDragHandleBar: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
  },
  detailHeaderArea: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  detailHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  detailHeaderSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    paddingLeft: 26,
  },
  detailScrollBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },
  swipeHintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  swipeHintBarText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
