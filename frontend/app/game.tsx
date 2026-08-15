 
import { useMemo, useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Animated, Easing, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";

import { useApp } from "@/src/context/AppContext";
import { useCatalog } from "@/src/context/CatalogContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { buildSoiree, buildModeDeck } from "@/src/engine/escalation";
import { logEvent } from "@/src/api/client";
import { FONTS, SPACING, INTENSITY_COLORS, MODE_META, HOW_TO_PLAY, modePalette, hexAlpha, Colors } from "@/src/theme/tokens";
import { Player } from "@/src/types";
import {
  TextContent,
  VoteContent,
  VerdictContent,
  PairContent,
  LockedContent,
} from "@/src/components/game/GameCards";
import { BombeContent } from "@/src/components/game/BombeContent";
import { buildDefaultBombeDeck } from "@/src/data/bombeCategories";

const INTENSITY_LABEL: Record<number, string> = {
  1: "Chill", 2: "Détente", 3: "Perso", 4: "Intime", 5: "Hot",
};

const ADVANCE_MODES = ["je-nai-jamais", "action-verite", "cash-ou-cash", "hot"];
const SINGLE_TARGET = ["action-verite", "cash-ou-cash", "le-verdict", "hot"];

export default function Game() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, preset, vibe } = useLocalSearchParams<{ mode: string; preset?: string; vibe?: string }>();
  const { colors } = useTheme();
  const {
    players, ambiance, soberMode, isPremium, haptics, soundEnabled,
    recordCard, recordReveal, recordVote, recordCorrect, recordPass,
  } = useApp();
  const { cards } = useCatalog();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const deck = useMemo(() => {
    if (mode === "soiree") {
      let pool = cards.filter((c) => c.actif);
      if (preset && preset !== "all") pool = pool.filter((c) => (c.packs || []).includes(preset));
      if (vibe && vibe !== "all") pool = pool.filter((c) => c.vibe === vibe);
      return buildSoiree(pool, { ambiance, isPremium });
    }
    if (mode === "bombe") {
      const cat = cards.filter((c) => c.actif && c.mode === "bombe");
      return cat.length ? cat : buildDefaultBombeDeck();
    }
    return buildModeDeck(cards, mode as string, { ambiance, isPremium });
  }, [cards, mode, preset, vibe, ambiance, isPremium]);

  const targets = useMemo<Player[][]>(() => {
    let ti = 0;
    return deck.map((card) => {
      if (players.length === 0) return [];
      if (SINGLE_TARGET.includes(card.mode)) {
        const p = players[ti % players.length];
        ti++;
        return [p];
      }
      if (card.mode === "tu-me-connais") {
        const a = players[ti % players.length];
        const b = players[(ti + 1) % players.length];
        ti++;
        return [a, b];
      }
      return [];
    });
  }, [deck, players]);

  const [index, setIndex] = useState(0);
  const [rulesVisible, setRulesVisible] = useState(false);

  const card = deck[index];
  const locked = card ? card.premium && !isPremium : false;
  const pal = useMemo(() => modePalette(card?.mode ?? "action-verite", colors), [card?.mode, colors]);
  const meta = card ? MODE_META[card.mode] : undefined;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, anim]);
  const cardAnimStyle = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
    ],
  };

  // Free players never receive premium cards in their deck (see escalation.ts),
  // so a launched game is never interrupted by a paywall. Premium is offered on
  // the hub / launch screens instead. LockedContent stays only as a safety net.

  useEffect(() => {
    logEvent("game_start", { mode, preset, vibe });
    if (Platform.OS !== "web") {
      activateKeepAwakeAsync().catch(() => {});
      return () => { deactivateKeepAwake().catch(() => {}); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!card) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyTitle}>Aucune carte disponible</Text>
        <Text style={styles.emptySub}>Ce mode n'a pas encore de contenu pour cette ambiance.</Text>
        <Pressable style={styles.emptyBtn} onPress={() => router.replace("/hub")} testID="empty-back">
          <Text style={styles.emptyBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const finish = () => {
    logEvent("game_finish", { mode, cards: index + 1 });
    router.replace("/recap");
  };

  const completeCurrent = () => {
    const tg = targets[index] || [];
    recordCard(tg.map((p) => p.id));
    if (["cash-ou-cash", "je-nai-jamais", "hot"].includes(card.mode) || card.variante === "verite") {
      recordReveal();
    }
  };

  const advance = (completed: boolean) => {
    if (completed) completeCurrent();
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const ni = index + 1;
    if (ni >= deck.length) return finish();
    setIndex(ni);
  };

  const next = () => advance(true);
  const pass = () => {
    recordPass();
    if (haptics) Haptics.selectionAsync().catch(() => {});
    const ni = index + 1;
    if (ni >= deck.length) return finish();
    setIndex(ni);
  };

  const progress = (index + 1) / deck.length;
  const isAdvance = ADVANCE_MODES.includes(card.mode);

  const renderContent = () => {
    if (locked) return <LockedContent onUnlock={() => router.push("/paywall")} onSkip={pass} pal={pal} />;
    switch (card.mode) {
      case "qui-est-le-plus":
        return <VoteContent key={card.id} card={card} players={players} sober={soberMode} onDone={next} recordVote={recordVote} haptics={haptics} pal={pal} />;
      case "tu-me-connais":
        return <PairContent key={card.id} card={card} targets={targets[index] ?? players.slice(0, 2)} onDone={next} recordCorrect={recordCorrect} haptics={haptics} pal={pal} />;
      case "le-verdict":
        return <VerdictContent key={card.id} card={card} players={players} target={targets[index]?.[0] ?? players[0]} sober={soberMode} onDone={next} haptics={haptics} pal={pal} />;
      case "bombe":
        return <BombeContent key={card.id} card={card} sober={soberMode} pal={pal} haptics={haptics} sound={soundEnabled} onDone={next} />;
      default:
        return <TextContent key={card.id} card={card} target={targets[index]?.[0]} sober={soberMode} pal={pal} />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Subtle mode-tinted glow + oversized glyph watermark */}
      <View style={[styles.glow, { backgroundColor: hexAlpha(pal.color, colors.isDark ? 0.13 : 0.1) }]} pointerEvents="none" />
      {meta && (
        <MaterialCommunityIcons name={meta.icon as any} size={300} color={pal.color} style={styles.watermark} pointerEvents="none" />
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.replace("/hub")} style={styles.closeBtn} testID="game-exit" hitSlop={10}>
          <MaterialCommunityIcons name="close" size={22} color={pal.fg} />
        </Pressable>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: pal.color }]} />
          </View>
          <Text style={styles.progressText}>{index + 1} / {deck.length}</Text>
        </View>
        <View style={styles.intensityPill}>
          <View style={[styles.intensityDot, { backgroundColor: INTENSITY_COLORS[card.intensite] }]} />
          <Text style={styles.intensityText}>{INTENSITY_LABEL[card.intensite]}</Text>
        </View>
        <Pressable onPress={() => setRulesVisible(true)} style={styles.infoBtn} testID="game-rules-button" hitSlop={10}>
          <MaterialCommunityIcons name="help-circle-outline" size={22} color={pal.fg} />
        </Pressable>
      </View>

      {/* Card content */}
      {isAdvance && !locked ? (
        <Pressable style={styles.cardArea} onPress={next} testID="card-advance">
          <Animated.View style={[styles.animWrap, cardAnimStyle]}>{renderContent()}</Animated.View>
          <View style={styles.tapHintRow}>
            <MaterialCommunityIcons name="gesture-tap" size={14} color={pal.faint} />
            <Text style={[styles.tapHint, { color: pal.faint }]}>Tape n'importe où pour continuer</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.cardArea}>
          <Animated.View style={[styles.animWrap, cardAnimStyle]}>{renderContent()}</Animated.View>
        </View>
      )}

      {/* Bottom: thermometer + pass (hidden for La Bombe — it owns its own loop) */}
      {!locked && card.mode !== "bombe" && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.thermo} testID="intensity-thermometer">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <View
                key={lvl}
                style={[
                  styles.thermoSeg,
                  { backgroundColor: lvl <= card.intensite ? INTENSITY_COLORS[lvl] : colors.surfaceTertiary },
                ]}
              />
            ))}
          </View>
          <Pressable onPress={pass} style={styles.passBtn} testID="pass-button" hitSlop={8}>
            <MaterialCommunityIcons name="skip-next" size={18} color={pal.muted} />
            <Text style={[styles.passText, { color: pal.muted }]}>Passer</Text>
          </Pressable>
        </View>
      )}

      {/* How-to-play notice for the current game */}
      <Modal visible={rulesVisible} transparent animationType="fade" onRequestClose={() => setRulesVisible(false)}>
        <Pressable style={styles.rulesBackdrop} onPress={() => setRulesVisible(false)} testID="game-rules-backdrop">
          <Pressable style={styles.rulesCard} onPress={() => {}} testID="game-rules-card">
            <View style={[styles.rulesIcon, { backgroundColor: hexAlpha(pal.color, 0.16) }]}>
              <MaterialCommunityIcons name={(meta?.icon as any) || "help-circle-outline"} size={26} color={pal.color} />
            </View>
            <Text style={styles.rulesTitle}>{meta?.label || "Comment jouer"}</Text>
            <Text style={styles.rulesBody}>{HOW_TO_PLAY[card.mode] || HOW_TO_PLAY["soiree"]}</Text>
            <Pressable onPress={() => setRulesVisible(false)} style={[styles.rulesBtn, { backgroundColor: colors.brand }]} testID="game-rules-close">
              <Text style={[styles.rulesBtnText, { color: colors.onBrand }]}>C'EST COMPRIS</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface, overflow: "hidden" },
    center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
    glow: { position: "absolute", top: -120, alignSelf: "center", width: 360, height: 360, borderRadius: 180 },
    watermark: { position: "absolute", bottom: -50, right: -60, opacity: c.isDark ? 0.05 : 0.06, transform: [{ rotate: "-10deg" }] },
    topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: SPACING.md, paddingBottom: 8 },
    closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
    progressWrap: { flex: 1, gap: 5 },
    progressTrack: { height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: c.surfaceTertiary },
    progressFill: { height: 5, borderRadius: 3 },
    progressText: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 0.5, textAlign: "center", color: c.muted },
    intensityPill: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
    intensityDot: { width: 8, height: 8, borderRadius: 4 },
    intensityText: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 0.5, color: c.onSurface },
    infoBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
    cardArea: { flex: 1, paddingHorizontal: SPACING.lg },
    animWrap: { flex: 1 },
    tapHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingBottom: 2 },
    tapHint: { textAlign: "center", fontFamily: FONTS.bodyRegular, fontSize: 12 },
    bottomBar: { alignItems: "center", paddingTop: 6, gap: 10 },
    thermo: { flexDirection: "row", gap: 6 },
    thermoSeg: { width: 34, height: 7, borderRadius: 4 },
    passBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 20 },
    passText: { fontFamily: FONTS.body, fontSize: 15 },
    emptyTitle: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 26, textAlign: "center" },
    emptySub: { fontFamily: FONTS.body, color: c.muted, fontSize: 15, textAlign: "center" },
    emptyBtn: { minHeight: 56, paddingHorizontal: 32, borderRadius: 28, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", marginTop: 12 },
    emptyBtnText: { fontFamily: FONTS.displaySemi, color: c.onBrand, fontSize: 16 },
    rulesBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
    rulesCard: { width: "100%", maxWidth: 380, backgroundColor: c.surfaceSecondary, borderRadius: 24, borderWidth: 1, borderColor: c.border, padding: 24, alignItems: "center" },
    rulesIcon: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    rulesTitle: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 24, textAlign: "center" },
    rulesBody: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12 },
    rulesBtn: { minHeight: 52, alignSelf: "stretch", borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 22 },
    rulesBtnText: { fontFamily: FONTS.displaySemi, fontSize: 15, letterSpacing: 0.5 },
  });
