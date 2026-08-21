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
  FadeOut,
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/providers/theme-provider";
import { colors, radii } from "@/src/theme/tokens";

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
    ({ type, title, message, duration = 4500 }: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      // Haptic feedback
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

      setToasts((prev) => [newToast, ...prev.slice(0, 1)]); // Keep at most 2 to avoid clutter

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
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
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

      {/* Floating Toast Notification Stack */}
      <View
        pointerEvents="box-none"
        style={[
          styles.toastContainer,
          { top: Math.max(insets.top + 8, 16) },
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
              : colors.cyan;

          const typeIcon: keyof typeof Ionicons.glyphMap =
            item.type === "success"
              ? "checkmark-circle"
              : item.type === "error"
              ? "alert-circle"
              : item.type === "warning"
              ? "warning"
              : "information-circle";

          return (
            <Animated.View
              key={item.id}
              entering={SlideInUp.duration(320)}
              exiting={SlideOutUp.duration(280)}
              style={[
                styles.toastPill,
                {
                  backgroundColor: isDark ? "#121215" : "#ffffff",
                  borderColor: isDark ? "#27272A" : "#e2e8f0",
                  shadowColor: isDark ? "#000000" : "#64748b",
                },
              ]}
            >
              <Pressable
                onPress={() => dismissToast(item.id)}
                style={styles.toastPressable}
              >
                <View
                  style={[
                    styles.toastIconWrapper,
                    {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.04)"
                        : "rgba(0, 0, 0, 0.03)",
                    },
                  ]}
                >
                  <Ionicons name={typeIcon} size={20} color={typeColor} />
                </View>

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
                  {item.message ? (
                    <Text
                      style={[
                        styles.toastMessage,
                        { color: isDark ? "#A1A1AA" : theme.textMuted },
                      ]}
                      numberOfLines={2}
                    >
                      {item.message}
                    </Text>
                  ) : null}
                </View>

                <Ionicons
                  name="close"
                  size={16}
                  color={isDark ? "#71717A" : theme.textFaint}
                  style={styles.toastCloseIcon}
                />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Custom Confirmation Modal Dialog */}
      {confirmDialog ? (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelAction}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={handleCancelAction} />

            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={[
                styles.dialogCard,
                {
                  backgroundColor: isDark ? "#121215" : "#ffffff",
                  borderColor: isDark ? "#27272A" : "#e2e8f0",
                },
              ]}
            >
              <View
                style={[
                  styles.dialogIconBox,
                  {
                    backgroundColor:
                      confirmDialog.tone === "destructive"
                        ? isDark
                          ? "rgba(244, 63, 94, 0.12)"
                          : "rgba(225, 29, 72, 0.08)"
                        : isDark
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(5, 150, 105, 0.08)",
                    borderColor:
                      confirmDialog.tone === "destructive"
                        ? isDark
                          ? "rgba(244, 63, 94, 0.25)"
                          : "rgba(225, 29, 72, 0.20)"
                        : isDark
                        ? "rgba(16, 185, 129, 0.25)"
                        : "rgba(5, 150, 105, 0.20)",
                  },
                ]}
              >
                <Ionicons
                  name={
                    confirmDialog.icon ||
                    (confirmDialog.tone === "destructive"
                      ? "trash-outline"
                      : "help-circle-outline")
                  }
                  size={24}
                  color={
                    confirmDialog.tone === "destructive"
                      ? colors.rose
                      : colors.emerald
                  }
                />
              </View>

              <View style={styles.dialogContent}>
                <Text
                  style={[
                    styles.dialogTitle,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  {confirmDialog.title}
                </Text>
                {confirmDialog.message ? (
                  <Text
                    style={[
                      styles.dialogMessage,
                      { color: isDark ? "#A1A1AA" : theme.textMuted },
                    ]}
                  >
                    {confirmDialog.message}
                  </Text>
                ) : null}
              </View>

              <View style={styles.dialogActionsRow}>
                <Pressable
                  onPress={handleCancelAction}
                  disabled={confirmBusy}
                  style={({ pressed }) => [
                    styles.dialogCancelButton,
                    {
                      backgroundColor: isDark ? "#18181D" : "#f4f4f5",
                      borderColor: isDark ? "#27272A" : "#e4e4e7",
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dialogCancelText,
                      { color: isDark ? "#FAFAFA" : theme.text },
                    ]}
                  >
                    {confirmDialog.cancelLabel || "Cancel"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmAction}
                  disabled={confirmBusy}
                  style={({ pressed }) => [
                    styles.dialogConfirmButton,
                    {
                      backgroundColor:
                        confirmDialog.tone === "destructive"
                          ? colors.rose
                          : colors.emerald,
                    },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    confirmBusy && { opacity: 0.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dialogConfirmText,
                      {
                        color:
                          confirmDialog.tone === "destructive"
                            ? "#ffffff"
                            : "#09090B",
                      },
                    ]}
                  >
                    {confirmBusy
                      ? "Processing…"
                      : confirmDialog.confirmLabel || "Confirm"}
                  </Text>
                </Pressable>
              </View>
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
  // Toast styles
  toastContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99999,
    gap: 8,
    alignItems: "center",
  },
  toastPill: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    overflow: "hidden",
  },
  toastPressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
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
  },
  toastTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  toastMessage: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  toastCloseIcon: {
    padding: 4,
    opacity: 0.6,
  },

  // Modal dialog styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    padding: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  dialogIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogContent: {
    width: "100%",
    alignItems: "center",
    gap: 6,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  dialogMessage: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    textAlign: "center",
  },
  dialogActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  dialogCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCancelText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  dialogConfirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogConfirmText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
});
