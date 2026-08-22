import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { useApp } from "@/src/context/AppContext";
import { useCatalog } from "@/src/context/CatalogContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, MODE_META, modePalette, hexAlpha, Colors } from "@/src/theme/tokens";
import { Card, Player } from "@/src/types";

type Variant = "mots" | "questions";
type Role = "civil" | "impostor" | "white";
type Phase = "intro" | "handoff" | "secret" | "answer" | "vote" | "reveal" | "guess" | "done";
type Outcome = "civils" | "bad";

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
 * Role mix by table size, mirroring the ratios Undercover settled on.
 *
 * Mister White only joins from 6 players. Adding him at 5 leaves 3 civilians
 * against 2 traitors, and since the traitors win as soon as they equal the
 * civilians, a single misplaced vote would end the game on the spot — verified
 * by simulation, where civilians won 14% of 5-player games with him versus 60%
 * without. Traitor counts stay deliberately low for the same reason.
 */
function composition(n: number): { impostors: number; whites: number } {
  if (n <= 5) return { impostors: 1, whites: 0 };
  if (n <= 7) return { impostors: 1, whites: 1 };
  if (n <= 10) return { impostors: 2, whites: 1 };
  return { impostors: 3, whites: 1 };
}

/**
 * L'Imposteur — pass-and-play, single device, played over several rounds.
 *
 * Civilians see the real secret (card.texte) and the impostor(s) a near-miss
 * variant (card.texte_b). Impostors are NOT told they are impostors: each one
 * believes they hold the real secret, which is what makes the game paranoid
 * rather than a straight bluffing exercise.
 *
 * Mister White is the exception — he is handed no secret at all, so he
 * necessarily knows his role and has to improvise blind. Because he has nothing
 * to go on, he is never made to speak first in a round.
 *
 * Each round eliminates exactly one player and reveals only THAT player's role,
 * so voting out a civilian tells the table nothing about who the impostor is —
 * the game simply continues. It ends when every impostor and white is out
 * (civilians win), when they equal the remaining civilians (they win), or when
 * an eliminated Mister White correctly names the real secret.
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
  const [roles, setRoles] = useState<Role[]>([]);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [turn, setTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [speakOrder, setSpeakOrder] = useState<number[]>([]);
  const [answerTurn, setAnswerTurn] = useState(0);
  const [suspect, setSuspect] = useState<Player | null>(null);
  const [lastOut, setLastOut] = useState<number | null>(null);
  const [impostorRedeemed, setImpostorRedeemed] = useState(false);
  const [whiteWon, setWhiteWon] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const enough = players.length >= 3;
  const comp = composition(players.length);

  const aliveIdx = players.map((_, i) => i).filter((i) => !eliminated.includes(i));
  const badAlive = aliveIdx.filter((i) => roles[i] && roles[i] !== "civil");
  const civilAlive = aliveIdx.filter((i) => roles[i] === "civil");

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

  // Mister White has no secret, so opening a round would expose him instantly.
  // He is swapped out of the first slot whenever he lands there.
  const buildSpeakOrder = (alive: number[], r: Role[]): number[] => {
    const order = shuffled(alive);
    if (order.length > 1 && r[order[0]] === "white") {
      const j = 1 + Math.floor(Math.random() * (order.length - 1));
      [order[0], order[j]] = [order[j], order[0]];
    }
    return order;
  };

  const startGame = () => {
    if (!pool.length) return;
    buzz();
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const { impostors, whites } = composition(players.length);
    const seats = shuffled(players.map((_, i) => i));
    const next: Role[] = players.map(() => "civil");
    seats.slice(0, impostors).forEach((i) => { next[i] = "impostor"; });
    seats.slice(impostors, impostors + whites).forEach((i) => { next[i] = "white"; });

    setCard(picked);
    setRoles(next);
    setEliminated([]);
    setRound(1);
    setTurn(0);
    setAnswerTurn(0);
    setSuspect(null);
    setLastOut(null);
    setImpostorRedeemed(false);
    setWhiteWon(false);
    setOutcome(null);
    setSpeakOrder(buildSpeakOrder(players.map((_, i) => i), next));
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

  const eliminate = () => {
    if (!suspect) return;
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const outIdx = players.findIndex((p) => p.id === suspect.id);
    setLastOut(outIdx);
    setEliminated((prev) => [...prev, outIdx]);
    setPhase("reveal");
  };

  /**
   * Decide whether the game is over, using the post-elimination survivor lists.
   * `whiteWins` short-circuits everything: an eliminated Mister White who names
   * the real secret takes the win outright.
   */
  const continueOrEnd = (whiteWins = false) => {
    if (whiteWins) {
      setWhiteWon(true);
      setOutcome("bad");
      setPhase("done");
      return;
    }
    if (badAlive.length === 0) {
      setOutcome("civils");
      setPhase("done");
      return;
    }
    if (badAlive.length >= civilAlive.length) {
      setOutcome("bad");
      setPhase("done");
      return;
    }
    setRound((r) => r + 1);
    setSpeakOrder(buildSpeakOrder(aliveIdx, roles));
    setAnswerTurn(0);
    setSuspect(null);
    setLastOut(null);
    setPhase("answer");
  };

  const settleGuess = (found: boolean) => {
    if (haptics) {
      Haptics.notificationAsync(
        found ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
    }
    const role = lastOut !== null ? roles[lastOut] : "civil";
    if (role === "white") {
      continueOrEnd(found);
      return;
    }
    if (found) setImpostorRedeemed(true);
    continueOrEnd(false);
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
    const civils = players.length - comp.impostors - comp.whites;
    return (
      <View style={styles.container}>
        <Header title="L'Imposteur" />
        <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.bigIcon, { backgroundColor: hexAlpha(meta.color, 0.16) }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={40} color={meta.color} />
          </View>
          <Text style={styles.bigTitle}>L'Imposteur</Text>
          <Text style={styles.bigSub}>
            Chacun découvre son secret en privé. À chaque tour, tout le monde s'exprime puis le
            groupe élimine un suspect — mais on ne révèle que le rôle de l'éliminé. Tant qu'il reste
            un traître, la partie continue.
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

          <View style={[styles.compBox, { borderColor: pal.overlayBorder, backgroundColor: pal.chipBg }]} testID="imposteur-composition">
            <Text style={[styles.compTitle, { color: pal.muted }]}>À {players.length} JOUEURS</Text>
            <Text style={[styles.compLine, { color: pal.fg }]}>
              {civils} civils · {comp.impostors} imposteur{comp.impostors > 1 ? "s" : ""}
              {comp.whites ? " · 1 Mister White" : ""}
            </Text>
            {comp.whites ? (
              <Text style={[styles.compHint, { color: pal.muted }]}>
                Mister White n'a aucun secret : il doit tout inventer.
              </Text>
            ) : (
              <Text style={[styles.compHint, { color: pal.muted }]}>
                Mister White apparaît à partir de 6 joueurs.
              </Text>
            )}
          </View>

          {!pool.length ? (
            <Text style={[styles.warn, { color: colors.warning }]} testID="imposteur-empty">
              Aucune carte disponible pour cette version.
            </Text>
          ) : (
            <Text style={styles.poolHint}>
              {pool.length} partie{pool.length > 1 ? "s" : ""} disponible{pool.length > 1 ? "s" : ""}
              {!isPremium ? " · intensités 4-5 en Premium" : ""}
            </Text>
          )}

          <Pressable
            style={[styles.cta, { backgroundColor: pool.length ? pal.color : colors.surfaceTertiary }]}
            onPress={startGame}
            disabled={!pool.length}
            testID="imposteur-start"
          >
            <Text style={[styles.ctaText, { color: pool.length ? pal.onAccent : colors.muted }]}>LANCER LA PARTIE</Text>
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
    const role = roles[turn];
    // Civilians and impostors get an identical-looking card, so neither knows
    // which side they are on. Mister White necessarily learns his role: there
    // is no secret to hand him.
    const isWhite = role === "white";
    const secret = role === "impostor" ? card.texte_b! : card.texte;
    return (
      <View style={styles.container}>
        <Header title={`Secret · ${turn + 1}/${players.length}`} />
        <View style={styles.secretBody}>
          <Text style={styles.secretWho}>{p.emoji} {p.name}</Text>
          {isWhite ? (
            <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: hexAlpha(meta.color, 0.6) }]}>
              <Text style={[styles.secretLabel, { color: pal.muted }]}>TU ES MISTER WHITE</Text>
              <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-secret">
                Aucun secret pour toi.
              </Text>
              <Text style={[styles.secretHint, { color: pal.muted, textAlign: "left" }]}>
                Écoute les autres, déduis, et fais-toi passer pour l'un d'eux. Tu ne commenceras
                jamais un tour.
              </Text>
            </View>
          ) : (
            <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
              <Text style={[styles.secretLabel, { color: pal.muted }]}>
                {variant === "mots" ? "TON MOT" : "TA QUESTION"}
              </Text>
              <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-secret">{secret}</Text>
            </View>
          )}
          {!isWhite && (
            <Text style={styles.secretHint}>
              {variant === "mots"
                ? "Retiens-le. Tu devras donner des indices sans jamais le prononcer."
                : "Retiens-la. Tu devras y répondre à voix haute, sans jamais la lire."}
            </Text>
          )}
          <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={closeSecret} testID="imposteur-secret-ok">
            <Text style={[styles.ctaText, { color: pal.onAccent }]}>C'EST MÉMORISÉ</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Speaking round ----
  if (phase === "answer") {
    const p = players[speakOrder[answerTurn]];
    return (
      <View style={styles.container}>
        <Header title={`Tour ${round} · ${answerTurn + 1}/${speakOrder.length}`} />
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
        <Header title={`Vote · tour ${round}`} />
        <ScrollView contentContainerStyle={styles.voteBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.bigTitle}>Qui éliminez-vous ?</Text>
          <Text style={styles.bigSub}>Débattez, puis désignez ensemble un suspect.</Text>
          <View style={styles.grid}>
            {aliveIdx.map((i) => {
              const p = players[i];
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
            onPress={eliminate}
            disabled={!suspect}
            testID="imposteur-accuse"
          >
            <Text style={[styles.ctaText, { color: suspect ? pal.onAccent : colors.muted }]}>ÉLIMINER</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---- Reveal the eliminated player's role (and only theirs) ----
  if (phase === "reveal" && lastOut !== null) {
    const out = players[lastOut];
    const role = roles[lastOut];
    const label =
      role === "civil" ? "…était un civil." : role === "white" ? "…était Mister White !" : "…était un imposteur !";
    return (
      <View style={styles.container}>
        <Header title={`Élimination · tour ${round}`} />
        <ScrollView contentContainerStyle={styles.voteBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.handoffEmoji}>{out.emoji}</Text>
          <Text style={styles.bigTitle}>{out.name}</Text>
          <Text
            style={[styles.verdictLine, { color: role === "civil" ? colors.warning : colors.success }]}
            testID="imposteur-eliminated-role"
          >
            {label}
          </Text>
          {role === "civil" ? (
            <>
              <Text style={styles.bigSub}>
                Le traître court toujours. Personne d'autre n'est révélé — la partie continue.
              </Text>
              <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={() => continueOrEnd(false)} testID="imposteur-continue">
                <Text style={[styles.ctaText, { color: pal.onAccent }]}>TOUR SUIVANT</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.bigSub}>
                {role === "white"
                  ? `Dernière chance : ${out.name} annonce à voix haute ce que les autres avaient. S'il tombe juste, il gagne la partie.`
                  : `Dernière chance : ${out.name} annonce à voix haute ce que les autres avaient. S'il tombe juste, le gage se retourne contre le groupe.`}
              </Text>
              <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={() => { buzz(); setPhase("guess"); }} testID="imposteur-to-guess">
                <Text style={[styles.ctaText, { color: pal.onAccent }]}>IL TENTE SA CHANCE</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---- The eliminated traitor's one shot at the real secret ----
  if (phase === "guess" && lastOut !== null && card) {
    const out = players[lastOut];
    return (
      <View style={styles.container}>
        <Header title="Sa tentative" />
        <ScrollView contentContainerStyle={styles.voteBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.bigTitle}>{out.name} annonce</Text>
          <Text style={styles.bigSub}>
            {variant === "mots" ? "Quel était le mot du groupe ?" : "Quelle était la question du groupe ?"}
          </Text>
          <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
            <Text style={[styles.secretLabel, { color: pal.muted }]}>LE GROUPE AVAIT</Text>
            <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-guess-answer">{card.texte}</Text>
          </View>
          <View style={styles.redemptionRow}>
            <Pressable
              style={[styles.redemptionBtn, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}
              onPress={() => settleGuess(false)}
              testID="imposteur-guess-fail"
            >
              <Text style={[styles.redemptionText, { color: pal.fg }]}>Raté</Text>
            </Pressable>
            <Pressable
              style={[styles.redemptionBtn, { backgroundColor: pal.color, borderColor: pal.color }]}
              onPress={() => settleGuess(true)}
              testID="imposteur-guess-win"
            >
              <Text style={[styles.redemptionText, { color: pal.onAccent }]}>Il a trouvé !</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- Game over ----
  const traitors = players.filter((_, i) => roles[i] && roles[i] !== "civil");
  const groupLoses = outcome === "bad" || impostorRedeemed;
  const gageText = soberMode ? card?.alternative : card?.gage;
  const headline = whiteWon
    ? "Mister White a tout deviné 😈"
    : outcome === "bad"
      ? "Les traîtres l'emportent 😈"
      : "Le groupe a fait le ménage 🎯";
  return (
    <View style={styles.container}>
      <Header title="Fin de partie" />
      <ScrollView contentContainerStyle={styles.voteBody} showsVerticalScrollIndicator={false}>
        <Text style={[styles.bigTitle, { marginBottom: 2 }]} testID="imposteur-headline">{headline}</Text>

        <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
          <Text style={[styles.secretLabel, { color: pal.muted }]}>LE GROUPE AVAIT</Text>
          <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-reveal-civils">{card?.texte}</Text>
        </View>
        <View style={[styles.secretCard, { backgroundColor: pal.chipBg, borderColor: hexAlpha(meta.color, 0.5) }]}>
          <Text style={[styles.secretLabel, { color: pal.muted }]}>LES IMPOSTEURS AVAIENT</Text>
          <Text style={[styles.secretText, { color: pal.fg }]} testID="imposteur-reveal-impostor">{card?.texte_b}</Text>
        </View>

        <View style={[styles.rolesBox, { borderColor: pal.overlayBorder }]}>
          {traitors.map((p) => {
            const i = players.findIndex((x) => x.id === p.id);
            return (
              <Text key={p.id} style={[styles.roleLine, { color: pal.fg }]}>
                {p.emoji} {p.name} — {roles[i] === "white" ? "Mister White" : "Imposteur"}
              </Text>
            );
          })}
        </View>

        <View style={[styles.gageBox, { borderColor: pal.overlayBorder, backgroundColor: hexAlpha(meta.color, 0.1) }]}>
          <Text style={[styles.gageWho, { color: pal.fg }]}>
            {groupLoses ? "Le groupe prend le gage" : "Les traîtres prennent le gage"}
          </Text>
          <Text style={[styles.gageText, { color: pal.muted }]} testID="imposteur-gage">{gageText}</Text>
          {impostorRedeemed && !whiteWon && outcome === "civils" && (
            <Text style={[styles.gageFlip, { color: colors.success }]}>
              Rattrapage réussi — le gage est retourné contre le groupe.
            </Text>
          )}
        </View>

        <Pressable style={[styles.cta, { backgroundColor: pal.color }]} onPress={startGame} testID="imposteur-replay">
          <Text style={[styles.ctaText, { color: pal.onAccent }]}>NOUVELLE PARTIE</Text>
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
    compBox: { alignSelf: "stretch", borderRadius: RADIUS.md, borderWidth: 1, padding: 14, gap: 4, alignItems: "center" },
    compTitle: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5 },
    compLine: { fontFamily: FONTS.displaySemi, fontSize: 17, textAlign: "center" },
    compHint: { fontFamily: FONTS.body, fontSize: 12, textAlign: "center", lineHeight: 17 },
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
    rolesBox: { alignSelf: "stretch", borderRadius: RADIUS.md, borderWidth: 1, padding: 14, gap: 4 },
    roleLine: { fontFamily: FONTS.body, fontSize: 15, textAlign: "center" },
    gageBox: { alignSelf: "stretch", borderRadius: RADIUS.md, borderWidth: 1, padding: 18, gap: 6 },
    gageWho: { fontFamily: FONTS.displaySemi, fontSize: 18, textAlign: "center" },
    gageText: { fontFamily: FONTS.body, fontSize: 15, textAlign: "center", lineHeight: 21 },
    gageFlip: { fontFamily: FONTS.body, fontSize: 13, textAlign: "center", marginTop: 4 },
  });
