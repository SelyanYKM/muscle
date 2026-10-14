import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { File } from 'expo-file-system';
import Svg, { Rect } from 'react-native-svg';
import { DashboardSummary, deleteBodyWeightEntry, formatLocalDate, getBodyWeightLogs, saveBodyWeightEntry } from '../database/db';
import { THEME } from '../theme';
import { BodyWeightEntry } from '../types';
import { pickBodyWeightPhoto } from '../utils/bodyPhoto';
import { fmtKg, parseLocalDate } from '../utils/format';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { BarChart } from './BarChart';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PEEK_HEIGHT = 108;
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.82);
const COLLAPSED_TRANSLATE = EXPANDED_HEIGHT - PEEK_HEIGHT;

const SPARK_BAR_WIDTH = 6;
const SPARK_BAR_GAP = 4;
const SPARK_MAX_HEIGHT = 34;

interface DashboardSheetProps {
  summary: DashboardSummary;
}

function formatWeekLabel(weekStartISO: string): string {
  try {
    return parseLocalDate(weekStartISO).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return weekStartISO;
  }
}

/** Mini-histogramme (6 dernières semaines de volume) affiché dans le tiroir replié. */
const MiniSparkline: React.FC<{ weeklyStats: DashboardSummary['weeklyStats'] }> = ({ weeklyStats }) => {
  const bars = weeklyStats.slice(-6);
  const maxValue = Math.max(1, ...bars.map((b) => b.totalVolume));
  const width = bars.length * SPARK_BAR_WIDTH + Math.max(0, bars.length - 1) * SPARK_BAR_GAP;

  return (
    <Svg width={width} height={SPARK_MAX_HEIGHT}>
      {bars.map((b, idx) => {
        const barHeight = b.totalVolume > 0 ? Math.max(2, (b.totalVolume / maxValue) * SPARK_MAX_HEIGHT) : 2;
        const x = idx * (SPARK_BAR_WIDTH + SPARK_BAR_GAP);
        const isLast = idx === bars.length - 1;
        return (
          <Rect
            key={idx}
            x={x}
            y={SPARK_MAX_HEIGHT - barHeight}
            width={SPARK_BAR_WIDTH}
            height={barHeight}
            rx={2}
            fill={THEME.colors.accent}
            opacity={isLast ? 1 : 0.4}
          />
        );
      })}
    </Svg>
  );
};

export const DashboardSheet: React.FC<DashboardSheetProps> = ({ summary }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const translateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE)).current;
  const isExpandedRef = useRef(false);
  const dragStartRef = useRef(0);

  // Suivi du poids de corps : chargé une fois au montage, indépendant de `summary` (recalculé à
  // chaque ouverture du split-select — pas besoin d'y mêler ce qui n'en fait pas partie).
  const [bodyWeightLogs, setBodyWeightLogs] = useState<BodyWeightEntry[]>([]);
  const [isAddWeightOpen, setIsAddWeightOpen] = useState(false);
  const [newWeightText, setNewWeightText] = useState('');
  const [newWeightPhotoUri, setNewWeightPhotoUri] = useState<string | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  useEffect(() => {
    setBodyWeightLogs(getBodyWeightLogs());
  }, []);

  const openAddWeightSheet = () => {
    triggerLightHaptic();
    const lastEntry = bodyWeightLogs[bodyWeightLogs.length - 1];
    setNewWeightText(lastEntry ? fmtKg(lastEntry.weight) : '');
    setNewWeightPhotoUri(null);
    setIsAddWeightOpen(true);
  };

  const handlePickWeightPhoto = async (source: 'camera' | 'library') => {
    if (isPickingPhoto) return;
    setIsPickingPhoto(true);
    try {
      const uri = await pickBodyWeightPhoto(source, formatLocalDate(new Date()));
      if (uri) setNewWeightPhotoUri(uri);
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleSaveWeight = () => {
    const weight = parseFloat(newWeightText.replace(',', '.'));
    if (!weight || weight <= 0) {
      Alert.alert('Poids invalide', 'Renseigne un poids valide.');
      return;
    }
    triggerMediumHaptic();
    const date = formatLocalDate(new Date());
    saveBodyWeightEntry(date, weight, newWeightPhotoUri);
    setBodyWeightLogs(getBodyWeightLogs());
    setIsAddWeightOpen(false);
  };

  const confirmDeleteWeightEntry = (entry: BodyWeightEntry) => {
    Alert.alert(
      'Supprimer cette pesée ?',
      `La pesée du ${formatWeekLabel(entry.date)} (${fmtKg(entry.weight)} kg) sera supprimée${entry.photoUri ? ', photo comprise' : ''}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            triggerLightHaptic();
            deleteBodyWeightEntry(entry.date);
            if (entry.photoUri) {
              try {
                new File(entry.photoUri).delete();
              } catch (error) {
                console.error('Erreur suppression photo poids de corps:', error);
              }
            }
            setBodyWeightLogs(getBodyWeightLogs());
          },
        },
      ]
    );
  };

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
    outputRange: [0.4, 0],
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
            <TouchableOpacity style={styles.peekRow} onPress={() => snapTo(true)} activeOpacity={0.8}>
              <View style={styles.peekTextCol}>
                <Text style={styles.peekLabel}>TON PROGRÈS</Text>
                <Text style={styles.peekInsight} numberOfLines={1}>
                  {summary.insightText}
                </Text>
              </View>
              <MiniSparkline weeklyStats={summary.weeklyStats} />
            </TouchableOpacity>
          ) : (
            <View style={styles.expandedHeaderRow}>
              <Text style={styles.sheetTitle}>Ton progrès</Text>
              <TouchableOpacity style={styles.reduceBtn} onPress={() => snapTo(false)} activeOpacity={0.8}>
                <Icon name="chevron-down" size={14} color={THEME.colors.textSecondary} />
                <Text style={styles.closeHint}>Réduire</Text>
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

          {/* Bloc de stats unique, 3 colonnes séparées par des filets */}
          <View style={styles.statsBlock}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{Math.round(summary.totalVolumeAllTime)}</Text>
              <Text style={styles.statLabel}>KG SOULEVÉS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{summary.totalSessions}</Text>
              <Text style={styles.statLabel}>SÉANCES</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
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
            color={THEME.colors.accentStrong}
            height={80}
            formatValue={(v) => `${v} séance${v > 1 ? 's' : ''}`}
          />

          {/* Poids de corps (optionnellement accompagné d'une photo) */}
          <View style={{ marginTop: 18 }}>
            <View style={styles.bwHeaderRow}>
              <Text style={styles.sectionLabel}>POIDS DE CORPS</Text>
              <TouchableOpacity onPress={openAddWeightSheet} activeOpacity={0.8}>
                <Text style={styles.bwAddLink}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>

            {bodyWeightLogs.length === 0 ? (
              <Text style={styles.bwEmptyText}>Pas encore de pesée enregistrée.</Text>
            ) : (
              <>
                <BarChart
                  data={bodyWeightLogs.map((e) => ({ label: formatWeekLabel(e.date), value: e.weight }))}
                  color={THEME.colors.accent}
                  height={80}
                  formatValue={(v) => `${fmtKg(v)} kg`}
                />
                {/* Dernières pesées : chacune supprimable (photo comprise), pas seulement
                    celles avec photo — sinon impossible de corriger une pesée sans photo. */}
                <View style={styles.bwEntriesList}>
                  {bodyWeightLogs
                    .slice(-8)
                    .reverse()
                    .map((e, idx) => (
                      <View key={e.date} style={[styles.bwEntryRow, idx > 0 && styles.bwEntryRowDivider]}>
                        {e.photoUri ? (
                          <Image source={{ uri: e.photoUri }} style={styles.bwEntryThumb} />
                        ) : (
                          <View style={styles.bwEntryThumbPlaceholder} />
                        )}
                        <View style={styles.bwEntryTextCol}>
                          <Text style={styles.bwEntryWeight}>{fmtKg(e.weight)} kg</Text>
                          <Text style={styles.bwEntryDate}>{formatWeekLabel(e.date)}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => confirmDeleteWeightEntry(e)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.6}
                        >
                          <Icon name="x" size={14} color={THEME.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              </>
            )}
          </View>

          {/* Répartition du volume par groupe musculaire (4 dernières semaines) */}
          {summary.volumeByMuscleGroup.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 18 }]}>RÉPARTITION PAR GROUPE · 4 SEM.</Text>
              <View style={styles.muscleGroupList}>
                {(() => {
                  const maxVolume = Math.max(1, ...summary.volumeByMuscleGroup.map((g) => g.volume));
                  return summary.volumeByMuscleGroup.map((g, idx) => (
                    <View key={g.muscleGroup} style={[styles.muscleGroupRow, idx > 0 && styles.muscleGroupRowDivider]}>
                      <View style={styles.muscleGroupTextRow}>
                        <Text style={styles.muscleGroupLabel}>{g.label}</Text>
                        <Text style={styles.muscleGroupValue}>{g.volume.toLocaleString('fr-FR')} kg</Text>
                      </View>
                      <View style={styles.muscleGroupBarTrack}>
                        <View
                          style={[
                            styles.muscleGroupBarFill,
                            { width: `${Math.max(4, (g.volume / maxVolume) * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ));
                })()}
              </View>
            </>
          )}

          {/* Force estimée (1RM, formule Epley) sur les exercices barre libre */}
          {summary.strengthCurves.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 18 }]}>FORCE ESTIMÉE (1RM)</Text>
              {summary.strengthCurves.map((curve) => {
                const lastPoint = curve.points[curve.points.length - 1];
                return (
                  <View key={curve.exerciseId} style={styles.strengthCurveBlock}>
                    <View style={styles.strengthCurveHeaderRow}>
                      <Text style={styles.strengthCurveName} numberOfLines={1}>
                        {curve.exerciseName}
                      </Text>
                      {lastPoint && (
                        <Text style={styles.strengthCurveLast}>~{Math.round(lastPoint.estimated1RM)} kg</Text>
                      )}
                    </View>
                    {curve.points.length >= 2 ? (
                      <BarChart
                        data={curve.points.map((p) => ({ label: formatWeekLabel(p.date), value: p.estimated1RM }))}
                        color={THEME.colors.accentStrong}
                        height={70}
                        formatValue={(v) => `~${Math.round(v)} kg estimés`}
                      />
                    ) : (
                      <Text style={styles.strengthCurveHint}>Encore une séance ou deux pour voir la tendance.</Text>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* Records personnels */}
          {summary.personalRecords.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 18 }]}>RECORDS PERSONNELS</Text>
              <View style={styles.prList}>
                {summary.personalRecords.map((pr, idx) => (
                  <View key={idx} style={[styles.prRow, idx > 0 && styles.prRowDivider]}>
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

      {/* FEUILLE : AJOUTER UNE PESÉE (poids du jour + photo optionnelle) */}
      <BottomSheet visible={isAddWeightOpen} onClose={() => setIsAddWeightOpen(false)} maxHeightPercent={65}>
        <Text style={styles.bwSheetTitle}>Ajouter une pesée</Text>
        <Text style={styles.bwSheetSubtitle}>Aujourd'hui</Text>

        <Text style={styles.sectionLabel}>POIDS (KG)</Text>
        <TextInput
          style={styles.bwWeightInput}
          value={newWeightText}
          onChangeText={setNewWeightText}
          keyboardType="decimal-pad"
          placeholder="72,5"
          placeholderTextColor={THEME.colors.textMuted}
        />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>PHOTO (OPTIONNEL)</Text>
        {newWeightPhotoUri ? (
          <View style={styles.bwPhotoPreviewRow}>
            <Image source={{ uri: newWeightPhotoUri }} style={styles.bwPhotoPreview} />
            <TouchableOpacity onPress={() => setNewWeightPhotoUri(null)}>
              <Text style={styles.bwRemovePhotoText}>Retirer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bwPhotoBtnRow}>
            <TouchableOpacity
              style={styles.bwPhotoBtn}
              onPress={() => handlePickWeightPhoto('camera')}
              disabled={isPickingPhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.bwPhotoBtnText}>{isPickingPhoto ? '...' : 'Appareil photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bwPhotoBtn}
              onPress={() => handlePickWeightPhoto('library')}
              disabled={isPickingPhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.bwPhotoBtnText}>{isPickingPhoto ? '...' : 'Galerie'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.bwSaveBtn} onPress={handleSaveWeight} activeOpacity={0.85}>
          <Text style={styles.bwSaveBtnText}>Enregistrer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bwCancelBtn} onPress={() => setIsAddWeightOpen(false)} activeOpacity={0.8}>
          <Text style={styles.bwCancelBtnText}>Annuler</Text>
        </TouchableOpacity>
      </BottomSheet>
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
    backgroundColor: THEME.colors.shadow,
    zIndex: 5,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderTopLeftRadius: THEME.radius.sheet,
    borderTopRightRadius: THEME.radius.sheet,
    shadowColor: THEME.colors.shadow,
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
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 41, 107, 0.15)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peekTextCol: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  peekLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.accentStrong,
    letterSpacing: 1,
  },
  peekInsight: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    color: THEME.colors.textPrimary,
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.textPrimary,
  },
  reduceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.pill,
  },
  closeHint: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
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
  statsBlock: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingVertical: 14,
    marginBottom: 20,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: THEME.colors.hairline,
  },
  statValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
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
  muscleGroupList: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingHorizontal: 14,
  },
  muscleGroupRow: {
    paddingVertical: 10,
    gap: 6,
  },
  muscleGroupRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  muscleGroupTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muscleGroupLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  muscleGroupValue: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.accentStrong,
  },
  muscleGroupBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 41, 107, 0.08)',
    overflow: 'hidden',
  },
  muscleGroupBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.accent,
  },
  strengthCurveBlock: {
    marginBottom: 14,
  },
  strengthCurveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  strengthCurveName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  strengthCurveLast: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.accentStrong,
  },
  strengthCurveHint: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  prList: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingHorizontal: 14,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  prRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  prName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  prWeight: {
    fontFamily: THEME.fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.accentStrong,
  },
  bwHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bwAddLink: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.accentStrong,
  },
  bwEmptyText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  bwEntriesList: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  bwEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  bwEntryRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  bwEntryThumb: {
    width: 34,
    height: 44,
    borderRadius: 8,
    backgroundColor: THEME.colors.cardBg,
  },
  bwEntryThumbPlaceholder: {
    width: 34,
    height: 44,
    borderRadius: 8,
    backgroundColor: THEME.colors.cardBg,
  },
  bwEntryTextCol: {
    flex: 1,
  },
  bwEntryWeight: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  bwEntryDate: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  bwSheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.textPrimary,
  },
  bwSheetSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 14,
  },
  bwWeightInput: {
    height: 52,
    backgroundColor: THEME.colors.bg,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
    borderRadius: THEME.radius.inner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginTop: 6,
  },
  bwPhotoBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bwPhotoBtn: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.inner,
  },
  bwPhotoBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  bwPhotoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  bwPhotoPreview: {
    width: 64,
    height: 84,
    borderRadius: THEME.radius.inner,
    backgroundColor: THEME.colors.cardInner,
  },
  bwRemovePhotoText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.feelingHardText,
  },
  bwSaveBtn: {
    height: 54,
    backgroundColor: THEME.colors.textPrimary,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  bwSaveBtnText: {
    fontFamily: THEME.fonts.sans,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  bwCancelBtn: {
    paddingVertical: 13,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  bwCancelBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
