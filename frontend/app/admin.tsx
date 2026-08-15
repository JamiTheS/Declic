 
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { storage } from "@/src/utils/storage";
import { useTheme } from "@/src/theme/ThemeContext";
import { useCatalog } from "@/src/context/CatalogContext";
import { FONTS, SPACING, RADIUS, MODE_META, Colors } from "@/src/theme/tokens";
import {
  verifyAdmin, fetchAdminSummary, AdminSummary,
  syncAirtable, fetchAirtableInfo, AirtableInfo,
  fetchAdminCards, deleteAirtableCard,
} from "@/src/api/client";
import { Card } from "@/src/types";
import PrimaryButton from "@/src/components/PrimaryButton";

const TOKEN_KEY = "declic.adminToken";

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { refresh } = useCatalog();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");

  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [info, setInfo] = useState<AirtableInfo | null>(null);
  const [flash, setFlash] = useState("");
  const [syncing, setSyncing] = useState(false);

  const [cards, setCards] = useState<Card[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loadingList, setLoadingList] = useState(false);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(""), 4000); };

  const loadMeta = useCallback(async (tk: string) => {
    try {
      const [s, i] = await Promise.all([fetchAdminSummary(tk), fetchAirtableInfo(tk)]);
      setSummary(s); setInfo(i);
    } catch { /* noop */ }
  }, []);

  const loadList = useCallback(async (tk: string, mode: string) => {
    setLoadingList(true);
    try { setCards(await fetchAdminCards(tk, mode === "all" ? undefined : mode)); }
    catch { /* noop */ }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const saved = (await storage.getItem(TOKEN_KEY, "")) as string;
      if (saved) {
        const ok = await verifyAdmin(saved).catch(() => false);
        if (ok) { setToken(saved); setAuthed(true); loadMeta(saved); loadList(saved, "all"); }
      }
      setChecking(false);
    })();
  }, [loadMeta, loadList]);

  const submitToken = async () => {
    setAuthError("");
    const ok = await verifyAdmin(token.trim()).catch(() => false);
    if (!ok) { setAuthError("Jeton invalide. Réessaie."); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); return; }
    await storage.setItem(TOKEN_KEY, token.trim());
    setAuthed(true);
    loadMeta(token.trim()); loadList(token.trim(), "all");
  };

  const logout = async () => { await storage.setItem(TOKEN_KEY, ""); setToken(""); setAuthed(false); setSummary(null); setCards([]); };

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await syncAirtable(token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showFlash(`Synchronisé ✓ ${r.synced} questions (${r.active} actives${r.skipped ? `, ${r.skipped} ignorées` : ""})`);
      await Promise.all([loadMeta(token), loadList(token, filter), refresh()]);
    } catch (e: any) {
      showFlash(e?.message || "Erreur de synchronisation.");
    } finally { setSyncing(false); }
  };

  const openAirtable = () => {
    if (info?.edit_url) Linking.openURL(info.edit_url).catch(() => {});
  };

  const confirmDelete = (card: Card) => {
    const doDelete = async () => {
      if (!card.airtable_id) { showFlash("Cette carte n'a pas d'ID Airtable."); return; }
      try {
        await deleteAirtableCard(token, card.airtable_id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showFlash("Question supprimée ✓");
        setCards((prev) => prev.filter((c) => c.airtable_id !== card.airtable_id));
        await Promise.all([loadMeta(token), refresh()]);
      } catch (e: any) { showFlash(e?.message || "Erreur de suppression."); }
    };
    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert("Supprimer cette question ?", card.texte.slice(0, 80),
      [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: doDelete }]);
  };

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} testID="admin-back" hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={30} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.headerTitle}>Espace créateur</Text>
      {authed ? (
        <Pressable onPress={logout} style={styles.backBtn} testID="admin-logout" hitSlop={8}>
          <MaterialCommunityIcons name="logout" size={22} color={colors.muted} />
        </Pressable>
      ) : <View style={{ width: 44 }} />}
    </View>
  );

  if (checking) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color={colors.brand} /></View>;
  }

  if (!authed) {
    return (
      <View style={styles.container}>
        {Header}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
            <View style={styles.lockIcon}><MaterialCommunityIcons name="key-variant" size={34} color={colors.brand} /></View>
            <Text style={styles.title}>Jeton créateur</Text>
            <Text style={styles.sub}>Entre ton jeton pour gérer le catalogue. Il reste sur cet appareil.</Text>
            <TextInput
              value={token} onChangeText={setToken} placeholder="Jeton créateur" placeholderTextColor={colors.muted}
              style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} testID="admin-token-input"
            />
            {!!authError && <Text style={styles.error}>{authError}</Text>}
            <View style={{ height: 16 }} />
            <PrimaryButton label="DÉVERROUILLER" onPress={submitToken} testID="admin-unlock" />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  const filteredModes = ["all", ...Object.keys(MODE_META)];

  return (
    <View style={styles.container}>
      {Header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Source of truth banner */}
        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <MaterialCommunityIcons name="database-sync-outline" size={22} color={colors.brand} />
            <Text style={styles.sourceTitle}>Source : Airtable</Text>
          </View>
          <Text style={styles.sourceSub}>
            Édite tes questions dans Airtable (ajout, modification, suppression), puis synchronise pour mettre l'app à jour.
          </Text>
        </View>

        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View><Text style={styles.summaryNum}>{summary.total}</Text><Text style={styles.summaryLabel}>questions</Text></View>
              <View><Text style={styles.summaryNum}>{summary.premium}</Text><Text style={styles.summaryLabel}>premium</Text></View>
              <View><Text style={styles.summaryNum}>{Object.keys(summary.by_mode).length}</Text><Text style={styles.summaryLabel}>modes</Text></View>
            </View>
          </View>
        )}

        {!!flash && <View style={styles.flash}><Text style={styles.flashText}>{flash}</Text></View>}

        <View style={{ height: 16 }} />
        <PrimaryButton label={syncing ? "SYNCHRONISATION…" : "SYNCHRONISER DEPUIS AIRTABLE"} onPress={runSync} loading={syncing} testID="admin-sync" />
        <Pressable onPress={openAirtable} style={styles.openBtn} testID="admin-open-airtable">
          <MaterialCommunityIcons name="open-in-new" size={18} color={colors.onSurface} />
          <Text style={styles.openText}>Ouvrir Airtable pour éditer</Text>
        </Pressable>

        {/* Browse / delete */}
        <Text style={styles.section}>Parcourir & supprimer</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filteredModes.map((m) => {
            const active = filter === m;
            const label = m === "all" ? "Tous" : MODE_META[m].label;
            return (
              <Pressable key={m} onPress={() => { setFilter(m); loadList(token, m); }} style={[styles.filterChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]} testID={`admin-filter-${m}`}>
                <Text style={[styles.filterText, { color: active ? colors.onBrand : colors.onSurface }]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loadingList ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
        ) : (
          <View style={{ marginTop: 8 }}>
            {cards.length === 0 && <Text style={styles.empty}>Aucune question pour ce filtre.</Text>}
            {cards.map((c) => (
              <View key={c.id} style={styles.cardRow} testID={`admin-card-${c.id}`}>
                <View style={[styles.cardAccent, { backgroundColor: (MODE_META[c.mode]?.color) || colors.brand }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardMode}>{MODE_META[c.mode]?.label || c.mode} · intensité {c.intensite}{c.premium ? " · premium" : ""}</Text>
                  <Text style={styles.cardText} numberOfLines={2}>{c.texte}{c.texte_b ? `  //  ${c.texte_b}` : ""}</Text>
                </View>
                <Pressable onPress={() => confirmDelete(c)} style={styles.deleteBtn} testID={`admin-delete-${c.id}`} hitSlop={8}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    center: { alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingBottom: 8 },
    backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 20 },
    lockIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center", marginTop: 12, marginBottom: 20 },
    title: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 30 },
    sub: { fontFamily: FONTS.body, color: c.muted, fontSize: 14, marginTop: 8, lineHeight: 20 },
    input: { backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 14, color: c.onSurface, fontFamily: FONTS.body, fontSize: 16, marginTop: 16 },
    error: { fontFamily: FONTS.body, color: c.error, marginTop: 10, fontSize: 14 },
    sourceCard: { backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 16, marginTop: 8 },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    sourceTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 17 },
    sourceSub: { fontFamily: FONTS.body, color: c.muted, fontSize: 13, marginTop: 8, lineHeight: 19 },
    summaryCard: { backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 18, marginTop: 12 },
    summaryTop: { flexDirection: "row", justifyContent: "space-around" },
    summaryNum: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 26, textAlign: "center" },
    summaryLabel: { fontFamily: FONTS.body, color: c.muted, fontSize: 12, textAlign: "center", marginTop: 2 },
    flash: { backgroundColor: c.brandSoft, borderRadius: RADIUS.sm, padding: 12, marginTop: 14 },
    flashText: { fontFamily: FONTS.bodyBold, color: c.brand, fontSize: 13, textAlign: "center" },
    openBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, marginTop: 12, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: c.borderStrong },
    openText: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 15 },
    section: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 20, marginTop: 32, marginBottom: 12 },
    filterRow: { gap: 8, paddingRight: 8 },
    filterChip: { paddingHorizontal: 14, height: 40, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    filterText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
    empty: { fontFamily: FONTS.body, color: c.muted, fontSize: 15, paddingVertical: 20, textAlign: "center" },
    cardRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10, overflow: "hidden" },
    cardAccent: { width: 3, alignSelf: "stretch", borderRadius: 3 },
    cardMode: { fontFamily: FONTS.bodyBold, color: c.muted, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase" },
    cardText: { fontFamily: FONTS.body, color: c.onSurface, fontSize: 15, marginTop: 4, lineHeight: 20 },
    deleteBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  });
