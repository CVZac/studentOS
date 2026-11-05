import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDemoDataset } from '../../src/data/demo';
import { createApp } from '../app';
import type { AppOptions } from '../app';
import { openDatabase } from '../db';
import { hashPassword, verifyPassword } from '../password';

// 测试中调低 scrypt 成本以加快速度；生产默认 N=2^15
const FAST = { N: 1024, r: 8, p: 1 };

async function start(overrides: Partial<AppOptions> = {}) {
  const store = openDatabase(':memory:');
  const staticDir = mkdtempSync(path.join(tmpdir(), 'sos-static-'));
  mkdirSync(path.join(staticDir, 'assets'));
  writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>Student OS</title>');
  writeFileSync(path.join(staticDir, 'assets', 'app-abc123.js'), 'console.log(1)');
  let clock = Date.parse('2026-11-05T08:00:00Z');
  const app = createApp({ store, staticDir, scrypt: FAST, log: false, now: () => clock, ...overrides });
  const server: Server = createServer(app.handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call(method: string, url: string, init: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
    });
    const text = await res.text();
    const setCookie = res.headers.get('set-cookie') ?? '';
    return {
      status: res.status,
      headers: res.headers,
      json: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null,
      text,
      setCookie,
      cookie: setCookie.split(';')[0],
    };
  }

  return {
    store,
    call,
    base,
    advance: (ms: number) => (clock += ms),
    stop: () => {
      app.close();
      server.close();
      store.close();
    },
  };
}

type Ctx = Awaited<ReturnType<typeof start>>;

async function register(ctx: Ctx, username: string, password = 'study2026', remember = true) {
  const res = await ctx.call('POST', '/api/auth/register', { body: { username, password, remember } });
  expect(res.status).toBe(201);
  return res.cookie;
}

describe('password', () => {
  it('默认参数生成自描述的 scrypt 哈希并可验证', async () => {
    const stored = await hashPassword('study2026');
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword('study2026', stored)).toBe(true);
    expect(await verifyPassword('study2027', stored)).toBe(false);
    expect(await verifyPassword('study2026', 'plain')).toBe(false);
  });
});

describe('API', () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await start();
  });
  afterAll(() => ctx.stop());

  it('健康检查', async () => {
    const res = await ctx.call('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('注册校验与字段级错误', async () => {
    const bad = await ctx.call('POST', '/api/auth/register', { body: { username: 'a', password: 'study2026' } });
    expect(bad.status).toBe(400);
    expect(bad.json.field).toBe('username');
    const weak = await ctx.call('POST', '/api/auth/register', { body: { username: 'alpha', password: 'abcdefgh' } });
    expect(weak.json).toMatchObject({ field: 'password', error: '密码需同时包含字母和数字' });
  });

  it('注册后下发 HttpOnly 会话 cookie，密码以哈希保存', async () => {
    const res = await ctx.call('POST', '/api/auth/register', { body: { username: 'Teacher_Li', password: 'study2026', remember: true } });
    expect(res.status).toBe(201);
    expect(res.json.account).toMatchObject({ username: 'Teacher_Li' });
    expect(res.json.account).not.toHaveProperty('password_hash');
    expect(res.setCookie).toMatch(/^sos_session=/);
    expect(res.setCookie).toMatch(/HttpOnly/);
    expect(res.setCookie).toMatch(/SameSite=Lax/);
    expect(res.setCookie).toMatch(/Max-Age=2592000/);
    expect(res.setCookie).not.toMatch(/Secure/);
    const row = ctx.store.userByKey('teacher_li')!;
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain('study2026');

    const me = await ctx.call('GET', '/api/auth/me', { cookie: res.cookie });
    expect(me.json.account.username).toBe('Teacher_Li');
  });

  it('用户名不区分大小写与全半角', async () => {
    const dup = await ctx.call('POST', '/api/auth/register', { body: { username: 'ＴＥＡＣＨＥＲ_li', password: 'study2026' } });
    expect(dup.status).toBe(409);
    expect(dup.json.field).toBe('username');
  });

  it('不保持登录时下发会话级 cookie', async () => {
    const res = await ctx.call('POST', '/api/auth/login', { body: { username: 'teacher_li', password: 'study2026', remember: false } });
    expect(res.status).toBe(200);
    expect(res.setCookie).not.toMatch(/Max-Age/);
  });

  it('错误密码与不存在的用户返回同样的提示', async () => {
    const wrong = await ctx.call('POST', '/api/auth/login', { body: { username: 'teacher_li', password: 'nope12345' } });
    const missing = await ctx.call('POST', '/api/auth/login', { body: { username: 'ghost', password: 'nope12345' } });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.json.error).toBe(missing.json.error);
  });

  it('连续 5 次失败后锁定 30 秒', async () => {
    await register(ctx, 'locky');
    for (let i = 0; i < 4; i++) {
      expect((await ctx.call('POST', '/api/auth/login', { body: { username: 'locky', password: 'wrong1234' } })).status).toBe(401);
    }
    const fifth = await ctx.call('POST', '/api/auth/login', { body: { username: 'locky', password: 'wrong1234' } });
    expect(fifth.status).toBe(429);
    const blocked = await ctx.call('POST', '/api/auth/login', { body: { username: 'locky', password: 'study2026' } });
    expect(blocked.status).toBe(429);
    ctx.advance(30_001);
    expect((await ctx.call('POST', '/api/auth/login', { body: { username: 'locky', password: 'study2026' } })).status).toBe(200);
  });

  it('退出后会话失效', async () => {
    const cookie = await register(ctx, 'leaver');
    const out = await ctx.call('POST', '/api/auth/logout', { cookie });
    expect(out.status).toBe(204);
    expect(out.setCookie).toMatch(/Max-Age=0/);
    expect((await ctx.call('GET', '/api/auth/me', { cookie })).json.account).toBeNull();
  });

  it('工作区读写，数据集经过服务端校验', async () => {
    const cookie = await register(ctx, 'wsuser');
    const empty = await ctx.call('GET', '/api/workspace', { cookie });
    expect(empty.json).toMatchObject({ dataset: null, studentId: '', todos: { done: {}, custom: {} } });

    const invalid = await ctx.call('PUT', '/api/workspace/dataset', { cookie, body: { dataset: { version: 2 } } });
    expect(invalid.status).toBe(400);
    expect(invalid.json.details.length).toBeGreaterThan(0);

    const dataset = createDemoDataset();
    expect((await ctx.call('PUT', '/api/workspace/dataset', { cookie, body: { dataset } })).status).toBe(204);
    expect((await ctx.call('PUT', '/api/workspace/student', { cookie, body: { studentId: dataset.students[3].id } })).status).toBe(204);
    const todos = { done: { [dataset.students[3].id]: ['subject:math'] }, custom: {} };
    expect((await ctx.call('PUT', '/api/workspace/todos', { cookie, body: { todos } })).status).toBe(204);
    expect((await ctx.call('PUT', '/api/workspace/todos', { cookie, body: { todos: { done: [] } } })).status).toBe(400);

    const saved = await ctx.call('GET', '/api/workspace', { cookie });
    expect(saved.json.dataset.students).toHaveLength(40);
    expect(saved.json.studentId).toBe(dataset.students[3].id);
    expect(saved.json.todos).toEqual(todos);

    expect((await ctx.call('PUT', '/api/workspace/dataset', { cookie, body: { dataset: null } })).status).toBe(204);
    expect((await ctx.call('GET', '/api/workspace', { cookie })).json.dataset).toBeNull();
  });

  it('不同账号的工作区互相隔离，未登录不可访问', async () => {
    const a = await register(ctx, 'iso_a');
    const b = await register(ctx, 'iso_b');
    await ctx.call('PUT', '/api/workspace/student', { cookie: a, body: { studentId: 'only-a' } });
    expect((await ctx.call('GET', '/api/workspace', { cookie: b })).json.studentId).toBe('');
    expect((await ctx.call('GET', '/api/workspace')).status).toBe(401);
  });

  it('修改密码：校验当前密码，并使其他会话失效', async () => {
    const first = await register(ctx, 'changer');
    const second = (await ctx.call('POST', '/api/auth/login', { body: { username: 'changer', password: 'study2026' } })).cookie;
    const wrong = await ctx.call('POST', '/api/auth/password', { cookie: first, body: { current: 'nope12345', next: 'newpass2027' } });
    expect(wrong.json).toMatchObject({ field: 'current' });
    const ok = await ctx.call('POST', '/api/auth/password', { cookie: first, body: { current: 'study2026', next: 'newpass2027' } });
    expect(ok.status).toBe(204);
    expect((await ctx.call('GET', '/api/auth/me', { cookie: first })).json.account.username).toBe('changer');
    expect((await ctx.call('GET', '/api/auth/me', { cookie: second })).json.account).toBeNull();
    expect((await ctx.call('POST', '/api/auth/login', { body: { username: 'changer', password: 'newpass2027' } })).status).toBe(200);
  });

  it('删除账号需要密码，删除后用户名可重新注册', async () => {
    const cookie = await register(ctx, 'goner');
    expect((await ctx.call('DELETE', '/api/auth/account', { cookie, body: { password: 'wrong1234' } })).status).toBe(400);
    expect((await ctx.call('DELETE', '/api/auth/account', { cookie, body: { password: 'study2026' } })).status).toBe(204);
    expect((await ctx.call('GET', '/api/auth/me', { cookie })).json.account).toBeNull();
    expect(ctx.store.userByKey('goner')).toBeUndefined();
    await register(ctx, 'goner');
  });

  it('拒绝跨站来源、非 JSON 与过大的请求', async () => {
    const evil = await ctx.call('POST', '/api/auth/login', {
      body: { username: 'teacher_li', password: 'study2026' },
      headers: { Origin: 'https://evil.example' },
    });
    expect(evil.status).toBe(403);
    const same = await ctx.call('POST', '/api/auth/login', {
      body: { username: 'teacher_li', password: 'study2026' },
      headers: { Origin: ctx.base },
    });
    expect(same.status).toBe(200);
    const form = await ctx.call('POST', '/api/auth/login', {
      body: 'username=a&password=b',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(form.status).toBe(415);
    const huge = await ctx.call('POST', '/api/auth/login', { body: { username: 'x'.repeat(40_000), password: 'y' } });
    expect(huge.status).toBe(413);
  });

  it('提供前端页面与安全响应头', async () => {
    const index = await ctx.call('GET', '/');
    expect(index.status).toBe(200);
    expect(index.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(index.headers.get('x-frame-options')).toBe('DENY');
    expect(index.headers.get('cache-control')).toBe('no-cache');
    const asset = await ctx.call('GET', '/assets/app-abc123.js');
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await ctx.call('GET', '/%2e%2e/package.json')).status).toBe(404);
    const api404 = await ctx.call('GET', '/api/nope');
    expect(api404.status).toBe(404);
    expect(api404.json.error).toBe('接口不存在');
  });
});

describe('HTTPS 部署', () => {
  it('使用 __Host- 前缀的 Secure cookie，并只接受公开地址作为来源', async () => {
    const ctx = await start({ publicUrl: 'https://studentos.example.com' });
    const res = await ctx.call('POST', '/api/auth/register', {
      body: { username: 'secure_user', password: 'study2026' },
      headers: { Origin: 'https://studentos.example.com' },
    });
    expect(res.status).toBe(201);
    expect(res.setCookie).toMatch(/^__Host-sos_session=/);
    expect(res.setCookie).toMatch(/Secure/);
    const other = await ctx.call('POST', '/api/auth/login', {
      body: { username: 'secure_user', password: 'study2026' },
      headers: { Origin: ctx.base },
    });
    expect(other.status).toBe(403);
    ctx.stop();
  });

  it('位于代理之后时按客户端 IP 限流', async () => {
    const ctx = await start({ trustProxy: true });
    // 每次换用户名，排除单个用户名的失败锁定，只验证按 IP 的窗口限流
    let n = 0;
    const attempt = (ip: string) =>
      ctx.call('POST', '/api/auth/login', {
        body: { username: `user${n++}`, password: 'x1234567' },
        headers: { 'X-Forwarded-For': `10.0.0.1, ${ip}` },
      });
    for (let i = 0; i < 30; i++) expect((await attempt('203.0.113.7')).status).toBe(401);
    expect((await attempt('203.0.113.7')).status).toBe(429);
    expect((await attempt('198.51.100.9')).status).toBe(401);
    ctx.stop();
  });

  it('位于代理之后且未配置 PUBLIC_URL 时，按代理转发的主机名校验来源', async () => {
    const proxied = await start({ trustProxy: true });
    const body = { username: 'proxied_user', password: 'study2026' };
    const ok = await proxied.call('POST', '/api/auth/register', {
      body,
      headers: { Origin: 'https://preview.example', 'X-Forwarded-Host': 'preview.example' },
    });
    expect(ok.status).toBe(201);
    const spoofed = await proxied.call('POST', '/api/auth/login', {
      body,
      headers: { Origin: 'https://evil.example', 'X-Forwarded-Host': 'preview.example' },
    });
    expect(spoofed.status).toBe(403);
    proxied.stop();

    // 不信任代理时忽略 X-Forwarded-Host
    const direct = await start();
    const ignored = await direct.call('POST', '/api/auth/register', {
      body,
      headers: { Origin: 'https://preview.example', 'X-Forwarded-Host': 'preview.example' },
    });
    expect(ignored.status).toBe(403);
    direct.stop();
  });
});
