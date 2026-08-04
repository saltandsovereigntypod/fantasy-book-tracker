import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './creative-libraries.css';
import './stage-controls.css';

const root = document.getElementById('root');
if (!root) throw new Error('V2 application root was not found.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
