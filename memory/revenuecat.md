# RevenueCat — integrated (15 août 2026)
Ce fichier sert de mémoire pour interagir avec le compte RevenueCat de l'utilisateur via l'integration proxy à tout moment ultérieur.

## État actuel
- connection_state: **connected** / project_state: **connected** (15/08/2026).
- Projet RevenueCat provisionné via /setup. Entitlement `pro` avec produits attachés (vérifié).
- Clés SDK réelles écrites dans frontend/.env (TEST/IOS/ANDROID). Ne jamais y mettre de placeholder ni de valeur vide.
- Code app-side entièrement branché : src/lib/revenuecat.tsx (init module-scope, SubscriptionProvider, useSubscription), app/_layout.tsx, paywall.tsx, settings.tsx (Customer Center), revenuecatUI.ts (paywall natif RC + fallback codé).

## Identifiers (réponse /setup — verbatim)
- rc_project_id: projaddfb47a
- apple_app_id: appb50ff043e8
- play_app_id: appdf2a8d889f
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, prix courant) :
  - $rc_weekly  -> prodb9a79a1b9d  (5,39 € / P1W, essai: P3D — 3 jours gratuits)
  - $rc_monthly -> prod76d09802c9  (19,99 € / P1M, essai: P3D)
  - $rc_annual  -> prod619d157617  (39,99 € / P1Y, essai: P3D)
- NOTE Test Store: le produit test 'pro.weekly' n'a pas de données produit en Browser Mode (préversion) -> le plan Hebdo ne s'affiche pas en preview et les prix affichés sont les défauts USD du Test Store. Les prix EUR + essai + hebdo s'appliqueront sur les vrais builds App Store / Play une fois les produits IAP créés côté store.
- Dashboard: https://app.revenuecat.com/projects/projaddfb47a

## Identifiants app
- bundle_id / package_name: com.declic.app  (changé le 15/08/2026, ex-com.emergent.helloworld.ic89as)
- slug / scheme: declic
- Projet integration proxy: a4472f55-b2e5-40a8-bec6-580b7ae63e41
- Re-provisionné via /setup avec com.declic.app : clés SDK INCHANGÉES (liées au projet RevenueCat, pas au bundle id) -> frontend/.env reste valide.

## Statut (vérif ultérieure). Si project_state < project_created, re-fetch le playbook via integration_expert.
```bash
AUTH='Authorization: Bearer <emergent_key>'   # fournie inline par la plateforme, ne jamais stocker
curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/a4472f55-b2e5-40a8-bec6-580b7ae63e41/status"
```

## Mises à jour produits (APIs integration proxy UNIQUEMENT — JAMAIS l'API REST RevenueCat)
- Changer prix/durée/essai OU ajouter un package (upsert) :
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/a4472f55-b2e5-40a8-bec6-580b7ae63e41/products
  body: {"products":[{"package":"$rc_monthly","price":8.99,"currency":"EUR","period":"P1M","trial":"P3D","prices":[{"amount_micros":8990000,"currency":"EUR"}]}]}
  (amount_micros = price × 1 000 000 ; omettre "trial" si aucun)
- Supprimer un package :
  DELETE $INTEGRATION_PROXY_URL/internal/revenuecat/projects/a4472f55-b2e5-40a8-bec6-580b7ae63e41/products/%24rc_monthly  ($ -> %24)
- Récupérer les identifiants / repeupler .env : relancer le /setup idempotent.

## Règle produit demandée par l'utilisateur
- Essai gratuit 3 jours puis mensuel auto (trial P3D sur $rc_monthly). Fait.
- Le paywall ne s'affiche QUE au tap sur un pack premium verrouillé (hub/launch/settings), jamais entre les manches.

## Passage en LIVE — étapes store (l'UTILISATEUR fait ces étapes — l'agent ne peut ni les faire ni les vérifier)
Nécessaire UNIQUEMENT pour les vrais achats en build publié. Le Test Store (Expo Go / web preview / dev build) n'en a pas besoin.
- Uploader les credentials App Store Connect (.p8) et Google Play (service-account JSON) dans le dashboard RevenueCat.
- Configurer les profils de paiement (App Store Connect + Play Console).
- Créer les produits IAP avec les MÊMES product ids que le dashboard RevenueCat.
- Build release, tester via TestFlight / test interne Play, puis soumettre.
Toutes ces étapes figurent dans la section FAQ du panneau Payments.
