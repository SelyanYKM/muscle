# 🏋️‍♂️ Gym Progression App - Surcharge Progressive PPL

Application mobile hors-ligne conçue pour automatiser la surcharge progressive en salle de musculation (programme PPL axé **Hammer Strength Plate-Loaded** + **Finishers poly-articulaires à la barre libre**).

---

## 📱 Fonctionnalités Clés (MVP)

1. **User Flow "Live Companion"** :
   - **Étape 1 (Préparation)** : Choix du programme (Push, Pull, Legs) et réglage des temps de repos automatiques.
   - **Étape 2 (Cartes Focus format Tinder)** : Une seule carte à la fois pour un focus total en séance.
   - **Étape 3 (Validation ultra-rapide)** : 3 gros boutons tactiles (🟢 Facile, 🟠 Juste, 🔴 Échec).
   - **Étape 4 (Minuteur automatique)** : Compte à rebours automatique avec alertes sonores et vibrations haptiques.
   - **Étape 5 (Bilan $N+1$)** : Calcul automatique déterministe des charges pour la prochaine séance.
2. **Calculateur visuel de disques** :
   - Affiche les disques à charger par côté (`20, 10, 5, 2.5, 1.25 kg`) avec code couleur olympique.
3. **100 % Hors-ligne** :
   - Base de données SQLite locale (`expo-sqlite`). Aucune connexion requise à la salle.
4. **Écran toujours allumé** :
   - Empêche la mise en veille automatique du smartphone pendant l'entraînement (`expo-keep-awake`).

---

## 🚀 Démarrer et Tester l'Application en 1 Minute

### 1. Sur ton smartphone (Le plus rapide)
1. Installe l'application gratuite **Expo Go** sur ton téléphone Android (Google Play Store) ou iOS (App Store).
2. Assure-toi que ton PC et ton téléphone sont connectés au même réseau Wi-Fi.
3. Dans le terminal du projet, lance :
   ```bash
   npx expo start
   ```
4. Scanne le **QR Code** affiché dans le terminal avec l'application Expo Go (ou l'appareil photo sur iOS).

---

## 🐙 Synchroniser avec GitHub

Pour héberger et versionner ton code sur GitHub :

1. **Crée un nouveau dépôt vide sur [GitHub.com](https://github.com/new)** (ex: nomme-le `gym-progression-app`, sans cocher "Add a README").
2. **Dans le terminal de ton projet, exécute les commandes suivantes** (en remplaçant `<TON_PSEUDO>` par ton identifiant GitHub) :
   ```bash
   git remote add origin https://github.com/<TON_PSEUDO>/gym-progression-app.git
   git branch -M main
   git push -u origin main
   ```

---

## 🏗️ Structure du Projet

```
gym-progression-app/
├── src/
│   ├── components/
│   │   ├── ExerciseCard.tsx        # Carte focus de l'exercice
│   │   ├── PlateBreakdown.tsx      # Visualisation des disques par côté
│   │   └── RestTimerOverlay.tsx    # Minuteur plein écran avec alertes
│   ├── database/
│   │   ├── db.ts                   # SQLite local (openDatabaseSync)
│   │   └── seed.ts                 # Catalogue Hammer Strength & Finishers
│   ├── engine/
│   │   ├── plateCalculator.ts      # Algorithme de décomposition des disques
│   │   └── progression.ts          # Algorithme de surcharge progressive
│   ├── screens/
│   │   ├── HistoryScreen.tsx       # Historique des séances passées
│   │   ├── LiveWorkoutScreen.tsx   # Déroulé complet de la séance
│   │   ├── SessionPrepScreen.tsx   # Préparation & temps de repos
│   │   └── WorkoutSummaryScreen.tsx# Bilan & nouvelles charges N+1
│   ├── types/
│   │   └── index.ts                # Modèles et interfaces TypeScript
│   └── utils/
│       ├── audio.ts                # Alertes sonores
│       └── haptics.ts              # Retours vibratoires
├── App.tsx                         # Point d'entrée principal
└── package.json
```
