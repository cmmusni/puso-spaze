import React, { useRef, useEffect } from "react";
import { Animated, type ViewStyle } from "react-native";
import { radii } from "../constants/theme";

/** Animated shimmer skeleton block */
export default function SkeletonBox({
  width: w,
  height: h,
  borderRadius: br = radii.md,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);
  return (
    <Animated.View
      style={[
        {
          width: w as any,
          height: h,
          borderRadius: br,
          backgroundColor: "#9CA3AF",
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}
