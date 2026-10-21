import type { EvaluationResult } from './evaluation';
import type { LevelDef } from './framework';
import type { ClassSubjectStat, SubjectStat } from './scoreStats';

export type Priority = 'P0' | 'P1' | 'P2';
export type TodoKind = 'subject' | 'balance' | 'strength' | 'indicator';

export interface TodoItem {
  /** 稳定 id，用于持久化完成状态 */
  id: string;
  kind: TodoKind;
  priority: Priority;
  title: string;
  /** 归属：学科名或「维度 · 指标」 */
  scope: string;
  /** 触发原因（含数据依据） */
  reasons: string[];
  /** 可执行的行动步骤 */
  actions: string[];
  /** 可量化的目标 */
  target: string;
  horizon: string;
  /** 同优先级内的排序依据，越大越靠前 */
  severity: number;
}

/** 规则阈值，单位均为得分率百分点或 0–100 分 */
export const THRESHOLDS = {
  subjectCritical: 60,
  subjectWeak: 70,
  subjectStrong: 85,
  /** 得分率每次考试下降超过该值视为下滑 */
  decline: -2,
  /** 得分率标准差超过该值视为波动大 */
  volatile: 8,
  /** 低于班级平均超过该值 */
  belowClass: 5,
  /** 最强与最弱学科得分率差距 */
  imbalance: 20,
  indicatorCritical: 60,
  indicatorWeak: 75,
  /** 每个维度最多生成的指标待办数（取最弱的几项） */
  indicatorsPerDimension: 2,
  /** 趋势判断所需的最少考试次数 */
  trendMinExams: 3,
} as const;

export const PRIORITY_META: Record<Priority, { label: string; horizon: string }> = {
  P0: { label: '紧急', horizon: '2 周内启动' },
  P1: { label: '重要', horizon: '本月内完成' },
  P2: { label: '持续', horizon: '本学期坚持' },
};

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };

const SUBJECT_PLAYBOOK: Record<string, string[]> = {
  语文: [
    '每天 20 分钟课外阅读并摘录，积累作文素材',
    '每周 2 篇现代文阅读限时训练，对照答案提炼答题思路',
    '整理古诗文默写易错字清单，考前滚动复习',
  ],
  数学: [
    '建立错题本，按「概念 / 计算 / 思路」标注错因',
    '每周 1 套基础题限时训练，确保中低档题稳定拿分',
    '薄弱章节回归课本例题，再完成 10 道同类题',
  ],
  英语: [
    '每天背诵 30 个高频词，并在阅读语境中复现',
    '每周 3 篇阅读理解 + 1 篇完形填空限时训练',
    '每周写 1 篇作文，对照范文积累高级句型',
  ],
  物理: [
    '回归课本梳理公式推导与适用条件',
    '按力学、电磁学专题整理典型模型与受力分析图',
    '每道错题写出完整物理过程分析，一周后重做',
  ],
  化学: [
    '整理方程式与反应条件清单，每日默写 10 个',
    '实验题按「原理—装置—操作—现象」四步归纳',
    '推断题专题训练，总结常见突破口',
  ],
  生物: [
    '用思维导图串联章节核心概念',
    '实验设计题专项训练，掌握对照与变量控制',
    '遗传题按题型分类练习并总结解题步骤',
  ],
  政治: ['按模块梳理核心观点与原理', '主观题训练：先审设问，再对应教材知识点作答'],
  历史: ['按时间轴梳理各阶段特征', '材料题训练：先概括材料，再联系教材观点'],
  地理: ['每天 1 张地图读图训练', '整理自然地理原理图示与区域地理特征表'],
};

const DEFAULT_SUBJECT_ACTIONS = [
  '梳理薄弱章节知识框架，回归课本基础',
  '每周 2 次专项练习并整理错题',
  '预约任课教师答疑，制定针对性练习清单',
];

const INDICATOR_PLAYBOOK: Record<string, { title: string; actions: string[] }> = {
  'moral.citizenship': {
    title: '提升公民素养',
    actions: ['每周关注 2 条时事新闻并在班会分享观点', '积极参加主题团日、升旗仪式等活动并做好记录'],
  },
  'moral.integrity': {
    title: '强化诚信守纪',
    actions: ['对照校规梳理个人违纪风险点，写下改进承诺', '按时独立完成作业，杜绝抄袭'],
  },
  'moral.responsibility': {
    title: '主动承担集体责任',
    actions: ['本学期至少承担 1 项班级或社团职务', '主动参与班级值日与集体活动组织'],
  },
  'academic.habits': {
    title: '养成高效学习习惯',
    actions: ['课前 10 分钟预习并标注疑问点', '每天睡前用 15 分钟回顾当日笔记', '每周日集中整理一次错题本'],
  },
  'health.fitness': {
    title: '针对体测短板专项训练',
    actions: [
      '对照体测单项成绩找出得分最低的 2 项',
      '每周 3 次针对性训练（耐力跑、力量、柔韧）',
      '每月自测一次并记录变化',
    ],
  },
  'health.exercise': {
    title: '建立规律运动习惯',
    actions: ['每周至少 3 次、每次 30 分钟中等强度运动', '每次运动后打卡记录', '认真参与体育课与大课间活动'],
  },
  'health.mental': {
    title: '提升情绪与压力管理能力',
    actions: ['每天记录情绪日志，识别压力来源', '练习腹式呼吸、正念等放松方法', '必要时预约学校心理老师交流'],
  },
  'arts.appreciation': {
    title: '提升审美与艺术修养',
    actions: ['每月欣赏 1 场展览或音乐会并写观后感', '认真完成音乐、美术课程作品'],
  },
  'arts.practice': {
    title: '参与艺术实践',
    actions: ['加入 1 个艺术类社团或兴趣小组', '本学期参加至少 1 次校内艺术展演'],
  },
  'practice.labor': {
    title: '加强劳动实践',
    actions: ['每周承担 2 项固定家务并记录', '认真完成校园值日与劳动教育课程'],
  },
  'practice.volunteer': {
    title: '增加志愿服务',
    actions: ['本学期累计志愿服务不少于 20 小时', '选择 1 个长期志愿项目持续参与'],
  },
  'practice.club': {
    title: '深度参与社团活动',
    actions: ['在所属社团中承担 1 项具体任务', '本学期主导或协助组织 1 次社团活动'],
  },
  'innovation.research': {
    title: '完成一个研究性学习课题',
    actions: [
      '与 2–3 位同学组队，选定一个真实问题',
      '按「选题—文献—方案—实施—结题」推进并定期记录',
      '学期末完成研究报告与答辩',
    ],
  },
  'innovation.achievement': {
    title: '争取科创与竞赛成果',
    actions: ['结合优势学科选择 1 项竞赛或科创比赛', '联系指导老师，制定备赛时间表', '参加校级科技节并提交作品'],
  },
  'innovation.thinking': {
    title: '训练批判与创新思维',
    actions: ['每周在课堂上至少提出 1 个有深度的问题', '阅读时尝试写下「反方观点」', '参加辩论、模拟联合国等思辨类活动'],
  },
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface RecommendationInput {
  evaluation: EvaluationResult;
  subjectStats: readonly SubjectStat[];
  /** 班级同范围成绩，用于对比 */
  classStats: readonly ClassSubjectStat[];
  levels: readonly LevelDef[];
}

interface Signal {
  priority: Priority;
  reason: string;
  titlePart?: string;
  actions?: string[];
}

function subjectTodo(stat: SubjectStat, classAvgRate: number | undefined): TodoItem | null {
  const { subject, rate, trend, latest } = stat;
  const signals: Signal[] = [];
  const avg = rate.avg;

  if (avg < THRESHOLDS.subjectCritical) {
    signals.push({
      priority: 'P0',
      reason: `平均得分率 ${r1(avg)}%，低于合格线 ${THRESHOLDS.subjectCritical}%`,
      titlePart: '夯实基础',
    });
  } else if (avg < THRESHOLDS.subjectWeak) {
    signals.push({
      priority: 'P1',
      reason: `平均得分率 ${r1(avg)}%，低于良好线 ${THRESHOLDS.subjectWeak}%`,
      titlePart: '查漏补缺',
    });
  }
  if (stat.points.length >= THRESHOLDS.trendMinExams && trend <= THRESHOLDS.decline) {
    signals.unshift({
      priority: 'P1',
      reason: `近 ${stat.points.length} 次考试得分率持续下滑，平均每次 ${r1(trend)} 个百分点`,
      titlePart: '止跌回稳',
      actions: ['对比近两次试卷，定位新增失分章节并优先补齐'],
    });
  }
  if (latest.rate < THRESHOLDS.subjectCritical && avg >= THRESHOLDS.subjectCritical) {
    signals.push({
      priority: 'P1',
      reason: `最近一次（${latest.exam.name}）仅 ${latest.score} 分，未达合格线`,
    });
  }
  if (classAvgRate !== undefined && avg < classAvgRate - THRESHOLDS.belowClass) {
    signals.push({
      priority: 'P1',
      reason: `低于班级平均 ${r1(classAvgRate - avg)} 个百分点`,
      titlePart: '追赶班级平均',
      actions: ['与同水平同学组成学习小组，每周互讲 2 道错题'],
    });
  }
  if (rate.std >= THRESHOLDS.volatile) {
    signals.push({
      priority: 'P2',
      reason: `成绩波动较大：最高 ${stat.raw.max} 分、最低 ${stat.raw.min} 分，得分率标准差 ${r1(rate.std)}`,
      titlePart: '提升稳定性',
      actions: ['每周 1 次整卷限时训练，固定答题顺序与时间分配', '考后 24 小时内复盘，区分「会而错」与「不会」'],
    });
  }
  if (signals.length === 0) return null;

  // 两个及以上「重要」信号叠加时升级为紧急
  let priority = signals.reduce<Priority>(
    (p, s) => (PRIORITY_ORDER[s.priority] < PRIORITY_ORDER[p] ? s.priority : p),
    'P2',
  );
  if (priority === 'P1' && signals.filter((s) => s.priority === 'P1').length >= 2) priority = 'P0';

  const parts = signals.map((s) => s.titlePart).filter((p): p is string => Boolean(p));
  const goalRate =
    avg < THRESHOLDS.subjectCritical
      ? THRESHOLDS.subjectCritical
      : avg < THRESHOLDS.subjectWeak
        ? THRESHOLDS.subjectWeak
        : Math.min(100, Math.ceil(avg + 3));
  const goalScore = Math.ceil((goalRate / 100) * subject.fullMark);
  const onlyVolatile = signals.every((s) => s.priority === 'P2');

  return {
    id: `subject:${subject.id}`,
    kind: 'subject',
    priority,
    title: `${subject.name}：${(parts.length ? parts : ['重点关注']).slice(0, 2).join('，')}`,
    scope: subject.name,
    reasons: signals.map((s) => s.reason),
    actions: [
      ...signals.flatMap((s) => s.actions ?? []),
      ...(SUBJECT_PLAYBOOK[subject.name] ?? DEFAULT_SUBJECT_ACTIONS),
    ].slice(0, 5),
    target: onlyVolatile
      ? `连续两次考试不低于 ${Math.floor((avg / 100) * subject.fullMark)} 分（当前平均水平）`
      : `下次考试达到 ${goalScore} 分（得分率 ${goalRate}%，满分 ${subject.fullMark}）`,
    horizon: PRIORITY_META[priority].horizon,
    severity: Math.max(0, THRESHOLDS.subjectWeak - avg) + Math.max(0, -trend) * 3 + signals.length * 4,
  };
}

function balanceTodo(stats: readonly SubjectStat[]): TodoItem | null {
  if (stats.length < 2) return null;
  const sorted = [...stats].sort((a, b) => b.rate.avg - a.rate.avg);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const gap = best.rate.avg - worst.rate.avg;
  if (gap < THRESHOLDS.imbalance) return null;
  return {
    id: 'balance',
    kind: 'balance',
    priority: 'P1',
    title: '学科均衡：缩小强弱学科差距',
    scope: '学业水平 · 学科均衡',
    reasons: [
      `最强学科${best.subject.name} ${r1(best.rate.avg)}%，最弱学科${worst.subject.name} ${r1(worst.rate.avg)}%，相差 ${r1(gap)} 个百分点`,
    ],
    actions: [
      `每周学习时间向${worst.subject.name}倾斜 2–3 小时`,
      `用${best.subject.name}的学习方法反思${worst.subject.name}的学习策略`,
      '每两周复盘一次各科得分率变化',
    ],
    target: `将强弱学科差距缩小到 ${Math.max(THRESHOLDS.imbalance - 5, Math.round(gap - 8))} 个百分点以内`,
    horizon: PRIORITY_META.P1.horizon,
    severity: gap,
  };
}

function strengthTodo(stats: readonly SubjectStat[]): TodoItem | null {
  const best = [...stats].sort((a, b) => b.rate.avg - a.rate.avg)[0];
  if (!best || best.rate.avg < THRESHOLDS.subjectStrong) return null;
  return {
    id: `strength:${best.subject.id}`,
    kind: 'strength',
    priority: 'P2',
    title: `发挥优势：${best.subject.name}冲刺高分段`,
    scope: best.subject.name,
    reasons: [`平均得分率 ${r1(best.rate.avg)}%，为当前最强学科`],
    actions: ['保持现有练习节奏，每周 1 次难题拓展', '尝试参加学科竞赛或拓展阅读', '与同学分享学习方法，以教促学'],
    target: `保持得分率不低于 ${Math.floor(best.rate.avg)}%`,
    horizon: PRIORITY_META.P2.horizon,
    severity: 0,
  };
}

function indicatorTodos(evaluation: EvaluationResult, levels: readonly LevelDef[]): TodoItem[] {
  const todos: TodoItem[] = [];
  const nextLevel = (min: number) => levels.find((l) => l.min === min);
  for (const dim of evaluation.dimensions) {
    const weakDimension = dim.score !== null && dim.score < THRESHOLDS.indicatorWeak;
    const candidates = dim.indicators
      .filter((ind): ind is typeof ind & { score: number } => {
        // 学业成绩与均衡由学科待办覆盖
        if (ind.def.source === 'system' || ind.score === null) return false;
        // 维度整体达标时，只对不合格的指标生成待办，避免待办过多失去焦点
        return ind.score < THRESHOLDS.indicatorCritical || (weakDimension && ind.score < THRESHOLDS.indicatorWeak);
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, THRESHOLDS.indicatorsPerDimension);
    for (const ind of candidates) {
      const critical = ind.score < THRESHOLDS.indicatorCritical;
      const priority: Priority = critical ? 'P0' : 'P1';
      const goal = critical ? THRESHOLDS.indicatorCritical : THRESHOLDS.indicatorWeak;
      const playbook = INDICATOR_PLAYBOOK[ind.def.id];
      const reasons = [`「${ind.def.name}」得分 ${r1(ind.score)}，低于 ${goal} 分`];
      if (dim.score !== null && dim.level) {
        reasons.push(`所属维度「${dim.def.name}」${r1(dim.score)} 分，等级 ${dim.level.level}（${dim.level.label}）`);
      }
      todos.push({
        id: `indicator:${ind.def.id}`,
        kind: 'indicator',
        priority,
        title: playbook?.title ?? `提升${ind.def.name}`,
        scope: `${dim.def.name} · ${ind.def.name}`,
        reasons,
        actions: playbook?.actions ?? [`对照「${ind.def.evidence}」补充写实记录`, '与班主任沟通制定改进计划'],
        target: `下一评价周期达到 ${goal} 分（${nextLevel(goal)?.label ?? ''}）`,
        horizon: PRIORITY_META[priority].horizon,
        severity: THRESHOLDS.indicatorWeak - ind.score,
      });
    }
  }
  return todos;
}

/** 基于成绩与综合素质评价生成提升优化待办，按优先级与严重程度排序 */
export function generateTodos(input: RecommendationInput): TodoItem[] {
  const classAvg = new Map(input.classStats.map((c) => [c.subject.id, c.rate.avg] as const));
  const todos: TodoItem[] = [
    ...input.subjectStats
      .map((s) => subjectTodo(s, classAvg.get(s.subject.id)))
      .filter((t): t is TodoItem => t !== null),
    ...[balanceTodo(input.subjectStats)].filter((t): t is TodoItem => t !== null),
    ...indicatorTodos(input.evaluation, input.levels),
    ...[strengthTodo(input.subjectStats)].filter((t): t is TodoItem => t !== null),
  ];
  return todos.sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.severity - a.severity,
  );
}
