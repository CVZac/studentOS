import { useMemo, useState } from 'react';
import { RangeChart, Sparkline } from '../components/RangeChart';
import { Card, Delta, Segmented, StatTile, ViewToggle, fmt, pct } from '../components/ui';
import {
  classSubjectStats,
  examTotals,
  studentSubjectStats,
  subjectRank,
  summarize,
  totalRank,
} from '../core/scoreStats';
import type { StudentModel } from '../state/model';
import { useStudentOS } from '../state/store';
import { ClassLegend, PersonalLegend, classRows, personalRows } from './scoreRows';

type Perspective = 'personal' | 'class';
type Scope = 'all' | 'term' | 'recent3';

export function ScoresView({ model }: { model: StudentModel }) {
  const { student, exams, latestExam } = model;
  const [perspective, setPerspective] = useState<Perspective>('personal');
  const [scope, setScope] = useState<Scope>('all');
  const [examId, setExamId] = useState<string>(latestExam?.id ?? exams[exams.length - 1]?.id ?? '');
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const scopedExamIds = useMemo(() => {
    if (scope === 'recent3') return exams.slice(-3).map((e) => e.id);
    if (scope === 'term' && latestExam) return exams.filter((e) => e.term === latestExam.term).map((e) => e.id);
    return exams.map((e) => e.id);
  }, [scope, exams, latestExam]);

  return (
    <>
      <div className="filters" role="toolbar" aria-label="成绩筛选">
        <div className="filter-group">
          <span className="filter-label">视角</span>
          <Segmented<Perspective>
            label="视角"
            value={perspective}
            onChange={setPerspective}
            options={[
              { value: 'personal', label: '个人 · 历次考试' },
              { value: 'class', label: '班级 · 单次考试' },
            ]}
          />
        </div>
        {perspective === 'personal' ? (
          <div className="filter-group">
            <span className="filter-label">范围</span>
            <Segmented<Scope>
              label="考试范围"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'all', label: `全部 ${exams.length} 次` },
                { value: 'term', label: '本学期' },
                { value: 'recent3', label: '最近 3 次' },
              ]}
            />
          </div>
        ) : (
          <div className="filter-group">
            <label className="filter-label" htmlFor="exam-select">
              考试
            </label>
            <select id="exam-select" className="select" value={examId} onChange={(e) => setExamId(e.target.value)}>
              {[...exams].reverse().map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}（{e.date}）
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {perspective === 'personal' ? (
        <PersonalScores model={model} examIds={scopedExamIds} view={view} setView={setView} />
      ) : (
        <ClassScores examId={examId} studentId={student.id} view={view} setView={setView} />
      )}
    </>
  );
}

function PersonalScores({
  model,
  examIds,
  view,
  setView,
}: {
  model: StudentModel;
  examIds: string[];
  view: 'chart' | 'table';
  setView: (v: 'chart' | 'table') => void;
}) {
  const { dataset } = useStudentOS();
  const stats = useMemo(() => studentSubjectStats(dataset, model.student.id, examIds), [dataset, model.student.id, examIds]);
  const classStats = useMemo(() => classSubjectStats(dataset, examIds), [dataset, examIds]);
  const classBy = new Map(classStats.map((c) => [c.subject.id, c] as const));

  if (stats.length === 0) {
    return (
      <Card>
        <div className="empty">所选范围内暂无成绩</div>
      </Card>
    );
  }

  const overall = summarize(stats.map((s) => s.rate.avg))!;
  const highest = [...stats].sort((a, b) => b.rate.max - a.rate.max)[0];
  const lowest = [...stats].sort((a, b) => a.rate.min - b.rate.min)[0];
  const volatile = [...stats].sort((a, b) => b.rate.std - a.rate.std)[0];
  const classOverall = summarize(classStats.map((c) => c.rate.avg))?.avg ?? null;

  return (
    <>
      <div className="grid">
        <StatTile
          label="平均得分率"
          value={fmt(overall.avg)}
          unit="%"
          foot={
            <>
              较班级 <Delta value={classOverall === null ? null : overall.avg - classOverall} suffix=" 个百分点" />
            </>
          }
        />
        <StatTile
          label="单科最高"
          value={highest.raw.max}
          unit={`${highest.subject.name} / ${highest.subject.fullMark}`}
          foot={`${highest.maxExam.name} · 得分率 ${pct(highest.rate.max)}`}
        />
        <StatTile
          label="单科最低"
          value={lowest.raw.min}
          unit={`${lowest.subject.name} / ${lowest.subject.fullMark}`}
          foot={`${lowest.minExam.name} · 得分率 ${pct(lowest.rate.min)}`}
        />
        <StatTile
          label="波动最大"
          value={volatile.subject.name}
          unit={`σ ${fmt(volatile.rate.std)}`}
          foot={`极差 ${volatile.raw.range} 分（${volatile.raw.min}–${volatile.raw.max}）`}
        />
      </div>

      <Card
        className="section-gap"
        title="成绩区间"
        sub={`${stats[0].raw.count} 次考试 · 按得分率比较不同满分的学科 · 右侧为平均分`}
        actions={<ViewToggle view={view} onChange={setView} />}
      >
        {view === 'chart' ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <PersonalLegend />
            </div>
            <RangeChart ariaLabel="个人各科成绩区间" rows={personalRows(stats, classStats)} />
          </>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>科目</th>
                  <th>满分</th>
                  <th>最高分</th>
                  <th>最低分</th>
                  <th>平均分</th>
                  <th>极差</th>
                  <th>标准差</th>
                  <th>最近一次</th>
                  <th>班级平均</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.subject.id}>
                    <td className="strong">{s.subject.name}</td>
                    <td>{s.subject.fullMark}</td>
                    <td className="strong">{s.raw.max}</td>
                    <td className="strong">{s.raw.min}</td>
                    <td className="strong">{fmt(s.raw.avg)}</td>
                    <td>{s.raw.range}</td>
                    <td>{fmt(s.raw.std)}</td>
                    <td>{s.latest.score}</td>
                    <td>{fmt(classBy.get(s.subject.id)?.raw.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="section-gap" title="学科明细" sub="得分率走势与稳定性，趋势为平均每次考试变化的百分点">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>科目</th>
                <th>最高分</th>
                <th>最低分</th>
                <th>平均分</th>
                <th>平均得分率</th>
                <th>较班级</th>
                <th>标准差</th>
                <th className="left">走势</th>
                <th>趋势</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const cls = classBy.get(s.subject.id);
                return (
                  <tr key={s.subject.id}>
                    <td className="strong">{s.subject.name}</td>
                    <td>
                      {s.raw.max}
                      <div className="muted" style={{ fontSize: 11.5 }}>{s.maxExam.name}</div>
                    </td>
                    <td>
                      {s.raw.min}
                      <div className="muted" style={{ fontSize: 11.5 }}>{s.minExam.name}</div>
                    </td>
                    <td className="strong">{fmt(s.raw.avg)}</td>
                    <td>{pct(s.rate.avg)}</td>
                    <td>
                      <Delta value={cls ? s.rate.avg - cls.rate.avg : null} />
                    </td>
                    <td>{fmt(s.rate.std)}</td>
                    <td className="left">
                      <Sparkline values={s.points.map((p) => p.rate)} />
                    </td>
                    <td>
                      <Delta value={s.points.length >= 2 ? s.trend : null} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function ClassScores({
  examId,
  studentId,
  view,
  setView,
}: {
  examId: string;
  studentId: string;
  view: 'chart' | 'table';
  setView: (v: 'chart' | 'table') => void;
}) {
  const { dataset } = useStudentOS();
  const exam = dataset.exams.find((e) => e.id === examId);
  const classStats = useMemo(() => classSubjectStats(dataset, [examId]), [dataset, examId]);
  const own = useMemo(() => {
    const map = new Map<string, { score: number; rank: ReturnType<typeof subjectRank> }>();
    for (const r of dataset.scores) {
      if (r.examId === examId && r.studentId === studentId) {
        map.set(r.subjectId, { score: r.score, rank: subjectRank(dataset, examId, r.subjectId, studentId) });
      }
    }
    return map;
  }, [dataset, examId, studentId]);
  const totals = summarize([...examTotals(dataset, examId).values()]);
  const myTotal = totalRank(dataset, examId, studentId);

  if (!exam || classStats.length === 0 || !totals) {
    return (
      <Card>
        <div className="empty">该次考试暂无成绩</div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid">
        <StatTile
          label="本人总分"
          value={myTotal ? myTotal.score : '缺考'}
          foot={myTotal ? `班级第 ${myTotal.rank} / ${myTotal.total} 名` : undefined}
        />
        <StatTile label="班级最高总分" value={totals.max} foot={`${totals.count} 人参考`} />
        <StatTile label="班级最低总分" value={totals.min} foot={`极差 ${totals.range} 分`} />
        <StatTile
          label="班级平均总分"
          value={fmt(totals.avg)}
          foot={
            myTotal ? (
              <>
                本人 <Delta value={myTotal.score - totals.avg} suffix=" 分" />
              </>
            ) : undefined
          }
        />
      </div>

      <Card
        className="section-gap"
        title={`${exam.name} · 班级各科区间`}
        sub={`${exam.date} · ${exam.term} · 右侧为本人成绩与名次`}
        actions={<ViewToggle view={view} onChange={setView} />}
      >
        {view === 'chart' ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <ClassLegend />
            </div>
            <RangeChart ariaLabel="班级各科成绩区间" rows={classRows(classStats, own)} />
          </>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>科目</th>
                  <th>满分</th>
                  <th>班级最高</th>
                  <th>班级最低</th>
                  <th>班级平均</th>
                  <th>标准差</th>
                  <th>本人</th>
                  <th>本人名次</th>
                  <th>较平均</th>
                </tr>
              </thead>
              <tbody>
                {classStats.map((c) => {
                  const mine = own.get(c.subject.id);
                  return (
                    <tr key={c.subject.id}>
                      <td className="strong">{c.subject.name}</td>
                      <td>{c.subject.fullMark}</td>
                      <td className="strong">{c.raw.max}</td>
                      <td className="strong">{c.raw.min}</td>
                      <td className="strong">{fmt(c.raw.avg)}</td>
                      <td>{fmt(c.raw.std)}</td>
                      <td>{mine ? mine.score : '缺考'}</td>
                      <td>{mine?.rank ? `${mine.rank.rank} / ${mine.rank.total}` : '—'}</td>
                      <td>
                        <Delta value={mine ? mine.score - c.raw.avg : null} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
