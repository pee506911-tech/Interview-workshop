// ============================================================================
// DOMAIN CONTRACTS - The Single Source of Truth
// ============================================================================

/**
 * Faculty/Subject entity from the backend
 */
export interface Subject {
    id: string
    name: string
    description?: string
    color?: string
    customFields?: string[]
}

/**
 * Time slot entity for booking
 */
export interface Slot {
    id: string
    subjectId: string
    startTime: string
    duration: number
    maxCapacity: number
    currentBookings: number
}

/**
 * Booking request payload - matches backend contract
 */
export interface CreateBookingRequest {
    slotId: string
    subjectId: string
    studentName: string
    studentId: string
    studentEmail: string
    customAnswers: Record<string, string>
}

/**
 * Standard API error response
 */
export interface ApiError {
    code: string
    message: string
    details?: Record<string, unknown>
}

// ============================================================================
// BOOKING FLOW STATE (3 steps: Faculty -> Time -> Details)
// ============================================================================

export type BookingStep = 1 | 2 | 3

export interface BookingSelection {
    subject: Subject | null
    date: string | null
    slot: Slot | null
}

export interface BookingFormData {
    name: string
    studentId: string
    email: string
    customAnswers: Record<string, string>
}

// ============================================================================
// UI STATE
// ============================================================================

export type ToastType = 'success' | 'error' | 'loading'

export interface ToastState {
    message: string
    type: ToastType
}

// ============================================================================
// SLOT AVAILABILITY (for race condition handling)
// ============================================================================

export interface SlotAvailability {
    isAvailable: boolean
    spotsLeft: number
}
