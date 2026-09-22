import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

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

/**
 * Ouvre l'écran Android "Optimisation de la batterie" (liste de toutes les applis), pour que
 * l'utilisateur puisse mettre mooscles en "Sans restriction" lui-même. C'est un réglage Android
 * standard (pas spécifique à MIUI) qui met l'app en pause en veille profonde si on ne le fait
 * pas — indépendant du réglage "Autostart/Batterie" propre à MIUI qui existe en plus sur les
 * téléphones Xiaomi. Ne demande aucune permission particulière : on ne fait qu'ouvrir un écran
 * de réglages, l'utilisateur choisit lui-même.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    // Repli si l'action n'est pas supportée par ce téléphone/cette version d'Android
    try {
      await Linking.openSettings();
    } catch {
      // Rien à faire de plus : l'utilisateur peut toujours y aller manuellement
    }
  }
}

/**
 * Ouvre l'écran Android "Alarmes et rappels" pour que l'utilisateur autorise mooscles à
 * programmer des alarmes exactes. Sans cette autorisation (Android 12+), le système ne
 * refuse pas la notification programmée — il la retarde et la regroupe avec d'autres pour
 * économiser la batterie ("Doze"), ce qui donne exactement le symptôme observé : ça sonne
 * parfois hors écran, mais avec du retard, de façon irrégulière. Nécessite la permission
 * SCHEDULE_EXACT_ALARM déclarée dans app.json (permission normale, pas besoin d'accord
 * préalable de l'utilisateur pour la déclarer — seul l'usage réel demande son accord ici).
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      // Rien à faire de plus : l'utilisateur peut toujours y aller manuellement
    }
  }
}

// Filet de sécurité en arrière-plan : au lieu de continuer à essayer de rendre NOTRE
// notification fiable, on délègue directement à l'appli Horloge déjà installée sur le
// téléphone (celle-là même que l'utilisateur a testée et confirmée fiable), via l'action
// standard Android que n'importe quelle appli peut utiliser pour ça ("mets un minuteur pour
// moi"), sans permission particulière. On ne l'arme que pendant que mooscles est en
// arrière-plan (voir RestTimerOverlay), pour ne jamais dupliquer le son quand l'app est ouverte.
const SYSTEM_TIMER_SET_ACTION = 'android.intent.action.SET_TIMER';
const SYSTEM_TIMER_DISMISS_ACTION = 'android.intent.action.DISMISS_TIMER';

export async function armSystemBackupTimer(remainingSeconds: number, message: string): Promise<void> {
  if (Platform.OS !== 'android' || remainingSeconds <= 0) return;
  try {
    await Linking.sendIntent(SYSTEM_TIMER_SET_ACTION, [
      { key: 'android.intent.extra.alarm.LENGTH', value: Math.ceil(remainingSeconds) },
      { key: 'android.intent.extra.alarm.MESSAGE', value: message },
      { key: 'android.intent.extra.alarm.SKIP_UI', value: true },
    ]);
  } catch {
    // Pas grave : c'est un filet de sécurité en plus, pas le mécanisme principal
  }
}

export async function disarmSystemBackupTimer(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent(SYSTEM_TIMER_DISMISS_ACTION);
  } catch {
    // Sans conséquence
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
