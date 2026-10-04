import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import Purchases, { INTRO_ELIGIBILITY_STATUS, LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storage } from "@/src/utils/storage";

// ----------------------------- Keys & environment -----------------------------

const TEST_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

// The RevenueCat entitlement that unlocks all premium content (from /setup).
export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro";

// Expo Go / web preview / any dev build run against the RevenueCat Test Store.
export const simulatedStore = Platform.OS === "web" || __DEV__;

// The integration is usable as long as we have at least one API key.
export const rcEnabled = !!(TEST_KEY || IOS_KEY || ANDROID_KEY);

function getApiKey(): string {
  if (simulatedStore) return TEST_KEY as string; // Test Store (Expo Go + web preview + dev)
  if (Platform.OS === "ios") return IOS_KEY || (TEST_KEY as string);
  if (Platform.OS === "android") return ANDROID_KEY || (TEST_KEY as string);
  return TEST_KEY as string;
}

// Stable, device-scoped id used for Purchases.logIn — Déclic has no accounts
// (pass-and-play), so we persist an install id. Restore Purchases handles
// re-installs / new devices. Never a bare random UUID passed inline: it is
// persisted so the same device keeps the same RevenueCat user across launches.
const INSTALL_ID_KEY = "declic.rcInstallId";

async function getInstallId(): Promise<string> {
  const existing = await storage.getItem(INSTALL_ID_KEY, "");
  if (existing && typeof existing === "string") return existing;
  const id = `declic_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await storage.setItem(INSTALL_ID_KEY, id);
  return id;
}

// Called ONCE at module scope in app/_layout.tsx, before any component mounts.
export function initializeRevenueCat() {
  if (!rcEnabled) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: getApiKey() });
  } catch (err) {
    // Never crash the app on a config error (e.g. web Browser Mode quirks).
    console.warn("[RevenueCat] configure failed:", err);
  }
}

// ----------------------------- Context -----------------------------

function useSubscriptionState() {
  const queryClient = useQueryClient();
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => Purchases.getCustomerInfo(),
    enabled: rcEnabled,
    staleTime: 60 * 1000,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: () => Purchases.getOfferings(),
    enabled: rcEnabled,
    staleTime: 300 * 1000,
    retry: false,
  });

  // Whether THIS customer can still get the free trial. An introductory offer
  // is consumable once per Apple ID per subscription group, while
  // product.introPrice describes the offer as configured and says nothing about
  // who may claim it - so a returning subscriber would otherwise be promised a
  // trial and charged straight away.
  const productIds = useMemo(
    () =>
      (offeringsQuery.data?.current?.availablePackages ?? [])
        .map((p) => p.product.identifier)
        .sort(),
    [offeringsQuery.data],
  );

  const eligibilityQuery = useQuery({
    queryKey: ["revenuecat", "intro-eligibility", productIds.join(",")],
    queryFn: () => Purchases.checkTrialOrIntroductoryPriceEligibility(productIds),
    enabled: rcEnabled && productIds.length > 0,
    staleTime: 300 * 1000,
    retry: false,
  });

  // Bind a stable device identity so purchases are never anonymous.
  useEffect(() => {
    if (!rcEnabled) return;
    let mounted = true;
    (async () => {
      try {
        const id = await getInstallId();
        const { customerInfo } = await Purchases.logIn(id);
        const currentId = await Purchases.getAppUserID();
        if (mounted) {
          queryClient.setQueryData(["revenuecat", "customer-info"], customerInfo);
          setAppUserId(currentId);
          setIdentityError(null);
        }
      } catch (e) {
        if (mounted) setIdentityError(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [queryClient]);

  // Reactive entitlement updates (purchases, restores, renewals). Never poll.
  useEffect(() => {
    if (!rcEnabled) return;
    const listener = (info: CustomerInfo) =>
      queryClient.setQueryData(["revenuecat", "customer-info"], info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
  }, [queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      const id = await Purchases.getAppUserID();
      if (id.startsWith("$RCAnonymousID:")) throw new Error("identity_not_ready");
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    // Write the fresh CustomerInfo straight into the cache so the entitlement
    // flips to active immediately — the update listener is not guaranteed to
    // fire in Browser Mode (web preview / Expo Go Test Store).
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(["revenuecat", "customer-info"], customerInfo);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(["revenuecat", "customer-info"], customerInfo);
    },
  });

  // "Declic Pro" is the single premium tier. We match the configured
  // entitlement key, but also treat ANY active entitlement as premium so the
  // gate is robust to the exact identifier used in the RevenueCat dashboard
  // (e.g. "pro" vs "Declic Pro").
  const activeEntitlements = customerInfoQuery.data?.entitlements.active ?? {};
  const isSubscribed =
    activeEntitlements[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined ||
    Object.keys(activeEntitlements).length > 0;

  // The CURRENT app user id, not customerInfo.originalAppUserId: RevenueCat
  // keeps "original" pointing at the first id this customer ever had, which is
  // the anonymous one Purchases.configure() mints before logIn runs. Reading it
  // here left identityReady false forever and disabled the subscribe button.
  const identityReady = !!appUserId && !appUserId.startsWith("$RCAnonymousID:");

  const packages = offeringsQuery.data?.current?.availablePackages ?? [];

  // Only INELIGIBLE and NO_INTRO_OFFER_EXISTS hide the trial. UNKNOWN, and the
  // window before the store answers, stay optimistic: hiding a trial the
  // customer is actually entitled to would cost us the conversion, while the
  // store sheet remains the source of truth either way.
  const trialEligibility = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const [productId, value] of Object.entries(eligibilityQuery.data ?? {})) {
      const status = (value as { status?: INTRO_ELIGIBILITY_STATUS })?.status;
      map[productId] =
        status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE &&
        status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS;
    }
    return map;
  }, [eligibilityQuery.data]);

  const isTrialEligible = (pkg: PurchasesPackage) =>
    trialEligibility[pkg.product.identifier] !== false;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    packages,
    isSubscribed,
    identityReady,
    identityError,
    isTrialEligible,
    rcEnabled,
    simulatedStore,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    offeringsError: offeringsQuery.isError,
    refreshOfferings: offeringsQuery.refetch,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionState>;
const Ctx = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionState();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
