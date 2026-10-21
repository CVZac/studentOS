/** 评价主体：学生自评 / 同伴互评 / 教师评价 */
export type RaterRole = 'self' | 'peer' | 'teacher';

/** 多主体评分，缺失的主体不参与加权 */
export type RatedValue = Partial<Record<RaterRole, number>>;

/** 指标原始值：客观记录为单个分数（0–100），主观评价为多主体评分 */
export type IndicatorValue = number | RatedValue;

export interface Subject {
  id: string;
  name: string;
  /** 满分，如语数英 150、其余 100 */
  fullMark: number;
}

export interface Exam {
  id: string;
  name: string;
  /** ISO 日期 YYYY-MM-DD，用于排序 */
  date: string;
  term: string;
}

export interface ScoreRecord {
  studentId: string;
  examId: string;
  subjectId: string;
  score: number;
}

export interface Student {
  id: string;
  name: string;
  /** 以指标 id 为键的综合素质原始数据，学业类指标由成绩自动计算，无需填写 */
  indicators: Record<string, IndicatorValue>;
}

/** Student OS 的完整数据集，也是导入 / 导出 JSON 的格式 */
export interface Dataset {
  version: 1;
  school: string;
  className: string;
  subjects: Subject[];
  exams: Exam[];
  students: Student[];
  scores: ScoreRecord[];
}
