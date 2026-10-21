import { useState } from 'react';
import type { ReactNode } from 'react';
import { TooltipBox } from './ui';

export interface RangeMark {
  value: number;
  kind: 'dot' | 'tick';
  tone: 'accent' | 'neutral';
}

export interface RangeRow {
  id: string;
  label: string;
  sublabel?: string;
  /** 区间下限与上限（0–100 得分率） */
  min: number;
  max: number;
  tone: 'accent' | 'neutral';
  marks: RangeMark[];
  value: ReactNode;
  tooltip: { title: string; rows: { label: string; value: string; key?: ReactNode }[] };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** 横轴下限随数据自适应（取整到刻度），上限固定 100%，避免大片空白 */
export function rangeDomain(rows: readonly RangeRow[]): { lo: number; step: number } {
  const values = rows.flatMap((r) => [r.min, ...r.marks.map((m) => m.value)]);
  if (values.length === 0) return { lo: 0, step: 20 };
  const floor = Math.max(0, Math.min(...values) - 5);
  const lo10 = Math.floor(floor / 10) * 10;
  return 100 - lo10 <= 60 ? { lo: lo10, step: 10 } : { lo: Math.floor(floor / 20) * 20, step: 20 };
}

/** 成绩区间图（哑铃图）：横条为最低–最高区间，圆点与竖线标注平均值 */
export function RangeChart({ rows, ariaLabel }: { rows: RangeRow[]; ariaLabel: string }) {
  const [active, setActive] = useState<string | null>(null);
  if (rows.length === 0) return <div className="empty">暂无成绩数据</div>;
  const { lo, step } = rangeDomain(rows);
  const x = (v: number) => ((clamp(v) - lo) / (100 - lo)) * 100;
  const ticks = Array.from({ length: (100 - lo) / step + 1 }, (_, i) => lo + i * step);
  const gridSize = `${(step / (100 - lo)) * 100}% 100%`;

  return (
    <div className="range-chart" role="list" aria-label={ariaLabel} onPointerLeave={() => setActive(null)}>
      {rows.map((row, i) => {
        const tip = active === row.id;
        return (
          <div className="range-row" role="listitem" key={row.id}>
            <div className="range-label">
              <div>
                {row.label}
                {row.sublabel && <small>{row.sublabel}</small>}
              </div>
            </div>
            <div
              className={`range-plot${tip ? ' active' : ''}`}
              style={{ backgroundSize: gridSize }}
              tabIndex={0}
              aria-label={`${row.tooltip.title}：${row.tooltip.rows.map((r) => `${r.label} ${r.value}`).join('，')}`}
              onPointerEnter={() => setActive(row.id)}
              onFocus={() => setActive(row.id)}
              onBlur={() => setActive(null)}
            >
              <span
                className={`range-bar${row.tone === 'neutral' ? ' neutral' : ''}`}
                style={{
                  left: `${x(row.min)}%`,
                  width: `${x(row.max) - x(row.min)}%`,
                  animationDelay: `${i * 40}ms`,
                }}
              />
              {row.marks.map((m, j) => (
                <span
                  key={j}
                  className={`${m.kind === 'dot' ? 'range-dot' : 'range-tick'}${m.tone === 'neutral' ? ' neutral' : ''}`}
                  style={{ left: `${x(m.value)}%` }}
                />
              ))}
              {tip && (
                <TooltipBox
                  title={row.tooltip.title}
                  rows={row.tooltip.rows.map((r) => ({ key: r.key ?? <i style={{ width: 16 }} />, ...r }))}
                  style={{
                    left: `${x((row.min + row.max) / 2)}%`,
                    ...(i < 2 ? { top: '100%', transform: 'translate(-50%, 4px)' } : { bottom: '100%', transform: 'translate(-50%, -4px)' }),
                  }}
                />
              )}
            </div>
            <div className="range-value">{row.value}</div>
          </div>
        );
      })}
      <div />
      <div className="range-axis" aria-hidden="true">
        {ticks.map((v) => (
          <span key={v} className="num" style={{ left: `${x(v)}%` }}>
            {v}
            {v === 100 ? '%' : ''}
          </span>
        ))}
      </div>
      <div />
    </div>
  );
}

export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length === 0) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pad = 4;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (values.length - 1));
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  const last = values.length - 1;
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} className="line" />
      <circle cx={x(last)} cy={y(values[last])} r={3.5} className="end" />
    </svg>
  );
}
