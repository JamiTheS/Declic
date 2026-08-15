import { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Modal, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useApp } from "@/src/context/AppContext";
import { useSubscription } from "@/src/lib/revenuecat";
import { presentCustomerCenter, revenueCatUIAvailable } from "@/src/lib/revenuecatUI";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, HEALTH_MSG, Colors } from "@/src/theme/tokens";

function Row({ icon, title, subtitle, right, onPress, testID, c }: {
  icon: string; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; c: Colors;
}) {
  const styles = makeStyles(c);
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon as any} size={20} color={c.onSurface} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { soberMode, setSoberMode, haptics, setHaptics, soundEnabled, setSoundEnabled, isPremium } = useApp();
  const { restore, isRestoring } = useSubscription();
  const { isDark, toggle, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [manageVisible, setManageVisible] = useState(false);

  // "Gérer mon abonnement": on native dev/store builds present RevenueCat's
  // Customer Center. Otherwise (web preview / Expo Go) show a clear info sheet
  // instead of a silent, no-op action.
  const manageSubscription = async () => {
    if (revenueCatUIAvailable) {
      await presentCustomerCenter();
      return;
    }
    setManageVisible(true);
  };

  // Hidden creator access: tap the version 7× to reveal the admin space.
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVersionTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push("/admin");
    } else if (tapCount.current >= 4) {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="settings-back" hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Réglages</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: SPACING.lg }}>
        <Text style={styles.section}>Jeu</Text>
        <View style={styles.card}>
          <Row c={colors} icon="glass-cocktail-off" title="Mode sans alcool" subtitle="Remplace les gages par des alternatives"
            right={<Switch value={soberMode} onValueChange={setSoberMode} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor="#fff" testID="settings-sober-switch" />} />
          <View style={styles.divider} />
          <Row c={colors} icon="vibrate" title="Retours haptiques"
            right={<Switch value={haptics} onValueChange={setHaptics} trackColor={{ true: colors.brand, false: colors.borderStrong }} thumbColor="#fff" testID="settings-haptics-switch" />} />
          <View style={styles.divider} />
          <Row c={colors} icon="volume-high" title="Sons" subtitle="Tic-tac & explosion de La Bombe"
            right={<Switch value={soundEnabled} onValueChange={setSoundEnabled} trackColor={{ true: colors.brand, false: colors.borderStrong }} thumbColor="#fff" testID="settings-sound-switch" />} />
          <View style={styles.divider} />
          <Row c={colors} icon="theme-light-dark" title="Thème sombre"
            right={<Switch value={isDark} onValueChange={toggle} trackColor={{ true: colors.brand, false: colors.borderStrong }} thumbColor="#fff" testID="settings-theme-switch" />} />
        </View>

        <Text style={styles.section}>Abonnement</Text>
        <View style={styles.card}>
          <Row c={colors} icon={isPremium ? "crown" : "crown-outline"} title={isPremium ? "Premium actif" : "Passer Premium"}
            subtitle={isPremium ? "Tous les modes débloqués" : "Débloque tout le contenu"}
            onPress={isPremium ? undefined : () => router.push("/paywall")}
            right={!isPremium ? <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} /> : undefined}
            testID="settings-premium" />
          <View style={styles.divider} />
          <Row c={colors} icon="restore" title={isRestoring ? "Restauration…" : "Restaurer mes achats"} onPress={() => restore().catch(() => {})} testID="settings-restore" />
          <View style={styles.divider} />
          <Row c={colors} icon="cog-outline" title="Gérer mon abonnement"
            subtitle="Changer, annuler ou demander un remboursement"
            onPress={manageSubscription}
            right={<MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />}
            testID="settings-customer-center" />
        </View>

        <Text style={styles.section}>À propos</Text>
        <View style={styles.card}>
          <Row c={colors} icon="shield-lock-outline" title="Politique de confidentialité" subtitle="Zéro compte · données locales uniquement"
            onPress={() => router.push("/privacy")}
            right={<MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />} testID="settings-privacy" />
        </View>

        <View style={styles.healthBox}>
          <Text style={styles.healthText}>{HEALTH_MSG}</Text>
        </View>
        <Pressable onPress={onVersionTap} testID="version-tap">
          <Text style={styles.version}>Déclic · v1.0.0</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={manageVisible} transparent animationType="fade" onRequestClose={() => setManageVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setManageVisible(false)} testID="manage-backdrop">
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIcon}>
              <MaterialCommunityIcons name="cog-outline" size={26} color={colors.brand} />
            </View>
            <Text style={styles.modalTitle}>Gérer mon abonnement</Text>
            <Text style={styles.modalBody}>
              La gestion de l'abonnement (changer d'offre, annuler, remboursement) se fait depuis
              l'App Store ou Google Play, sur l'application publiée.{"\n\n"}
              L'abonnement ne fonctionne pas dans l'aperçu Expo Go : il faut un build de développement
              ou l'app publiée. En attendant, « Restaurer mes achats » récupère un abonnement existant.
            </Text>
            <Pressable
              onPress={() => { setManageVisible(false); restore().catch(() => {}); }}
              style={[styles.modalBtn, { backgroundColor: colors.brand }]}
              testID="manage-restore"
            >
              <Text style={[styles.modalBtnText, { color: colors.onBrand }]}>RESTAURER MES ACHATS</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable
                onPress={() => {
                  const url = Platform.OS === "ios"
                    ? "https://apps.apple.com/account/subscriptions"
                    : "https://play.google.com/store/account/subscriptions";
                  Linking.openURL(url).catch(() => {});
                }}
                style={styles.modalSecondaryBtn}
                testID="manage-open-settings"
              >
                <Text style={styles.modalSecondaryText}>Ouvrir les réglages d'abonnement</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setManageVisible(false)} style={styles.modalCancel} testID="manage-close">
              <Text style={styles.modalCancelText}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingBottom: 12 },
    backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 22 },
    section: { fontFamily: FONTS.bodyBold, color: c.muted, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 28, marginBottom: 12, marginLeft: 4 },
    card: { backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, minHeight: 64 },
    rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
    rowTitle: { fontFamily: FONTS.bodyBold, color: c.onSurface, fontSize: 16 },
    rowSub: { fontFamily: FONTS.bodyRegular, color: c.muted, fontSize: 12, marginTop: 2 },
    divider: { height: 1, backgroundColor: c.border, marginLeft: 70 },
    healthBox: { marginTop: 28, padding: 14, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border },
    healthText: { fontFamily: FONTS.bodyRegular, color: c.muted, fontSize: 12, textAlign: "center", lineHeight: 18 },
    version: { fontFamily: FONTS.body, color: c.muted, fontSize: 12, textAlign: "center", marginTop: 20 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
    modalCard: { width: "100%", maxWidth: 380, backgroundColor: c.surfaceSecondary, borderRadius: 24, borderWidth: 1, borderColor: c.border, padding: 24, alignItems: "center" },
    modalIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    modalTitle: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 24, textAlign: "center" },
    modalBody: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 12 },
    modalBtn: { minHeight: 52, alignSelf: "stretch", borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 22 },
    modalBtnText: { fontFamily: FONTS.displaySemi, fontSize: 15, letterSpacing: 0.5 },
    modalSecondaryBtn: { minHeight: 48, alignSelf: "stretch", borderRadius: 24, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center", marginTop: 10 },
    modalSecondaryText: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 14 },
    modalCancel: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 8 },
    modalCancelText: { fontFamily: FONTS.body, color: c.muted, fontSize: 14 },
  });
