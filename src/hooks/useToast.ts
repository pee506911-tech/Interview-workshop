import { useState, useCallback } from 'react'
import type { ToastState, ToastType } from '../types'
import { TIMING } from '../constants'

interface UseToastReturn {
    toast: ToastState | null
    showToast: (message: string, type: ToastType) => void
    hideToast: () => void
}

/**
 * Custom hook for managing toast notifications
 */
export function useToast(): UseToastReturn {
    const [toast, setToast] = useState<ToastState | null>(null)

    const hideToast = useCallback(() => {
        setToast(null)
    }, [])

    const showToast = useCallback((message: string, type: ToastType) => {
        setToast({ message, type })

        // Auto-hide non-loading toasts
        if (type !== 'loading') {
            setTimeout(hideToast, TIMING.TOAST_DURATION_MS)
        }
    }, [hideToast])

    return { toast, showToast, hideToast }
}
