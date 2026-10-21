import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StudentOSProvider } from './state/store';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudentOSProvider>
      <App />
    </StudentOSProvider>
  </StrictMode>,
);
