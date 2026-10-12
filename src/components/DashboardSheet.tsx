import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { DashboardSummary } from '../database/db';
import { THEME } from '../theme';
import { triggerLightHaptic } from '../utils/haptics';
import { BarChart } from './BarChart';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PEEK_HEIGHT = 124;
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.82);
const COLLAPSED_TRANSLATE = EXPANDED_HEIGHT - PEEK_HEIGHT;

interface DashboardSheetProps {
  summary: DashboardSummary;
}

function formatWeekLabel(weekStartISO: string): string {
  try {
    const [year, month, day] = weekStartISO.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return weekStartISO;
  }
}

export const DashboardSheet: React.FC<DashboardSheetProps> = ({ summary }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const translateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE)).current;
  const isExpandedRef = useRef(false);
  const dragStartRef = useRef(0);

  const snapTo = (expand: boolean) => {
    triggerLightHaptic();
    isExpandedRef.current = expand;
    setIsExpanded(expand);
    Animated.spring(translateY, {
      toValue: expand ? 0 : COLLAPSED_TRANSLATE,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        dragStartRef.current = isExpandedRef.current ? 0 : COLLAPSED_TRANSLATE;
      },
      onPanResponderMove: (_, g) => {
        const next = Math.min(COLLAPSED_TRANSLATE, Math.max(0, dragStartRef.current + g.dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const current = dragStartRef.current + g.dy;
        const shouldExpand = current < COLLAPSED_TRANSLATE / 2 || g.vy < -0.5;
        snapTo(g.vy > 0.5 ? false : shouldExpand);
      },
    })
  ).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, COLLAPSED_TRANSLATE],
    outputRange: [0.45, 0],
    extrapolate: 'clamp',
  });

  const volumeChartData = summary.weeklyStats.map((w) => ({
    label: formatWeekLabel(w.weekStart),
    value: w.totalVolume,
  }));
  const sessionsChartData = summary.weeklyStats.map((w) => ({
    label: formatWeekLabel(w.weekStart),
    value: w.sessionCount,
  }));

  return (
    <>
      {/* Fond assombri derrière la feuille, uniquement cliquable (pour refermer) une fois dépliée */}
      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => snapTo(false)} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { height: EXPANDED_HEIGHT, transform: [{ translateY }] }]}>
        {/* Zone de poignée : seule cette zone capte le glissement, pour ne pas gêner le scroll/tap du contenu */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handleBar} />

          {!isExpanded ? (
            <TouchableOpacity style={styles.peekPreview} onPress={() => snapTo(true)} activeOpacity={0.8}>
              <Text style={styles.peekLabel}>📊 TON PROGRÈS</Text>
              <Text style={styles.peekInsight} numberOfLines={1}>
                {summary.insightText}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.expandedHeaderRow}>
              <Text style={styles.sheetTitle}>Ton progrès</Text>
              <TouchableOpacity onPress={() => snapTo(false)} activeOpacity={0.8}>
                <Text style={styles.closeHint}>▾ Réduire</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          scrollEnabled={isExpanded}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.insightFull}>{summary.insightText}</Text>

          {/* Tuiles de stats */}
          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{Math.round(summary.totalVolumeAllTime)}</Text>
              <Text style={styles.statLabel}>KG SOULEVÉS</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{summary.totalSessions}</Text>
              <Text style={styles.statLabel}>SÉANCES</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{summary.streakWeeks}</Text>
              <Text style={styles.statLabel}>SEM. DE SUITE</Text>
            </View>
          </View>

          {/* Graphique de volume hebdomadaire */}
          <Text style={styles.sectionLabel}>VOLUME PAR SEMAINE (KG)</Text>
          <BarChart data={volumeChartData} color={THEME.colors.accent} formatValue={(v) => `${Math.round(v)} kg`} />

          {/* Graphique de régularité */}
          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>SÉANCES PAR SEMAINE</Text>
          <BarChart
            data={sessionsChartData}
            color={THEME.colors.restGradientBlue}
            height={80}
            formatValue={(v) => `${v} séance${v > 1 ? 's' : ''}`}
          />

          {/* Records personnels */}
          {summary.personalRecords.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 18 }]}>RECORDS PERSONNELS</Text>
              <View style={styles.prList}>
                {summary.personalRecords.map((pr, idx) => (
                  <View key={idx} style={styles.prRow}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {pr.exerciseName}
                    </Text>
                    <Text style={styles.prWeight}>{pr.maxWeight} kg</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1C1C1E',
    zIndex: 5,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    zIndex: 6,
  },
  handleArea: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(28, 28, 30, 0.15)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  peekPreview: {
    gap: 2,
  },
  peekLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.accent,
    letterSpacing: 0.8,
  },
  peekInsight: {
    fontFamily: THEME.fonts.serif,
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeHint: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  insightFull: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statTile: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  statValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 8,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  prList: {
    gap: 6,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  prName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  prWeight: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '900',
    color: THEME.colors.accentStrong,
  },
});
