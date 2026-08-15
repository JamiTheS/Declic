 
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing, ScrollView, Dimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Card, Player } from "@/src/types";
import { FONTS, RADIUS, MODE_META, HEALTH_MSG, ModePalette } from "@/src/theme/tokens";

function gageInfo(card: Card, sober: boolean) {
  const isAlcool = /gorg|bois/i.test(card.gage);
  const text = sober || !isAlcool ? card.alternative : card.gage;
  return { text, alt: card.alternative, isAlcool: isAlcool && !sober };
}

/**
 * Shared card skeleton — three flex zones (top / middle / bottom), NO absolute
 * positioning. `middle` grows and centers its content; on short screens the
 * interactive modes scroll instead of overlapping the header / gage banner.
 */
function CardShell({
  top,
  bottom,
  scroll = false,
  children,
}: {
  top?: React.ReactNode;
  bottom?: React.ReactNode;
  scroll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.topZone}>{top}</View>
      {scroll ? (
        <ScrollView
          style={styles.middleFlex}
          contentContainerStyle={styles.middleScroll}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.middleCenter}>{children}</View>
      )}
      <View style={styles.bottomZone}>{bottom}</View>
    </View>
  );
}

export function ModeTag({ mode, subtitle, pal }: { mode: string; subtitle?: string; pal: ModePalette }) {
  const meta = MODE_META[mode];
  if (!meta) return null;
  return (
    <View style={[styles.modeTagRow, { backgroundColor: pal.chipBg }]}>
      <MaterialCommunityIcons name={meta.icon as any} size={15} color={pal.fg} />
      <Text style={[styles.modeTag, { color: pal.fg }]}>
        {meta.short}
        {subtitle ? ` · ${subtitle}` : ""}
      </Text>
    </View>
  );
}

export function TargetPill({ player, label, pal }: { player: Player; label?: string; pal: ModePalette }) {
  return (
    <View style={[styles.targetPill, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
      <Text style={styles.targetEmoji}>{player.emoji}</Text>
      <Text style={[styles.targetName, { color: pal.fg }]}>{label ? `${label} ${player.name}` : player.name}</Text>
    </View>
  );
}

export function GageBanner({ card, sober, pal }: { card: Card; sober: boolean; pal: ModePalette }) {
  const { text, alt, isAlcool } = gageInfo(card, sober);
  return (
    <View style={styles.gageWrap}>
      <View style={[styles.gageBox, { backgroundColor: pal.overlay, borderColor: pal.overlayBorder }]}>
        <View style={styles.gageLabelRow}>
          <MaterialCommunityIcons name="target" size={11} color={pal.muted} />
          <Text style={[styles.gageLabel, { color: pal.muted }]}>SINON, GAGE</Text>
        </View>
        <Text style={[styles.gageText, { color: pal.fg }]}>{text}</Text>
        {isAlcool && <Text style={[styles.gageAlt, { color: pal.muted }]}>ou : {alt}</Text>}
      </View>
      {isAlcool && <Text style={[styles.health, { color: pal.faint }]}>{HEALTH_MSG}</Text>}
    </View>
  );
}

function ActionButton({ label, onPress, pal, testID }: { label: string; onPress: () => void; pal: ModePalette; testID?: string }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.doneBtn,
        { backgroundColor: pal.color, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={[styles.doneText, { color: pal.onAccent }]}>{label}</Text>
      <MaterialCommunityIcons name="arrow-right" size={18} color={pal.onAccent} />
    </Pressable>
  );
}

// ---------- Text content (je-nai-jamais, action-verite, cash-ou-cash, hot) ----------
export function TextContent({
  card,
  target,
  sober,
  pal,
  targetLabel = "À toi,",
}: {
  card: Card;
  target?: Player;
  sober: boolean;
  pal: ModePalette;
  targetLabel?: string;
}) {
  const isDilemma = card.mode === "cash-ou-cash";
  const variante = card.variante === "action" ? "ACTION" : card.variante === "verite" ? "VÉRITÉ" : undefined;

  return (
    <CardShell
      top={
        <>
          <ModeTag mode={card.mode} subtitle={variante} pal={pal} />
          {target && (
            <View style={{ marginTop: 12 }}>
              <TargetPill player={target} label={targetLabel} pal={pal} />
            </View>
          )}
        </>
      }
      bottom={<GageBanner card={card} sober={sober} pal={pal} />}
    >
      {isDilemma ? (
        <View style={styles.dilemmaBlock}>
          <View style={[styles.dilemmaOption, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
            <Text style={[styles.dilemmaLabel, { color: pal.fg }]}>CASH</Text>
            <Text style={[styles.dilemmaText, { color: pal.fg }]}>{card.texte}</Text>
          </View>
          <View style={[styles.dilemmaOrBubble, { backgroundColor: pal.color }]}>
            <Text style={[styles.dilemmaOrText, { color: pal.onAccent }]}>OU</Text>
          </View>
          <View style={[styles.dilemmaOption, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
            <Text style={[styles.dilemmaLabel, { color: pal.fg }]}>CASH</Text>
            <Text style={[styles.dilemmaText, { color: pal.fg }]}>{card.texte_b}</Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.question, { color: pal.fg }]} adjustsFontSizeToFit numberOfLines={6}>
          {card.texte}
        </Text>
      )}
    </CardShell>
  );
}

// ---------- Confetti (dependency-free, cross-platform) ----------
const CONFETTI_COLORS = ["#E8654F", "#E0A458", "#4FB0A5", "#7E8CE0", "#C77D9E", "#6FB79B"];
const SCREEN_W = Dimensions.get("window").width;

function ConfettiPiece({ delay }: { delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const startX = Math.random() * SCREEN_W;
  const drift = (Math.random() - 0.5) * 160;
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  const size = 8 + Math.random() * 8;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 1400 + Math.random() * 800,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [t, delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-40, 620] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${Math.random() > 0.5 ? "" : "-"}720deg`] });
  const opacity = t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: startX,
        top: 0,
        width: size,
        height: size * 1.4,
        borderRadius: 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useRef(Array.from({ length: count }, (_, i) => i)).current;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((i) => (
        <ConfettiPiece key={i} delay={Math.random() * 400} />
      ))}
    </View>
  );
}

// ---------- Verdict (anonymous 0-10 vote → aggregate + countdown + confetti) ----------
export function VerdictContent({
  card,
  players,
  target,
  sober,
  onDone,
  haptics,
  pal,
}: {
  card: Card;
  players: Player[];
  target: Player;
  sober: boolean;
  onDone: () => void;
  haptics: boolean;
  pal: ModePalette;
}) {
  const voters = players.filter((p) => p.id !== target.id);
  const voterList = voters.length > 0 ? voters : players;
  const [step, setStep] = useState(0);
  const [votes, setVotes] = useState<number[]>([]);
  const [phase, setPhase] = useState<"vote" | "countdown" | "reveal">("vote");
  const [count, setCount] = useState(3);
  const pop = useRef(new Animated.Value(0)).current;

  const vote = (n: number) => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextVotes = [...votes, n];
    setVotes(nextVotes);
    if (step + 1 >= voterList.length) {
      setPhase("countdown");
    } else {
      setStep(step + 1);
    }
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      setPhase("reveal");
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
      return;
    }
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const timer = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(timer);
  }, [phase, count, haptics, pop]);

  const avg = votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : 0;
  const question = card.texte.replace(/\{J\}/g, target.name);

  // ---- Reveal ----
  if (phase === "reveal") {
    return (
      <>
        <Confetti />
        <CardShell
          top={<ModeTag mode={card.mode} pal={pal} />}
          bottom={
            <>
              <GageBanner card={card} sober={sober} pal={pal} />
              <ActionButton label="CARTE SUIVANTE" onPress={onDone} pal={pal} testID="verdict-next" />
            </>
          }
        >
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.verdictSpot, { color: pal.muted }]}>LE VERDICT DU GROUPE SUR {target.name.toUpperCase()}</Text>
            <Animated.Text style={[styles.verdictBig, { color: pal.fg, transform: [{ scale: pop }] }]}>
              {avg.toFixed(1)}
              <Text style={[styles.verdictBigSm, { color: pal.muted }]}> / 10</Text>
            </Animated.Text>
            <Text style={[styles.verdictSub, { color: pal.muted }]}>
              Note moyenne · {votes.length} vote{votes.length > 1 ? "s" : ""} anonyme{votes.length > 1 ? "s" : ""}
            </Text>
          </View>
        </CardShell>
      </>
    );
  }

  // ---- Countdown ----
  if (phase === "countdown") {
    return (
      <View style={styles.shellCenter}>
        <Text style={[styles.verdictSpot, { color: pal.muted }]}>RÉVÉLATION DANS…</Text>
        <Animated.Text style={[styles.countdown, { color: pal.fg }]} testID="verdict-countdown">
          {count > 0 ? count : "🎉"}
        </Animated.Text>
      </View>
    );
  }

  // ---- Voting (secret, one voter at a time) ----
  const voter = voterList[step];
  return (
    <CardShell
      scroll
      top={
        <>
          <ModeTag mode={card.mode} subtitle={`VOTE ${step + 1}/${voterList.length}`} pal={pal} />
          <View style={{ marginTop: 10, alignItems: "center" }}>
            <TargetPill player={target} label="Sur" pal={pal} />
          </View>
        </>
      }
    >
      <Text style={[styles.questionSm, { color: pal.fg }]} adjustsFontSizeToFit numberOfLines={4}>
        {question}
      </Text>
      <View style={{ alignItems: "center", marginTop: 4 }}>
        <View style={[styles.secretBadge, { backgroundColor: pal.chipBg }]}>
          <MaterialCommunityIcons name="incognito" size={18} color={pal.fg} />
          <Text style={[styles.secretBadgeText, { color: pal.fg }]}>{voter.emoji} {voter.name}, vote en secret (0 = non, 10 = à fond)</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scaleRow}>
        {Array.from({ length: 11 }, (_, n) => (
          <Pressable
            key={n}
            style={({ pressed }) => [
              styles.scaleBtn,
              { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
            onPress={() => vote(n)}
            testID={`verdict-vote-${n}`}
          >
            <Text style={[styles.scaleNum, { color: pal.fg }]}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </CardShell>
  );
}

// ---------- Vote content (qui-est-le-plus) ----------
export function VoteContent({
  card,
  players,
  sober,
  onDone,
  recordVote,
  haptics,
  pal,
}: {
  card: Card;
  players: Player[];
  sober: boolean;
  onDone: () => void;
  recordVote: (id: string) => void;
  haptics: boolean;
  pal: ModePalette;
}) {
  const [chosen, setChosen] = useState<Player | null>(null);
  const pick = (p: Player) => {
    if (chosen) return;
    setChosen(p);
    recordVote(p.id);
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  return (
    <CardShell
      scroll
      top={<ModeTag mode={card.mode} pal={pal} />}
      bottom={
        chosen ? (
          <>
            <GageBanner card={card} sober={sober} pal={pal} />
            <ActionButton label="CARTE SUIVANTE" onPress={onDone} pal={pal} testID="vote-next" />
          </>
        ) : undefined
      }
    >
      <Text style={[styles.questionSm, { color: pal.fg }]} adjustsFontSizeToFit numberOfLines={4}>
        Qui est le plus susceptible {card.texte}
      </Text>

      {!chosen ? (
        <>
          <Text style={[styles.hint, { color: pal.muted }]}>Le groupe pointe du doigt — tape le plus désigné 👇</Text>
          <View style={styles.playerGrid}>
            {players.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.voteBtn,
                  { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder, transform: [{ scale: pressed ? 0.96 : 1 }] },
                ]}
                onPress={() => pick(p)}
                testID={`vote-${p.id}`}
              >
                <Text style={styles.voteEmoji}>{p.emoji}</Text>
                <Text style={[styles.voteName, { color: pal.fg }]} numberOfLines={1}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.resultBlock}>
          <Text style={styles.resultEmoji}>{chosen.emoji}</Text>
          <Text style={[styles.resultName, { color: pal.fg }]}>{chosen.name}</Text>
          <Text style={[styles.resultVerdict, { color: pal.muted }]}>C'est toi ! Assume 😏</Text>
        </View>
      )}
    </CardShell>
  );
}

// ---------- Pair content (tu-me-connais) ----------
export function PairContent({
  card,
  targets,
  onDone,
  recordCorrect,
  haptics,
  pal,
}: {
  card: Card;
  targets: Player[];
  onDone: () => void;
  recordCorrect: () => void;
  haptics: boolean;
  pal: ModePalette;
}) {
  const [guesser, subject] = targets;
  const [revealed, setRevealed] = useState(false);

  const judge = (correct: boolean) => {
    if (correct) recordCorrect();
    if (haptics)
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
    onDone();
  };

  return (
    <CardShell
      scroll
      top={
        <>
          <ModeTag mode={card.mode} pal={pal} />
          <View style={styles.pairRow}>
            <TargetPill player={guesser} label="🎯" pal={pal} />
            <Text style={[styles.pairArrow, { color: pal.muted }]}>devine sur</Text>
            <TargetPill player={subject} pal={pal} />
          </View>
        </>
      }
      bottom={
        !revealed ? (
          <ActionButton label={`${guesser?.name?.toUpperCase() ?? ""} A RÉPONDU · RÉVÉLER`} onPress={() => setRevealed(true)} pal={pal} testID="pair-reveal" />
        ) : (
          <View style={{ width: "100%" }}>
            <Text style={[styles.hint, { color: pal.muted, marginTop: 0 }]}>{subject?.name}, {guesser?.name} avait bon ?</Text>
            <View style={styles.yesNoRow}>
              <Pressable style={({ pressed }) => [styles.yesNo, { backgroundColor: "#FF4D4D", transform: [{ scale: pressed ? 0.96 : 1 }] }]} onPress={() => judge(false)} testID="pair-wrong">
                <MaterialCommunityIcons name="close-thick" size={20} color="#fff" />
                <Text style={styles.yesNoText}>RATÉ</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.yesNo, { backgroundColor: "#2ED47A", transform: [{ scale: pressed ? 0.96 : 1 }] }]} onPress={() => judge(true)} testID="pair-correct">
                <MaterialCommunityIcons name="check-bold" size={20} color="#fff" />
                <Text style={styles.yesNoText}>CORRECT</Text>
              </Pressable>
            </View>
          </View>
        )
      }
    >
      <Text style={[styles.question, { color: pal.fg }]} adjustsFontSizeToFit numberOfLines={5}>
        {card.texte}
      </Text>
    </CardShell>
  );
}

// ---------- Locked (premium gate inline) ----------
export function LockedContent({ onUnlock, onSkip, pal }: { onUnlock: () => void; onSkip: () => void; pal: ModePalette }) {
  return (
    <View style={styles.lockedContent}>
      <View style={[styles.lockCircle, { backgroundColor: pal.chipBg, borderColor: pal.overlayBorder }]}>
        <MaterialCommunityIcons name="lock" size={40} color={pal.fg} />
      </View>
      <Text style={[styles.lockedTitle, { color: pal.fg }]}>La suite est réservée aux Premium</Text>
      <Text style={[styles.lockedSub, { color: pal.muted }]}>
        Le groupe est chaud 🔥 Débloque les modes intenses et des milliers de défis.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.unlockBtn, { backgroundColor: pal.color, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        onPress={onUnlock}
        testID="locked-unlock"
      >
        <Text style={[styles.unlockText, { color: pal.onAccent }]}>DÉBLOQUER</Text>
      </Pressable>
      <Pressable style={styles.skipLocked} onPress={onSkip} testID="locked-skip">
        <Text style={[styles.skipLockedText, { color: pal.muted }]}>Passer cette carte</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- 3-zone shell (no absolute positioning) ---
  shell: { flex: 1, justifyContent: "space-between", paddingVertical: 12 },
  shellCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  topZone: { alignItems: "center" },
  middleFlex: { flex: 1, alignSelf: "stretch" },
  middleScroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 12 },
  middleCenter: { flex: 1, justifyContent: "center", width: "100%" },
  bottomZone: { alignItems: "center", gap: 10 },

  modeTagRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 30, borderRadius: RADIUS.pill },
  modeTag: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 1.3 },
  targetPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 42, borderRadius: RADIUS.pill, borderWidth: 1 },
  targetEmoji: { fontSize: 20 },
  targetName: { fontFamily: FONTS.displaySemi, fontSize: 17 },
  question: {
    fontFamily: FONTS.display,
    fontSize: 38,
    lineHeight: 43,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.14)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  questionSm: { fontFamily: FONTS.display, fontSize: 30, lineHeight: 36, textAlign: "center", marginBottom: 8 },
  hint: { fontFamily: FONTS.body, fontSize: 14, textAlign: "center", marginTop: 14, marginBottom: 16 },
  verdictSpot: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 1.5, textAlign: "center" },
  verdictBig: { fontFamily: FONTS.display, fontSize: 92, marginTop: 8 },
  verdictBigSm: { fontFamily: FONTS.displaySemi, fontSize: 28 },
  verdictSub: { fontFamily: FONTS.body, fontSize: 14, textAlign: "center", marginTop: 6 },
  countdown: { fontFamily: FONTS.display, fontSize: 150, marginTop: 8 },
  secretBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, marginBottom: 20, maxWidth: "100%" },
  secretBadgeText: { fontFamily: FONTS.bodyBold, fontSize: 13, flexShrink: 1 },
  scaleRow: { gap: 10, paddingHorizontal: 4, alignItems: "center" },
  scaleBtn: { width: 58, height: 58, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  scaleNum: { fontFamily: FONTS.display, fontSize: 22 },

  gageWrap: { alignItems: "center", gap: 8, width: "100%" },
  gageBox: { borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", borderWidth: 1, maxWidth: "100%" },
  gageLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  gageLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  gageText: { fontFamily: FONTS.displaySemi, fontSize: 17, textAlign: "center", marginTop: 4 },
  gageAlt: { fontFamily: FONTS.body, fontSize: 13, marginTop: 4, textAlign: "center" },
  health: { fontFamily: FONTS.bodyRegular, fontSize: 10, textAlign: "center", paddingHorizontal: 20 },

  dilemmaBlock: { gap: 8, alignItems: "stretch" },
  dilemmaOption: { borderRadius: RADIUS.md, padding: 18, borderWidth: 1 },
  dilemmaLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5, marginBottom: 6, opacity: 0.7 },
  dilemmaText: { fontFamily: FONTS.displaySemi, fontSize: 22, lineHeight: 26 },
  dilemmaOrBubble: { alignSelf: "center", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginVertical: -4, zIndex: 2 },
  dilemmaOrText: { fontFamily: FONTS.display, fontSize: 16, letterSpacing: 1 },

  playerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  voteBtn: { width: "47%", minHeight: 64, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1 },
  voteEmoji: { fontSize: 22 },
  voteName: { fontFamily: FONTS.displaySemi, fontSize: 18, maxWidth: "60%" },
  resultBlock: { alignItems: "center", gap: 6 },
  resultEmoji: { fontSize: 64 },
  resultName: { fontFamily: FONTS.display, fontSize: 38 },
  resultVerdict: { fontFamily: FONTS.body, fontSize: 16 },

  pairRow: { marginTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center" },
  pairArrow: { fontFamily: FONTS.body, fontSize: 14 },
  yesNoRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  yesNo: { flex: 1, minHeight: 72, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  yesNoText: { fontFamily: FONTS.display, color: "#fff", fontSize: 22, letterSpacing: 1 },

  doneBtn: {
    minHeight: 64,
    flexDirection: "row",
    gap: 8,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  doneText: { fontFamily: FONTS.display, fontSize: 17, letterSpacing: 0.5 },

  lockedContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 10 },
  lockCircle: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  lockedTitle: { fontFamily: FONTS.display, fontSize: 30, textAlign: "center", lineHeight: 34 },
  lockedSub: { fontFamily: FONTS.body, fontSize: 16, textAlign: "center", lineHeight: 23 },
  unlockBtn: { minHeight: 64, alignSelf: "stretch", borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", marginTop: 12 },
  unlockText: { fontFamily: FONTS.display, fontSize: 18, letterSpacing: 0.5 },
  skipLocked: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  skipLockedText: { fontFamily: FONTS.body, fontSize: 14 },
});
