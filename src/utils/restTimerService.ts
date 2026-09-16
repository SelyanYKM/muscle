import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Minuteur de repos fiable en arrière-plan (écran verrouillé, autre appli au premier plan) :
// une notification programmée via expo-notifications, la librairie officielle de l'équipe
// Expo (open source, maintenue directement par eux, déjà utilisée par la config EAS/Expo
// Update du projet). Elle passe elle-même par l'AlarmManager Android en interne — le même
// mécanisme que les réveils/minuteurs natifs — et choisit automatiquement une alarme exacte
// ou approximative selon ce que l'appareil autorise, sans permission supplémentaire à gérer.

const CHANNEL_ID = 'rest-timer';
const NOTIFICATION_ID = 'rest-timer-alert';
const VIBRATION_PATTERN = [0, 400, 250, 400, 250, 400];

let isChannelConfigured = false;

// Comportement quand une notification arrive pendant que l'app est au premier plan :
// on la montre quand même (banniere + son), sinon expo-notifications la masque par défaut.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * À appeler une fois au démarrage de l'app : prépare le canal Android (son, vibration,
 * affichage même en mode "Ne pas déranger"). Ne demande pas encore la permission.
 */
export async function configureRestTimerChannel(): Promise<void> {
  if (Platform.OS !== 'android' || isChannelConfigured) return;
  isChannelConfigured = true;

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Minuteur de repos',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: VIBRATION_PATTERN,
      enableVibrate: true,
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
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
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
    // On annule d'abord toute alerte déjà programmée pour éviter d'avoir deux notifications
    // en attente (par ex. quand on ajoute du temps avec +30s/+60s en cours de repos).
    await stopRestTimerService();

    const id = await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'Repos terminé 💪',
        body,
        sound: 'default',
        vibrate: VIBRATION_PATTERN,
        priority: 'high',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endTimeMs,
        channelId: CHANNEL_ID,
      },
    });
    return id;
  } catch {
    // Mode dégradé : le minuteur reste utilisable au premier plan, juste moins robuste
    // une fois l'app quittée.
    return null;
  }
}

export async function stopRestTimerService(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Déjà annulée/déclenchée : sans conséquence
  }
}
