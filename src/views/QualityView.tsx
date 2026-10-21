import { useState } from 'react';
import { RadarChart } from '../components/RadarChart';
import { Card, Delta, LevelBadge, Meter, ViewToggle, fmt } from '../components/ui';
import { levelOf } from '../core/evaluation';
import { RATER_LABELS, SOURCE_LABELS } from '../core/framework';
import type { RaterRole } from '../core/types';
import type { StudentModel } from '../state/model';
import { useStudentOS } from '../state/store';
import { RadarLegend } from './OverviewView';

const ROLES: RaterRole[] = ['self', 'peer', 'teacher'];

export function QualityView({ model }: { model: StudentModel }) {
  const { classEval, framework } = useStudentOS();
  const { evaluation, student } = model;
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const dims = evaluation.dimensions;
  const avg = (id: string) => classEval.dimensionAverages[id] ?? null;

  return (
    <>
      <div className="grid">
        <Card
          className="span-7"
          title="能力雷达"
          sub="本人维度得分与班级平均对照，60 分环为合格线"
          actions={<ViewToggle view={view} onChange={setView} />}
        >
          {view === 'chart' ? (
            <>
              <RadarLegend />
              <div className="radar-fit">
                <RadarChart
                  ariaLabel={`${student.name}综合素质雷达图`}
                  axes={dims.map((d) => ({ id: d.def.id, label: d.def.short }))}
                  series={[
                    { id: 'class', label: '班级平均', variant: 'ref', values: dims.map((d) => avg(d.def.id)) },
                    { id: 'me', label: '本人', variant: 'main', values: dims.map((d) => d.score) },
                  ]}
                  extraRows={(i) => [
                    { label: '等级', value: dims[i].level?.label ?? '未评价' },
                    { label: '权重', value: `${Math.round(dims[i].def.weight * 100)}%` },
                  ]}
                />
              </div>
            </>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>维度</th>
                    <th>权重</th>
                    <th>本人得分</th>
                    <th>等级</th>
                    <th>班级平均</th>
                    <th>差值</th>
                  </tr>
                </thead>
                <tbody>
                  {dims.map((d) => (
                    <tr key={d.def.id}>
                      <td className="strong">{d.def.name}</td>
                      <td>{Math.round(d.def.weight * 100)}%</td>
                      <td className="strong">{fmt(d.score)}</td>
                      <td>
                        <LevelBadge level={d.level} />
                      </td>
                      <td>{fmt(avg(d.def.id))}</td>
                      <td>
                        <Delta value={d.score !== null && avg(d.def.id) !== null ? d.score - avg(d.def.id)! : null} />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="strong">综合</td>
                    <td>100%</td>
                    <td className="strong">{fmt(evaluation.composite)}</td>
                    <td>
                      <LevelBadge level={evaluation.level} />
                    </td>
                    <td>{fmt(classEval.compositeAverage)}</td>
                    <td>
                      <Delta
                        value={
                          evaluation.composite !== null && classEval.compositeAverage !== null
                            ? evaluation.composite - classEval.compositeAverage
                            : null
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="span-5" title="维度得分" sub="竖线为班级平均">
          <div className="dim-list">
            {dims.map((d) => (
              <div className="dim-row" key={d.def.id}>
                <div>
                  <div className="name">{d.def.name}</div>
                  <div className="detail">
                    <LevelBadge level={d.level} />
                    <span>权重 {Math.round(d.def.weight * 100)}%</span>
                    <span>
                      较班级 <Delta value={d.score !== null && avg(d.def.id) !== null ? d.score - avg(d.def.id)! : null} />
                    </span>
                  </div>
                </div>
                <div className="score num">{fmt(d.score)}</div>
                <Meter value={d.score} level={d.level?.level} reference={avg(d.def.id)} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid section-gap">
        {dims.map((d) => (
          <Card key={d.def.id} className="span-4" title={d.def.name} sub={d.def.description} actions={<LevelBadge level={d.level} />}>
            {d.indicators.map((ind) => (
              <div className="indicator" key={ind.def.id}>
                <div className="indicator-head">
                  <span className="indicator-name">{ind.def.name}</span>
                  <span className="indicator-score num">{ind.score === null ? '未评价' : fmt(ind.score)}</span>
                </div>
                <Meter value={ind.score} level={ind.score === null ? null : levelOf(ind.score, framework.levels).level} />
                <div className="indicator-foot">
                  <span className="chip">权重 {Math.round(ind.def.weight * 100)}%</span>
                  {ind.raters ? (
                    <span className="chip num" title={SOURCE_LABELS[ind.def.source]}>
                      {ROLES.filter((r) => ind.raters![r] !== undefined)
                        .map((r) => `${RATER_LABELS[r]} ${ind.raters![r]}`)
                        .join(' · ')}
                    </span>
                  ) : (
                    <span className="chip">{SOURCE_LABELS[ind.def.source]}</span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}
