import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@/src/components/app-icon";
import { useTheme } from "@/src/providers/theme-provider";
import { fontWeights, radii, shadows, spacing, typography } from "@/src/theme/tokens";

export const HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const ROW_HEIGHT = 50;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS; // 250px

export interface DurationDialerModalProps {
  visible: boolean;
  initialMinutes: number;
  taskTitle?: string;
  onClose: () => void;
  onSave: (mins: number) => void;
}

// ---------------------------------------------------------------------------
// Single 3D Wheel Item: Interpolates Scale, Opacity & 3D Tilt in Native Worklet
// ---------------------------------------------------------------------------
interface WheelItemProps {
  item: number;
  index: number;
  scrollY: SharedValue<number>;
  rowHeight: number;
  isMinutes?: boolean;
  textColor: string;
  onPress: (index: number) => void;
}

const WheelItem = React.memo(function WheelItem({
  item,
  index,
  scrollY,
  rowHeight,
  isMinutes,
  textColor,
  onPress,
}: WheelItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 2) * rowHeight,
      (index - 1) * rowHeight,
      index * rowHeight,
      (index + 1) * rowHeight,
      (index + 2) * rowHeight,
    ];

    // Smooth continuous scale: center is large (1.18x), edges shrink to 0.72x
    const scale = interpolate(
      scrollY.value,
      inputRange,
      [0.72, 0.88, 1.18, 0.88, 0.72],
      Extrapolation.CLAMP
    );

    // Continuous brightness: center is pure 1.0, adjacent rows are 0.50, outer rows are 0.22
    const opacity = interpolate(
      scrollY.value,
      inputRange,
      [0.22, 0.50, 1.0, 0.50, 0.22],
      Extrapolation.CLAMP
    );

    // 3D cylindrical drum tilt: +36deg (below) -> 0deg (center) -> -36deg (above)
    const rotateX = interpolate(
      scrollY.value,
      inputRange,
      [36, 20, 0, -20, -36],
      Extrapolation.CLAMP
    );

    // Subtle foreshortening along the curved barrel
    const translateY = interpolate(
      scrollY.value,
      inputRange,
      [-4, -1, 0, 1, 4],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [
        { perspective: 500 },
        { translateY },
        { rotateX: `${rotateX}deg` },
        { scale },
      ],
    };
  });

  const formatted = isMinutes ? String(item).padStart(2, "0") : String(item);

  return (
    <Pressable
      onPress={() => onPress(index)}
      style={[styles.itemTouchArea, { height: rowHeight }]}
      hitSlop={{ top: 2, bottom: 2, left: 16, right: 16 }}
    >
      <Animated.View style={[styles.itemContent, animatedStyle]}>
        <Text style={[styles.numberText, { color: textColor }]}>
          {formatted}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Wheel Column Component: Smooth 60/120fps UI Thread Scroll & Micro Haptics
// ---------------------------------------------------------------------------
interface WheelColumnProps {
  items: number[];
  initialIndex: number;
  rowHeight: number;
  isMinutes?: boolean;
  textColor: string;
  onSelect: (value: number) => void;
}

const WheelColumn = React.memo(function WheelColumn({
  items,
  initialIndex,
  rowHeight,
  isMinutes,
  textColor,
  onSelect,
}: WheelColumnProps) {
  const scrollY = useSharedValue(initialIndex * rowHeight);
  const lastHapticIdx = useSharedValue(initialIndex);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const lastSettledIdx = useRef(initialIndex);
  const lastTickTime = useRef(0);

  const snapOffsets = useMemo(
    () => items.map((_, i) => i * rowHeight),
    [items, rowHeight]
  );

  // Sync scroll position when initialIndex changes or modal opens
  useEffect(() => {
    scrollY.value = initialIndex * rowHeight;
    lastHapticIdx.value = initialIndex;
    lastSettledIdx.current = initialIndex;
    scrollRef.current?.scrollTo({
      y: initialIndex * rowHeight,
      animated: false,
    });
  }, [initialIndex, rowHeight, scrollY, lastHapticIdx]);

  // Micro-haptic tick locked to wheel detents
  const triggerTick = useCallback(() => {
    const now = Date.now();
    if (now - lastTickTime.current > 35) {
      lastTickTime.current = now;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, []);

  // Real-time index change notification to parent for duration pill
  const handleIndexChange = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (clamped !== lastSettledIdx.current) {
        lastSettledIdx.current = clamped;
        onSelect(items[clamped]);
      }
    },
    [items, onSelect]
  );

  // Settled notification
  const handleSettled = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      lastSettledIdx.current = clamped;
      onSelect(items[clamped]);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    },
    [items, onSelect]
  );

  // Programmatic smooth snap to target row
  const snapTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      scrollRef.current?.scrollTo({
        y: clamped * rowHeight,
        animated: true,
      });
      handleSettled(clamped);
    },
    [items, rowHeight, handleSettled]
  );

  // UI-thread animated scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const currentIdx = Math.round(event.contentOffset.y / rowHeight);
      if (currentIdx !== lastHapticIdx.value) {
        lastHapticIdx.value = currentIdx;
        runOnJS(triggerTick)();
        runOnJS(handleIndexChange)(currentIdx);
      }
    },
    onMomentumEnd: (event) => {
      scrollY.value = event.contentOffset.y;
      const finalIdx = Math.round(event.contentOffset.y / rowHeight);
      runOnJS(handleSettled)(finalIdx);
    },
    onEndDrag: (event) => {
      scrollY.value = event.contentOffset.y;
      const velocityY = event.velocity?.y || 0;
      // If drag ends with low velocity, snap explicitly to avoid sticking midway
      if (Math.abs(velocityY) < 0.15) {
        const finalIdx = Math.round(event.contentOffset.y / rowHeight);
        runOnJS(snapTo)(finalIdx);
      }
    },
  });

  return (
    <View style={styles.columnWrapper}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        overScrollMode="never"
        bounces={false}
        nestedScrollEnabled={true}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: initialIndex * rowHeight }}
        contentContainerStyle={{
          paddingTop: rowHeight * 2,
          paddingBottom: rowHeight * 2,
        }}
      >
        {items.map((item, idx) => (
          <WheelItem
            key={item}
            item={item}
            index={idx}
            scrollY={scrollY}
            rowHeight={rowHeight}
            isMinutes={isMinutes}
            textColor={textColor}
            onPress={snapTo}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------
export function DurationDialerModal({
  visible,
  initialMinutes,
  taskTitle,
  onClose,
  onSave,
}: DurationDialerModalProps) {
  const { theme, isDark } = useTheme();

  // Parse initial minutes into hour & minute values
  const { initialH, initialM, initialHIdx, initialMIdx } = useMemo(() => {
    const raw = initialMinutes || 45;
    const h = Math.min(8, Math.max(0, Math.floor(raw / 60)));
    const m = Math.max(0, raw % 60);
    const roundedM = Math.min(55, Math.max(0, Math.round(m / 5) * 5));
    const hIdx = Math.max(0, HOURS.indexOf(h));
    const mIdx = Math.max(0, MINUTES.indexOf(roundedM));
    return { initialH: h, initialM: roundedM, initialHIdx: hIdx, initialMIdx: mIdx };
  }, [initialMinutes]);

  const [selectedHours, setSelectedHours] = useState(initialH);
  const [selectedMins, setSelectedMins] = useState(initialM);

  useEffect(() => {
    if (visible) {
      setSelectedHours(initialH);
      setSelectedMins(initialM);
    }
  }, [visible, initialH, initialM]);

  const totalCalculatedMinutes = selectedHours * 60 + selectedMins;

  const handleDone = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    // Minimum 5 minutes
    onSave(Math.max(5, totalCalculatedMinutes));
  };

  const numberColor = isDark ? "#ffffff" : theme.text;

  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss timer sheet"
        />

        {/* Bottom Sheet Card Container */}
        <View
          style={[
            styles.bottomSheetCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surfaceElevated,
              borderColor: isDark ? "#27272a" : theme.border,
            },
          ]}
        >
          {/* Sheet Drag Handle */}
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: isDark ? "#3f3f46" : "#cbd5e1" },
            ]}
          />

          {/* Top Action Bar: Cancel · Title · Done */}
          <View style={styles.sheetHeader}>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.cancelText, { color: theme.textMuted }]}>
                Cancel
              </Text>
            </Pressable>

            <View style={styles.titleCenter}>
              <Text
                style={[
                  styles.sheetTitle,
                  { color: isDark ? "#fafafa" : theme.text },
                ]}
                numberOfLines={1}
              >
                {taskTitle || "Timer Duration"}
              </Text>
            </View>

            <Pressable
              onPress={handleDone}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Done, set duration to ${totalCalculatedMinutes} minutes`}
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.doneText, { color: theme.accent }]}>
                Done
              </Text>
            </Pressable>
          </View>

          {/* Dual 3D Rolling Wheels Frame */}
          <View
            style={[
              styles.wheelOuterFrame,
              {
                backgroundColor: isDark ? "#09090c" : theme.surfaceSubtle,
                borderColor: isDark ? "#1f1f25" : theme.borderMuted,
              },
            ]}
          >
            {/* Center Focus Lens Bar spanning across both columns */}
            <View
              style={[
                styles.centerLensBar,
                {
                  top: ROW_HEIGHT * 2,
                  height: ROW_HEIGHT,
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(5, 150, 105, 0.06)",
                  borderColor: isDark
                    ? "rgba(16, 185, 129, 0.24)"
                    : "rgba(5, 150, 105, 0.18)",
                },
              ]}
              pointerEvents="none"
            >
              {/* Unit Label: Hours (Stationary next to active centered number) */}
              <View style={styles.lensColumn}>
                <Text
                  style={[
                    styles.lensUnitText,
                    styles.hoursUnitOffset,
                    { color: isDark ? theme.cyan : theme.accent },
                  ]}
                >
                  hours
                </Text>
              </View>

              {/* Unit Label: Min (Stationary next to active centered number) */}
              <View style={styles.lensColumn}>
                <Text
                  style={[
                    styles.lensUnitText,
                    styles.minsUnitOffset,
                    { color: isDark ? theme.cyan : theme.accent },
                  ]}
                >
                  min
                </Text>
              </View>
            </View>

            {/* Wheels Columns Row */}
            <View style={styles.wheelsColumnsRow}>
              {/* Hours Column */}
              <WheelColumn
                items={HOURS}
                initialIndex={initialHIdx}
                rowHeight={ROW_HEIGHT}
                textColor={numberColor}
                onSelect={setSelectedHours}
              />

              {/* Minutes Column */}
              <WheelColumn
                items={MINUTES}
                initialIndex={initialMIdx}
                rowHeight={ROW_HEIGHT}
                isMinutes={true}
                textColor={numberColor}
                onSelect={setSelectedMins}
              />
            </View>
          </View>

          {/* Real-time Duration Readout Pill */}
          <View style={styles.summaryFooter}>
            <View
              style={[
                styles.totalPill,
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.10)"
                    : "rgba(5, 150, 105, 0.08)",
                  borderColor: isDark
                    ? "rgba(16, 185, 129, 0.25)"
                    : "rgba(5, 150, 105, 0.18)",
                },
              ]}
            >
              <Ionicons name="time-outline" size={14} color={theme.accent} />
              <Text style={[styles.totalPillText, { color: theme.accent }]}>
                {selectedHours > 0
                  ? `${selectedHours} hr ${selectedMins} min`
                  : `${selectedMins} minutes`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  bottomSheetCard: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    ...shadows.lg,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxs,
    paddingBottom: spacing.xxs,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  cancelText: {
    ...typography.body,
    fontSize: 15,
    fontWeight: "500",
  },
  titleCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    ...typography.subheading,
    fontSize: 16,
    fontWeight: "700",
  },
  doneText: {
    ...typography.body,
    fontSize: 15,
    fontWeight: "800",
  },
  wheelOuterFrame: {
    height: WHEEL_HEIGHT,
    borderRadius: radii.xl,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  centerLensBar: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  lensColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  lensUnitText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  hoursUnitOffset: {
    position: "absolute",
    left: "50%",
    marginLeft: 22,
  },
  minsUnitOffset: {
    position: "absolute",
    left: "50%",
    marginLeft: 32,
  },
  wheelsColumnsRow: {
    flexDirection: "row",
    height: "100%",
  },
  columnWrapper: {
    flex: 1,
    height: "100%",
  },
  itemTouchArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  summaryFooter: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  totalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  totalPillText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: "700",
  },
});

