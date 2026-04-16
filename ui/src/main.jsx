import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './index.css'
import App from './App.jsx'

// Note: StrictMode removed — keycloak-js init() cannot be called twice,
// and StrictMode double-invokes useEffect in development.

createRoot(document.getElementById('root')).render(<App />)
