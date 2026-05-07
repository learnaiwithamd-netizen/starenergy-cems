import { useEffect, useState, type FormEvent, type JSX } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input } from '@cems/ui'
import type { PasswordSetValidateResponse } from '@cems/types'
import { apiFetch, ApiError } from '../../lib/api-client'

type Status = 'loading' | 'invalid' | 'ready' | 'submitting'

export function SetPasswordPage(): JSX.Element {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<Status>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setStatus('invalid')
      return
    }
    void (async () => {
      try {
        const res = await apiFetch<PasswordSetValidateResponse>(
          `/api/v1/auth/password-set/validate?token=${encodeURIComponent(token)}`,
        )
        if (cancelled) return
        setEmail(res.email)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (status !== 'ready' || password.length < 12) return
    setError(null)
    setStatus('submitting')
    try {
      await apiFetch<void>('/api/v1/auth/password-set', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      navigate('/login?welcome=true', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem.detail || err.problem.title || 'Could not set password')
      } else {
        setError('Network error — please try again')
      }
      setStatus('ready')
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Set your password</h1>
      {status === 'loading' && <p className="mt-4 text-sm">Verifying your link…</p>}

      {status === 'invalid' && (
        <p role="alert" className="mt-4 text-sm text-danger">
          This password-set link is invalid or has expired. Contact your administrator
          for a new one.
        </p>
      )}

      {(status === 'ready' || status === 'submitting') && (
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          {email && (
            <p className="text-sm text-muted-foreground">
              Setting password for <strong>{email}</strong>
            </p>
          )}
          <div>
            <label htmlFor="set-password" className="block text-sm font-medium">
              New password (min 12 characters)
            </label>
            <Input
              id="set-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? 'set-password-error' : undefined}
              className="mt-1 w-full"
            />
          </div>
          <div
            id="set-password-error"
            role="alert"
            aria-live="assertive"
            className="min-h-[1.5rem] text-sm text-danger"
          >
            {error}
          </div>
          <Button
            type="submit"
            disabled={status === 'submitting' || password.length < 12}
            className="w-full"
          >
            {status === 'submitting' ? 'Saving…' : 'Set password'}
          </Button>
        </form>
      )}
    </div>
  )
}
