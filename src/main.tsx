import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './ui/App';

if (import.meta.env.VITE_E2E) {
  void Promise.all([import('./engine'), import('./store/gameStore')]).then(([engine, store]) => {
    Object.assign(window, { __wahala: { engine, store: store.useGame } });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
