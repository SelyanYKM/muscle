/**
 * Design System "Sportify Athletic Dark" pour mooscles
 * Inspiré des meilleures applications sportives modernes (Nike Training, Whoop, Strong, Apple Fitness) :
 * - Noir profond mat & surfaces charbon épurées
 * - Bordures ultra-fines non intrusives
 * - Typographie blanche à fort contraste
 * - Une seule touche d'accent dynamique "Electric Volt" (#CCFF00) utilisée avec parcimonie
 */
export const THEME = {
  name: 'mooscles',
  colors: {
    // Fond & Surfaces
    bg: '#09090B',            // Noir profond (OLED)
    cardBg: '#131317',        // Surface de carte charbon
    cardBorder: '#23232B',    // Bordure discrète
    cardInner: '#1C1C24',     // Éléments interactifs internes / steppers
    cardFinisherBg: '#161317',
    cardFinisherBorder: '#381C24',

    // Textes & Typographie
    textPrimary: '#FFFFFF',
    textSecondary: '#8E8E9F',
    textMuted: '#525262',

    // Accent Sportif Dynamique (Volt / Neon Lime)
    accent: '#CCFF00',
    accentMuted: 'rgba(204, 255, 0, 0.12)',
    accentTextDark: '#09090B',

    // Badges neutres
    badgeBg: '#1F1F27',
    badgeText: '#A1A1B2',
    finisherBadgeBg: '#2A171B',
    finisherBadgeText: '#F87171',

    // États de ressenti sobres
    feelingEasyBg: '#0D241B',
    feelingEasyBorder: '#10B981',
    feelingMediumBg: '#26180C',
    feelingMediumBorder: '#F59E0B',
    feelingHardBg: '#281014',
    feelingHardBorder: '#EF4444',
  },
};
