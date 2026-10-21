import type { RangeRow } from '../components/RangeChart';
import { fmt, pct } from '../components/ui';
import type { ClassSubjectStat, RankResult, SubjectStat } from '../core/scoreStats';
import { toRate } from '../core/scoreStats';

const key = {
  bar: <i className="key-bar" />,
  barNeutral: <i className="key-bar" style={{ ['--key' as string]: 'var(--reference-soft)' }} />,
  dot: <i className="key-dot" />,
  tick: <i className="key-tick" />,
};

export function PersonalLegend() {
  return (
    <div className="legend" aria-label="图例">
      <span className="legend-item">{key.bar}本人区间（最低–最高）</span>
      <span className="legend-item">{key.dot}本人平均</span>
      <span className="legend-item">{key.tick}班级平均</span>
    </div>
  );
}

export function ClassLegend() {
  return (
    <div className="legend" aria-label="图例">
      <span className="legend-item">{key.barNeutral}班级区间（最低–最高）</span>
      <span className="legend-item">{key.tick}班级平均</span>
      <span className="legend-item">{key.dot}本人成绩</span>
    </div>
  );
}

/** 个人视角：本人历次考试的最低–最高区间 + 本人平均 + 班级平均 */
export function personalRows(stats: readonly SubjectStat[], classStats: readonly ClassSubjectStat[]): RangeRow[] {
  const classBy = new Map(classStats.map((c) => [c.subject.id, c] as const));
  return stats.map((s) => {
    const cls = classBy.get(s.subject.id);
    return {
      id: s.subject.id,
      label: s.subject.name,
      sublabel: `满分 ${s.subject.fullMark}`,
      min: s.rate.min,
      max: s.rate.max,
      tone: 'accent',
      marks: [
        ...(cls ? [{ value: cls.rate.avg, kind: 'tick' as const, tone: 'neutral' as const }] : []),
        { value: s.rate.avg, kind: 'dot', tone: 'accent' },
      ],
      value: (
        <>
          <strong className="num">{fmt(s.raw.avg)}</strong>
          <span className="num">{pct(s.rate.avg)}</span>
        </>
      ),
      tooltip: {
        title: `${s.subject.name} · ${s.raw.count} 次考试`,
        rows: [
          { key: key.bar, label: '最高分', value: `${s.raw.max}（${s.maxExam.name}）` },
          { key: key.bar, label: '最低分', value: `${s.raw.min}（${s.minExam.name}）` },
          { key: key.dot, label: '平均分', value: `${fmt(s.raw.avg)}（${pct(s.rate.avg)}）` },
          ...(cls ? [{ key: key.tick, label: '班级平均', value: `${fmt(cls.raw.avg)}（${pct(cls.rate.avg)}）` }] : []),
          { label: '标准差', value: fmt(s.raw.std) },
        ],
      },
    };
  });
}

/** 班级视角：单次考试班级最低–最高区间 + 班级平均 + 本人成绩 */
export function classRows(
  classStats: readonly ClassSubjectStat[],
  own: Map<string, { score: number; rank: RankResult | null }>,
): RangeRow[] {
  return classStats.map((c) => {
    const mine = own.get(c.subject.id);
    const myRate = mine ? toRate(mine.score, c.subject.fullMark) : null;
    return {
      id: c.subject.id,
      label: c.subject.name,
      sublabel: `满分 ${c.subject.fullMark}`,
      min: c.rate.min,
      max: c.rate.max,
      tone: 'neutral',
      marks: [
        { value: c.rate.avg, kind: 'tick', tone: 'neutral' },
        ...(myRate !== null ? [{ value: myRate, kind: 'dot' as const, tone: 'accent' as const }] : []),
      ],
      value: mine ? (
        <>
          <strong className="num">{mine.score}</strong>
          <span className="num">{mine.rank ? `第 ${mine.rank.rank} / ${mine.rank.total} 名` : ''}</span>
        </>
      ) : (
        <span>缺考</span>
      ),
      tooltip: {
        title: `${c.subject.name} · 班级 ${c.raw.count} 人`,
        rows: [
          { key: key.barNeutral, label: '班级最高', value: `${c.raw.max}` },
          { key: key.barNeutral, label: '班级最低', value: `${c.raw.min}` },
          { key: key.tick, label: '班级平均', value: fmt(c.raw.avg) },
          ...(mine ? [{ key: key.dot, label: '本人', value: `${mine.score}（${pct(myRate)}）` }] : []),
        ],
      },
    };
  });
}
