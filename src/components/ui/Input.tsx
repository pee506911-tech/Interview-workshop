import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string
    sublabel?: string
}

/**
 * Styled input component with label and optional sublabel
 */
export function Input({ label, sublabel, ...props }: InputProps) {
    return (
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                {label}
            </label>
            {sublabel && (
                <p className="text-xs text-gray-400 mb-1 ml-1">{sublabel}</p>
            )}
            <input
                {...props}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand transition text-sm font-medium"
            />
        </div>
    )
}
