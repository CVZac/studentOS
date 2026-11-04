import { describe, expect, it } from 'vitest';
import {
  createAccount,
  findAccount,
  passwordStrength,
  rehashAccount,
  toPublic,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '../auth';
import type { AccountRecord } from '../auth';

// 测试中调低迭代次数以加快速度；生产默认 600,000
const fast = { iterations: 1000 };

async function make(existing: AccountRecord[], username: string, password: string) {
  const result = await createAccount(existing, username, password, fast);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('validateUsername', () => {
  it('接受中文、字母、数字与下划线', () => {
    expect(validateUsername('林知夏')).toBeNull();
    expect(validateUsername('teacher_01')).toBeNull();
    expect(validateUsername('  zhang  ')).toBeNull();
  });

  it('拒绝空值、过短、过长与特殊字符', () => {
    expect(validateUsername('   ')).toBe('请输入用户名');
    expect(validateUsername('a')).toMatch(/2–20 位/);
    expect(validateUsername('a'.repeat(21))).toMatch(/2–20 位/);
    expect(validateUsername('bad name')).toMatch(/2–20 位/);
    expect(validateUsername('x@y')).toMatch(/2–20 位/);
  });
});

describe('validatePassword', () => {
  it('要求 8–64 位且同时包含字母和数字', () => {
    expect(validatePassword('')).toBe('请输入密码');
    expect(validatePassword('abc123')).toBe('密码需为 8–64 位');
    expect(validatePassword('abcdefgh')).toBe('密码需同时包含字母和数字');
    expect(validatePassword('12345678')).toBe('密码需同时包含字母和数字');
    expect(validatePassword('study2026')).toBeNull();
  });
});

describe('passwordStrength', () => {
  it('长度与字符种类越多越强', () => {
    expect(passwordStrength('short1')).toBe(0);
    expect(passwordStrength('study2026')).toBe(1);
    expect(passwordStrength('study2026plus')).toBe(2);
    expect(passwordStrength('Study-2026-Plus')).toBe(3);
  });
});

describe('createAccount / verifyPassword', () => {
  it('注册后可用正确密码验证，错误密码失败', async () => {
    const record = await make([], 'Teacher_Li', 'study2026');
    expect(record.username).toBe('Teacher_Li');
    expect(record.key).toBe('teacher_li');
    expect(record.hash).not.toContain('study2026');
    expect(atob(record.salt)).toHaveLength(16);
    expect(atob(record.hash)).toHaveLength(32);
    expect(await verifyPassword(record, 'study2026')).toBe(true);
    expect(await verifyPassword(record, 'study2027')).toBe(false);
  });

  it('同一密码每次使用不同的盐', async () => {
    const a = await make([], 'alpha', 'study2026');
    const b = await make([], 'bravo', 'study2026');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(a.id).not.toBe(b.id);
  });

  it('用户名不区分大小写与全半角，重复注册被拒绝', async () => {
    const first = await make([], 'abc', 'study2026');
    const dup = await createAccount([first], 'ＡＢＣ', 'study2026', fast);
    expect(dup).toEqual({ ok: false, error: '该用户名已被注册', field: 'username' });
    expect(findAccount([first], ' ABC ')?.id).toBe(first.id);
  });

  it('密码不合规时返回字段级错误', async () => {
    expect(await createAccount([], 'alpha', 'short', fast)).toEqual({
      ok: false,
      error: '密码需为 8–64 位',
      field: 'password',
    });
  });

  it('对外信息不包含哈希与盐', async () => {
    const record = await make([], 'alpha', 'study2026');
    expect(Object.keys(toPublic(record)).sort()).toEqual(['createdAt', 'id', 'username']);
  });
});

describe('rehashAccount', () => {
  it('修改密码后旧密码失效、新密码生效，账号 id 不变', async () => {
    const record = await make([], 'alpha', 'study2026');
    const result = await rehashAccount(record, 'newpass2027', fast);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(record.id);
    expect(await verifyPassword(result.value, 'study2026')).toBe(false);
    expect(await verifyPassword(result.value, 'newpass2027')).toBe(true);
  });

  it('新密码不合规时拒绝', async () => {
    const record = await make([], 'alpha', 'study2026');
    expect((await rehashAccount(record, 'abc', fast)).ok).toBe(false);
  });
});
