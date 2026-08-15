import { Platform } from "react-native";

// RevenueCat's native UI (Paywalls + Customer Center) only exists on iOS/Android
// dev/release builds. On web / Expo Go it is not available, so every helper here
// no-ops gracefully and the app falls back to the coded paywall screen.
// We lazy-require the module so importing it never breaks the web bundle.

function getRevenueCatUI(): any | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-purchases-ui");
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

function getPaywallResultEnum(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-purchases-ui").PAYWALL_RESULT ?? {};
  } catch {
    return {};
  }
}

/** True if RevenueCat's native paywall/customer-center UI can be presented. */
export const revenueCatUIAvailable = Platform.OS !== "web" && !!getRevenueCatUI();

/**
 * Present the RevenueCat-hosted paywall for the current offering.
 * Returns true if the user ended up subscribed (purchased or restored).
 * Native builds only — returns false on web / Expo Go (caller shows the coded paywall).
 */
export async function presentRevenueCatPaywall(): Promise<boolean> {
  const RevenueCatUI = getRevenueCatUI();
  if (!RevenueCatUI?.presentPaywall) return false;
  const PAYWALL_RESULT = getPaywallResultEnum();
  try {
    const result = await RevenueCatUI.presentPaywall();
    return (
      result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED
    );
  } catch {
    return false;
  }
}

/**
 * Present the RevenueCat Customer Center (manage/cancel subscription, restore,
 * request refund, etc.). Native builds only.
 */
export async function presentCustomerCenter(): Promise<void> {
  const RevenueCatUI = getRevenueCatUI();
  if (!RevenueCatUI?.presentCustomerCenter) return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch {
    // swallow — never crash the app on a UI-presentation failure
  }
}
