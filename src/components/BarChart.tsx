import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { THEME } from '../theme';

interface BarChartDatum {
  label: string;
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

export const BarChart: React.FC<BarChartProps> = ({ data, color, height = 120, formatValue }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const barWidth = data.length > 0 ? CHART_WIDTH / data.length - BAR_GAP : 0;

  return (
    <View>
      {selectedIdx !== null && data[selectedIdx] && (
        <View style={styles.tooltipRow}>
          <Text style={styles.tooltipText}>
            {data[selectedIdx].label} · {formatValue ? formatValue(data[selectedIdx].value) : data[selectedIdx].value}
          </Text>
        </View>
      )}

      <Svg width={CHART_WIDTH} height={height}>
        {/* Ligne de base, discrète */}
        <Line x1={0} y1={height - 1} x2={CHART_WIDTH} y2={height - 1} stroke="rgba(28, 28, 30, 0.1)" strokeWidth={1} />

        {data.map((d, idx) => {
          const barHeight = d.value > 0 ? Math.max(3, (d.value / maxValue) * (height - 8)) : 2;
          const x = idx * (barWidth + BAR_GAP);
          const y = height - barHeight - 1;
          const isSelected = selectedIdx === idx;

          return (
            <Rect
              key={idx}
              x={x}
              y={y}
              width={Math.max(2, barWidth)}
              height={barHeight}
              rx={4}
              fill={color}
              opacity={isSelected ? 1 : d.value > 0 ? 0.75 : 0.25}
            />
          );
        })}
      </Svg>

      {/* Zones tactiles superposées (une par barre) pour afficher la valeur au tap */}
      <View style={styles.touchOverlay}>
        {data.map((d, idx) => (
          <TouchableOpacity
            key={idx}
            style={{ width: barWidth + BAR_GAP }}
            onPress={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
            activeOpacity={0.6}
          >
            <Text style={styles.axisLabel} numberOfLines={1}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tooltipRow: {
    marginBottom: 4,
  },
  tooltipText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  touchOverlay: {
    flexDirection: 'row',
    marginTop: 4,
  },
  axisLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 8,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
});
