import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { evaluateClass } from '../core/evaluation';
import type { ClassEvaluation } from '../core/evaluation';
import { DEFAULT_FRAMEWORK } from '../core/framework';
import type { EvaluationFramework } from '../core/framework';
import type { Priority } from '../core/recommendations';
import type { Dataset } from '../core/types';
import { createDemoDataset } from '../data/demo';
import type { CustomTodo, SyncStatus, TodoStore, WorkspacePersistence, WorkspaceSnapshot } from './workspace';

export type { CustomTodo } from './workspace';

interface StudentOSValue {
  dataset: Dataset;
  isDemo: boolean;
  framework: EvaluationFramework;
  classEval: ClassEvaluation;
  studentId: string;
  setStudentId(id: string): void;
  importDataset(dataset: Dataset): void;
  resetDemo(): void;
  todos: {
    isDone(todoId: string): boolean;
    toggle(todoId: string): void;
    custom: CustomTodo[];
    addCustom(title: string, priority: Priority): void;
    removeCustom(id: string): void;
    clear(): void;
  };
  /** 云端模式下的保存状态；本地模式恒为 saved */
  sync: { remote: boolean; status: SyncStatus; retry(): void };
}

const StudentOSContext = createContext<StudentOSValue | null>(null);

/** 数据作用域为当前登录账号的工作区；切换账号时由调用方以 key 重新挂载 */
export function StudentOSProvider({
  initial,
  persistence,
  children,
}: {
  initial: WorkspaceSnapshot;
  persistence: WorkspacePersistence;
  children: ReactNode;
}) {
  const [{ dataset, isDemo }, setData] = useState(() =>
    initial.dataset ? { dataset: initial.dataset, isDemo: false } : { dataset: createDemoDataset(), isDemo: true },
  );
  const [studentId, setStudentIdState] = useState<string>(initial.studentId);
  const [todoStore, setTodoStore] = useState<TodoStore>(initial.todos);
  const syncStatus = useSyncExternalStore(persistence.subscribe, persistence.status);
  const framework = DEFAULT_FRAMEWORK;

  const classEval = useMemo(() => evaluateClass(dataset, framework), [dataset, framework]);
  const activeId = dataset.students.some((s) => s.id === studentId) ? studentId : dataset.students[0].id;

  // 只保存用户的修改，挂载时的初始值无需回写
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) persistence.saveTodos(todoStore);
    loaded.current = true;
  }, [persistence, todoStore]);

  const setStudentId = useCallback(
    (id: string) => {
      setStudentIdState(id);
      persistence.saveStudent(id);
    },
    [persistence],
  );

  const importDataset = useCallback(
    (next: Dataset) => {
      persistence.saveDataset(next);
      setData({ dataset: next, isDemo: false });
    },
    [persistence],
  );

  const resetDemo = useCallback(() => {
    persistence.saveDataset(null);
    setData({ dataset: createDemoDataset(), isDemo: true });
  }, [persistence]);

  const todos = useMemo<StudentOSValue['todos']>(() => {
    const done = new Set(todoStore.done[activeId] ?? []);
    const update = (fn: (draft: TodoStore) => TodoStore) => setTodoStore((prev) => fn(prev));
    return {
      isDone: (todoId) => done.has(todoId),
      toggle: (todoId) =>
        update((prev) => {
          const list = new Set(prev.done[activeId] ?? []);
          if (list.has(todoId)) list.delete(todoId);
          else list.add(todoId);
          return { ...prev, done: { ...prev.done, [activeId]: [...list] } };
        }),
      custom: todoStore.custom[activeId] ?? [],
      addCustom: (title, priority) =>
        update((prev) => ({
          ...prev,
          custom: {
            ...prev.custom,
            [activeId]: [
              ...(prev.custom[activeId] ?? []),
              { id: `custom:${Date.now().toString(36)}`, title, priority, createdAt: new Date().toISOString() },
            ],
          },
        })),
      removeCustom: (id) =>
        update((prev) => ({
          done: { ...prev.done, [activeId]: (prev.done[activeId] ?? []).filter((d) => d !== id) },
          custom: { ...prev.custom, [activeId]: (prev.custom[activeId] ?? []).filter((t) => t.id !== id) },
        })),
      clear: () => setTodoStore({ done: {}, custom: {} }),
    };
  }, [todoStore, activeId]);

  const value: StudentOSValue = {
    dataset,
    isDemo,
    framework,
    classEval,
    studentId: activeId,
    setStudentId,
    importDataset,
    resetDemo,
    todos,
    sync: { remote: persistence.remote, status: syncStatus, retry: persistence.retry },
  };
  return <StudentOSContext.Provider value={value}>{children}</StudentOSContext.Provider>;
}

export function useStudentOS(): StudentOSValue {
  const ctx = useContext(StudentOSContext);
  if (!ctx) throw new Error('useStudentOS must be used inside <StudentOSProvider>');
  return ctx;
}
