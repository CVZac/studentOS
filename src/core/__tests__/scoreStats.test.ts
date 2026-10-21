import { describe, expect, it } from 'vitest';
import {
  classSubjectStats,
  linearTrend,
  studentSubjectStats,
  subjectRank,
  summarize,
  toRate,
  totalRank,
} from '../scoreStats';
import type { Dataset } from '../types';

const dataset: Dataset = {
  version: 1,
  school: '测试中学',
  className: '测试班',
  subjects: [
    { id: 'math', name: '数学', fullMark: 150 },
    { id: 'physics', name: '物理', fullMark: 100 },
  ],
  // 故意乱序，验证按日期排序
  exams: [
    { id: 'e2', name: '期末', date: '2026-01-20', term: 't1' },
    { id: 'e1', name: '期中', date: '2025-11-12', term: 't1' },
    { id: 'e3', name: '月考', date: '2026-03-15', term: 't2' },
  ],
  students: [
    { id: 'a', name: '甲', indicators: {} },
    { id: 'b', name: '乙', indicators: {} },
    { id: 'c', name: '丙', indicators: {} },
  ],
  scores: [
    { studentId: 'a', examId: 'e1', subjectId: 'math', score: 120 },
    { studentId: 'a', examId: 'e2', subjectId: 'math', score: 90 },
    { studentId: 'a', examId: 'e3', subjectId: 'math', score: 105 },
    { studentId: 'a', examId: 'e1', subjectId: 'physics', score: 80 },
    { studentId: 'a', examId: 'e2', subjectId: 'physics', score: 70 },
    { studentId: 'a', examId: 'e3', subjectId: 'physics', score: 60 },
    { studentId: 'b', examId: 'e1', subjectId: 'math', score: 135 },
    { studentId: 'b', examId: 'e1', subjectId: 'physics', score: 70 },
    { studentId: 'c', examId: 'e1', subjectId: 'math', score: 120 },
  ],
};

describe('summarize', () => {
  it('计算最高分、最低分、平均分、极差与总体标准差', () => {
    const s = summarize([90, 120, 105])!;
    expect(s.max).toBe(120);
    expect(s.min).toBe(90);
    expect(s.avg).toBe(105);
    expect(s.range).toBe(30);
    expect(s.std).toBeCloseTo(Math.sqrt(150), 10);
    expect(s.count).toBe(3);
  });

  it('空数组返回 null', () => {
    expect(summarize([])).toBeNull();
  });
});

describe('linearTrend', () => {
  it('返回每步变化量', () => {
    expect(linearTrend([80, 70, 60])).toBeCloseTo(-10);
    expect(linearTrend([1, 2, 3, 4])).toBeCloseTo(1);
  });

  it('少于两个点时为 0', () => {
    expect(linearTrend([88])).toBe(0);
  });
});

describe('studentSubjectStats', () => {
  it('按科目统计成绩区间，并按考试日期排序', () => {
    const [math, physics] = studentSubjectStats(dataset, 'a');
    expect(math.subject.id).toBe('math');
    expect(math.points.map((p) => p.exam.id)).toEqual(['e1', 'e2', 'e3']);
    expect(math.raw).toMatchObject({ max: 120, min: 90, avg: 105, range: 30 });
    expect(math.rate.avg).toBeCloseTo(70);
    expect(math.maxExam.id).toBe('e1');
    expect(math.minExam.id).toBe('e2');
    expect(math.latest.score).toBe(105);

    expect(physics.raw).toMatchObject({ max: 80, min: 60, avg: 70 });
    expect(physics.trend).toBeCloseTo(-10);
  });

  it('支持限定考试范围', () => {
    const [math] = studentSubjectStats(dataset, 'a', ['e2', 'e3']);
    expect(math.raw).toMatchObject({ max: 105, min: 90, count: 2 });
  });

  it('没有成绩的学科不返回', () => {
    expect(studentSubjectStats(dataset, 'c').map((s) => s.subject.id)).toEqual(['math']);
  });
});

describe('classSubjectStats', () => {
  it('汇总班级单次考试各科区间', () => {
    const [math, physics] = classSubjectStats(dataset, ['e1']);
    expect(math.raw).toMatchObject({ max: 135, min: 120, avg: 125, count: 3 });
    expect(math.rate.max).toBeCloseTo(90);
    expect(physics.raw).toMatchObject({ max: 80, min: 70, avg: 75 });
  });
});

describe('排名', () => {
  it('学科排名并列同名次', () => {
    expect(subjectRank(dataset, 'e1', 'math', 'b')).toEqual({ rank: 1, total: 3, score: 135 });
    expect(subjectRank(dataset, 'e1', 'math', 'a')).toEqual({ rank: 2, total: 3, score: 120 });
    expect(subjectRank(dataset, 'e1', 'math', 'c')).toEqual({ rank: 2, total: 3, score: 120 });
  });

  it('总分排名', () => {
    expect(totalRank(dataset, 'e1', 'b')).toEqual({ rank: 1, total: 3, score: 205 });
    expect(totalRank(dataset, 'e1', 'a')).toEqual({ rank: 2, total: 3, score: 200 });
    expect(totalRank(dataset, 'e2', 'b')).toBeNull();
  });
});

it('toRate 按满分折算得分率', () => {
  expect(toRate(120, 150)).toBe(80);
  expect(toRate(5, 0)).toBe(0);
});
