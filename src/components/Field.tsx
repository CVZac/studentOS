import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon } from './Icon';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  /** 不用 ref 属性名：Artifact 构建运行在 React 18，函数组件不接收 ref */
  inputRef?: Ref<HTMLInputElement>;
  trailing?: ReactNode;
  children?: ReactNode;
}

/** 带标签、提示与错误信息的输入框；错误出现时替换提示并通过 aria-describedby 关联 */
export function TextField({ id, label, hint, error, inputRef, trailing, children, className, ...input }: FieldProps) {
  const note = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field${error ? ' invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`field-control${trailing ? ' has-trailing' : ''}`}>
        <input id={id} ref={inputRef} aria-invalid={error ? true : undefined} aria-describedby={note} {...input} />
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="off"
      trailing={
        <button
          type="button"
          className="reveal"
          aria-label={visible ? '隐藏密码' : '显示密码'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={17} />
        </button>
      }
    />
  );
}

const STRENGTH = [
  { label: '弱', tone: 'var(--critical)' },
  { label: '一般', tone: 'var(--warning)' },
  { label: '良好', tone: 'var(--accent)' },
  { label: '强', tone: 'var(--good)' },
];

/** 密码强度条：4 段，颜色配合文字标签，不单靠颜色传达 */
export function StrengthMeter({ level }: { level: 0 | 1 | 2 | 3 }) {
  const meta = STRENGTH[level];
  return (
    <div className="strength" aria-live="polite">
      <div className="strength-bars" aria-hidden="true">
        {STRENGTH.map((s, i) => (
          <span key={s.label} style={i <= level ? { background: meta.tone } : undefined} />
        ))}
      </div>
      <span>密码强度：{meta.label}</span>
    </div>
  );
}
