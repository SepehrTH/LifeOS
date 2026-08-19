/**
 * How a day turns into a shade of green.
 *
 * Every scored metric carries a weight you choose in whatever units suit you — 45/20/15/20,
 * or 5/3/2/2, it makes no difference. The weights are normalised against their own total, so
 * the metrics you care about split a fixed 100 points between them. The volume bonus sits on
 * top of that, which is why the darkest shade needs more than a perfect check-in: there is
 * always room to do better.
 */
export const SCORE_MAX = 100;
export const VOLUME_BONUS = 15;

export type ScorePart = {
  metricId: string;
  key: string;
  name: string;
  color: string;
  /** The weight as entered. */
  weight: number;
  /** That weight as a slice of 100, after normalising. */
  share: number;
  /** 0–1, or null when the metric was left blank that day. */
  value: number | null;
  points: number;
  /** True for metrics the app fills in itself, like the todo ratio. */
  auto: boolean;
};

export type DayScore = {
  day: string;
  /** null when there is no check-in — the square is drawn empty, not as a zero. */
  score: number | null;
  level: number;
  planned: number;
  done: number;
  parts: ScorePart[];
  bonus: number;
};

export type PartInput = {
  metricId: string;
  key: string;
  name: string;
  color: string;
  weight: number;
  value: number | null;
  auto: boolean;
  /** Left out of the normalisation entirely — e.g. no todos were planned that day. */
  skip?: boolean;
};

export type DayInput = {
  day: string;
  planned: number;
  done: number;
  parts: PartInput[];
  hasCheckin: boolean;
  /** Trailing median of completions, for the volume bonus. */
  median: number;
};

/** Cut-offs for the six shades. The top one needs the volume bonus to be reachable. */
const LEVELS = [1, 30, 55, 80, 105];

export function levelFor(score: number | null): number {
  if (score === null) return -1;
  let level = 0;
  for (const cut of LEVELS) if (score >= cut) level++;
  return level;
}

export function scoreDay(input: DayInput): DayScore {
  const counted = input.parts.filter((p) => p.weight > 0 && !p.skip);
  const totalWeight = counted.reduce((sum, p) => sum + p.weight, 0);

  const parts: ScorePart[] = input.parts.map((p) => {
    const scored = p.weight > 0 && !p.skip && totalWeight > 0;
    const share = scored ? (p.weight / totalWeight) * SCORE_MAX : 0;
    return {
      metricId: p.metricId,
      key: p.key,
      name: p.name,
      color: p.color,
      weight: p.weight,
      share,
      value: p.value,
      points: scored ? share * (p.value ?? 0) : 0,
      auto: p.auto,
    };
  });

  // Beating your own trailing median is the only way to reach the darkest shade. With no
  // history there is no bar to clear yet, so the bonus stays shut until one exists.
  const overshoot = input.median > 0 ? (input.done - input.median) / input.median : 0;
  const bonus = VOLUME_BONUS * Math.min(1, Math.max(0, overshoot));

  const score = input.hasCheckin
    ? Math.round(parts.reduce((sum, p) => sum + p.points, 0) + bonus)
    : null;

  return {
    day: input.day,
    score,
    level: levelFor(score),
    planned: input.planned,
    done: input.done,
    parts,
    bonus,
  };
}
