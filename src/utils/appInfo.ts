import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Version affichée dans l'Historique, pour vérifier qu'une mise à jour OTA a bien été appliquée
// sans avoir à regarder les logs de build. Deux informations distinctes :
// - la version native (app.json, ne bouge qu'à un nouveau build EAS) ;
// - la date de la mise à jour OTA actuellement chargée (expo-updates, bouge à chaque publication).
export interface AppInfo {
  version: string;
  updatePublishedAt: Date | null;
  /** Build natif tel quel, sans mise à jour OTA appliquée par-dessus (ou web, où ça ne s'applique pas). */
  isEmbedded: boolean;
}

export function getAppInfo(): AppInfo {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '?';

  if (Platform.OS === 'web') {
    return { version, updatePublishedAt: null, isEmbedded: true };
  }

  try {
    // Chargement dynamique : son module natif peut manquer selon le client de build, jamais
    // bloquer l'affichage de l'écran pour autant (voir le filet de secours ci-dessous).
    const Updates = require('expo-updates');
    return {
      version,
      updatePublishedAt: Updates.createdAt ?? null,
      isEmbedded: !!Updates.isEmbeddedLaunch,
    };
  } catch {
    return { version, updatePublishedAt: null, isEmbedded: true };
  }
}

export function formatAppInfoLine(info: AppInfo): string {
  if (info.isEmbedded || !info.updatePublishedAt) {
    return `mooscles ${info.version} · build embarqué (aucune mise à jour OTA appliquée)`;
  }
  const date = info.updatePublishedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const time = info.updatePublishedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `mooscles ${info.version} · mise à jour du ${date} à ${time}`;
}
