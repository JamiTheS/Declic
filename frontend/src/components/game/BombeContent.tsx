import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Card } from "@/src/types";
import { FONTS, RADIUS, ModePalette } from "@/src/theme/tokens";
import { GageBanner, ModeTag, Confetti } from "./GameCards";
import { useBombeSounds } from "@/src/hooks/use-bombe-sounds";
import { DEFAULT_BOMBE_GAGE, DEFAULT_BOMBE_ALT } from "@/src/data/bombeCategories";

/**
 * La Bombe — a hidden, random timer. Players pass the phone around, one answer
 * each, tapping to move on. Whoever holds it when it explodes takes the gage.
 * The remaining time is NEVER shown; tension is conveyed by accelerating
 * haptics (and optional sound). The mode manages its own loop and calls onDone
 * once the gage is resolved.
 */
export function BombeContent({
  card,
  sober,
  pal,
  haptics,
  sound,
  onDone,
}: {
  card: Card;
  sober: boolean;
  pal: ModePalette;
  haptics: boolean;
  sound: boolean;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"play" | "boom">("play");
  const startRef = useRef(0);
  const explodeAtRef = useRef(0);
  const { playTick, playBoom } = useBombeSounds(sound);

  const pulse = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const boomPop = useRef(new Animated.Value(0)).current;

  // Normalised gage (fallback to defaults when the Airtable card has none).
  const gageCard: Card = {
    ...card,
    gage: card.gage || DEFAULT_BOMBE_GAGE,
    alternative: card.alternative || DEFAULT_BOMBE_ALT,
  };

  // Pick a hidden random duration; the range tightens as intensity rises.
  useEffect(() => {
    const factor = Math.max(0, Math.min(1, (card.intensite - 1) / 4));
    const min = 8000 * (1 - 0.45 * factor); // 8.0s → ~4.4s
    const max = 35000 * (1 - 0.6 * factor); // 35s → ~14s
    const dur = min + Math.random() * (max - min);
    startRef.current = Date.now();
    explodeAtRef.current = Date.now() + dur;
    setPhase("play");
    boomPop.setValue(0);
  }, [card.id, card.intensite, boomPop]);

  // Idle pulse on the bomb glyph.
  useEffect(() => {
    if (phase !== "play") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [phase, pulse]);

  // Accelerating tic-tac loop (recursive timeout) → BOOM.
  useEffect(() => {
    if (phase !== "play") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!active) return;
      const now = Date.now();
      const remaining = explodeAtRef.current - now;
      if (remaining <= 0) {
        setPhase("boom");
        return;
      }
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      playTick();
      const total = Math.max(1, explodeAtRef.current - startRef.current);
      const prog = Math.max(0, Math.min(1, 1 - remaining / total));
      const interval = 640 - prog * prog * 520; // ease-in acceleration
      timer = setTimeout(loop, Math.max(110, interval));
    };
    timer = setTimeout(loop, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phase, haptics, playTick]);

  // BOOM feedback.
  useEffect(() => {
    if (phase !== "boom") return;
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    playBoom();
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    Animated.spring(boomPop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [phase, haptics, playBoom, shake, boomPop]);

  const onTapPass = () => {
    if (phase !== "play") return;
    if (haptics) Haptics.selectionAsync().catch(() => {});
  };

  // ---- BOOM screen ----
  if (phase === "boom") {
    const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });
    return (
      <>
        <Confetti count={26} />
        <View style={styles.shell}>
          <View style={styles.topZone}>
            <ModeTag mode="bombe" pal={pal} />
          </View>
          <View style={styles.middleCenter}>
            <Animated.Text style={[styles.boomEmoji, { transform: [{ translateX }, { scale: boomPop }] }]}>💥</Animated.Text>
            <Text style={[styles.boomTitle, { color: pal.fg }]}>BOOM !</Text>
            <Text style={[styles.boomSub, { color: pal.muted }]}>
              La personne qui tient le téléphone prend le gage 😈
            </Text>
          </View>
          <View style={styles.bottomZone}>
            <GageBanner card={gageCard} sober={sober} pal={pal} />
            <Pressable
              style={({ pressed }) => [styles.nextBtn, { backgroundColor: pal.color, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              onPress={onDone}
              testID="bombe-next"
            >
              <Text style={[styles.nextText, { color: pal.onAccent }]}>CARTE SUIVANTE</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={pal.onAccent} />
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  // ---- Play screen (whole area is tappable to pass the phone) ----
  return (
    <Pressable style={styles.playPress} onPress={onTapPass} testID="bombe-play-area">
      <View style={styles.shell}>
        <View style={styles.topZone}>
          <ModeTag mode="bombe" pal={pal} />
        </View>
        <View style={styles.middleCenter}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <MaterialCommunityIcons name="bomb" size={88} color={pal.color} />
          </Animated.View>
          <Text style={[styles.category, { color: pal.fg }]} adjustsFontSizeToFit numberOfLines={4}>
            {card.texte}
          </Text>
        </View>
        <View style={styles.bottomZone}>
          <View style={[styles.instruction, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
            <MaterialCommunityIcons name="gesture-tap" size={16} color={pal.muted} />
            <Text style={[styles.instructionText, { color: pal.muted }]}>
              Passez-vous le tél. Une réponse chacun, tapez pour passer 👉
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playPress: { flex: 1 },
  shell: { flex: 1, justifyContent: "space-between", paddingVertical: 12 },
  topZone: { alignItems: "center" },
  middleCenter: { flex: 1, justifyContent: "center", alignItems: "center", gap: 18, width: "100%" },
  bottomZone: { alignItems: "center", gap: 12 },
  category: {
    fontFamily: FONTS.display,
    fontSize: 36,
    lineHeight: 41,
    textAlign: "center",
  },
  instruction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    maxWidth: "100%",
  },
  instructionText: { fontFamily: FONTS.body, fontSize: 14, flexShrink: 1, textAlign: "center" },
  boomEmoji: { fontSize: 110, textAlign: "center" },
  boomTitle: { fontFamily: FONTS.display, fontSize: 52, textAlign: "center", marginTop: 4 },
  boomSub: { fontFamily: FONTS.body, fontSize: 16, textAlign: "center", marginTop: 8, paddingHorizontal: 20, lineHeight: 22 },
  nextBtn: {
    minHeight: 64,
    flexDirection: "row",
    gap: 8,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    alignSelf: "stretch",
  },
  nextText: { fontFamily: FONTS.display, fontSize: 17, letterSpacing: 0.5 },
});
