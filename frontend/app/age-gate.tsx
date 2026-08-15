 
import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useApp } from "@/src/context/AppContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, HEALTH_MSG, hexAlpha, Colors } from "@/src/theme/tokens";
import PrimaryButton from "@/src/components/PrimaryButton";

export default function AgeGate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyAge } = useApp();
  const { colors } = useTheme();
  const [blocked, setBlocked] = useState(false);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const onYes = () => {
    verifyAge();
    router.replace("/setup");
  };

  const onNo = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setBlocked(true);
  };

  if (blocked) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]} testID="age-blocked">
        <View style={styles.blockCenter}>
          <Text style={styles.blockEmoji}>🚫</Text>
          <Text style={styles.blockTitle}>Reviens dans quelques années</Text>
          <Text style={styles.blockText}>
            Déclic est réservé aux personnes majeures (18 ans et plus).
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="age-gate-screen">
      <View style={[styles.glow, { backgroundColor: hexAlpha(colors.brand, 0.12) }]} />
      <View style={[styles.top, { paddingTop: insets.top + 64 }]}>
        <Text style={styles.kicker}>AVANT DE JOUER</Text>
        <Text style={styles.title}>T'as plus de 18 ans ?</Text>
        <Text style={styles.subtitle}>
          Déclic contient des questions cash et intimes. C'est un jeu d'ambiance
          entre potes, réservé aux majeurs.
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.health}>{HEALTH_MSG}</Text>
        <PrimaryButton label="OUI, J'AI 18 ANS OU PLUS" onPress={onYes} testID="age-yes-button" haptic="heavy" />
        <Pressable onPress={onNo} style={styles.noBtn} testID="age-no-button">
          <Text style={styles.noText}>Non, j'ai moins de 18 ans</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface, paddingHorizontal: SPACING.lg },
    glow: { position: "absolute", top: -80, left: -60, width: 300, height: 300, borderRadius: 150 },
    top: { flex: 1 },
    kicker: { fontFamily: FONTS.bodyBold, color: c.brand, letterSpacing: 2.5, fontSize: 12, marginBottom: 14 },
    title: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 48, lineHeight: 52 },
    subtitle: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 17, lineHeight: 26, marginTop: 20 },
    bottom: { gap: 14 },
    health: { fontFamily: FONTS.bodyRegular, color: c.muted, fontSize: 12, textAlign: "center", marginBottom: 4 },
    noBtn: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    noText: { fontFamily: FONTS.body, color: c.muted, fontSize: 15 },
    blockCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
    blockEmoji: { fontSize: 68, marginBottom: 20 },
    blockTitle: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 30, textAlign: "center" },
    blockText: { fontFamily: FONTS.body, color: c.muted, fontSize: 16, textAlign: "center", marginTop: 16, lineHeight: 24 },
  });
