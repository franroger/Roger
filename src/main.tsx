import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './lib/store';
import './styles.css';

// Na versão publicada como página (VITE_MODO=pagina) a navegação fica em memória.
const Roteador = import.meta.env.VITE_MODO === 'pagina' ? MemoryRouter : HashRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <Roteador>
        <App />
      </Roteador>
    </StoreProvider>
  </React.StrictMode>,
);
