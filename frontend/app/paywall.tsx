import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { PurchasesPackage } from "react-native-purchases";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONTS, SPACING, RADIUS, hexAlpha, Colors } from "@/src/theme/tokens";
import PrimaryButton from "@/src/components/PrimaryButton";
import { useSubscription } from "@/src/lib/revenuecat";
import { presentRevenueCatPaywall, revenueCatUIAvailable } from "@/src/lib/revenuecatUI";

const PERKS = [
  "Tous les modes premium (Le Verdict, Tu me connais)",
  "Le moteur d'escalade complet (chaud + intime)",
  "Tous les packs & presets thématiques",
  "Des milliers de défis, enrichis en continu",
];

const PKG_TITLE: Record<string, string> = {
  ANNUAL: "Annuel",
  MONTHLY: "Mensuel",
  WEEKLY: "Hebdo",
  SIX_MONTH: "6 mois",
  THREE_MONTH: "3 mois",
  TWO_MONTH: "2 mois",
  LIFETIME: "À vie",
};

function pkgTitle(pkg: PurchasesPackage): string {
  return PKG_TITLE[pkg.packageType] || pkg.product.title || pkg.identifier;
}

function trialLabel(pkg: PurchasesPackage): string | null {
  const intro: any = (pkg.product as any).introPrice;
  if (!intro) return null;
  const price = intro.price;
  const units = intro.periodNumberOfUnits;
  const unit = String(intro.periodUnit || "").toLowerCase();
  if (price && price > 0) return null;
  const unitLabel =
    unit === "day" ? "jour" : unit === "week" ? "semaine" : unit === "month" ? "mois" : "jour";
  const plural = units > 1 ? "s" : "";
  return `${units} ${unitLabel}${plural} d'essai gratuit`;
}

function pkgSub(pkg: PurchasesPackage): string {
  const trial = trialLabel(pkg);
  if (trial) return `${trial} · puis ${pkg.product.priceString}`;
  if (pkg.packageType === "MONTHLY") return "Sans engagement";
  return pkg.product.priceString;
}

// Dynamic savings for the annual plan vs the weekly (preferred) or monthly plan.
function annualSavings(packages: PurchasesPackage[]): string | null {
  const annual = packages.find((p) => p.packageType === "ANNUAL");
  if (!annual?.product?.price) return null;
  const weekly = packages.find((p) => p.packageType === "WEEKLY");
  const monthly = packages.find((p) => p.packageType === "MONTHLY");
  let refYearly: number | null = null;
  let refLabel = "";
  if (weekly?.product?.price) {
    refYearly = weekly.product.price * 52;
    refLabel = "hebdo";
  } else if (monthly?.product?.price) {
    refYearly = monthly.product.price * 12;
    refLabel = "mensuel";
  }
  if (!refYearly || refYearly <= annual.product.price) return null;
  const pct = Math.round((1 - annual.product.price / refYearly) * 100);
  return pct > 0 ? `Économise ${pct}% vs ${refLabel}` : null;
}

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    packages,
    isSubscribed,
    identityReady,
    identityError,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    isLoading,
    simulatedStore,
    rcEnabled,
  } = useSubscription();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [selected, setSelected] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prefer the monthly plan by default (the headline offer), else the first.
  useEffect(() => {
    if (!selected && packages.length) {
      const monthly = packages.find((p) => p.packageType === "MONTHLY");
      setSelected((monthly || packages[0]).identifier);
    }
  }, [packages, selected]);

  // Close automatically once the entitlement is active.
  useEffect(() => {
    if (isSubscribed) {
      const t = setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace("/hub");
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isSubscribed, router]);

  // Native builds: present the RevenueCat-hosted Paywall once. If the user
  // completes or cancels there, we fall back to the coded screen below.
  const rcPaywallShown = useRef(false);
  useEffect(() => {
    if (!revenueCatUIAvailable || rcPaywallShown.current) return;
    rcPaywallShown.current = true;
    (async () => {
      const subscribed = await presentRevenueCatPaywall();
      if (subscribed) {
        if (router.canGoBack()) router.back();
        else router.replace("/hub");
      }
    })();
  }, [router]);

  const selectedPkg = packages.find((p) => p.identifier === selected) || null;
  const hasOffers = packages.length > 0;
  const savings = useMemo(() => annualSavings(packages), [packages]);

  const runPurchase = async () => {
    if (!selectedPkg) return;
    setConfirmVisible(false);
    setErrorMsg(null);
    try {
      await purchase(selectedPkg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      if (e?.userCancelled) return; // silent
      if (String(e?.message) === "identity_not_ready") {
        setErrorMsg("Connexion au store en cours, réessaie dans un instant.");
        return;
      }
      setErrorMsg(e?.message ? String(e.message) : "L'achat n'a pas pu aboutir. Réessaie.");
    }
  };

  const onSubscribe = () => {
    if (!selectedPkg || !identityReady) return;
    if (simulatedStore) {
      setConfirmVisible(true); // deliberate test purchase
    } else {
      runPurchase();
    }
  };

  const onRestore = async () => {
    Haptics.selectionAsync().catch(() => {});
    setErrorMsg(null);
    try {
      await restore();
    } catch {
      setErrorMsg("Aucun achat à restaurer.");
    }
  };

  const ctaLabel = (() => {
    if (!selectedPkg) return "CONTINUER";
    const trial = trialLabel(selectedPkg);
    if (trial) return `ESSAI GRATUIT · PUIS ${selectedPkg.product.priceString}`;
    return `CONTINUER · ${selectedPkg.product.priceString}`;
  })();

  return (
    <View style={styles.container} testID="paywall-screen">
      <View style={[styles.glow, { backgroundColor: hexAlpha(colors.brand, 0.16) }]} pointerEvents="none" />
      <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + 8 }]} testID="paywall-close" hitSlop={10}>
        <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 180, paddingHorizontal: SPACING.lg }} showsVerticalScrollIndicator={false}>
        <View style={styles.lockBadge}>
          <MaterialCommunityIcons name="lock-open-variant" size={15} color={colors.brand} />
          <Text style={styles.lockBadgeText}>ÇA DEVIENT INTÉRESSANT…</Text>
        </View>
        <Text style={styles.title}>Débloque tout le contenu sans filtre</Text>
        <Text style={styles.subtitle}>Le groupe est chaud. Passe au niveau supérieur et laisse Déclic tout révéler.</Text>

        <View style={styles.trialBadge} testID="paywall-trial-badge">
          <MaterialCommunityIcons name="gift-outline" size={18} color={colors.brand} />
          <Text style={styles.trialBadgeText}>3 jours gratuits · annulable à tout moment</Text>
        </View>

        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p} style={styles.perkRow}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.brand} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        {/* Plans */}
        {isLoading && !hasOffers ? (
          <View style={styles.loadingBox} testID="paywall-loading">
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Chargement des offres…</Text>
          </View>
        ) : hasOffers ? (
          <View style={styles.plans}>
            {packages.map((pkg) => {
              const active = selected === pkg.identifier;
              const isBest = pkg.packageType === "ANNUAL";
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => { setSelected(pkg.identifier); Haptics.selectionAsync().catch(() => {}); }}
                  style={[styles.plan, { borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary }]}
                  testID={`plan-${pkg.packageType.toLowerCase()}`}
                >
                  <View style={[styles.radioOuter, { borderColor: active ? colors.brand : colors.borderStrong }]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{pkgTitle(pkg)}</Text>
                    <Text style={styles.planSub}>{pkgSub(pkg)}</Text>
                    {isBest && savings && (
                      <Text style={styles.savingsText} testID="plan-annual-savings">{savings}</Text>
                    )}
                  </View>
                  <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                  {isBest && (<View style={styles.bestTag}><Text style={styles.bestText}>MEILLEURE OFFRE</Text></View>)}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.unavailable} testID="paywall-unavailable">
            <MaterialCommunityIcons name="storefront-outline" size={26} color={colors.muted} />
            <Text style={styles.unavailableText}>
              La boutique n'est pas disponible dans l'aperçu Expo Go. Les abonnements se testent
              uniquement sur un build de développement ou une app publiée (App Store / Google Play).
            </Text>
          </View>
        )}

        {simulatedStore && rcEnabled && hasOffers && (
          <Text style={styles.simNote} testID="paywall-sim-note">
            Mode test (Store de test RevenueCat) — aucun paiement réel n'est effectué en préversion.
          </Text>
        )}
        {errorMsg && <Text style={styles.errorText} testID="paywall-error">{errorMsg}</Text>}
        {identityError && <Text style={styles.errorText}>Store indisponible : {identityError}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <LinearGradient colors={["rgba(0,0,0,0)", colors.surface]} style={StyleSheet.absoluteFill} />
        {hasOffers && (
          <PrimaryButton
            label={ctaLabel}
            onPress={onSubscribe}
            loading={isPurchasing}
            disabled={!selectedPkg || !identityReady}
            testID="subscribe-button"
            haptic="heavy"
          />
        )}
        <Pressable onPress={onRestore} style={styles.restore} testID="restore-button" disabled={isRestoring}>
          <Text style={styles.restoreText}>{isRestoring ? "Restauration…" : "Restaurer mes achats"}</Text>
        </Pressable>
      </View>

      {/* Deliberate test-purchase confirmation (simulated store only) */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="paywall-confirm-modal">
            <Text style={styles.modalTitle}>Achat de test</Text>
            <Text style={styles.modalBody}>
              {selectedPkg ? `${pkgTitle(selectedPkg)} — ${selectedPkg.product.priceString}` : ""}
              {"\n"}Ceci est une simulation via le Store de test (aucun paiement réel).
            </Text>
            <PrimaryButton label="Confirmer" onPress={runPurchase} loading={isPurchasing} testID="confirm-purchase-button" />
            <Pressable onPress={() => setConfirmVisible(false)} style={styles.modalCancel} testID="cancel-purchase-button">
              <Text style={styles.restoreText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    glow: { position: "absolute", top: -100, right: -80, width: 340, height: 340, borderRadius: 170 },
    close: { position: "absolute", right: 16, zIndex: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    lockBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: c.brandSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill },
    lockBadgeText: { fontFamily: FONTS.bodyBold, color: c.brand, fontSize: 11, letterSpacing: 1 },
    title: { fontFamily: FONTS.display, color: c.onSurface, fontSize: 38, lineHeight: 42, marginTop: 16 },
    subtitle: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 16, marginTop: 10, lineHeight: 23 },
    trialBadge: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, backgroundColor: c.brandSoft, borderWidth: 1, borderColor: hexAlpha(c.brand, 0.35), paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.md },
    trialBadgeText: { fontFamily: FONTS.bodyBold, color: c.brand, fontSize: 14, flex: 1 },
    savingsText: { fontFamily: FONTS.bodyBold, color: c.success, fontSize: 12, marginTop: 3 },
    perks: { gap: 12, marginTop: 24 },
    perkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    perkText: { fontFamily: FONTS.body, color: c.onSurface, fontSize: 15, flex: 1 },
    plans: { gap: 12, marginTop: 28 },
    plan: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: RADIUS.md, padding: 18, minHeight: 72 },
    radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.brand },
    planTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 19 },
    planSub: { fontFamily: FONTS.body, color: c.muted, fontSize: 12, marginTop: 2 },
    planPrice: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 16 },
    bestTag: { position: "absolute", top: -10, right: 16, backgroundColor: c.brand, paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill },
    bestText: { fontFamily: FONTS.bodyBold, color: c.onBrand, fontSize: 9, letterSpacing: 0.5 },
    loadingBox: { marginTop: 32, alignItems: "center", gap: 12 },
    loadingText: { fontFamily: FONTS.body, color: c.muted, fontSize: 14 },
    unavailable: { marginTop: 28, alignItems: "center", gap: 10, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: 20 },
    unavailableText: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },
    simNote: { fontFamily: FONTS.body, color: c.muted, fontSize: 12, marginTop: 16, textAlign: "center" },
    errorText: { fontFamily: FONTS.bodyBold, color: c.brand, fontSize: 13, marginTop: 14, textAlign: "center" },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: SPACING.lg, paddingTop: 24, gap: 10 },
    restore: { alignItems: "center", justifyContent: "center", minHeight: 40 },
    restoreText: { fontFamily: FONTS.body, color: c.muted, fontSize: 14 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
    modalCard: { width: "100%", maxWidth: 360, backgroundColor: c.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 22, gap: 14 },
    modalTitle: { fontFamily: FONTS.displaySemi, color: c.onSurface, fontSize: 22 },
    modalBody: { fontFamily: FONTS.body, color: c.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
    modalCancel: { alignItems: "center", justifyContent: "center", minHeight: 40 },
  });
