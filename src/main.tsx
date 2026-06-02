import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const syncAppViewportHeight = () => {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  document.documentElement.style.setProperty(
    '--app-viewport-height',
    `${viewportHeight}px`,
  );
};

syncAppViewportHeight();

window.addEventListener('resize', syncAppViewportHeight);
window.addEventListener('orientationchange', syncAppViewportHeight);
window.visualViewport?.addEventListener('resize', syncAppViewportHeight);
window.visualViewport?.addEventListener('scroll', syncAppViewportHeight);

createRoot(document.getElementById('root')!).render(<App />);

const registerServiceWorker = () => {
  const register = () => {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        immediate: false,
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
