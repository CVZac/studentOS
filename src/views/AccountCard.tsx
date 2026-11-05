import { useState } from 'react';
import type { FormEvent } from 'react';
import { PasswordField, StrengthMeter } from '../components/Field';
import { Icon } from '../components/Icon';
import { Card, ConfirmButton } from '../components/ui';
import { PASSWORD_RULE, passwordStrength, validatePassword } from '../core/auth';
import type { AuthField } from '../core/auth';
import { useAuth } from '../state/auth';

function ChangePassword() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setNote(null);
    const found: Partial<Record<AuthField, string>> = {
      current: current ? undefined : '请输入当前密码',
      password: validatePassword(next) ?? undefined,
    };
    if (!found.password && confirm !== next) found.confirm = confirm ? '两次输入的密码不一致' : '请再次输入新密码';
    if (Object.values(found).some(Boolean)) return setErrors(found);

    setErrors({});
    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (!result.ok) {
      if (result.field) setErrors({ [result.field]: result.error });
      else setNote({ ok: false, text: result.error });
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setNote({ ok: true, text: '密码已更新，下次登录请使用新密码' });
  };

  return (
    <form className="auth-form" noValidate onSubmit={submit} aria-busy={busy}>
      <h3 className="account-section-title">修改密码</h3>
      <PasswordField
        id="pw-current"
        label="当前密码"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        maxLength={64}
        error={errors.current}
      />
      <PasswordField
        id="pw-next"
        label="新密码"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        maxLength={64}
        hint={PASSWORD_RULE}
        error={errors.password}
      >
        {next && <StrengthMeter level={passwordStrength(next)} />}
      </PasswordField>
      <PasswordField
        id="pw-confirm"
        label="确认新密码"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        maxLength={64}
        error={errors.confirm}
      />
      {note && (
        <div className="notice" style={{ ['--tone' as string]: note.ok ? 'var(--good)' : 'var(--critical)' }} role={note.ok ? 'status' : 'alert'}>
          {note.text}
        </div>
      )}
      <button type="submit" className="btn primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? '正在更新…' : '更新密码'}
      </button>
    </form>
  );
}

function DeleteAccount() {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError('');
    const result = await deleteAccount(password);
    // 成功后会退出登录并回到登录页
    if (result.ok) return;
    setBusy(false);
    setError(result.error);
  };

  return (
    <div className="auth-form">
      <h3 className="account-section-title">删除账号</h3>
      <p className="card-sub" style={{ marginTop: -8 }}>
        该账号的班级数据、待办记录会一并清除，无法恢复。删除前可先在下方导出数据。
      </p>
      <PasswordField
        id="delete-password"
        label="输入密码以确认"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        maxLength={64}
        error={error || undefined}
      />
      <ConfirmButton
        label={busy ? '正在删除…' : '删除账号'}
        prompt="确定永久删除这个账号？"
        confirmLabel="删除"
        icon={<Icon name="trash" size={16} />}
        danger
        disabled={!password || busy}
        onConfirm={() => void run()}
      />
    </div>
  );
}

export function AccountCard() {
  const { account, logout, mode } = useAuth();
  if (!account) return null;
  return (
    <Card
      className="span-12"
      title="账号"
      sub={
        mode === 'server'
          ? '账号与数据保存在云端服务器，可在任意设备登录；修改密码后其他设备需重新登录'
          : '账号保存在当前浏览器中，换设备或清除浏览器数据后需要重新注册'
      }
    >
      <div className="account-grid">
        <div className="account-summary">
          <span className="avatar account-avatar" aria-hidden="true">
            {account.username.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="account-name">{account.username}</div>
            <div className="card-sub">注册于 {account.createdAt.slice(0, 10)}</div>
          </div>
          <button type="button" className="btn" onClick={logout}>
            <Icon name="logout" size={16} />
            退出登录
          </button>
        </div>
        <ChangePassword />
        <DeleteAccount />
      </div>
    </Card>
  );
}
