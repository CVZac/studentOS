import { describe, expect, it } from 'vitest';
import { academicIndicators, evaluateStudent } from '../evaluation';
import { DEFAULT_FRAMEWORK } from '../framework';
import { generateTodos } from '../recommendations';
import { classSubjectStats, studentSubjectStats } from '../scoreStats';
import type { Dataset } from '../types';
import { createDemoDataset } from '../../data/demo';

function todosFor(dataset: Dataset, studentId: string) {
  const student = dataset.students.find((s) => s.id === studentId)!;
  const subjectStats = studentSubjectStats(dataset, studentId);
  return generateTodos({
    evaluation: evaluateStudent(student, DEFAULT_FRAMEWORK, academicIndicators(subjectStats)),
    subjectStats,
    classStats: classSubjectStats(dataset),
    levels: DEFAULT_FRAMEWORK.levels,
  });
}

describe('generateTodos（演示学生林知夏）', () => {
  const dataset = createDemoDataset();
  const todos = todosFor(dataset, dataset.students[0].id);
  const byId = new Map(todos.map((t) => [t.id, t]));

  it('物理连续下滑且低于良好线，多个信号叠加升级为紧急', () => {
    const physics = byId.get('subject:physics')!;
    expect(physics.priority).toBe('P0');
    expect(physics.title).toContain('止跌回稳');
    expect(physics.reasons.some((r) => r.includes('下滑'))).toBe(true);
  });

  it('数学得分率偏低且波动大', () => {
    const math = byId.get('subject:math')!;
    expect(math.priority).toBe('P1');
    expect(math.reasons.some((r) => r.includes('波动'))).toBe(true);
  });

  it('偏科与优势学科', () => {
    expect(byId.get('balance')?.priority).toBe('P1');
    expect(byId.get('strength:english')?.priority).toBe('P2');
  });

  it('低于 60 分的素质指标为紧急，60–75 为重要', () => {
    expect(byId.get('indicator:health.exercise')?.priority).toBe('P0');
    expect(byId.get('indicator:innovation.achievement')?.priority).toBe('P0');
    expect(byId.get('indicator:health.fitness')?.priority).toBe('P1');
    expect(byId.has('indicator:moral.integrity')).toBe(false);
  });

  it('按优先级排序，且 id 唯一', () => {
    const order = { P0: 0, P1: 1, P2: 2 };
    for (let i = 1; i < todos.length; i++) {
      expect(order[todos[i - 1].priority]).toBeLessThanOrEqual(order[todos[i].priority]);
    }
    expect(new Set(todos.map((t) => t.id)).size).toBe(todos.length);
  });

  it('每条待办都有原因、行动与目标', () => {
    for (const t of todos) {
      expect(t.reasons.length).toBeGreaterThan(0);
      expect(t.actions.length).toBeGreaterThan(0);
      expect(t.target.length).toBeGreaterThan(0);
    }
  });
});

describe('generateTodos（边界）', () => {
  it('各项均衡优秀的学生只得到优势保持类待办', () => {
    const dataset: Dataset = {
      version: 1,
      school: '',
      className: '',
      subjects: [
        { id: 'a', name: '语文', fullMark: 100 },
        { id: 'b', name: '数学', fullMark: 100 },
      ],
      exams: [
        { id: 'e1', name: '一', date: '2026-01-01', term: '' },
        { id: 'e2', name: '二', date: '2026-02-01', term: '' },
        { id: 'e3', name: '三', date: '2026-03-01', term: '' },
      ],
      students: [{ id: 's', name: '', indicators: {} }],
      scores: ['e1', 'e2', 'e3'].flatMap((examId) => [
        { studentId: 's', examId, subjectId: 'a', score: 90 },
        { studentId: 's', examId, subjectId: 'b', score: 88 },
      ]),
    };
    const todos = todosFor(dataset, 's');
    expect(todos.map((t) => t.id)).toEqual(['strength:a']);
  });
});
