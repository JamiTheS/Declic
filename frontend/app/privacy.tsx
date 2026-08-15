 
import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, Colors } from "@/src/theme/tokens";

const SECTIONS: { title: string; body: string }[] = [
  { title: "En bref", body: "Déclic est un jeu d'ambiance sans compte. On ne te demande ni email, ni numéro, ni identifiant. Aucune donnée personnelle n'est envoyée à nos serveurs." },
  { title: "Ce qui reste sur ton téléphone", body: "Les prénoms des joueurs, tes réglages (mode sans alcool, haptique, thème) et ton statut Premium sont stockés localement sur l'appareil. Tu peux tout effacer en désinstallant l'app." },
  { title: "Statistiques anonymes", body: "Nous enregistrons des événements de jeu strictement anonymes (ex. début de partie) pour améliorer l'app. Ces événements ne contiennent aucune donnée permettant de t'identifier." },
  { title: "Catalogue de questions", body: "L'app télécharge le catalogue de questions depuis notre serveur en lecture seule, et le met en cache pour fonctionner hors-ligne." },
  { title: "Achats", body: "Les abonnements Premium sont gérés par l'App Store / Google Play. Nous ne voyons ni ne stockons tes informations de paiement." },
  { title: "Âge", body: "Déclic est réservé aux personnes majeures (18 ans et plus)." },
  { title: "Contact", body: "Une question sur tes données ? Écris-nous à privacy@declic.app." },
];

export default function Privacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="privacy-back" hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Confidentialité</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="shield-check-outline" size={30} color={colors.brand} />
          <Text style={styles.heroText}>Zéro compte. Tes données restent sur ton téléphone.</Text>
        </View>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.block}>
            <Text style={styles.blockTitle}>{s.title}</Text>
            <Text style={styles.blockBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.updated}>Dernière mise à jour : août 2025</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingBottom: 12 },
    backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 22 },
    hero: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: 18, marginTop: 8 },
    heroText: { flex: 1, fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 16, lineHeight: 22 },
    block: { marginTop: 24 },
    blockTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 18 },
    blockBody: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 15, lineHeight: 23, marginTop: 8 },
    updated: { fontFamily: FONTS.body, color: c.muted, fontSize: 12, textAlign: "center", marginTop: 32 },
  });
