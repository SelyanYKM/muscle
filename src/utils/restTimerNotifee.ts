import { DeviceEventEmitter, Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidForegroundServiceType,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  Event,
  EventType,
} from 'react-native-notify-kit';
import { THEME } from '../theme';
import { fmtKg } from './format';

// Notification de repos "vivante" : contrairement à l'alerte unique programmée dans
// restTimerService.ts (qui ne sonne qu'UNE fois, à la fin), celle-ci reste affichée tout le
// repos, avec un vrai décompte natif Android (chronomètre) et des boutons Pause/Passer qui
// agissent réellement sur le minuteur de l'app — via un Foreground Service, le même mécanisme
// qu'utilisent les apps de musique pour rester actives en arrière-plan.

const CHANNEL_ID = 'rest-timer-live';
const NOTIFICATION_ID = 'rest-timer-live';
const FOREGROUND_SERVICE_TYPES = [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE];

export const ACTION_PAUSE = 'rest-timer-pause';
export const ACTION_RESUME = 'rest-timer-resume';
export const ACTION_SKIP = 'rest-timer-skip';

/** Nom de l'événement DeviceEventEmitter utilisé pour relayer un appui sur un bouton de la
 * notification (Pause/Reprendre/Passer) vers le composant RestTimerOverlay actif. */
export const REST_TIMER_ACTION_EVENT = 'mooscles:rest-timer-action';

let isChannelConfigured = false;
let isForegroundServiceRegistered = false;

interface SetInfo {
  exerciseName: string;
  nextSetNumber: number;
  nextWeight: number;
  nextReps: number;
}

function buildBody({ exerciseName, nextSetNumber, nextWeight, nextReps }: SetInfo): { title: string; body: string } {
  return {
    title: `Repos — ${exerciseName}`,
    body: `Série ${nextSetNumber} · ${fmtKg(nextWeight)} kg × ${nextReps} reps`,
  };
}

/** À appeler une fois au démarrage de l'app : prépare le canal Android dédié. */
export async function configureRestTimerLiveChannel(): Promise<void> {
  if (Platform.OS !== 'android' || isChannelConfigured) return;
  isChannelConfigured = true;

  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Repos en cours',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
    });
  } catch {
    // Mode dégradé si non supporté
  }
}

/** Demande la permission notifee (même permission système que expo-notifications ; si déjà
 * accordée via l'autre lib, celle-ci la retrouve directement accordée, sans re-demander). */
export async function requestRestTimerLivePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
  } catch {
    return false;
  }
}

/** À appeler une seule fois, au tout début de l'app (index.ts) : requis par notifee pour
 * garder le service actif tant qu'on ne demande pas explicitement de l'arrêter. */
export function registerRestTimerForegroundService(): void {
  if (Platform.OS !== 'android' || isForegroundServiceRegistered) return;
  isForegroundServiceRegistered = true;
  notifee.registerForegroundService(() => new Promise<void>(() => {}));
}

/** Relaie un événement notifee (pression sur Pause/Reprendre/Passer) vers l'app via
 * DeviceEventEmitter — utilisable aussi bien depuis onForegroundEvent (app ouverte) que
 * onBackgroundEvent (app en arrière-plan), les deux pointent vers cette même fonction. */
export function relayRestTimerNotifeeEvent(event: Event): void {
  if (event.type !== EventType.ACTION_PRESS) return;
  const actionId = event.detail.pressAction?.id;
  if (actionId === ACTION_PAUSE || actionId === ACTION_RESUME || actionId === ACTION_SKIP) {
    DeviceEventEmitter.emit(REST_TIMER_ACTION_EVENT, actionId);
  }
}

/** Affiche/replace la notification en cours de décompte (chronomètre natif qui tourne tout
 * seul, aucune mise à jour JS nécessaire tant qu'on ne modifie pas le temps restant). */
export async function showRestTimerRunningNotification(endTimeMs: number, info: SetInfo): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { title, body } = buildBody(info);
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title,
      body,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: FOREGROUND_SERVICE_TYPES,
        ongoing: true,
        category: AndroidCategory.PROGRESS,
        color: THEME.colors.accent,
        visibility: AndroidVisibility.PUBLIC,
        showChronometer: true,
        chronometerDirection: 'down',
        timestamp: endTimeMs,
        actions: [
          { title: 'Pause', pressAction: { id: ACTION_PAUSE } },
          { title: 'Passer', pressAction: { id: ACTION_SKIP } },
        ],
      },
    });
  } catch {
    // Mode dégradé : le repos reste utilisable au premier plan, juste sans notification live
  }
}

/** Affiche la notification en mode "en pause" : plus de chronomètre (texte statique), bouton
 * Pause remplacé par Reprendre. */
export async function showRestTimerPausedNotification(remainingSeconds: number, info: SetInfo): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { title, body } = buildBody(info);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: `${title} — en pause`,
      body: `${formatted} restant · ${body}`,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: FOREGROUND_SERVICE_TYPES,
        ongoing: true,
        category: AndroidCategory.PROGRESS,
        color: THEME.colors.accent,
        visibility: AndroidVisibility.PUBLIC,
        showChronometer: false,
        actions: [
          { title: 'Reprendre', pressAction: { id: ACTION_RESUME } },
          { title: 'Passer', pressAction: { id: ACTION_SKIP } },
        ],
      },
    });
  } catch {
    // Mode dégradé
  }
}

export async function hideRestTimerLiveNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.stopForegroundService();
  } catch {
    // Déjà arrêté : sans conséquence
  }
}
