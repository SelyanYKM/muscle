import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

// Son embarqué dans l'app : aucune connexion réseau requise (contrairement à une URL distante),
// donc l'alarme fonctionne même sans wifi/4G en salle de sport.
const REST_TIMER_ALARM_SOUND = require('../../assets/sounds/rest_timer_alarm.wav');

const BUFF_SOUNDS = {
  rise: require('../../assets/sounds/buff_rise.wav'),
  impact: require('../../assets/sounds/buff_impact.wav'),
  shimmer: require('../../assets/sounds/buff_shimmer.wav'),
};

let buffPlayers: Record<keyof typeof BUFF_SOUNDS, AudioPlayer> | null = null;

let isAudioConfigured = false;

/**
 * Configure la session audio pour :
 * 1. Ne PAS couper ou baisser la musique (Spotify, Apple Music).
 * 2. Jouer le bip d'alerte par-dessus la musique (mixWithOthers).
 */
export async function configureAppAudio(): Promise<void> {
  if (isAudioConfigured || Platform.OS === 'web') return;

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    isAudioConfigured = true;
  } catch (error) {
    // Mode dégradé si non supporté
  }
}

/**
 * Joue une tonalité sportive d'alerte de fin de repos.
 */
export async function playRestTimerAlarm(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await configureAppAudio();
    const player = createAudioPlayer(REST_TIMER_ALARM_SOUND);
    player.play();

    // Libération automatique après 2 secondes (le son dure ~0.7s)
    setTimeout(() => {
      try {
        player.remove();
      } catch {}
    }, 2000);
  } catch {
    // Fallback silencieux (vibrations haptiques prennent le relais)
  }
}

/**
 * Précharge les 3 sons du power-up "buff requin" (montée, impact, scintillement) pour que le
 * premier déclenchement n'ait pas de latence de décodage — à appeler une fois au montage de
 * l'écran de séance.
 */
export function preloadBuffRequinSounds(): void {
  if (Platform.OS === 'web' || buffPlayers) return;
  try {
    buffPlayers = {
      rise: createAudioPlayer(BUFF_SOUNDS.rise),
      impact: createAudioPlayer(BUFF_SOUNDS.impact),
      shimmer: createAudioPlayer(BUFF_SOUNDS.shimmer),
    };
  } catch {
    buffPlayers = null;
  }
}

/**
 * Joue les 3 sons du power-up aux offsets du design handoff (0 / 450 / 820 ms), sur les
 * lecteurs préchargés par `preloadBuffRequinSounds`.
 */
export async function playBuffRequinSounds(): Promise<void> {
  if (Platform.OS === 'web' || !buffPlayers) return;
  try {
    await configureAppAudio();
    const play = (p: AudioPlayer) => {
      try {
        p.seekTo(0).finally(() => p.play());
      } catch {}
    };
    play(buffPlayers.rise);
    setTimeout(() => buffPlayers && play(buffPlayers.impact), 450);
    setTimeout(() => buffPlayers && play(buffPlayers.shimmer), 820);
  } catch {
    // Fallback silencieux (le flash/haptique restent)
  }
}
