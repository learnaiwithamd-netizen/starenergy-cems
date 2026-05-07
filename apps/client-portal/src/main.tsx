import { StrictMode, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { configureAuthBridge } from './lib/api-client'
import { useAuthStore } from './features/auth/auth-store'
import { refreshApi, AuthApiError } from './features/auth/auth-api'
import {
  clearRefreshToken,
  getRefreshToken,
  setRefreshToken,
} from './features/auth/refresh-token-store'
import App from './App'
import './index.css'

// Wire the api-client interceptor to this SPA's auth store + refresh logic.
// Must run BEFORE any apiFetch call (i.e., before React mounts).
configureAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refresh: async () => {
    const refresh = getRefreshToken()
    if (!refresh) throw new AuthApiError(401, {
      type: 'https://cems.starenergy.ca/errors/authentication-required',
      title: 'Unauthorized',
      status: 401,
      detail: 'No refresh token',
    })
    const tokens = await refreshApi(refresh)
    // Persist the rotated refresh token + write the access token to the store.
    setRefreshToken(tokens.refreshToken)
    useAuthStore.getState().setAccessToken(tokens.accessToken)
    return tokens
  },
  onAuthFailure: () => {
    clearRefreshToken()
    useAuthStore.getState().clearSession()
  },
})

// Reset zustand devtools-style listeners when the auth store clears so any
// in-flight TanStack Query requests don't keep retrying with stale tokens.
function CrossTabListener(): null {
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'cems.refreshToken' && e.newValue === null) {
        useAuthStore.getState().clearSession()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return null
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to bootstrap client-portal: #root element missing from index.html')
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CrossTabListener />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
