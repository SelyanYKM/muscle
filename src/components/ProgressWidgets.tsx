// Petits graphiques du tiroir « Ton progrès » : anneau d'objectif, calendrier des séances,
// semaine en cours (tiroir replié), jauges de récupération, énergie, exercices en progression.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { SplitRecovery } from '../database/db';
import { THEME } from '../theme';
import { parseLocalDate } from '../utils/format';
import { CalendarDay, CalendarWeek, Trend } from '../utils/progressStats';
import { Icon } from './Icon';

const SPLIT_NAMES: Record<number, string> = { 1: 'Push', 2: 'Pull', 3: 'Legs' };
const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const REST_DOT = '#C9D3E3';
// Bleu moyen des barres secondaires (3:1 sur blanc) ; « en baisse » = contour seul.
const MUTED_BAR = THEME.colors.chartMuted;

function splitColor(workoutId: number): string {
  return THEME.splits[workoutId]?.mark ?? THEME.colors.accentStrong;
}

export function splitName(workoutId: number): string {
  return SPLIT_NAMES[workoutId] ?? 'Séance';
}

function shortDate(dateISO: string): string {
  const d = parseLocalDate(dateISO);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function longDate(dateISO: string): string {
  return parseLocalDate(dateISO).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// Jour : pastille pleine à la couleur du split (deux moitiés si deux séances), petit point
// pour un jour de repos — la forme distingue séance et repos, pas seulement la couleur.
// ---------------------------------------------------------------------------

const DayCell: React.FC<{ day: CalendarDay; height: number }> = ({ day, height }) => (
  <View style={[styles.dayFrame, day.isToday && styles.dayFrameToday]}>
    {day.workoutIds.length > 0 ? (
      <View style={[styles.dayFill, { height }]}>
        {day.workoutIds.map((id) => (
          <View key={id} style={{ flex: 1, backgroundColor: splitColor(id) }} />
        ))}
      </View>
    ) : (
      <View style={[styles.dayRest, { height }]}>{!day.isFuture && <View style={styles.restDot} />}</View>
    )}
  </View>
);

function dayA11y(day: CalendarDay, index: number): string | null {
  if (day.workoutIds.length === 0) return null;
  return `${DAY_NAMES[index]} ${day.workoutIds.map(splitName).join(' et ')}`;
}

// ---------------------------------------------------------------------------
// Calendrier des dernières semaines
// ---------------------------------------------------------------------------

export const TrainingCalendar: React.FC<{ weeks: CalendarWeek[]; goal: number }> = ({ weeks, goal }) => (
  <View style={styles.calendar}>
    <View style={styles.calRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.calWeekLabelBox} />
      {DAY_LETTERS.map((l, i) => (
        <Text key={i} style={styles.calDayLetter}>
          {l}
        </Text>
      ))}
      <View style={styles.calCountBox} />
    </View>
    {weeks.map((w, wi) => {
      const isCurrent = wi === weeks.length - 1;
      const done = w.days.map(dayA11y).filter(Boolean).join(', ');
      const label = `${isCurrent ? 'Cette semaine' : `Semaine du ${longDate(w.weekStart)}`} : ${w.sessionCount} séance${w.sessionCount > 1 ? 's' : ''}${done ? `. ${done}` : ''}`;
      return (
        <View key={w.weekStart} style={styles.calRow} accessible accessibilityLabel={label}>
          <Text style={styles.calWeekLabel}>{shortDate(w.weekStart)}</Text>
          {w.days.map((d) => (
            <DayCell key={d.date} day={d} height={20} />
          ))}
          <Text style={[styles.calCount, w.sessionCount >= goal && styles.calCountReached]}>{w.sessionCount}</Text>
        </View>
      );
    })}
    <View style={styles.legendRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[1, 2, 3].map((id) => (
        <View key={id} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: splitColor(id) }]} />
          <Text style={styles.legendText}>{splitName(id)}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={styles.restDot} />
        <Text style={styles.legendText}>Repos</Text>
      </View>
    </View>
  </View>
);

/** Semaine en cours, dans le tiroir replié (visuel seulement : le libellé est sur le tiroir). */
export const WeekStrip: React.FC<{ week: CalendarWeek }> = ({ week }) => (
  <View style={styles.stripRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
    {week.days.map((d, i) => (
      <View key={d.date} style={styles.stripCol}>
        <View style={{ width: 24 }}>
          <DayCell day={d} height={22} />
        </View>
        <Text style={styles.stripLetter}>{DAY_LETTERS[i]}</Text>
      </View>
    ))}
  </View>
);

export function weekStripA11y(week: CalendarWeek): string {
  const done = week.days.map(dayA11y).filter(Boolean).join(', ');
  return done ? `${done}.` : 'aucune séance pour l’instant.';
}

// ---------------------------------------------------------------------------
// Anneau de l'objectif de la semaine : un segment par séance visée, pastille « +N » au-delà
// ---------------------------------------------------------------------------

function arcPath(c: number, r: number, a0: number, a1: number): string {
  const rad = (a: number) => (a * Math.PI) / 180;
  const x0 = c + r * Math.cos(rad(a0));
  const y0 = c + r * Math.sin(rad(a0));
  const x1 = c + r * Math.cos(rad(a1));
  const y1 = c + r * Math.sin(rad(a1));
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

export const GoalRing: React.FC<{ done: number; goal: number; onPress: () => void }> = ({ done, goal, onPress }) => {
  const size = 96;
  const c = size / 2;
  const r = c - 7;
  const seg = 360 / goal;
  const gap = goal > 1 ? 14 : 0;
  const over = done - goal;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.ringBox}
      accessibilityRole="button"
      accessibilityLabel={`Cette semaine : ${done} séance${done > 1 ? 's' : ''} sur un objectif de ${goal}`}
      accessibilityHint="Modifie l’objectif de la semaine"
    >
      <Svg width={size} height={size}>
        {goal === 1 ? (
          <Circle cx={c} cy={c} r={r} fill="none" stroke={done >= 1 ? THEME.colors.textPrimary : THEME.colors.cardInner} strokeWidth={9} />
        ) : (
          Array.from({ length: goal }, (_, i) => (
            <Path
              key={i}
              d={arcPath(c, r, -90 + i * seg + gap / 2, -90 + (i + 1) * seg - gap / 2)}
              fill="none"
              stroke={i < done ? THEME.colors.textPrimary : THEME.colors.cardInner}
              strokeWidth={9}
              strokeLinecap="round"
            />
          ))
        )}
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringValue}>
          {done}
          <Text style={styles.ringGoal}>/{goal}</Text>
        </Text>
        <Text style={styles.ringLabel}>SÉANCES</Text>
      </View>
      {over > 0 && (
        <View style={styles.ringBadge} pointerEvents="none">
          <Text style={styles.ringBadgeText}>+{over}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Récupération par split : jauge sur 72 h, repère à 48 h
// ---------------------------------------------------------------------------

function sinceText(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'auj.';
  if (days === 1) return 'hier';
  return `${days} j`;
}

function sinceA11y(r: SplitRecovery): string {
  if (r.daysSince === null) return `${r.name} : jamais fait`;
  const when = r.daysSince === 0 ? "aujourd'hui" : r.daysSince === 1 ? 'hier' : `il y a ${r.daysSince} jours`;
  return `${r.name} : dernière séance ${when}, ${r.daysSince >= 2 ? 'récupéré' : 'récupération en cours'}`;
}

export const RecoveryGauges: React.FC<{ recovery: SplitRecovery[] }> = ({ recovery }) => (
  <View>
    {recovery.map((r) => {
      const ready = r.daysSince === null || r.daysSince >= 2;
      const pct = r.daysSince === null ? 1 : Math.min(1, r.daysSince / 3);
      return (
        <View key={r.workoutId} style={styles.recRow} accessible accessibilityLabel={sinceA11y(r)}>
          <Text style={styles.recName}>{r.name}</Text>
          <View style={styles.recTrack}>
            <View style={[styles.recFill, { width: `${pct * 100}%`, backgroundColor: splitColor(r.workoutId) }]} />
            <View style={styles.recTick} />
          </View>
          <Text style={[styles.recValue, ready && styles.recValueReady]}>{sinceText(r.daysSince)}</Text>
          <View style={styles.recCheck}>{ready && r.daysSince !== null && <Icon name="check" size={14} color={THEME.colors.accentStrong} />}</View>
        </View>
      );
    })}
    <View style={styles.recScale} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[styles.recScaleText, { left: '66.7%', transform: [{ translateX: -14 }] }]}>48 h</Text>
      <Text style={[styles.recScaleText, { right: 0 }]}>72 h</Text>
    </View>
  </View>
);

// ---------------------------------------------------------------------------
// Énergie notée au bilan (1-5)
// ---------------------------------------------------------------------------

const TREND_TEXT: Record<Trend, string> = { down: 'en baisse', flat: 'stable', up: 'en hausse' };

export const EnergySparkline: React.FC<{ values: number[]; trend: Trend | null }> = ({ values, trend }) => {
  const [width, setWidth] = React.useState(0);
  const h = 56;
  const n = values.length;
  const last = values[n - 1];
  const xOf = (i: number) => (n > 1 ? 6 + (i * (width - 12)) / (n - 1) : width / 2);
  const yOf = (v: number) => 6 + ((5 - v) / 4) * (h - 12);
  const trendColor = trend === 'down' ? THEME.colors.feelingHardText : THEME.colors.textSecondary;
  return (
    <View
      style={styles.energyRow}
      accessible
      accessibilityLabel={`Énergie notée au bilan : ${last} sur 5 à la dernière séance${trend ? `, ${TREND_TEXT[trend]}` : ''}`}
    >
      <View style={{ flex: 1, height: h }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
        {width > 0 && (
          <Svg width={width} height={h}>
            <Line x1={0} y1={6} x2={width} y2={6} stroke="rgba(0, 41, 107, 0.2)" strokeWidth={1} strokeDasharray="3 3" />
            <Line x1={0} y1={h - 6} x2={width} y2={h - 6} stroke="rgba(0, 41, 107, 0.2)" strokeWidth={1} strokeDasharray="3 3" />
            {n > 1 && (
              <Polyline
                points={values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}
                fill="none"
                stroke={THEME.colors.accentStrong}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {values.map((v, i) =>
              i === n - 1 ? (
                <Circle key={i} cx={xOf(i)} cy={yOf(v)} r={5.5} fill={THEME.colors.textPrimary} stroke="#FFFFFF" strokeWidth={2} />
              ) : (
                <Circle key={i} cx={xOf(i)} cy={yOf(v)} r={3} fill={THEME.colors.accentStrong} />
              )
            )}
          </Svg>
        )}
      </View>
      <View style={styles.energyValueCol}>
        <Text style={styles.energyValue}>
          {last}
          <Text style={styles.energyMax}>/5</Text>
        </Text>
        {trend && (
          <View style={styles.energyTrendRow}>
            {trend !== 'flat' && <Icon name={trend === 'down' ? 'trending-down' : 'trending-up'} size={12} color={trendColor} strokeWidth={2.6} />}
            <Text style={[styles.energyTrendText, { color: trendColor }]}>{TREND_TEXT[trend]}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Exercices en progression : une case par exercice
// ---------------------------------------------------------------------------

export const ProgressionBlocks: React.FC<{ up: number; flat: number; down: number; onPress: () => void }> = ({ up, flat, down, onPress }) => {
  const states: ('up' | 'flat' | 'down')[] = [
    ...Array<'up'>(up).fill('up'),
    ...Array<'flat'>(flat).fill('flat'),
    ...Array<'down'>(down).fill('down'),
  ];
  const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Sur 4 semaines : ${up} exercice${up > 1 ? 's' : ''} en hausse, ${flat} ${plural(flat, 'stable', 'stables')}, ${down} en baisse`}
      accessibilityHint="Affiche le détail par exercice"
    >
      <View style={styles.blocksRow}>
        {states.map((s, i) => (
          <View key={i} style={[styles.block, s === 'up' && styles.blockUp, s === 'flat' && styles.blockFlat, s === 'down' && styles.blockDown]} />
        ))}
      </View>
      <View style={styles.blocksLegend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, styles.blockUp]} />
          <Text style={styles.blocksLegendText}>
            <Text style={styles.blocksLegendCount}>{up}</Text> en hausse
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, styles.blockFlat]} />
          <Text style={styles.blocksLegendText}>
            <Text style={styles.blocksLegendCount}>{flat}</Text> {plural(flat, 'stable', 'stables')}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, styles.blockDown]} />
          <Text style={styles.blocksLegendText}>
            <Text style={styles.blocksLegendCount}>{down}</Text> en baisse
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/** Petit carré de la légende (hausse / stable / baisse), réutilisé dans le détail. */
export const TrendSquare: React.FC<{ trend: Trend }> = ({ trend }) => (
  <View style={[styles.legendSquare, trend === 'up' ? styles.blockUp : trend === 'flat' ? styles.blockFlat : styles.blockDown]} />
);

const styles = StyleSheet.create({
  // Jours
  dayFrame: {
    flex: 1,
    padding: 2,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayFrameToday: {
    borderColor: THEME.colors.textPrimary,
  },
  dayFill: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
  },
  dayRest: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  restDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: REST_DOT,
  },
  // Calendrier
  calendar: {
    gap: 2,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  calWeekLabelBox: {
    width: 40,
  },
  calWeekLabel: {
    width: 40,
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  calDayLetter: {
    flex: 1,
    textAlign: 'center',
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  calCountBox: {
    width: 18,
  },
  calCount: {
    width: 18,
    textAlign: 'right',
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  calCountReached: {
    color: THEME.colors.textPrimary,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 8,
    marginLeft: 42,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 8,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  // Semaine du tiroir replié
  stripRow: {
    flexDirection: 'row',
    gap: 3,
  },
  stripCol: {
    alignItems: 'center',
    gap: 1,
  },
  stripLetter: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    lineHeight: 12,
    color: THEME.colors.textMuted,
  },
  // Anneau
  ringBox: {
    width: 96,
    height: 96,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 30,
    lineHeight: 34,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  ringGoal: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
  },
  ringLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 10,
    letterSpacing: 0.6,
    color: THEME.colors.textSecondary,
  },
  ringBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.accent,
  },
  ringBadgeText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.accentTextDark,
  },
  // Récupération
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 30,
  },
  recName: {
    width: 42,
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  recTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.cardInner,
  },
  recFill: {
    height: 10,
    borderRadius: 5,
  },
  recTick: {
    position: 'absolute',
    left: '66.7%',
    top: -4,
    width: 1.5,
    height: 18,
    borderRadius: 1,
    backgroundColor: THEME.colors.textMuted,
  },
  recValue: {
    width: 36,
    textAlign: 'right',
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  recValueReady: {
    color: THEME.colors.textPrimary,
  },
  recCheck: {
    width: 14,
  },
  recScale: {
    height: 14,
    marginLeft: 52,
    marginRight: 70,
  },
  recScaleText: {
    position: 'absolute',
    top: 0,
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  // Énergie
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  energyValueCol: {
    alignItems: 'flex-end',
    minWidth: 66,
  },
  energyValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    color: THEME.colors.textPrimary,
  },
  energyMax: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  energyTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  energyTrendText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
  },
  // Exercices en progression
  blocksRow: {
    flexDirection: 'row',
    gap: 4,
  },
  block: {
    flex: 1,
    height: 30,
    borderRadius: 7,
  },
  blockUp: {
    backgroundColor: THEME.colors.textPrimary,
  },
  blockFlat: {
    backgroundColor: MUTED_BAR,
  },
  blockDown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: MUTED_BAR,
  },
  blocksLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  blocksLegendText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  blocksLegendCount: {
    fontFamily: THEME.fonts.sansHeavy,
    color: THEME.colors.textPrimary,
  },
});
