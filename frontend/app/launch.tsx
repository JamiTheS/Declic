 
import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useApp } from "@/src/context/AppContext";
import { useCatalog } from "@/src/context/CatalogContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, HOW_TO_PLAY, Colors } from "@/src/theme/tokens";
import PrimaryButton from "@/src/components/PrimaryButton";

export default function Launch() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ preset?: string }>();
  const { isPremium, startSession } = useApp();
  const { presets, vibes } = useCatalog();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [preset, setPreset] = useState<string>(params.preset || "all");
  const [vibe, setVibe] = useState<string>("all");

  const selectedVibe = vibes.find((v) => v.id === vibe);
  const selectedPreset = presets.find((p) => p.id === preset);

  const launch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const needsPremium =
      (selectedVibe?.hot ?? false) || (vibe === "all" && (selectedPreset?.premium ?? false));
    if (needsPremium && !isPremium) {
      router.push("/paywall");
      return;
    }
    startSession("soiree", selectedPreset?.label ?? null);
    router.push({ pathname: "/game", params: { mode: "soiree", preset, vibe } });
  };

  const Chip = ({ active, label, sub, locked, onPress, testID }: {
    active: boolean; label: string; sub?: string; locked?: boolean; onPress: () => void; testID: string;
  }) => (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}
      testID={testID}
    >
      <Text style={[styles.chipLabel, { color: active ? colors.onBrand : colors.onSurface }]} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={[styles.chipSub, { color: active ? colors.onBrand : colors.muted }]}>{sub}</Text> : null}
      {locked && <MaterialCommunityIcons name="lock" size={13} color={active ? colors.onBrand : colors.brand} style={{ marginLeft: 6 }} />}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="launch-back" hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Soirée Déclic</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>AMBIANCE SUR-MESURE</Text>
        <Text style={styles.title}>Choisis ta vibe</Text>
        <Text style={styles.sub}>Sélectionne un preset et une vibe — ou laisse Déclic tout mélanger.</Text>

        <View style={styles.howCard} testID="launch-how-to-play">
          <View style={styles.howHeader}>
            <MaterialCommunityIcons name="gamepad-variant-outline" size={20} color={colors.brand} />
            <Text style={styles.howTitle}>Comment jouer</Text>
          </View>
          <Text style={styles.howText}>{HOW_TO_PLAY["soiree"]}</Text>
        </View>

        <Text style={styles.section}>Preset</Text>
        <View style={styles.chipWrap}>
          <Chip active={preset === "all"} label="Tout le catalogue" onPress={() => setPreset("all")} testID="preset-all" />
          {presets.map((p) => (
            <Chip key={p.id} active={preset === p.id} label={p.label} sub={`${p.count}`} locked={p.premium && !isPremium} onPress={() => setPreset(p.id)} testID={`preset-${p.id}`} />
          ))}
        </View>

        <Text style={styles.section}>Vibe</Text>
        <View style={styles.chipWrap}>
          <Chip active={vibe === "all"} label="Toutes" onPress={() => setVibe("all")} testID="vibe-all" />
          {vibes.map((v) => (
            <Chip key={v.id} active={vibe === v.id} label={v.label} sub={`${v.count}`} locked={v.hot && !isPremium} onPress={() => setVibe(v.id)} testID={`vibe-${v.id}`} />
          ))}
        </View>

        {selectedVibe?.hot && (
          <View style={styles.hotNote}>
            <MaterialCommunityIcons name="fire" size={18} color={colors.brand} />
            <Text style={styles.hotText}>La vibe Hot est réservée aux majeurs et aux abonnés Premium.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton label="LANCER LA SOIRÉE" onPress={launch} testID="launch-start" haptic="heavy" />
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingBottom: 8 },
    backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 20 },
    kicker: { fontFamily: FONTS.bodyBold, color: c.brand, letterSpacing: 2.5, fontSize: 12, marginTop: 8 },
    title: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 38, marginTop: 6 },
    sub: { fontFamily: FONTS.body, color: c.muted, fontSize: 15, marginTop: 8, lineHeight: 21 },
    howCard: { marginTop: 20, backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 16 },
    howHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    howTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 16 },
    howText: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
    section: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 20, marginTop: 28, marginBottom: 14 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: 18, borderRadius: RADIUS.pill, borderWidth: 1 },
    chipLabel: { fontFamily: FONTS.displaySemi, fontSize: 16 },
    chipSub: { fontFamily: FONTS.body, fontSize: 12, marginLeft: 8, opacity: 0.85 },
    hotNote: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, padding: 14, borderRadius: RADIUS.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
    hotText: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 13, flex: 1, lineHeight: 18 },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: SPACING.lg, paddingTop: 14, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  });
