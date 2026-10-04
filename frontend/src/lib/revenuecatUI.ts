import { Platform } from "react-native";

// RevenueCat's native Customer Center only exists on iOS/Android dev/release
// builds. On web / Expo Go it is not available, so every helper here no-ops
// gracefully. We lazy-require the module so importing it never breaks the web
// bundle. The paywall itself is our own coded screen (app/paywall.tsx), never
// RevenueCat's hosted one.

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

/** True if RevenueCat's native paywall/customer-center UI can be presented. */
export const revenueCatUIAvailable = Platform.OS !== "web" && !!getRevenueCatUI();

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
