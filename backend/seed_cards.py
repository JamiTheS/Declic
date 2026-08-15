# -*- coding: utf-8 -*-
"""
Banque de cartes — LOT 1 (149 questions fournies par le propriétaire).
Le CSV brut est embarqué puis mappé vers le schéma `Card`.
Éditable À DISTANCE via /api/cards (ajout/modif/désactivation sans re-soumettre l'app).

Colonnes CSV : id, mode, ambiance, intensite, texte, cible, gage,
               alternative_sans_alcool, tags_theme, premium, age18, actif
"""
import csv
import io

MODE_MAP = {
    "Qui est le plus…": ("qui-est-le-plus", None),
    "Je n'ai jamais": ("je-nai-jamais", None),
    "Action ou Vérité — Action": ("action-verite", "action"),
    "Action ou Vérité — Vérité": ("action-verite", "verite"),
    "Cash ou Cash": ("cash-ou-cash", None),
    "Le Verdict": ("le-verdict", None),
    "Tu me connais ?": ("tu-me-connais", None),
    "Hot / Intime": ("hot", None),
}


def _to_bool(v: str) -> bool:
    return str(v).strip().upper() == "TRUE"


def _infer_packs(tags):
    """Lot 1 has no `packs` column yet → infer sensible presets so the feature
    works now. The NEXT lot ships an explicit `packs` column that overrides this."""
    t = set(tags)
    packs = set()
    if t & {"amitié", "absurde", "embarrassant", "réseaux"}:
        packs.add("Intég")
    if t & {"amitié", "réseaux", "argent", "embarrassant", "opinion", "honte"}:
        packs.add("Coloc")
    if t & {"séduction", "ex", "secret", "couple", "sexe"}:
        packs.add("Entre meufs")
    if t & {"couple", "ex", "séduction", "sexe", "physique"}:
        packs.add("Couples")
    if not packs:
        packs.add("Intég")
    return sorted(packs)


def _parse(raw: str):
    cards = []
    reader = csv.DictReader(io.StringIO(raw.strip()))
    for row in reader:
        mode_label = (row.get("mode") or "").strip()
        mapped = MODE_MAP.get(mode_label)
        if not mapped:
            continue
        mode, variante = mapped

        texte = (row.get("texte") or "").strip()
        texte_b = None
        if mode == "cash-ou-cash" and "//" in texte:
            a, b = texte.split("//", 1)
            texte, texte_b = a.strip(), b.strip()

        tags = [t.strip() for t in (row.get("tags_theme") or "").split(",") if t.strip()]
        if not tags:
            tags = ["general"]

        # `packs` column is tolerant: use it if present, otherwise infer (lot 1).
        packs_raw = (row.get("packs") or "").strip()
        if packs_raw:
            packs = [p.strip() for p in packs_raw.split(",") if p.strip()]
        else:
            packs = _infer_packs(tags)

        try:
            intensite = int(row.get("intensite") or 1)
        except ValueError:
            intensite = 1

        cards.append({
            "id": (row.get("id") or "").strip(),
            "mode": mode,
            "variante": variante,
            "texte": texte,
            "texte_b": texte_b,
            "vibe": (row.get("ambiance") or "").strip() or None,
            "gage": (row.get("gage") or "Bois une gorgée").strip(),
            "alternative": (row.get("alternative_sans_alcool") or "Révèle un secret de plus").strip(),
            "intensite": intensite,
            "tags_theme": tags,
            "packs": packs,
            "premium": _to_bool(row.get("premium")),
            "age18": _to_bool(row.get("age18")),
            "actif": _to_bool(row.get("actif")) if row.get("actif") else True,
        })
    return cards


RAW_CSV = """id,mode,ambiance,intensite,texte,cible,gage,alternative_sans_alcool,tags_theme,premium,age18,actif
QUI-0001,Qui est le plus…,Fun,1,…de survivre le plus longtemps dans une apocalypse zombie ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"absurde,amitié",FALSE,FALSE,TRUE
QUI-0002,Qui est le plus…,Fun,1,…de devenir riche puis de tout claquer bêtement ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"argent,absurde",FALSE,FALSE,TRUE
QUI-0003,Qui est le plus…,Fun,1,…de pleurer devant une pub un peu trop émouvante ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"embarrassant,amitié",FALSE,FALSE,TRUE
QUI-0004,Qui est le plus…,Fun,1,…de devenir prof et de terroriser ses élèves ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"absurde,amitié",FALSE,FALSE,TRUE
QUI-0005,Qui est le plus…,Fun,1,…de rater son réveil le jour le plus important de sa vie ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,embarrassant,FALSE,FALSE,TRUE
QUI-0006,Qui est le plus…,Fun,1,…de parler tout seul quand personne ne regarde ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"embarrassant,absurde",FALSE,FALSE,TRUE
QUI-0007,Qui est le plus…,Fun,1,…de finir en couple avec une célébrité ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"absurde,séduction",FALSE,FALSE,TRUE
QUI-0008,Qui est le plus…,Fun,1,…de se perdre dans sa propre ville ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,absurde,FALSE,FALSE,TRUE
QUI-0009,Qui est le plus…,Fun,1,…de devenir influenceur du jour au lendemain ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"réseaux,absurde",FALSE,FALSE,TRUE
QUI-0010,Qui est le plus…,Sans filtre,2,…de textoter son ex à 3h du matin ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"ex,embarrassant",FALSE,FALSE,TRUE
QUI-0011,Qui est le plus…,Découverte,2,…de mentir sur son CV pour décrocher un job ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"argent,secret",FALSE,FALSE,TRUE
QUI-0012,Qui est le plus…,Fun,2,…de stalker quelqu'un sur Insta pendant plus d'une heure ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"réseaux,secret",FALSE,FALSE,TRUE
QUI-0013,Qui est le plus…,Sans filtre,2,…de craquer et rappeler quelqu'un qu'il/elle devrait oublier ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"ex,couple",FALSE,FALSE,TRUE
QUI-0014,Qui est le plus…,Fun,2,…de faire semblant d'avoir lu un livre pour paraître intelligent ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"embarrassant,opinion",FALSE,FALSE,TRUE
QUI-0015,Qui est le plus…,Découverte,2,…de ghoster quelqu'un sans aucune explication ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"couple,secret",FALSE,FALSE,TRUE
QUI-0016,Qui est le plus…,Découverte,2,…de dépenser tout son salaire en une soirée ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,argent,FALSE,FALSE,TRUE
QUI-0017,Qui est le plus…,Découverte,2,…de tomber amoureux(se) en vacances en moins de 48h ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"couple,séduction",FALSE,FALSE,TRUE
QUI-0018,Qui est le plus…,Fun,2,…de supprimer une story parce qu'elle n'a pas eu assez de vues ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"réseaux,embarrassant",FALSE,FALSE,TRUE
QUI-0019,Qui est le plus…,Découverte,2,…de raconter un secret qu'on lui a demandé de garder ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"secret,amitié",FALSE,FALSE,TRUE
QUI-0020,Qui est le plus…,Hot,3,…de coucher le premier soir sans culpabiliser ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"sexe,séduction",FALSE,FALSE,TRUE
QUI-0021,Qui est le plus…,Sans filtre,3,…de retomber dans les bras de son ex par ennui ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"ex,couple",FALSE,FALSE,TRUE
QUI-0022,Qui est le plus…,Découverte,3,…d'avoir un crush secret sur quelqu'un dans cette pièce ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"séduction,secret",FALSE,FALSE,TRUE
QUI-0023,Qui est le plus…,Hot,3,…de mentir sur son nombre de partenaires ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"sexe,secret",FALSE,FALSE,TRUE
QUI-0024,Qui est le plus…,Découverte,3,…de flirter alors qu'il/elle est déjà en couple ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"couple,séduction",FALSE,FALSE,TRUE
QUI-0025,Qui est le plus…,Fun,3,…d'embrasser quelqu'un juste pour le drama ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"séduction,absurde",FALSE,FALSE,TRUE
QUI-0026,Qui est le plus…,Sans filtre,3,…de garder les messages de son ex « au cas où » ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"ex,secret",FALSE,FALSE,TRUE
QUI-0027,Qui est le plus…,Découverte,3,…de tout avouer sous l'effet de l'alcool ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"secret,alcool",FALSE,FALSE,TRUE
QUI-0028,Qui est le plus…,Découverte,3,…de saboter la relation d'un(e) ami(e) par jalousie ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"amitié,secret",FALSE,FALSE,TRUE
QUI-0029,Qui est le plus…,Hot,3,…d'avoir déjà pensé à quelqu'un d'ici de façon un peu trop précise ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"séduction,sexe",FALSE,FALSE,TRUE
QUI-0030,Qui est le plus…,Hot,4,…d'envoyer un nude à la mauvaise personne ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"sexe,embarrassant",TRUE,FALSE,TRUE
QUI-0031,Qui est le plus…,Découverte,4,…d'avoir un profil secret sur une appli de rencontre ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"séduction,secret",TRUE,FALSE,TRUE
QUI-0032,Qui est le plus…,Hot,4,…de finir la soirée avec quelqu'un de ce groupe ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"sexe,séduction",TRUE,FALSE,TRUE
QUI-0033,Qui est le plus…,Hot,4,…de proposer un plan à trois un jour ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,sexe,TRUE,FALSE,TRUE
QUI-0034,Qui est le plus…,Hot,4,…d'avoir déjà eu un coup d'un soir avec quelqu'un qu'on connaît tous ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"sexe,secret",TRUE,FALSE,TRUE
QUI-0035,Qui est le plus…,Hot,4,…de cacher un fantasme un peu spécial ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"sexe,secret",TRUE,FALSE,TRUE
QUI-0036,Qui est le plus…,Découverte,4,…d'avoir déjà embrassé quelqu'un du même groupe d'amis ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"séduction,secret",TRUE,FALSE,TRUE
QUI-0037,Qui est le plus…,Découverte,4,…de mentir à son/sa partenaire sur ce qu'il/elle a fait ce soir ?,La personne la plus désignée,La personne la plus désignée : gorgée.,…ou elle révèle pourquoi le groupe l'a choisie.,"couple,secret",TRUE,FALSE,TRUE
JAMAIS-0038,Je n'ai jamais,Fun,1,Je n'ai jamais fait semblant d'être malade pour sécher un cours.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,embarrassant,FALSE,FALSE,TRUE
JAMAIS-0039,Je n'ai jamais,Fun,1,Je n'ai jamais chanté à tue-tête sous la douche.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,absurde,FALSE,FALSE,TRUE
JAMAIS-0040,Je n'ai jamais,Fun,1,Je n'ai jamais mangé un truc tombé par terre en douce.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"embarrassant,absurde",FALSE,FALSE,TRUE
JAMAIS-0041,Je n'ai jamais,Fun,1,Je n'ai jamais fait semblant de connaître une chanson pour ne pas passer pour un(e) inculte.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,embarrassant,FALSE,FALSE,TRUE
JAMAIS-0042,Je n'ai jamais,Fun,1,Je n'ai jamais parlé à un animal comme s'il pouvait me répondre.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,absurde,FALSE,FALSE,TRUE
JAMAIS-0043,Je n'ai jamais,Découverte,2,Je n'ai jamais menti à un pote pour éviter de sortir.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"amitié,secret",FALSE,FALSE,TRUE
JAMAIS-0044,Je n'ai jamais,Sans filtre,2,Je n'ai jamais stalké le nouveau/la nouvelle de mon ex.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"ex,réseaux",FALSE,FALSE,TRUE
JAMAIS-0045,Je n'ai jamais,Fun,2,Je n'ai jamais fait semblant d'être occupé(e) pour éviter quelqu'un dans la rue.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,embarrassant,FALSE,FALSE,TRUE
JAMAIS-0046,Je n'ai jamais,Découverte,2,Je n'ai jamais pleuré à cause de quelqu'un dans cette pièce.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"amitié,secret",FALSE,FALSE,TRUE
JAMAIS-0047,Je n'ai jamais,Fun,2,Je n'ai jamais supprimé un(e) ami(e) des réseaux par rancune.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"réseaux,amitié",FALSE,FALSE,TRUE
JAMAIS-0048,Je n'ai jamais,Découverte,2,Je n'ai jamais menti sur mon âge pour impressionner quelqu'un.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"séduction,secret",FALSE,FALSE,TRUE
JAMAIS-0049,Je n'ai jamais,Fun,2,Je n'ai jamais fait semblant d'aimer un cadeau que je détestais.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,embarrassant,FALSE,FALSE,TRUE
JAMAIS-0050,Je n'ai jamais,Découverte,3,Je n'ai jamais eu un crush sur l'ami(e) d'un(e) ami(e).,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"séduction,secret",FALSE,FALSE,TRUE
JAMAIS-0051,Je n'ai jamais,Hot,3,Je n'ai jamais embrassé quelqu'un dont j'ai oublié le prénom.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,séduction",FALSE,FALSE,TRUE
JAMAIS-0052,Je n'ai jamais,Hot,3,Je n'ai jamais menti sur mon nombre de partenaires.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,secret",FALSE,FALSE,TRUE
JAMAIS-0053,Je n'ai jamais,Sans filtre,3,Je n'ai jamais recontacté un ex juste par manque d'attention.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"ex,couple",FALSE,FALSE,TRUE
JAMAIS-0054,Je n'ai jamais,Découverte,3,Je n'ai jamais dragué quelqu'un juste pour rendre une autre personne jalouse.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,séduction,FALSE,FALSE,TRUE
JAMAIS-0055,Je n'ai jamais,Fun,3,Je n'ai jamais fait semblant de dormir pour éviter un moment gênant.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"embarrassant,couple",FALSE,FALSE,TRUE
JAMAIS-0056,Je n'ai jamais,Découverte,3,Je n'ai jamais gardé un secret qui aurait pu détruire une amitié.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"amitié,secret",FALSE,FALSE,TRUE
JAMAIS-0057,Je n'ai jamais,Hot,4,Je n'ai jamais eu un plan d'un soir que je n'ai jamais raconté à personne.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,secret",TRUE,FALSE,TRUE
JAMAIS-0058,Je n'ai jamais,Hot,4,Je n'ai jamais envoyé un message coquin en pleine journée de travail/cours.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,séduction",TRUE,FALSE,TRUE
JAMAIS-0059,Je n'ai jamais,Hot,4,Je n'ai jamais embrassé deux personnes différentes le même soir.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,séduction",TRUE,FALSE,TRUE
JAMAIS-0060,Je n'ai jamais,Hot,4,Je n'ai jamais eu un fantasme sur quelqu'un que je ne devrais pas.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,secret",TRUE,FALSE,TRUE
JAMAIS-0061,Je n'ai jamais,Hot,4,Je n'ai jamais fait semblant de prendre du plaisir.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,couple",TRUE,FALSE,TRUE
JAMAIS-0062,Je n'ai jamais,Découverte,4,Je n'ai jamais eu un date secret que personne ici ne connaît.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"séduction,secret",TRUE,FALSE,TRUE
JAMAIS-0063,Je n'ai jamais,Hot,5,Je n'ai jamais couché avec quelqu'un présent dans cette pièce.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,secret",TRUE,TRUE,TRUE
JAMAIS-0064,Je n'ai jamais,Hot,5,Je n'ai jamais eu une aventure d'un soir que je regrette encore.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,secret",TRUE,TRUE,TRUE
JAMAIS-0065,Je n'ai jamais,Découverte,5,Je n'ai jamais dit « je t'aime » sans le penser pour arriver à mes fins.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"couple,secret",TRUE,TRUE,TRUE
JAMAIS-0066,Je n'ai jamais,Hot,5,Je n'ai jamais fait quelque chose d'interdit dans un lieu public.,Ceux qui l'ont déjà fait,Si tu l'as déjà fait : gorgée.,…ou raconte l'histoire au groupe.,"sexe,absurde",TRUE,TRUE,TRUE
ACTION-0067,Action ou Vérité — Action,Fun,1,Imite la démarche de la personne à ta droite jusqu'à ton prochain tour.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"absurde,amitié",FALSE,FALSE,TRUE
ACTION-0068,Action ou Vérité — Action,Fun,1,Parle avec l'accent de ton choix pendant les 3 prochaines minutes.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,absurde,FALSE,FALSE,TRUE
ACTION-0069,Action ou Vérité — Action,Fun,1,Fais ta meilleure imitation d'un prof que tout le monde déteste.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"absurde,amitié",FALSE,FALSE,TRUE
ACTION-0070,Action ou Vérité — Action,Fun,1,Poste la 3e photo de ta galerie en story (ou décris-la).,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"réseaux,embarrassant",FALSE,FALSE,TRUE
ACTION-0071,Action ou Vérité — Action,Fun,2,Montre la dernière personne que tu as cherchée sur Instagram.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"réseaux,secret",FALSE,FALSE,TRUE
ACTION-0072,Action ou Vérité — Action,Fun,2,Lis à voix haute ton dernier message envoyé.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"secret,embarrassant",FALSE,FALSE,TRUE
ACTION-0073,Action ou Vérité — Action,Fun,2,Appelle un(e) ami(e) hors du jeu et déclare-lui ta flamme façon film.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"absurde,séduction",FALSE,FALSE,TRUE
ACTION-0074,Action ou Vérité — Action,Fun,2,Laisse la personne à ta gauche écrire une story sur ton compte.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"réseaux,amitié",FALSE,FALSE,TRUE
ACTION-0075,Action ou Vérité — Action,Fun,3,Montre la conversation dont tu es le/la moins fier(e).,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"secret,embarrassant",FALSE,FALSE,TRUE
ACTION-0076,Action ou Vérité — Action,Fun,3,Envoie « je pense à toi » à la 5e personne de tes messages récents.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"séduction,absurde",FALSE,FALSE,TRUE
ACTION-0077,Action ou Vérité — Action,Découverte,3,"Décris ton dernier date en 3 mots, puis développe.",Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"séduction,couple",FALSE,FALSE,TRUE
ACTION-0078,Action ou Vérité — Action,Découverte,3,Fais un compliment sincère et un peu gênant à chaque joueur.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"amitié,séduction",FALSE,FALSE,TRUE
ACTION-0079,Action ou Vérité — Action,Hot,4,Refais le bruit que tu fais quand personne ne t'entend… tu sais lequel.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"sexe,embarrassant",TRUE,FALSE,TRUE
ACTION-0080,Action ou Vérité — Action,Sans filtre,4,Envoie un message ambigu à ton ou ta dernier(e) crush.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"séduction,ex",TRUE,FALSE,TRUE
ACTION-0081,Action ou Vérité — Action,Hot,4,Mime ta position préférée sans utiliser de mots.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"sexe,séduction",TRUE,FALSE,TRUE
ACTION-0082,Action ou Vérité — Action,Hot,4,Chuchote à l'oreille de ton voisin/voisine la chose la plus osée que tu aies envie de dire.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"sexe,séduction",TRUE,FALSE,TRUE
ACTION-0083,Action ou Vérité — Action,Hot,5,Montre la photo la plus osée que tu oserais montrer ici (tu choisis la limite).,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"sexe,secret",TRUE,TRUE,TRUE
ACTION-0084,Action ou Vérité — Action,Hot,5,Fais une démonstration de ta meilleure technique de séduction sur un(e) volontaire.,Le joueur actif,Tu refuses : gorgée + tu repioches une action.,…ou un défi choisi par le groupe.,"séduction,sexe",TRUE,TRUE,TRUE
VERITE-0085,Action ou Vérité — Vérité,Fun,1,Quel est le mensonge le plus inoffensif que tu répètes tout le temps ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"embarrassant,secret",FALSE,FALSE,TRUE
VERITE-0086,Action ou Vérité — Vérité,Fun,1,Quelle est la chose la plus bête qui t'ait fait pleurer ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,embarrassant,FALSE,FALSE,TRUE
VERITE-0087,Action ou Vérité — Vérité,Fun,1,Quel est ton plaisir coupable que tu n'assumes pas ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"secret,embarrassant",FALSE,FALSE,TRUE
VERITE-0088,Action ou Vérité — Vérité,Fun,2,C'est quoi le truc le plus gênant que tu aies fait pour un crush ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"séduction,embarrassant",FALSE,FALSE,TRUE
VERITE-0089,Action ou Vérité — Vérité,Découverte,2,Quelle est ta plus grande fierté que personne ici ne connaît ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"fierté,secret",FALSE,FALSE,TRUE
VERITE-0090,Action ou Vérité — Vérité,Sans filtre,2,Quel est le pire fail de ton année ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"embarrassant,honte",FALSE,FALSE,TRUE
VERITE-0091,Action ou Vérité — Vérité,Découverte,2,"Qui, dans ta vie, mériterait des excuses de ta part ?",Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"amitié,secret",FALSE,FALSE,TRUE
VERITE-0092,Action ou Vérité — Vérité,Découverte,3,Quelle est la chose que tu juges le plus chez les gens mais que tu fais aussi ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"opinion,secret",FALSE,FALSE,TRUE
VERITE-0093,Action ou Vérité — Vérité,Découverte,3,Quel est le secret que tu n'as jamais dit à tes parents ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"famille,secret",FALSE,FALSE,TRUE
VERITE-0094,Action ou Vérité — Vérité,Découverte,3,"À quel moment as-tu menti à quelqu'un ici, et sur quoi ?",Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"amitié,secret",FALSE,FALSE,TRUE
VERITE-0095,Action ou Vérité — Vérité,Découverte,3,Quelle est la personne la plus inattendue avec qui tu as flashé ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"séduction,secret",FALSE,FALSE,TRUE
VERITE-0096,Action ou Vérité — Vérité,Sans filtre,3,Quel est ton plus grand regret amoureux ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"couple,ex",FALSE,FALSE,TRUE
VERITE-0097,Action ou Vérité — Vérité,Hot,4,Quel est le fantasme que tu n'as jamais osé réaliser ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"sexe,secret",TRUE,FALSE,TRUE
VERITE-0098,Action ou Vérité — Vérité,Hot,4,C'est quoi l'endroit le plus improbable où tu es allé(e) un peu trop loin ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"sexe,absurde",TRUE,FALSE,TRUE
VERITE-0099,Action ou Vérité — Vérité,Hot,4,Quelle est la chose la plus folle que tu ferais si personne ne le savait jamais ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"secret,sexe",TRUE,FALSE,TRUE
VERITE-0100,Action ou Vérité — Vérité,Hot,4,"Qui, dans cette pièce, t'a déjà traversé l'esprit d'une façon un peu trop précise ?",Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"sexe,séduction",TRUE,FALSE,TRUE
VERITE-0101,Action ou Vérité — Vérité,Hot,4,Quel est le message le plus osé que tu aies déjà envoyé ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"sexe,séduction",TRUE,FALSE,TRUE
VERITE-0102,Action ou Vérité — Vérité,Hot,5,Décris ta meilleure expérience intime sans donner de nom.,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"sexe,secret",TRUE,TRUE,TRUE
VERITE-0103,Action ou Vérité — Vérité,Hot,5,Quel est le truc que tu adores mais que tu n'oserais jamais demander ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"sexe,couple",TRUE,TRUE,TRUE
VERITE-0104,Action ou Vérité — Vérité,Hot,5,Quelle est la limite que tu n'as jamais franchie mais qui te tente ?,Le joueur actif,Tu refuses de répondre : gorgée.,…ou tu prends un gage soft du groupe.,"sexe,secret",TRUE,TRUE,TRUE
CASH-0105,Cash ou Cash,Sans filtre,2,Ta plus grande fierté cachée // ton plus gros fail de l'année ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"fierté,honte",FALSE,FALSE,TRUE
CASH-0106,Cash ou Cash,Découverte,2,La dernière fois que tu as menti à un(e) pote // la dernière fois que tu as pleuré ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"amitié,secret",FALSE,FALSE,TRUE
CASH-0107,Cash ou Cash,Découverte,2,Le compliment que tu attends qu'on te fasse // la critique que tu redoutes le plus ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"secret,opinion",FALSE,FALSE,TRUE
CASH-0108,Cash ou Cash,Découverte,3,Le secret que tu gardes pour ta famille // celui que tu gardes pour tes amis ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"famille,secret",FALSE,FALSE,TRUE
CASH-0109,Cash ou Cash,Sans filtre,3,Ton pire moment de honte en soirée // ton meilleur souvenir interdit ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"honte,alcool",FALSE,FALSE,TRUE
CASH-0110,Cash ou Cash,Découverte,3,La personne d'ici que tu admires le plus // celle que tu comprends le moins ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"amitié,opinion",FALSE,FALSE,TRUE
CASH-0111,Cash ou Cash,Découverte,3,Un truc que tu jalouses chez quelqu'un ici // un truc dont tu es secrètement fier(e) ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"secret,amitié",FALSE,FALSE,TRUE
CASH-0112,Cash ou Cash,Hot,4,Ton fantasme le plus soft // ton fantasme le moins avouable ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"sexe,secret",TRUE,FALSE,TRUE
CASH-0113,Cash ou Cash,Découverte,4,Le crush le plus gênant de ta vie // le crush que tu n'as jamais avoué ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"séduction,secret",TRUE,FALSE,TRUE
CASH-0114,Cash ou Cash,Hot,4,La chose la plus osée que tu aies faite // celle que tu meurs d'envie d'essayer ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"sexe,secret",TRUE,FALSE,TRUE
CASH-0115,Cash ou Cash,Hot,5,Le nom que tu penses fort mais ne diras pas ici // le geste que tu n'oublieras jamais ?,Le joueur actif,Tu ne réponds à aucune des deux : gorgée.,…ou tu te prends un gage du groupe.,"sexe,secret",TRUE,TRUE,TRUE
VERDICT-0116,Le Verdict,Découverte,2,"À quel point cette personne dit toujours la vérité ? (0 = ment tout le temps, 10 = trop honnête)",Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","opinion,amitié",TRUE,FALSE,TRUE
VERDICT-0117,Le Verdict,Découverte,2,Quelle est la probabilité que cette personne soit riche à 40 ans ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","argent,opinion",TRUE,FALSE,TRUE
VERDICT-0118,Le Verdict,Découverte,2,Cette personne finira-t-elle mariée en premier… ou en dernier ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","couple,opinion",TRUE,FALSE,TRUE
VERDICT-0119,Le Verdict,Découverte,3,À quel point cette personne cache bien son jeu ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","secret,opinion",TRUE,FALSE,TRUE
VERDICT-0120,Le Verdict,Découverte,3,Cette personne est-elle secrètement la plus jalouse du groupe ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","amitié,secret",TRUE,FALSE,TRUE
VERDICT-0121,Le Verdict,Découverte,3,"Qui, dans le groupe, cette personne a-t-elle le plus probablement déjà trouvé attirant(e) ?",Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","séduction,secret",TRUE,FALSE,TRUE
VERDICT-0122,Le Verdict,Découverte,3,À quel point cette personne pardonnerait-elle une trahison ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","amitié,opinion",TRUE,FALSE,TRUE
VERDICT-0123,Le Verdict,Découverte,4,Cette personne a-t-elle déjà eu des vues sur quelqu'un présent ce soir ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","séduction,secret",TRUE,FALSE,TRUE
VERDICT-0124,Le Verdict,Hot,4,À quel point cette personne est-elle différente au lit de ce qu'elle laisse penser ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","sexe,opinion",TRUE,FALSE,TRUE
VERDICT-0125,Le Verdict,Hot,4,Cette personne oserait-elle un plan à trois ?,Le joueur au centre,Selon le verdict du groupe : gorgée.,"…ou il/elle réagit à chaud, sans filtre.","sexe,opinion",TRUE,FALSE,TRUE
CONNAIS-0126,Tu me connais ?,Découverte,2,"Selon toi, quelle est sa plus grande peur ?",Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"amitié,secret",TRUE,FALSE,TRUE
CONNAIS-0127,Tu me connais ?,Découverte,2,Devine : préfère-t-il/elle être aimé(e) ou respecté(e) ?,Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"opinion,amitié",TRUE,FALSE,TRUE
CONNAIS-0128,Tu me connais ?,Fun,2,"Quel est, d'après toi, son plus gros complexe ?",Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"secret,embarrassant",TRUE,FALSE,TRUE
CONNAIS-0129,Tu me connais ?,Hot,3,Devine le nombre de personnes qu'il/elle a embrassées.,Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"sexe,séduction",TRUE,FALSE,TRUE
CONNAIS-0130,Tu me connais ?,Découverte,3,"Selon toi, a-t-il/elle déjà été infidèle ?",Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"couple,secret",TRUE,FALSE,TRUE
CONNAIS-0131,Tu me connais ?,Découverte,3,Devine : quel est le secret qu'il/elle n'a jamais dit à ses parents ?,Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"famille,secret",TRUE,FALSE,TRUE
CONNAIS-0132,Tu me connais ?,Hot,4,"D'après toi, quel est son fantasme inavoué ?",Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"sexe,secret",TRUE,FALSE,TRUE
CONNAIS-0133,Tu me connais ?,Hot,4,Devine la chose la plus osée qu'il/elle ait déjà faite.,Deux joueurs (le devineur + la cible),Mauvaise réponse : gorgée pour le devineur.,…ou le devineur relève un petit défi.,"sexe,secret",TRUE,FALSE,TRUE
HOT-0134,Hot / Intime,Hot,4,Regarde la personne en face de toi et dis ce que tu remarques en premier chez elle.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","séduction,physique",TRUE,TRUE,TRUE
HOT-0135,Hot / Intime,Hot,4,Décris ton type idéal… et vérifie si quelqu'un ici correspond.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","séduction,physique",TRUE,TRUE,TRUE
HOT-0136,Hot / Intime,Hot,4,Quel est le geste anodin qui te fait complètement craquer ?,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","séduction,sexe",TRUE,TRUE,TRUE
HOT-0137,Hot / Intime,Hot,4,"Raconte ton premier baiser mémorable, sans donner de nom.",Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","séduction,secret",TRUE,TRUE,TRUE
HOT-0138,Hot / Intime,Hot,4,Qu'est-ce qui te rend irrésistible d'après toi ? Assume.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","séduction,fierté",TRUE,TRUE,TRUE
HOT-0139,Hot / Intime,Hot,4,Chuchote à l'oreille du joueur de ton choix ce que tu penses vraiment de lui/elle.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","séduction,secret",TRUE,TRUE,TRUE
HOT-0140,Hot / Intime,Hot,4,Quel est le compliment le plus intime qu'on t'ait fait ?,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,séduction",TRUE,TRUE,TRUE
HOT-0141,Hot / Intime,Hot,4,Envoie un regard de séduction à un joueur pendant 10 secondes sans rire.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","séduction,physique",TRUE,TRUE,TRUE
HOT-0142,Hot / Intime,Hot,5,"Décris ta soirée idéale à deux, du début… à la fin.",Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,couple",TRUE,TRUE,TRUE
HOT-0143,Hot / Intime,Hot,5,Quelle est ta zone préférée qu'on t'embrasse ?,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,physique",TRUE,TRUE,TRUE
HOT-0144,Hot / Intime,Hot,5,Raconte le lieu le plus insolite où tu es allé(e) un peu trop loin.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,absurde",TRUE,TRUE,TRUE
HOT-0145,Hot / Intime,Hot,5,Quel est le message le plus chaud que tu aies déjà envoyé ? Cite-le.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,séduction",TRUE,TRUE,TRUE
HOT-0146,Hot / Intime,Hot,5,Quelle est la chose que tu adores qu'on te fasse mais que tu n'oses jamais demander ?,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,couple",TRUE,TRUE,TRUE
HOT-0147,Hot / Intime,Hot,5,"Si tu devais embrasser quelqu'un ici pour un gage, ce serait qui ?",Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,séduction",TRUE,TRUE,TRUE
HOT-0148,Hot / Intime,Hot,5,Décris ton fantasme le plus assumé en une phrase.,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,secret",TRUE,TRUE,TRUE
HOT-0149,Hot / Intime,Hot,5,Quelle est la limite que tu rêves secrètement de franchir ?,Le joueur actif (ou désigné),Tu passes : gorgée.,"…ou tu passes, tout simplement — aucune justif.","sexe,secret",TRUE,TRUE,TRUE
"""

SEED_CARDS = _parse(RAW_CSV)
