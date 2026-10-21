import { describe, expect, it } from 'vitest';
import { rangeDomain } from '../RangeChart';
import type { RangeRow } from '../RangeChart';

const row = (min: number, marks: number[] = []): RangeRow => ({
  id: String(min),
  label: '',
  min,
  max: 100,
  tone: 'accent',
  marks: marks.map((value) => ({ value, kind: 'dot', tone: 'accent' })),
  value: null,
  tooltip: { title: '', rows: [] },
});

describe('rangeDomain', () => {
  it('数据集中在高分段时放大到 10 分刻度', () => {
    expect(rangeDomain([row(62), row(55)])).toEqual({ lo: 50, step: 10 });
  });

  it('跨度较大时使用 20 分刻度，下限对齐刻度', () => {
    expect(rangeDomain([row(33)])).toEqual({ lo: 20, step: 20 });
  });

  it('参照标记也计入下限', () => {
    expect(rangeDomain([row(80, [52])])).toEqual({ lo: 40, step: 10 });
  });

  it('无数据时回退到 0–100', () => {
    expect(rangeDomain([])).toEqual({ lo: 0, step: 20 });
  });
});
