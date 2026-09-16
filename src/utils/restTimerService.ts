import notifee, {
  AlarmType,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

// Minuteur de repos fiable en arrière-plan (écran verrouillé, autre appli au premier plan) :
// une notification programmée via l'AlarmManager Android (le même mécanisme que les
// réveils/minuteurs natifs), qui résiste au mode économie de batterie bien mieux que le
// simple WorkManager utilisé par défaut. On n'utilise PAS de "service au premier plan" ici :
// ce mécanisme est bloqué/instable sur certains téléphones (Xiaomi/MIUI notamment) et faisait
// planter l'app au démarrage du repos — une notification programmée classique est plus lente à
// déclencher qu'un vrai service actif, mais ne peut pas planter l'app de cette façon.

const CHANNEL_ID = 'rest-timer';
const NOTIFICATION_ID = 'rest-timer-alert';
const VIBRATION_PATTERN = [0, 400, 250, 400, 250, 400];

let isChannelConfigured = false;

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
 * accordée/refusée. Retourne true si on peut programmer l'alerte du minuteur.
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
 * Programme la notification de fin de repos pour l'instant `endTimeMs`. Retourne
 * l'identifiant de la notification (pour pouvoir l'annuler/la replanifier) ou null.
 */
export async function startRestTimerService(endTimeMs: number, body: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  try {
    await notifee.createTriggerNotification(
      {
        id: NOTIFICATION_ID,
        title: 'Repos terminé 💪',
        body,
        android: {
          channelId: CHANNEL_ID,
          pressAction: { id: 'default' },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: endTimeMs,
        // "AND_ALLOW_WHILE_IDLE" (non exact) plutôt que la variante "EXACT" : cette dernière
        // demande une permission spéciale (SCHEDULE_EXACT_ALARM) sur Android 12+, pas
        // indispensable pour un minuteur de repos (quelques secondes de marge sont acceptables).
        alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE },
      }
    );
    return NOTIFICATION_ID;
  } catch {
    // Mode dégradé : le minuteur reste utilisable au premier plan, juste moins robuste
    // une fois l'app quittée.
    return null;
  }
}

export async function stopRestTimerService(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await notifee.cancelTriggerNotification(NOTIFICATION_ID);
  } catch {
    // Déjà annulée/déclenchée : sans conséquence
  }
}
