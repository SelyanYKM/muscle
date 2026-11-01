import { Platform } from 'react-native';

/**
 * THÈME 1 : Sportify Athletic Dark (Thème d'origine préservé pour rollback instantané)
 */
export const THEME_SPORTIFY_DARK = {
  id: 'DARK' as const,
  name: 'Sportify Athletic Dark',
  statusBarStyle: 'light' as const,
  fonts: {
    serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  colors: {
    bg: '#09090B',
    cardBg: '#131317',
    cardBorder: '#23232B',
    cardInner: '#1C1C24',
    cardFinisherBg: '#161317',
    cardFinisherBorder: '#381C24',

    textPrimary: '#FFFFFF',
    textSecondary: '#8E8E9F',
    textMuted: '#525262',

    accent: '#CCFF00',
    accentMuted: 'rgba(204, 255, 0, 0.12)',
    accentTextDark: '#09090B',

    focusCardBg: '#1C1C24',
    focusCardBorder: '#CCFF00',
    restOverlayBg: 'rgba(9, 9, 11, 0.96)',

    badgeBg: '#1F1F27',
    badgeText: '#A1A1B2',
    finisherBadgeBg: '#2A171B',
    finisherBadgeText: '#F87171',

    feelingEasyBg: '#0D241B',
    feelingEasyBorder: '#10B981',
    feelingEasyText: '#FFFFFF',

    feelingMediumBg: '#26180C',
    feelingMediumBorder: '#F59E0B',
    feelingMediumText: '#FFFFFF',

    feelingHardBg: '#281014',
    feelingHardBorder: '#EF4444',
    feelingHardText: '#FFFFFF',
  },
};

/**
 * THÈME 2 : Athletic Ethos: Soft Strength (moodboard "Soft Power" — v2, orange adouci en terracotta)
 * - Fonds doux crème & pêche évanescents (#FBF8F5 / #FEEBF6)
 * - Typographie Duo : Serif affirmé (Editorial / Petrona) pour les titres et Sans-Serif géométrique (Manrope) pour la data
 * - Focus Card Violette (#C080E0) et Rest Blue (#8FB9D0) pour le minuteur
 * - Boutons de validation pastel doux, distincts de l'accent (vert amande / pêche clair / rose poudré)
 * - Textes en noir profond Deep Carbon (#1C1C1E)
 */
export const THEME_SOFT_STRENGTH = {
  id: 'SOFT_STRENGTH' as const,
  name: 'Athletic Ethos: Soft Strength',
  statusBarStyle: 'dark' as const,
  fonts: {
    // Duo typographique du moodboard : serif affirmé (Petrona) pour les titres,
    // sans-serif géométrique (Manrope) pour le reste. Chargées via useFonts dans App.tsx ;
    // avant que le chargement soit terminé, on retombe sur les polices système du téléphone.
    // Poids exacts recommandés par l'export de design (soft-strength-tokens.ts).
    serif: 'Petrona_600SemiBold',
    sans: 'Manrope_700Bold',
    sansMedium: 'Manrope_500Medium',
    sansSemi: 'Manrope_600SemiBold',
    sansHeavy: 'Manrope_800ExtraBold',
  },
  colors: {
    // Fonds & Cartes douces texturées "peluche"
    bg: '#FAF5F0',              // Fond crème chaleureux
    cardBg: '#FFFFFF',          // Blanc pur pour effet coussin tactile
    cardBorder: '#EFE7E0',      // Bordure douce et discrète
    cardInner: '#F5ECE5',       // Surfaces intérieures tièdes
    cardFinisherBg: '#FDF2F0',
    cardFinisherBorder: '#FBCBC5',

    // Fond en dégradé radial (glow pêche/rose/sable) utilisé derrière les écrans "verre" —
    // valeurs issues de l'export de design, à combiner via expo-linear-gradient.
    bgGradientPeach: '#F4C3AE',
    bgGradientPink: '#FEEBF6',
    bgGradientSand: '#F0EAD6',

    // Typographie Deep Carbon & Muted
    textPrimary: '#1C1C1E',     // Noir mat profond
    textSecondary: '#6B6875',   // Gris ardoise chaleureux
    textMuted: '#9E9AA7',       // Légendes adoucies
    controlBorder: '#8A8694',   // bord des cases à cocher (3:1 minimum)
    chartMuted: '#8A8694',      // barres secondaires des graphiques
    textOnDark: '#F4EDF7',      // Texte clair sur fond sombre (carte de série violette)

    // Accents du moodboard — terracotta doux (remplace l'orange vif d'origine)
    accent: '#E28B72',
    accentStrong: '#B3563A',    // texte/CTA sur fond clair
    accentDark: '#A04A31',      // libellés sur fond terracotta
    accentMuted: 'rgba(226, 139, 114, 0.16)',
    accentTextDark: '#FFFFFF',

    // Focus Card & Rest Timer — violet/bleu
    focusCardBg: '#C080E0',     // Focus Violet immersif
    focusCardBorder: '#AE6FD0',
    restOverlayBg: '#8FB9D0',   // Rest Blue ciel apaisant
    restGradientViolet: '#C080E0',
    restGradientBlue: '#8FB9D0',
    restGradientMist: '#AEC6CF',
    restCardBg: 'rgba(255,255,255,0.88)', // carte "verre" du minuteur
    restNumber: '#1F3A57',                // couleur du décompte géant

    // Carte de série active en violet sombre (variante "2c" retenue pour ExerciseCard)
    seriesCardFrom: '#2B1E38',
    seriesCardMid: '#3A2547',
    seriesCardTo: '#22283A',

    // Badges
    badgeBg: '#F0EAD6',         // Lin / Maille naturelle
    badgeText: '#635B4E',
    finisherBadgeBg: '#FDE8E5',
    finisherBadgeText: '#D94D3B',

    // États de validation — pastel, distincts de l'accent terracotta
    feelingEasyBg: '#DCF0D4',   // Vert amande
    feelingEasyBorder: '#C3E4C0',
    feelingEasyText: '#2C5A35',
    feelingEasyGradient: ['#DCF0D4', '#C3E4C0'] as [string, string],

    feelingMediumBg: '#FFEBD6', // Pêche clair
    feelingMediumBorder: '#FFDCC0',
    feelingMediumText: '#8A5321',
    feelingMediumGradient: ['#FFEBD6', '#FFDCC0'] as [string, string],

    feelingHardBg: '#FBD9DC',   // Rose poudré
    feelingHardBorder: '#F6C3C8',
    feelingHardText: '#96404A',
    feelingHardGradient: ['#FBD9DC', '#F6C3C8'] as [string, string],
  },
};

/**
 * THÈME 3 : Blue & Gold (refonte v2) — Bleu impérial & Or, une seule surface forte par
 * écran, couleur signature par split (voir `splits`), pastilles au lieu des émojis.
 * Piste A (claire) du handoff design_handoff_mooscles_v2.
 */
export const THEME_BLUE_GOLD = {
  id: 'BLUE_GOLD' as const,
  name: 'Blue & Gold',
  statusBarStyle: 'dark' as const,
  fonts: {
    serif: 'Petrona_600SemiBold',
    sans: 'Manrope_700Bold',
    sansMedium: 'Manrope_500Medium',
    sansSemi: 'Manrope_600SemiBold',
    sansHeavy: 'Manrope_800ExtraBold',
  },
  colors: {
    bg: '#F5F7FB',
    cardBg: '#FFFFFF',
    cardBorder: '#E1E7F0',
    cardInner: '#EEF2F8',
    cardFinisherBg: '#FFF8DB',
    cardFinisherBorder: '#FFE58A',

    // Dégradé de fond (noms de clés conservés pour compatibilité avec le thème précédent)
    bgGradientPeach: '#D3E0F2', // haut-gauche (bleu brume)
    bgGradientPink: '#F5F7FB',  // milieu
    bgGradientSand: '#FFF2BF',  // bas-droite (or pâle)

    textPrimary: '#00296B',   // Imperial Blue
    textSecondary: '#55617A',
    // Gris le plus clair autorisé pour du texte : 4,97:1 sur blanc, 4,63:1 sur le fond.
    textMuted: '#667086',
    // Bord des contrôles (cases à cocher) : 3,5:1 sur le fond, seuil WCAG des éléments d'interface.
    controlBorder: '#7A8498',
    // Barres secondaires des graphiques (la barre mise en avant est en textPrimary) : 3:1 sur blanc.
    chartMuted: '#6A97CF',
    textOnDark: '#F2F6FC',

    // ⚠ accent (or) = surfaces / pastilles / barres UNIQUEMENT, jamais en texte sur fond clair.
    accent: '#FDC500',        // School Bus Yellow
    accentBright: '#FFD500',  // Gold
    accentStrong: '#00509D',  // Steel Azure — texte d'accent / liens
    accentDark: '#003F88',    // French Blue
    accentMuted: 'rgba(253, 197, 0, 0.18)',
    accentTextDark: '#00296B',// texte posé sur l'or

    focusCardBg: '#00296B',
    focusCardBorder: '#003F88',
    restOverlayBg: '#00296B',
    restGradientViolet: '#00296B', // repos : dégradé 165° 0%
    restGradientBlue: '#003F88',   // 55%
    restGradientMist: '#00509D',   // 100%
    restCardBg: 'rgba(255,255,255,0.08)',
    restCardBorder: 'rgba(255,255,255,0.16)',
    restNumber: '#FFFFFF',
    restRing: '#FDC500',
    restRingTrack: 'rgba(255,255,255,0.14)',
    restRingInner: '#00296B',

    // Carte de série (piste B uniquement, non utilisée en piste A)
    seriesCardFrom: '#00296B',
    seriesCardMid: '#003F88',
    seriesCardTo: '#00509D',

    badgeBg: '#EEF2F8',
    badgeText: '#3A4A66',
    finisherBadgeBg: '#FFF1B8',
    finisherBadgeText: '#00296B',

    // Ressentis — palette vert/ambre/rouge plus saturée (la précédente, pêche clair vs rose
    // poudré, était trop proche en teinte/luminosité pour se distinguer en petite pastille).
    feelingEasyBg: '#DCFCE7',
    feelingEasyBorder: '#22C55E',
    feelingEasyText: '#15803D',
    feelingEasyGradient: ['#DCFCE7', '#BBF7D0'] as [string, string],
    feelingMediumBg: '#FEF3C7',
    feelingMediumBorder: '#F59E0B',
    feelingMediumText: '#B45309',
    feelingMediumGradient: ['#FEF3C7', '#FDE68A'] as [string, string],
    feelingHardBg: '#FEE2E2',
    feelingHardBorder: '#EF4444',
    feelingHardText: '#B91C1C',
    feelingHardGradient: ['#FEE2E2', '#FECACA'] as [string, string],

    hairline: 'rgba(0, 41, 107, 0.07)',
    shadow: '#00296B',
    backdrop: 'rgba(0, 41, 107, 0.4)',
  },
  // Couleur signature par split (workoutId 1 = Push, 2 = Pull, 3 = Legs)
  splits: {
    1: { gradient: ['#FFD500', '#FDC500'] as [string, string], fg: '#00296B', tint: '#FFF4C2', ink: '#00296B', chipBg: 'rgba(255,255,255,0.55)', btnBg: '#00296B', btnFg: '#FFFFFF' },
    2: { gradient: ['#00509D', '#003F88'] as [string, string], fg: '#FFFFFF', tint: '#DCE8F5', ink: '#00509D', chipBg: 'rgba(255,255,255,0.16)', btnBg: '#FDC500', btnFg: '#00296B' },
    3: { gradient: ['#003F88', '#00296B'] as [string, string], fg: '#FFFFFF', tint: '#D9E1EF', ink: '#00296B', chipBg: 'rgba(255,255,255,0.16)', btnBg: '#FDC500', btnFg: '#00296B' },
  } as Record<number, { gradient: [string, string]; fg: string; tint: string; ink: string; chipBg: string; btnBg: string; btnFg: string }>,
  radius: { sheet: 28, hero: 28, card: 20, inner: 14, pill: 999 },
};

// Bascule active : il suffit de repointer sur THEME_SOFT_STRENGTH pour revenir en arrière instantanément !
export const THEME = THEME_BLUE_GOLD;
