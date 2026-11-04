import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider, useAuth } from './state/auth';
import { StudentOSProvider } from './state/store';
import { AuthScreen } from './views/AuthScreen';
import './styles/app.css';

/** 未登录显示登录页；登录后按账号挂载独立工作区，切换账号时整体重建 */
function Root() {
  const { account } = useAuth();
  if (!account) return <AuthScreen />;
  return (
    <StudentOSProvider key={account.id} accountId={account.id}>
      <App />
    </StudentOSProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
