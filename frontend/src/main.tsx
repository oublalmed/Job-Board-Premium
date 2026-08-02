import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
// Side-effect import: configures i18next and starts syncing <html
// lang>/<html dir> to the active locale — must run before the app
// renders, not lazily on first useTranslation() call.
import '@/i18n';
// Side-effect import: attaches the auth request/response middleware to
// apiClient — must run before any component can issue a request that
// expects a token to be attached or a 401 to trigger a refresh.
import '@/auth/api-middleware';
import '@/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
