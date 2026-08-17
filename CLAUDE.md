# CLAUDE.md — Projet « DÉCLIC »

> **À placer à la racine du repo.** Claude Code lit ce fichier automatiquement au démarrage.
> Ce document synthétise tout le contexte projet : vision, contraintes, stack, modèle de données, état actuel et TODO.

---

## 1. C'EST QUOI DÉCLIC

Un **party game social** mobile (iOS + Android, + web) pour groupes d'amis (18-25 ans, marché francophone/France). Des jeux ultra-simples qui **font se découvrir les gens** (fiertés, hontes, opinions cash, intime) et **créent de vraies connexions**. Tagline : « Le jeu qui révèle tes potes ».

**Positionnement critique — CE N'EST PAS UNE APP D'ALCOOL.** C'est un « jeu d'ambiance / brise-glace ». L'alcool n'est qu'**une option de gage**, jamais le sujet. Chaque gage alcoolisé a **toujours** une alternative sans alcool. Cette distinction est vitale pour passer la validation stores (Apple Guideline 4.3 & 1.4.3) et respecter la Loi Évin.

**Différenciateurs :** (1) moteur d'escalade « le DJ » qui monte l'intensité tout seul ; (2) catalogue de questions **piloté à distance** (éditable sans re-soumettre l'app) ; (3) mécaniques originales (Le Verdict = vote anonyme, Récap partageable) ; (4) « Drunk UX » (simplicité radicale).

**Ton de marque :** irrévérencieux, drôle, complice, tutoiement, phrases courtes. On rit AVEC, jamais CONTRE.

---

## 2. CONTRAINTES NON NÉGOCIABLES (priment sur tout)

- **Apple 4.3 (spam)** : démontrer une vraie valeur (moteur d'escalade, mécaniques originales, catalogue riche). **Apple 1.4.3** : aucune mention d'alcool dans nom/sous-titre/mots-clés/description/captures.
- **Contenu Hot : SUGGESTIF, jamais explicite.** On évoque désir, attirance, tension, un fantasme par allusion. **Aucune** description de pratique sexuelle, aucun accessoire, aucun acte explicite. **Zéro age play, zéro contenu impliquant des mineurs** (ligne rouge absolue → ban + risque juridique). Objectif : rester validable App Store (qui interdit le porno, Guideline 1.1.4) ET Google Play.
- **Loi Évin** : message sanitaire « L'abus d'alcool est dangereux pour la santé, à consommer avec modération » (splash + réglages + quand un gage alcoolisé s'affiche). Mode « Sans alcool » (sober) activable. Jamais associer alcool ↔ succès/sexe/sport.
- **Âge** : gate 18+ au 1er lancement. Classification 17+/18+.
- **RGPD** : zéro compte, prénoms stockés en **local uniquement**. Aucune donnée perso envoyée au serveur.

---

## 3. STACK & STRUCTURE DU REPO

**Frontend** — Expo (React Native) + **expo-router**, TypeScript. Polices : ClashDisplay (display) + Satoshi (UI). Libs clés : react-native-safe-area-context, reanimated, gesture-handler, expo-haptics, expo-keep-awake (wakelock), expo-linear-gradient, expo-image, @gorhom/bottom-sheet.

```
frontend/
  app/                      # écrans (expo-router, file-based routing)
    _layout.tsx             # Stack racine (headerShown:false, animation fade)
    index.tsx               # splash → redirige vers setup ou age-gate
    age-gate.tsx            # gate 18+
    setup.tsx               # saisie des prénoms + toggle Sans alcool
    hub.tsx                 # hub : ambiance, mode phare, grille de modes, presets
    launch.tsx              # écran de lancement d'une soirée
    game.tsx                # boucle de jeu (top bar + carte + thermomètre + passer)
    paywall.tsx             # paywall premium
    recap.tsx               # récap de fin de soirée
    settings.tsx            # réglages (sober, sons, haptique, etc.)
  src/
    components/PrimaryButton.tsx
    components/game/GameCards.tsx   # rendu des cartes par mode (TextContent, VoteContent, VerdictContent, PairContent, LockedContent, Confetti)
    context/AppContext.tsx          # état joueurs, ambiance, premium, sober, haptics, stats
    context/CatalogContext.tsx      # catalogue de cartes + presets (sync distante)
    data/seedCards.ts               # pack de cartes embarqué (offline)
    engine/escalation.ts            # buildSoiree() + buildModeDeck() = le "DJ"
    theme/tokens.ts                 # couleurs, fonts, spacing, MODE_META, INTENSITY_COLORS, HEALTH_MSG
    theme/ThemeContext.tsx
    types.ts                        # types Card, Player, Ambiance…
    api/client.ts                   # appels backend + logEvent (analytics)
    utils/storage/                  # persistance locale (web + native)
```

**Backend** — FastAPI (`backend/server.py`), `seed_cards.py`, tests pytest. (Base type MongoDB — défaut Emergent.) Rôle : servir/synchroniser le catalogue + analytics. **Aucune donnée perso joueur.**

---

## 4. MODÈLE DE DONNÉES — CARTE (tel qu'utilisé par le code)

Champs `Card` référencés dans le frontend :

```
id, mode, intensite (1-5), texte, texte_b (2e option pour cash-ou-cash),
variante ("action" | "verite" | undefined), gage, alternative,
premium (bool), actif (bool), packs (string[]), vibe (string)
```

**Slugs de mode** (valeurs de `card.mode`) :
`qui-est-le-plus`, `je-nai-jamais`, `action-verite`, `cash-ou-cash`, `le-verdict`, `tu-me-connais`, `hot`, `bombe`, `confession`, `imposteur`.

**Modes autonomes** (`confession`, `imposteur`) : ils ont leur propre écran (`app/confessions.tsx`, `app/imposteur.tsx`), routés via `ROUTED_MODES` dans le hub, et sont exclus de `buildSoiree` — ils ne passent jamais par le rendu de cartes standard.

Pour `imposteur`, `variante` vaut `mots` ou `questions`, `texte` = secret des civils et `texte_b` = secret de l'imposteur (sa variante proche).

**Modes premium** : `le-verdict`, `tu-me-connais`, `hot`.

**⚠️ VOCABULAIRE — deux axes à ne pas confondre :**
- `vibe` (sur la carte) = **type de soirée** : `Découverte` / `Fun` / `Sans filtre` / `Hot`. Sert au filtrage « Vibes ».
- `ambiance` (réglage global dans AppContext) = **courbe d'escalade** choisie par le groupe : `chill` / `standard` / `chaud`. Sert au moteur d'escalade.

### 4.1 Mapping avec les fichiers CSV de contenu (IMPORTANT)

Les lots de questions livrés (voir §7) utilisent des **noms de colonnes différents** de ceux du code. À l'import, mapper ainsi :

| Colonne CSV | Champ carte (code) | Transformation |
|---|---|---|
| `mode` (label ex. "Hot / Intime") | `mode` (slug) | convertir en slug (table ci-dessous) |
| `ambiance` (Découverte/Fun/Sans filtre/Hot) | `vibe` | renommer |
| `intensite` | `intensite` | identique (1-5) |
| `texte` | `texte` / `texte_b` | pour cash-ou-cash, **splitter sur " // "** → texte + texte_b |
| `alternative_sans_alcool` | `alternative` | renommer |
| `gage` | `gage` | identique |
| `packs` | `packs` | splitter sur "," → tableau |
| `premium`, `actif` | idem | booléens |
| `age18` | (à ajouter) | respecter pour le gate 18+ |
| `tags_theme`, `cible` | (optionnels) | conserver si utile |

Table de conversion label→slug : « Qui est le plus… »→`qui-est-le-plus` · « Je n'ai jamais »→`je-nai-jamais` · « Action ou Vérité — Action/Vérité »→`action-verite` (+ `variante`) · « Cash ou Cash »→`cash-ou-cash` · « Le Verdict »→`le-verdict` · « Tu me connais ? »→`tu-me-connais` · « Hot / Intime »→`hot`.

---

## 5. MÉCANIQUES & MOTEUR

**Modes de jeu** : Qui est le plus…, Je n'ai jamais, Action ou Vérité, Cash ou Cash (dilemme, 2 options), Le Verdict (vote anonyme 0-10 → moyenne + décompte + confettis), Tu me connais ? (devine à propos d'un pote), Hot/Intime (18+, premium). + « Soirée Déclic » = mode phare qui enchaîne tout via le moteur d'escalade.

**Moteur d'escalade** (`src/engine/escalation.ts`) : chaque carte a une intensité 1→5. Démarre fédérateur, monte toutes les ~5-7 cartes, alterne les modes, équilibre entre joueurs, déclenche le paywall au passage vers les intensités chaudes. Réglage « ambiance » : chill / standard / chaud.

**Récap** : carte partageable en fin de soirée (superlatifs, stats). Levier viral TikTok/Insta.

---

## 6. DESIGN — « DRUNK UX » + POP & COLORÉ

Utilisable ivre, d'une main, dans le noir. Zéro compte. **Tap n'importe où** pour avancer. Boutons ≥ 64px. Base sombre encrée (`#0C0C0F`/`#12101A`), **cartes de jeu en couleur pleine thématisées par mode** (voir `MODE_META` et `INTENSITY_COLORS` dans `theme/tokens.ts`). Accent principal magenta corail `#FF2E63`. Wakelock actif en jeu. Haptique + sons (optionnels). Voir aussi `design_guidelines.json` à la racine + la spec design complète (doc projet `spec-ux-design.md`).

---

## 7. CONTENU — CATALOGUE PILOTÉ À DISTANCE

Le corpus de questions ne doit **jamais** être codé en dur : il vit côté serveur, éditable sans re-soumettre l'app (source recommandée : **Airtable ou Google Sheets** → sync). Un pack de base est embarqué (`seedCards.ts`) pour l'offline.

**Lots déjà produits (fichiers tableur, schéma CSV du §4.1) :**
- Lot 1 « généraliste » : ~149 questions, tous modes, intensités 1-5, colonne `ambiance` (=vibe).
- Lot Hot « store-safe » : 128 questions, suggestives non-explicites, colonne `packs`, intensités 4-5.

Règle d'or contenu : 100% original (jamais copié — cf. jurisprudence ATM Gaming vs TOZ), suggestif jamais explicite, chaque gage a son alternative sans alcool.

---

## 8. MONÉTISATION

Freemium + abonnement auto-renouvelable (**RevenueCat**, + Superwall pour A/B tester le paywall). Gratuit : modes fédérateurs + ~15-20 min. Premium : modes verrouillés, intensités 4-5, tous les packs, catalogue complet. Paywall au pic émotionnel (1re carte premium floutée). Prix : 4,99 €/sem · 8,99 €/mois (ancrage) · 39,99 €/an + 3 j d'essai. S'inscrire au Apple Small Business Program (commission 15%).

---

## 9. ÉTAT ACTUEL & TODO

**Construit (par Emergent) :** écrans principaux, moteur d'escalade, rendu des cartes par mode, contexte catalogue + sync, paywall, récap, age gate, sober mode, wakelock.

**Bug prioritaire à corriger — chevauchement dans `src/components/game/GameCards.tsx` :**
`topBlock` et `gageWrap` sont en `position:"absolute"` dans un conteneur `textContent` centré → sur écran court / texte long, la question centrée passe sous/sur la pastille joueur et la bannière de gage, et le bouton « CARTE SUIVANTE » chevauche le gage.

**Fix :** restructurer chaque carte en **3 zones flex** (haut / milieu `flex:1` centré / bas), **sans aucun `absolute`** :

```
textContent: { flex:1, justifyContent:"space-between", paddingVertical:20 }
topBlock:    { alignItems:"center" }            // retirer position/top/left/right
gageWrap:    { alignItems:"center", gap:8 }     // retirer position/bottom/left/right
middle:      { flex:1, justifyContent:"center", width:"100%" }   // NOUVEAU, enveloppe la question
```

JSX : `<topBlock/> <middle>question</middle> <gageWrap>GageBanner + bouton</gageWrap>`. Mettre le gage ET le bouton d'action dans la MÊME zone du bas (empilés). Sur petit écran, envelopper `middle` dans un ScrollView (`contentContainerStyle={{flexGrow:1, justifyContent:"center"}}`). Bonus `game.tsx` : `tapHint` en `absolute bottom:-4` → repasser en flux normal (`marginTop:auto`).

**Features validées à implémenter :**
1. Aperçu preset : avant lancement, afficher nombre de cartes + intensité max du preset/vibe.
2. Sélecteur joueur Verdict : le groupe choisit qui passe au centre (+ garder option « aléatoire »).
3. Sons d'ambiance : effets optionnels (tap, montée d'intensité, confettis), désactivables, off par défaut.
4. Import du prochain lot CSV (avec colonne `packs`) dans le catalogue.

**Décisions en attente (côté produit) :** source d'édition du catalogue (Airtable vs Google Sheets), volume total de questions visé, homogénéisation du Lot 1 avec la colonne `packs`.

---

## 10. WORKFLOW EMERGENT ↔ GITHUB ↔ CLAUDE CODE

Emergent fait une sync **bidirectionnelle mais MANUELLE** avec GitHub :
- Emergent → GitHub : bouton **« Save to GitHub »**.
- GitHub → Emergent : bouton **« Pull from GitHub »** (à cliquer, ce n'est pas automatique).

**Règle anti-conflit :** ne pas éditer les mêmes fichiers dans Emergent ET Claude Code en parallèle. Séquence propre : dans Emergent « Save to GitHub » → travailler + pusher depuis Claude Code → au retour dans Emergent, « Pull from GitHub » avant de reprendre. Toujours pull la dernière version avant une nouvelle session.

---

## 11. DOCS PROJET LIÉES (dans le Projet Claude « APP JEUX D'ALCOOL »)

- `prompt-emergent-app-cash.md` — PRD complet.
- `spec-ux-design.md` — design system détaillé (palette, typo, composants, écrans).
- Lots de contenu : `questions_lot1` (généraliste) + `questions_lot_hot` (Hot store-safe).
- `memory/PRD.md` dans le repo — PRD embarqué par Emergent.
