# PRD — Déclic (party game social)

## Problème / Vision
Party game social FR (pass-and-play, un seul téléphone) pour groupes d'amis 18-25 ans.
Jeu d'ambiance / brise-glace qui "révèle les gens" et crée de vraies connexions.
IMPORTANT conformité : ce n'est PAS une app d'alcool. L'alcool = une option de gage parmi
d'autres, toujours avec alternative non-alcoolisée (Loi Évin / App Store 1.4.3 & 4.3).

## Personas
- Étudiant·e 18-25 (BDE, soirées d'intég, coloc, before). Attention réduite en soirée → "Drunk UX".

## Choix utilisateur (session 1)
- Nom app: **Déclic**
- Modes: tous les modes de base + premium (Le Verdict, Tu me connais) — pas de Hot/Intime en MVP
- Paywall: visuel + achat **simulé** (RevenueCat au déploiement)
- Contenu: petit lot de démarrage original FR (le proprio fournira le reste)
- Récap de soirée: inclus

## Architecture
- Frontend: Expo (React Native) + expo-router (stack). Dark-mode. Polices Clash Display + Satoshi.
- Backend: FastAPI + MongoDB (motor). Catalogue éditable à distance via /api/cards (CRUD).
- Local-first: catalogue fetché + caché (AsyncStorage), fallback embarqué (seedCards.ts).
- State: AppContext (joueurs, réglages, premium, stats de session) + CatalogContext + ThemeContext.
- Moteur d'escalade ("le DJ") : src/engine/escalation.ts (tri/pondération par intensité 1-5, alternance des modes, cap par ambiance chill/standard/chaud).

## Implémenté (2026-06 / session 1)
- Age gate 18+ (avec message sanitaire) + écran bloquant si <18.
- Setup joueurs (chips + emoji auto, min 2 / max 16), toggle "Sans alcool".
- Hub des modes : Soirée Déclic (phare/escalade), Qui est le plus, Je n'ai jamais,
  Action ou Vérité, Cash ou Cash, + premium Le Verdict & Tu me connais ; packs thématiques ;
  sélecteur d'ambiance.
- Gameplay plein écran : couleur de carte selon l'intensité, barre de progression, tap pour
  avancer (modes texte), vote (Qui est le plus), vote secret Oui/Non (Le Verdict), devinette
  en paire (Tu me connais), bouton Passer, garde-écran-allumé (natif).
- Gages avec alternative non-alcoolisée + bandeau sanitaire quand gage alcoolisé (masqué en mode sober).
- Paywall floutée (3 offres hebdo/mensuel/annuel), achat **simulé**, restauration, interception auto sur carte premium + carte "verrouillée" inline.
- Récap partageable (stats + superlatifs, watermark, capture view-shot + partage natif).
- Réglages (sober, haptique, thème sombre/clair, restaurer, premium, confidentialité, message sanitaire).
- Backend: /api/health, /api/catalog (+include_premium), /api/cards CRUD, /api/packs, /api/events. Seed auto de 40 cartes originales FR.
- Tests: 11/11 backend (pytest) + tous les flux frontend validés par le testing agent.

## Session 2 (2026-06) — Import contenu + Design "Pop & coloré"
- **Import LOT 1 : 149 questions** (fichier `questions_lot1.csv` du proprio) parsées et mappées dans `backend/seed_cards.py` :
  - qui-est-le-plus 37 · je-nai-jamais 29 · action-verite 38 (variantes action/vérité) · cash-ou-cash 11 (split `//`) · le-verdict 10 · tu-me-connais 8 · **hot 16** (nouveau mode 18+ premium)
  - reseed versionné (CATALOG_VERSION=2) : bump de version = ré-import auto ; champ `vibe` ajouté ; packs premium calculés data-driven.
- **Design "Pop & coloré"** (fichier `spec_ux_design.md`) appliqué :
  - Palette : châssis sombre encré `#12101A` + accents pop ; couleur **signature par mode** sur les cartes plein écran (violet/cyan/corail/jaune/bleu/lime/magenta) avec texte adaptatif (blanc ou ink) pour contraste AA/AAA.
  - **Thermomètre d'intensité** 5 segments en pied de la boucle de jeu (lime→magenta).
  - Hub : tuiles colorées par mode + tuile Hot premium. Gradients récap/paywall/age-gate mis au diapason.
  - Le Verdict reformaté en **spotlight** (joueur au centre + question, tap pour avancer) pour coller aux questions fournies.
- Vérifié : backend 149 cartes/7 modes, cash split, hub coloré, cartes Je n'ai jamais (cyan) & Cash ou Cash (jaune) OK.

## Session 3 (2026-06) — Presets, Vibes, Verdict animé, ingestion tolérante
- **Presets (data-driven)** : colonne `packs` ajoutée au schéma catalogue (liste séparée par virgules). Presets dérivés côté serveur (`/api/catalog` → `presets[]` avec count/premium/hot). Nouvel écran `app/launch.tsx` (choix Preset + Vibe en un tap) atteint via la tuile Soirée Déclic + section "Presets soirée" du hub. Lot 1 sans colonne `packs` → presets inférés (Intég/Coloc/Entre meufs/Couples), écrasés dès que le prochain lot fournit `packs`.
- **Vibes** : filtre sur la colonne `ambiance` (Découverte/Fun/Sans filtre/Hot) combiné au moteur d'escalade. La vibe **Hot exige 18+ ET premium** (gate au lancement + gating par carte : aucune carte premium/age18 en gratuit).
- **Le Verdict animé** : vote **anonyme 0→10** passé de main en main, agrégation → **décompte 3-2-1 + confettis** (composant `Confetti` sans dépendance) + révélation de la **moyenne /10** (jamais les votes individuels).
- **Ingestion tolérante** : parser CSV basé sur DictReader → colonnes inconnues ignorées, colonnes manquantes gérées ; schéma canonique `id,mode,ambiance,intensite,texte,cible,gage,alternative_sans_alcool,tags_theme,packs,premium,age18,actif`. Reseed versionné (CATALOG_VERSION=3).
- Préservé : offline (pack embarqué + sync), mode Sans alcool (gage→alternative), catalogue éditable à distance (CRUD).

## Session 4 (2025-08) — Réimport GitHub + back-office contenu + DA "Dark Editorial"
- **Réimport** du repo GitHub dans Emergent ; recréation des .env (backend MONGO/DB/ADMIN_TOKEN, frontend EXPO_PUBLIC_BACKEND_URL) et réinstall des deps. 149 cartes seed OK.
- **Bug corrigé — édition des joueurs** : impossible de modifier les joueurs après le setup initial (fallait relancer l'app). Le hub ("X joueurs en piste" + crayon) ouvre `/setup?edit=1` (CTA ENREGISTRER → retour hub). Cause racine web : doublon d'écrans `/setup` dans la pile → corrigé en passant setup→hub en `router.replace`.
- **Gestion de contenu à distance (back-office)** : nouveaux endpoints backend protégés par `X-Admin-Token` (ADMIN_TOKEN) : `POST /cards`, `PUT/DELETE /cards/{id}`, `POST /cards/bulk`, `POST /import/csv` (CSV tolérant : délimiteur auto, listes `|`/`;`, split `//` pour cash-ou-cash), `POST /admin/verify`, `GET /admin/cards`, `GET /admin/summary`. Les lectures publiques restent ouvertes. **Reseed préserve le contenu manuel** (champ `source=manual`, delete_many({source≠manual})). Écran in-app `/admin` (Réglages → Espace créateur) : gate par jeton, formulaire d'ajout + import CSV, résumé live ; refresh catalogue après ajout.
- **Refonte DA "Dark Editorial" (Option A)** : palette disciplinée = encre `#0B0B0E` + crème `#F4F1EA` + accent signature terracotta `#E8654F` ; couleur de mode utilisée uniquement en accent (icône, liseré, jauge, thermomètre) — fini les aplats néon plein écran et le dégradé arc-en-ciel du récap (remplacé par un duotone terracotta→encre). Tuiles hub sombres + liseré coloré. Confettis Verdict raffinés.
- **Thème clair fonctionnel** : chaque écran construit ses styles via `makeStyles(useTheme().colors)` (DARK/LIGHT) ; StatusBar + fond du Stack s'adaptent (`ThemedChrome`). Le toggle des réglages change réellement l'UI.
- **Confidentialité in-app** (`/privacy`, plus de 404 vers declic.app) + cache catalogue bump v3.
- Vérifié : backend 32/32 (agent) ; frontend (agent) édition joueurs, back-office, thème, carte de jeu — tous PASS.

## Session 5 (2025-08) — Airtable source unique + accès admin camouflé
- **Airtable = source unique de vérité** : table `Questions` (base app0soKINsLh37gUg / tblgbeNjwNwITYUGv) ; 149 questions locales migrées. Backend mirroir Airtable→MongoDB au démarrage + `POST /api/admin/sync` (offset pagination), `GET /api/admin/airtable-info`, `DELETE /api/admin/airtable/{id}` (supprime dans Airtable + local). Token Airtable côté serveur uniquement (backend/.env). Fallback seed si Airtable injoignable. Vérifié agent : 14/14.
- **Back-office `/admin` refait** : Synchroniser · Ouvrir Airtable · Parcourir/Supprimer (filtre par mode). Guide de format `CONTENU_GUIDE.md` + `content_template.csv`.
- **Accès admin camouflé** : la ligne "Espace créateur" a été retirée des Réglages ; l'accès se fait par un geste secret (7 appuis sur le numéro de version) puis jeton. Route `/admin` toujours protégée par jeton.



## Backlog priorisé
### P0 (avant store)
- Brancher RevenueCat + Superwall au moment du déploiement (achats réels iOS/Android).
- Remplacer/enrichir le catalogue avec les milliers de questions du proprio (source éditable Airtable/Sheets → sync).
- Politique de confidentialité hébergée (URL) + Privacy Labels / Data Safety + classification 18+.

### P1
- Mode Hot / Intime (18+) si souhaité plus tard.
- Mini-tuto onboarding 2 slides (skippable).
- Prompt d'avis natif après un Récap réussi.
- Sons légers optionnels + haptique enrichie.
- Analytics KPIs (D1/D7/D30, conversion, partages) dashboard.

### P2
- Multi-téléphones connectés (façon Jackbox), packs BDE co-brandés, saisons de contenu, défis vidéo.
- Mini back-office web pour éditer le catalogue.

## Notes techniques
- useKeepAwake => natif-only (le web refuse Wake Lock).
- Paywall = simulé (unlockPremium = flag local persistant).
- Zéro donnée perso envoyée au serveur ; catalogue en lecture seule côté app.

## Import (15 août 2026)
- Code source importé depuis archive GitHub (Declic-main.zip) dans le workspace Emergent.
- Dépendances réinstallées (yarn + pip). Services relancés et vérifiés.
- Backend OK (/api/health, catalogue 149 cartes), frontend OK (age-gate affiché, polices Clash Display/Satoshi chargées).

## Airtable connecté (15 août 2026)
- Base app0soKINsLh37gUg / table tblgbeNjwNwITYUGv reliées via AIRTABLE_* dans backend/.env.
- Sync OK: 149 questions récupérées et mirrorées dans MongoDB (au démarrage + POST /api/admin/sync).
- Airtable = source de vérité: éditer les questions dans Airtable, puis Sync depuis lécran admin.

## Abonnements (en cours)
- RevenueCat: essai gratuit 3 jours puis mensuel auto — en attente de la connexion "Connect RevenueCat".
- Règle produit: paywall uniquement au tap sur un pack premium verrouillé, jamais entre les manches dune partie.

## Health check déploiement + fix routes (15 août 2026)
- 3 bloqueurs du health check corrigés: (1) ADMIN_TOKEN sans fallback codé en dur (env-only, fail-closed) + valeur forte dans backend/.env; (2) babel: react-native-worklets/plugin placé en dernier; (3) .gitignore racine: règles .env* retirées.
- BUG CRITIQUE résolu: expo-router affichait "Welcome to Expo" (0 route). Cause: conflit de versions Metro (top-level metro@0.83.7 vs suite 0.83.3) cassant la résolution de EXPO_ROUTER_APP_ROOT (contexte résolu vers node_modules/expo-router/app/frontend/app au lieu de /app/frontend/app).
  - Fix durable: resolutions "metro":"0.83.3" dans package.json + patch-package (patches/expo-router+6.0.24.patch remplaçant process.env.EXPO_ROUTER_APP_ROOT par "../../app" dans _ctx*.js) appliqué via script postinstall.
- Vérifié: testing agent 14/14 backend + flux frontend (age-gate -> setup -> hub -> game, paywall fallback, settings). Rotation token admin OK.
- Restant (soumission store, non bloquant pour preview): bundleIdentifier/package génériques (com.emergent.helloworld.ic89as) - à personnaliser sur demande user; URL publique de politique de confidentialité pour les stores.

## Intégration RevenueCat SDK (Expo) — 15 août 2026
- react-native-purchases + react-native-purchases-ui installés. SDK configuré au module scope (initializeRevenueCat dans _layout).
- Hook useSubscription: customerInfo, offerings, isSubscribed (entitlement, robuste "pro"/"Declic Pro"), purchase, restore, listener temps réel.
- Paywall: écran codé (offerings dynamiques) affiche déjà Mensuel 9,99$ / Annuel 79,99$ / À vie depuis le Test Store; sur build natif présente le Paywall RevenueCat (RevenueCatUI.presentPaywall) avec fallback codé.
- Customer Center: Réglages -> "Gérer mon abonnement" (natif) via presentCustomerCenter().
- Wrapper web-safe src/lib/revenuecatUI.ts (lazy require, no-op web/Expo Go).
- Gating premium sur entitlement (isPremium = isSubscribed). Restore branché.
- Native-only (paywall RC + customer center): testables uniquement sur build iOS/Android réel.


## Session 6 (15 août 2026) — Réimport + câblage de La Bombe 💣
- **Réimport** de l'archive (Declic-main.zip) dans Emergent : sources frontend/backend copiées, `.env` protégés préservés, deps réinstallées (yarn + pip). Airtable reconnecté (base app0soKINsLh37gUg / table tblgbeNjwNwITYUGv) → **357 questions** synchronisées au démarrage. ADMIN_TOKEN=`declic-admin-2026`.
- **La Bombe câblée** (`app/game.tsx`, seul fichier produit modifié) :
  - `soundEnabled` ajouté à la déstructuration de `useApp()`.
  - `deck` useMemo : branche `mode === "bombe"` → cartes bombe du catalogue si présentes, sinon `buildDefaultBombeDeck()` (14 catégories de secours).
  - `renderContent()` : `case "bombe"` rend `<BombeContent card sober pal haptics sound onDone={next} />`.
  - Barre du bas (Passer + thermomètre) **masquée** pour `mode === "bombe"` (la Bombe gère sa propre boucle de taps + minuteur caché). Bombe volontairement absente de `ADVANCE_MODES`/`SINGLE_TARGET`.
- **Confessions** : déjà terminé (session précédente), route `/confessions`, exclu de la Soirée via escalation.
- **Vérifié (testing agent) : PASS complet** — backend 14/14 ; La Bombe bout-en-bout (catégorie → passes → BOOM haptique + gage/alternative + message sanitaire → carte suivante) ; Confessions (dont cas < 3 joueurs) ; 7 modes existants + Soirée sans régression ; réglages sober/haptique/son/thème OK.
- **À faire côté Airtable (utilisateur)** : ajouter les options `bombe` (et `confession`) au champ single-select `mode` de la table Questions pour héberger du vrai contenu. En attendant, La Bombe tourne sur son deck de secours embarqué.

## Session 7 (15 août 2026) — Notifications push (Emergent managed)
- **Intégration push gérée par Emergent** (relais SuprSend) ajoutée. L'app n'ayant pas de comptes, un **device id persistant** est généré côté client (`src/lib/push.ts`, stocké via storage util) et sert de `user_id`.
- **Frontend** (`app/_layout.tsx`) : `setNotificationHandler` + canal Android `default` (importance MAX) au module scope ; enregistrement à chaque ouverture (`registerForPush` → permission → `getDevicePushTokenAsync` → POST `/api/register-push`) ; gestion des taps (warm `addNotificationResponseReceivedListener` + cold-start `getLastNotificationResponseAsync`, routage via `deeplink`/`action_url`) ; **relance hebdo** thématisée (Modal) si permission refusée définitivement → `Linking.openSettings()`. Tout est gardé `Platform.OS !== "web"`.
- **Backend** (`server.py`) : `POST /api/register-push` (relaie vers `/api/v1/push/users/register` avec `EMERGENT_PUSH_KEY`, upsert du user_id dans `push_users`), helper `send_push()` (max 100, chunké), `POST /api/admin/broadcast` (protégé `X-Admin-Token`, push de réengagement à tous les devices). httpx ajouté.
- **Config** : plugin `expo-notifications` + `android.googleServicesFile: ./google-services.json` dans `app.json`. **google-services.json fourni par le proprio** (projet declic-ae023, package `com.declic.app` ✓).
- **Env** : `EMERGENT_PUSH_KEY="placeholder"` ajouté (remplacé auto au déploiement — NE PAS éditer).
- **Vérifié** : testing agent backend **38/38** (register-push 500 contrôlé attendu en preview car clé placeholder ; broadcast gardé par token ; catalogue 357 intact). App boot OK (web-safe).
- **Rappel natif** : les push ne marchent QUE sur build réel iOS/Android (pas Expo Go / web). Flux : Publish → Deploy → Generate build (upload compte de service Google JSON + clé APNs .p8 iOS à la génération).

## Session 8 (15 août 2026) — Abonnements RevenueCat (gérés par Emergent)
- **RevenueCat provisionné** via le proxy d'intégration Emergent (rc_project_id `projc82d42e0`, bundle/package `com.declic.app`). Entitlement `pro`, offering `default`, packages **Mensuel $9.99** + **Annuel $79.99**.
- Clés SDK (test/ios/android) ajoutées dans `frontend/.env` (`EXPO_PUBLIC_REVENUECAT_*`). Le code produit (revenuecat.tsx, paywall.tsx, revenuecatUI.ts, _layout, AppContext) était déjà conforme au playbook ; seul l'ajout des clés réelles restait.
- **Vérifié (testing agent, 6/6 PASS)** en preview via Test Store : paywall charge les offres dynamiques (prix issus du SDK), gating premium (Le Verdict / Tu me connais / Hot → paywall si non abonné), achat simulé → entitlement `pro` activé → modes premium débloqués, restauration OK, aucune régression (âge → setup → hub, modes gratuits, La Bombe, Confessions).
- `isPremium` = entitlement `pro` (source unique, aucun flag backend).
- Détails d'intégration + APIs de mise à jour produit dans `/app/memory/revenuecat.md`.
- **Pour des achats RÉELS** (build publié) : l'utilisateur doit uploader ses identifiants stores (clé .p8 App Store Connect + JSON service-account Google Play) dans le dashboard RevenueCat et créer les produits IAP avec les mêmes product IDs. Le Test Store (Expo Go / preview / dev build) ne nécessite rien.
