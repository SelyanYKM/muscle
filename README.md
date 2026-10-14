# 🏋️ mooscles

Application mobile Android, 100 % hors-ligne, pour suivre un programme Push / Pull / Legs avec suggestion automatique des charges (surcharge progressive) et visualisation des disques à charger.

---

## 📱 Fonctionnalités

**Séance en direct**
- Sélection du split (Push / Pull / Legs) depuis l'accueil, qui affiche aussi le temps écoulé depuis la dernière séance de chaque split.
- Un écran de série à la fois : charge et répétitions ajustables, validation en un geste.
- Séries d'échauffement suggérées (barre libre et machines) et décomposition visuelle des disques à charger par côté (code couleur olympique).
- Minuteur de repos plein écran avec alerte sonore, vibration et notification — durée automatique selon l'équipement (poulie / machine / barre libre).

**Algorithme de progression (double progression)**
- Deux modes par exercice : `CHARGE` (séries identiques, poids qui monte — compound/machine) et `REPS_PUIS_CHARGE` (les répétitions montent dans une plage avant que le poids augmente — isolation/poulie).
- Classification de chaque séance (réussie facile / réussie / partielle / ratée) à partir des répétitions réellement faites, avec déchargement uniquement après 2 échecs consécutifs ou 3 séances sans réussite — jamais sur une seule mauvaise séance.
- Réduction automatique de la charge après une longue coupure (14/30 jours), calibration libre au premier lancement d'un nouvel exercice.

**Bilan & historique**
- Fin de séance : statut et prochaine charge par exercice, ressenti mental/physique et étirements (optionnel).
- Historique groupé par mois, une feuille unique pour tout modifier d'une séance passée (programme, exercices, séries), mini phrase bilan générée automatiquement par séance.
- Export de l'historique en texte lisible, et sauvegarde/restauration complète en JSON (catalogue, historique, progression, ressentis, poids de corps) via le partage natif — aucune synchronisation cloud intégrée.

**Suivi**
- Tiroir de stats sur l'accueil : volume et régularité par semaine, répartition du volume par groupe musculaire, courbe de force estimée (formule Epley) sur les exercices barre libre, records personnels.
- Suivi du poids de corps avec photo optionnelle (appareil photo ou galerie).

**Catalogue**
- Exercices Hammer Strength (machines), finishers barre libre, exercices poulie — catalogue géré en base, modifiable (ajout/suppression) directement dans l'app.

---

## 🏗️ Stack technique

- **Expo SDK 57** (React Native) + TypeScript
- **expo-sqlite** : toute la donnée est locale, aucun compte ni backend
- **expo-updates** (OTA) + **EAS Build** pour la distribution Android (voir ci-dessous)

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
│   │   └── progressionV2.ts        # Algorithme de double progression
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
│       ├── audio.ts / haptics.ts / restTimerService.ts
│       ├── backup.ts               # Export/import JSON complet
│       ├── bodyPhoto.ts            # Capture/copie de photo (poids de corps)
│       ├── exportHistory.ts        # Export texte de l'historique
│       └── format.ts               # Formatage poids/dates partagé
├── App.tsx                         # Point d'entrée principal
└── app.json                        # Config Expo (version, plugins, EAS)
```
