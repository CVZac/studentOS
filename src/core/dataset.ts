import type { Dataset } from './types';

export type ValidationResult = { ok: true; dataset: Dataset } | { ok: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 校验导入的 JSON 数据集，返回全部错误（最多 20 条）以便一次修正 */
export function validateDataset(input: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (msg: string) => {
    if (errors.length < 20) errors.push(msg);
  };

  if (!isObject(input)) return { ok: false, errors: ['根节点必须是 JSON 对象'] };
  if (input.version !== 1) fail('version 必须为 1');
  for (const key of ['school', 'className'] as const) {
    if (!isNonEmptyString(input[key])) fail(`${key} 必须是非空字符串`);
  }
  for (const key of ['subjects', 'exams', 'students', 'scores'] as const) {
    if (!Array.isArray(input[key])) fail(`${key} 必须是数组`);
  }
  if (errors.length) return { ok: false, errors };

  const subjects = input.subjects as unknown[];
  const exams = input.exams as unknown[];
  const students = input.students as unknown[];
  const scores = input.scores as unknown[];

  const subjectMarks = new Map<string, number>();
  subjects.forEach((s, i) => {
    if (!isObject(s) || !isNonEmptyString(s.id) || !isNonEmptyString(s.name) || !isFiniteNumber(s.fullMark) || s.fullMark <= 0) {
      fail(`subjects[${i}] 需包含 id、name 与正数 fullMark`);
    } else if (subjectMarks.has(s.id)) {
      fail(`subjects[${i}] id 重复：${s.id}`);
    } else {
      subjectMarks.set(s.id, s.fullMark);
    }
  });

  const examIds = new Set<string>();
  exams.forEach((e, i) => {
    if (!isObject(e) || !isNonEmptyString(e.id) || !isNonEmptyString(e.name) || !isNonEmptyString(e.term)) {
      fail(`exams[${i}] 需包含 id、name、term`);
    } else if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
      fail(`exams[${i}] date 需为 YYYY-MM-DD 格式`);
    } else if (examIds.has(e.id)) {
      fail(`exams[${i}] id 重复：${e.id}`);
    } else {
      examIds.add(e.id);
    }
  });

  const studentIds = new Set<string>();
  students.forEach((s, i) => {
    if (!isObject(s) || !isNonEmptyString(s.id) || !isNonEmptyString(s.name)) {
      fail(`students[${i}] 需包含 id 与 name`);
      return;
    }
    if (studentIds.has(s.id)) fail(`students[${i}] id 重复：${s.id}`);
    studentIds.add(s.id);
    if (s.indicators !== undefined && !isObject(s.indicators)) {
      fail(`students[${i}].indicators 必须是对象`);
      return;
    }
    for (const [key, value] of Object.entries((s.indicators as Record<string, unknown>) ?? {})) {
      const values = isObject(value) ? Object.values(value) : [value];
      if (!values.every((v) => isFiniteNumber(v) && v >= 0 && v <= 100)) {
        fail(`students[${i}].indicators.${key} 的分值需在 0–100 之间`);
      }
    }
  });
  if (students.length === 0) fail('students 至少需要 1 名学生');

  scores.forEach((r, i) => {
    if (!isObject(r)) return fail(`scores[${i}] 必须是对象`);
    if (!studentIds.has(r.studentId as string)) return fail(`scores[${i}] studentId 不存在：${String(r.studentId)}`);
    if (!examIds.has(r.examId as string)) return fail(`scores[${i}] examId 不存在：${String(r.examId)}`);
    const fullMark = subjectMarks.get(r.subjectId as string);
    if (fullMark === undefined) return fail(`scores[${i}] subjectId 不存在：${String(r.subjectId)}`);
    if (!isFiniteNumber(r.score) || r.score < 0 || r.score > fullMark) {
      fail(`scores[${i}] score 需在 0–${fullMark} 之间`);
    }
  });

  if (errors.length) return { ok: false, errors };
  const dataset = input as unknown as Dataset;
  return {
    ok: true,
    dataset: { ...dataset, students: dataset.students.map((s) => ({ ...s, indicators: s.indicators ?? {} })) },
  };
}
