import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/src/components/app-icon";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/providers/theme-provider";
import { colors } from "@/src/theme/tokens";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "destructive" | "primary" | "warning";
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

type NotificationContextValue = {
  toast: (options: Omit<ToastItem, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (options: ConfirmOptions) => void;
  dismissToast: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useTheme();

  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, "id">) => {
      // Clear existing active timers to avoid overlap pile-ups
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();

      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      // Subtle haptic feedback
      try {
        if (type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === "error") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (type === "warning") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch {}

      // Keep only the most recent toast for a clean, non-cluttered display
      setToasts([newToast]);

      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  const success = useCallback((title: string, message?: string) => {
    showToast({ type: "success", title, message });
  }, [showToast]);

  const error = useCallback((title: string, message?: string) => {
    showToast({ type: "error", title, message });
  }, [showToast]);

  const warning = useCallback((title: string, message?: string) => {
    showToast({ type: "warning", title, message });
  }, [showToast]);

  const info = useCallback((title: string, message?: string) => {
    showToast({ type: "info", title, message });
  }, [showToast]);

  const confirm = useCallback((options: ConfirmOptions) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setConfirmDialog(options);
  }, []);

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
    } catch (e) {
      console.error("Confirm action error:", e);
    } finally {
      setConfirmBusy(false);
      setConfirmDialog(null);
    }
  };

  const handleCancelAction = () => {
    if (!confirmDialog) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    confirmDialog.onCancel?.();
    setConfirmDialog(null);
  };

  return (
    <NotificationContext.Provider
      value={{
        toast: showToast,
        success,
        error,
        warning,
        info,
        confirm,
        dismissToast,
      }}
    >
      {children}

      {/* Floating Notification Pill */}
      <View
        pointerEvents="box-none"
        style={[
          styles.toastContainer,
          { top: Math.max(insets.top + 8, Platform.OS === "android" ? 24 : 16) },
        ]}
      >
        {toasts.map((item) => {
          const typeColor =
            item.type === "success"
              ? colors.emerald
              : item.type === "error"
              ? colors.rose
              : item.type === "warning"
              ? colors.amber
              : colors.blue;

          const typeIcon: keyof typeof Ionicons.glyphMap =
            item.type === "success"
              ? "checkmark-circle"
              : item.type === "error"
              ? "alert-circle"
              : item.type === "warning"
              ? "warning"
              : "information-circle";

          const iconBg =
            item.type === "success"
              ? isDark
                ? "rgba(16, 185, 129, 0.14)"
                : "rgba(5, 150, 105, 0.10)"
              : item.type === "error"
              ? isDark
                ? "rgba(244, 63, 94, 0.14)"
                : "rgba(225, 29, 72, 0.10)"
              : item.type === "warning"
              ? isDark
                ? "rgba(245, 158, 11, 0.14)"
                : "rgba(217, 119, 6, 0.10)"
              : isDark
              ? "rgba(59, 130, 246, 0.14)"
              : "rgba(37, 99, 235, 0.10)";

          return (
            <Animated.View
              key={item.id}
              entering={FadeInUp.springify().damping(22).stiffness(180).mass(0.6)}
              exiting={FadeOutUp.duration(200)}
              layout={LinearTransition.springify().damping(20).stiffness(160)}
              style={[
                styles.toastPill,
                {
                  backgroundColor: isDark ? "#141418" : "#ffffff",
                  borderColor: isDark ? "#24242A" : "#e2e8f0",
                  shadowColor: isDark ? "#000000" : "#0f172a",
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  dismissToast(item.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. Tap to dismiss notification`}
                style={({ pressed }) => [
                  styles.toastPressable,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {/* Status Indicator Icon Tile */}
                <View style={[styles.toastIconWrapper, { backgroundColor: iconBg }]}>
                  <Ionicons name={typeIcon} size={18} color={typeColor} />
                </View>

                {/* Text Content */}
                <View style={styles.toastTextWrapper}>
                  <Text
                    style={[
                      styles.toastTitle,
                      { color: isDark ? "#FAFAFA" : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {Boolean(item.message) && (
                    <Text
                      style={[
                        styles.toastMessage,
                        { color: isDark ? "#A1A1AA" : theme.textMuted },
                      ]}
                      numberOfLines={2}
                    >
                      {item.message}
                    </Text>
                  )}
                </View>

                {/* Close Button */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    dismissToast(item.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss notification"
                  hitSlop={10}
                  style={styles.toastCloseBtn}
                >
                  <Ionicons
                    name="close"
                    size={15}
                    color={isDark ? "#71717A" : theme.textFaint}
                  />
                </Pressable>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Confirmation Modal Dialog */}
      {confirmDialog ? (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={handleCancelAction}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={handleCancelAction}
              accessibilityRole="button"
              accessibilityLabel="Dismiss dialog"
            />

            <Animated.View
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={[
                styles.dialogCard,
                {
                  backgroundColor: isDark ? "#141417" : "#ffffff",
                  borderColor: isDark ? "#24242A" : "#e2e8f0",
                },
              ]}
            >
              <View style={styles.dialogContent}>
                <Text
                  style={[
                    styles.dialogTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                  numberOfLines={2}
                >
                  {confirmDialog.title}
                </Text>
                {confirmDialog.message ? (
                  <Text
                    style={[
                      styles.dialogMessage,
                      { color: isDark ? "#A1A1AA" : theme.textMuted },
                    ]}
                    numberOfLines={3}
                  >
                    {confirmDialog.message}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={handleConfirmAction}
                disabled={confirmBusy}
                accessibilityRole="button"
                accessibilityLabel={confirmDialog.confirmLabel || "Confirm"}
                style={({ pressed }) => [
                  styles.dialogConfirmButton,
                  {
                    backgroundColor:
                      confirmDialog.tone === "destructive"
                        ? isDark
                          ? "rgba(244, 63, 94, 0.14)"
                          : "rgba(225, 29, 72, 0.08)"
                        : confirmDialog.tone === "warning"
                        ? isDark
                          ? "rgba(245, 158, 11, 0.14)"
                          : "rgba(217, 119, 6, 0.10)"
                        : theme.accent,
                  },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
                  confirmBusy && { opacity: 0.5 },
                ]}
              >
                {confirmDialog.icon ? (
                  <Ionicons
                    name={confirmDialog.icon}
                    size={16}
                    color={
                      confirmDialog.tone === "destructive"
                        ? colors.rose
                        : confirmDialog.tone === "warning"
                        ? colors.amber
                        : isDark
                        ? "#09090b"
                        : "#ffffff"
                    }
                  />
                ) : null}
                <Text
                  style={[
                    styles.dialogConfirmText,
                    {
                      color:
                        confirmDialog.tone === "destructive"
                          ? colors.rose
                          : confirmDialog.tone === "warning"
                          ? colors.amber
                          : isDark
                          ? "#09090b"
                          : "#ffffff",
                    },
                  ]}
                >
                  {confirmBusy
                    ? "Working…"
                    : confirmDialog.confirmLabel || "Confirm"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleCancelAction}
                disabled={confirmBusy}
                accessibilityRole="button"
                accessibilityLabel={confirmDialog.cancelLabel || "Cancel"}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={({ pressed }) => [
                  styles.dialogCancelButton,
                  pressed && { opacity: 0.55 },
                ]}
              >
                <Text
                  style={[
                    styles.dialogCancelText,
                    { color: isDark ? "#A1A1AA" : theme.textMuted },
                  ]}
                >
                  {confirmDialog.cancelLabel || "Cancel"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotify must be used within a NotificationProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  // Floating Toast Stack
  toastContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: "center",
  },
  toastPill: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  toastPressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  toastIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toastTextWrapper: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
  },
  toastTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  toastMessage: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
  },
  toastCloseBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal dialog styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 36,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  dialogContent: {
    width: "100%",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  dialogTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  dialogMessage: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    textAlign: "center",
  },
  dialogConfirmButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dialogConfirmText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  dialogCancelButton: {
    width: "100%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
