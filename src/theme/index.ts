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
    serif: 'Petrona_700Bold',
    sans: 'Manrope_800ExtraBold',
  },
  colors: {
    // Fonds & Cartes douces texturées "peluche"
    bg: '#FAF5F0',              // Fond crème chaleureux
    cardBg: '#FFFFFF',          // Blanc pur pour effet coussin tactile
    cardBorder: '#EFE7E0',      // Bordure douce et discrète
    cardInner: '#F5ECE5',       // Surfaces intérieures tièdes
    cardFinisherBg: '#FDF2F0',
    cardFinisherBorder: '#FBCBC5',

    // Typographie Deep Carbon & Muted
    textPrimary: '#1C1C1E',     // Noir mat profond
    textSecondary: '#6B6875',   // Gris ardoise chaleureux
    textMuted: '#9E9AA7',       // Légendes adoucies

    // Accents du moodboard — terracotta doux (remplace l'orange vif d'origine)
    accent: '#E28B72',
    accentMuted: 'rgba(226, 139, 114, 0.16)',
    accentTextDark: '#FFFFFF',

    // Focus Card & Rest Timer — violet/bleu, inchangés
    focusCardBg: '#C080E0',     // Focus Violet immersif
    focusCardBorder: '#AE6FD0',
    restOverlayBg: '#8FB9D0',   // Rest Blue ciel apaisant

    // Badges
    badgeBg: '#F0EAD6',         // Lin / Maille naturelle
    badgeText: '#635B4E',
    finisherBadgeBg: '#FDE8E5',
    finisherBadgeText: '#D94D3B',

    // États de validation — pastel, distincts de l'accent terracotta
    feelingEasyBg: '#DCF0D4',   // Vert amande
    feelingEasyBorder: '#C3E4C0',
    feelingEasyText: '#2C5A35',

    feelingMediumBg: '#FFEBD6', // Pêche clair
    feelingMediumBorder: '#FFDCC0',
    feelingMediumText: '#8A5321',

    feelingHardBg: '#FBD9DC',   // Rose poudré
    feelingHardBorder: '#F6C3C8',
    feelingHardText: '#96404A',
  },
};

// Bascule active : il suffit de pointer sur THEME_SPORTIFY_DARK pour revenir en arrière instantanément !
export const THEME = THEME_SOFT_STRENGTH;
