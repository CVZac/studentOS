import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './state/auth';
import { AuthScreen } from './views/AuthScreen';
import { Splash, WorkspaceGate } from './views/WorkspaceGate';
import './styles/app.css';

/** 未登录显示登录页；登录后按账号挂载独立工作区，切换账号时整体重建 */
function Root() {
  const { account, loading } = useAuth();
  if (loading) return <Splash title="正在连接服务器…" />;
  if (!account) return <AuthScreen />;
  return <WorkspaceGate key={account.id} accountId={account.id} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
