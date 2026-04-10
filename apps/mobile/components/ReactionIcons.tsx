import React from "react";
import { View, StyleSheet, Image } from "react-native";

interface IconProps {
  size?: number;
  color?: string;
  style?: object;
}

export function PrayIcon({ size = 16, color = "#fff", style }: IconProps) {
  return (
    <Image
      source={require("../assets/pray-icon.png")}
      style={[{ width: size, height: size, tintColor: color }, style]}
      resizeMode="contain"
    />
  );
}

export function SupportIcon({ size = 16, color = "#fff", style }: IconProps) {
  return (
    <Image
      source={require("../assets/support-icon.png")}
      style={[{ width: size, height: size, tintColor: color }, style]}
      resizeMode="contain"
    />
  );
}

export function LikeIcon({ size = 16, color = "#fff", style }: IconProps) {
  return (
    <Image
      source={require("../assets/like-icon.png")}
      style={[{ width: size, height: size, tintColor: color }, style]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  segment: {
    position: "absolute",
  },
});
