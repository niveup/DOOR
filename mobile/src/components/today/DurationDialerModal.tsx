import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  SharedValue,
  SlideInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/providers/theme-provider";
import { typography } from "@/src/theme/tokens";

export const HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PRESETS = [15, 30, 60, 120];

const ROW_HEIGHT = 48;
const WHEEL_HEIGHT = ROW_HEIGHT * 5;

export interface DurationDialerModalProps {
  visible: boolean;
  initialMinutes: number;
  taskTitle?: string;
  onClose: () => void;
  onSave: (mins: number) => void;
}

interface WheelItemProps {
  item: number;
  index: number;
  scrollY: SharedValue<number>;
  color: string;
}

const WheelItem = React.memo(function WheelItem({ item, index, scrollY, color }: WheelItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = scrollY.value / ROW_HEIGHT - index;
    const abs = Math.abs(offset);
    const scale = interpolate(abs, [0, 1, 2], [1.12, 0.9, 0.8], Extrapolation.CLAMP);
    const opacity = interpolate(abs, [0, 1, 2.2], [1, 0.45, 0.18], Extrapolation.CLAMP);
    const translateY = interpolate(offset, [-2, 0, 2], [-6, 0, 6], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }, { scale }] };
  });
  return (
    <View style={[styles.item, { height: ROW_HEIGHT }]}>
      <Animated.View style={animatedStyle}>
        <Text style={[styles.number, { color }]}>{String(item).padStart(2, "0")}</Text>
      </Animated.View>
    </View>
  );
});

interface WheelColumnProps {
  items: number[];
  value: number;
  color: string;
  onSettle: (value: number) => void;
}

const WheelColumn = React.memo(function WheelColumn({ items, value, color, onSettle }: WheelColumnProps) {
  const targetIdx = Math.max(0, items.indexOf(value));
  const scrollY = useSharedValue(targetIdx * ROW_HEIGHT);
  const lastTick = useSharedValue(targetIdx);
  const ref = useRef<Animated.ScrollView>(null);
  const lastTickAt = useRef(0);
  const mounted = useRef(false);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  useEffect(() => {
    const idx = Math.max(0, items.indexOf(value));
    scrollY.value = idx * ROW_HEIGHT;
    lastTick.value = idx;
    ref.current?.scrollTo({ y: idx * ROW_HEIGHT, animated: mounted.current });
    mounted.current = true;
  }, [value]);

  const tick = useCallback(() => {
    const now = Date.now();
    if (now - lastTickAt.current < 70) return;
    lastTickAt.current = now;
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const settle = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      onSettleRef.current(items[clamped]);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    },
    [items]
  );

  const handler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const idx = Math.round(e.contentOffset.y / ROW_HEIGHT);
      if (idx !== lastTick.value) {
        lastTick.value = idx;
        runOnJS(tick)();
      }
    },
    onMomentumEnd: (e) => {
      scrollY.value = e.contentOffset.y;
      runOnJS(settle)(Math.round(e.contentOffset.y / ROW_HEIGHT));
    },
  });

  return (
    <View style={styles.column}>
      <Animated.ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={handler}
        contentContainerStyle={{ paddingTop: ROW_HEIGHT * 2, paddingBottom: ROW_HEIGHT * 2 }}
      >
        {items.map((item, idx) => (
          <WheelItem key={item} item={item} index={idx} scrollY={scrollY} color={color} />
        ))}
      </Animated.ScrollView>
    </View>
  );
});

export function DurationDialerModal({ visible, initialMinutes, taskTitle, onClose, onSave }: DurationDialerModalProps) {
  const { theme, isDark } = useTheme();

  const { initialH, initialM } = useMemo(() => {
    const raw = initialMinutes || 45;
    return {
      initialH: Math.min(8, Math.max(0, Math.floor(raw / 60))),
      initialM: Math.min(55, Math.max(0, Math.round((raw % 60) / 5) * 5)),
    };
  }, [initialMinutes]);

  const [hours, setHours] = useState(initialH);
  const [mins, setMins] = useState(initialM);

  useEffect(() => {
    if (visible) {
      setHours(initialH);
      setMins(initialM);
    }
  }, [visible, initialH, initialM]);

  const total = hours * 60 + mins;
  const display = hours <= 0 ? `${mins} min` : mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  const sub = hours <= 0 ? `${mins} minutes` : mins === 0 ? (hours === 1 ? "1 hour" : `${hours} hours`) : `${hours} hr ${mins} min`;

  const applyPreset = (p: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setHours(Math.floor(p / 60));
    setMins(p % 60);
  };

  const handleDone = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    onSave(Math.max(5, total === 0 ? 5 : total));
  };

  const numColor = isDark ? "#fafafa" : theme.text;
  const sheetBg = isDark ? "#141417" : "#ffffff";
  const hairline = isDark ? "#26262c" : "#e8edf3";

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(160)} style={StyleSheet.absoluteFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss duration picker" />
        </Animated.View>

        <Animated.View entering={SlideInDown.duration(240)} style={[styles.sheet, { backgroundColor: sheetBg }]}>
          <View style={[styles.handle, { backgroundColor: isDark ? "#3a3a41" : "#dbe2ea" }]} />

          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [pressed && { opacity: 0.55 }]}>
              <Text style={[styles.cancel, { color: theme.textMuted }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.title, { color: numColor }]} numberOfLines={1}>
              {taskTitle || "Duration"}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.readout}>
            <Text style={[styles.total, { color: numColor }]}>{display}</Text>
            <Text style={[styles.sub, { color: theme.textFaint }]}>{sub} of focus</Text>
          </View>

          <View style={styles.colHeads}>
            <Text style={[styles.colHead, { color: theme.textFaint }]}>Hours</Text>
            <Text style={[styles.colHead, { color: theme.textFaint }]}>Min</Text>
          </View>

          <View style={styles.wheelsWrap}>
            <View pointerEvents="none" style={[styles.lens, { backgroundColor: isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.05)" }]} />
            <View style={styles.cols}>
              <WheelColumn items={HOURS} value={hours} color={numColor} onSettle={setHours} />
              <WheelColumn items={MINUTES} value={mins} color={numColor} onSettle={setMins} />
            </View>
          </View>

          <View style={styles.presets}>
            {PRESETS.map((p) => {
              const active = total === p;
              const label = p >= 60 ? `${p / 60}h` : `${p}m`;
              return (
                <Pressable
                  key={p}
                  onPress={() => applyPreset(p)}
                  style={({ pressed }) => [styles.preset, active && { backgroundColor: theme.accentSoft }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.presetText, { color: active ? theme.accent : theme.textMuted }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [styles.cta, { backgroundColor: theme.accent }, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
          >
            <Text style={[styles.ctaText, { color: isDark ? "#09090b" : "#ffffff" }]}>Set · {display}</Text>
          </Pressable>
          <View style={[styles.hairline, { backgroundColor: hairline }]} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
    paddingBottom: 22,
    paddingHorizontal: 22,
    gap: 12,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  cancel: {
    ...typography.body,
    fontSize: 15,
    minWidth: 64,
  },
  title: {
    ...typography.subheading,
    fontSize: 15,
    fontWeight: "600",
    maxWidth: 200,
    textAlign: "center",
  },
  headerSpacer: {
    minWidth: 64,
  },
  readout: {
    alignItems: "center",
    gap: 2,
    paddingTop: 2,
  },
  total: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  sub: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  wheelsWrap: {
    height: WHEEL_HEIGHT,
    position: "relative",
    marginTop: 2,
  },
  lens: {
    position: "absolute",
    top: (WHEEL_HEIGHT - ROW_HEIGHT) / 2,
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    borderRadius: 14,
    zIndex: 1,
  },
  cols: {
    flexDirection: "row",
    height: "100%",
    zIndex: 2,
  },
  column: {
    flex: 1,
    height: "100%",
  },
  colHeads: {
    flexDirection: "row",
    marginBottom: -4,
  },
  colHead: {
    flex: 1,
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  presets: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  preset: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  presetText: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  cta: {
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 15,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  hairline: {
    height: 0,
  },
});
