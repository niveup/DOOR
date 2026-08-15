import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// 128 dense particles for a powerful, wide-spreading dual cannon burst
const CONFETTI_COUNT = 128;

const CONFETTI_COLORS = [
  "#ef4444", // Festive Red
  "#f59e0b", // Golden Amber
  "#10b981", // Emerald Green
  "#3b82f6", // Royal Blue
  "#8b5cf6", // Vibrant Purple
  "#ec4899", // Hot Pink
  "#06b6d4", // Electric Cyan
  "#facc15", // Sunburst Yellow
  "#fbbf24", // Metallic Gold
  "#ffffff", // Crisp Pearl White
];

const TIME_STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

type ConfettiShape = "strip" | "dot" | "streamer" | "square" | "mini";

interface FastWideCannonPiece {
  id: number;
  color: string;
  shape: ConfettiShape;
  width: number;
  height: number;
  delayMs: number;
  durationMs: number;
  xPoints: number[];
  yPoints: number[];
  spinZ: string;
}

function SingleFastPiece({
  model,
  onFinished,
}: {
  model: FastWideCannonPiece;
  onFinished: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: model.durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinished();
      });
    }, model.delayMs);

    return () => clearTimeout(timer);
  }, [anim, model, onFinished]);

  // 1. High-Velocity Wide X Expansion
  const translateX = anim.interpolate({
    inputRange: TIME_STEPS,
    outputRange: model.xPoints,
  });

  // 2. Fast Ballistic Y Fountain Blast & Gravitational Drop
  const translateY = anim.interpolate({
    inputRange: TIME_STEPS,
    outputRange: model.yPoints,
  });

  // 3. Explosive Muzzle Scale Pop (Fast initial expansion)
  const scale = anim.interpolate({
    inputRange: [0, 0.06, 0.78, 1],
    outputRange: [0.15, 1.25, 1, 0.8],
  });

  // 4. 3D Tumbling Paper Flip
  const scaleX = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 0.2, 1, 0.2, 0.85],
  });

  // 5. Fast Rotation
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", model.spinZ],
  });

  // 6. Crisp Launch Opacity, dissolving at bottom
  const opacity = anim.interpolate({
    inputRange: [0, 0.03, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });

  const isCircle = model.shape === "dot" || model.shape === "mini";
  const borderRadius = isCircle ? model.width * 0.5 : 2;

  return (
    <Animated.View
      style={[
        styles.confettiItem,
        {
          width: model.width,
          height: model.height,
          backgroundColor: model.color,
          borderRadius,
          transform: [
            { translateX },
            { translateY },
            { scale },
            { scaleX },
            { rotate },
          ],
          opacity,
        },
      ]}
    />
  );
}

export function FullScreenGlitterOverlay({ onComplete }: { onComplete?: () => void }) {
  const completedCount = useRef(0);

  const confetti = useMemo<FastWideCannonPiece[]>(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
      const isLeft = index % 2 === 0;

      // 1. Dual Corner Muzzle Launch Origins
      const x0 = isLeft
        ? SCREEN_WIDTH * 0.03 + (Math.random() - 0.5) * 12
        : SCREEN_WIDTH * 0.97 + (Math.random() - 0.5) * 12;
      const y0 = SCREEN_HEIGHT * 0.94;

      // 2. Wide Angular Spread at Start (Spans full ~70° fan-out immediately from muzzle)
      const subIdx = Math.floor(index / 2);
      const angleFraction = subIdx / (CONFETTI_COUNT / 2);

      // Left Cannon: Fans widely from -12° (low horizontal) to -82° (high vertical)
      // Right Cannon: Fans widely from -98° (high vertical) to -168° (low horizontal)
      const angle = isLeft
        ? -(Math.PI * 0.08 + angleFraction * (Math.PI * 0.38) + (Math.random() - 0.5) * 0.08)
        : -(Math.PI * 0.54 + angleFraction * (Math.PI * 0.38) + (Math.random() - 0.5) * 0.08);

      // 3. Fast Muzzle Blast Speed
      const speed = (1.55 + Math.random() * 0.75) * SCREEN_HEIGHT;
      const vx = Math.cos(angle) * speed * 0.95;
      const vy = Math.sin(angle) * speed * 1.1; // High-velocity upward punch

      // Realistic downward gravity
      const gravity = SCREEN_HEIGHT * 3.4;

      // Continuous ballistic trajectory (Immediate wide fan-out from t = 0)
      const xPoints = TIME_STEPS.map((t) => {
        const flutter = Math.sin(t * Math.PI * 3 + index) * 14;
        return x0 + vx * t + flutter;
      });

      const yPoints = TIME_STEPS.map((t) => {
        return y0 + vy * t + 0.5 * gravity * t * t;
      });

      // 4. Varied Confetti Shapes & Textures
      const shapeRoll = index % 5;
      let shape: ConfettiShape = "strip";
      let width = 6;
      let height = 12;

      if (shapeRoll === 0) {
        shape = "strip";
        width = 6 + (index % 3);
        height = 12 + (index % 4);
      } else if (shapeRoll === 1) {
        shape = "dot";
        width = 6.5;
        height = 6.5;
      } else if (shapeRoll === 2) {
        shape = "square";
        width = 6.5;
        height = 6.5;
      } else if (shapeRoll === 3) {
        shape = "streamer";
        width = 4.5;
        height = 17 + (index % 4);
      } else {
        shape = "mini";
        width = 4.5;
        height = 4.5;
      }

      // Fast explosive burst timing (1.25s to 1.45s) with tight 0-40ms stagger
      const delayMs = Math.floor(Math.random() * 40);
      const durationMs = 1250 + Math.floor(Math.random() * 200);

      // Fast 3D spin rotation
      const spinTurns = (isLeft ? 1 : -1) * (540 + Math.floor(Math.random() * 720));

      return {
        id: index,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        shape,
        width,
        height,
        delayMs,
        durationMs,
        xPoints,
        yPoints,
        spinZ: `${spinTurns}deg`,
      };
    });
  }, []);

  const handleFinished = () => {
    completedCount.current += 1;
    if (completedCount.current >= confetti.length) {
      onComplete?.();
    }
  };

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.container]} pointerEvents="none">
      {confetti.map((piece) => (
        <SingleFastPiece
          key={piece.id}
          model={piece}
          onFinished={handleFinished}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    zIndex: 99999,
  },
  confettiItem: {
    position: "absolute",
    zIndex: 99999,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
