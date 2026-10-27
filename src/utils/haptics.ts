import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function triggerLightHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export function triggerMediumHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

export function triggerSuccessHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export const triggerNotificationSuccessHaptic = triggerSuccessHaptic;

export function triggerWarningHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

/**
 * Séquence haptique complète du power-up "buff requin" (voir design_handoff_buff_requin/README.md) :
 * élan léger, impact lourd + succès au flash blanc, puis un coup rigide par mot du bandeau texte.
 */
export function triggerBuffRequinHaptics() {
  if (Platform.OS === 'web') return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 450);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 470);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), 820);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), 900);
  } catch {}
}

export function triggerTimerEndHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 200);
  } catch {}
}
