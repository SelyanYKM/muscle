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
 * THÈME 2 : Athletic Ethos: Soft Strength (Nouveau moodboard "soft Power")
 * - Fonds doux crème & pêche évanescents (#FBF8F5 / #FEEBF6)
 * - Typographie Duo : Serif affirmé (Editorial / Petrona) pour les titres et Sans-Serif géométrique (Manrope) pour la data
 * - Focus Card Violette (#C080E0) et Rest Blue (#8FB9D0) pour le minuteur
 * - Gros boutons de validation aux teintes pastel douces (#90EE90, #FFDAB9, #FF7F7F)
 * - Textes en noir profond Deep Carbon (#1C1C1E)
 */
export const THEME_SOFT_STRENGTH = {
  id: 'SOFT_STRENGTH' as const,
  name: 'Athletic Ethos: Soft Strength',
  statusBarStyle: 'dark' as const,
  fonts: {
    serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
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

    // Accents du moodboard
    accent: '#FF8C70',          // Performance Peach tonique
    accentMuted: 'rgba(255, 140, 112, 0.16)',
    accentTextDark: '#FFFFFF',

    // Focus Card & Rest Timer
    focusCardBg: '#C080E0',     // Focus Violet immersif
    focusCardBorder: '#AE6FD0',
    restOverlayBg: '#8FB9D0',   // Rest Blue ciel apaisant

    // Badges
    badgeBg: '#F0EAD6',         // Lin / Maille naturelle
    badgeText: '#635B4E',
    finisherBadgeBg: '#FDE8E5',
    finisherBadgeText: '#D94D3B',

    // États de validation (Couleurs olympiques adoucies)
    feelingEasyBg: '#90EE90',   // Vert pastel doux
    feelingEasyBorder: '#76D876',
    feelingEasyText: '#154722',

    feelingMediumBg: '#FFDAB9', // Pêche moyen
    feelingMediumBorder: '#F2BE94',
    feelingMediumText: '#6A3705',

    feelingHardBg: '#FF7F7F',   // Corail / Rose fail
    feelingHardBorder: '#ED6363',
    feelingHardText: '#681313',
  },
};

// Bascule active : il suffit de pointer sur THEME_SPORTIFY_DARK pour revenir en arrière instantanément !
export const THEME = THEME_SOFT_STRENGTH;
