import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { THEME } from '../theme';

interface BarChartDatum {
  /** Libellé complet (bulle au tap, lecteur d'écran), ex. "27 oct.". */
  label: string;
  /** Libellé court sous la barre, ex. "27/10" ; à défaut, `label`. */
  axisLabel?: string;
  value: number;
}

interface BarChartProps {
  data: BarChartDatum[];
  color: string;
  height?: number;
  /** Formatte la valeur affichée au tap sur une barre (ex: "120 kg"). */
  formatValue?: (value: number) => string;
}

const CHART_WIDTH = 300;
const BAR_GAP = 4;
const TOP_RADIUS = 6;
const BOTTOM_RADIUS = 2;
// Largeur mini d'une étiquette d'axe en 11 px ("27/10") : quand les colonnes sont plus
// étroites, on n'affiche qu'une étiquette sur deux (ou trois…), en partant de la dernière barre.
const MIN_AXIS_LABEL_WIDTH = 34;
const AXIS_LABEL_BOX = 44;

// Rectangle à coins indépendants (SVG <rect rx> ne supporte qu'un rayon uniforme) :
// coins du haut plus arrondis que ceux du bas, pour des barres en forme de "pilule" aplatie.
function roundedBarPath(x: number, y: number, width: number, height: number): string {
  const rt = Math.min(TOP_RADIUS, width / 2, height / 2);
  const rb = Math.min(BOTTOM_RADIUS, width / 2, height / 2);
  return `
    M ${x + rt} ${y}
    L ${x + width - rt} ${y}
    Q ${x + width} ${y} ${x + width} ${y + rt}
    L ${x + width} ${y + height - rb}
    Q ${x + width} ${y + height} ${x + width - rb} ${y + height}
    L ${x + rb} ${y + height}
    Q ${x} ${y + height} ${x} ${y + height - rb}
    L ${x} ${y + rt}
    Q ${x} ${y} ${x + rt} ${y}
    Z
  `;
}

export const BarChart: React.FC<BarChartProps> = ({ data, color, height = 120, formatValue }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const barWidth = data.length > 0 ? CHART_WIDTH / data.length - BAR_GAP : 0;
  const lastIdx = data.length - 1;
  const labelStep = Math.max(1, Math.ceil(MIN_AXIS_LABEL_WIDTH / (barWidth + BAR_GAP)));

  const valueText = (v: number) => (formatValue ? formatValue(v) : String(v));

  return (
    <View>
      {selectedIdx !== null && data[selectedIdx] && (
        <View style={styles.tooltipRow}>
          <Text style={styles.tooltipText}>
            {data[selectedIdx].label} · {valueText(data[selectedIdx].value)}
          </Text>
        </View>
      )}

      <View>
        <Svg width={CHART_WIDTH} height={height} accessible={false} importantForAccessibility="no-hide-descendants">
          {/* Ligne de base, discrète */}
          <Line x1={0} y1={height - 1} x2={CHART_WIDTH} y2={height - 1} stroke="rgba(0, 41, 107, 0.07)" strokeWidth={1} />

          {data.map((d, idx) => {
            const barHeight = d.value > 0 ? Math.max(3, (d.value / maxValue) * (height - 8)) : 2;
            const x = idx * (barWidth + BAR_GAP);
            const y = height - barHeight - 1;
            const isSelected = selectedIdx === idx;
            // La semaine courante (dernière barre) ressort par défaut, les autres sont en retrait.
            const opacity = isSelected ? 1 : idx === lastIdx ? 1 : 0.45;

            return (
              <Path key={idx} d={roundedBarPath(x, y, Math.max(2, barWidth), barHeight)} fill={color} opacity={opacity} />
            );
          })}
        </Svg>

        {/* Étiquettes de l'axe (visuelles seulement : chaque colonne tactile porte déjà la sienne) */}
        <View style={styles.labelsRow} importantForAccessibility="no-hide-descendants">
          {data.map((d, idx) =>
            (lastIdx - idx) % labelStep === 0 ? (
              // Étiquette centrée sous sa barre, plus large que la colonne : elle déborde sur les
              // colonnes voisines, laissées sans étiquette par labelStep.
              <Text
                key={idx}
                style={[
                  styles.axisLabel,
                  { left: idx * (barWidth + BAR_GAP) + barWidth / 2 - AXIS_LABEL_BOX / 2, width: AXIS_LABEL_BOX },
                ]}
                numberOfLines={1}
              >
                {d.axisLabel ?? d.label}
              </Text>
            ) : null
          )}
        </View>

        {/* Zones tactiles superposées : une colonne par barre, sur toute la hauteur (barre +
            étiquette), au lieu de la seule étiquette de quelques pixels sous le graphique. */}
        <View style={[StyleSheet.absoluteFill, styles.touchOverlay]}>
          {data.map((d, idx) => (
            <TouchableOpacity
              key={idx}
              style={{ width: barWidth + BAR_GAP, height: '100%' }}
              onPress={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={`${d.label} : ${valueText(d.value)}`}
              accessibilityState={{ selected: selectedIdx === idx }}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tooltipRow: {
    marginBottom: 4,
  },
  tooltipText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textPrimary,
  },
  labelsRow: {
    height: 16,
    marginTop: 4,
  },
  touchOverlay: {
    flexDirection: 'row',
  },
  axisLabel: {
    position: 'absolute',
    top: 0,
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
});
