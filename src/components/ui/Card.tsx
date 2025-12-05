import { ReactNode } from 'react'

interface CardProps {
    children: ReactNode
    onClick?: () => void
    className?: string
}

/**
 * Clickable card component with hover effects
 */
export function Card({ children, onClick, className = '' }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-brand hover:shadow-md cursor-pointer transition flex justify-between items-center group ${className}`}
        >
            {children}
        </div>
    )
}

interface CardIconProps {
    icon: string
}

/**
 * Icon badge for cards
 */
export function CardIcon({ icon }: CardIconProps) {
    return (
        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-brand group-hover:text-white transition">
            <i className={`${icon} text-xs`} />
        </div>
    )
}
