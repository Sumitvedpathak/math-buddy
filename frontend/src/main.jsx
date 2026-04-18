import React from 'react'
import ReactDOM from 'react-dom/client'
import { SessionProvider } from './context/SessionContext'
import App from './app/App'
import { theme, setTheme } from './themes/dandysWorld'
import './index.css'

// Apply default theme before first render
const rootEl = document.getElementById('root')
rootEl.id = 'root'
// The theme-root wrapper is inside App — we apply after mount via useEffect in App

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </React.StrictMode>
)

// Export for use in App after mount
export { theme, setTheme }
