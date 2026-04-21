const API_BASE_URL = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3001'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const problem = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(problem.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}
