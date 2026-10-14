import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { FEELING_LABEL } from '../constants/feeling';
import { formatLocalDate, getAllSessionsForExport } from '../database/db';
import { parseLocalDate } from './format';

const WORKOUT_NAMES: Record<number, string> = {
  1: 'Push (Pectoraux / Épaules / Triceps)',
  2: 'Pull (Dos / Arrière d’épaules / Biceps)',
  3: 'Legs (Quadriceps / Ischios / Mollets)',
};

function formatDateLong(dateStr: string): string {
  try {
    return parseLocalDate(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * "40 kg : 8 / 8 / 6" quand la charge est la même sur toutes les séries (cas standard) ;
 * "50 kg x8 / 55 kg x8 / 60 kg x6" quand elle varie d'une série à l'autre (pyramidal).
 */
function formatSets(sets: { weight: number; repsDone: number }[]): string {
  const sameWeight = sets.every((s) => s.weight === sets[0].weight);
  if (sameWeight) {
    return `${sets[0].weight} kg : ${sets.map((s) => s.repsDone).join(' / ')}`;
  }
  return sets.map((s) => `${s.weight} kg x${s.repsDone}`).join(' / ');
}

function buildExportText(): string {
  const sessions = getAllSessionsForExport();
  const lines: string[] = [];

  lines.push('mooscles — Export de l’historique');
  lines.push(`Généré le ${formatDateLong(formatLocalDate(new Date()))}`);
  lines.push('');

  if (sessions.length === 0) {
    lines.push('Aucune séance enregistrée pour le moment.');
    return lines.join('\n');
  }

  for (const session of sessions) {
    const title = `${(WORKOUT_NAMES[session.workoutId] || 'Séance').toUpperCase()} — ${formatDateLong(session.date)}`;
    const rule = '='.repeat(title.length);
    lines.push(rule);
    lines.push(title);
    lines.push(rule);
    lines.push('');

    session.exercises.forEach((ex, idx) => {
      lines.push(`${idx + 1}. ${ex.exerciseName}`);
      lines.push(`   ${formatSets(ex.sets)}`);
      const lastFeeling = ex.sets[ex.sets.length - 1]?.feeling;
      if (lastFeeling) {
        lines.push(`   Ressenti (dernière série) : ${FEELING_LABEL[lastFeeling] || lastFeeling}`);
      }
      lines.push('');
    });

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Génère un fichier texte avec tout l'historique et ouvre la fenêtre de partage native
 * (enregistrer dans Fichiers/Drive, envoyer par mail, etc.).
 */
export async function exportHistoryAsText(): Promise<void> {
  try {
    const text = buildExportText();
    const file = new File(Paths.cache, `mooscles-historique-${Date.now()}.txt`);
    file.create({ overwrite: true });
    file.write(text);

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Partage indisponible', "Le partage de fichiers n'est pas disponible sur cet appareil.");
      return;
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Exporter mon historique mooscles',
    });
  } catch (error) {
    console.error('Erreur exportHistoryAsText:', error);
    Alert.alert('Erreur', "L'export a échoué. Réessaie dans un instant.");
  }
}
