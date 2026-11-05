import { DatabaseSync } from 'node:sqlite';

export interface UserRow {
  id: string;
  username: string;
  username_key: string;
  password_hash: string;
  created_at: string;
}

export interface WorkspaceRow {
  dataset: string | null;
  student_id: string;
  todos: string;
  updated_at: string;
}

const EMPTY_TODOS = JSON.stringify({ done: {}, custom: {} });

/** 按 PRAGMA user_version 递增执行的迁移，只追加、不修改已发布的条目 */
const MIGRATIONS = [
  `CREATE TABLE users (
     id TEXT PRIMARY KEY,
     username TEXT NOT NULL,
     username_key TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     persistent INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE workspaces (
     user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     dataset TEXT,
     student_id TEXT NOT NULL DEFAULT '',
     todos TEXT NOT NULL DEFAULT '${EMPTY_TODOS}',
     updated_at TEXT NOT NULL
   );`,
];

export function openDatabase(file: string) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const version = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  // 启动时确认可写，避免在第一个写请求时才发现权限问题
  db.exec('BEGIN IMMEDIATE; ROLLBACK;');

  const q = {
    userByKey: db.prepare('SELECT * FROM users WHERE username_key = ?'),
    insertUser: db.prepare(
      'INSERT INTO users (id, username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ),
    insertWorkspace: db.prepare('INSERT INTO workspaces (user_id, updated_at) VALUES (?, ?)'),
    updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    insertSession: db.prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, persistent) VALUES (?, ?, ?, ?, ?)',
    ),
    sessionUser: db.prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteOtherSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    workspace: db.prepare('SELECT dataset, student_id, todos, updated_at FROM workspaces WHERE user_id = ?'),
    setDataset: db.prepare('UPDATE workspaces SET dataset = ?, updated_at = ? WHERE user_id = ?'),
    setStudent: db.prepare('UPDATE workspaces SET student_id = ?, updated_at = ? WHERE user_id = ?'),
    setTodos: db.prepare('UPDATE workspaces SET todos = ?, updated_at = ? WHERE user_id = ?'),
    ping: db.prepare('SELECT 1 AS ok'),
  };

  const now = () => new Date().toISOString();

  return {
    userByKey: (key: string) => q.userByKey.get(key) as UserRow | undefined,
    createUser(user: UserRow) {
      db.exec('BEGIN');
      try {
        q.insertUser.run(user.id, user.username, user.username_key, user.password_hash, user.created_at);
        q.insertWorkspace.run(user.id, user.created_at);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    updatePassword: (userId: string, hash: string) => void q.updatePassword.run(hash, userId),
    /** 会话与工作区通过外键级联删除 */
    deleteUser: (userId: string) => void q.deleteUser.run(userId),
    createSession: (tokenHash: string, userId: string, createdAt: number, expiresAt: number, persistent: boolean) =>
      void q.insertSession.run(tokenHash, userId, createdAt, expiresAt, persistent ? 1 : 0),
    sessionUser: (tokenHash: string, at: number) => q.sessionUser.get(tokenHash, at) as UserRow | undefined,
    deleteSession: (tokenHash: string) => void q.deleteSession.run(tokenHash),
    deleteOtherSessions: (userId: string, keepHash: string) => void q.deleteOtherSessions.run(userId, keepHash),
    purgeSessions: (at: number) => Number(q.purgeSessions.run(at).changes),
    workspace: (userId: string) => q.workspace.get(userId) as WorkspaceRow | undefined,
    setDataset: (userId: string, json: string | null) => void q.setDataset.run(json, now(), userId),
    setStudent: (userId: string, studentId: string) => void q.setStudent.run(studentId, now(), userId),
    setTodos: (userId: string, json: string) => void q.setTodos.run(json, now(), userId),
    ping: () => (q.ping.get() as { ok: number }).ok === 1,
    close: () => db.close(),
  };
}

export type Store = ReturnType<typeof openDatabase>;
