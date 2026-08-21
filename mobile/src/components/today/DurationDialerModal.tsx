import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/providers/theme-provider";
import { layout, radii, shadows, spacing, typography } from "@/src/theme/tokens";

export const DIALER_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
];

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;

export interface DurationDialerModalProps {
  visible: boolean;
  initialMinutes: number;
  taskTitle?: string;
  onClose: () => void;
  onSave: (mins: number) => void;
}

export function DurationDialerModal({
  visible,
  initialMinutes,
  taskTitle,
  onClose,
  onSave,
}: DurationDialerModalProps) {
  const { theme, isDark } = useTheme();
  const [selectedMins, setSelectedMins] = useState(initialMinutes);
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);
  const lastIndex = useRef<number>(-1);

  // Compute nearest index in DIALER_OPTIONS
  const initialIndex = useMemo(() => {
    const exact = DIALER_OPTIONS.indexOf(initialMinutes);
    if (exact !== -1) return exact;
    let closest = 0;
    let minDiff = 9999;
    DIALER_OPTIONS.forEach((val, idx) => {
      const diff = Math.abs(val - initialMinutes);
      if (diff < minDiff) {
        minDiff = diff;
        closest = idx;
      }
    });
    return closest;
  }, [initialMinutes]);

  useEffect(() => {
    if (visible) {
      setSelectedMins(initialMinutes);
      lastIndex.current = initialIndex;
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: initialIndex * ITEM_HEIGHT,
          animated: false,
        });
      }, 40);
      return () => clearTimeout(t);
    }
  }, [visible, initialMinutes, initialIndex]);

  const updateSelectionFromOffset = (offsetY: number) => {
    const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(DIALER_OPTIONS.length - 1, rawIdx));
    if (clampedIdx !== lastIndex.current) {
      lastIndex.current = clampedIdx;
      setSelectedMins(DIALER_OPTIONS[clampedIdx]);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isUserScrolling.current) return;
    updateSelectionFromOffset(e.nativeEvent.contentOffset.y);
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScrolling.current = false;
    updateSelectionFromOffset(e.nativeEvent.contentOffset.y);
  };

  const handleItemPress = (index: number) => {
    Haptics.selectionAsync().catch(() => {});
    lastIndex.current = index;
    setSelectedMins(DIALER_OPTIONS[index]);
    scrollRef.current?.scrollTo({
      y: index * ITEM_HEIGHT,
      animated: true,
    });
  };

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: isDark ? "#121216" : theme.surfaceElevated,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Header Bar */}
          <View style={[styles.topBar, { borderBottomColor: theme.borderMuted }]}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.barBtn}>
              <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
            </Pressable>

            <Text
              style={[styles.headerTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {taskTitle || "Target Duration"}
            </Text>

            <Pressable
              onPress={() => onSave(selectedMins)}
              hitSlop={10}
              style={styles.barBtn}
            >
              <Text style={[styles.doneText, { color: theme.accent }]}>Done</Text>
            </Pressable>
          </View>

          {/* Current Selection Indicator */}
          <View style={styles.valueRow}>
            <View
              style={[
                styles.selectedPill,
                {
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(5, 150, 105, 0.08)",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(5, 150, 105, 0.2)",
                },
              ]}
            >
              <Ionicons name="time-outline" size={14} color={theme.accent} />
              <Text style={[styles.selectedPillText, { color: theme.accent }]}>
                {selectedMins} min
              </Text>
            </View>
          </View>

          {/* 5-Slot Wheel Frame */}
          <View
            style={[
              styles.wheelFrame,
              {
                backgroundColor: isDark ? "#09090c" : theme.canvas,
                borderColor: theme.borderMuted,
              },
            ]}
          >
            {/* Center Selection Lens */}
            <View
              style={[
                styles.centerLens,
                {
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(5, 150, 105, 0.06)",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(5, 150, 105, 0.2)",
                },
              ]}
              pointerEvents="none"
            />

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              snapToAlignment="start"
              decelerationRate="fast"
              onScrollBeginDrag={() => {
                isUserScrolling.current = true;
              }}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              onScrollEndDrag={handleMomentumScrollEnd}
              scrollEventThrottle={32}
              contentContainerStyle={{
                paddingVertical: ITEM_HEIGHT * 2,
              }}
            >
              {DIALER_OPTIONS.map((mins, idx) => {
                const isSelected = mins === selectedMins;
                return (
                  <Pressable
                    key={mins}
                    onPress={() => handleItemPress(idx)}
                    style={styles.itemRow}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        { color: theme.textFaint },
                        isSelected && [
                          styles.itemTextSelected,
                          { color: isDark ? "#ffffff" : theme.text },
                        ],
                      ]}
                    >
                      {mins} min
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    zIndex: 10000,
  },
  cardContainer: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radii.xxl,
    borderWidth: 1,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    ...shadows.lg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs + 2,
  },
  barBtn: {
    paddingHorizontal: spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  cancelText: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  headerTitle: {
    ...typography.subheading,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: spacing.xxs,
  },
  doneText: {
    ...typography.bodySmall,
    fontWeight: "800",
  },
  valueRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  selectedPillText: {
    ...typography.bodySmall,
    fontWeight: "700",
  },
  wheelFrame: {
    height: ITEM_HEIGHT * VISIBLE_COUNT,
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.md,
    borderWidth: 1,
  },
  centerLens: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: spacing.xxs + 2,
    right: spacing.xxs + 2,
    height: ITEM_HEIGHT,
    borderRadius: radii.control,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 1,
  },
  itemRow: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    ...typography.body,
    fontVariant: ["tabular-nums"],
  },
  itemTextSelected: {
    ...typography.subheading,
    fontWeight: "800",
  },
});
