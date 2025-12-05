import { useEffect } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom">
      <i className={`fa-solid ${type === 'error' ? 'fa-circle-exclamation text-red-400' : 'fa-circle-check text-green-400'}`}></i>
      <span className="font-medium text-sm">{message}</span>
    </div>
  )
}
