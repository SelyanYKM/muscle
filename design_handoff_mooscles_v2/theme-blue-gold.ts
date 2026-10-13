/**
 * THÈME 3 : Blue & Gold (refonte v2) — à coller dans src/theme/index.ts
 * Même structure de clés que THEME_SOFT_STRENGTH pour rester compatible,
 * + un bloc `splits` (couleur signature par séance) et `radius`.
 * Puis : export const THEME = THEME_BLUE_GOLD;
 */
export const THEME_BLUE_GOLD = {
  id: 'BLUE_GOLD' as const,
  name: 'Blue & Gold',
  statusBarStyle: 'dark' as const,
  fonts: {
    serif: 'Petrona_600SemiBold',
    sans: 'Manrope_700Bold',
    // À charger en plus dans App.tsx (useFonts) : Manrope_500Medium, Manrope_600SemiBold, Manrope_800ExtraBold
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

    // Dégradé de fond (noms de clés conservés pour compatibilité)
    bgGradientPeach: '#D3E0F2', // haut-gauche (bleu brume)
    bgGradientPink: '#F5F7FB',  // milieu
    bgGradientSand: '#FFF2BF',  // bas-droite (or pâle)

    textPrimary: '#00296B',   // Imperial Blue
    textSecondary: '#55617A',
    textMuted: '#8A93A6',     // décoratif uniquement (contraste < 4.5)
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

    // Carte de série (piste B uniquement)
    seriesCardFrom: '#00296B',
    seriesCardMid: '#003F88',
    seriesCardTo: '#00509D',

    badgeBg: '#EEF2F8',
    badgeText: '#3A4A66',
    finisherBadgeBg: '#FFF1B8',
    finisherBadgeText: '#00296B',

    // Ressentis — inchangés (sémantique)
    feelingEasyBg: '#DCF0D4',
    feelingEasyBorder: '#C3E4C0',
    feelingEasyText: '#2C5A35',
    feelingEasyGradient: ['#DCF0D4', '#C3E4C0'] as [string, string],
    feelingMediumBg: '#FFEBD6',
    feelingMediumBorder: '#FFDCC0',
    feelingMediumText: '#8A5321',
    feelingMediumGradient: ['#FFEBD6', '#FFDCC0'] as [string, string],
    feelingHardBg: '#FBD9DC',
    feelingHardBorder: '#F6C3C8',
    feelingHardText: '#96404A',
    feelingHardGradient: ['#FBD9DC', '#F6C3C8'] as [string, string],

    hairline: 'rgba(0, 41, 107, 0.07)',
    shadow: '#00296B',
    backdrop: 'rgba(0, 41, 107, 0.4)',
  },
  // Couleur signature par split (workoutId 1/2/3)
  splits: {
    1: { gradient: ['#FFD500', '#FDC500'] as [string, string], fg: '#00296B', tint: '#FFF4C2', ink: '#00296B', chipBg: 'rgba(255,255,255,0.55)', btnBg: '#00296B', btnFg: '#FFFFFF' },
    2: { gradient: ['#00509D', '#003F88'] as [string, string], fg: '#FFFFFF', tint: '#DCE8F5', ink: '#00509D', chipBg: 'rgba(255,255,255,0.16)', btnBg: '#FDC500', btnFg: '#00296B' },
    3: { gradient: ['#003F88', '#00296B'] as [string, string], fg: '#FFFFFF', tint: '#D9E1EF', ink: '#00296B', chipBg: 'rgba(255,255,255,0.16)', btnBg: '#FDC500', btnFg: '#00296B' },
  } as Record<number, { gradient: [string, string]; fg: string; tint: string; ink: string; chipBg: string; btnBg: string; btnFg: string }>,
  radius: { sheet: 28, hero: 28, card: 20, inner: 14, pill: 999 },
};
