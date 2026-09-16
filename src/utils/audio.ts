import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

// Son embarqué dans l'app : aucune connexion réseau requise (contrairement à une URL distante),
// donc l'alarme fonctionne même sans wifi/4G en salle de sport.
const REST_TIMER_ALARM_SOUND = require('../../assets/sounds/rest_timer_alarm.wav');

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
