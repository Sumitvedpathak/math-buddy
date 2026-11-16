import React from 'react'
import ReactDOM from 'react-dom/client'
import { SessionProvider } from './context/SessionContext'
import App from './app/App'
import AdminApp, { adminTokenFromPath } from './app/admin/AdminApp'
import './index.css'

const rootEl = document.getElementById('root')

// /admin/<token> is a separate route tree: no session, no links to it from the child app.
const adminToken = adminTokenFromPath(window.location.pathname)

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    {adminToken ? (
      <AdminApp token={adminToken} />
    ) : (
      <SessionProvider>
        <App />
      </SessionProvider>
    )}
  </React.StrictMode>
)
