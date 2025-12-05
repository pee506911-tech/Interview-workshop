const API = '/api'

export const getToken = () => localStorage.getItem('sb_token')
export const setToken = (token: string) => localStorage.setItem('sb_token', token)
export const clearToken = () => localStorage.removeItem('sb_token')

async function handleResponse<T = any>(r: Response): Promise<T> {
  if (r.status === 401) {
    clearToken()
    window.location.reload()
  }
  if (!r.ok) {
    const data = await r.json() as { error?: string }
    throw new Error(data.error || 'Request failed')
  }
  return r.json() as Promise<T>
}

export const api = {
  get: async <T = any>(url: string): Promise<T> => {
    const r = await fetch(API + url, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
    return handleResponse<T>(r)
  },

  post: async <T = any>(url: string, body: any): Promise<T> => {
    const r = await fetch(API + url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify(body)
    })
    return handleResponse<T>(r)
  },

  put: async <T = any>(url: string, body: any): Promise<T> => {
    const r = await fetch(API + url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify(body)
    })
    return handleResponse<T>(r)
  },

  del: async <T = any>(url: string): Promise<T> => {
    const r = await fetch(API + url, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
    return handleResponse<T>(r)
  }
}

export async function login(username: string, password: string): Promise<{ token: string; name: string; role: string }> {
  const r = await fetch(API + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!r.ok) throw new Error('Invalid credentials')
  return r.json() as Promise<{ token: string; name: string; role: string }>
}
