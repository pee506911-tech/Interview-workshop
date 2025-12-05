import { useEffect } from 'react'
import { useBookingFlow } from './hooks'
import { BOOKING_STEPS } from './constants'

// UI Components
import { Toast, ProgressBar } from './components/ui'

// Feature Components
import {
  FacultyStep,
  TimeStep,
  DetailsStep,
  SuccessStep
} from './components/booking'

/**
 * Main Booking Application
 * 
 * Flow: Faculty -> Time -> Details -> Success
 * 
 * Race Condition Protection:
 * 1. Validates slot availability when clicking "Continue" from Time step
 * 2. Re-validates slot availability right before submitting booking
 * 3. Auto-refreshes slots if booking fails due to unavailability
 */
export default function App() {
  const booking = useBookingFlow()

  // Initialize on mount
  useEffect(() => {
    booking.initialize()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show success screen after booking
  if (booking.showSuccess) {
    return <SuccessStep onReset={booking.reset} />
  }

  return (
    <div className="text-slate-800 min-h-screen flex flex-col font-sans">
      <main className="flex-1 max-w-xl mx-auto w-full p-6 relative">

        <ProgressBar currentStep={booking.step} />

        {/* Step 1: Select Faculty */}
        {booking.step === BOOKING_STEPS.FACULTY && (
          <FacultyStep
            searchQuery={booking.searchQuery}
            onSearchChange={booking.setSearchQuery}
            faculties={booking.filteredFaculties}
            onSelect={booking.selectFaculty}
          />
        )}

        {/* Step 2: Select Time */}
        {booking.step === BOOKING_STEPS.TIME && booking.selection.subject && (
          <TimeStep
            subject={booking.selection.subject}
            dates={booking.sortedDates}
            slotsByDate={booking.slotsByDate}
            selectedDate={booking.selection.date}
            selectedSlot={booking.selection.slot}
            isValidating={booking.isValidating}
            onDateSelect={booking.selectDate}
            onSlotSelect={booking.selectSlot}
            onRefresh={booking.refreshSlots}
            onContinue={booking.validateAndContinue}
            onBack={() => booking.goToStep(BOOKING_STEPS.FACULTY as 1)}
          />
        )}

        {/* Step 3: Details & Confirmation */}
        {booking.step === BOOKING_STEPS.DETAILS &&
          booking.selection.subject &&
          booking.selection.slot && (
            <DetailsStep
              subject={booking.selection.subject}
              slot={booking.selection.slot}
              form={booking.form}
              isLoading={booking.isLoading}
              onFormChange={booking.updateForm}
              onSubmit={booking.submitBooking}
              onBack={() => booking.goToStep(BOOKING_STEPS.TIME as 2)}
            />
          )}

      </main>

      <Toast toast={booking.toast} />
    </div>
  )
}
