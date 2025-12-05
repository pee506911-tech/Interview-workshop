import { ReactNode } from 'react'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}

export default function Modal({ title, children, onClose, footer }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-6 border-t bg-gray-50 flex gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
