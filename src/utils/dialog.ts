// Boîtes de dialogue de l'app, affichées en feuille basse (DialogHost) au lieu des alertes
// système grises d'Android. Même appel qu'Alert.alert(titre, message, boutons), utilisable
// partout, y compris hors composant (export, sauvegarde, photo).
import { Alert } from 'react-native';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogRequest {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

type DialogListener = (request: DialogRequest) => void;

let listener: DialogListener | null = null;

/** Branche l'hôte d'affichage (DialogHost, monté une fois à la racine de l'app). */
export function registerDialogHost(l: DialogListener): () => void {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  const request: DialogRequest = { title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }] };
  // Avant que l'hôte soit monté (chargement de l'app), on ne perd pas le message : alerte système.
  if (!listener) {
    Alert.alert(request.title, request.message, request.buttons);
    return;
  }
  listener(request);
}
