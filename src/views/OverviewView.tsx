import { Icon } from '../components/Icon';
import { RadarChart } from '../components/RadarChart';
import { RangeChart } from '../components/RangeChart';
import { Card, Delta, LevelBadge, PriorityBadge, StatTile, fmt, pct } from '../components/ui';
import { SYSTEM_INDICATORS } from '../core/framework';
import type { StudentModel } from '../state/model';
import { useStudentOS } from '../state/store';
import { RouteLink } from '../state/ui';
import { PersonalLegend, personalRows } from './scoreRows';

export function RadarLegend() {
  return (
    <div className="legend" aria-label="图例">
      <span className="legend-item">
        <i className="key-line" />
        本人
      </span>
      <span className="legend-item">
        <i className="key-line" style={{ ['--key' as string]: 'var(--reference)' }} />
        班级平均
      </span>
    </div>
  );
}

export function OverviewView({ model }: { model: StudentModel }) {
  const { classEval, todos: todoState } = useStudentOS();
  const { evaluation, rank, subjectStats, classStats, todos, latestExam, latestTotal } = model;

  const performance = evaluation.dimensions
    .flatMap((d) => d.indicators)
    .find((i) => i.def.id === SYSTEM_INDICATORS.performance)?.score ?? null;
  const classPerformance = classStats.length
    ? classStats.reduce((a, c) => a + c.rate.avg, 0) / classStats.length
    : null;
  const byRate = [...subjectStats].sort((a, b) => b.rate.avg - a.rate.avg);
  const best = byRate[0];
  const worst = byRate[byRate.length - 1];
  const open = todos.filter((t) => !todoState.isDone(t.id));
  const doneCount = todos.length - open.length;

  return (
    <div className="grid">
      <Card className="hero span-5">
        <div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="card-title">综合素质评分</span>
            <LevelBadge level={evaluation.level} large />
          </div>
          <div className="hero-figure">
            <span className={`hero-value${evaluation.composite === null ? ' empty-value' : ''}`}>{fmt(evaluation.composite)}</span>
            <span className="hero-unit">/ 100</span>
          </div>
          <p className="page-sub" style={{ marginTop: 10 }}>
            {evaluation.level?.description ?? '暂无足够数据'}
          </p>
        </div>
        <div className="hero-meta">
          <div>
            <div className="meta-label">班级排名</div>
            <div className="meta-value num">{rank ? `${rank.rank} / ${rank.total}` : '—'}</div>
          </div>
          <div>
            <div className="meta-label">对比班级平均</div>
            <div className="meta-value">
              <Delta value={evaluation.composite !== null && classEval.compositeAverage !== null ? evaluation.composite - classEval.compositeAverage : null} />
            </div>
          </div>
          <div>
            <div className="meta-label">评价覆盖率</div>
            <div className="meta-value num">{pct(evaluation.coverage * 100, 0)}</div>
          </div>
        </div>
      </Card>

      <Card
        className="span-7 row-span-2"
        title="综合素质雷达"
        sub="六维能力画像，悬停查看各维度详情"
        actions={<RadarLegend />}
      >
        <div className="radar-fit">
          <RadarChart
            ariaLabel={`${model.student.name}综合素质雷达图`}
            axes={evaluation.dimensions.map((d) => ({ id: d.def.id, label: d.def.short }))}
            series={[
              { id: 'class', label: '班级平均', variant: 'ref', values: evaluation.dimensions.map((d) => classEval.dimensionAverages[d.def.id]) },
              { id: 'me', label: '本人', variant: 'main', values: evaluation.dimensions.map((d) => d.score) },
            ]}
            extraRows={(i) => [{ label: '等级', value: evaluation.dimensions[i].level?.label ?? '未评价' }]}
          />
        </div>
      </Card>

      <div className="span-5 tiles-2x2">
        <StatTile
          className=""
          label="平均得分率"
          value={fmt(performance)}
          unit="%"
          foot={
            <>
              较班级 <Delta value={performance !== null && classPerformance !== null ? performance - classPerformance : null} suffix=" 个百分点" />
            </>
          }
        />
        <StatTile
          className=""
          label={latestExam ? `${latestExam.name}总分` : '最近总分'}
          value={latestTotal ? latestTotal.score : '—'}
          foot={latestTotal ? `班级第 ${latestTotal.rank} / ${latestTotal.total} 名` : '暂无成绩'}
        />
        <StatTile
          className=""
          label={<><Icon name="trendUp" size={14} />优势学科</>}
          value={best ? best.subject.name : '—'}
          unit={best ? pct(best.rate.avg) : undefined}
          foot={best ? `最高 ${best.raw.max} 分 · 最低 ${best.raw.min} 分` : undefined}
        />
        <StatTile
          className=""
          label={<><Icon name="target" size={14} />待提升学科</>}
          value={worst ? worst.subject.name : '—'}
          unit={worst ? pct(worst.rate.avg) : undefined}
          foot={
            worst ? (
              <>
                趋势 <Delta value={worst.trend} suffix=" / 次" />
              </>
            ) : undefined
          }
        />
      </div>

      <Card
        className="span-7"
        title="各科成绩区间"
        sub={`历次考试得分率（共 ${model.exams.length} 次），数值为本人平均分`}
        actions={
          <RouteLink className="btn sm ghost" to="scores">
            详情 <Icon name="arrowRight" size={14} />
          </RouteLink>
        }
      >
        <div style={{ marginBottom: 14 }}>
          <PersonalLegend />
        </div>
        <RangeChart ariaLabel="各科成绩区间" rows={personalRows(subjectStats, classStats)} />
      </Card>

      <Card
        className="span-5"
        title="本周聚焦"
        sub={`共 ${todos.length} 项待办，已完成 ${doneCount} 项`}
        actions={
          <RouteLink className="btn sm ghost" to="todos">
            全部 <Icon name="arrowRight" size={14} />
          </RouteLink>
        }
      >
        {open.length === 0 ? (
          <div className="empty">
            <Icon name="sparkle" size={22} />
            <p style={{ marginTop: 8 }}>
              {todos.length > 0
                ? '所有待办已完成，继续保持！'
                : evaluation.coverage === 0
                  ? '暂无评价数据，导入成绩或素质记录后自动生成待办'
                  : '各项表现达标，暂无待办'}
            </p>
          </div>
        ) : (
          open.slice(0, 4).map((t) => (
            <div className="todo-compact" key={t.id}>
              <button
                type="button"
                className="check"
                role="checkbox"
                aria-checked={false}
                aria-label={`完成：${t.title}`}
                onClick={() => todoState.toggle(t.id)}
              >
                <Icon name="check" size={14} strokeWidth={2.6} />
              </button>
              <div className="todo-body">
                <div className="todo-title">{t.title}</div>
                <div className="todo-meta">
                  <PriorityBadge priority={t.priority} />
                  <span>{t.reasons[0]}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
