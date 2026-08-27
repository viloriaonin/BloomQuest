import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App';
import { PopupProvider } from './components/PopupProvider';
import reportWebVitals from './reportWebVitals';

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const requestUrl = typeof input === 'string' ? input : input.url;
  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
  const token = localStorage.getItem('token');
  if (token && !requestUrl.includes('/api/login')) headers.set('Authorization', `Bearer ${token}`);
  return nativeFetch(input, { ...init, headers }).then((response) => {
    if (response.status === 401 && !requestUrl.includes('/api/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.assign('/');
    }
    return response;
  });
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PopupProvider>
      <App />
    </PopupProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
