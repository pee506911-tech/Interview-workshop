import { STEP_LABELS } from '../../constants'
import type { BookingStep } from '../../types'

interface ProgressBarProps {
    currentStep: BookingStep
}

/**
 * Progress bar showing the current step in the booking flow
 * Now shows 3 steps: Faculty -> Time -> Details
 */
export function ProgressBar({ currentStep }: ProgressBarProps) {
    const progressPercentage = Math.round((currentStep / STEP_LABELS.length) * 100)

    return (
        <div className="mb-8 select-none">
            <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400 mb-2">
                {STEP_LABELS.map((label, index) => (
                    <span
                        key={label}
                        className={`transition-colors ${currentStep === index + 1 ? 'text-brand' : ''}`}
                    >
                        {label}
                    </span>
                ))}
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-brand transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
        </div>
    )
}
