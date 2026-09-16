import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';

// Minuteur de repos fiable en arrière-plan (écran verrouillé, autre appli au premier plan) :
// un vrai service Android "au premier plan" avec une notification persistante affichant un
// décompte natif — exactement le mécanisme qu'utilise l'appli Horloge/Minuteur du téléphone.
// Ça garde l'app active pendant tout le repos, donc l'alarme sonore/vibrante déclenchée par
// RestTimerOverlay se déclenche fiablement même écran éteint. (Une notification programmée
// classique, moins intrusive, a été essayée avant mais ne se déclenchait pas de façon fiable
// une fois l'app quittée sur certains téléphones.)

const CHANNEL_ID = 'rest-timer';
const NOTIFICATION_ID = 'rest-timer-service';
const VIBRATION_PATTERN = [0, 400, 250, 400, 250, 400];

let isChannelConfigured = false;
let stopServiceResolver: (() => void) | null = null;

// Doit être enregistré une seule fois, tôt dans le cycle de vie de l'app (voir index.ts) —
// c'est ce handler qu'Android relance tant que le service au premier plan est actif.
if (Platform.OS === 'android') {
  notifee.registerForegroundService(
    () =>
      new Promise<void>((resolve) => {
        stopServiceResolver = resolve;
      })
  );
}

/**
 * À appeler une fois au démarrage de l'app : prépare le canal Android (son, vibration,
 * affichage même en mode "Ne pas déranger"). Ne demande pas encore la permission.
 */
export async function configureRestTimerChannel(): Promise<void> {
  if (Platform.OS !== 'android' || isChannelConfigured) return;
  isChannelConfigured = true;

  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Minuteur de repos',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibration: true,
      vibrationPattern: VIBRATION_PATTERN,
      sound: 'default',
      bypassDnd: true,
    });
  } catch {
    // Mode dégradé si non supporté
  }
}

/**
 * Demande la permission d'afficher des notifications si elle n'a pas encore été
 * accordée/refusée. Retourne true si on peut afficher la notification du minuteur.
 */
export async function requestRestTimerPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch {
    return false;
  }
}

/**
 * Démarre le service au premier plan avec une notification persistante affichant un
 * décompte natif jusqu'à `endTimeMs`.
 */
export async function startRestTimerService(endTimeMs: number, body: string): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'Repos en cours',
      body,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        showChronometer: true,
        chronometerDirection: 'down',
        timestamp: endTimeMs,
        pressAction: { id: 'default' },
      },
    });
  } catch {
    // Mode dégradé : le minuteur reste utilisable au premier plan, juste moins robuste
    // une fois l'app quittée.
  }
}

/**
 * Arrête le service au premier plan et retire la notification persistante. À appeler à
 * chaque fin de repos (naturelle, "Passer", ou correction de la dernière série).
 */
export async function stopRestTimerService(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    if (stopServiceResolver) {
      stopServiceResolver();
      stopServiceResolver = null;
    }
    await notifee.stopForegroundService();
    await notifee.cancelNotification(NOTIFICATION_ID);
  } catch {
    // Déjà arrêté : sans conséquence
  }
}
