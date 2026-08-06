import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CoreFullApp from './CoreFullApp';
import './creative-libraries.css';
import './stage-controls.css';
import './editor-shell.css';
import './editor-toolbar-dock.css';
import './wall-card-refinement.css';
import './wall-card-responsive.css';
import './wall-profile-drawer.css';
import './wall-profile-legacy.css';
import './wall-v1-dossier.css';
import './wall-footer-and-editor-header.css';
import './editor-density-and-sidebar.css';
import './wall-v1-dossier-runtime';
import './editor-shell';
import './editor-toolbar-dock';
import './sidebar-collapse';
import './mind-map-route-runtime';
import './mind-map-line-rules-position';
import './mind-map-relationship-polish.css';
import './questionnaire-gate-runtime';
import './rank-story-runtime';
import './instant-path-preview';
import './card-theme-manager-runtime';
import './library-metadata-runtime';
import './core-theme-system.css';

const root = document.getElementById('root');
if (!root) throw new Error('V2 application root was not found.');

createRoot(root).render(
  <StrictMode>
    <CoreFullApp />
  </StrictMode>,
);
