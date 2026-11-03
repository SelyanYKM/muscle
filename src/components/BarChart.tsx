import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { THEME } from '../theme';

export interface ChartDatum {
  /** Libellé complet (ligne de valeur, lecteur d'écran), ex. "27 oct.". */
  label: string;
  /** Libellé court sous la barre, ex. "27/10" ; à défaut, `label`. */
  axisLabel?: string;
  value: number;
}

interface BarChartProps {
  data: ChartDatum[];
  height?: number;
  /** Formatte la valeur affichée (ex: "120 kg"). */
  formatValue?: (value: number) => string;
  /**
   * Précision ajoutée à la dernière valeur, affichée d'office quand aucune barre n'est
   * sélectionnée (ex. "semaine en cours"). Sans elle, la ligne de valeur n'apparaît qu'au tap.
   */
  lastCaption?: string;
}

const BAR_GAP = 4;
const TOP_RADIUS = 6;
const BOTTOM_RADIUS = 2;
// Largeur mini d'une étiquette d'axe en 11 px ("27/10") : quand les colonnes sont plus
// étroites, on n'affiche qu'une étiquette sur deux (ou trois…), en partant de la dernière barre.
export const MIN_AXIS_LABEL_WIDTH = 34;
export const AXIS_LABEL_BOX = 44;

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

/**
 * Ligne de valeur au-dessus d'un graphique : la sélection en cours, sinon la dernière valeur
 * suivie de sa précision (si `lastCaption` est fourni). Partagée avec LineChart.
 */
export const ChartValueRow: React.FC<{
  data: ChartDatum[];
  selectedIdx: number | null;
  valueText: (v: number) => string;
  lastCaption?: string;
}> = ({ data, selectedIdx, valueText, lastCaption }) => {
  const shown = selectedIdx !== null ? data[selectedIdx] : lastCaption ? data[data.length - 1] : undefined;
  if (!shown) return null;
  return (
    <View style={styles.tooltipRow}>
      <Text style={styles.tooltipText}>
        {shown.label} · {valueText(shown.value)}
        {selectedIdx === null && !!lastCaption && <Text style={styles.tooltipCaption}> ({lastCaption})</Text>}
      </Text>
    </View>
  );
};

export const BarChart: React.FC<BarChartProps> = ({ data, height = 120, formatValue, lastCaption }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // Largeur réelle du conteneur : le graphique occupe toute la largeur du tiroir.
  const [width, setWidth] = useState(0);

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const colWidth = data.length > 0 ? width / data.length : 0;
  const barWidth = Math.max(2, colWidth - BAR_GAP);
  const lastIdx = data.length - 1;
  const highlightIdx = selectedIdx ?? lastIdx;
  const labelStep = colWidth > 0 ? Math.max(1, Math.ceil(MIN_AXIS_LABEL_WIDTH / colWidth)) : 1;

  const valueText = (v: number) => (formatValue ? formatValue(v) : String(v));

  return (
    <View>
      <ChartValueRow data={data} selectedIdx={selectedIdx} valueText={valueText} lastCaption={lastCaption} />

      <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ minHeight: height }}>
        {width > 0 && (
          <>
            <Svg width={width} height={height} accessible={false} importantForAccessibility="no-hide-descendants">
              {/* Ligne de base, discrète */}
              <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke="rgba(0, 41, 107, 0.07)" strokeWidth={1} />

              {data.map((d, idx) => {
                const barHeight = d.value > 0 ? Math.max(3, (d.value / maxValue) * (height - 8)) : 2;
                const x = idx * colWidth;
                const y = height - barHeight - 1;
                // Barre mise en avant (sélection, sinon la plus récente) en bleu foncé, les autres
                // en bleu moyen : deux tons pleins, lisibles sur blanc (3:1 et plus).
                const fill = idx === highlightIdx ? THEME.colors.textPrimary : THEME.colors.chartMuted;
                return <Path key={idx} d={roundedBarPath(x, y, barWidth, barHeight)} fill={fill} />;
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
                      { left: idx * colWidth + barWidth / 2 - AXIS_LABEL_BOX / 2, width: AXIS_LABEL_BOX },
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
                  style={{ width: colWidth, height: '100%' }}
                  onPress={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.label} : ${valueText(d.value)}`}
                  accessibilityState={{ selected: selectedIdx === idx }}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
};

export const chartStyles = StyleSheet.create({
  labelsRow: {
    height: 16,
    marginTop: 4,
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

const styles = StyleSheet.create({
  tooltipRow: {
    marginBottom: 4,
  },
  tooltipText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textPrimary,
  },
  tooltipCaption: {
    fontFamily: THEME.fonts.sansSemi,
    color: THEME.colors.textSecondary,
  },
  touchOverlay: {
    flexDirection: 'row',
  },
  ...chartStyles,
});
