# Handoff : mooscles — refonte visuelle v2 (Bleu & Or)

## Overview
Refonte visuelle de tous les écrans de l'app Expo/React Native `SelyanYKM/muscle` : accueil (choix du split + tiroir « Ton progrès »), séance en direct, minuteur de repos, sélecteur/création d'exercice, bilan, historique. Le flux et la logique métier ne changent **pas** — seuls le thème, la hiérarchie visuelle et quelques micro-réorganisations.

Objectifs : nouvelle palette Bleu impérial & Or ; une seule surface forte par écran (fin des cartes blanches identiques) ; couleur signature par split ; pastilles au lieu des émojis 🟢🟠🔴 ; boutons de ressenti plus grands ; échelle de rayons unique ; feuilles basses claires partout (fin des modals noires) ; vraies icônes SVG centrées ; texte ≥ 11 px.

## About the Design Files
`Mooscles Refonte v2.dc.html` est une **référence de design en HTML** (prototype cliquable), pas du code à copier. La tâche est de **recréer ce design dans le code React Native existant** (StyleSheet, `expo-linear-gradient`, `react-native-svg` déjà présents), en suivant ses patterns. Ouvrir le fichier HTML dans un navigateur pour voir le rendu et les interactions (colonne de gauche = raccourcis vers chaque écran).

## Fidelity
**High-fidelity.** Couleurs, typo, espacements et rayons sont finaux. Piste retenue : **A (Clair)** — c'est la valeur par défaut du prototype. La piste B (carte de série bleu nuit) est documentée en annexe, optionnelle.

## Mise en place
1. Coller `theme-blue-gold.ts` dans `src/theme/index.ts`, puis `export const THEME = THEME_BLUE_GOLD;` (rollback = repointer sur `THEME_SOFT_STRENGTH`).
2. Charger en plus dans `App.tsx` : `Manrope_500Medium`, `Manrope_600SemiBold`, `Manrope_800ExtraBold` (`@expo-google-fonts/manrope`).
3. **Important** : dans le code actuel `THEME.colors.accent` sert parfois de couleur de **texte** (`chevron`, `timerText`, `changeExBtnText`, `liveVolumeText`, `nextWeightsText`, `catalogItemNameActive`, `catalogItemActionActive`, `editExIcon`, `stepValText`, `peekLabel`). L'or n'est pas lisible sur fond clair → remplacer par `accentStrong` (#00509D) partout où c'est du texte.
4. Créer 2 petits composants partagés : `Dot` (pastille de ressenti) et `Icon` (SVG, voir Assets).

## Design Tokens
**Couleurs** — voir `theme-blue-gold.ts`. Résumé :
- Texte : `#00296B` (primaire), `#55617A` (secondaire), `#2A3A5C` (texte des chips).
- Fonds : `#F5F7FB` ; dégradé écran 155° `#D3E0F2 0% → #F5F7FB 52% → #FFF2BF 100%` (accueil) ; 200° `#FFF2BF → #F5F7FB 45%` (bilan) ; 200° `#D3E0F2 → #F5F7FB 42%` (historique).
- Surfaces : blanc `rgba(255,255,255,.8)` + bordure `#FFFFFF` ; intérieur `#EEF2F8` ; filet `rgba(0,41,107,.07)`.
- Accent : or `#FDC500` (surfaces, CTA, barres, pastille du timer, point du logo) ; texte d'accent `#00509D`.
- Ombres : couleur `#00296B`, opacité 0.08–0.18.
- Ressentis (inchangés) : Facile bg `#DCF0D4` / bord `#C3E4C0` / encre `#2C5A35` · Juste `#FFEBD6` / `#FFDCC0` / `#8A5321` · Échec `#FBD9DC` / `#F6C3C8` / `#96404A`.
- Verdicts bilan : Augmentation `#DCF0D4`/`#2C5A35` · Intermédiaire `#FFEBD6`/`#8A5321` · Maintien `#EEF2F8`/`#3A4A66` · Deload `#FBD9DC`/`#96404A`.
- Splits : Push or (`#FFD500→#FDC500`, texte `#00296B`, teinte `#FFF4C2`) · Pull azur (`#00509D→#003F88`, texte blanc, teinte `#DCE8F5`) · Legs impérial (`#003F88→#00296B`, texte blanc, teinte `#D9E1EF`). Dégradés à 150°.

**Typographie**
- Titres : Petrona 600. Écran 32/1.05 (ls −0.6) · Titre de page 28 · Feuille 26 · Nom d'exercice 26/1.15 (ls −0.3) · Carte split 24 · Logo 26 (ls −0.5) · Valeurs stats 24–26 · Minuteur 80/1 (ls −2).
- UI : Manrope. Labels de section 11 / 800 / ls 1 / MAJUSCULES / `#55617A` · Corps 13–14 / 500–700 · Valeurs stepper 40 / 800 / ls −1 / chiffres tabulaires · Boutons 15 / 800 · Chips 12 / 700.
- **Aucun texte < 11 px.**

**Rayons** : 28 (feuilles, carte héro, cartes split, conteneurs de liste) · 20–22 (cartes, lignes stepper, tuiles ressenti) · 14 (boutons stepper, badges lettre petits) · 999 (pilules, CTA).

**Espacements** : padding écran horizontal 18–20 ; gap entre blocs 18–22 ; gap interne cartes 12–16 ; CTA 56 de haut ; cibles tactiles ≥ 44.

## Screens

### 1. Accueil — `SplitSelectScreen.tsx` + `DashboardSheet.tsx`
- Fond : dégradé accueil. Padding `52 20 120`, colonne gap 22.
- En-tête : logo 42×42 rayon 13 + « mooscles » (le « . » en `#FDC500`) + sous-titre 12/600 `#55617A`. À droite pilule « Historique » h40, padding 0 16, `rgba(255,255,255,.75)`, bordure blanche (appui long = effacer, inchangé).
- Titre « Choisis ton split » 32 + sous-titre 14/500.
- 3 cartes `flex:1`, gap 12 : rayon 28, `rgba(255,255,255,.8)`, bordure 1.5 blanche (la carte **« À suivre »** = split le plus ancien, bordure = `splits[id].gradient[1]`), ombre 0/10/24 0.12. Contenu en ligne gap 16, padding horizontal 18 :
  - badge lettre 60×60 rayon 20, dégradé du split, lettre Petrona 28 couleur `fg` ;
  - nom Petrona 24 + chip « À suivre » (fond `#00296B`, texte blanc 11/800, pilule) ; muscles 13/600 ; méta « 5 exercices · il y a 5 j » 12/600 ;
  - bouton flèche 38×38 rond, fond `tint`, icône arrow-right 18 couleur `ink`.
- Tiroir replié (PEEK 108) : blanc .97, rayon 28 en haut. Poignée 40×4. Label « TON PROGRÈS » 11/800 `#00509D` (sans 📊) + insight Petrona 18. À droite mini-histogramme 6 barres 6 px de large, ≤ 34 de haut, or, dernière barre opacité 1, autres 0.4.
- Tiroir déplié (82 %) : fond de voile `rgba(0,41,107,.4)`. En-tête « Ton progrès » 26 + pilule « Réduire » (fond `#EEF2F8`). Stats = **un seul** bloc `#EEF2F8` rayon 20 avec 3 colonnes séparées par des filets (fini les 3 tuiles). Graphiques : barres rayon 6/6/2/2, volume en or, séances en `#00509D`, semaine courante opacité 1, autres 0.45. Records = liste à filets (pas de cartes), poids 15/800 `#00509D`.

### 2. Séance — `FreeWorkoutScreen.tsx`
- Fond : dégradé 170° `tint du split 0% → #F5F7FB 42%`. Padding `48 18 36`, gap 18.
- En-tête : badge lettre 40×40 rayon 14 (dégradé du split) + nom Petrona 24 + muscles 12/600. À droite : chip chrono h40 `rgba(255,255,255,.8)` avec pastille or 7 px + « 12:34 » 14/800 tabulaire ; bouton rond 40 icône **x** (remplace la pilule « Quitter »).
- **Barre de progression des exercices** (nouveau) : un segment par exercice (flex 1, h4, rayon 2, gap 4) — actif `#00296B`, fait = couleur du split, à faire `rgba(0,41,107,.12)`. Dessous : « Exercice 2 sur 5 » 12/700 + « Changer d'exercice » `#00509D` + icône chevron-down 15. Le tap ouvre le sélecteur.
- **Carte héro** (unique surface forte) : rayon 28, `rgba(255,255,255,.88)` + bordure blanche, padding 20, gap 16, ombre 0/14/30 0.14. Les surfaces internes = encre à 6–10 % d'opacité.
  - ligne 1 : badge « HAMMER STRENGTH » / « BARRE LIBRE · FINISHER » 11/800 pilule (encre 9 %) ; à droite « Série 2 » 12/800.
  - nom d'exercice Petrona 26 (tap = sélecteur).
  - « DERNIÈRE FOIS · 8 OCT. » 11/700 opacité .7 + chips « 45 × 8 » avec pastille 8 px (couleur = encre du ressenti).
  - **2 steppers en lignes pleine largeur** (au lieu de 2 colonnes) : conteneur rayon 20 padding 8 ; boutons 64×56 rayon 14 « −2,5 / +2,5 » et « −1 / +1 » 15/800 ; au centre label 11 + valeur 40/800 + unité 15. Décimales en virgule (« 22,5 »).
  - **Disques** (nouveau visuel) : séparateur filet ; à gauche une manche grise `#B7B4BD` (12×12) puis un rectangle par disque, hauteur ∝ poids (20 → 72×14, 10 → 60×12, 5 → 46×10, 2,5 → 36×8 avec bordure `#D0D5DD`, 1,25 → 28×7), rayon 4, gap 3, couleurs olympiques de `plateCalculator.ts` ; à droite « PAR CÔTÉ » + « 22,5 kg » Petrona 22 + « 1 × 20 + 1 × 2,5 » 12/600 (+ « · barre 20 kg » pour le finisher ; « Machine à vide (0 kg) » si vide).
- **Validation** : label « VALIDER LA SÉRIE 2 ». 3 tuiles côte à côte, gap 8, h108, rayon 22, padding 14, dégradé 160° bg→bord du ressenti, encre du ressenti : en haut à gauche un repère 24/800 (« 2+ », « 0–1 », « × »), en haut à droite une pastille 10 ; en bas titre 16/800 (Facile / Juste / Échec) + sous-titre 11/600 (2+ reps en réserve / 0–1 rep en réserve / Reps non atteintes). Pression : scale 0.95.
- **Séries effectuées** : en-tête « SÉRIES EFFECTUÉES · 3 » + volume « 1 080 kg » 13/800 `#00509D`. Vide : bloc pointillé 1.5 `rgba(0,41,107,.14)` rayon 20. Sinon **un seul** conteneur `rgba(255,255,255,.6)` rayon 20, une ligne par exercice séparée par des filets, chips colorées (fond = bg du ressenti, texte + pastille 7 = encre).
- CTA « Terminer la séance » h56 pilule, **fond or `#FDC500`, texte `#00296B`** 15/800, ombre or 0/10/24 0.45. Séance vide → toast bas (fond `#00296B`, rayon 16) « Valide au moins une série avant de terminer. ».
- Quitter → feuille basse « Quitter la séance ? » (Continuer = primaire `#00296B` ; Quitter = fond `#FBD9DC` texte `#96404A`). Remplace `Alert.alert`.

### 3. Sélecteur / création d'exercice (modals de `FreeWorkoutScreen`)
- Passer en **feuille basse** blanche rayon 28, voile `rgba(0,41,107,.4)`, max 84 %. Titre « Choisir un exercice » 26 + « Push · 5 exercices ».
- Lignes rayon 18 padding 12 : numéro rond 32 (actif : fond `#00296B` texte blanc, sinon `#EEF2F8`/`#55617A`), nom 14/700, sous-titre « Hammer Strength · conseillé 40 kg » 12/500, à droite pastilles des séries faites. Ligne active fond = teinte du split.
- Bas : « + Nouvel exercice » (pilule `#EEF2F8`, h52) + « Fermer » (pilule bordée).
- Création : champs h52 rayon 16 fond `#F5F7FB` bordure `#E1E7F0` ; type = contrôle segmenté pilule (fond `#EEF2F8`, segment actif blanc + ombre) « Machine · 0 kg » / « Barre libre · 20 kg » ; CTA « Créer & sélectionner » primaire.

### 4. Repos — `RestTimerOverlay.tsx`
- Plein écran, dégradé 165° `#00296B → #003F88 55% → #00509D`. Barre d'état en clair. Padding `60 24 34`, colonne centrée gap 22.
- « RÉCUPÉRATION » 12/800 ls 2.4 `#FFD500`.
- **Anneau** (remplace la barre de progression) : 264×264, piste `rgba(255,255,255,.14)`, arc or `#FDC500` proportionnel au temps restant (`react-native-svg` Circle + strokeDasharray), disque intérieur 238 `#00296B`. Temps Petrona 80 blanc tabulaire + « sur 1:30 » 13/700 blanc .72. Garder la micro-pulsation.
- Pilules « −15 s / +30 s / +60 s » h44, fond `rgba(255,255,255,.12)`, bordure `.22`, texte blanc 14/800.
- Carte « PROCHAINE SÉRIE » (label or), fond `rgba(255,255,255,.08)` bordure `.16` rayon 24 : nom Petrona 21 blanc, « Série 3 · **45 kg** × 8 » (poids en `#FFD500`).
- CTA « Je suis prêt » h56 pilule or / texte `#00296B`. Lien « Erreur ? Corriger la dernière série » 13/700 blanc .85 souligné.

### 5. Bilan — `WorkoutSummaryScreen.tsx`
- Fond dégradé bilan, padding `56 18 32`, gap 20.
- Pastille 64 ronde au dégradé du split, icône **check** 30 couleur `fg` (remplace ⚡). « Séance terminée » Petrona 32 (plus de MAJUSCULES 900). « Push · mar. 13 oct. ».
- Stats : **un bloc** blanc .8 rayon 24, 3 colonnes séparées par des filets : Durée (min) / Volume (kg) / Séries — valeur Petrona 26 + unité 13 + label 11/800.
- « BILAN DE SURCHARGE » : une carte par exercice blanc .85 rayon 20 padding 16 gap 12 : nom 15/700 + tag verdict (pilule 11/800, couleurs verdict) ; chips séries `#EEF2F8` avec pastille ; filet ; « PROCHAINE SÉANCE » + charges 20/800 **couleur d'encre du verdict** + message 13/500.
- CTA « Enregistrer & revenir » primaire `#00296B`.

### 6. Historique — `HistoryScreen.tsx`
- Fond dégradé historique, padding `48 18 32`. En-tête : bouton rond 40 icône **arrow-left**, « Historique » Petrona 28, pilule « Exporter » (sans ⇧).
- « OCTOBRE 2026 » + résumé « 4 séances · 21 345 kg ».
- **Un seul conteneur** blanc .82 rayon 24, lignes séparées par des filets : badge lettre 46 rayon 15 dégradé du split ; date 12/700 ; nom du split Petrona 20 ; « 5 exos · 15 séries · **9 840 kg** » ; chevron-down 16 dans un rond 32 `#EEF2F8`, rotation 180° si ouvert (200 ms).
- Déplié : bloc `#F2F5FA` rayon 16 (marge 0 12 12) ; par exercice nom 13/700 + « Modifier » `#00509D` ; chips blanches avec pastilles ; pied « Modifier la séance ».
- Légende des pastilles en bas (Facile / Juste / Échec).
- Les modals d'édition existants : passer en feuilles basses claires (même style que le sélecteur), remplacer les ✏️ et les boutons rouges sombres `#2D1216` par le style « Quitter » ci-dessus. *(Non maquettés en détail.)*

## Interactions & Behavior
- Navigation inchangée (`App.tsx`). Toutes les modals → feuilles basses (`Modal` transparent + animation slide, voile `rgba(0,41,107,.4)`).
- Pression : boutons scale 0.94–0.98 ; tuiles ressenti 0.95 (garder `animateButtonPress`).
- Chevron historique : rotation 200 ms.
- Haptique / son / service de minuteur : inchangés.

## State Management
Aucun nouvel état métier. Ajouts UI : `isQuitSheetOpen` (remplace l'Alert), index de l'exercice actif pour la barre de progression (dérivé de `catalogExercises` + `currentExercise`), « split à suivre » = split avec la dernière séance la plus ancienne (dérivable de `getRecentLogs`).

## Assets
- `assets/mooscles_logo.jpg` (existant).
- Icônes : tracés Lucide (stroke 2.2, round caps/joins, viewBox 24, `currentColor`) via `react-native-svg` :
  - arrow-right `M5 12h14` · `m12 5 7 7-7 7`
  - arrow-left `M19 12H5` · `m12 19-7-7 7-7`
  - x `M18 6 6 18` · `m6 6 12 12`
  - chevron-down `m6 9 6 6 6-6`
  - check `M20 6 9 17l-5-5` (stroke 2.6)
  Toujours centrées dans un conteneur carré/rond `justifyContent/alignItems: 'center'`.
- Émojis à supprimer : 🟢🟠🔴 → `Dot` ; 📊 ⚡ 📜 ✏️ ⇧ ↩️ ▾ ▲ ▼ → icônes ou texte seul.

## Annexe — Piste B (optionnelle)
Carte héro en dégradé 160° `#00296B → #003F88 60% → #00509D`, texte `#F2F6FC`, ombre 0/18/36 `rgba(0,41,107,.35)` ; pastilles en version claire (couleurs « bord » des ressentis). Accueil : cartes split entièrement au dégradé du split avec lettre géante en filigrane (Petrona 190, blanc .32). Ressentis en 3 lignes pleine largeur (h66).

## Files
- `Mooscles Refonte v2.dc.html` — prototype de référence (ouvrir dans un navigateur ; Tweaks : piste A/B, durée de repos).
- `theme-blue-gold.ts` — tokens prêts à coller.
- `assets/mooscles_logo.jpg`.
