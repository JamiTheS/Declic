 
import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useApp } from "@/src/context/AppContext";
import { useCatalog } from "@/src/context/CatalogContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, MODE_META, hexAlpha, Colors } from "@/src/theme/tokens";
import { Ambiance } from "@/src/types";

const SOIREE_IMG =
  "https://images.unsplash.com/photo-1763322564752-12ce8fae2bfe?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwxfHxuZW9uJTIwcGFydHklMjBjcm93ZCUyMGFic3RyYWN0JTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODY3NTkyNDd8MA&ixlib=rb-4.1.0&q=85";

const GRID_MODES = [
  "qui-est-le-plus", "je-nai-jamais", "bombe", "action-verite",
  "cash-ou-cash", "confession", "imposteur", "le-verdict", "tu-me-connais", "hot",
];
const PREMIUM_MODES = new Set(["le-verdict", "tu-me-connais", "hot"]);
const ROUTED_MODES: Record<string, string> = { confession: "/confessions", imposteur: "/imposteur" };

const AMBIANCES: { id: Ambiance; label: string; emoji: string }[] = [
  { id: "chill", label: "Chill", emoji: "😎" },
  { id: "standard", label: "Standard", emoji: "🔥" },
  { id: "chaud", label: "Chaud", emoji: "🌶️" },
];

export default function Hub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { players, isPremium, ambiance, setAmbiance, startSession } = useApp();
  const { presets } = useCatalog();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const launchMode = (mode: string, premium: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Modes with their own dedicated screen (e.g. Confessions needs a private
    // collection phase) are routed instead of running the card renderer.
    if (ROUTED_MODES[mode]) {
      router.push(ROUTED_MODES[mode] as any);
      return;
    }
    if (premium && !isPremium) {
      router.push("/paywall");
      return;
    }
    startSession(mode, null);
    router.push({ pathname: "/game", params: { mode } });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View>
            <Text style={styles.logo}>DÉCLIC</Text>
            <Pressable
              style={styles.playersRow}
              onPress={() => router.push({ pathname: "/setup", params: { edit: "1" } })}
              testID="edit-players"
              hitSlop={8}
            >
              <Text style={styles.playersLine}>
                {players.length} joueur{players.length > 1 ? "s" : ""} en piste
              </Text>
              <MaterialCommunityIcons name="pencil" size={13} color={colors.brand} />
            </Pressable>
          </View>
          <Pressable onPress={() => router.push("/settings")} style={styles.iconBtn} testID="settings-button" hitSlop={8}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Ambiance selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ambRow}>
          {AMBIANCES.map((a) => {
            const active = ambiance === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  setAmbiance(a.id);
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={[
                  styles.ambChip,
                  { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border },
                ]}
                testID={`ambiance-${a.id}`}
              >
                <Text style={styles.ambEmoji}>{a.emoji}</Text>
                <Text style={[styles.ambLabel, { color: active ? colors.onBrand : colors.onSurface }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Featured: Soirée Déclic */}
        <Pressable
          style={styles.featured}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push("/launch");
          }}
          testID="mode-soiree"
        >
          <Image source={{ uri: SOIREE_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(11,11,14,0.15)", "rgba(11,11,14,0.7)", "rgba(11,11,14,0.97)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.featuredContent}>
            <View style={styles.badge}>
              <MaterialCommunityIcons name="star-four-points" size={12} color={colors.onBrand} />
              <Text style={styles.badgeText}>MODE PHARE</Text>
            </View>
            <Text style={styles.featuredTitle}>Soirée Déclic</Text>
            <Text style={styles.featuredSub}>
              Laisse-toi porter. L'app monte l'ambiance toute seule, du chill à l'intime.
            </Text>
            <View style={styles.playBtn}>
              <MaterialCommunityIcons name="play" size={20} color={colors.onBrand} />
              <Text style={styles.playText}>LANCER LA SOIRÉE</Text>
            </View>
          </View>
        </Pressable>

        {/* Modes grid */}
        <Text style={styles.sectionTitle}>Modes de jeu</Text>
        <View style={styles.grid}>
          {GRID_MODES.map((mode) => {
            const meta = MODE_META[mode];
            const premium = PREMIUM_MODES.has(mode);
            const locked = premium && !isPremium;
            return (
              <Pressable
                key={mode}
                style={({ pressed }) => [styles.tile, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                onPress={() => launchMode(mode, premium)}
                testID={`mode-${mode}`}
              >
                <View style={[styles.tileBar, { backgroundColor: meta.color }]} />
                <MaterialCommunityIcons
                  name={meta.icon as any}
                  size={104}
                  color={meta.color}
                  style={styles.tileGlyph}
                  pointerEvents="none"
                />
                <View style={styles.tileTop}>
                  <View style={[styles.tileIconChip, { backgroundColor: hexAlpha(meta.color, 0.16) }]}>
                    <MaterialCommunityIcons name={meta.icon as any} size={22} color={meta.color} />
                  </View>
                  {locked && (
                    <View style={[styles.lockPill, { backgroundColor: colors.brandSoft }]}>
                      <MaterialCommunityIcons name="lock" size={10} color={colors.brand} />
                      <Text style={[styles.lockText, { color: colors.brand }]}>PREMIUM</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tileTitle}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Presets */}
        {presets.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Presets soirée</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packRow}>
              {presets.map((p) => {
                const locked = p.premium && !isPremium;
                return (
                  <Pressable
                    key={p.id}
                    style={styles.packCard}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      router.push({ pathname: "/launch", params: { preset: p.id } });
                    }}
                    testID={`preset-tile-${p.id}`}
                  >
                    <Text style={styles.packLabel}>{p.label}</Text>
                    <Text style={styles.packCount}>{p.count} cartes</Text>
                    {(locked || p.hot) && (
                      <View style={[styles.lockPill, { marginTop: 10, alignSelf: "flex-start", backgroundColor: colors.brandSoft }]}>
                        <MaterialCommunityIcons name={p.hot ? "fire" : "lock"} size={10} color={colors.brand} />
                        <Text style={[styles.lockText, { color: colors.brand }]}>{p.hot ? "18+ · PREMIUM" : "PREMIUM"}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: SPACING.lg, paddingBottom: 18 },
    logo: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 32, letterSpacing: 1 },
    playersRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    playersLine: { fontFamily: FONTS.body, color: c.muted, fontSize: 13 },
    iconBtn: { width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    ambRow: { gap: 10, paddingHorizontal: SPACING.lg, paddingBottom: 22 },
    ambChip: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingHorizontal: 18, borderRadius: RADIUS.pill, borderWidth: 1, flexShrink: 0 },
    ambEmoji: { fontSize: 16 },
    ambLabel: { fontFamily: FONTS.bodyBold, fontSize: 15 },
    featured: {
      marginHorizontal: SPACING.lg,
      height: 250,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      justifyContent: "flex-end",
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
    },
    featuredContent: { padding: SPACING.lg },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: c.brand, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, marginBottom: 10 },
    badgeText: { fontFamily: FONTS.bodyBold, color: c.onBrand, fontSize: 10, letterSpacing: 1 },
    featuredTitle: { fontFamily: FONTS.display, color: "#F4F1EA", fontSize: 38, lineHeight: 40 },
    featuredSub: { fontFamily: FONTS.body, color: "rgba(244,241,234,0.82)", fontSize: 14, marginTop: 6, lineHeight: 20 },
    playBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.brand, alignSelf: "flex-start", paddingHorizontal: 20, height: 48, borderRadius: RADIUS.pill, marginTop: 16 },
    playText: { fontFamily: FONTS.displaySemi, color: c.onBrand, fontSize: 14, letterSpacing: 0.5 },
    sectionTitle: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 22, paddingHorizontal: SPACING.lg, marginTop: 34, marginBottom: 16 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingHorizontal: SPACING.lg },
    tile: {
      width: "47%",
      minHeight: 132,
      borderRadius: RADIUS.md,
      padding: 16,
      justifyContent: "space-between",
      overflow: "hidden",
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
    },
    tileBar: { position: "absolute", left: 0, top: 16, bottom: 16, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
    tileGlyph: { position: "absolute", right: -18, bottom: -20, opacity: 0.07 },
    tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    tileIconChip: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    tileTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 19, lineHeight: 22, marginTop: 12 },
    lockPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
    lockText: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 0.5 },
    packRow: { gap: 12, paddingHorizontal: SPACING.lg },
    packCard: { width: 150, minHeight: 100, backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 16, justifyContent: "center", flexShrink: 0 },
    packLabel: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 18 },
    packCount: { fontFamily: FONTS.body, color: c.muted, fontSize: 12, marginTop: 4 },
  });
