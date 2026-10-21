import type { Dataset, Exam, IndicatorValue, ScoreRecord, Student, Subject } from '../core/types';

/**
 * 演示数据：高二(3)班 40 名学生、6 次考试、6 门学科（3+1+2 物化生组合）。
 * 使用固定随机种子生成，每次加载结果一致；第 1 位学生为手工设定的典型画像。
 */

const SUBJECTS: Subject[] = [
  { id: 'chinese', name: '语文', fullMark: 150 },
  { id: 'math', name: '数学', fullMark: 150 },
  { id: 'english', name: '英语', fullMark: 150 },
  { id: 'physics', name: '物理', fullMark: 100 },
  { id: 'chemistry', name: '化学', fullMark: 100 },
  { id: 'biology', name: '生物', fullMark: 100 },
];

const EXAMS: Exam[] = [
  { id: 'g1-mid-1', name: '高一上期中', date: '2025-11-12', term: '2025–2026 第一学期' },
  { id: 'g1-final-1', name: '高一上期末', date: '2026-01-20', term: '2025–2026 第一学期' },
  { id: 'g1-mid-2', name: '高一下期中', date: '2026-04-22', term: '2025–2026 第二学期' },
  { id: 'g1-final-2', name: '高一下期末', date: '2026-07-02', term: '2025–2026 第二学期' },
  { id: 'g2-sep', name: '高二九月月考', date: '2026-09-26', term: '2026–2027 第一学期' },
  { id: 'g2-oct', name: '高二十月月考', date: '2026-10-17', term: '2026–2027 第一学期' },
];

/** 各科班级平均得分率基准 */
const SUBJECT_BASE: Record<string, number> = {
  chinese: 0.74,
  math: 0.68,
  english: 0.75,
  physics: 0.67,
  chemistry: 0.7,
  biology: 0.73,
};

const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何罗高郑梁谢宋唐许韩冯邓曹彭曾萧田董袁潘蒋蔡余杜'.split('');
const GIVEN = [
  '子涵', '欣怡', '梓轩', '雨桐', '浩然', '诗琪', '宇航', '思远', '一诺', '若曦',
  '俊熙', '语嫣', '明哲', '可馨', '天佑', '佳怡', '博文', '书瑶', '嘉懿', '沐阳',
  '晨曦', '皓轩', '安然', '奕辰', '清妍', '铭泽', '芷若', '景行', '知远', '乐瑶',
  '承泽', '思彤', '睿哲', '雅琪', '泽宇', '梦琪', '煜城', '静姝', '逸凡', '念慈',
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 手工设定的典型学生：英语见长、物理连续下滑、数学波动大、身心健康与创新素养偏弱 */
const FEATURED: { student: Student; scores: Record<string, number[]> } = {
  student: {
    id: '2025030101',
    name: '林知夏',
    indicators: {
      'moral.citizenship': { self: 90, peer: 86, teacher: 88 },
      'moral.integrity': { self: 92, peer: 90, teacher: 93 },
      'moral.responsibility': { self: 85, peer: 88, teacher: 86 },
      'academic.habits': { self: 80, peer: 76, teacher: 74 },
      'health.fitness': 68,
      'health.exercise': 56,
      'health.mental': { self: 72, peer: 78, teacher: 70 },
      'arts.appreciation': { self: 84, peer: 82, teacher: 85 },
      'arts.practice': 80,
      'practice.labor': 82,
      'practice.volunteer': 76,
      'practice.club': { self: 85, peer: 82, teacher: 80 },
      'innovation.research': { self: 70, peer: 66, teacher: 64 },
      'innovation.achievement': 52,
      'innovation.thinking': { self: 76, peer: 72, teacher: 70 },
    },
  },
  scores: {
    chinese: [118, 121, 116, 124, 120, 126],
    math: [112, 84, 116, 93, 119, 97],
    english: [128, 131, 134, 130, 136, 138],
    physics: [74, 71, 66, 63, 58, 55],
    chemistry: [70, 73, 69, 72, 71, 74],
    biology: [80, 78, 83, 81, 84, 82],
  },
};

const RATED_INDICATORS = [
  'moral.citizenship', 'moral.integrity', 'moral.responsibility', 'academic.habits', 'health.mental',
  'arts.appreciation', 'practice.club', 'innovation.research', 'innovation.thinking',
];
const RECORD_INDICATORS = [
  'health.fitness', 'health.exercise', 'arts.practice', 'practice.labor', 'practice.volunteer',
  'innovation.achievement',
];

export function createDemoDataset(): Dataset {
  const rand = mulberry32(20251112);
  const gauss = () => {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // 每次考试各科难度的随机扰动
  const difficulty = new Map<string, number>();
  for (const exam of EXAMS) for (const s of SUBJECTS) difficulty.set(`${exam.id}/${s.id}`, gauss() * 0.03);

  const students: Student[] = [FEATURED.student];
  const scores: ScoreRecord[] = [];
  for (const s of SUBJECTS) {
    FEATURED.scores[s.id].forEach((score, i) => {
      scores.push({ studentId: FEATURED.student.id, examId: EXAMS[i].id, subjectId: s.id, score });
    });
  }

  for (let n = 1; n < 40; n++) {
    const id = `20250301${String(n + 1).padStart(2, '0')}`;
    const name = SURNAMES[n % SURNAMES.length] + GIVEN[(n * 7) % GIVEN.length];
    const ability = gauss() * 0.08;
    const trait = gauss();

    for (const subject of SUBJECTS) {
      const aptitude = gauss() * 0.06;
      const trend = gauss() * 0.01;
      EXAMS.forEach((exam, i) => {
        const rate =
          SUBJECT_BASE[subject.id] +
          difficulty.get(`${exam.id}/${subject.id}`)! +
          ability +
          aptitude +
          trend * (i - 2.5) +
          gauss() * 0.035;
        scores.push({
          studentId: id,
          examId: exam.id,
          subjectId: subject.id,
          score: Math.round(clamp(rate, 0.25, 0.99) * subject.fullMark),
        });
      });
    }

    const indicators: Record<string, IndicatorValue> = {};
    for (const key of RATED_INDICATORS) {
      const base = clamp(79 + trait * 6 + gauss() * 6, 45, 98);
      indicators[key] = {
        self: Math.round(clamp(base + 2 + gauss() * 4, 40, 100)),
        peer: Math.round(clamp(base + gauss() * 4, 40, 100)),
        teacher: Math.round(base),
      };
    }
    for (const key of RECORD_INDICATORS) {
      indicators[key] = Math.round(clamp(76 + trait * 6 + gauss() * 9, 35, 99));
    }
    students.push({ id, name, indicators });
  }

  return {
    version: 1,
    school: '示例中学',
    className: '高二(3)班',
    subjects: SUBJECTS,
    exams: EXAMS,
    students,
    scores,
  };
}
