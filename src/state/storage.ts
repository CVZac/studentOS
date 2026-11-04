type Area = 'local' | 'session';

const area = (a: Area) => (a === 'local' ? window.localStorage : window.sessionStorage);

/** 浏览器存储读写；隐私模式或禁用存储时静默降级为内存状态 */
export function readJSON<T>(key: string, fallback: T, from: Area = 'local'): T {
  try {
    const raw = area(from).getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown, to: Area = 'local') {
  try {
    if (value === undefined) area(to).removeItem(key);
    else area(to).setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用时忽略
  }
}

export function removeKeys(keys: readonly string[]) {
  for (const key of keys) writeJSON(key, undefined);
}

/** 把旧键的值搬到新键（目标已存在时不覆盖） */
export function moveKey(from: string, to: string) {
  try {
    const value = window.localStorage.getItem(from);
    if (value === null) return;
    if (window.localStorage.getItem(to) === null) window.localStorage.setItem(to, value);
    window.localStorage.removeItem(from);
  } catch {
    // 存储不可用时忽略
  }
}

/** 本地存储是否可持久化写入 */
export function storageAvailable(): boolean {
  try {
    const probe = 'studentos.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export const KEYS = {
  theme: 'studentos.theme.v1',
  accounts: 'studentos.accounts.v1',
  session: 'studentos.session.v1',
} as const;

/** 每个账号独立的工作区：班级数据、当前学生与待办进度 */
export const workspaceKeys = (accountId: string) => ({
  dataset: `studentos.ws.${accountId}.dataset.v1`,
  student: `studentos.ws.${accountId}.student.v1`,
  todos: `studentos.ws.${accountId}.todos.v1`,
});

/** 登录功能上线前的全局键，首个注册账号会继承这些数据 */
export const LEGACY_WORKSPACE = {
  dataset: 'studentos.dataset.v1',
  student: 'studentos.student.v1',
  todos: 'studentos.todos.v1',
} as const;
