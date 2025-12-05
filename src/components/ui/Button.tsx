import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary'
    isLoading?: boolean
    children: ReactNode
}

/**
 * Styled button component with variants
 */
export function Button({
    variant = 'primary',
    isLoading = false,
    children,
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = "w-full font-bold py-4 rounded-xl transition transform active:scale-[0.98] disabled:opacity-50"

    const variants = {
        primary: "bg-brand text-white shadow-lg shadow-red-200 hover:opacity-90",
        secondary: "bg-gray-900 text-white shadow hover:opacity-80",
    }

    return (
        <button
            {...props}
            disabled={disabled || isLoading}
            className={`${baseStyles} ${variants[variant]}`}
        >
            {isLoading ? 'Processing...' : children}
        </button>
    )
}
