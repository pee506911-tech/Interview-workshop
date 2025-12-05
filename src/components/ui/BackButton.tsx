interface BackButtonProps {
    label: string
    onClick: () => void
}

/**
 * Back navigation button with arrow icon
 */
export function BackButton({ label, onClick }: BackButtonProps) {
    return (
        <div
            className="flex items-center gap-2 mb-6 text-sm font-medium text-gray-500 cursor-pointer hover:text-brand transition w-max"
            onClick={onClick}
        >
            <i className="fa-solid fa-arrow-left" /> {label}
        </div>
    )
}
