import { validateDataset } from '../core/dataset';
import type { Priority } from '../core/recommendations';
import type { Dataset } from '../core/types';
import { api } from './api';
import { readJSON, workspaceKeys, writeJSON } from './storage';

export interface CustomTodo {
  id: string;
  title: string;
  priority: Priority;
  createdAt: string;
}

export interface TodoStore {
  /** studentId → 已完成的待办 id */
  done: Record<string, string[]>;
  custom: Record<string, CustomTodo[]>;
}

/** 一个账号的工作区；dataset 为 null 表示使用演示数据 */
export interface WorkspaceSnapshot {
  dataset: Dataset | null;
  studentId: string;
  todos: TodoStore;
}

export type SyncStatus = 'saved' | 'saving' | 'error';

/** 工作区的保存方式：本地模式写入浏览器存储，云端模式写入服务器 */
export interface WorkspacePersistence {
  readonly remote: boolean;
  saveDataset(dataset: Dataset | null): void;
  saveStudent(studentId: string): void;
  saveTodos(todos: TodoStore): void;
  status(): SyncStatus;
  subscribe(listener: () => void): () => void;
  retry(): void;
  /** 立即发送尚未保存的修改 */
  flush(): Promise<void>;
}

export const emptyTodos = (): TodoStore => ({ done: {}, custom: {} });

const validDataset = (value: unknown): Dataset | null => {
  if (!value) return null;
  const result = validateDataset(value);
  return result.ok ? result.dataset : null;
};

export function localWorkspace(accountId: string): { snapshot: WorkspaceSnapshot; persistence: WorkspacePersistence } {
  const keys = workspaceKeys(accountId);
  return {
    snapshot: {
      dataset: validDataset(readJSON<unknown>(keys.dataset, null)),
      studentId: readJSON(keys.student, ''),
      todos: readJSON(keys.todos, emptyTodos()),
    },
    persistence: {
      remote: false,
      saveDataset: (dataset) => writeJSON(keys.dataset, dataset ?? undefined),
      saveStudent: (id) => writeJSON(keys.student, id),
      saveTodos: (todos) => writeJSON(keys.todos, todos),
      status: () => 'saved',
      subscribe: () => () => {},
      retry: () => {},
      flush: async () => {},
    },
  };
}

export async function loadServerWorkspace() {
  const res = await api<{ dataset: unknown; studentId: string; todos: TodoStore }>('GET', '/api/workspace');
  if (!res.ok) return res;
  return {
    ok: true as const,
    snapshot: {
      dataset: validDataset(res.data.dataset),
      studentId: typeof res.data.studentId === 'string' ? res.data.studentId : '',
      todos: res.data.todos ?? emptyTodos(),
    },
  };
}

type Kind = 'dataset' | 'student' | 'todos';
const PATHS: Record<Kind, string> = {
  dataset: '/api/workspace/dataset',
  student: '/api/workspace/student',
  todos: '/api/workspace/todos',
};
/** 连续修改合并发送的等待时间 */
const DELAY: Record<Kind, number> = { dataset: 0, student: 300, todos: 500 };

/**
 * 云端保存：每类数据只保留最新的待发送值，同一类同时最多一个请求；
 * 失败时保留数据并标记为 error，可手动重试，下一次修改也会自动重发。
 */
export function serverPersistence(onUnauthorized: () => void): WorkspacePersistence {
  const pending = new Map<Kind, unknown>();
  const timers = new Map<Kind, ReturnType<typeof setTimeout>>();
  const inflight = new Map<Kind, Promise<void>>();
  const failed = new Set<Kind>();
  const listeners = new Set<() => void>();
  let current: SyncStatus = 'saved';

  const emit = () => {
    const next: SyncStatus = failed.size ? 'error' : pending.size || inflight.size ? 'saving' : 'saved';
    if (next === current) return;
    current = next;
    listeners.forEach((l) => l());
  };

  const send = (kind: Kind): Promise<void> => {
    clearTimeout(timers.get(kind));
    timers.delete(kind);
    const running = inflight.get(kind);
    if (running) return running;
    if (!pending.has(kind)) return Promise.resolve();
    const body = pending.get(kind);
    pending.delete(kind);
    const task = (async () => {
      // 数据集可能超过 keepalive 的 64KB 上限
      const res = await api('PUT', PATHS[kind], body, { keepalive: kind !== 'dataset' });
      inflight.delete(kind);
      if (res.ok) failed.delete(kind);
      else {
        if (!pending.has(kind)) pending.set(kind, body);
        if (res.status === 401) onUnauthorized();
        else failed.add(kind);
      }
      emit();
      // 请求期间又有新修改时继续发送
      if (res.ok && pending.has(kind)) await send(kind);
    })();
    inflight.set(kind, task);
    emit();
    return task;
  };

  const queue = (kind: Kind, body: unknown) => {
    pending.set(kind, body);
    clearTimeout(timers.get(kind));
    timers.set(kind, setTimeout(() => void send(kind), DELAY[kind]));
    emit();
  };

  return {
    remote: true,
    saveDataset: (dataset) => queue('dataset', { dataset }),
    saveStudent: (studentId) => queue('student', { studentId }),
    saveTodos: (todos) => queue('todos', { todos }),
    status: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retry: () => {
      for (const kind of [...failed]) void send(kind);
    },
    flush: async () => {
      await Promise.all((['dataset', 'student', 'todos'] as Kind[]).map((k) => (pending.has(k) || inflight.has(k) ? send(k) : null)));
    },
  };
}

let beforeLogout: (() => Promise<void>) | null = null;

/** 工作区挂载时登记：退出登录前先保存未发送的修改 */
export function setLogoutFlush(fn: (() => Promise<void>) | null) {
  beforeLogout = fn;
}

export async function flushBeforeLogout() {
  await beforeLogout?.();
}
