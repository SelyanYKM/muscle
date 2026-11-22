import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

// Minuteur de repos fiable en arrière-plan (écran verrouillé, autre appli au premier plan) :
// une notification programmée via expo-notifications, la librairie officielle de l'équipe
// Expo (open source, maintenue directement par eux, déjà utilisée par la config EAS/Expo
// Update du projet). Elle passe elle-même par l'AlarmManager Android en interne — le même
// mécanisme que les réveils/minuteurs natifs — et choisit automatiquement une alarme exacte
// ou approximative selon ce que l'appareil autorise, sans permission supplémentaire à gérer.

// v3 (expérimental) : canal recréé avec un son, mais classé "Alarme" (AudioAttributes.USAGE_ALARM)
// plutôt que "Notification" — le même mécanisme que les réveils du téléphone, qui sonnent par-
// dessus la musique sans la mettre en pause. Un son classé "Notification" classique (testé avant,
// même sans focus audio demandé côté app) coupait la musique/vidéo en cours ; pas garanti que la
// catégorie "Alarme" s'en sorte mieux sur tous les appareils, mais c'est la seule piste qui imite
// un comportement déjà connu pour ne jamais couper la musique. Nouvel id car le son d'un canal est
// figé à la création (contrainte Android).
const CHANNEL_ID = 'rest-timer-alarm';
const NOTIFICATION_ID = 'rest-timer-alert';
const VIBRATION_PATTERN = [0, 400, 250, 400, 250, 400];
// Marge avant que l'alerte programmée (AlarmManager, précis à la seconde près) ne sonne vraiment :
// sans elle, elle tombe pile en même temps que le minuteur JS en appli (qui ne vérifie l'heure
// que toutes les 1000ms) — l'alarme gagne systématiquement la course et affiche sa bannière même
// quand l'appli tourne normalement et va l'annuler l'instant d'après, trop tard. Ce filet de
// secours ne doit sonner que si l'appli a vraiment perdu la main, jamais en doublon du cas normal.
const FALLBACK_GRACE_MS = 5000;

let isChannelConfigured = false;

// Comportement quand une notification arrive pendant que l'app est au premier plan : on la
// montre quand même (bannière + son), sinon expo-notifications la masque par défaut.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * À appeler une fois au démarrage de l'app : prépare le canal Android (son classé "Alarme",
 * vibration, affichage même en mode "Ne pas déranger"). Ne demande pas encore la permission.
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
      // Classe le son du canal "Alarme" plutôt que "Notification" : c'est ce qui permet aux
      // réveils du téléphone de sonner par-dessus la musique sans la couper.
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: { enforceAudibility: false, requestHardwareAudioVideoSynchronization: false },
      },
      bypassDnd: true,
    });
  } catch {
    // Mode dégradé si non supporté
  }
}

/**
 * Déclenche immédiatement l'alerte de fin de repos (son classé "Alarme" + vibration), pour le cas
 * normal où l'appli est toujours active au moment où le repos se termine — contrairement à
 * `startRestTimerService`, qui programme seulement le filet de secours en arrière-plan.
 */
export async function fireRestEndAlarm(body: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Repos terminé 💪',
        body,
        sound: true,
        vibrate: VIBRATION_PATTERN,
        priority: 'high',
      },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch {
    // Mode dégradé : la vibration haptique (déclenchée séparément) prend le relais
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
        sound: true,
        vibrate: VIBRATION_PATTERN,
        priority: 'high',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endTimeMs + FALLBACK_GRACE_MS,
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

export async function stopRestTimerService(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Déjà annulée/déclenchée : sans conséquence
  }
}
