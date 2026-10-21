import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { validateDataset } from '../core/dataset';
import { evaluateClass } from '../core/evaluation';
import type { ClassEvaluation } from '../core/evaluation';
import { DEFAULT_FRAMEWORK } from '../core/framework';
import type { EvaluationFramework } from '../core/framework';
import type { Priority } from '../core/recommendations';
import type { Dataset } from '../core/types';
import { createDemoDataset } from '../data/demo';
import { KEYS, readJSON, writeJSON } from './storage';

export interface CustomTodo {
  id: string;
  title: string;
  priority: Priority;
  createdAt: string;
}

interface TodoStore {
  /** studentId → 已完成的待办 id */
  done: Record<string, string[]>;
  custom: Record<string, CustomTodo[]>;
}

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
}

const StudentOSContext = createContext<StudentOSValue | null>(null);

function loadDataset(): { dataset: Dataset; isDemo: boolean } {
  const stored = readJSON<unknown>(KEYS.dataset, null);
  if (stored) {
    const result = validateDataset(stored);
    if (result.ok) return { dataset: result.dataset, isDemo: false };
  }
  return { dataset: createDemoDataset(), isDemo: true };
}

export function StudentOSProvider({ children }: { children: ReactNode }) {
  const [{ dataset, isDemo }, setData] = useState(loadDataset);
  const [studentId, setStudentIdState] = useState<string>(() => readJSON(KEYS.student, ''));
  const [todoStore, setTodoStore] = useState<TodoStore>(() => readJSON(KEYS.todos, { done: {}, custom: {} }));
  const framework = DEFAULT_FRAMEWORK;

  const classEval = useMemo(() => evaluateClass(dataset, framework), [dataset, framework]);
  const activeId = dataset.students.some((s) => s.id === studentId) ? studentId : dataset.students[0].id;

  useEffect(() => writeJSON(KEYS.todos, todoStore), [todoStore]);

  const setStudentId = useCallback((id: string) => {
    setStudentIdState(id);
    writeJSON(KEYS.student, id);
  }, []);

  const importDataset = useCallback((next: Dataset) => {
    writeJSON(KEYS.dataset, next);
    setData({ dataset: next, isDemo: false });
  }, []);

  const resetDemo = useCallback(() => {
    writeJSON(KEYS.dataset, undefined);
    setData({ dataset: createDemoDataset(), isDemo: true });
  }, []);

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
  };
  return <StudentOSContext.Provider value={value}>{children}</StudentOSContext.Provider>;
}

export function useStudentOS(): StudentOSValue {
  const ctx = useContext(StudentOSContext);
  if (!ctx) throw new Error('useStudentOS must be used inside <StudentOSProvider>');
  return ctx;
}
