import { API_ROUTES, STORAGE_KEYS } from '../constants'

// ============================================================================
// AUTH UTILITIES
// ============================================================================

export const getToken = (): string | null =>
    localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)

export const setToken = (token: string): void =>
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token)

export const clearToken = (): void =>
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)

// ============================================================================
// HTTP CLIENT
// ============================================================================

class ApiClient {
    private baseUrl: string

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (response.status === 401) {
            clearToken()
            window.location.reload()
            throw new Error('Unauthorized')
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({})) as { error?: string }
            throw new Error(data.error || `Request failed with status ${response.status}`)
        }

        return response.json()
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        }

        const token = getToken()
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        return headers
    }

    async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(this.baseUrl + endpoint, {
            headers: this.getHeaders(),
        })
        return this.handleResponse<T>(response)
    }

    async post<T, B = unknown>(endpoint: string, body: B): Promise<T> {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        })
        return this.handleResponse<T>(response)
    }

    async put<T, B = unknown>(endpoint: string, body: B): Promise<T> {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        })
        return this.handleResponse<T>(response)
    }

    async delete<T>(endpoint: string): Promise<T> {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'DELETE',
            headers: this.getHeaders(),
        })
        return this.handleResponse<T>(response)
    }
}

// Singleton instance
export const apiClient = new ApiClient(API_ROUTES.BASE)
