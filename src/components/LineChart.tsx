import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { THEME } from '../theme';
import { AXIS_LABEL_BOX, ChartDatum, chartStyles, ChartValueRow, MIN_AXIS_LABEL_WIDTH } from './BarChart';

interface LineChartProps {
  data: ChartDatum[];
  height?: number;
  /** Formatte la valeur affichée (ex: "77,1 kg"). */
  formatValue?: (value: number) => string;
  /** Formatte les bornes de l'axe, à droite (ex: "78,7"). */
  formatAxis?: (value: number) => string;
  /** Marge ajoutée sous le minimum et au-dessus du maximum, dans l'unité de la donnée. */
  padding?: number;
  /** Précision ajoutée à la dernière valeur, affichée d'office (voir BarChart). */
  lastCaption?: string;
}

// Place réservée à droite pour les bornes de l'axe ("78,7").
const AXIS_GUTTER = 44;
const INSET = 8;

/**
 * Courbe à axe resserré autour des valeurs (min − padding → max + padding), pour les mesures
 * dont seules les variations comptent (poids de corps, force estimée) : en barres partant de 0,
 * 78,4 et 77,1 kg avaient presque la même hauteur.
 */
export const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 90,
  formatValue,
  formatAxis,
  padding = 0,
  lastCaption,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  const valueText = (v: number) => (formatValue ? formatValue(v) : String(v));
  const axisText = (v: number) => (formatAxis ? formatAxis(v) : String(v));

  const values = data.map((d) => d.value);
  const lo = values.length ? Math.min(...values) - padding : 0;
  let hi = values.length ? Math.max(...values) + padding : 1;
  if (hi - lo < 1e-6) hi = lo + 1;

  const plotWidth = Math.max(0, width - AXIS_GUTTER);
  const n = data.length;
  const step = n > 1 ? (plotWidth - INSET * 2) / (n - 1) : 0;
  const xOf = (i: number) => (n > 1 ? INSET + i * step : plotWidth / 2);
  const yOf = (v: number) => INSET + ((hi - v) / (hi - lo)) * (height - INSET * 2);
  const lastIdx = n - 1;
  const highlightIdx = selectedIdx ?? lastIdx;
  const colWidth = n > 1 ? step : plotWidth;
  const labelStep = colWidth > 0 ? Math.max(1, Math.ceil(MIN_AXIS_LABEL_WIDTH / colWidth)) : 1;
  const points = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');

  return (
    <View>
      <ChartValueRow data={data} selectedIdx={selectedIdx} valueText={valueText} lastCaption={lastCaption} />

      <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ minHeight: height }}>
        {width > 0 && n > 0 && (
          <>
            <Svg width={width} height={height} accessible={false} importantForAccessibility="no-hide-descendants">
              {/* Repères pointillés du haut et du bas */}
              <Line x1={0} y1={INSET} x2={plotWidth} y2={INSET} stroke="rgba(0, 41, 107, 0.08)" strokeWidth={1} strokeDasharray="3 3" />
              <Line
                x1={0}
                y1={height - INSET}
                x2={plotWidth}
                y2={height - INSET}
                stroke="rgba(0, 41, 107, 0.08)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {n > 1 && (
                <Polyline
                  points={points}
                  fill="none"
                  stroke={THEME.colors.accentStrong}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {data.map((d, i) =>
                i === highlightIdx ? (
                  <Circle key={i} cx={xOf(i)} cy={yOf(d.value)} r={5.5} fill={THEME.colors.textPrimary} stroke="#FFFFFF" strokeWidth={2} />
                ) : (
                  <Circle key={i} cx={xOf(i)} cy={yOf(d.value)} r={3} fill={THEME.colors.accentStrong} />
                )
              )}
            </Svg>

            {/* Bornes de l'axe à droite, en texte natif (même rendu que les autres étiquettes) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={[styles.boundLabel, { left: plotWidth + 6, top: INSET - 7 }]}>{axisText(hi)}</Text>
              <Text style={[styles.boundLabel, { left: plotWidth + 6, top: height - INSET - 7 }]}>{axisText(lo)}</Text>
            </View>

            <View style={chartStyles.labelsRow} importantForAccessibility="no-hide-descendants">
              {data.map((d, i) =>
                (lastIdx - i) % labelStep === 0 ? (
                  <Text
                    key={i}
                    style={[chartStyles.axisLabel, { left: xOf(i) - AXIS_LABEL_BOX / 2, width: AXIS_LABEL_BOX }]}
                    numberOfLines={1}
                  >
                    {d.axisLabel ?? d.label}
                  </Text>
                ) : null
              )}
            </View>

            {/* Une zone tactile par point, centrée dessus, sur toute la hauteur */}
            <View style={[StyleSheet.absoluteFill, { width: plotWidth }]}>
              {data.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={{ position: 'absolute', top: 0, bottom: 0, left: xOf(i) - colWidth / 2, width: colWidth }}
                  onPress={() => setSelectedIdx(selectedIdx === i ? null : i)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.label} : ${valueText(d.value)}`}
                  accessibilityState={{ selected: selectedIdx === i }}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  boundLabel: {
    position: 'absolute',
    width: AXIS_GUTTER - 6,
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    color: THEME.colors.textMuted,
  },
});
