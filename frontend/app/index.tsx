import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/src/context/AppContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, HEALTH_MSG, hexAlpha } from "@/src/theme/tokens";

export default function Index() {
  const router = useRouter();
  const { ready, ageVerified } = useApp();
  const { colors } = useTheme();
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 640,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      if (ageVerified) router.replace("/setup");
      else router.replace("/age-gate");
    }, 900);
    return () => clearTimeout(t);
  }, [ready, ageVerified, router]);

  const logoStyle = {
    opacity: intro,
    transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]} testID="splash-screen">
      <View style={[styles.glow, { backgroundColor: hexAlpha(colors.brand, 0.1) }]} />
      <Animated.View style={[styles.center, logoStyle]}>
        <Text style={[styles.logo, { color: colors.onSurface }]}>DÉCLIC</Text>
        <View style={[styles.rule, { backgroundColor: colors.brand }]} />
        <Text style={[styles.tagline, { color: colors.muted }]}>Le jeu qui révèle tes potes</Text>
      </Animated.View>
      <View style={styles.footer}>
        <ActivityIndicator color={colors.brand} />
        <Text style={[styles.health, { color: colors.faint }]}>{HEALTH_MSG}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 48 },
  glow: {
    position: "absolute",
    top: "28%",
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  logo: { fontFamily: FONTS.display, fontSize: 60, letterSpacing: 3 },
  rule: { width: 40, height: 3, borderRadius: 2, marginTop: 18 },
  tagline: { fontFamily: FONTS.body, fontSize: 15, marginTop: 18, letterSpacing: 0.2 },
  footer: { position: "absolute", bottom: 40, alignItems: "center", gap: 16, paddingHorizontal: 32 },
  health: { fontFamily: FONTS.bodyRegular, fontSize: 11, textAlign: "center" },
});

// touch to force metro re-add
