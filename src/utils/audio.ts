import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

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
    const player = createAudioPlayer('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
    player.play();

    // Arrêt et libération automatique après 2 secondes
    setTimeout(() => {
      try {
        player.pause();
        player.release();
      } catch {}
    }, 2000);
  } catch {
    // Fallback silencieux (vibrations haptiques prennent le relais)
  }
}
