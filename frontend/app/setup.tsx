 
import { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useApp } from "@/src/context/AppContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, Colors } from "@/src/theme/tokens";
import PrimaryButton from "@/src/components/PrimaryButton";

export default function Setup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === "1";
  const { players, addPlayer, removePlayer, soberMode, setSoberMode } = useApp();
  const { colors } = useTheme();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const submit = () => {
    if (!value.trim()) return;
    if (players.length >= 16) return;
    addPlayer(value);
    setValue("");
    setError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    inputRef.current?.focus();
  };

  const start = () => {
    if (players.length < 2) {
      setError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    if (isEdit) router.back();
    else router.replace("/hub");
  };

  return (
    <View style={styles.container}>
      {isEdit && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="setup-back" hitSlop={8}>
            <MaterialCommunityIcons name="chevron-left" size={30} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Les joueurs</Text>
          <View style={{ width: 44 }} />
        </View>
      )}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: isEdit ? 8 : insets.top + 24, paddingBottom: 220 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isEdit && <Text style={styles.kicker}>SETUP DE LA SOIRÉE</Text>}
        <Text style={styles.title}>{isEdit ? "Modifier la bande" : "Qui joue ?"}</Text>
        <Text style={styles.subtitle}>
          Ajoute les prénoms de la bande. Un seul téléphone, on se le passe.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            testID="player-name-input"
            value={value}
            onChangeText={setValue}
            placeholder="Ajoute un prénom…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={submit}
            autoFocus={!isEdit}
            maxLength={16}
          />
          <Pressable onPress={submit} style={styles.addBtn} testID="add-player-button" hitSlop={8}>
            <MaterialCommunityIcons name="plus" size={30} color={colors.onBrand} />
          </Pressable>
        </View>

        {error && (
          <Text style={styles.error} testID="setup-error">
            Il faut au moins 2 joueurs pour lancer une partie.
          </Text>
        )}

        <View style={styles.chips} testID="players-list">
          {players.map((p) => (
            <Pressable
              key={p.id}
              style={styles.chip}
              onPress={() => {
                removePlayer(p.id);
                Haptics.selectionAsync().catch(() => {});
              }}
              testID={`player-chip-${p.id}`}
            >
              <Text style={styles.chipEmoji}>{p.emoji}</Text>
              <Text style={styles.chipName} numberOfLines={1}>{p.name}</Text>
              <MaterialCommunityIcons name="close" size={17} color={colors.muted} />
            </Pressable>
          ))}
          {players.length === 0 && (
            <Text style={styles.empty}>Aucun joueur pour l'instant 👀</Text>
          )}
        </View>
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.soberRow} onPress={() => setSoberMode(!soberMode)} testID="sober-toggle">
            <View
              style={[
                styles.soberBox,
                { backgroundColor: soberMode ? colors.success : "transparent", borderColor: soberMode ? colors.success : colors.borderStrong },
              ]}
            >
              {soberMode && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.soberTitle}>Mode sans alcool</Text>
              <Text style={styles.soberSub}>Remplace tous les gages par des alternatives</Text>
            </View>
            <MaterialCommunityIcons name="glass-cocktail-off" size={22} color={soberMode ? colors.success : colors.muted} />
          </Pressable>
          <PrimaryButton
            label={isEdit ? "ENREGISTRER" : `C'EST PARTI${players.length >= 2 ? ` · ${players.length} JOUEURS` : ""}`}
            onPress={start}
            testID="start-button"
            haptic="heavy"
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingBottom: 4 },
    backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 20 },
    scroll: { paddingHorizontal: SPACING.lg },
    kicker: { fontFamily: FONTS.bodyBold, color: c.brand, letterSpacing: 2.5, fontSize: 12 },
    title: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 44, marginTop: 8 },
    subtitle: { fontFamily: FONTS.body, color: c.muted, fontSize: 16, marginTop: 8, lineHeight: 22 },
    inputRow: { flexDirection: "row", gap: 12, marginTop: 28 },
    input: {
      flex: 1,
      minHeight: 62,
      backgroundColor: c.surfaceSecondary,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 20,
      color: c.onSurface,
      fontFamily: FONTS.displayMed,
      fontSize: 20,
    },
    addBtn: { width: 62, height: 62, borderRadius: RADIUS.md, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
    error: { fontFamily: FONTS.body, color: c.error, marginTop: 12, fontSize: 14 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 24 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceSecondary,
      borderRadius: RADIUS.pill,
      paddingLeft: 14,
      paddingRight: 12,
      height: 50,
      borderWidth: 1,
      borderColor: c.border,
      maxWidth: "100%",
    },
    chipEmoji: { fontSize: 20 },
    chipName: { fontFamily: FONTS.displayMed, color: c.onSurface, fontSize: 17, maxWidth: 160 },
    empty: { fontFamily: FONTS.body, color: c.muted, fontSize: 15, paddingVertical: 8 },
    footer: {
      backgroundColor: c.surface,
      paddingHorizontal: SPACING.lg,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 16,
    },
    soberRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    soberBox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    soberTitle: { fontFamily: FONTS.bodyBold, color: c.onSurface, fontSize: 16 },
    soberSub: { fontFamily: FONTS.bodyRegular, color: c.muted, fontSize: 12, marginTop: 2 },
  });
