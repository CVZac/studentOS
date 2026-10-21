import { useState } from 'react';
import { TooltipBox, fmt } from './ui';

export interface RadarAxis {
  id: string;
  label: string;
}

export interface RadarSeries {
  id: string;
  label: string;
  values: (number | null)[];
  /** main：本人（强调色）；ref：参照（灰色，如班级平均） */
  variant: 'main' | 'ref';
}

const W = 480;
const H = 430;
const CX = W / 2;
const CY = 220;
const R = 140;
const RINGS = [20, 40, 60, 80, 100];

function polar(angle: number, radius: number) {
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

/** 综合素质雷达图：网格为 20 分一圈，60 分合格线加深 */
export function RadarChart({
  axes,
  series,
  max = 100,
  ariaLabel,
  extraRows,
}: {
  axes: RadarAxis[];
  series: RadarSeries[];
  max?: number;
  ariaLabel: string;
  extraRows?: (axisIndex: number) => { label: string; value: string }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const n = axes.length;
  const step = (2 * Math.PI) / n;
  const angle = (i: number) => -Math.PI / 2 + i * step;
  const point = (i: number, value: number | null) => polar(angle(i), (R * Math.max(0, Math.min(max, value ?? 0))) / max);
  const ringPath = (v: number) =>
    axes.map((_, i) => polar(angle(i), (R * v) / max)).map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('') + 'Z';
  const isComplete = (s: RadarSeries) => s.values.every((v) => v !== null && v !== undefined);
  // 有缺失维度时不把缺失当 0 分画进多边形，只连接相邻的有效顶点
  const seriesPath = (s: RadarSeries) => {
    if (isComplete(s)) {
      return s.values.map((v, i) => point(i, v)).map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('') + 'Z';
    }
    return s.values
      .map((v, i) => {
        const next = s.values[(i + 1) % n];
        if (v === null || next === null || n < 2) return '';
        const a = point(i, v);
        const b = point((i + 1) % n, next);
        return `M${a.x},${a.y}L${b.x},${b.y}`;
      })
      .join('');
  };

  const main = series.find((s) => s.variant === 'main');
  const refs = series.filter((s) => s.variant === 'ref');

  const tooltip = (() => {
    if (active === null) return null;
    const anchor = point(active, main?.values[active] ?? refs[0]?.values[active] ?? 0);
    const above = anchor.y > CY - R * 0.4;
    return (
      <TooltipBox
        title={axes[active].label}
        style={{
          left: `${(anchor.x / W) * 100}%`,
          top: `${(anchor.y / H) * 100}%`,
          transform: above ? 'translate(-50%, calc(-100% - 14px))' : 'translate(-50%, 14px)',
        }}
        rows={[
          ...series.map((s) => ({
            key: <i className="key-line" style={{ ['--key' as string]: s.variant === 'main' ? 'var(--accent)' : 'var(--reference)' }} />,
            label: s.label,
            value: fmt(s.values[active]),
          })),
          ...(extraRows?.(active) ?? []).map((r) => ({ key: <i style={{ width: 16 }} />, ...r })),
        ]}
      />
    );
  })();

  return (
    <div className="chart-wrap radar">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onPointerLeave={() => setActive(null)}>
        {RINGS.map((v) => (
          <path key={v} d={ringPath(v)} className={`ring${v === 60 ? ' pass' : ''}`} />
        ))}
        {axes.map((a, i) => {
          const p = polar(angle(i), R);
          return <line key={a.id} x1={CX} y1={CY} x2={p.x} y2={p.y} className={`spoke${active === i ? ' active' : ''}`} />;
        })}
        {RINGS.map((v) => {
          // 刻度标在首末两轴之间的环边中点，避开数据顶点
          const p = polar(angle(0) - step / 2, ((R * v) / max) * Math.cos(step / 2));
          return (
            <text key={v} x={p.x} y={p.y + 3.5} textAnchor="middle" className="ring-label num">
              {v}
            </text>
          );
        })}

        <g className="plot" style={{ ['--cx' as string]: `${CX}px`, ['--cy' as string]: `${CY}px` }}>
          {refs.map((s) => (
            <path key={s.id} d={seriesPath(s)} className="series-ref" />
          ))}
          {main && <path d={seriesPath(main)} className={`series-main${isComplete(main) ? '' : ' partial'}`} />}
          {main?.values.map((v, i) => {
            if (v === null) return null;
            const p = point(i, v);
            return <circle key={axes[i].id} cx={p.x} cy={p.y} r={active === i ? 6 : 4.5} className="dot" />;
          })}
        </g>

        {axes.map((a, i) => {
          const ang = angle(i);
          const p = polar(ang, R + 26);
          const cos = Math.cos(ang);
          const sin = Math.sin(ang);
          const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
          const baseY = sin < -0.5 ? p.y - 22 : sin > 0.5 ? p.y + 8 : p.y - 6;
          return (
            <g key={a.id}>
              <text x={p.x} y={baseY} textAnchor={anchor} className="axis-name">
                {a.label}
              </text>
              {main && (
                <text x={p.x} y={baseY + 5} textAnchor={anchor} dominantBaseline="hanging" className="axis-value num">
                  {fmt(main.values[i])}
                </text>
              )}
            </g>
          );
        })}

        {axes.map((a, i) => {
          const r = R + 56;
          const p1 = polar(angle(i) - step / 2, r);
          const p2 = polar(angle(i), r * 1.05);
          const p3 = polar(angle(i) + step / 2, r);
          return (
            <path
              key={a.id}
              d={`M${CX},${CY}L${p1.x},${p1.y}L${p2.x},${p2.y}L${p3.x},${p3.y}Z`}
              className="hit"
              tabIndex={0}
              aria-label={`${a.label}：${series.map((s) => `${s.label} ${fmt(s.values[i])}`).join('，')}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          );
        })}
      </svg>
      {tooltip}
    </div>
  );
}
