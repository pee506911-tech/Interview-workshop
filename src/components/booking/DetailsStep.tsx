import type { Subject, Slot, BookingFormData } from '../../types'
import { BackButton, Input, Button } from '../ui'
import { formatTimeRange } from '../../utils/formatters'

interface DetailsStepProps {
    subject: Subject
    slot: Slot
    form: BookingFormData
    isLoading: boolean
    onFormChange: (updates: Partial<BookingFormData>) => void
    onSubmit: () => void
    onBack: () => void
}

/**
 * Step 3: Booking details and confirmation
 * Removed teacher display from summary
 */
export function DetailsStep({
    subject,
    slot,
    form,
    isLoading,
    onFormChange,
    onSubmit,
    onBack,
}: DetailsStepProps) {
    const formattedDate = new Date(slot.startTime).toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    })

    return (
        <section className="fade-in">
            <BackButton label="Back to Times" onClick={onBack} />

            <h2 className="text-2xl font-bold mb-4 text-gray-900">Confirm Booking</h2>
            <p className="text-gray-500 text-sm mb-6">
                Please review the details below before confirming.
            </p>

            {/* Booking Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm">
                        <i className="fa-solid fa-check" />
                    </div>
                    <span className="font-bold text-gray-900">Booking Summary</span>
                </div>
                <div className="p-6 space-y-4">
                    <SummaryRow label="Faculty" value={subject.name} />
                    <SummaryRow label="Date" value={formattedDate} />
                    <SummaryRow
                        label="Time"
                        value={formatTimeRange(slot)}
                        highlight
                        isLast
                    />
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 mb-8">
                <Input
                    label="Full Name"
                    value={form.name}
                    onChange={e => onFormChange({ name: e.target.value })}
                    placeholder="Enter your full name"
                />

                <Input
                    label="Wcode"
                    sublabel="If you are not a student at Warwick Institute, leave it empty"
                    value={form.studentId}
                    onChange={e => onFormChange({ studentId: e.target.value })}
                    placeholder="e.g. W12345"
                />
                <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={e => onFormChange({ email: e.target.value })}
                    placeholder="your@email.com"
                />

                {subject.customFields?.map(field => (
                    <Input
                        key={field}
                        label={field}
                        value={form.customAnswers[field] || ''}
                        onChange={e => onFormChange({
                            customAnswers: { ...form.customAnswers, [field]: e.target.value }
                        })}
                    />
                ))}
            </div>

            <Button onClick={onSubmit} isLoading={isLoading}>
                {isLoading ? 'Processing...' : 'Confirm Reservation'}
            </Button>
        </section>
    )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SummaryRowProps {
    label: string
    value: string
    highlight?: boolean
    isLast?: boolean
}

function SummaryRow({ label, value, highlight, isLast }: SummaryRowProps) {
    return (
        <div className={`flex justify-between items-center ${!isLast ? 'border-b border-dashed pb-3' : ''}`}>
            <span className="text-sm text-gray-500">{label}</span>
            <span className={`font-bold ${highlight ? 'text-brand text-lg' : 'text-gray-900'}`}>
                {value}
            </span>
        </div>
    )
}
