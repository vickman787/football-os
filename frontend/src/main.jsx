import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { WalletProvider } from './lib/WalletContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <WalletProvider>
      <App />
    </WalletProvider>
  </BrowserRouter>
);
