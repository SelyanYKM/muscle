import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

let isAudioConfigured = false;

/**
 * Configure la session audio pour :
 * 1. Ne PAS baisser/étouffer le son de la musique en arrière-plan (Spotify, Apple Music).
 * 2. Permettre la lecture des bips d'alerte par-dessus la musique.
 */
export async function configureAppAudio(): Promise<void> {
  if (isAudioConfigured || Platform.OS === 'web') return;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: false, // Empêche d'étouffer le volume de Spotify
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });
    isAudioConfigured = true;
  } catch (error) {
    console.warn('Erreur configuration audio:', error);
  }
}

/**
 * Joue une séquence sonore sportive d'alerte de fin de repos (3 tonalités claires).
 */
export async function playRestTimerAlarm(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await configureAppAudio();
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
      { shouldPlay: true, volume: 1.0 }
    );

    // Arrêt automatique après 2 secondes pour ne pas déranger
    setTimeout(async () => {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {}
    }, 2000);
  } catch {
    // Audio fallback
  }
}
