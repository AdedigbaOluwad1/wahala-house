import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import * as engine from './engine';
import { useGame } from './store/gameStore';
import { App } from './ui/App';

if (import.meta.env.VITE_E2E) Object.assign(window, { __wahala: { engine, store: useGame } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
