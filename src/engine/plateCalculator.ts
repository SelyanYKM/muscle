import { PlateInfo } from '../types';

export const STANDARD_PLATES = [20, 10, 5, 2.5, 1.25];

export const PLATE_COLORS: Record<number, { bg: string; text: string; border?: string }> = {
  20: { bg: '#3B7AC4', text: '#FFFFFF' }, // Bleu olympique
  10: { bg: '#349A5A', text: '#FFFFFF' }, // Vert olympique
  5: { bg: '#D45454', text: '#FFFFFF' },  // Rouge olympique
  2.5: { bg: '#F1F3F5', text: '#1C1C1E', border: '#D0D5DD' }, // Blanc / Clair
  1.25: { bg: '#9CA3AF', text: '#FFFFFF' }, // Chrome argenté
};

/**
 * Calcule la décomposition exacte des disques à charger PAR CÔTÉ.
 * @param targetWeight Charge totale cible (kg)
 * @param baseWeight Poids de base (ex: 20kg pour barre olympique, 0kg pour machine)
 * @param availablePlates Liste des disques disponibles par ordre décroissant
 */
export function getPlateBreakdownPerSide(
  targetWeight: number,
  baseWeight: number = 0,
  availablePlates: number[] = STANDARD_PLATES
): PlateInfo[] {
  // Poids net à charger sur les disques
  const weightToLoad = Math.max(0, targetWeight - baseWeight);
  
  // Poids par côté (arrondi aux 2 décimales pour éviter les imprécisions JS)
  let weightPerSide = Math.round((weightToLoad / 2) * 100) / 100;

  const plateCounts: Record<number, number> = {};

  for (const plate of availablePlates) {
    if (weightPerSide >= plate - 0.001) {
      const count = Math.floor((weightPerSide + 0.001) / plate);
      if (count > 0) {
        plateCounts[plate] = count;
        weightPerSide = Math.round((weightPerSide - count * plate) * 100) / 100;
      }
    }
  }

  // Convertir en tableau structuré avec métadonnées visuelles
  const result: PlateInfo[] = [];
  for (const plate of availablePlates) {
    if (plateCounts[plate] && plateCounts[plate] > 0) {
      const colorMeta = PLATE_COLORS[plate] || { bg: '#3B82F6', text: '#FFFFFF' };
      result.push({
        weight: plate,
        count: plateCounts[plate],
        color: colorMeta.bg,
        textColor: colorMeta.text,
      });
    }
  }

  return result;
}
