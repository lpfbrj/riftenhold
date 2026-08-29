import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/**
 * Rede de segurança para gravações que falharam.
 *
 * Toda escrita passa por `store.salvar`, que já põe a mensagem no quadro de
 * erro da tela antes de repassar a exceção — quem chamou usa isso para não
 * fechar o formulário. O que sobra é a promessa rejeitada; sem este ouvinte
 * ela vira um "Uncaught (in promise)" no console, que assusta sem informar.
 */
window.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  console.warn('[Riften] operação não concluída:', e.reason?.message || e.reason);
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
