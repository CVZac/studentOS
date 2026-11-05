import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PasswordField, StrengthMeter, TextField } from '../components/Field';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { RadarChart } from '../components/RadarChart';
import { LevelBadge, Segmented, fmt } from '../components/ui';
import { PASSWORD_RULE, USERNAME_RULE, passwordStrength, validatePassword, validateUsername } from '../core/auth';
import type { AuthField } from '../core/auth';
import { evaluateClass } from '../core/evaluation';
import { DEFAULT_FRAMEWORK } from '../core/framework';
import { createDemoDataset } from '../data/demo';
import { useAuth } from '../state/auth';
import { useTheme } from '../state/ui';

type Mode = 'login' | 'register';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'radar', title: '综合素质雷达', text: '6 个维度、17 项指标，自评、互评、师评融合' },
  { icon: 'scores', title: '成绩区间分析', text: '各科最高分、最低分、平均分与走势' },
  { icon: 'todos', title: '提升待办', text: '从薄弱项自动生成下一步计划' },
];

/** 登录页左侧的产品预览，使用演示数据中的示例学生 */
function Preview() {
  const preview = useMemo(() => {
    const dataset = createDemoDataset();
    const cls = evaluateClass(dataset, DEFAULT_FRAMEWORK);
    const student = dataset.students[0];
    return { dataset, student, evaluation: cls.results.get(student.id)!, averages: cls.dimensionAverages };
  }, []);
  const dims = preview.evaluation.dimensions;

  return (
    <div
      className="auth-preview"
      aria-hidden="true"
      ref={(el) => el?.setAttribute('inert', '')}
    >
      <div className="auth-preview-head">
        <div>
          <span className="chip">示例 · {preview.dataset.className}</span>
          <div className="auth-preview-name">{preview.student.name}</div>
        </div>
        <div className="auth-preview-score">
          <span className="num">{fmt(preview.evaluation.composite)}</span>
          <LevelBadge level={preview.evaluation.level} />
        </div>
      </div>
      <RadarChart
        ariaLabel="示例综合素质雷达图"
        axes={dims.map((d) => ({ id: d.def.id, label: d.def.short }))}
        series={[
          { id: 'class', label: '班级平均', variant: 'ref', values: dims.map((d) => preview.averages[d.def.id]) },
          { id: 'me', label: '本人', variant: 'main', values: dims.map((d) => d.score) },
        ]}
      />
    </div>
  );
}

export function AuthScreen() {
  const auth = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<Mode>(auth.hasAccounts ? 'login' : 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = {
    username: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirm: useRef<HTMLInputElement>(null),
  };
  const isRegister = mode === 'register';

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError('');
    setPassword('');
    setConfirm('');
  };

  const showErrors = (next: Partial<Record<AuthField, string>>) => {
    setErrors(next);
    const first = (['username', 'password', 'confirm'] as const).find((f) => next[f]);
    if (first) refs[first].current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');

    const found: Partial<Record<AuthField, string>> = {};
    if (isRegister) {
      found.username = validateUsername(username) ?? undefined;
      found.password = validatePassword(password) ?? undefined;
      if (!found.password && confirm !== password) found.confirm = confirm ? '两次输入的密码不一致' : '请再次输入密码';
    } else {
      if (!username.trim()) found.username = '请输入用户名';
      if (!password) found.password = '请输入密码';
    }
    if (Object.values(found).some(Boolean)) return showErrors(found);

    setErrors({});
    setBusy(true);
    const result = await (isRegister ? auth.register : auth.login)(username, password, remember);
    // 成功后 AuthProvider 切换到应用界面，本组件随之卸载
    if (result.ok) return;
    setBusy(false);
    if (result.field) showErrors({ [result.field]: result.error });
    else setFormError(result.error);
  };

  return (
    <div className="auth">
      <section className="auth-showcase">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">Student OS</div>
            <div className="brand-sub">学生成长操作系统</div>
          </div>
        </div>
        <div>
          <h1 className="auth-headline">看见每位学生的成长全貌</h1>
          <p className="auth-lede">把考试成绩和日常表现汇总成能力画像，再转化为下一步该做的事。</p>
        </div>
        <Preview />
        <ul className="auth-features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="auth-feature-icon">
                <Icon name={f.icon} size={17} />
              </span>
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-panel">
        <button
          type="button"
          className="icon-btn auth-theme"
          onClick={toggle}
          aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>

        <div className="auth-card">
          <Segmented<Mode>
            label="登录或注册"
            value={mode}
            onChange={switchMode}
            className="block"
            options={[
              { value: 'login', label: '登录' },
              { value: 'register', label: '注册' },
            ]}
          />

          <div>
            <h2 className="auth-title">{isRegister ? '创建账号' : '欢迎回来'}</h2>
            <p className="auth-sub">
              {isRegister ? '注册后即可使用，新账号自带一份演示班级数据。' : '登录后继续查看你的班级与学生数据。'}
            </p>
          </div>

          {auth.notice && !formError && (
            <div className="notice" style={{ ['--tone' as string]: 'var(--warning)' }} role="status">
              {auth.notice}
            </div>
          )}

          {!auth.persistent && (
            <div className="notice" style={{ ['--tone' as string]: 'var(--warning)' }} role="status">
              当前浏览器禁止本地存储，账号只在本次打开期间有效。
            </div>
          )}

          <form className="auth-form" noValidate onSubmit={submit} aria-busy={busy}>
            <TextField
              id="auth-username"
              label="用户名"
              inputRef={refs.username}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={40}
              placeholder={isRegister ? '例如：li_laoshi' : ''}
              hint={isRegister ? USERNAME_RULE : undefined}
              error={errors.username}
            />
            <PasswordField
              id="auth-password"
              label="密码"
              inputRef={refs.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              maxLength={64}
              hint={isRegister ? PASSWORD_RULE : undefined}
              error={errors.password}
            >
              {isRegister && password && <StrengthMeter level={passwordStrength(password)} />}
            </PasswordField>
            {isRegister && (
              <PasswordField
                id="auth-confirm"
                label="确认密码"
                inputRef={refs.confirm}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                maxLength={64}
                error={errors.confirm}
              />
            )}

            <label className="checkbox" htmlFor="auth-remember">
              <input id="auth-remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              保持登录 30 天
            </label>

            {formError && (
              <div className="notice" style={{ ['--tone' as string]: 'var(--critical)' }} role="alert">
                {formError}
              </div>
            )}

            <button type="submit" className="btn primary block" disabled={busy}>
              {busy ? (isRegister ? '正在创建账号…' : '正在登录…') : isRegister ? '注册并登录' : '登录'}
            </button>
          </form>

          <p className="auth-foot">
            <Icon name="lock" size={15} />
            <span>
              {auth.mode === 'server'
                ? '账号与数据保存在 Student OS 服务器，可在任意设备登录；密码经加盐哈希存储，登录凭证仅通过加密 Cookie 传输。'
                : '账号和数据只保存在当前浏览器中，不会上传到服务器。忘记密码无法找回，请妥善保管。'}
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
