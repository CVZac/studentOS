import { Card, LevelBadge, Meter } from '../components/ui';
import { RATER_LABELS, SOURCE_LABELS } from '../core/framework';
import { PRIORITY_META, THRESHOLDS } from '../core/recommendations';
import type { RaterRole } from '../core/types';
import { useStudentOS } from '../state/store';

const ROLES: RaterRole[] = ['self', 'peer', 'teacher'];

const RULES: { when: string; priority: string }[] = [
  { when: `学科平均得分率 < ${THRESHOLDS.subjectCritical}%`, priority: 'P0' },
  { when: `学科平均得分率 < ${THRESHOLDS.subjectWeak}%`, priority: 'P1' },
  { when: `近 ${THRESHOLDS.trendMinExams}+ 次考试得分率每次下滑 ≥ ${-THRESHOLDS.decline} 个百分点`, priority: 'P1' },
  { when: `最近一次考试未达合格线（平均已合格时）`, priority: 'P1' },
  { when: `低于班级平均 > ${THRESHOLDS.belowClass} 个百分点`, priority: 'P1' },
  { when: `得分率标准差 ≥ ${THRESHOLDS.volatile}（发挥不稳定）`, priority: 'P2' },
  { when: '同一学科叠加 2 个及以上 P1 信号', priority: 'P0' },
  { when: `最强与最弱学科差距 ≥ ${THRESHOLDS.imbalance} 个百分点（偏科）`, priority: 'P1' },
  { when: `素质指标 < ${THRESHOLDS.indicatorCritical} 分`, priority: 'P0' },
  { when: `素质指标 < ${THRESHOLDS.indicatorWeak} 分，且所属维度 < ${THRESHOLDS.indicatorWeak} 分（每维度最多 ${THRESHOLDS.indicatorsPerDimension} 项）`, priority: 'P1' },
  { when: `最强学科得分率 ≥ ${THRESHOLDS.subjectStrong}%（优势保持）`, priority: 'P2' },
];

export function FrameworkView() {
  const { framework } = useStudentOS();
  const maxWeight = Math.max(...framework.dimensions.map((d) => d.weight));
  const indicatorCount = framework.dimensions.reduce((a, d) => a + d.indicators.length, 0);
  const levels = [...framework.levels].sort((a, b) => b.min - a.min);

  return (
    <div className="grid">
      <Card
        className="span-12"
        title={`${framework.name} v${framework.version}`}
        sub={`${framework.dimensions.length} 个一级维度 · ${indicatorCount} 项二级指标 · 3 类评价主体 · 4 级评价标准`}
      >
        <div className="principles">
          {framework.principles.map((p, i) => (
            <div className="principle" key={p.title}>
              <div className="idx">0{i + 1}</div>
              <h4>{p.title}</h4>
              <p>{p.description}</p>
            </div>
          ))}
        </div>
        <h3 className="card-title" style={{ margin: '22px 0 8px', fontSize: 13.5 }}>
          政策依据
        </h3>
        <ul className="basis">
          {framework.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </Card>

      <Card className="span-5" title="一级维度与权重" sub="综合分 = 各维度得分按权重加权">
        {framework.dimensions.map((d) => (
          <div className="weight-row" key={d.id}>
            <span style={{ fontWeight: 560 }}>{d.name}</span>
            <Meter value={(d.weight / maxWeight) * 100} />
            <span className="pct num">{Math.round(d.weight * 100)}%</span>
          </div>
        ))}
      </Card>

      <Card className="span-7" title="评价主体与等级标准" sub="多主体评价按权重融合；缺失的主体不参与计算，其余权重自动归一">
        <div className="rater-grid">
          {ROLES.map((r) => (
            <div className="tile" key={r} style={{ boxShadow: 'none' }}>
              <div className="tile-label">{RATER_LABELS[r]}</div>
              <div className="tile-value num">
                {Math.round(framework.raterWeights[r] * 100)}
                <small>%</small>
              </div>
            </div>
          ))}
        </div>
        <div className="level-grid" style={{ marginTop: 16 }}>
          {levels.map((l, i) => (
            <div className="level-card" key={l.level}>
              <LevelBadge level={l} />
              <div className="range num">{i === 0 ? `≥ ${l.min}` : `${l.min}–${levels[i - 1].min - 0.1}`}</div>
              <p>{l.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="span-12" title="指标体系" sub="二级指标、数据来源与评价依据；综合权重 = 维度权重 × 指标权重">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>一级维度</th>
                <th className="left">二级指标</th>
                <th>维度内权重</th>
                <th>综合权重</th>
                <th className="left">数据来源</th>
                <th className="left">评价依据</th>
                <th className="left">说明</th>
              </tr>
            </thead>
            <tbody>
              {framework.dimensions.flatMap((d) =>
                d.indicators.map((ind, i) => (
                  <tr key={ind.id}>
                    <td className="strong">{i === 0 ? `${d.name}（${Math.round(d.weight * 100)}%）` : ''}</td>
                    <td className="left strong">{ind.name}</td>
                    <td>{Math.round(ind.weight * 100)}%</td>
                    <td>{(d.weight * ind.weight * 100).toFixed(1)}%</td>
                    <td className="left">
                      <span className="chip">{SOURCE_LABELS[ind.source]}</span>
                    </td>
                    <td className="left">{ind.evidence}</td>
                    <td className="wrap">{ind.description}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="span-6" title="计算模型" sub="逐级加权，缺失数据不计入并按剩余权重归一">
        <div className="formula">{`指标分 = Σ(主体权重 × 主体评分) ÷ Σ有效主体权重
       （写实记录类指标直接取 0–100 折算分）

学科成绩 = 各学科平均得分率的均值
学科均衡 = 100 − 2 × 各学科平均得分率的标准差

维度分 = Σ(指标权重 × 指标分) ÷ Σ有效指标权重
综合分 = Σ(维度权重 × 维度分) ÷ Σ有效维度权重

得分率 = 分数 ÷ 满分 × 100%`}</div>
        <p className="card-sub" style={{ marginTop: 12 }}>
          成绩区间统计：最高分、最低分、平均分、极差（最高 − 最低）、总体标准差；趋势为得分率的最小二乘斜率。
        </p>
      </Card>

      <Card className="span-6" title="待办生成规则" sub="评价结果自动转化为提升待办，形成「评价—改进」闭环">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="left">触发条件</th>
                <th>优先级</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.when}>
                  <td className="wrap" style={{ color: 'var(--ink-1)' }}>
                    {r.when}
                  </td>
                  <td>
                    <span className={`badge tone-${r.priority}`}>
                      {r.priority} {PRIORITY_META[r.priority as keyof typeof PRIORITY_META].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="span-12" title="评价流程" sub="每学期一个评价周期">
        <div className="steps">
          {framework.process.map((s, i) => (
            <div className="step" key={s.title}>
              <div className="n num">{i + 1}</div>
              <h4>{s.title}</h4>
              <p>{s.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
