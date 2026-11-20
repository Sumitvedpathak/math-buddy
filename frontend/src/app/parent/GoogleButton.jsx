import { useEffect, useRef, useState } from 'react'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisLoading = null

/** Load Google Identity Services once per page. */
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        gisLoading = null
        reject(new Error('Could not load Google sign-in'))
      }
      document.head.appendChild(script)
    })
  }
  return gisLoading
}

/**
 * Google's own "Continue with Google" button. Calls onCredential(idToken) when the
 * parent has picked an account. Client ID comes from VITE_GOOGLE_CLIENT_ID.
 */
export default function GoogleButton({ onCredential }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const container = useRef(null)
  const callback = useRef(onCredential)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    callback.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callback.current(response.credential),
        })
        window.google.accounts.id.renderButton(container.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Google sign-in is not set up. Add VITE_GOOGLE_CLIENT_ID to frontend/.env.local.
      </p>
    )
  }
  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load Google sign-in. Check your connection and reload the page.
      </p>
    )
  }
  return <div ref={container} className="min-h-[44px]" />
}
