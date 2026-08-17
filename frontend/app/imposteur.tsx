import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { useApp } from "@/src/context/AppContext";
import { useCatalog } from "@/src/context/CatalogContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, MODE_META, modePalette, hexAlpha, Colors } from "@/src/theme/tokens";
import { Card, Player } from "@/src/types";

type Variant = "mots" | "questions";
type Phase = "intro" | "handoff" | "secret" | "answer" | "vote" | "verdict" | "done";
type Outcome = "impostor-survived" | "impostor-caught" | "impostor-redeemed";

const VARIANTS: { id: Variant; label: string; tagline: string; icon: string }[] = [
  { id: "mots", label: "Mots", tagline: "Un mot secret. L'imposteur en a un autre.", icon: "text-short" },
  { id: "questions", label: "Questions", tagline: "Tout le monde répond… sauf à la même question.", icon: "comment-question-outline" },
];

const shuffled = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * L'Imposteur — pass-and-play, single device.
 *
 * Everyone is shown a secret (card.texte), except one player who is shown a
 * near-miss variant of it (card.texte_b). Crucially NOBODY is told they are the
 * impostor: each player believes they hold the real secret, which is what makes
 * the round paranoid rather than a straight bluffing exercise. The impostor is
 * only revealed at the verdict, and then gets one shot at naming the real
 * secret to turn the gage back on the group.
 */
export default function Imposteur() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { players, haptics, soberMode, isPremium } = useApp();
  const { cards } = useCatalog();
  const { colors } = useTheme();
  const pal = useMemo(() => modePalette("imposteur", colors), [colors]);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const meta = MODE_META["imposteur"];

  const [variant, setVariant] = useState<Variant>("questions");
  const [card, setCard] = useState<Card | null>(null);
  const [impostorIdx, setImpostorIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [turn, setTurn] = useState(0);
  const [speakOrder, setSpeakOrder] = useState<number[]>([]);
  const [answerTurn, setAnswerTurn] = useState(0);
  const [suspect, setSuspect] = useState<Player | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const enough = players.length >= 3;

  // Free players only ever draw intensity 1-3 pairs; 4-5 are premium like the
  // rest of the catalog.
  const pool = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.actif &&
          c.mode === "imposteur" &&
          c.variante === variant &&
          !!c.texte_b &&
          (isPremium || !c.premium)
      ),
    [cards, variant, isPremium]
  );

  useEffect(() => {
    if (Platform.OS !== "web") {
      activateKeepAwakeAsync().catch(() => {});
      return () => { deactivateKeepAwake().catch(() => {}); };
    }
  }, []);

  const buzz = () => haptics && Haptics.selectionAsync().catch(() => {});

  const startRound = () => {
    if (!pool.length) return;
    buzz();
    setCard(pool[Math.floor(Math.random() * pool.length)]);
    setImpostorIdx(Math.floor(Math.random() * players.length));
    setSpeakOrder(shuffled(players.map((_, i) => i)));
    setTurn(0);
    setAnswerTurn(0);
    setSuspect(null);
    setOutcome(null);
    setPhase("handoff");
  };

  const closeSecret = () => {
    buzz();
    if (turn + 1 >= players.length) {
      setPhase("answer");
      return;
    }
    setTurn(turn + 1);
    setPhase("handoff");
  };

  const nextSpeaker = () => {
    buzz();
    if (answerTurn + 1 >= speakOrder.length) {
      setPhase("vote");
      return;
    }
    setAnswerTurn(answerTurn + 1);
  };

  const accuse = () => {
    if (!suspect) return;
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const caught = suspect.id === players[impostorIdx].id;
    setOutcome(caught ? "impostor-caught" : "impostor-survived");
    setPhase("verdict");
  };

  const settleRedemption = (found: boolean) => {
    if (haptics) {
      Haptics.notificationAsync(
        found ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
    }
    setOutcome(found ? "impostor-redeemed" : "impostor-caught");
    setPhase("done");
  };

  const finish = () => router.replace("/hub");

  const Header = ({ title }: { title: string }) => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={finish} style={styles.backBtn} testID="imposteur-exit" hitSlop={10}>
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
        <Header title="L'Imposteur" />
        <View style={styles.center} testID="imposteur-need-players">
          <View style={[styles.bigIcon, { backgroundColor: hexAlpha(meta.color, 0.16) }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={40} color={meta.color} />
          </View>
          <Text style={styles.bigTitle}>Il faut au moins 3 joueurs</Text>
          <Text style={styles.bigSub}>Sans public, l'imposteur n'a personne à berner.</Text>
          <Pressable style={[styles.cta, { backgroundColor: colors.brand }]} onPress={() => router.replace("/setup")} testID="imposteur-add-players">
            <Text style={[styles.ctaText, { color: colors.onBrand }]}>AJOUTER DES JOUEURS</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Intro / variant picker ----
  if (phase === "intro") {
    return (
      <View style={styles.container}>
        <Header title="L'Imposteur" />
        <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.bigIcon, { backgroundColor: hexAlpha(meta.color, 0.16) }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={40} color={meta.color} />
          </View>
          <Text style={styles.bigTitle}>L'Imposteur</Text>
          <Text style={styles.bigSub}>
            Le tél passe de main en main : chacun découvre son secret. Un seul en a reçu un autre —
            et il ne le sait pas non plus. À vous de le démasquer.
          </Text>

          <Text style={styles.pickerLabel}>CHOISIS TA VERSION</Text>
          <View style={styles.variantRow}>
            {VARIANTS.map((v) => {
              const sel = variant === v.id;
              return (
                <Pressable
                  key={v.id}
                  style={[styles.variantCard, { backgroundColor: sel ? pal.color : pal.chipBg, borderColor: sel ? pal.color : pal.overlayBorder }]}
                  onPress={() => { buzz(); setVariant(v.id); }}
                  testID={`imposteur-variant-${v.id}`}
                >
                  <MaterialCommunityIcons name={v.icon as any} size={26} color={sel ? pal.onAccent : pal.color} />
                  <Text style={[styles.variantLabel, { color: sel ? pal.onAccent : pal.fg }]}>{v.label}</Text>
                  <Text style={[styles.variantTag, { color: sel ? pal.onAccent : pal.muted }]}>{v.tagline}</Text>
                </Pressable>
              );
            })}
          </View>

          {!pool.length ? (
            <Text style={[styles.warn, { color: colors.warning }]} testID="imposteur-empty">
              Aucune carte disponible pour cette version.
            </Text>
          ) : (
            <Text style={styles.poolHint}>
              {pool.length} manche{pool.length > 1 ? "s" : ""} disponible{pool.length > 1 ? "s" : ""}
              {!isPremium ? " · intensités 4-5 en Premium" : ""}
            </Text>
          )}

          <Pressable
            style={[styles.cta, { backgroundColor: pool.length ? pal.color : colors.surfaceTertiary }]}
            onPress={startRound}
            disabled={!pool.length}
            testID="imposteur-start"
          >
            <Text style={[styles.ctaText, { color: pool.length ? pal.onAccent : colors.muted }]}>LANCER LA MANCHE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---- Handoff (pass the phone) ----
  if (phase === "handoff") {
    const p = players[turn];
    return (
      <View style={styles.container}>
        <Header title={`Secret · ${turn + 1}/${players.length}`} />
        <View style={styles.center}>
          <Text style={styles.handoffEmoji}>{p.emoji}</Text>
          <Text style={styles.bigTitle}>Passe le tél à {p.name}</Text>
          <Text style={styles.bigSub}>Personne d'autre ne regarde 🙈</Text>
          <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={() => { buzz(); setPhase("secret"); }} testID="imposteur-imready">
            <Text style={[styles.ctaText, { color: pal.onAccent }]}>JE SUIS {p.name.toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Private secret ----
  if (phase === "secret" && card) {
    const p = players[turn];
    // The impostor is shown texte_b. The screen is deliberately identical for
    // everyone: no one is told which side they are on.
    const secret = turn === impostorIdx ? card.texte_b! : card.texte;
    return (
      <View style={styles.container}>
        <Header title={`Secret · ${turn + 1}/${players.length}`} />
        <View style={styles.secretBody}>
          <Text style={styles.secretWho}>{p.emoji} {p.name}</Text>
          <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
            <Text style={[styles.secretLabel, { color: pal.muted }]}>
              {variant === "mots" ? "TON MOT" : "TA QUESTION"}
            </Text>
            <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-secret">{secret}</Text>
          </View>
          <Text style={styles.secretHint}>
            {variant === "mots"
              ? "Retiens-le. Tu devras donner des indices sans jamais le prononcer."
              : "Retiens-la. Tu devras y répondre à voix haute, sans jamais la lire."}
          </Text>
          <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={closeSecret} testID="imposteur-secret-ok">
            <Text style={[styles.ctaText, { color: pal.onAccent }]}>C'EST MÉMORISÉ</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Answer round ----
  if (phase === "answer") {
    const p = players[speakOrder[answerTurn]];
    return (
      <View style={styles.container}>
        <Header title={`Tour de table · ${answerTurn + 1}/${speakOrder.length}`} />
        <View style={styles.center}>
          <Text style={styles.handoffEmoji}>{p.emoji}</Text>
          <Text style={styles.bigTitle}>À {p.name}</Text>
          <Text style={styles.bigSub}>
            {variant === "mots"
              ? "Donne UN seul mot en rapport avec ton mot secret. Sans le prononcer."
              : "Réponds à ta question à voix haute. Sans jamais la lire."}
          </Text>
          <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={nextSpeaker} testID="imposteur-next-speaker">
            <Text style={[styles.ctaText, { color: pal.onAccent }]}>
              {answerTurn + 1 >= speakOrder.length ? "PASSER AU VOTE" : "SUIVANT"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Vote ----
  if (phase === "vote") {
    return (
      <View style={styles.container}>
        <Header title="Le vote" />
        <ScrollView contentContainerStyle={styles.voteBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.bigTitle}>Qui est l'imposteur ?</Text>
          <Text style={styles.bigSub}>Débattez, puis désignez ensemble un suspect.</Text>
          <View style={styles.grid}>
            {players.map((p) => {
              const sel = suspect?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.suspect, { backgroundColor: sel ? pal.color : pal.chipBg, borderColor: sel ? pal.color : pal.overlayBorder }]}
                  onPress={() => { buzz(); setSuspect(p); }}
                  testID={`imposteur-suspect-${p.id}`}
                >
                  <Text style={styles.suspectEmoji}>{p.emoji}</Text>
                  <Text style={[styles.suspectName, { color: sel ? pal.onAccent : pal.fg }]} numberOfLines={1}>{p.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.cta, { backgroundColor: suspect ? pal.color : colors.surfaceTertiary }]}
            onPress={accuse}
            disabled={!suspect}
            testID="imposteur-accuse"
          >
            <Text style={[styles.ctaText, { color: suspect ? pal.onAccent : colors.muted }]}>ACCUSER</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---- Verdict: reveal, then the impostor's one shot at redemption ----
  if (phase === "verdict" && card) {
    const impostor = players[impostorIdx];
    const caught = outcome === "impostor-caught";
    return (
      <View style={styles.container}>
        <Header title="Verdict" />
        <ScrollView contentContainerStyle={styles.voteBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.handoffEmoji}>{impostor.emoji}</Text>
          <Text style={styles.bigTitle}>L'imposteur était {impostor.name}</Text>
          <Text style={[styles.verdictLine, { color: caught ? colors.success : colors.warning }]}>
            {caught ? "Démasqué ! 🎯" : "Passé entre les mailles 😈"}
          </Text>

          {caught ? (
            <>
              <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
                <Text style={[styles.secretLabel, { color: pal.muted }]}>
                  {impostor.name.toUpperCase()} AVAIT
                </Text>
                <Text style={[styles.secretText, { color: pal.fg }]}>{card.texte_b}</Text>
              </View>
              <Text style={styles.bigSub}>
                Dernière chance : {impostor.name} annonce à voix haute ce que les autres avaient.
                S'il tombe juste, le gage se retourne contre le groupe.
              </Text>
              <View style={styles.redemptionRow}>
                <Pressable
                  style={[styles.redemptionBtn, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}
                  onPress={() => settleRedemption(false)}
                  testID="imposteur-redemption-fail"
                >
                  <Text style={[styles.redemptionText, { color: pal.fg }]}>Raté</Text>
                </Pressable>
                <Pressable
                  style={[styles.redemptionBtn, { backgroundColor: pal.color, borderColor: pal.color }]}
                  onPress={() => settleRedemption(true)}
                  testID="imposteur-redemption-win"
                >
                  <Text style={[styles.redemptionText, { color: pal.onAccent }]}>Il a trouvé !</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={() => setPhase("done")} testID="imposteur-to-done">
              <Text style={[styles.ctaText, { color: pal.onAccent }]}>VOIR LE GAGE</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---- Done: both secrets + who takes the gage ----
  const impostor = players[impostorIdx];
  const groupLoses = outcome === "impostor-survived" || outcome === "impostor-redeemed";
  const gageText = soberMode ? card?.alternative : card?.gage;
  return (
    <View style={styles.container}>
      <Header title="Fin de manche" />
      <ScrollView contentContainerStyle={styles.voteBody} showsVerticalScrollIndicator={false}>
        <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
          <Text style={[styles.secretLabel, { color: pal.muted }]}>LE GROUPE AVAIT</Text>
          <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-reveal-civils">{card?.texte}</Text>
        </View>
        <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: hexAlpha(meta.color, 0.5) }]}>
          <Text style={[styles.secretLabel, { color: pal.muted }]}>{impostor.name.toUpperCase()} AVAIT</Text>
          <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-reveal-impostor">{card?.texte_b}</Text>
        </View>

        <View style={[styles.gageBox, { borderColor: pal.overlayBorder, backgroundColor: hexAlpha(meta.color, 0.1) }]}>
          <Text style={[styles.gageWho, { color: pal.fg }]}>
            {groupLoses ? "Le groupe prend le gage" : `${impostor.name} prend le gage`}
          </Text>
          <Text style={[styles.gageText, { color: pal.muted }]} testID="imposteur-gage">{gageText}</Text>
          {outcome === "impostor-redeemed" && (
            <Text style={[styles.gageFlip, { color: colors.success }]}>Rattrapage réussi — retourné contre le groupe.</Text>
          )}
        </View>

        <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={startRound} testID="imposteur-replay">
          <Text style={[styles.ctaText, { color: pal.onAccent }]}>NOUVELLE MANCHE</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={finish} testID="imposteur-finish">
          <Text style={[styles.secondaryText, { color: colors.muted }]}>Terminer</Text>
        </Pressable>
      </ScrollView>
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
    introScroll: { padding: SPACING.lg, gap: 14, flexGrow: 1, justifyContent: "center", alignItems: "center" },
    bigIcon: { width: 76, height: 76, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    bigTitle: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 30, textAlign: "center", lineHeight: 34 },
    bigSub: { fontFamily: FONTS.body, color: c.muted, fontSize: 16, textAlign: "center", lineHeight: 23, paddingHorizontal: 6 },
    pickerLabel: { fontFamily: FONTS.bodyBold, color: c.muted, fontSize: 11, letterSpacing: 1.5, marginTop: 6 },
    variantRow: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
    variantCard: { flex: 1, borderRadius: RADIUS.md, borderWidth: 1, padding: 16, alignItems: "center", gap: 6, minHeight: 130, justifyContent: "center" },
    variantLabel: { fontFamily: FONTS.display, fontSize: 20 },
    variantTag: { fontFamily: FONTS.body, fontSize: 12, textAlign: "center", lineHeight: 17 },
    poolHint: { fontFamily: FONTS.body, color: c.faint, fontSize: 12, textAlign: "center" },
    warn: { fontFamily: FONTS.body, fontSize: 13, textAlign: "center" },
    cta: { minHeight: 64, alignSelf: "stretch", borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, marginTop: 6 },
    ctaText: { fontFamily: FONTS.display, fontSize: 17, letterSpacing: 0.5 },
    secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    secondaryText: { fontFamily: FONTS.body, fontSize: 15 },
    handoffEmoji: { fontSize: 72 },
    secretBody: { flex: 1, padding: SPACING.lg, gap: 16, justifyContent: "center" },
    secretWho: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 20, textAlign: "center" },
    secretCard: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 22, gap: 8, alignSelf: "stretch" },
    secretLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5 },
    secretText: { fontFamily: FONTS.display, fontSize: 28, lineHeight: 34 },
    secretHint: { fontFamily: FONTS.body, color: c.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
    voteBody: { padding: SPACING.lg, gap: 14, flexGrow: 1, justifyContent: "center", alignItems: "center" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", alignSelf: "stretch" },
    suspect: { width: "47%", minHeight: 64, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
    suspectEmoji: { fontSize: 22 },
    suspectName: { fontFamily: FONTS.displaySemi, fontSize: 17, maxWidth: "62%" },
    verdictLine: { fontFamily: FONTS.body, fontSize: 17, textAlign: "center" },
    redemptionRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 4 },
    redemptionBtn: { flex: 1, minHeight: 64, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    redemptionText: { fontFamily: FONTS.displaySemi, fontSize: 16 },
    gageBox: { alignSelf: "stretch", borderRadius: RADIUS.md, borderWidth: 1, padding: 18, gap: 6 },
    gageWho: { fontFamily: FONTS.displaySemi, fontSize: 18, textAlign: "center" },
    gageText: { fontFamily: FONTS.body, fontSize: 15, textAlign: "center", lineHeight: 21 },
    gageFlip: { fontFamily: FONTS.body, fontSize: 13, textAlign: "center", marginTop: 4 },
  });
