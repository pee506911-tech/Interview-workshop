// ============================================================================
// API ROUTES - No Magic Strings
// ============================================================================

export const API_ROUTES = {
    BASE: '/api',
    SUBJECTS: '/subjects',
    SLOTS: (subjectId: string) => `/slots/${subjectId}`,
    BOOKINGS: '/bookings',
    LOGIN: '/login',
} as const

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
    AUTH_TOKEN: 'sb_token',
} as const

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

export const TIMING = {
    TOAST_DURATION_MS: 3000,
    ANIMATION_DURATION_MS: 300,
    SLOT_REFRESH_BEFORE_BOOKING_MS: 500,
} as const

// ============================================================================
// BOOKING STEPS (Now 3 steps: Faculty -> Time -> Details)
// ============================================================================

export const BOOKING_STEPS = {
    FACULTY: 1,
    TIME: 2,
    DETAILS: 3,
} as const

export const STEP_LABELS = ['Faculty', 'Time', 'Details'] as const

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
    SLOT_UNAVAILABLE: 'This slot is no longer available. Please select another.',
    SLOT_FULL: 'Sorry, this slot just got fully booked!',
    BOOKING_FAILED: 'Booking failed. Please try again.',
    LOAD_FAILED: 'Failed to load data. Please refresh.',
    FORM_INCOMPLETE: 'Please complete all required fields.',
} as const
