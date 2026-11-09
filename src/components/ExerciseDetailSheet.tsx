// Fiche d'un exercice, ouverte depuis une ligne de record ou un point « à surveiller » :
// le record et son escalier (tactile), la prochaine séance, les dernières séances.
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ExerciseDetail, WatchItem } from '../database/db';
import { THEME } from '../theme';
import { EquipmentCategory } from '../types';
import { fmtKg, parseLocalDate } from '../utils/format';
import { FeelingMark } from './FeelingMark';
import { Icon } from './Icon';
import { RecordChart } from './ProgressCharts';
import { splitName } from './ProgressWidgets';

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  HAMMER_STRENGTH: 'HAMMER STRENGTH',
  FREE_WEIGHT: 'BARRE LIBRE',
  CABLE: 'POULIE',
};

function shortDate(dateISO: string): string {
  const d = parseLocalDate(dateISO);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function longDate(dateISO: string): string {
  return parseLocalDate(dateISO).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

const topWeight = (sets: { weight: number }[]) => Math.max(0, ...sets.map((s) => s.weight));

/** Points pleins / anneaux vides des dernières séances, un groupe par séance. */
export const SessionMarks: React.FC<{ sessions: WatchItem['sessions'] }> = ({ sessions }) => (
  <View style={styles.marksRow}>
    {sessions.map((sets, i) => (
      <View key={i} style={styles.marksGroup}>
        {sets.map((f, j) => (
          <FeelingMark key={j} feeling={f} />
        ))}
      </View>
    ))}
  </View>
);

export const ExerciseDetailSheet: React.FC<{ detail: ExerciseDetail; watch?: WatchItem; onClose: () => void }> = ({ detail, watch, onClose }) => {
  const { sessions, record, next } = detail;
  const today = sessions.length > 0 ? sessions[sessions.length - 1].date : null;
  const lastTop = sessions.length > 0 ? topWeight(sessions[sessions.length - 1].sets) : null;
  const recordStep = record?.steps[record.steps.length - 1] ?? null;
  // Séries faites à la charge du record, ce jour-là : « 3 × 6 reps » ou « 8 reps ».
  const recordSets = recordStep ? (sessions.find((s) => s.date === recordStep.date)?.sets ?? []).filter((s) => s.weight === recordStep.weight) : [];
  const recordReps =
    recordSets.length > 1 && recordSets.every((s) => s.repsDone === recordSets[0].repsDone)
      ? `${recordSets.length} × ${recordSets[0].repsDone} reps`
      : recordSets.length > 0
        ? `${Math.max(...recordSets.map((s) => s.repsDone))} reps`
        : null;
  const nextDelta = next && lastTop !== null ? Math.round((next.weight - lastTop) * 100) / 100 : null;
  const chartSessions = sessions.map((s) => {
    const top = topWeight(s.sets);
    return { date: s.date, weight: top, reps: Math.max(0, ...s.sets.filter((x) => x.weight === top).map((x) => x.repsDone)) };
  });
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {detail.category && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{CATEGORY_LABEL[detail.category]}</Text>
          </View>
        )}
        <Text style={styles.title} accessibilityRole="header">
          {detail.exerciseName}
        </Text>
        {sessions.length > 0 && (
          <Text style={styles.subtitle}>
            {detail.workoutId ? `${splitName(detail.workoutId)} · ` : ''}
            {sessions.length} séance{sessions.length > 1 ? 's' : ''} depuis le {shortDate(sessions[0].date)}
          </Text>
        )}

        {record && recordStep && today && (
          <>
            <Text style={styles.sectionLabel} accessibilityRole="header">RECORD</Text>
            <View
              style={styles.recordRow}
              accessible
              accessibilityLabel={`Record : ${fmtKg(record.maxWeight)} kilos le ${longDate(recordStep.date)}${record.delta !== null ? `, battu de ${fmtKg(record.delta)} kilos` : ''}`}
            >
              <Text style={styles.recordValue}>
                {fmtKg(record.maxWeight)}
                <Text style={styles.recordUnit}> kg</Text>
              </Text>
              {record.delta !== null && (
                <View style={styles.goldPill}>
                  <Text style={styles.goldPillText}>+{fmtKg(record.delta)} kg</Text>
                </View>
              )}
              <Text style={styles.recordMeta} numberOfLines={1}>
                le {shortDate(recordStep.date)}
                {recordReps ? ` · ${recordReps}` : ''}
              </Text>
            </View>
            <View style={styles.chartBox}>
              <RecordChart sessions={chartSessions} steps={record.steps} today={todayISO} windowStart={detail.recordsWindowStart} />
            </View>
          </>
        )}

        {next && (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>PROCHAINE SÉANCE</Text>
            <View style={styles.nextRow}>
              <Text style={styles.nextValue}>
                {fmtKg(next.weight)} kg × {next.targetReps}
              </Text>
              {nextDelta !== null && (
                <View style={[styles.deltaPill, nextDelta > 0 ? styles.deltaPillUp : styles.deltaPillFlat]}>
                  {nextDelta !== 0 && (
                    <Icon
                      name={nextDelta > 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={nextDelta > 0 ? THEME.colors.accentStrong : THEME.colors.textSecondary}
                      strokeWidth={2.6}
                    />
                  )}
                  <Text style={[styles.deltaText, nextDelta > 0 ? styles.deltaTextUp : styles.deltaTextFlat]}>
                    {nextDelta === 0 ? '= même charge' : `${nextDelta > 0 ? '+' : '−'}${fmtKg(Math.abs(nextDelta))} kg`}
                  </Text>
                </View>
              )}
            </View>
            {!!next.reason && <Text style={styles.nextReason}>{next.reason}</Text>}
            {watch && watch.kind === 'deload' && (
              <View style={styles.watchRow} accessible accessibilityLabel={`À surveiller : ${watch.text}`}>
                <SessionMarks sessions={watch.sessions} />
                <Text style={styles.watchText}>{watch.text}</Text>
              </View>
            )}
          </View>
        )}

        {sessions.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 22 }]} accessibilityRole="header">SÉANCES</Text>
            <View style={styles.list}>
              {sessions
                .slice(-5)
                .reverse()
                .map((s, idx) => {
                  const top = topWeight(s.sets);
                  const others = Array.from(new Set(s.sets.filter((x) => x.weight !== top).map((x) => x.weight))).sort((a, b) => a - b);
                  return (
                    <View
                      key={s.date}
                      style={[styles.sessionRow, idx > 0 && styles.divider]}
                      accessible
                      accessibilityLabel={`${longDate(s.date)} : ${s.sets.map((x) => `${x.repsDone} reps à ${fmtKg(x.weight)} kilos${x.feeling === 'HARD' ? ', échec' : ''}`).join(', ')}`}
                    >
                      <Text style={styles.sessionDate}>{shortDate(s.date)}</Text>
                      <View style={styles.setCols}>
                        {s.sets.map((x, j) => (
                          <View key={j} style={styles.setCol}>
                            <FeelingMark feeling={x.feeling} size={8} />
                            <Text style={[styles.setReps, x.weight !== top && styles.setRepsMuted]}>{x.repsDone}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.sessionWeightCol}>
                        <Text style={styles.sessionWeight}>{fmtKg(top)} kg</Text>
                        {others.length > 0 && (
                          <Text style={styles.sessionOther}>
                            + série{others.length > 1 ? 's' : ''} à {others.map(fmtKg).join(', ')}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          </>
        )}
      </ScrollView>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.closeBtnText}>Fermer</Text>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.badgeBg,
  },
  badgeText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 10,
    letterSpacing: 0.6,
    color: THEME.colors.badgeText,
  },
  title: {
    marginTop: 8,
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    lineHeight: 31,
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 16,
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    letterSpacing: 0.8,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  recordUnit: {
    fontSize: 17,
    color: THEME.colors.textSecondary,
  },
  goldPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.accent,
  },
  goldPillText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.accentTextDark,
  },
  recordMeta: {
    flexShrink: 1,
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  chartBox: {
    marginTop: 14,
  },
  nextCard: {
    marginTop: 22,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nextLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    letterSpacing: 0.8,
    color: THEME.colors.textSecondary,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  nextValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: THEME.colors.textPrimary,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  deltaPillUp: {
    backgroundColor: '#DCE8F5',
  },
  deltaPillFlat: {
    backgroundColor: '#FFFFFF',
  },
  deltaText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
  },
  deltaTextUp: {
    color: THEME.colors.accentStrong,
  },
  deltaTextFlat: {
    color: THEME.colors.textSecondary,
  },
  nextReason: {
    marginTop: 2,
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
    marginTop: 8,
  },
  watchText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textPrimary,
  },
  marksRow: {
    flexDirection: 'row',
    gap: 6,
  },
  marksGroup: {
    flexDirection: 'row',
    gap: 2,
  },
  list: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingHorizontal: 14,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  sessionDate: {
    width: 40,
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  setCols: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  setCol: {
    width: 18,
    alignItems: 'center',
    gap: 3,
  },
  setReps: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textPrimary,
  },
  setRepsMuted: {
    color: THEME.colors.textMuted,
  },
  sessionWeightCol: {
    alignItems: 'flex-end',
  },
  sessionWeight: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 13,
    color: THEME.colors.accentStrong,
  },
  sessionOther: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  closeBtn: {
    height: 54,
    backgroundColor: THEME.colors.textPrimary,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  closeBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: '#FFFFFF',
    fontSize: 14,
  },
});
