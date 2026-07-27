import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

axios.defaults.baseURL = window.location.origin;

axios.interceptors.request.use((config) => {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user && user.tenant_id) {
            config.headers['X-Tenant-ID'] = user.tenant_id;
        }
    } catch {
        // ignore error
    }
    return config;
}, (error) => Promise.reject(error));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
