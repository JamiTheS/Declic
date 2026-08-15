import { useMemo, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { useApp } from "@/src/context/AppContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, Colors } from "@/src/theme/tokens";
import PrimaryButton from "@/src/components/PrimaryButton";
import { Player } from "@/src/types";

function topOf(obj: Record<string, number>, players: Player[]): { player: Player; count: number } | null {
  let best: string | null = null;
  let max = 0;
  for (const [id, v] of Object.entries(obj)) {
    if (v > max) { max = v; best = id; }
  }
  const player = best ? players.find((p) => p.id === best) : null;
  return player ? { player, count: max } : null;
}

export default function Recap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stats, players } = useApp();
  const { colors } = useTheme();
  const cardRef = useRef<View>(null);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const star = topOf(stats.voteCounts, players);
  const spotlight = topOf(stats.targetCounts, players);

  const superlatives: { icon: string; label: string; value: string }[] = [];
  if (star) superlatives.push({ icon: "target-account", label: "La plus désignée", value: `${star.player.emoji} ${star.player.name}` });
  if (spotlight && (!star || spotlight.player.id !== star.player.id))
    superlatives.push({ icon: "star-face", label: "Sous le feu des projecteurs", value: `${spotlight.player.emoji} ${spotlight.player.name}` });
  if (stats.correctGuesses > 0)
    superlatives.push({ icon: "brain", label: "Devinettes réussies", value: `${stats.correctGuesses}` });

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 0.95 });
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { dialogTitle: "Partager ta soirée Déclic" });
      }
    } catch { /* best-effort */ }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: SPACING.lg }} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>La soirée est finie 🎉</Text>
        <Text style={styles.subheading}>Voilà votre récap. Prêt·e à le balancer en story ?</Text>

        {/* Shareable card — single-hue editorial duotone */}
        <View ref={cardRef} collapsable={false} style={styles.shareCard}>
          <LinearGradient colors={["#7A2E24", "#2A1512", "#0B0B0E"]} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />
          <Text style={styles.cardKicker}>RÉCAP DE SOIRÉE</Text>
          <Text style={styles.cardTitle}>Déclic Wrapped</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}><Text style={styles.statNum}>{stats.cardsPlayed}</Text><Text style={styles.statLabel}>cartes jouées</Text></View>
            <View style={styles.statBox}><Text style={styles.statNum}>{stats.reveals}</Text><Text style={styles.statLabel}>secrets révélés</Text></View>
            <View style={styles.statBox}><Text style={styles.statNum}>{players.length}</Text><Text style={styles.statLabel}>joueurs</Text></View>
          </View>

          <View style={styles.superList}>
            {superlatives.length > 0 ? (
              superlatives.map((s) => (
                <View key={s.label} style={styles.superRow}>
                  <MaterialCommunityIcons name={s.icon as any} size={22} color="#E8654F" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.superLabel}>{s.label}</Text>
                    <Text style={styles.superValue}>{s.value}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.superValue}>Une soirée pleine de révélations 🔥</Text>
            )}
          </View>

          <View style={styles.watermark}>
            <View style={styles.wmDot} />
            <Text style={styles.wmText}>DÉCLIC · Le jeu qui révèle tes potes</Text>
          </View>
        </View>

        <View style={{ gap: 12, marginTop: 24 }}>
          <PrimaryButton label="PARTAGER MA SOIRÉE" onPress={share} testID="share-button" haptic="heavy" />
          <PrimaryButton label="REJOUER" variant="outline" onPress={() => router.replace("/hub")} testID="replay-button" />
          <Pressable onPress={() => router.replace("/hub")} style={styles.doneLink} testID="recap-done">
            <Text style={styles.doneText}>Terminer</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    heading: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 34, lineHeight: 38 },
    subheading: { fontFamily: FONTS.body, color: c.muted, fontSize: 16, marginTop: 8, marginBottom: 24 },
    shareCard: { borderRadius: RADIUS.lg, padding: SPACING.lg, overflow: "hidden", minHeight: 420 },
    cardKicker: { fontFamily: FONTS.bodyBold, color: "rgba(244,241,234,0.75)", fontSize: 12, letterSpacing: 2.5 },
    cardTitle: { fontFamily: FONTS.display, color: "#F4F1EA", fontSize: 42, marginTop: 4 },
    statsRow: { flexDirection: "row", gap: 12, marginTop: 28 },
    statBox: { flex: 1, backgroundColor: "rgba(0,0,0,0.28)", borderRadius: RADIUS.md, padding: 14, alignItems: "center" },
    statNum: { fontFamily: FONTS.display, color: "#F4F1EA", fontSize: 30 },
    statLabel: { fontFamily: FONTS.body, color: "rgba(244,241,234,0.75)", fontSize: 11, textAlign: "center", marginTop: 2 },
    superList: { marginTop: 24, gap: 14 },
    superRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    superLabel: { fontFamily: FONTS.body, color: "rgba(244,241,234,0.72)", fontSize: 12 },
    superValue: { fontFamily: FONTS.displaySemi, color: "#F4F1EA", fontSize: 20 },
    watermark: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 32 },
    wmDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E8654F" },
    wmText: { fontFamily: FONTS.bodyBold, color: "rgba(244,241,234,0.9)", fontSize: 12, letterSpacing: 0.5 },
    doneLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    doneText: { fontFamily: FONTS.body, color: c.muted, fontSize: 15 },
  });
