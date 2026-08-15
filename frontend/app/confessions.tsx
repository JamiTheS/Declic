import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Platform } from "react-native";

import { useApp } from "@/src/context/AppContext";
import { useCatalog } from "@/src/context/CatalogContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, MODE_META, modePalette, hexAlpha, Colors } from "@/src/theme/tokens";
import { Player } from "@/src/types";

type Confession = { author: Player; text: string };
type Phase = "intro" | "handoff" | "input" | "reveal" | "done";

/**
 * Confessions anonymes — pass-and-play, single device.
 *
 * PRIVACY (non-negotiable): confessions are sensitive personal data. They live
 * ONLY in component state, are NEVER persisted (no storage / SecureStore /
 * cache), NEVER sent to the backend or analytics (no /api, no logEvent), and
 * are wiped when the round ends or the screen is left.
 */
export default function Confessions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { players, haptics } = useApp();
  const { cards } = useCatalog();
  const { colors } = useTheme();
  const pal = useMemo(() => modePalette("confession", colors), [colors]);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const meta = MODE_META["confession"];

  // Optional inspiration prompts (theme only — the core content is written by
  // the players). Sourced from the catalog if any "confession" cards exist.
  const prompts = useMemo(
    () => cards.filter((c) => c.actif && c.mode === "confession").map((c) => c.texte),
    [cards]
  );
  const theme = useMemo(
    () => (prompts.length ? prompts[Math.floor(Math.random() * prompts.length)] : null),
    [prompts]
  );

  const [phase, setPhase] = useState<Phase>("intro");
  const [turn, setTurn] = useState(0); // which player is writing
  const [draft, setDraft] = useState("");
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [order, setOrder] = useState<number[]>([]); // shuffled reveal order
  const [revealIdx, setRevealIdx] = useState(0);
  const [guess, setGuess] = useState<Player | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [mystery, setMystery] = useState<Record<string, number>>({}); // authorId -> fooled the group

  const enough = players.length >= 3;

  useEffect(() => {
    if (Platform.OS !== "web") {
      activateKeepAwakeAsync().catch(() => {});
      return () => { deactivateKeepAwake().catch(() => {}); };
    }
  }, []);

  // Belt-and-braces wipe on unmount — never let confessions outlive the screen.
  useEffect(() => {
    return () => {
      setConfessions([]);
      setDraft("");
    };
  }, []);

  const buzz = () => haptics && Haptics.selectionAsync().catch(() => {});

  const startCollect = () => {
    buzz();
    setConfessions([]);
    setTurn(0);
    setPhase("handoff");
  };

  const saveDraft = () => {
    const text = draft.trim();
    if (!text) return;
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = [...confessions, { author: players[turn], text }];
    setConfessions(next);
    setDraft("");
    if (turn + 1 >= players.length) {
      // Shuffle reveal order, then move to reveal phase.
      const idx = next.map((_, i) => i).sort(() => Math.random() - 0.5);
      setOrder(idx);
      setRevealIdx(0);
      setGuess(null);
      setRevealed(false);
      setPhase("reveal");
    } else {
      setTurn(turn + 1);
      setPhase("handoff");
    }
  };

  const doReveal = () => {
    if (!guess) return;
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const current = confessions[order[revealIdx]];
    const correct = guess.id === current.author.id;
    if (!correct) {
      setMystery((m) => ({ ...m, [current.author.id]: (m[current.author.id] || 0) + 1 }));
    }
    setRevealed(true);
  };

  const nextReveal = () => {
    buzz();
    if (revealIdx + 1 >= order.length) {
      setPhase("done");
      return;
    }
    setRevealIdx(revealIdx + 1);
    setGuess(null);
    setRevealed(false);
  };

  const finish = () => {
    // Final wipe before leaving.
    setConfessions([]);
    setDraft("");
    router.replace("/hub");
  };

  const Header = ({ title }: { title: string }) => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={finish} style={styles.backBtn} testID="confession-exit" hitSlop={10}>
        <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  // ---- Not enough players ----
  if (!enough) {
    return (
      <View style={styles.container}>
        <Header title="Confessions" />
        <View style={styles.center} testID="confession-need-players">
          <View style={[styles.bigIcon, { backgroundColor: hexAlpha(meta.color, 0.16) }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={40} color={meta.color} />
          </View>
          <Text style={styles.bigTitle}>Il faut au moins 3 joueurs</Text>
          <Text style={styles.bigSub}>
            Ajoute des joueurs pour lancer les confessions anonymes.
          </Text>
          <Pressable style={[styles.cta, { backgroundColor: colors.brand }]} onPress={() => router.replace("/setup")} testID="confession-add-players">
            <Text style={[styles.ctaText, { color: colors.onBrand }]}>AJOUTER DES JOUEURS</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Intro ----
  if (phase === "intro") {
    return (
      <View style={styles.container}>
        <Header title="Confessions" />
        <View style={styles.center}>
          <View style={[styles.bigIcon, { backgroundColor: hexAlpha(meta.color, 0.16) }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={40} color={meta.color} />
          </View>
          <Text style={styles.bigTitle}>Confessions anonymes</Text>
          <Text style={styles.bigSub}>
            Chacun écrit une confession en secret. L'app les mélange, le groupe devine qui l'a écrite,
            puis on révèle l'auteur.
          </Text>
          {theme && (
            <View style={[styles.themeChip, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
              <Text style={[styles.themeLabel, { color: pal.muted }]}>THÈME DE LA MANCHE</Text>
              <Text style={[styles.themeText, { color: pal.fg }]}>{theme}</Text>
            </View>
          )}
          <View style={[styles.privacyNote, { borderColor: pal.overlayBorder }]}>
            <MaterialCommunityIcons name="shield-lock-outline" size={16} color={colors.success} />
            <Text style={[styles.privacyText, { color: colors.muted }]}>
              100% privé : rien n'est enregistré ni envoyé. Tout s'efface à la fin.
            </Text>
          </View>
          <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={startCollect} testID="confession-start">
            <Text style={[styles.ctaText, { color: pal.onAccent }]}>COMMENCER</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Handoff (pass the phone privately) ----
  if (phase === "handoff") {
    const p = players[turn];
    return (
      <View style={styles.container}>
        <Header title={`Écriture · ${turn + 1}/${players.length}`} />
        <View style={styles.center}>
          <Text style={styles.handoffEmoji}>{p.emoji}</Text>
          <Text style={styles.bigTitle}>Passe le tél à {p.name}</Text>
          <Text style={styles.bigSub}>Personne d'autre ne regarde 🙈</Text>
          <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={() => { buzz(); setPhase("input"); }} testID="confession-imready">
            <Text style={[styles.ctaText, { color: pal.onAccent }]}>JE SUIS {p.name.toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Private input ----
  if (phase === "input") {
    const p = players[turn];
    return (
      <View style={styles.container}>
        <Header title={`Écriture · ${turn + 1}/${players.length}`} />
        <KeyboardAwareScrollView
          bottomOffset={20}
          contentContainerStyle={styles.inputScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.inputTitle, { color: pal.fg }]}>{p.emoji} {p.name}, écris ta confession</Text>
          <Text style={styles.inputSub}>Personne ne verra que c'est toi.</Text>
          {theme && <Text style={[styles.inputTheme, { color: pal.muted }]}>💭 {theme}</Text>}
          <TextInput
            style={[styles.input, { color: pal.fg, backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ma confession…"
            placeholderTextColor={colors.faint}
            multiline
            autoFocus
            secureTextEntry={false}
            maxLength={280}
            testID="confession-input"
          />
          <Text style={styles.counter}>{draft.trim().length}/280</Text>
          <Pressable
            style={[styles.cta, { backgroundColor: draft.trim() ? pal.color : colors.surfaceTertiary }]}
            onPress={saveDraft}
            disabled={!draft.trim()}
            testID="confession-save"
          >
            <Text style={[styles.ctaText, { color: draft.trim() ? pal.onAccent : colors.muted }]}>
              C'EST ÉCRIT, JE PASSE
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  // ---- Reveal ----
  if (phase === "reveal") {
    const current = confessions[order[revealIdx]];
    return (
      <View style={styles.container}>
        <Header title={`Révélation · ${revealIdx + 1}/${order.length}`} />
        <View style={styles.revealBody}>
          <View style={[styles.quoteCard, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
            <MaterialCommunityIcons name="format-quote-open" size={26} color={pal.color} />
            <Text style={[styles.quoteText, { color: pal.fg }]} testID="confession-text">{current.text}</Text>
          </View>

          {!revealed ? (
            <>
              <Text style={styles.revealHint}>Le groupe débat… puis désigne l'auteur 👇</Text>
              <View style={styles.grid}>
                {players.map((p) => {
                  const sel = guess?.id === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.suspect, { backgroundColor: sel ? pal.color : pal.chipBg, borderColor: sel ? pal.color : pal.overlayBorder }]}
                      onPress={() => { buzz(); setGuess(p); }}
                      testID={`confession-suspect-${p.id}`}
                    >
                      <Text style={styles.suspectEmoji}>{p.emoji}</Text>
                      <Text style={[styles.suspectName, { color: sel ? pal.onAccent : pal.fg }]} numberOfLines={1}>{p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={[styles.cta, { backgroundColor: guess ? pal.color : colors.surfaceTertiary }]}
                onPress={doReveal}
                disabled={!guess}
                testID="confession-reveal"
              >
                <Text style={[styles.ctaText, { color: guess ? pal.onAccent : colors.muted }]}>RÉVÉLER L'AUTEUR</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.resultBlock}>
              <Text style={styles.resultEmoji}>{current.author.emoji}</Text>
              <Text style={[styles.resultName, { color: pal.fg }]} testID="confession-author">
                C'était {current.author.name}
              </Text>
              <Text style={[styles.resultVerdict, { color: guess?.id === current.author.id ? colors.success : colors.warning }]}>
                {guess?.id === current.author.id ? "Le groupe a trouvé ! 🎯" : "Le groupe s'est fait avoir 😈"}
              </Text>
              <Pressable style={[styles.cta, { backgroundColor: pal.color, marginTop: 18 }]} onPress={nextReveal} testID="confession-next">
                <Text style={[styles.ctaText, { color: pal.onAccent }]}>
                  {revealIdx + 1 >= order.length ? "VOIR LE RÉCAP" : "CONFESSION SUIVANTE"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ---- Done / recap ----
  const master = players
    .map((p) => ({ p, score: mystery[p.id] || 0 }))
    .sort((a, b) => b.score - a.score)[0];
  return (
    <View style={styles.container}>
      <Header title="Récap" />
      <View style={styles.center}>
        <Text style={styles.handoffEmoji}>🕵️</Text>
        <Text style={styles.bigTitle}>Manche terminée</Text>
        {master && master.score > 0 ? (
          <Text style={styles.bigSub}>
            Maître·sse du mystère : {master.p.emoji} {master.p.name} — a bluffé le groupe {master.score} fois.
          </Text>
        ) : (
          <Text style={styles.bigSub}>Le groupe vous connaît par cœur : aucune confession n'a échappé à personne !</Text>
        )}
        <View style={[styles.privacyNote, { borderColor: pal.overlayBorder }]}>
          <MaterialCommunityIcons name="delete-outline" size={16} color={colors.success} />
          <Text style={[styles.privacyText, { color: colors.muted }]}>Les confessions viennent d'être effacées.</Text>
        </View>
        <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={finish} testID="confession-finish">
          <Text style={[styles.ctaText, { color: pal.onAccent }]}>TERMINER</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingBottom: 8 },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
    headerTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 16 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, gap: 14 },
    bigIcon: { width: 76, height: 76, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    bigTitle: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 30, textAlign: "center", lineHeight: 34 },
    bigSub: { fontFamily: FONTS.body, color: c.muted, fontSize: 16, textAlign: "center", lineHeight: 23, paddingHorizontal: 6 },
    themeChip: { alignSelf: "stretch", borderRadius: RADIUS.md, borderWidth: 1, padding: 16, alignItems: "center", gap: 4 },
    themeLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5 },
    themeText: { fontFamily: FONTS.displaySemi, fontSize: 18, textAlign: "center" },
    privacyNote: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, alignSelf: "stretch" },
    privacyText: { fontFamily: FONTS.body, fontSize: 12, flexShrink: 1 },
    cta: { minHeight: 64, alignSelf: "stretch", borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, marginTop: 6 },
    ctaText: { fontFamily: FONTS.display, fontSize: 17, letterSpacing: 0.5 },
    handoffEmoji: { fontSize: 72 },
    inputScroll: { padding: SPACING.lg, gap: 12, flexGrow: 1, justifyContent: "center" },
    inputTitle: { fontFamily: FONTS.display, fontSize: 26, textAlign: "center" },
    inputSub: { fontFamily: FONTS.body, color: c.muted, fontSize: 14, textAlign: "center" },
    inputTheme: { fontFamily: FONTS.body, fontSize: 13, textAlign: "center" },
    input: { minHeight: 130, borderRadius: RADIUS.md, borderWidth: 1, padding: 16, fontFamily: FONTS.body, fontSize: 18, textAlignVertical: "top" },
    counter: { fontFamily: FONTS.body, color: c.faint, fontSize: 12, textAlign: "right" },
    revealBody: { flex: 1, padding: SPACING.lg, gap: 16, justifyContent: "center" },
    quoteCard: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 22, gap: 8 },
    quoteText: { fontFamily: FONTS.displaySemi, fontSize: 24, lineHeight: 30 },
    revealHint: { fontFamily: FONTS.body, color: c.muted, fontSize: 14, textAlign: "center" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
    suspect: { width: "47%", minHeight: 64, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
    suspectEmoji: { fontSize: 22 },
    suspectName: { fontFamily: FONTS.displaySemi, fontSize: 17, maxWidth: "62%" },
    resultBlock: { alignItems: "center", gap: 6 },
    resultEmoji: { fontSize: 64 },
    resultName: { fontFamily: FONTS.display, fontSize: 30, textAlign: "center" },
    resultVerdict: { fontFamily: FONTS.body, fontSize: 16, textAlign: "center" },
  });
