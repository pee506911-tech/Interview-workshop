import type { ToastState } from '../../types'

interface ToastProps {
    toast: ToastState | null
}

/**
 * Toast notification component
 * Displays loading, success, and error messages
 */
export function Toast({ toast }: ToastProps) {
    return (
        <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl transition-opacity duration-300 pointer-events-none z-50 font-medium text-sm flex items-center gap-3 ${toast ? 'opacity-100' : 'opacity-0'}`}
        >
            {toast?.type === 'loading' && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {toast?.type === 'error' && (
                <i className="fa-solid fa-circle-exclamation text-red-400" />
            )}
            {toast?.type === 'success' && (
                <i className="fa-solid fa-check text-green-400" />
            )}
            <span>{toast?.message}</span>
        </div>
    )
}
