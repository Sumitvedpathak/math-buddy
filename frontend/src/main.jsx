import React from 'react'
import ReactDOM from 'react-dom/client'
import { SessionProvider } from './context/SessionContext'
import App from './app/App'
import AdminApp, { adminTokenFromPath } from './app/admin/AdminApp'
import ParentApp, { isParentPath } from './app/parent/ParentApp'
import './index.css'

const rootEl = document.getElementById('root')

// /admin/<token> is a separate route tree: no session, no links to it from the child app.
const adminToken = adminTokenFromPath(window.location.pathname)
// /parent: parent sign-in, also its own route tree until the start screen replaces the profile screen.
const parentPage = isParentPath(window.location.pathname)

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    {adminToken ? (
      <AdminApp token={adminToken} />
    ) : parentPage ? (
      <ParentApp />
    ) : (
      <SessionProvider>
        <App />
      </SessionProvider>
    )}
  </React.StrictMode>
)
