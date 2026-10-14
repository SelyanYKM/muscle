import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { buildFullBackup, FullBackup, restoreFullBackup } from '../database/db';

/**
 * Génère une sauvegarde JSON complète (catalogue, historique, progression, ressentis, poids de
 * corps) et ouvre la fenêtre de partage native — l'utilisateur choisit où l'envoyer (Drive,
 * email, Fichiers...), l'app ne sait rien de la destination.
 */
export async function exportBackupFile(): Promise<void> {
  try {
    const backup = buildFullBackup();
    const json = JSON.stringify(backup, null, 2);
    const file = new File(Paths.cache, `mooscles-sauvegarde-${Date.now()}.json`);
    file.create({ overwrite: true });
    file.write(json);

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Partage indisponible', "Le partage de fichiers n'est pas disponible sur cet appareil.");
      return;
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Sauvegarder mes données mooscles',
    });
  } catch (error) {
    console.error('Erreur exportBackupFile:', error);
    Alert.alert('Erreur', "La sauvegarde a échoué. Réessaie dans un instant.");
  }
}

export type ImportBackupOutcome = 'restored' | 'canceled' | 'invalid' | 'error';

/**
 * Ouvre le sélecteur de fichiers, lit le JSON choisi et restaure la base à partir de son
 * contenu. L'appelant doit avoir fait confirmer l'utilisateur AVANT d'appeler cette fonction
 * (opération destructive : remplace les données actuelles).
 */
export async function importBackupFile(): Promise<ImportBackupOutcome> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled || result.assets.length === 0) return 'canceled';

    const picked = new File(result.assets[0].uri);
    const text = await picked.text();
    const backup = JSON.parse(text) as FullBackup;

    if (!backup || typeof backup !== 'object' || !backup.tables) {
      Alert.alert('Fichier invalide', "Ce fichier ne ressemble pas à une sauvegarde mooscles.");
      return 'invalid';
    }

    const outcome = restoreFullBackup(backup);
    if (!outcome.ok) {
      Alert.alert('Échec de la restauration', outcome.error || "Une erreur inconnue s'est produite.");
      return 'error';
    }

    return 'restored';
  } catch (error) {
    console.error('Erreur importBackupFile:', error);
    Alert.alert('Erreur', "La lecture du fichier a échoué. Vérifie qu'il s'agit bien d'une sauvegarde mooscles.");
    return 'error';
  }
}
