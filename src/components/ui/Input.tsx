import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string
}

/**
 * Styled input component with label
 */
export function Input({ label, ...props }: InputProps) {
    return (
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                {label}
            </label>
            <input
                {...props}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand transition text-sm font-medium"
            />
        </div>
    )
}
