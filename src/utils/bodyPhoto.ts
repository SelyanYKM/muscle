import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

// Sous-dossier du répertoire document (persistant, jamais nettoyé par l'OS contrairement au
// cache) où vivent les photos de suivi de poids, copiées depuis la galerie/l'appareil photo —
// l'URI temporaire renvoyée par le sélecteur n'est pas garantie de survivre au-delà du picker.
function photosDirectory(): Directory {
  const dir = new Directory(Paths.document, 'poids-corps');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/**
 * Ouvre l'appareil photo ou la galerie, copie le cliché choisi dans le stockage persistant de
 * l'app, et renvoie son URI locale stable (ou null si l'utilisateur annule, refuse la
 * permission, ou en cas d'erreur — toujours accompagné d'un message clair dans ce dernier cas).
 */
export async function pickBodyWeightPhoto(source: 'camera' | 'library', date: string): Promise<string | null> {
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission refusée',
          "Autorise l'accès à l'appareil photo dans les réglages Android pour prendre une photo."
        );
        return null;
      }
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [3, 4],
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || result.assets.length === 0) return null;

    const sourceFile = new File(result.assets[0].uri);
    const destFile = new File(photosDirectory(), `${date}-${Date.now()}.jpg`);
    sourceFile.copySync(destFile);
    return destFile.uri;
  } catch (error) {
    console.error('Erreur pickBodyWeightPhoto:', error);
    Alert.alert('Erreur', "Impossible d'ajouter cette photo. Réessaie dans un instant.");
    return null;
  }
}
