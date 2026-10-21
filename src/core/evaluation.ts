import { SYSTEM_INDICATORS } from './framework';
import type { DimensionDef, EvaluationFramework, IndicatorDef, LevelDef } from './framework';
import { studentSubjectStats, summarize } from './scoreStats';
import type { SubjectStat } from './scoreStats';
import type { Dataset, IndicatorValue, RatedValue, RaterRole, Student } from './types';

export interface IndicatorResult {
  def: IndicatorDef;
  score: number | null;
  /** 多主体评价的原始分，其余来源为 null */
  raters: RatedValue | null;
}

export interface DimensionResult {
  def: DimensionDef;
  score: number | null;
  level: LevelDef | null;
  indicators: IndicatorResult[];
  /** 已有数据的指标权重占比（0–1） */
  coverage: number;
}

export interface EvaluationResult {
  studentId: string;
  composite: number | null;
  level: LevelDef | null;
  dimensions: DimensionResult[];
  coverage: number;
}

const clampScore = (v: number) => Math.min(100, Math.max(0, v));

/** 缺失项不参与加权，其余权重按比例归一 */
export function weightedMean(items: readonly { value: number | null; weight: number }[]): number | null {
  let sum = 0;
  let weights = 0;
  for (const { value, weight } of items) {
    if (value === null || !Number.isFinite(value) || weight <= 0) continue;
    sum += value * weight;
    weights += weight;
  }
  return weights > 0 ? sum / weights : null;
}

export function resolveIndicatorValue(
  value: IndicatorValue | undefined,
  raterWeights: Record<RaterRole, number>,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? clampScore(value) : null;
  const mean = weightedMean(
    (Object.keys(raterWeights) as RaterRole[]).map((role) => ({
      value: typeof value[role] === 'number' ? clampScore(value[role]!) : null,
      weight: raterWeights[role],
    })),
  );
  return mean;
}

export function levelOf(score: number, levels: readonly LevelDef[]): LevelDef {
  const sorted = [...levels].sort((a, b) => b.min - a.min);
  return sorted.find((l) => score >= l.min) ?? sorted[sorted.length - 1];
}

/** 由成绩统计自动计算学业类指标 */
export function academicIndicators(stats: readonly SubjectStat[]): Record<string, number> {
  const result: Record<string, number> = {};
  const avgRates = stats.map((s) => s.rate.avg);
  const summary = summarize(avgRates);
  if (!summary) return result;
  result[SYSTEM_INDICATORS.performance] = clampScore(summary.avg);
  if (summary.count >= 2) result[SYSTEM_INDICATORS.balance] = clampScore(100 - 2 * summary.std);
  return result;
}

export function evaluateStudent(
  student: Student,
  framework: EvaluationFramework,
  systemValues: Record<string, number>,
): EvaluationResult {
  const dimensions = framework.dimensions.map((def): DimensionResult => {
    const indicators = def.indicators.map((ind): IndicatorResult => {
      const raw = ind.source === 'system' ? systemValues[ind.id] : student.indicators[ind.id];
      return {
        def: ind,
        score: resolveIndicatorValue(raw, framework.raterWeights),
        raters: raw !== undefined && typeof raw === 'object' ? raw : null,
      };
    });
    const score = weightedMean(indicators.map((i) => ({ value: i.score, weight: i.def.weight })));
    const totalWeight = def.indicators.reduce((a, i) => a + i.weight, 0);
    const covered = indicators.reduce((a, i) => a + (i.score === null ? 0 : i.def.weight), 0);
    return {
      def,
      score,
      level: score === null ? null : levelOf(score, framework.levels),
      indicators,
      coverage: totalWeight > 0 ? covered / totalWeight : 0,
    };
  });

  const composite = weightedMean(dimensions.map((d) => ({ value: d.score, weight: d.def.weight })));
  const totalWeight = framework.dimensions.reduce((a, d) => a + d.weight, 0);
  const covered = dimensions.reduce((a, d) => a + d.def.weight * d.coverage, 0);
  return {
    studentId: student.id,
    composite,
    level: composite === null ? null : levelOf(composite, framework.levels),
    dimensions,
    coverage: totalWeight > 0 ? covered / totalWeight : 0,
  };
}

export interface ClassEvaluation {
  results: Map<string, EvaluationResult>;
  dimensionAverages: Record<string, number | null>;
  compositeAverage: number | null;
  /** 综合分排名（竞赛排名法），无综合分时为 null */
  rankOf(studentId: string): { rank: number; total: number } | null;
}

export function evaluateClass(dataset: Dataset, framework: EvaluationFramework): ClassEvaluation {
  const results = new Map<string, EvaluationResult>();
  for (const student of dataset.students) {
    const stats = studentSubjectStats(dataset, student.id);
    results.set(student.id, evaluateStudent(student, framework, academicIndicators(stats)));
  }

  const all = [...results.values()];
  const mean = (values: (number | null)[]) => summarize(values.filter((v): v is number => v !== null))?.avg ?? null;
  const dimensionAverages: Record<string, number | null> = {};
  framework.dimensions.forEach((d, i) => {
    dimensionAverages[d.id] = mean(all.map((r) => r.dimensions[i].score));
  });
  const composites = all.map((r) => r.composite).filter((v): v is number => v !== null);

  return {
    results,
    dimensionAverages,
    compositeAverage: mean(composites),
    rankOf(studentId) {
      const own = results.get(studentId)?.composite;
      if (own === null || own === undefined) return null;
      return { rank: composites.filter((c) => c > own).length + 1, total: composites.length };
    },
  };
}
