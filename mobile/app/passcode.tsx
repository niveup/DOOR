import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import { api, ApiError } from "@/src/services/api";
import { useAuth } from "@/src/providers/auth-provider";
import { useTheme } from "@/src/providers/theme-provider";

// Desktop App Symmetric Architectural Door (Closed, Crisp, Zero Unnecessary Effects)
function ArchitecturalDoorSvg({ isDark, size = 68 }: { isDark: boolean; size?: number }) {
  const doorwayBg = isDark ? "#18181b" : "#FAF8F4";
  const archStroke = isDark ? "#d4d4d8" : "#292524";
  const doorLeafFill = isDark ? "#27272a" : "#EFECE6";
  const doorLeafStroke = isDark ? "#52525b" : "#44403C";
  const panelFill = isDark ? "#1f1f23" : "#E7E4DC";
  const panelStroke = isDark ? "#3f3f46" : "#A8A29E";
  const knobFill = isDark ? "#a1a1aa" : "#78716C";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21V9a7 7 0 0114 0v12Z" fill={doorwayBg} />
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 21V9a7 7 0 0114 0v12M3 21h18"
        stroke={archStroke}
        strokeWidth="1.5"
      />
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 21V9.5a5.5 5.5 0 0111 0V21Z"
        fill={doorLeafFill}
        stroke={doorLeafStroke}
        strokeWidth="1.2"
      />
      <Path
        d="M8.5 10a3.5 3.5 0 017 0v3h-7v-3zM8.5 14.5h7V19.5h-7v-5z"
        fill={panelFill}
        stroke={panelStroke}
        strokeWidth="0.8"
      />
      <Circle cx="15.8" cy="14" r="0.75" fill={knobFill} />
    </Svg>
  );
}

// Mathematically Overdamped (Zero-Overshoot) Fluid Spring
// Guarantees continuous acceleration, zero initial impulse jerk, and zero end vibration
const ZERO_JITTER_SPRING = {
  damping: 28,
  stiffness: 175,
  mass: 0.9,
  overshootClamping: true,
  restDisplacementThreshold: 0.0001,
  restSpeedThreshold: 0.0001,
};

export default function PasscodeScreen() {
  const { unlock } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 150fps Native Worklet Shared Values for Buttery Motion
  const focusProgress = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);
  const isInputFocused = useRef(false);
  const isTogglingEyeRef = useRef(false);

  const animateFocus = useCallback(
    (toFocus: boolean) => {
      focusProgress.value = withSpring(toFocus ? 1 : 0, ZERO_JITTER_SPRING);
    },
    [focusProgress]
  );

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        isInputFocused.current = true;
        animateFocus(true);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        if (isTogglingEyeRef.current) return;
        isInputFocused.current = false;
        animateFocus(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [animateFocus]);

  // Minimal Monochrome Palette (Zero green, blue, or purple)
  const palette = {
    canvas: isDark ? "#09090b" : "#ffffff",
    surface: isDark ? "#121214" : "#ffffff",
    border: isDark ? "#222226" : "#e5e5ea",
    borderActive: isDark ? "#fafafa" : "#18181b",
    textPrimary: isDark ? "#fafafa" : "#18181b",
    textMuted: isDark ? "#71717a" : "#71717a",
    textFaint: isDark ? "#3f3f46" : "#a1a1aa",
    inputBg: isDark ? "#141417" : "#f4f4f5",
    inputBorder: isDark ? "#27272a" : "#e4e4e7",
    btnBg: isDark ? "#fafafa" : "#18181b",
    btnText: isDark ? "#09090b" : "#fafafa",
    btnDisabledBg: isDark ? "#1c1c20" : "#f4f4f5",
    btnDisabledText: isDark ? "#3f3f46" : "#a1a1aa",
    errorBg: isDark ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.06)",
    errorBorder: isDark ? "rgba(239, 68, 68, 0.20)" : "rgba(239, 68, 68, 0.16)",
    errorText: isDark ? "#f87171" : "#dc2626",
  };

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(8, { duration: 35, easing: Easing.linear }),
      withTiming(-8, { duration: 35, easing: Easing.linear }),
      withTiming(6, { duration: 35, easing: Easing.linear }),
      withTiming(-6, { duration: 35, easing: Easing.linear }),
      withTiming(0, { duration: 35, easing: Easing.linear })
    );
  }, [shakeX]);

  const toggleShowPasscode = async () => {
    await Haptics.selectionAsync().catch(() => {});
    isTogglingEyeRef.current = true;
    setShowPasscode((prev) => !prev);
    setTimeout(() => {
      isTogglingEyeRef.current = false;
    }, 250);
  };

  const handleThemeToggle = async () => {
    await Haptics.selectionAsync().catch(() => {});
    toggleTheme();
  };

  const submit = async () => {
    if (submitting) return;
    const trimmed = passcode.trim();

    if (trimmed.length < 8) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setError("Passcode must be at least 8 characters.");
      triggerShake();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.verifyPasscode(trimmed);
      await unlock(trimmed);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/(tabs)");
    } catch (reason) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(reason instanceof ApiError ? reason.message : "Invalid passcode.");
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = passcode.trim().length > 0 && !submitting;
  const targetLift = Platform.OS === "ios" ? -110 : -118;

  // Ultra-Smooth 150fps Fluid Motion Transforms (Hardware-Accelerated UI Worklets)
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      focusProgress.value,
      [0, 1],
      [0, targetLift],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }, { translateX: shakeX.value }],
    };
  });

  const doorAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      focusProgress.value,
      [0, 1],
      [1, 0.60],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
    };
  });

  const subtitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      focusProgress.value,
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
    };
  });

  return (
    <View style={[styles.screen, { backgroundColor: palette.canvas }]}>
      {/* 1. Rock-Solid Static Theme Toggle (Unaffected by keyboard or focus) */}
      <View style={[styles.topBarFixed, { top: insets.top + (Platform.OS === "ios" ? 8 : 12) }]}>
        <Pressable
          onPress={handleThemeToggle}
          style={({ pressed }) => [
            styles.themeSwitchButton,
            {
              backgroundColor: isDark ? "#16161a" : "#ffffff",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
              shadowColor: isDark ? "#000" : "#64748b",
              shadowOpacity: isDark ? 0.2 : 0.06,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            },
            pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
          ]}
          hitSlop={12}
          accessibilityLabel="Toggle color theme"
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={13}
            color={isDark ? "#f59e0b" : "#475569"}
          />
          <Text style={[styles.themeSwitchText, { color: palette.textPrimary }]}>
            {isDark ? "Light" : "Dark"}
          </Text>
        </Pressable>
      </View>

      {/* 2. Interactive Animated Main Stage (Driven exclusively by Reanimated UI Worklets) */}
      <TouchableWithoutFeedback
        onPress={() => {
          isInputFocused.current = false;
          inputRef.current?.blur();
          Keyboard.dismiss();
          animateFocus(false);
        }}
        accessible={false}
      >
        <View style={styles.scrollContent}>
          <Animated.View
            renderToHardwareTextureAndroid={true}
            style={[styles.container, containerAnimatedStyle]}
          >
            {/* Pure Architectural Door Header (Zero clutter, zero bubbles) */}
            <View style={styles.header}>
              <Animated.View
                renderToHardwareTextureAndroid={true}
                style={[styles.doorWrapper, doorAnimatedStyle]}
              >
                <ArchitecturalDoorSvg isDark={isDark} size={68} />
              </Animated.View>

              <Text style={[styles.brandTitle, { color: palette.textPrimary }]}>
                DOOR
              </Text>

              <Animated.View style={subtitleAnimatedStyle}>
                <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                  Enter passcode to unlock
                </Text>
              </Animated.View>
            </View>

            {/* Master Passcode Form */}
            <View style={styles.form}>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: palette.inputBg,
                      borderColor: error ? palette.errorBorder : palette.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="key-outline"
                    size={16}
                    color={palette.textPrimary}
                    style={styles.inputIcon}
                  />

                  <TextInput
                    ref={inputRef}
                    value={passcode}
                    onChangeText={(text) => {
                      setPasscode(text);
                      if (error) setError(null);
                    }}
                    secureTextEntry={!showPasscode}
                    placeholder="••••••••"
                    placeholderTextColor={palette.textFaint}
                    autoFocus={false}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    textContentType="none"
                    autoComplete="off"
                    onSubmitEditing={submit}
                    returnKeyType="go"
                    onFocus={() => {
                      isInputFocused.current = true;
                      animateFocus(true);
                    }}
                    onBlur={() => {
                      if (isTogglingEyeRef.current) return;
                      isInputFocused.current = false;
                      if (!passcode.trim()) {
                        animateFocus(false);
                      }
                    }}
                    cursorColor={palette.textPrimary}
                    selectionColor={isDark ? "rgba(250, 250, 250, 0.4)" : "rgba(24, 24, 27, 0.4)"}
                    style={[styles.textInput, { color: palette.textPrimary }]}
                  />

                  <Pressable
                    onPress={toggleShowPasscode}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={showPasscode ? "Hide passcode" : "Show passcode"}
                    style={({ pressed }) => [styles.eyeToggle, pressed && styles.pressed]}
                  >
                    <Ionicons
                      name={showPasscode ? "eye-off-outline" : "eye-outline"}
                      size={16}
                      color={palette.textMuted}
                    />
                  </Pressable>
                </View>

                {error ? (
                  <View
                    style={[
                      styles.errorBox,
                      {
                        backgroundColor: palette.errorBg,
                        borderColor: palette.errorBorder,
                      },
                    ]}
                  >
                    <Ionicons name="alert-circle-outline" size={14} color={palette.errorText} style={styles.errorIcon} />
                    <Text style={[styles.errorText, { color: palette.errorText }]}>{error}</Text>
                  </View>
                ) : null}

                {/* Primary Action Button */}
                <Pressable
                  onPress={submit}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock"
                  style={({ pressed }) => [
                    styles.submitButton,
                    {
                      backgroundColor: canSubmit ? palette.btnBg : palette.btnDisabledBg,
                    },
                    canSubmit && pressed && styles.submitButtonPressed,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={palette.btnText} />
                  ) : (
                    <Text
                      style={[
                        styles.submitButtonText,
                        {
                          color: canSubmit ? palette.btnText : palette.btnDisabledText,
                        },
                      ]}
                    >
                      Unlock
                    </Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>

      {/* 3. Static Bottom Footer */}
      <View
        style={[styles.bottomFooter, { bottom: insets.bottom + (Platform.OS === "ios" ? 14 : 16) }]}
        pointerEvents="none"
      >
        <Text style={[styles.footerText, { color: palette.textFaint }]}>
          Encrypted on-device
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBarFixed: {
    position: "absolute",
    right: 20,
    zIndex: 999,
  },
  themeSwitchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  themeSwitchText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.6,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  container: {
    width: "100%",
    maxWidth: 340,
    alignSelf: "center",
    gap: 18,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  doorWrapper: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
  },
  form: {
    width: "100%",
    gap: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    height: 46,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 0,
    letterSpacing: 1.5,
  },
  eyeToggle: {
    padding: 6,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "400",
  },
  submitButton: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  bottomFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  footerText: {
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 0.3,
  },
});

