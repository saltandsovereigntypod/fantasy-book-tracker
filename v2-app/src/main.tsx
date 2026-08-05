import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FullApp from './FullApp';
import './creative-libraries.css';
import './stage-controls.css';
import './editor-shell.css';
import './editor-toolbar-dock.css';
import './wall-card-refinement.css';
import './wall-card-responsive.css';
import './wall-profile-drawer.css';
import './wall-profile-compact.css';
import './editor-shell';
import './editor-toolbar-dock';

const root = document.getElementById('root');
if (!root) throw new Error('V2 application root was not found.');

createRoot(root).render(
  <StrictMode>
    <FullApp />
  </StrictMode>,
);
