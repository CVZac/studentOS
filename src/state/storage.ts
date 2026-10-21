/** localStorage 读写；隐私模式或禁用存储时静默降级为内存状态 */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用时忽略
  }
}

export const KEYS = {
  dataset: 'studentos.dataset.v1',
  student: 'studentos.student.v1',
  todos: 'studentos.todos.v1',
  theme: 'studentos.theme.v1',
} as const;
