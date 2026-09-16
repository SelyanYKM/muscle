import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Notification programmée pour l'alarme de fin de repos : contrairement au son/vibration
// déclenchés depuis le code JS, elle est gérée par le système d'exploitation et se déclenche
// donc même si l'app est en arrière-plan (écran verrouillé, autre appli au premier plan).
const REST_CHANNEL_ID = 'rest-timer';
const REST_VIBRATION_PATTERN = [0, 400, 250, 400, 250, 400];

let isHandlerConfigured = false;

/**
 * À appeler une fois au démarrage de l'app : prépare le canal Android et le comportement
 * d'affichage. Ne demande pas encore la permission (elle est demandée plus tard, au moment
 * où l'utilisateur lance vraiment un repos, pour que la demande ait un contexte clair).
 */
export async function configureNotifications(): Promise<void> {
  if (Platform.OS === 'web' || isHandlerConfigured) return;
  isHandlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
        name: 'Fin de repos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: REST_VIBRATION_PATTERN,
        enableVibrate: true,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {
      // Mode dégradé si non supporté
    }
  }
}

/**
 * Programme la notification de fin de repos dans `secondsFromNow` secondes.
 * Demande la permission si elle n'a pas encore été accordée/refusée.
 * Retourne l'identifiant de la notification (pour pouvoir l'annuler) ou null si impossible.
 */
export async function scheduleRestEndNotification(
  secondsFromNow: number,
  body: string
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Repos terminé 💪',
        body,
        sound: 'default',
        vibrate: REST_VIBRATION_PATTERN,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsFromNow)),
        channelId: REST_CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRestEndNotification(id: string | null): Promise<void> {
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Déjà déclenchée ou déjà annulée : sans conséquence
  }
}
