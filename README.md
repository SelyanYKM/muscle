# 🏋️ mooscles

Application mobile Android, 100 % hors-ligne, pour suivre un programme Push / Pull / Legs avec suggestion automatique des charges (surcharge progressive) et visualisation des disques à charger.

---

## 📱 Fonctionnalités

**Séance en direct**
- Sélection du split (Push / Pull / Legs) depuis l'accueil, qui affiche aussi le temps écoulé depuis la dernière séance de chaque split.
- Un écran de série à la fois : charge et répétitions ajustables, validation en un geste.
- Séries d'échauffement suggérées (barre libre et machines) et décomposition visuelle des disques à charger par côté (code couleur olympique) ; taper la dernière pastille d'échauffement lance un repos de 60s avant la série de travail.
- Minuteur de repos plein écran (pause/reprise, erreur de saisie corrigible) et notification Android "vivante" — décompte natif, boutons Pause/Passer, exercice et charge de la prochaine série directement dedans — durée automatique selon l'équipement (poulie / machine / barre libre), rallongée lors d'un changement de machine.
- Passage automatique à l'exercice suivant du catalogue une fois le nombre de séries prévu atteint.

**Algorithme de progression (double progression)**
- Deux modes par exercice : `CHARGE` (séries identiques, poids qui monte — compound/machine) et `REPS_PUIS_CHARGE` (les répétitions montent dans une plage avant que le poids augmente — isolation/poulie). Un exercice en `CHARGE` passe de lui-même en double progression tant que sa charge est trop légère pour encaisser un palier.
- Classification de chaque séance au volume réellement fait (réussie facile / réussie / presque / ratée / allégée) : rater une ou deux reps en fin de séance n'est pas un échec, et une charge baissée en cours de route ne vaut jamais une hausse.
- Déchargement uniquement après 3 échecs ou 4 séances sans réussite — jamais sur une seule mauvaise séance.
- Réduction de la charge après une longue coupure (14/30 jours), proposée dès la séance du retour ; calibration de la charge et de l'objectif d'après les reps faites au premier lancement d'un exercice.

Détail des règles : voir [Algorithme de progression](#-algorithme-de-progression).

**Bilan & historique**
- Fin de séance : statut et prochaine charge par exercice, ressenti mental/physique et étirements (optionnel).
- Historique groupé par mois, une feuille unique pour tout modifier d'une séance passée (programme, exercices, séries), mini phrase bilan générée automatiquement par séance.
- Export de l'historique en texte lisible, et sauvegarde/restauration complète en JSON (catalogue, historique, progression, ressentis, poids de corps) via le partage natif — aucune synchronisation cloud intégrée.

**Suivi**
- Tiroir de stats sur l'accueil : volume et régularité par semaine, répartition du volume par groupe musculaire, courbe de force estimée (formule Epley) sur les exercices barre libre, records personnels.
- Suivi du poids de corps avec photo optionnelle (appareil photo ou galerie), entrées supprimables.

**Catalogue**
- Exercices Hammer Strength (machines), finishers barre libre, exercices poulie — catalogue géré en base, modifiable (ajout/suppression) directement dans l'app.

---

## 🧮 Algorithme de progression

Moteur pur dans `src/engine/progressionV2.ts` (aucune dépendance à la base ni à React). L'état mémorisé par exercice (`ExerciseProgressionState`) n'a pas changé de forme depuis la v2.

**Deux temps**
- **Avant la séance** — `getPrescription()` (ou `prescriptionFor(exercice)` dans les écrans) donne la charge et l'objectif à afficher, réduction de reprise comprise. Ne jamais lire `currentWeight` du catalogue directement pour l'affichage.
- **Après la séance** — `suggestNextPrescription()` reçoit **toutes** les séries loguées, les compare à cette prescription et renvoie le nouvel état à enregistrer.

**Changement de règles** — quand le moteur change, la charge mémorisée par l'ancienne version peut avoir dérivé. Une migration unique (`replay_progression_v3` dans `db.ts`) rejoue alors tout l'historique réel de chaque exercice dans le nouveau moteur (`replayHistory`) : la première suggestion après la mise à jour part de la dernière séance réellement faite.

**Séries prises en compte** (`selectWorkingSets`) — le moteur est pensé pour des séries droites (ex. 3×8 à la même charge) :
- Séries droites : au moins le nombre de séries prévu à une même charge. Une série test, une série bonus ou une série de retour au calme à une autre charge est ignorée.
- Séance irrégulière (montée en charge, charge baissée en cours de route) : une série plus lourde que prévu et ratée est une tentative, ignorée ; on garde ensuite les premières séries, et la charge retenue est la plus légère. Une montée en charge 60 / 70 / 75 ne fait donc pas progresser.
- Moins de séries que prévu (tentatives exclues) : séance incomplète, rien ne bouge.

**Classement de la séance** — reps plafonnées à l'objectif, rapportées au volume visé :

| Statut | Condition | Effet |
|---|---|---|
| Réussie facile | toutes les séries ≥ objectif, case « facile » ou ≥ objectif + 2 partout | +2 paliers si ça reste sous +10 % de la charge, sinon +1 |
| Réussie | toutes les séries ≥ objectif | +1 palier (CHARGE) ou +1 rep (double progression) |
| Presque | ≥ 85 % du volume | charge maintenue |
| Ratée | < 85 % du volume | charge maintenue, compte comme un échec |
| Allégée | sous la charge prévue (séance plus légère isolée, ou série(s) sous la charge), reps tenues | charge maintenue, jamais de hausse |
| Incomplète | moins de séries que prévu | rien ne bouge |
| Calibration | première séance sur l'exercice | charge et objectif estimés (Epley) d'après les reps faites, à ±20 % |

Exemple sur 3×8 : 8/8/7 ou 8/7/6 = presque ; 8/6/6 = ratée.

**Charge différente de la prescription** — une mauvaise séance fait stagner, jamais reculer :
- Plus lourde et tenue (réussie ou presque) : la nouvelle charge est adoptée. Plus lourde et ratée : retour à la prescription, sans compter d'échec.
- Plus légère, une fois : une mauvaise séance ne creuse pas, la charge prévue est maintenue (statut « Allégée »).
- Plus légère deux séances de suite : c'est un choix qui se confirme, la charge faite devient la référence et la progression repart d'elle, sans dépasser la prescription d'origine (2e fois 3×8 à 45 kg pour 50 prévus → 47,5 kg). Le moteur s'appuie sur la séance précédente (`previousSets`), déjà chargée par l'écran.
- Séance irrégulière avec une série sous la prescription : pas de hausse ; la séance compte comme « sans réussite ».

**Double progression** (`REPS_PUIS_CHARGE`)
- L'objectif monte de 1 rep (2 si facile), et vise toujours au moins une rep de plus que la dernière perf sur toutes les séries.
- Haut de la plage atteint partout : +1 palier, objectif ramené au bas de la plage.
- **Charge légère** : en mode `CHARGE`, si un palier dépasse 10 % de la charge (ex. 8 → 10 kg = +25 %), l'exercice suit une double progression sur la plage objectif → objectif + 4 (8-12) jusqu'à ce que la charge soit assez lourde.

**Décharge** — après 3 séances ratées depuis la dernière réussite, ou 4 séances sans réussite (presque, ratée, allégée) :
- `CHARGE` : environ −10 % après 3 échecs, au palier le plus proche (52,5 → 47,5 kg) ; −1 palier seulement pour une stagnation (des « presque » qui s'accumulent, ex. 8/8/7 quatre fois).
- Double progression : retour au bas de la plage, puis −1 palier si on y est déjà.

**Reprise après une pause** — calculée sur la date de la dernière séance de l'exercice :
- plus de 14 jours : −10 % ; plus de 30 jours : −20 % ;
- un cran de moins si une autre séance a eu lieu dans les 14 derniers jours (`getLastTrainingDateBefore()` dans `db.ts`) ;
- la réduction est proposée **avant** la séance du retour, qui est ensuite évaluée normalement par rapport à elle ; les compteurs d'échecs repartent de zéro.

**Réglages** — toutes les valeurs (85 %, 3 échecs, 4 séances, 10 %, ±20 %…) sont des constantes exportées en tête de `progressionV2.ts`.

**Tests** — `npm run test:engine` (Node 22.18 ou plus récent, aucune dépendance) : scénarios dans `src/engine/__tests__/progressionV2.test.mjs`.

---

## 🏗️ Stack technique

- **Expo SDK 57** (React Native) + TypeScript
- **expo-sqlite** : toute la donnée est locale, aucun compte ni backend
- **expo-updates** (OTA) + **EAS Build** pour la distribution Android (voir ci-dessous)
- **react-native-notify-kit** (fork maintenu de Notifee) : notification "vivante" du minuteur de repos (foreground service Android, décompte natif, boutons d'action) — `expo-notifications` reste en plus comme filet de secours (alerte programmée)

---

## 🚀 Mises à jour & build

Deux canaux de livraison distincts, à ne pas confondre :

- **Mise à jour OTA** (`eas update`, via `.github/workflows/publish-update.yml`) : se déclenche automatiquement à chaque `push` sur `main`. Elle met à jour le code JS/les assets d'une app déjà installée, **sans réinstallation** — appliquée au prochain lancement de l'app. Suffisant pour la quasi-totalité des changements (écrans, logique, styles, schéma SQLite).
- **Nouvel APK** (`eas build`, via `.github/workflows/build-android-apk.yml`, déclenchement manuel) : nécessaire uniquement quand une **nouvelle dépendance native** est ajoutée (ex: `expo-image-picker`, `expo-document-picker`) — un changement qu'une mise à jour OTA ne peut pas livrer, car le module natif doit être compilé dans le binaire.

Le champ `version` dans `app.json` pilote le `runtimeVersion` (politique `appVersion`) : une mise à jour OTA n'est proposée qu'aux APK partageant la même version. **Toujours incrémenter `version` avant de pousser un changement qui ajoute une dépendance native**, pour qu'un APK existant (sans ce module) ne tente jamais de charger une mise à jour qui le ferait planter.

---

## 🏗️ Structure du projet

```
mooscles/
├── src/
│   ├── components/
│   │   ├── BarChart.tsx            # Graphique en barres réutilisable (stats)
│   │   ├── BottomSheet.tsx         # Feuille basse commune à toute l'app
│   │   ├── DashboardSheet.tsx      # Tiroir de stats (accueil)
│   │   ├── Dot.tsx / Icon.tsx      # Composants partagés
│   │   ├── PlateBreakdown.tsx      # Décomposition visuelle des disques
│   │   └── RestTimerOverlay.tsx    # Minuteur de repos plein écran
│   ├── constants/
│   │   ├── feeling.ts              # Libellés/couleurs de ressenti (partagés)
│   │   └── splits.ts               # Métadonnées des splits Push/Pull/Legs
│   ├── database/
│   │   ├── db.ts                   # SQLite local, migrations, requêtes
│   │   └── seed.ts                 # Catalogue d'exercices par défaut
│   ├── engine/
│   │   ├── plateCalculator.ts      # Décomposition des disques par côté
│   │   ├── progressionV2.ts        # Algorithme de double progression
│   │   └── __tests__/              # Tests du moteur (npm run test:engine)
│   ├── screens/
│   │   ├── SplitSelectScreen.tsx   # Accueil (choix du split + tiroir de stats)
│   │   ├── FreeWorkoutScreen.tsx   # Déroulé de la séance en direct
│   │   ├── WorkoutSummaryScreen.tsx# Bilan de fin de séance
│   │   └── HistoryScreen.tsx       # Historique, édition, sauvegarde
│   ├── theme/
│   │   └── index.ts                # Thème (couleurs, polices, rayons)
│   ├── types/
│   │   └── index.ts                # Modèles et interfaces TypeScript
│   └── utils/
│       ├── audio.ts / haptics.ts
│       ├── restTimerService.ts     # Alerte de repos de secours (expo-notifications)
│       ├── restTimerNotifee.ts     # Notification de repos live (react-native-notify-kit)
│       ├── backup.ts               # Export/import JSON complet
│       ├── bodyPhoto.ts            # Capture/copie de photo (poids de corps)
│       ├── exportHistory.ts        # Export texte de l'historique
│       └── format.ts               # Formatage poids/dates partagé
├── App.tsx                         # Point d'entrée principal
├── index.ts                        # Enregistre le foreground service notifee + ses événements
└── app.json                        # Config Expo (version, plugins, EAS)
```
