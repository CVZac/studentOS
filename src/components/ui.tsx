import type { CSSProperties, ReactNode } from 'react';
import type { Level, LevelDef } from '../core/framework';
import { PRIORITY_META } from '../core/recommendations';
import type { Priority } from '../core/recommendations';
import { Icon } from './Icon';

export const fmt = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : (Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits);

export const pct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? '—' : `${fmt(n, digits)}%`);

export function Card({
  title,
  sub,
  actions,
  className = '',
  children,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function LevelBadge({ level, large }: { level: LevelDef | null; large?: boolean }) {
  if (!level) return <span className="badge">未评价</span>;
  return (
    <span className={`badge tone-${level.level}${large ? ' lg' : ''}`}>
      {level.level} · {level.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge tone-${priority}`}>
      {priority} {PRIORITY_META[priority].label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  unit,
  foot,
  className = 'span-3',
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  foot?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tile ${className}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="tile-foot">{foot}</div>}
    </div>
  );
}

export function Delta({ value, suffix = '', digits = 1 }: { value: number | null; suffix?: string; digits?: number }) {
  if (value === null || !Number.isFinite(value)) return <span className="muted">—</span>;
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  if (rounded === 0) return <span className="muted">持平</span>;
  const up = rounded > 0;
  return (
    <span className={up ? 'delta-up' : 'delta-down'}>
      {up ? '▲' : '▼'} {Math.abs(rounded).toFixed(digits)}
      {suffix}
    </span>
  );
}

const METER_TONE: Record<Level, string> = {
  A: 'var(--accent)',
  B: 'var(--accent)',
  C: 'var(--warning)',
  D: 'var(--critical)',
};

/** 0–100 分值条，C/D 等级使用状态色；可选参照刻度（如班级均值） */
export function Meter({ value, level, reference }: { value: number | null; level?: Level | null; reference?: number | null }) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="meter" role="presentation">
      <span style={{ width: `${width}%`, ['--meter' as string]: level ? METER_TONE[level] : undefined }} />
      {reference !== null && reference !== undefined && (
        <i className="mark" style={{ left: `calc(${Math.min(100, reference)}% - 1px)` }} />
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  small,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <div className={`segmented${small ? ' sm' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 图表 / 表格视图切换，保证每张图都有可读的表格等价形式 */
export function ViewToggle({ view, onChange }: { view: 'chart' | 'table'; onChange: (v: 'chart' | 'table') => void }) {
  return (
    <Segmented
      small
      label="视图"
      value={view}
      onChange={onChange}
      options={[
        { value: 'chart', label: <span className="row" style={{ gap: 4 }}><Icon name="chart" size={14} />图表</span> },
        { value: 'table', label: <span className="row" style={{ gap: 4 }}><Icon name="table" size={14} />表格</span> },
      ]}
    />
  );
}

export function TooltipBox({
  title,
  rows,
  style,
}: {
  title: ReactNode;
  rows: { key: ReactNode; label: string; value: string }[];
  style: CSSProperties;
}) {
  return (
    <div className="tooltip" style={style} role="status">
      <div className="tooltip-title">{title}</div>
      {rows.map((r) => (
        <div className="tooltip-row" key={r.label}>
          {r.key}
          <span className="k">{r.label}</span>
          <span className="v">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
