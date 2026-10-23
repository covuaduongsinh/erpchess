import { ErpProvider } from '@erpchess/api/react';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { MissingConfig } from './components/MissingConfig';
import { i18n } from './lib/i18n';
import { supabase } from './lib/supabase';
import { routeTree } from './routeTree.gen';
import './styles.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Không tìm thấy #root');

createRoot(root).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      {supabase ? (
        <ErpProvider client={supabase}>
          <RouterProvider router={router} />
        </ErpProvider>
      ) : (
        <MissingConfig />
      )}
    </I18nextProvider>
  </StrictMode>,
);
