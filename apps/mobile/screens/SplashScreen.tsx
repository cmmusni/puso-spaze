import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "../constants/theme";

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const { width } = useWindowDimensions();
  const isMedium = width >= 600;

  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade in glow + logo together
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Then text
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Then dots
      Animated.timing(dotsOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-transition after 2.8 seconds
    const timer = setTimeout(onFinish, 2800);
    return () => clearTimeout(timer);
  }, []);

  const logoSize = isMedium ? 120 : 100;
  const glowSize = isMedium ? 200 : 170;

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* ── Logo with glow ── */}
      <View style={styles.logoArea}>
        {/* Glow circle */}
        <Animated.View
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              opacity: glowOpacity,
            },
          ]}
        />
        {/* Logo */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Image
            source={require("../assets/logo.png")}
            style={[
              styles.logo,
              {
                width: logoSize,
                height: logoSize,
                borderRadius: Math.round(logoSize * 0.2237),
              },
            ]}
            resizeMode="cover"
          />
        </Animated.View>
      </View>

      {/* ── Title + tagline ── */}
      <Animated.View style={[styles.textArea, { opacity: textOpacity }]}>
        <Text style={[styles.title, isMedium && styles.titleMd]}>
          PUSO Spaze
        </Text>
        <Text style={[styles.tagline, isMedium && styles.taglineMd]}>
          A sanctuary for your heart
        </Text>
      </Animated.View>

      {/* ── Page dots ── */}
      <Animated.View style={[styles.dots, { opacity: dotsOpacity }]}>
        <View style={[styles.dot, styles.dotInactive]} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotInactive]} />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoArea: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 60,
  },
  glow: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  logo: {
    // Size set dynamically
  },
  textArea: {
    alignItems: "center",
    position: "absolute",
    bottom: "18%",
  },
  title: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 32,
    color: colors.onPrimary,
    marginBottom: 8,
  },
  titleMd: {
    fontSize: 40,
  },
  tagline: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: "rgba(255,255,255,0.65)",
  },
  taglineMd: {
    fontSize: 18,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    position: "absolute",
    bottom: "10%",
  },
  dot: {
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 3,
  },
  dotInactive: {
    width: 6,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
