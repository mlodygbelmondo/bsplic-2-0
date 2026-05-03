import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
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

registerSW({
  immediate: true,
});

createRoot(document.getElementById('root')!).render(<App />);
