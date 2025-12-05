import type { Subject, Slot } from '../../types'
import { BackButton, Button } from '../ui'
import { formatTimeRange, formatDateParts } from '../../utils/formatters'

interface TimeStepProps {
    subject: Subject
    dates: string[]
    slotsByDate: Record<string, Slot[]>
    selectedDate: string | null
    selectedSlot: Slot | null
    isValidating: boolean
    onDateSelect: (date: string) => void
    onSlotSelect: (slot: Slot) => void
    onRefresh: () => void
    onContinue: () => void
    onBack: () => void
}

/**
 * Step 2: Date and time slot selection
 * Removed teacher/instructor display
 */
export function TimeStep({
    subject,
    dates,
    slotsByDate,
    selectedDate,
    selectedSlot,
    isValidating,
    onDateSelect,
    onSlotSelect,
    onRefresh,
    onContinue,
    onBack,
}: TimeStepProps) {
    return (
        <section className="fade-in">
            <BackButton label="Back to Subjects" onClick={onBack} />

            {/* Faculty Header */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
                <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Selected Faculty
                    </div>
                    <h2 className="text-lg font-bold leading-tight text-gray-900">
                        {subject.name}
                    </h2>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-50 text-brand flex items-center justify-center text-lg">
                    <i className="fa-solid fa-graduation-cap" />
                </div>
            </div>

            {/* Date Selection */}
            <h3 className="font-bold text-lg mb-3 text-gray-900">Pick a Date</h3>

            <div className="relative -mx-6 px-6 mb-6">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {dates.map(date => {
                        const { weekday, day } = formatDateParts(date)
                        const isSelected = selectedDate === date
                        return (
                            <label key={date} className="cursor-pointer shrink-0">
                                <input
                                    type="radio"
                                    name="date"
                                    className="date-radio hidden"
                                    checked={isSelected}
                                    onChange={() => onDateSelect(date)}
                                />
                                <div className={`px-5 py-4 rounded-xl border transition min-w-[80px] text-center ${isSelected
                                        ? 'bg-[#111] text-white border-[#111] shadow-lg transform -translate-y-[1px]'
                                        : 'bg-white border-gray-200 hover:border-gray-400'
                                    }`}>
                                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-50">
                                        {weekday}
                                    </div>
                                    <div className="font-bold text-xl leading-none mt-1">{day}</div>
                                </div>
                            </label>
                        )
                    })}
                </div>
                <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#f8fafc] to-transparent pointer-events-none" />
            </div>

            {/* Time Slots */}
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg text-gray-900">Available Times</h3>
                <button
                    onClick={onRefresh}
                    className="text-xs bg-white border px-3 py-1.5 rounded-full font-bold hover:bg-gray-50 flex items-center gap-2 transition"
                >
                    <i className="fa-solid fa-rotate-right" /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {selectedDate && slotsByDate[selectedDate]?.map(slot => {
                    const spotsLeft = slot.maxCapacity - slot.currentBookings
                    const isFull = spotsLeft <= 0
                    const isActive = selectedSlot?.id === slot.id

                    return (
                        <button
                            key={slot.id}
                            disabled={isFull}
                            onClick={() => onSlotSelect(slot)}
                            className={`slot-btn p-3 rounded-xl border text-center transition relative overflow-hidden flex flex-col items-center justify-center gap-1 ${isActive ? 'active' : ''
                                } ${isFull
                                    ? 'disabled'
                                    : 'bg-white border-gray-200 hover:border-brand text-gray-800'
                                }`}
                        >
                            <div className="font-bold text-xs whitespace-nowrap">
                                {formatTimeRange(slot)}
                            </div>
                            <div className={`text-[10px] font-bold uppercase ${isFull ? 'text-gray-400' : 'text-brand opacity-80'
                                }`}>
                                {isFull ? 'Full' : `${spotsLeft} Spot${spotsLeft > 1 ? 's' : ''} Left`}
                            </div>
                        </button>
                    )
                })}

                {!selectedDate && dates.length > 0 && (
                    <div className="col-span-3 text-center py-8 text-gray-400 text-sm">
                        Select a date above
                    </div>
                )}

                {dates.length === 0 && (
                    <div className="col-span-3 flex flex-col items-center py-10 text-gray-400 bg-white rounded-xl border border-dashed">
                        <i className="fa-regular fa-calendar-xmark text-2xl mb-2" />
                        <span className="text-sm">No slots available</span>
                    </div>
                )}
            </div>

            {selectedSlot && (
                <div className="mt-6 fade-in">
                    <Button onClick={onContinue} isLoading={isValidating}>
                        {isValidating ? 'Checking availability...' : 'Continue'}
                    </Button>
                </div>
            )}
        </section>
    )
}
