import { describe, expect, it } from 'vitest';
import { academicIndicators, evaluateClass, evaluateStudent, levelOf, resolveIndicatorValue, weightedMean } from '../evaluation';
import { DEFAULT_FRAMEWORK, SYSTEM_INDICATORS } from '../framework';
import type { EvaluationFramework } from '../framework';
import { studentSubjectStats } from '../scoreStats';
import { createDemoDataset } from '../../data/demo';

const weights = DEFAULT_FRAMEWORK.raterWeights;

describe('框架配置', () => {
  it('维度权重合计为 1，维度内指标权重合计为 1', () => {
    const total = DEFAULT_FRAMEWORK.dimensions.reduce((a, d) => a + d.weight, 0);
    expect(total).toBeCloseTo(1);
    for (const d of DEFAULT_FRAMEWORK.dimensions) {
      expect(d.indicators.reduce((a, i) => a + i.weight, 0)).toBeCloseTo(1);
    }
  });

  it('评价主体权重合计为 1', () => {
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('指标 id 全局唯一', () => {
    const ids = DEFAULT_FRAMEWORK.dimensions.flatMap((d) => d.indicators.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('weightedMean', () => {
  it('跳过缺失项并重新归一权重', () => {
    expect(weightedMean([{ value: 80, weight: 0.5 }, { value: null, weight: 0.5 }])).toBe(80);
    expect(weightedMean([{ value: 80, weight: 1 }, { value: 60, weight: 3 }])).toBe(65);
    expect(weightedMean([{ value: null, weight: 1 }])).toBeNull();
  });
});

describe('resolveIndicatorValue', () => {
  it('多主体评价按 2:2:6 加权', () => {
    expect(resolveIndicatorValue({ self: 90, peer: 80, teacher: 70 }, weights)).toBeCloseTo(76);
  });

  it('缺失主体时按剩余权重归一', () => {
    expect(resolveIndicatorValue({ self: 90, teacher: 70 }, weights)).toBeCloseTo(75);
  });

  it('写实记录直接取值并限制在 0–100', () => {
    expect(resolveIndicatorValue(88, weights)).toBe(88);
    expect(resolveIndicatorValue(130, weights)).toBe(100);
    expect(resolveIndicatorValue(undefined, weights)).toBeNull();
    expect(resolveIndicatorValue({}, weights)).toBeNull();
  });
});

describe('levelOf', () => {
  it('按区间下限划分等级', () => {
    const levels = DEFAULT_FRAMEWORK.levels;
    expect(levelOf(92, levels).level).toBe('A');
    expect(levelOf(85, levels).level).toBe('A');
    expect(levelOf(84.9, levels).level).toBe('B');
    expect(levelOf(60, levels).level).toBe('C');
    expect(levelOf(12, levels).level).toBe('D');
  });
});

describe('evaluateStudent', () => {
  const framework: EvaluationFramework = {
    ...DEFAULT_FRAMEWORK,
    dimensions: [
      {
        id: 'x',
        name: 'X',
        short: 'X',
        weight: 0.6,
        description: '',
        indicators: [
          { id: 'x.1', name: '', weight: 0.5, source: 'record', description: '', evidence: '' },
          { id: 'x.2', name: '', weight: 0.5, source: 'system', description: '', evidence: '' },
        ],
      },
      {
        id: 'y',
        name: 'Y',
        short: 'Y',
        weight: 0.4,
        description: '',
        indicators: [{ id: 'y.1', name: '', weight: 1, source: 'rated', description: '', evidence: '' }],
      },
    ],
  };

  it('指标 → 维度 → 综合分逐级加权', () => {
    const result = evaluateStudent(
      { id: 's', name: '', indicators: { 'x.1': 80, 'y.1': { self: 100, peer: 100, teacher: 50 } } },
      framework,
      { 'x.2': 90 },
    );
    expect(result.dimensions[0].score).toBeCloseTo(85);
    expect(result.dimensions[1].score).toBeCloseTo(70);
    expect(result.composite).toBeCloseTo(85 * 0.6 + 70 * 0.4);
    expect(result.level?.level).toBe('B');
    expect(result.coverage).toBeCloseTo(1);
  });

  it('未评价的维度不计入综合分，并反映在覆盖率上', () => {
    const result = evaluateStudent({ id: 's', name: '', indicators: { 'x.1': 80 } }, framework, {});
    expect(result.dimensions[1].score).toBeNull();
    expect(result.dimensions[1].level).toBeNull();
    expect(result.composite).toBeCloseTo(80);
    expect(result.coverage).toBeCloseTo(0.3);
  });
});

describe('academicIndicators', () => {
  it('学科成绩取平均得分率，学科均衡 = 100 − 2 × 标准差', () => {
    const dataset = createDemoDataset();
    const stats = studentSubjectStats(dataset, dataset.students[0].id);
    const values = academicIndicators(stats);
    const avgs = stats.map((s) => s.rate.avg);
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const std = Math.sqrt(avgs.reduce((a, v) => a + (v - mean) ** 2, 0) / avgs.length);
    expect(values[SYSTEM_INDICATORS.performance]).toBeCloseTo(mean);
    expect(values[SYSTEM_INDICATORS.balance]).toBeCloseTo(100 - 2 * std);
  });

  it('只有一门学科时不计算均衡度', () => {
    const dataset = createDemoDataset();
    const stats = studentSubjectStats(dataset, dataset.students[0].id).slice(0, 1);
    expect(academicIndicators(stats)[SYSTEM_INDICATORS.balance]).toBeUndefined();
  });
});

describe('evaluateClass', () => {
  it('计算全班结果、维度均值与排名', () => {
    const dataset = createDemoDataset();
    const cls = evaluateClass(dataset, DEFAULT_FRAMEWORK);
    expect(cls.results.size).toBe(dataset.students.length);
    for (const d of DEFAULT_FRAMEWORK.dimensions) {
      expect(cls.dimensionAverages[d.id]).toBeGreaterThan(0);
    }
    const ranks = dataset.students.map((s) => cls.rankOf(s.id)!.rank);
    expect(Math.min(...ranks)).toBe(1);
    expect(Math.max(...ranks)).toBeLessThanOrEqual(dataset.students.length);
    expect(cls.rankOf('不存在')).toBeNull();
  });
});
