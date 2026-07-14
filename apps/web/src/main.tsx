import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { I18nProvider } from './i18n/I18nProvider.js';
import { ParentReport } from './ParentReport.js';
import { ThemeProvider } from './theme/ThemeProvider.js';

const root = document.getElementById('root');
const RootView = globalThis.location.pathname.startsWith('/parent')
  ? ParentReport
  : App;

if (!root) {
  throw new Error('Root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <RootView />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
);
