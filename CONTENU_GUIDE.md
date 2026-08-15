# Déclic — Guide de contenu (comment bien écrire les questions)

Ce guide décrit **le format exact** pour que chaque question arrive dans le bon jeu.
Il s'applique à Airtable, Google Sheets ET à l'import CSV du back-office.

---

## Les colonnes

| Colonne | Obligatoire | Description |
|---|---|---|
| `mode` | ✅ | Le jeu (voir liste ci-dessous). C'est ce qui range la question au bon endroit. |
| `texte` | ✅ | Le texte principal de la carte (voir règles par mode). |
| `texte_b` | Seulement `cash-ou-cash` | La 2e option du dilemme. |
| `variante` | Seulement `action-verite` | `action` ou `verite`. |
| `intensite` | conseillé | 1 (soft) → 5 (hot). Sert au moteur d'escalade et au thermomètre. |
| `vibe` | conseillé | `Découverte`, `Fun`, `Sans filtre` ou `Hot`. |
| `gage` | optionnel | Le gage si la personne refuse. Défaut : "Bois une gorgée". |
| `alternative` | optionnel | L'alternative SANS alcool (mode sans alcool). Défaut fourni. |
| `tags_theme` | optionnel | Thèmes, séparés par `|`. Ex: `amitié|absurde`. |
| `packs` | optionnel | Presets soirée, séparés par `|`. Ex: `Coloc|Intég|Couples`. |
| `premium` | optionnel | `oui`/`non` (ou true/false, 1/0). Réservé aux abonnés. |
| `age18` | optionnel | `oui`/`non`. Réservé aux majeurs (auto pour le mode hot). |
| `actif` | optionnel | Coche la case pour publier. **Décoche pour masquer** sans supprimer (une case décochée = question inactive). |

> Listes (`tags_theme`, `packs`) : séparez par une barre verticale `|` (ou `;`).
> Booléens : `oui`, `true`, `1`, `x` = vrai ; vide ou `non` = faux.

---

## Règles d'écriture PAR MODE (très important)

### `qui-est-le-plus`
L'app affiche automatiquement **"Qui est le plus susceptible "** devant ton texte.
→ N'écris QUE la fin de la phrase.
- ✅ `texte` = `de finir la soirée endormi·e sur le canapé ?`
- ❌ ne pas écrire "Qui est le plus susceptible de…" (ce serait en double).

### `je-nai-jamais`
Phrase **complète**, commence par "Je n'ai jamais".
- ✅ `texte` = `Je n'ai jamais menti sur mon âge.`

### `action-verite`
Remplis `variante` = `action` **ou** `verite`.
- Action → `texte` = le défi. Ex: `Imite quelqu'un du groupe, les autres devinent.`
- Vérité → `texte` = la question. Ex: `Quel est ton pire date ?`

### `cash-ou-cash` (dilemme)
Deux options. Deux façons de les fournir :
- Soit `texte` + `texte_b` séparément.
- Soit tout dans `texte` avec `//` au milieu : `Option A // Option B`.
- ✅ Ex: `texte` = `Ne plus jamais poster de story` · `texte_b` = `Ne plus jamais liker`

### `le-verdict` (vote anonyme 0→10)
Utilise le jeton **`{J}`** là où le prénom de la personne visée doit apparaître.
- ✅ `texte` = `À quel point {J} assure en soirée ?`

### `tu-me-connais` (devinette en binôme)
Une question à laquelle un·e joueur·se répond **à propos d'un·e autre**.
- ✅ `texte` = `Quel est le plat préféré de ton binôme ?`

### `hot` (18+ / premium)
Phrase complète, plutôt intense. Mets `premium` = `oui`, `age18` = `oui`, `intensite` 4 ou 5.

---

## Rappel conformité
L'alcool n'est qu'une option de gage : fournis toujours une `alternative` sans alcool.
Aucune question n'est validée en dessous de 18 ans (l'app est 18+).

---

Vois `content_template.csv` pour un exemple concret prêt à copier dans Airtable / Google Sheets.
