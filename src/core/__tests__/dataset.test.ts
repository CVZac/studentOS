import { describe, expect, it } from 'vitest';
import { validateDataset } from '../dataset';
import { createDemoDataset } from '../../data/demo';

describe('validateDataset', () => {
  it('演示数据集可通过校验（含 JSON 往返）', () => {
    const result = validateDataset(JSON.parse(JSON.stringify(createDemoDataset())));
    expect(result.ok).toBe(true);
  });

  it('拒绝非对象', () => {
    expect(validateDataset([])).toEqual({ ok: false, errors: ['根节点必须是 JSON 对象'] });
  });

  it('报告引用不存在与分数越界', () => {
    const data = createDemoDataset();
    data.scores[0] = { ...data.scores[0], examId: 'nope' };
    data.scores[1] = { ...data.scores[1], score: 999 };
    const result = validateDataset(data);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('examId 不存在'))).toBe(true);
      expect(result.errors.some((e) => e.includes('score 需在'))).toBe(true);
    }
  });

  it('报告指标分值越界与重复 id', () => {
    const data = createDemoDataset();
    data.students[1] = { ...data.students[1], id: data.students[0].id, indicators: { 'health.fitness': 120 } };
    const result = validateDataset(data);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('id 重复'))).toBe(true);
      expect(result.errors.some((e) => e.includes('0–100'))).toBe(true);
    }
  });

  it('补全缺省的 indicators 字段', () => {
    const data = createDemoDataset();
    const raw = JSON.parse(JSON.stringify(data));
    delete raw.students[0].indicators;
    const result = validateDataset(raw);
    expect(result.ok && result.dataset.students[0].indicators).toEqual({});
  });
});
