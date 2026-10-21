import type { ReactNode } from 'react';
import { Icon } from './components/Icon';
import type { IconName } from './components/Icon';
import { useStudentModel } from './state/model';
import { useStudentOS } from './state/store';
import { RouteLink, RouterProvider, useRouter, useTheme } from './state/ui';
import type { Route } from './state/ui';
import { DataView } from './views/DataView';
import { FrameworkView } from './views/FrameworkView';
import { OverviewView } from './views/OverviewView';
import { QualityView } from './views/QualityView';
import { ScoresView } from './views/ScoresView';
import { TodosView } from './views/TodosView';

const NAV: { group: string; items: { id: Route; label: string; short: string; icon: IconName }[] }[] = [
  {
    group: '学生',
    items: [
      { id: 'overview', label: '成长总览', short: '总览', icon: 'overview' },
      { id: 'quality', label: '综合素质', short: '素质', icon: 'radar' },
      { id: 'scores', label: '成绩分析', short: '成绩', icon: 'scores' },
      { id: 'todos', label: '提升待办', short: '待办', icon: 'todos' },
    ],
  },
  {
    group: '体系',
    items: [
      { id: 'framework', label: '评价体系', short: '体系', icon: 'framework' },
      { id: 'data', label: '数据管理', short: '数据', icon: 'data' },
    ],
  },
];

export function App() {
  const { route, navigate } = useRouter();
  const { theme, toggle } = useTheme();
  const { dataset, setStudentId, todos: todoState, isDemo } = useStudentOS();
  const model = useStudentModel();
  const { student, latestExam, todos } = model;
  const remaining = todos.filter((t) => !todoState.isDone(t.id)).length +
    todoState.custom.filter((t) => !todoState.isDone(t.id)).length;

  const header: Record<Route, { eyebrow: string; title: ReactNode; sub: ReactNode }> = {
    overview: {
      eyebrow: '成长总览',
      title: `${student.name}的成长总览`,
      sub: `${dataset.className} · 学号 ${student.id}${latestExam ? ` · 数据截至${latestExam.name}` : ''}`,
    },
    quality: {
      eyebrow: '综合素质',
      title: '综合素质能力雷达',
      sub: `${model.evaluation.dimensions.length} 大维度 · 自评、互评、师评多主体融合 · 与班级平均对照`,
    },
    scores: {
      eyebrow: '成绩分析',
      title: '各科成绩区间',
      sub: '最高分、最低分、平均分，以及稳定性与趋势',
    },
    todos: {
      eyebrow: '提升待办',
      title: '提升优化待办',
      sub: '依据成绩与素质评价中的薄弱项自动生成，按优先级排序',
    },
    framework: {
      eyebrow: '评价体系',
      title: '综合素质评价体系框架',
      sub: '评价什么、谁来评、怎么算、如何改进',
    },
    data: {
      eyebrow: '数据管理',
      title: '数据导入与导出',
      sub: isDemo ? '当前使用演示数据，可导入本班真实数据' : '当前使用已导入的数据',
    },
  };
  const page = header[route];
  const showSwitcher = route !== 'framework' && route !== 'data';

  return (
    <RouterProvider value={navigate}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div>
              <div className="brand-name">Student OS</div>
              <div className="brand-sub">学生成长操作系统</div>
            </div>
          </div>
          {NAV.map((g) => (
            <nav className="nav" key={g.group} aria-label={g.group}>
              <div className="nav-label">{g.group}</div>
              {g.items.map((item) => (
                <RouteLink key={item.id} to={item.id} className="nav-item" current={route === item.id}>
                  <Icon name={item.icon} />
                  {item.label}
                  {item.id === 'todos' && remaining > 0 && <span className="nav-count num">{remaining}</span>}
                </RouteLink>
              ))}
            </nav>
          ))}
          <div className="sidebar-foot">
            <div className="class-card">
              <div className="label">{dataset.school}</div>
              <div className="value">{dataset.className}</div>
              <div className="label">
                {dataset.students.length} 名学生 · {dataset.exams.length} 次考试 · {dataset.subjects.length} 门学科
              </div>
            </div>
            <button type="button" className="btn ghost" onClick={toggle} style={{ justifyContent: 'flex-start' }}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
              {theme === 'dark' ? '浅色模式' : '深色模式'}
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="main-inner">
            <header className="topbar">
              <div>
                <div className="page-eyebrow">{page.eyebrow}</div>
                <h1 className="page-title">{page.title}</h1>
                <p className="page-sub">{page.sub}</p>
              </div>
              <div className="topbar-actions">
                {showSwitcher && (
                  <label className="switcher">
                    <span className="avatar" aria-hidden="true">
                      {student.name.slice(-1)}
                    </span>
                    <span className="visually-hidden">切换学生</span>
                    <select value={student.id} onChange={(e) => setStudentId(e.target.value)}>
                      {dataset.students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <span className="chev">
                      <Icon name="chevron" size={14} strokeWidth={2.2} />
                    </span>
                  </label>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={toggle}
                  aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
                >
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
                </button>
              </div>
            </header>

            {/* 学生相关页面切换学生时重新入场；体系与数据页不随学生重挂载，以保留导入提示等状态 */}
            <div className="page" key={showSwitcher ? `${route}/${student.id}` : route}>
              {route === 'overview' && <OverviewView model={model} />}
              {route === 'quality' && <QualityView model={model} />}
              {route === 'scores' && <ScoresView model={model} />}
              {route === 'todos' && <TodosView model={model} />}
              {route === 'framework' && <FrameworkView />}
              {route === 'data' && <DataView />}
            </div>
          </div>
        </main>

        <nav className="tabbar" aria-label="主导航">
          {NAV.flatMap((g) => g.items).map((item) => (
            <RouteLink key={item.id} to={item.id} current={route === item.id}>
              <Icon name={item.icon} size={20} />
              {item.short}
            </RouteLink>
          ))}
        </nav>
      </div>
    </RouterProvider>
  );
}
