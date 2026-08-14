import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const CONFETTI_COUNT = 96;
const CONFETTI_COLORS = [
  "#fbbf24", // Gold
  "#10b981", // Emerald
  "#38bdf8", // Sky Blue
  "#fb7185", // Coral
  "#a855f7", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#ffffff", // White
];

const TIME_STEPS = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1];

interface DynamicConfettiPiece {
  id: number;
  color: string;
  isCircle: boolean;
  width: number;
  height: number;
  xPoints: number[];
  yPoints: number[];
  rotateX: string;
  rotateY: string;
  rotateZ: string;
}

export function FullScreenGlitterOverlay({ onComplete }: { onComplete?: () => void }) {
  const animValue = useRef(new Animated.Value(0)).current;

  const confetti: DynamicConfettiPiece[] = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
      // Split 50/50 between Left and Right Cannons
      const isLeft = index % 2 === 0;

      // Origin: Bottom-Left vs Bottom-Right corner
      const x0 = isLeft
        ? -15 + Math.random() * (SCREEN_WIDTH * 0.14)
        : SCREEN_WIDTH * 0.86 + Math.random() * (SCREEN_WIDTH * 0.14) + 15;
      const y0 = SCREEN_HEIGHT * 0.92 + Math.random() * (SCREEN_HEIGHT * 0.08);

      // Original steep wide-angle cone (-22° to -85° for Left, -95° to -158° for Right)
      const subIndex = Math.floor(index / 2);
      const angleFraction = subIndex / (CONFETTI_COUNT / 2);

      const angle = isLeft
        ? -(Math.PI * 0.12 + angleFraction * (Math.PI * 0.35) + (Math.random() - 0.5) * 0.05) // Left (~-22° to -85°)
        : -(Math.PI * 0.53 + angleFraction * (Math.PI * 0.35) + (Math.random() - 0.5) * 0.05); // Right (~-95° to -158°)

      // Original energetic velocity and upward pop
      const speed = (1.2 + Math.random() * 0.65) * SCREEN_HEIGHT;
      const vx = Math.cos(angle) * speed * 0.95;
      const vy = Math.sin(angle) * speed * 1.32; // Original upward pop

      // Original strong realistic downward gravity
      const gravity = SCREEN_HEIGHT * 2.25;

      // Original continuous parabolic arc with rapid natural drop
      const xPoints = TIME_STEPS.map((t) => x0 + vx * t + (Math.sin(t * Math.PI * 4 + index) * 16));
      const yPoints = TIME_STEPS.map((t) => y0 + vy * t + 0.5 * gravity * t * t);

      const isCircle = index % 3 === 0;

      return {
        id: index,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        isCircle,
        width: isCircle ? 7 : 7 + Math.floor(Math.random() * 3),
        height: isCircle ? 7 : 12 + Math.floor(Math.random() * 5),
        xPoints,
        yPoints,
        rotateX: `${Math.floor(720 + Math.random() * 1200)}deg`,
        rotateY: `${Math.floor(1080 + Math.random() * 1600)}deg`,
        rotateZ: `${Math.floor(360 + Math.random() * 720)}deg`,
      };
    });
  }, []);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 1700, // Faster, energetic 1.7s duration
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      onComplete?.();
    });
  }, [animValue, onComplete]);

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.overlay]} pointerEvents="none">
      {confetti.map((c) => {
        const translateX = animValue.interpolate({
          inputRange: TIME_STEPS,
          outputRange: c.xPoints,
        });

        const translateY = animValue.interpolate({
          inputRange: TIME_STEPS,
          outputRange: c.yPoints,
        });

        const scale = animValue.interpolate({
          inputRange: [0, 0.08, 0.75, 1],
          outputRange: [0, 1.25, 1, 0.3],
        });

        const opacity = animValue.interpolate({
          inputRange: [0, 0.03, 0.85, 1],
          outputRange: [0, 1, 0.9, 0],
        });

        const rotX = animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", c.rotateX],
        });

        const rotY = animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", c.rotateY],
        });

        const rotZ = animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", c.rotateZ],
        });

        return (
          <Animated.View
            key={c.id}
            style={[
              styles.piece,
              {
                width: c.width,
                height: c.height,
                backgroundColor: c.color,
                borderRadius: c.isCircle ? c.width * 0.5 : 2,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotateX: rotX },
                  { rotateY: rotY },
                  { rotateZ: rotZ },
                ],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    overflow: "visible",
  },
  piece: {
    position: "absolute",
    zIndex: 99999,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
