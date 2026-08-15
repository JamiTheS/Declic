# RevenueCat — integrated (2026-08-15)
This file serves as memory for interacting with the user's RevenueCat account via the integration proxy later.

## Identifiers (from /setup response — verbatim)
- rc_project_id: projc82d42e0
- apple_app_id: appeb21051f8a
- play_app_id: app63ff9f421a
- entitlement_lookup_key: pro
- offering_lookup_key: default
- bundle_id / package_name: com.declic.app
- Packages (package -> product_id, current price):
  - $rc_monthly -> prod2e32f41e3f   ($9.99 / P1M, trial: none)
  - $rc_annual  -> prodd9a63109d4   ($79.99 / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/projc82d42e0

SDK keys live in frontend/.env only (EXPO_PUBLIC_REVENUECAT_TEST/IOS/ANDROID_API_KEY) — NOT stored here.

## Status check
If project_state is less than project_created, re-fetch the RevenueCat playbook via the integration expert tool.
```
AUTH='Authorization: Bearer <emergent key — pre-substituted by platform>'
curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/031a1b09-1196-4e50-8ab6-7291d0f9f0f8/status"
```
Last status (2026-08-15): connection_state=connected, project_state=connected.

## Later product updates (integration proxy APIs ONLY — NEVER call the RevenueCat REST API)
- Change price/duration/trial OR add a package (upsert):
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/031a1b09-1196-4e50-8ab6-7291d0f9f0f8/products
  body: {"products":[{"package":"$rc_monthly","price":14.99,"currency":"USD","period":"P1M","trial":"P1W","prices":[{"amount_micros":14990000,"currency":"USD"}]}]}
  (amount_micros = price × 1,000,000; omit "trial" for none)
- Remove a package:
  DELETE $INTEGRATION_PROXY_URL/internal/revenuecat/projects/031a1b09-1196-4e50-8ab6-7291d0f9f0f8/products/%24rc_monthly  ($ -> %24)
- Recover identifiers / repopulate .env: re-run the idempotent /setup call.

## App code map (already implemented, playbook-aligned)
- src/lib/revenuecat.tsx — SubscriptionProvider + useSubscription (init at module scope, logIn with persisted device id, customer-info listener, purchase w/ anonymous guard, restore, isSubscribed on "pro").
- src/lib/revenuecatUI.ts — web-safe wrapper for RevenueCat-hosted Paywall + Customer Center (native only).
- app/paywall.tsx — coded paywall (dynamic packages/prices), Restore button, identity gating, unavailable state, test-purchase confirmation modal.
- app/_layout.tsx — initializeRevenueCat() at module scope + <SubscriptionProvider>.
- src/context/AppContext.tsx — isPremium = isSubscribed (RC entitlement is sole source of truth; no backend pro flags).

## Taking purchases LIVE — store-side steps (USER does these; Emergent cannot)
Needed ONLY for REAL purchases in published store builds; Test Store (Expo Go / web / dev build) needs none.
1. Upload store credentials to the RevenueCat dashboard: iOS App Store Connect API key (.p8) + Google Play service-account JSON.
2. Set up payment profiles in App Store Connect and Play Console.
3. Create matching IAP products with the SAME product IDs shown in the RevenueCat dashboard (monthly / annual).
4. Make a release build, test via TestFlight / Play internal testing, then submit for review.
All steps are also documented in the FAQ section of the Emergent payments panel.
