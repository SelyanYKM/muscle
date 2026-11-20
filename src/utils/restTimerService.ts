import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

// Minuteur de repos fiable en arrière-plan (écran verrouillé, autre appli au premier plan) :
// une notification programmée via expo-notifications, la librairie officielle de l'équipe
// Expo (open source, maintenue directement par eux, déjà utilisée par la config EAS/Expo
// Update du projet). Elle passe elle-même par l'AlarmManager Android en interne — le même
// mécanisme que les réveils/minuteurs natifs — et choisit automatiquement une alarme exacte
// ou approximative selon ce que l'appareil autorise, sans permission supplémentaire à gérer.

// v2 : le son du canal est fixé à la création et ne peut plus être changé ensuite (contrainte
// Android) — change d'id pour que les installs déjà en place (canal 'rest-timer', son activé)
// récupèrent un vrai canal silencieux plutôt que l'ancien, inchangeable, qui coupait la musique.
const CHANNEL_ID = 'rest-timer-v2';
const NOTIFICATION_ID = 'rest-timer-alert';
const VIBRATION_PATTERN = [0, 400, 250, 400, 250, 400];
// Marge avant que l'alerte programmée (AlarmManager, précis à la seconde près) ne sonne vraiment :
// sans elle, elle tombe pile en même temps que le minuteur JS en appli (qui ne vérifie l'heure
// que toutes les 1000ms) — l'alarme gagne systématiquement la course et affiche sa bannière même
// quand l'appli tourne normalement et va l'annuler l'instant d'après, trop tard. Ce filet de
// secours ne doit sonner que si l'appli a vraiment perdu la main, jamais en doublon du cas normal.
const FALLBACK_GRACE_MS = 5000;

let isChannelConfigured = false;

// Comportement quand une notification arrive pendant que l'app est au premier plan :
// on la montre quand même (bannière), sinon expo-notifications la masque par défaut. Jamais de
// son ici : le vrai bip de fin de repos est le son interne (playRestTimerAlarm, utils/audio.ts),
// configuré pour ne jamais couper la musique en cours. Le son natif d'une notification Android
// passe par un tout autre circuit audio et coupe/baisse la musique, même configuré ailleurs.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
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
      // Pas de son de notification : il coupe/baisse la musique en cours (circuit audio séparé
      // de expo-audio, voir playRestTimerAlarm). La vibration + le bip interne suffisent.
      sound: null,
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
        // Pas de son ici non plus (voir configureRestTimerChannel) : sur Android 8+ c'est de
        // toute façon le canal qui décide, mais iOS lit ce champ directement.
        sound: false,
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
