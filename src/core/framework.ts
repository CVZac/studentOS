import type { RaterRole } from './types';

/**
 * 指标数据来源
 * - system：由系统根据成绩数据自动计算
 * - record：客观写实记录（体测、时长、获奖等），折算为 0–100 分
 * - rated：多主体评价（自评 / 互评 / 师评）加权
 */
export type IndicatorSource = 'system' | 'record' | 'rated';

export type Level = 'A' | 'B' | 'C' | 'D';

export interface IndicatorDef {
  id: string;
  name: string;
  /** 在所属维度内的权重，同一维度内合计为 1 */
  weight: number;
  source: IndicatorSource;
  description: string;
  /** 评价依据 / 佐证材料 */
  evidence: string;
}

export interface DimensionDef {
  id: string;
  name: string;
  /** 雷达图轴标签 */
  short: string;
  /** 在综合分中的权重，所有维度合计为 1 */
  weight: number;
  description: string;
  indicators: IndicatorDef[];
}

export interface LevelDef {
  level: Level;
  label: string;
  /** 区间下限（含） */
  min: number;
  description: string;
}

export interface EvaluationFramework {
  name: string;
  version: string;
  basis: string[];
  principles: { title: string; description: string }[];
  dimensions: DimensionDef[];
  levels: LevelDef[];
  raterWeights: Record<RaterRole, number>;
  process: { title: string; description: string }[];
}

export const RATER_LABELS: Record<RaterRole, string> = {
  self: '自评',
  peer: '互评',
  teacher: '师评',
};

export const SOURCE_LABELS: Record<IndicatorSource, string> = {
  system: '系统计算',
  record: '写实记录',
  rated: '多主体评价',
};

/** 系统自动计算的指标 id，见 evaluation.ts 中的 academicIndicators */
export const SYSTEM_INDICATORS = {
  performance: 'academic.performance',
  balance: 'academic.balance',
} as const;

export const DEFAULT_FRAMEWORK: EvaluationFramework = {
  name: '学生综合素质评价体系',
  version: '1.0',
  basis: [
    '《深化新时代教育评价改革总体方案》（中共中央、国务院，2020）',
    '《关于加强和改进普通高中学生综合素质评价的意见》（教育部，2014）',
    '《中国学生发展核心素养》（2016）',
    '《国家学生体质健康标准（2014 年修订）》',
  ],
  principles: [
    { title: '结果与过程并重', description: '既看考试结果，也记录日常写实与成长过程。' },
    { title: '多主体参与', description: '自评、互评、师评按权重融合，减少单一评价偏差。' },
    { title: '增值导向', description: '关注每位学生相对自身的进步趋势，而不仅是横向排名。' },
    { title: '以评促改', description: '评价结果自动转化为可执行的提升待办，形成闭环。' },
  ],
  dimensions: [
    {
      id: 'moral',
      name: '思想品德',
      short: '思想品德',
      weight: 0.15,
      description: '理想信念、公民素养、诚信守纪与责任担当。',
      indicators: [
        {
          id: 'moral.citizenship',
          name: '理想信念与公民素养',
          weight: 0.35,
          source: 'rated',
          description: '热爱祖国、遵纪守法，关心时事，积极参加主题教育与团队活动。',
          evidence: '主题活动记录、班主任评语',
        },
        {
          id: 'moral.integrity',
          name: '诚信守纪',
          weight: 0.35,
          source: 'rated',
          description: '遵守校规校纪，诚实守信，考试无违纪。',
          evidence: '考勤与违纪记录、同伴评价',
        },
        {
          id: 'moral.responsibility',
          name: '责任担当',
          weight: 0.3,
          source: 'rated',
          description: '承担班级与学校事务，关爱集体与他人。',
          evidence: '班团干部任职、集体活动记录',
        },
      ],
    },
    {
      id: 'academic',
      name: '学业水平',
      short: '学业水平',
      weight: 0.3,
      description: '学科成绩、学科均衡度与学习习惯。',
      indicators: [
        {
          id: SYSTEM_INDICATORS.performance,
          name: '学科成绩',
          weight: 0.6,
          source: 'system',
          description: '各学科平均得分率的均值，由历次考试成绩自动计算。',
          evidence: '历次考试成绩',
        },
        {
          id: SYSTEM_INDICATORS.balance,
          name: '学科均衡',
          weight: 0.2,
          source: 'system',
          description: '各学科平均得分率的离散程度，差距越小得分越高（100 − 2 × 标准差）。',
          evidence: '各科得分率标准差',
        },
        {
          id: 'academic.habits',
          name: '学习习惯',
          weight: 0.2,
          source: 'rated',
          description: '预习复习、课堂专注、作业质量与错题整理。',
          evidence: '作业记录、任课教师评价',
        },
      ],
    },
    {
      id: 'health',
      name: '身心健康',
      short: '身心健康',
      weight: 0.15,
      description: '体质健康水平、运动习惯与心理素质。',
      indicators: [
        {
          id: 'health.fitness',
          name: '体质健康',
          weight: 0.4,
          source: 'record',
          description: '《国家学生体质健康标准》测试综合得分。',
          evidence: '年度体测成绩',
        },
        {
          id: 'health.exercise',
          name: '运动习惯',
          weight: 0.3,
          source: 'record',
          description: '每周锻炼频次与时长，体育课与大课间参与情况。',
          evidence: '运动打卡记录',
        },
        {
          id: 'health.mental',
          name: '心理素质',
          weight: 0.3,
          source: 'rated',
          description: '情绪管理、抗压能力与人际交往。',
          evidence: '心理测评、班主任观察',
        },
      ],
    },
    {
      id: 'arts',
      name: '艺术素养',
      short: '艺术素养',
      weight: 0.1,
      description: '审美鉴赏、艺术修养与艺术实践。',
      indicators: [
        {
          id: 'arts.appreciation',
          name: '审美与艺术修养',
          weight: 0.5,
          source: 'rated',
          description: '艺术课程学习表现与审美鉴赏能力。',
          evidence: '音乐、美术课程表现',
        },
        {
          id: 'arts.practice',
          name: '艺术实践',
          weight: 0.5,
          source: 'record',
          description: '参与艺术社团、展演、比赛及特长发展。',
          evidence: '展演与获奖记录',
        },
      ],
    },
    {
      id: 'practice',
      name: '社会实践',
      short: '社会实践',
      weight: 0.15,
      description: '劳动实践、志愿服务与社团活动。',
      indicators: [
        {
          id: 'practice.labor',
          name: '劳动实践',
          weight: 0.35,
          source: 'record',
          description: '日常劳动、校园值日与劳动教育课程。',
          evidence: '劳动清单、值日记录',
        },
        {
          id: 'practice.volunteer',
          name: '志愿服务',
          weight: 0.35,
          source: 'record',
          description: '志愿服务时长与服务质量。',
          evidence: '志愿服务时长证明',
        },
        {
          id: 'practice.club',
          name: '社团与集体活动',
          weight: 0.3,
          source: 'rated',
          description: '社团参与度与贡献。',
          evidence: '社团考核记录',
        },
      ],
    },
    {
      id: 'innovation',
      name: '创新素养',
      short: '创新素养',
      weight: 0.15,
      description: '研究性学习、科创成果与批判性思维。',
      indicators: [
        {
          id: 'innovation.research',
          name: '研究性学习',
          weight: 0.4,
          source: 'rated',
          description: '课题研究、项目式学习的过程与成果。',
          evidence: '研究报告、结题答辩',
        },
        {
          id: 'innovation.achievement',
          name: '科创成果',
          weight: 0.3,
          source: 'record',
          description: '科技创新、学科竞赛等成果。',
          evidence: '获奖证书、作品',
        },
        {
          id: 'innovation.thinking',
          name: '批判与创新思维',
          weight: 0.3,
          source: 'rated',
          description: '提出问题、多角度分析与创造性解决问题。',
          evidence: '课堂表现、任课教师评价',
        },
      ],
    },
  ],
  levels: [
    { level: 'A', label: '优秀', min: 85, description: '表现突出，可作为同伴示范。' },
    { level: 'B', label: '良好', min: 75, description: '整体达标，个别方面仍有提升空间。' },
    { level: 'C', label: '合格', min: 60, description: '达到基本要求，需要有针对性地改进。' },
    { level: 'D', label: '待提升', min: 0, description: '尚未达到基本要求，需优先干预。' },
  ],
  raterWeights: { self: 0.2, peer: 0.2, teacher: 0.6 },
  process: [
    { title: '写实记录', description: '学生与教师持续记录活动、成果与表现。' },
    { title: '整理遴选', description: '每学期末遴选代表性材料，系统汇总成绩数据。' },
    { title: '公示审核', description: '评价结果班级公示，接受申诉与复核。' },
    { title: '形成档案', description: '生成综合素质档案与雷达画像。' },
    { title: '反馈改进', description: '依据薄弱项自动生成提升待办，跟踪完成情况。' },
  ],
};
