import { createRoot } from 'react-dom/client';
import { showPwaUpdateToast } from '@/lib/pwa-update';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

const registerServiceWorker = () => {
  const register = () => {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: false,
        onNeedRefresh() {
          showPwaUpdateToast(updateSW);
        },
      });
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(register, { timeout: 3000 });
    return;
  }

  window.setTimeout(register, 1500);
};

registerServiceWorker();
