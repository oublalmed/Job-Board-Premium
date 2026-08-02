import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
// Side-effect import: configures i18next and starts syncing <html
// lang>/<html dir> to the active locale — must run before the app
// renders, not lazily on first useTranslation() call.
import '@/i18n';
import '@/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
