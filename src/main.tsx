import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const syncAppViewportHeight = () => {
  if (CSS.supports('height', '100svh')) {
    document.documentElement.style.removeProperty('--app-viewport-height');
    return;
  }

  const viewportHeight = window.innerHeight;

  document.documentElement.style.setProperty(
    '--app-viewport-height',
    `${viewportHeight}px`,
  );
};

syncAppViewportHeight();

if (!CSS.supports('height', '100svh')) {
  window.addEventListener('resize', syncAppViewportHeight);
  window.addEventListener('orientationchange', syncAppViewportHeight);
}

registerSW({
  immediate: true,
});

createRoot(document.getElementById('root')!).render(<App />);
