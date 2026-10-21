import { useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Card, PriorityBadge, Segmented } from '../components/ui';
import { PRIORITY_META } from '../core/recommendations';
import type { Priority, TodoItem } from '../core/recommendations';
import type { StudentModel } from '../state/model';
import { useStudentOS } from '../state/store';

type StatusFilter = 'open' | 'done' | 'all';
type CategoryFilter = 'all' | 'academic' | 'quality';

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];

const isAcademic = (t: TodoItem) => t.kind !== 'indicator' || t.id.startsWith('indicator:academic.');

function RingProgress({ done, total }: { done: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const ratio = total ? done / total : 0;
  return (
    <svg className="ring-progress" viewBox="0 0 84 84" role="img" aria-label={`已完成 ${done} / ${total}`}>
      <circle cx="42" cy="42" r={r} className="track" />
      <circle
        cx="42"
        cy="42"
        r={r}
        className="fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="48" textAnchor="middle" className="num">
        {Math.round(ratio * 100)}%
      </text>
    </svg>
  );
}

function CheckButton({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" className="check" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle}>
      <Icon name="check" size={14} strokeWidth={2.6} />
    </button>
  );
}

function TodoCard({ todo, done, onToggle, defaultOpen }: { todo: TodoItem; done: boolean; onToggle: () => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const detailId = `detail-${todo.id.replace(/[^a-z0-9]/gi, '-')}`;
  return (
    <article className={`todo${done ? ' done' : ''}`}>
      <div className="todo-main">
        <CheckButton checked={done} label={`${done ? '标记为未完成' : '标记为完成'}：${todo.title}`} onToggle={onToggle} />
        <div className="todo-body">
          <h3 className="todo-title" style={{ fontSize: 14.5 }}>
            {todo.title}
          </h3>
          <div className="todo-meta">
            <PriorityBadge priority={todo.priority} />
            <span className="chip">{todo.scope}</span>
            <span>{todo.horizon}</span>
          </div>
        </div>
        <button
          type="button"
          className="todo-toggle"
          aria-expanded={open}
          aria-controls={detailId}
          aria-label={open ? '收起详情' : '展开详情'}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="chevron" />
        </button>
      </div>
      {open && (
        <div className="todo-detail" id={detailId}>
          <div>
            <h4>为什么</h4>
            <ul>
              {todo.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>怎么做</h4>
            <ol>
              {todo.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4>目标</h4>
            <p>{todo.target}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export function TodosView({ model }: { model: StudentModel }) {
  const { todos: state } = useStudentOS();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('P1');

  const all = model.todos;
  const doneCount = all.filter((t) => state.isDone(t.id)).length + state.custom.filter((t) => state.isDone(t.id)).length;
  const total = all.length + state.custom.length;

  const matchStatus = (id: string) => (status === 'all' ? true : status === 'done' ? state.isDone(id) : !state.isDone(id));
  const visible = all.filter(
    (t) => matchStatus(t.id) && (category === 'all' || (category === 'academic') === isAcademic(t)),
  );
  const custom = category === 'all' ? state.custom.filter((t) => matchStatus(t.id)) : [];
  const firstOpenId = all.find((t) => !state.isDone(t.id))?.id;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    state.addCustom(value, priority);
    setTitle('');
  };

  return (
    <div className="stack">
      <Card>
        <div className="todo-progress">
          <RingProgress done={doneCount} total={total} />
          <div style={{ flex: '1 1 220px' }}>
            <div className="card-title">
              已完成 {doneCount} / {total} 项
            </div>
            <p className="card-sub" style={{ marginTop: 4 }}>
              {PRIORITIES.map((p) => `${PRIORITY_META[p].label} ${all.filter((t) => t.priority === p && !state.isDone(t.id)).length}`).join(' · ')}
              {' '}项未完成
            </p>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Segmented<CategoryFilter>
              label="类别"
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all', label: '全部' },
                { value: 'academic', label: '学业' },
                { value: 'quality', label: '综合素质' },
              ]}
            />
            <Segmented<StatusFilter>
              label="状态"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'open', label: '未完成' },
                { value: 'done', label: '已完成' },
                { value: 'all', label: '全部' },
              ]}
            />
          </div>
        </div>
      </Card>

      <div>
        {PRIORITIES.map((p) => {
          const items = visible.filter((t) => t.priority === p);
          if (items.length === 0) return null;
          return (
            <section className="todo-group" key={p}>
              <div className="todo-group-head">
                <PriorityBadge priority={p} />
                <h3>{PRIORITY_META[p].horizon}</h3>
                <span className="muted">{items.length} 项</span>
              </div>
              {items.map((t) => (
                <TodoCard
                  key={t.id}
                  todo={t}
                  done={state.isDone(t.id)}
                  onToggle={() => state.toggle(t.id)}
                  defaultOpen={t.id === firstOpenId}
                />
              ))}
            </section>
          );
        })}

        {custom.length > 0 && (
          <section className="todo-group">
            <div className="todo-group-head">
              <h3>我的待办</h3>
              <span className="muted">{custom.length} 项</span>
            </div>
            {custom.map((t) => {
              const done = state.isDone(t.id);
              return (
                <article className={`todo${done ? ' done' : ''}`} key={t.id}>
                  <div className="todo-main">
                    <CheckButton
                      checked={done}
                      label={`${done ? '标记为未完成' : '标记为完成'}：${t.title}`}
                      onToggle={() => state.toggle(t.id)}
                    />
                    <div className="todo-body">
                      <div className="todo-title">{t.title}</div>
                      <div className="todo-meta">
                        <PriorityBadge priority={t.priority} />
                        <span>添加于 {t.createdAt.slice(0, 10)}</span>
                      </div>
                    </div>
                    <button type="button" className="todo-toggle" aria-label={`删除：${t.title}`} onClick={() => state.removeCustom(t.id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {visible.length === 0 && custom.length === 0 && (
          <Card>
            <div className="empty">
              <Icon name="sparkle" size={22} />
              <p style={{ marginTop: 8 }}>
                {status === 'done'
                  ? '还没有已完成的待办'
                  : all.length === 0
                    ? model.evaluation.coverage === 0
                      ? '暂无评价数据，导入成绩或素质记录后自动生成待办'
                      : '各项表现达标，暂无待办'
                    : '这里没有待办，继续保持！'}
              </p>
            </div>
          </Card>
        )}
      </div>

      <Card title="添加我的待办" sub="补充个人计划，与系统建议一起跟踪">
        <form className="add-todo" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="todo-title">
            待办内容
          </label>
          <input
            id="todo-title"
            className="input"
            placeholder="例如：每天背诵 30 个英语单词"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="visually-hidden" htmlFor="todo-priority">
            优先级
          </label>
          <select id="todo-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn primary" disabled={!title.trim()}>
            <Icon name="plus" size={16} />
            添加
          </button>
        </form>
      </Card>
    </div>
  );
}
