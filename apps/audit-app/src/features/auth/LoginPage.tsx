import { useState, type FormEvent, type JSX } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input } from '@cems/ui'
import { SURFACE_BY_ROLE, type SurfaceCode } from '@cems/types'
import { useAuthStore } from './auth-store'
import { loginApi, logoutApi, meApi, AuthApiError } from './auth-api'
import {
  clearRefreshToken,
  setRefreshToken,
} from './refresh-token-store'
import { surfaceUrls } from '../../lib/surface-urls'

export interface LoginPageProps {
  /** Which SPA this is — controls the page title + post-login redirect.
   *  Cross-surface mismatch sends the user to surfaceUrls[correct]/login. */
  surface: SurfaceCode
  title: string
}

export function LoginPage({ surface, title }: LoginPageProps): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const submitDisabled = submitting || email.trim() === '' || password === ''

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (submitDisabled) return
    setError(null)
    setSubmitting(true)
    try {
      const tokens = await loginApi({ email, password })
      // Persist refresh token first, then fetch user profile.
      setRefreshToken(tokens.refreshToken)
      const profile = await meApi(tokens.accessToken)
      const correctSurface = SURFACE_BY_ROLE[profile.role]
      if (correctSurface !== surface) {
        // Wrong surface — discard tokens server-side + locally, then bounce.
        try {
          await logoutApi(tokens.refreshToken)
        } catch {
          // Best effort.
        }
        clearRefreshToken()
        window.location.assign(`${surfaceUrls[correctSurface]}/login`)
        return
      }
      setSession({ accessToken: tokens.accessToken, user: profile })
      navigate(next, { replace: true })
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.problem.detail || err.problem.title || 'Login failed')
      } else {
        setError('Network error — please try again')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium">
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? 'login-error' : undefined}
            className="mt-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium">
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={error ? 'login-error' : undefined}
            className="mt-1 w-full"
          />
        </div>
        <div id="login-error" role="alert" aria-live="assertive" className="min-h-[1.5rem] text-sm text-danger">
          {error}
        </div>
        <Button type="submit" disabled={submitDisabled} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}

