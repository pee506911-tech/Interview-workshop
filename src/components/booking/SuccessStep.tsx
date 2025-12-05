import { Button } from '../ui'

interface SuccessStepProps {
    onReset: () => void
}

/**
 * Success screen shown after successful booking
 */
export function SuccessStep({ onReset }: SuccessStepProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center fade-in">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 text-4xl shadow-lg">
                <i className="fa-solid fa-check" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-gray-900">Booking Confirmed!</h2>
            <p className="text-gray-500 mb-8 text-sm">We have received your reservation.</p>
            <Button variant="secondary" onClick={onReset}>
                Book Another
            </Button>
        </div>
    )
}
