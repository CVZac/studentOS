import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { App } from '../App';
import { useAuth } from '../state/auth';
import { StudentOSProvider } from '../state/store';
import { loadServerWorkspace, localWorkspace, serverPersistence, setLogoutFlush } from '../state/workspace';
import type { WorkspacePersistence, WorkspaceSnapshot } from '../state/workspace';

type GateState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: WorkspaceSnapshot; persistence: WorkspacePersistence }
  | { status: 'error'; error: string };

/** 启动与加载时的全屏状态页 */
export function Splash({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="brand-mark">S</div>
      <p className="splash-title">{title}</p>
      {children}
    </div>
  );
}

/** 登录后加载账号的工作区：本地模式同步读取，云端模式从服务器获取 */
export function WorkspaceGate({ accountId }: { accountId: string }) {
  const { mode, expire, logout } = useAuth();
  const [state, setState] = useState<GateState>(() =>
    mode === 'local' ? { status: 'ready', ...localWorkspace(accountId) } : { status: 'loading' },
  );

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await loadServerWorkspace();
    if (res.ok) setState({ status: 'ready', snapshot: res.snapshot, persistence: serverPersistence(expire) });
    else if (res.status === 401) expire();
    else setState({ status: 'error', error: res.error });
  }, [expire]);

  useEffect(() => {
    if (mode === 'server') void load();
  }, [mode, load]);

  const persistence = state.status === 'ready' ? state.persistence : null;
  useEffect(() => {
    if (!persistence?.remote) return;
    // 关闭页面或退出登录前，尽量把未发送的修改送达服务器
    const onHide = () => void persistence.flush();
    window.addEventListener('pagehide', onHide);
    setLogoutFlush(persistence.flush);
    return () => {
      window.removeEventListener('pagehide', onHide);
      setLogoutFlush(null);
    };
  }, [persistence]);

  if (state.status === 'loading') return <Splash title="正在加载工作区…" />;
  if (state.status === 'error') {
    return (
      <Splash title="工作区加载失败">
        <p className="splash-sub">{state.error}</p>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => void load()}>
            重试
          </button>
          <button type="button" className="btn" onClick={logout}>
            退出登录
          </button>
        </div>
      </Splash>
    );
  }
  return (
    <StudentOSProvider initial={state.snapshot} persistence={state.persistence}>
      <App />
    </StudentOSProvider>
  );
}
