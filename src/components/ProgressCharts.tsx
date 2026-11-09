// Graphiques du tiroir « Ton progrès » (lot 8) : la barre de la semaine, les escaliers des
// records (aperçu et version détaillée, tactile) et l'éventail des progrès depuis la reprise.
import React, { useId, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';
import { THEME } from '../theme';
import { fmtKg, parseLocalDate } from '../utils/format';
import { daysBetween, RecordStep, RestartProgress } from '../utils/progressStats';

const NAVY = THEME.colors.textPrimary;
const STEEL = THEME.colors.accentStrong;
const MUTED_BAR = THEME.colors.chartMuted;
const GOLD = THEME.colors.accent;
// Or soutenu : contour des disques or et marche d'un record récent (visible sur le fond clair).
const GOLD_DEEP = '#E2AE00';
// Fond de la bande « 4 dernières semaines » des escaliers.
const WINDOW_BAND = '#FFF4C2';

function plateColor(workoutId: number): string {
  return THEME.splits[workoutId]?.mark ?? STEEL;
}

function shortDate(dateISO: string): string {
  const d = parseLocalDate(dateISO);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function useSvgId(): string {
  return `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** Largeur réelle du conteneur (les graphiques occupent toute la largeur du tiroir). */
function useWidth(): [number, (e: { nativeEvent: { layout: { width: number } } }) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.floor(e.nativeEvent.layout.width))];
}

// ---------------------------------------------------------------------------
// La barre : un disque par séance de la semaine (dans l'ordre, du centre vers l'extérieur, à la
// couleur du split), un emplacement en pointillé par séance qui reste, de petits disques
// au-delà de l'objectif. Une lueur dorée quand la barre est pleine.
// ---------------------------------------------------------------------------

export const Barbell: React.FC<{ sessions: number[]; goal: number; width: number; height: number; mini?: boolean }> = ({
  sessions,
  goal,
  width: w,
  height: h,
  mini = false,
}) => {
  const id = useSvgId();
  if (w <= 0) return null;
  const cy = h / 2;
  const extra = Math.max(0, sessions.length - goal);
  const gap = mini ? 2 : 3;
  const collar = mini ? 4 : 8;
  const tail = mini ? 6 : 14;
  const shaftH = mini ? 4 : 8;
  const sleeveH = mini ? 7 : 14;
  const ph = h - (mini ? 6 : 10);
  const eph = ph * 0.62;
  const half = w / 2;
  const minShaftHalf = w * 0.1;
  // Épaisseur des disques : la charge tient toujours entre la barre centrale et le bout.
  const avail = half - minShaftHalf - collar * 2 - gap - tail - 2;
  const pw = Math.max(mini ? 3 : 6, Math.min(mini ? 8 : 20, avail / (goal + extra * 0.6) - gap));
  const epw = pw * 0.6;
  const load = goal * (pw + gap) + extra * (epw + gap);
  const sleeveLen = load + collar + gap + tail;
  const shaftHalf = Math.max(minShaftHalf, Math.min(w * 0.17, half - sleeveLen - collar - 2));
  const inner = half - shaftHalf;
  const lo = inner - collar - gap; // bord intérieur des disques, à gauche
  const ro = w - inner + collar + gap; // à droite
  const r = mini ? 2 : 5;

  const plate = (key: string, x: number, ww: number, hh: number, color: string | null) => {
    const y = cy - hh / 2;
    if (!color) {
      return (
        <Rect
          key={key}
          x={x}
          y={y}
          width={ww}
          height={hh}
          rx={r}
          fill="rgba(255, 255, 255, 0.55)"
          stroke="rgba(0, 41, 107, 0.32)"
          strokeWidth={1.2}
          strokeDasharray={mini ? '2 2' : '4 3'}
        />
      );
    }
    return (
      <React.Fragment key={key}>
        <Rect x={x} y={y} width={ww} height={hh} rx={r} fill={color} />
        <Rect x={x} y={y} width={ww} height={hh} rx={r} fill={`url(#${id}shine)`} />
        <Rect
          x={x + 0.5}
          y={y + 0.5}
          width={ww - 1}
          height={hh - 1}
          rx={r}
          fill="none"
          stroke={color === NAVY ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)'}
          strokeWidth={1}
        />
      </React.Fragment>
    );
  };

  const plates: React.ReactNode[] = [];
  for (let i = 0; i < goal; i++) {
    const color = i < sessions.length ? plateColor(sessions[i]) : null;
    plates.push(plate(`l${i}`, lo - (i + 1) * (pw + gap) + gap, pw, ph, color));
    plates.push(plate(`r${i}`, ro + i * (pw + gap), pw, ph, color));
  }
  for (let j = 0; j < extra; j++) {
    const color = plateColor(sessions[goal + j]);
    plates.push(plate(`le${j}`, lo - goal * (pw + gap) - (j + 1) * (epw + gap) + gap, epw, eph, color));
    plates.push(plate(`re${j}`, ro + goal * (pw + gap) + j * (epw + gap), epw, eph, color));
  }
  const knurl: React.ReactNode[] = [];
  if (!mini) {
    for (let x = Math.round(half - 40); x <= half + 40; x += 4) {
      knurl.push(<Line key={x} x1={x} y1={cy - 3} x2={x + 2} y2={cy + 3} stroke="#8E9AAE" strokeWidth={0.8} />);
    }
  }
  const innerCollarH = sleeveH + (mini ? 6 : 16);
  const outerCollarH = sleeveH + (mini ? 4 : 10);

  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={`${id}bar`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#EEF2F7" />
          <Stop offset="0.45" stopColor="#B7C1D1" />
          <Stop offset="1" stopColor="#8E9AAE" />
        </LinearGradient>
        <LinearGradient id={`${id}shine`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.12} />
        </LinearGradient>
        <RadialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={GOLD} stopOpacity={0.55} />
          <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {!mini && sessions.length >= goal && <Ellipse cx={half} cy={cy} rx={half * 0.85} ry={h * 0.6} fill={`url(#${id}glow)`} />}
      <Rect x={inner - sleeveLen} y={cy - sleeveH / 2} width={sleeveLen} height={sleeveH} rx={sleeveH / 2} fill={`url(#${id}bar)`} />
      <Rect x={w - inner} y={cy - sleeveH / 2} width={sleeveLen} height={sleeveH} rx={sleeveH / 2} fill={`url(#${id}bar)`} />
      <Rect x={inner} y={cy - shaftH / 2} width={w - 2 * inner} height={shaftH} fill={`url(#${id}bar)`} />
      {knurl}
      <Rect x={inner - collar} y={cy - innerCollarH / 2} width={collar} height={innerCollarH} rx={2} fill={`url(#${id}bar)`} />
      <Rect x={w - inner} y={cy - innerCollarH / 2} width={collar} height={innerCollarH} rx={2} fill={`url(#${id}bar)`} />
      {plates}
      <Rect x={lo - load - (collar + 1)} y={cy - outerCollarH / 2} width={collar} height={outerCollarH} rx={1.5} fill={NAVY} opacity={0.75} />
      <Rect x={ro + load} y={cy - outerCollarH / 2} width={collar} height={outerCollarH} rx={1.5} fill={NAVY} opacity={0.75} />
    </Svg>
  );
};

/** La barre à la largeur de son conteneur. */
export const FluidBarbell: React.FC<{ sessions: number[]; goal: number; height: number }> = ({ sessions, goal, height }) => {
  const [width, onLayout] = useWidth();
  return (
    <View onLayout={onLayout} style={{ height }}>
      <Barbell sessions={sessions} goal={goal} width={width} height={height} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Escalier d'un record (aperçu dans une ligne du tiroir) : chaque marche est un record battu ;
// la bande dorée = la fenêtre récente, les marches qui y tombent sont en or.
// ---------------------------------------------------------------------------

export const RecordStairs: React.FC<{ steps: RecordStep[]; start: string; today: string; windowStart: string; height?: number }> = ({
  steps,
  start,
  today,
  windowStart,
  height: h = 26,
}) => {
  const [w, onLayout] = useWidth();
  const span = Math.max(1, daysBetween(start, today));
  const x = (d: string) => 3 + (Math.min(span, Math.max(0, daysBetween(start, d))) / span) * (w - 6);
  const lo = steps[0]?.weight ?? 0;
  const hi = steps[steps.length - 1]?.weight ?? 0;
  const y = (v: number) => (hi > lo ? h - 4 - ((v - lo) / (hi - lo)) * (h - 8) : h / 2);
  const points: string[] = [];
  steps.forEach((s, i) => {
    if (i > 0) points.push(`${x(s.date)},${y(steps[i - 1].weight)}`);
    points.push(`${x(s.date)},${y(s.weight)}`);
  });
  if (steps.length > 0) points.push(`${x(today)},${y(hi)}`);
  const bx = x(windowStart);

  return (
    <View onLayout={onLayout} style={{ height: h }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Rect x={bx} y={0} width={Math.max(0, w - bx)} height={h} rx={5} fill={WINDOW_BAND} />
          <Polyline points={points.join(' ')} fill="none" stroke={STEEL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {steps.map((s, i) => {
            const recent = i > 0 && s.date >= windowStart;
            return (
              <React.Fragment key={s.date}>
                {recent && <Line x1={x(s.date)} y1={y(steps[i - 1].weight)} x2={x(s.date)} y2={y(s.weight)} stroke={GOLD_DEEP} strokeWidth={2.5} strokeLinecap="round" />}
                <Circle cx={x(s.date)} cy={y(s.weight)} r={recent ? 4 : 2.6} fill={recent ? GOLD : STEEL} stroke={recent ? NAVY : STEEL} strokeWidth={recent ? 1.5 : 0} />
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Escalier détaillé (fiche d'un exercice) : l'escalier = le record, les ronds = les séances.
// Une colonne tactile par séance sur toute la hauteur ; la séance touchée s'affiche au-dessus.
// ---------------------------------------------------------------------------

export interface ChartSession {
  date: string;
  weight: number;
  reps: number;
}

const LABEL_MIN_GAP = 36;

export const RecordChart: React.FC<{ sessions: ChartSession[]; steps: RecordStep[]; today: string; windowStart: string; height?: number }> = ({
  sessions,
  steps,
  today,
  windowStart,
  height: h = 176,
}) => {
  const [w, onLayout] = useWidth();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  if (sessions.length === 0) return null;

  const start = parseLocalDate(sessions[0].date);
  start.setDate(start.getDate() - 4);
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const span = Math.max(1, daysBetween(startISO, today));
  const x = (d: string) => 6 + (Math.min(span, Math.max(0, daysBetween(startISO, d))) / span) * (w - 12);
  const values = [...sessions.map((s) => s.weight), ...steps.map((s) => s.weight)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(2.5, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;
  const y = (v: number) => 18 + ((hi - v) / (hi - lo)) * (h - 30);

  const stepIdx = new Map(steps.map((s, i) => [s.date, i]));
  const lastIdx = sessions.length - 1;
  const shownIdx = selectedIdx ?? lastIdx;
  const shown = sessions[shownIdx];
  const shownStep = stepIdx.get(shown.date);
  const caption =
    shownStep !== undefined && steps[shownStep].weight === shown.weight
      ? shownStep > 0
        ? `record, +${fmtKg(Math.round((shown.weight - steps[shownStep - 1].weight) * 10) / 10)} kg`
        : 'premier record'
      : selectedIdx === null
        ? 'dernière séance'
        : null;

  const points: string[] = [];
  steps.forEach((s, i) => {
    if (i > 0) points.push(`${x(s.date)},${y(steps[i - 1].weight)}`);
    points.push(`${x(s.date)},${y(s.weight)}`);
  });
  if (steps.length > 0) points.push(`${x(today)},${y(steps[steps.length - 1].weight)}`);

  // Étiquettes des marches : on saute celles qui toucheraient la précédente (la dernière reste).
  const labelled: number[] = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    if (labelled.length === 0 || x(steps[labelled[labelled.length - 1]].date) - x(steps[i].date) >= LABEL_MIN_GAP) labelled.push(i);
  }
  const xs = sessions.map((s) => x(s.date));
  const bounds = [0, ...xs.slice(1).map((xi, i) => (xs[i] + xi) / 2), w];
  const bx = x(windowStart);
  const dateA11y = (d: string) => parseLocalDate(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  return (
    <View>
      <Text style={styles.valueRow}>
        {parseLocalDate(shown.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {fmtKg(shown.weight)} kg × {shown.reps}
        {caption && <Text style={styles.valueCaption}> ({caption})</Text>}
      </Text>
      <View onLayout={onLayout} style={{ height: h }}>
        {w > 0 && (
          <>
            <Svg width={w} height={h}>
              <Rect x={bx} y={0} width={Math.max(0, w - bx)} height={h} rx={8} fill={WINDOW_BAND} opacity={0.75} />
              <Line x1={0} y1={h - 0.5} x2={w} y2={h - 0.5} stroke="rgba(0, 41, 107, 0.12)" strokeWidth={1} />
              <Polyline points={points.join(' ')} fill="none" stroke={STEEL} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {steps.map((s, i) =>
                i > 0 && s.date >= windowStart ? (
                  <Line key={`g${s.date}`} x1={x(s.date)} y1={y(steps[i - 1].weight)} x2={x(s.date)} y2={y(s.weight)} stroke={GOLD_DEEP} strokeWidth={3} strokeLinecap="round" />
                ) : null
              )}
              {sessions.map((s, i) =>
                stepIdx.has(s.date) && steps[stepIdx.get(s.date)!].weight === s.weight ? null : (
                  <Circle key={`s${s.date}`} cx={xs[i]} cy={y(s.weight)} r={3.5} fill="#FFFFFF" stroke={MUTED_BAR} strokeWidth={2} />
                )
              )}
              {steps.map((s, i) => {
                const recent = i > 0 && s.date >= windowStart;
                return (
                  <Circle
                    key={`p${s.date}`}
                    cx={x(s.date)}
                    cy={y(s.weight)}
                    r={recent ? 5.5 : 4.5}
                    fill={recent ? GOLD : STEEL}
                    stroke={recent ? NAVY : '#FFFFFF'}
                    strokeWidth={recent ? 2 : 1.5}
                  />
                );
              })}
              {selectedIdx !== null && (
                <>
                  <Line x1={xs[selectedIdx]} y1={4} x2={xs[selectedIdx]} y2={h - 2} stroke={NAVY} strokeWidth={1.5} strokeDasharray="3 3" />
                  <Circle cx={xs[selectedIdx]} cy={y(shown.weight)} r={7} fill={NAVY} stroke="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </Svg>
            <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {labelled.map((i) => (
                <Text key={steps[i].date} style={[styles.stepLabel, { left: x(steps[i].date) + 7, top: y(steps[i].weight) - 19 }]}>
                  {fmtKg(steps[i].weight)}
                </Text>
              ))}
              <Text style={styles.bandLabel}>4 dernières sem.</Text>
            </View>
            <View style={StyleSheet.absoluteFill}>
              {sessions.map((s, i) => (
                <TouchableOpacity
                  key={s.date}
                  style={{ position: 'absolute', top: 0, bottom: 0, left: bounds[i], width: Math.max(1, bounds[i + 1] - bounds[i]) }}
                  onPress={() => setSelectedIdx(selectedIdx === i ? null : i)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`${dateA11y(s.date)} : ${fmtKg(s.weight)} kilos, ${s.reps} répétitions${stepIdx.has(s.date) && steps[stepIdx.get(s.date)!].weight === s.weight ? ', record' : ''}`}
                  accessibilityState={{ selected: selectedIdx === i }}
                />
              ))}
            </View>
          </>
        )}
      </View>
      {w > 0 && (
        <View style={styles.axisRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {labelled.map((i) => (
            <Text key={steps[i].date} style={[styles.axisLabel, { left: x(steps[i].date) - 20 }]}>
              {shortDate(steps[i].date)}
            </Text>
          ))}
          <Text style={styles.axisEnd}>auj.</Text>
        </View>
      )}
      <View style={styles.legendRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.legendItem}>
          <Svg width={18} height={10}>
            <Polyline points="1,9 9,9 9,2 17,2" fill="none" stroke={STEEL} strokeWidth={2} />
          </Svg>
          <Text style={styles.legendText}>record</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendSession} />
          <Text style={styles.legendText}>séance</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendRecent} />
          <Text style={styles.legendText}>record battu en 4 sem.</Text>
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Éventail depuis la reprise : chaque exercice part du même point (la reprise) et finit à son
// écart en %. Le meilleur en bleu foncé avec un point or, un recul en pointillé.
// ---------------------------------------------------------------------------

/** Nom court pour l'éventail : sans « HS Iso-Lateral » devant ni « (Finisher) » derrière. */
export function shortExerciseName(name: string): string {
  return name.replace(/^HS Iso-Lateral\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '');
}

const FAN_LABEL_GAP = 17;

export const RestartFan: React.FC<{ items: RestartProgress[]; restartDateISO: string; height?: number }> = ({ items, restartDateISO, height: h = 190 }) => {
  const [w, onLayout] = useWidth();
  const pcts = items.map((i) => i.percent);
  const lo = Math.min(-10, Math.min(...pcts) - 3);
  const hi = Math.max(10, Math.max(...pcts) + 3);
  const y = (p: number) => 8 + ((hi - p) / (hi - lo)) * (h - 16);
  const x0 = 8;
  const x1 = Math.round(w * 0.48);
  const labX = x1 + 24;
  // Étiquettes écartées d'au moins FAN_LABEL_GAP, sans sortir du cadre.
  const ys = items.map((i) => y(i.percent));
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + FAN_LABEL_GAP);
  if (ys.length > 0) ys[ys.length - 1] = Math.min(ys[ys.length - 1], h - 8);
  for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - FAN_LABEL_GAP);
  const dx = x1 - x0;
  const pctText = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(Math.round(p))} %`;

  return (
    <View
      accessible
      accessibilityLabel={`Depuis ta reprise : ${items.map((i) => `${i.exerciseName} ${pctText(i.percent)}, de ${fmtKg(i.from)} à ${fmtKg(i.to)} kilos`).join(' ; ')}`}
    >
      <View onLayout={onLayout} style={{ height: h }}>
        {w > 0 && (
          <>
            <Svg width={w} height={h}>
              <Line x1={x0} y1={y(0)} x2={x1} y2={y(0)} stroke="rgba(0, 41, 107, 0.25)" strokeWidth={1} strokeDasharray="3 3" />
              {items
                .map((it, i) => {
                  const lead = i === 0 && it.percent >= 0;
                  const up = it.percent >= 0;
                  const color = lead ? NAVY : up ? STEEL : MUTED_BAR;
                  const yp = y(it.percent);
                  return (
                    <React.Fragment key={it.exerciseName}>
                      <Path
                        d={`M ${x0} ${y(0)} C ${x0 + dx * 0.55} ${y(0)}, ${x1 - dx * 0.3} ${yp}, ${x1} ${yp}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={lead ? 3 : 2}
                        strokeLinecap="round"
                        strokeDasharray={up ? undefined : '5 4'}
                      />
                      <Line x1={x1 + 6} y1={yp} x2={labX - 4} y2={ys[i]} stroke="rgba(0, 41, 107, 0.18)" strokeWidth={1} />
                      {lead ? (
                        <Circle cx={x1} cy={yp} r={5.5} fill={GOLD} stroke={NAVY} strokeWidth={2} />
                      ) : (
                        <Circle cx={x1} cy={yp} r={3.5} fill={up ? color : '#FFFFFF'} stroke={color} strokeWidth={2} />
                      )}
                    </React.Fragment>
                  );
                })
                .reverse()}
              <Circle cx={x0} cy={y(0)} r={4.5} fill={NAVY} stroke="#FFFFFF" strokeWidth={2} />
            </Svg>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {items.map((it, i) => (
                <View key={it.exerciseName} style={[styles.fanLabel, { left: labX, top: ys[i] - 8 }]}>
                  <Text style={[styles.fanPct, { color: it.percent >= 0 ? (i === 0 ? NAVY : STEEL) : THEME.colors.textSecondary }]}>{pctText(it.percent)}</Text>
                  <Text style={styles.fanName} numberOfLines={1}>
                    {shortExerciseName(it.exerciseName)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
      {w > 0 && (
        <View style={styles.fanAxis}>
          <Text style={styles.axisStart}>reprise · {shortDate(restartDateISO)}</Text>
          <Text style={[styles.axisLabel, { left: x1 - 40, width: 80 }]}>aujourd’hui</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  valueRow: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  valueCaption: {
    fontFamily: THEME.fonts.sansSemi,
    color: THEME.colors.textSecondary,
  },
  stepLabel: {
    position: 'absolute',
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.textPrimary,
  },
  bandLabel: {
    position: 'absolute',
    right: 8,
    top: 6,
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  axisRow: {
    height: 16,
    marginTop: 6,
  },
  axisLabel: {
    position: 'absolute',
    top: 0,
    width: 40,
    textAlign: 'center',
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  axisStart: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  axisEnd: {
    position: 'absolute',
    top: 0,
    right: 0,
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  legendSession: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: MUTED_BAR,
    backgroundColor: '#FFFFFF',
  },
  legendRecent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: NAVY,
  },
  fanLabel: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  fanPct: {
    width: 44,
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
  },
  fanName: {
    flex: 1,
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  fanAxis: {
    height: 16,
    marginTop: 2,
  },
});
