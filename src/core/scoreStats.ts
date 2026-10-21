import type { Dataset, Exam, ScoreRecord, Subject } from './types';

/** 一组分数的描述统计 */
export interface Summary {
  count: number;
  max: number;
  min: number;
  avg: number;
  /** 极差 = 最高分 − 最低分 */
  range: number;
  /** 总体标准差 */
  std: number;
}

export interface ExamPoint {
  exam: Exam;
  score: number;
  /** 得分率（%） */
  rate: number;
}

/** 单个学生某学科跨多次考试的成绩区间 */
export interface SubjectStat {
  subject: Subject;
  /** 按考试日期升序 */
  points: ExamPoint[];
  raw: Summary;
  rate: Summary;
  maxExam: Exam;
  minExam: Exam;
  latest: ExamPoint;
  /** 得分率线性趋势：平均每次考试变化的百分点，少于 2 次考试时为 0 */
  trend: number;
}

/** 班级某学科在指定考试范围内的成绩区间 */
export interface ClassSubjectStat {
  subject: Subject;
  raw: Summary;
  rate: Summary;
}

export function summarize(values: readonly number[]): Summary | null {
  if (values.length === 0) return null;
  let max = -Infinity;
  let min = Infinity;
  let sum = 0;
  for (const v of values) {
    if (v > max) max = v;
    if (v < min) min = v;
    sum += v;
  }
  const avg = sum / values.length;
  const variance = values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / values.length;
  return { count: values.length, max, min, avg, range: max - min, std: Math.sqrt(variance) };
}

/** 最小二乘斜率，x 取 0..n-1 */
export function linearTrend(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  return num / den;
}

export function toRate(score: number, fullMark: number): number {
  return fullMark > 0 ? (score / fullMark) * 100 : 0;
}

export function sortExams(exams: readonly Exam[]): Exam[] {
  return [...exams].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function selectRecords(dataset: Dataset, examIds?: readonly string[]): ScoreRecord[] {
  if (!examIds) return dataset.scores;
  const allowed = new Set(examIds);
  return dataset.scores.filter((r) => allowed.has(r.examId));
}

/** 学生各科成绩区间：最高分、最低分、平均分、极差、标准差与趋势 */
export function studentSubjectStats(
  dataset: Dataset,
  studentId: string,
  examIds?: readonly string[],
): SubjectStat[] {
  const examOrder = new Map(sortExams(dataset.exams).map((e, i) => [e.id, i] as const));
  const examById = new Map(dataset.exams.map((e) => [e.id, e] as const));
  const records = selectRecords(dataset, examIds).filter((r) => r.studentId === studentId);

  const stats: SubjectStat[] = [];
  for (const subject of dataset.subjects) {
    const points = records
      .filter((r) => r.subjectId === subject.id && examById.has(r.examId))
      .sort((a, b) => examOrder.get(a.examId)! - examOrder.get(b.examId)!)
      .map((r) => ({
        exam: examById.get(r.examId)!,
        score: r.score,
        rate: toRate(r.score, subject.fullMark),
      }));
    if (points.length === 0) continue;

    const raw = summarize(points.map((p) => p.score))!;
    const rate = summarize(points.map((p) => p.rate))!;
    // 并列时取最近一次，更能反映当前状态
    const maxPoint = points.reduce((best, p) => (p.score >= best.score ? p : best));
    const minPoint = points.reduce((worst, p) => (p.score <= worst.score ? p : worst));
    stats.push({
      subject,
      points,
      raw,
      rate,
      maxExam: maxPoint.exam,
      minExam: minPoint.exam,
      latest: points[points.length - 1],
      trend: linearTrend(points.map((p) => p.rate)),
    });
  }
  return stats;
}

/** 班级各科成绩区间（汇总指定考试范围内全部学生的成绩记录） */
export function classSubjectStats(dataset: Dataset, examIds?: readonly string[]): ClassSubjectStat[] {
  const records = selectRecords(dataset, examIds);
  const stats: ClassSubjectStat[] = [];
  for (const subject of dataset.subjects) {
    const scores = records.filter((r) => r.subjectId === subject.id).map((r) => r.score);
    const raw = summarize(scores);
    if (!raw) continue;
    stats.push({
      subject,
      raw,
      rate: summarize(scores.map((s) => toRate(s, subject.fullMark)))!,
    });
  }
  return stats;
}

export interface RankResult {
  rank: number;
  total: number;
  score: number;
}

/** 竞赛排名法：并列同名次，下一名次顺延 */
function rankIn(scores: Map<string, number>, studentId: string): RankResult | null {
  const score = scores.get(studentId);
  if (score === undefined) return null;
  let higher = 0;
  for (const s of scores.values()) if (s > score) higher++;
  return { rank: higher + 1, total: scores.size, score };
}

export function subjectRank(
  dataset: Dataset,
  examId: string,
  subjectId: string,
  studentId: string,
): RankResult | null {
  const scores = new Map<string, number>();
  for (const r of dataset.scores) {
    if (r.examId === examId && r.subjectId === subjectId) scores.set(r.studentId, r.score);
  }
  return rankIn(scores, studentId);
}

/** 某次考试的总分（仅统计该学生有成绩的科目） */
export function examTotals(dataset: Dataset, examId: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of dataset.scores) {
    if (r.examId === examId) totals.set(r.studentId, (totals.get(r.studentId) ?? 0) + r.score);
  }
  return totals;
}

export function totalRank(dataset: Dataset, examId: string, studentId: string): RankResult | null {
  return rankIn(examTotals(dataset, examId), studentId);
}
