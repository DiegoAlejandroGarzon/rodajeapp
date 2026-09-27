import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { registerServiceWorker } from './pwa';

const container = document.getElementById('root');

if (container) {
    createRoot(container).render(
        <StrictMode>
            <BrowserRouter basename="/app">
                <AuthProvider>
                    <App />
                </AuthProvider>
            </BrowserRouter>
        </StrictMode>,
    );
}

registerServiceWorker();
