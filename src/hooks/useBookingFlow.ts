import { useState, useCallback, useMemo } from 'react'
import type {
    Subject,
    Slot,
    BookingStep,
    BookingSelection,
    BookingFormData
} from '../types'
import { BookingService } from '../services'
import { useToast } from './useToast'
import { BOOKING_STEPS, ERROR_MESSAGES } from '../constants'

interface UseBookingFlowReturn {
    // Data State
    subjects: Subject[]
    slots: Slot[]

    // Selection State
    step: BookingStep
    selection: BookingSelection

    // Form State
    form: BookingFormData

    // UI State
    isLoading: boolean
    isValidating: boolean
    showSuccess: boolean
    searchQuery: string
    toast: ReturnType<typeof useToast>['toast']

    // Derived Data
    uniqueFaculties: string[]
    filteredFaculties: string[]
    subjectsForFaculty: Subject[]
    slotsByDate: Record<string, Slot[]>
    sortedDates: string[]

    // Actions
    initialize: () => Promise<void>
    selectFaculty: (faculty: string) => Promise<void>
    selectDate: (date: string) => void
    selectSlot: (slot: Slot) => void
    updateForm: (updates: Partial<BookingFormData>) => void
    setSearchQuery: (query: string) => void
    goToStep: (step: BookingStep) => void
    validateAndContinue: () => Promise<void>
    submitBooking: () => Promise<void>
    reset: () => void
    refreshSlots: () => Promise<void>
}

const INITIAL_SELECTION: BookingSelection = {
    subject: null,
    date: null,
    slot: null,
}

const INITIAL_FORM: BookingFormData = {
    name: '',
    studentId: '',
    email: '',
    customAnswers: {},
}

/**
 * Custom hook encapsulating all booking flow logic
 * Now with 3 steps: Faculty -> Time -> Details
 * Includes race condition protection via slot validation
 */
export function useBookingFlow(): UseBookingFlowReturn {
    // Data State
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [slots, setSlots] = useState<Slot[]>([])

    // Selection State
    const [step, setStep] = useState<BookingStep>(BOOKING_STEPS.FACULTY as BookingStep)
    const [selection, setSelection] = useState<BookingSelection>(INITIAL_SELECTION)
    const [selectedFacultyName, setSelectedFacultyName] = useState<string | null>(null)

    // Form State
    const [form, setForm] = useState<BookingFormData>(INITIAL_FORM)

    // UI State
    const [isLoading, setIsLoading] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const { toast, showToast, hideToast } = useToast()

    // ============================================================================
    // DERIVED DATA
    // ============================================================================

    const uniqueFaculties = useMemo(() => {
        const names = new Set(subjects.map(s => s.name))
        return Array.from(names).sort()
    }, [subjects])

    const filteredFaculties = useMemo(() =>
        uniqueFaculties.filter(f =>
            f.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [uniqueFaculties, searchQuery]
    )

    // Get all subjects for the selected faculty
    const subjectsForFaculty = useMemo(() => {
        if (!selectedFacultyName) return []
        return subjects.filter(s => s.name === selectedFacultyName)
    }, [subjects, selectedFacultyName])

    const slotsByDate = useMemo(() => {
        const groups: Record<string, Slot[]> = {}
        slots.forEach(s => {
            const date = s.startTime.split('T')[0]
            if (!groups[date]) groups[date] = []
            groups[date].push(s)
        })
        return groups
    }, [slots])

    const sortedDates = useMemo(() =>
        Object.keys(slotsByDate).sort(),
        [slotsByDate]
    )

    // ============================================================================
    // SLOT VALIDATION (Race Condition Protection)
    // ============================================================================

    /**
     * Check if a slot is still available by refreshing from server
     * Returns the fresh slot data if available, null if not
     */
    const validateSlotAvailability = useCallback(async (
        subjectId: string,
        slotId: string
    ): Promise<Slot | null> => {
        try {
            const freshSlots = await BookingService.getSlots(subjectId)
            const freshSlot = freshSlots.find(s => s.id === slotId)

            if (!freshSlot) {
                return null // Slot no longer exists
            }

            const spotsLeft = freshSlot.maxCapacity - freshSlot.currentBookings
            if (spotsLeft <= 0) {
                return null // Slot is full
            }

            return freshSlot
        } catch {
            return null
        }
    }, [])

    // ============================================================================
    // ACTIONS
    // ============================================================================

    const initialize = useCallback(async () => {
        try {
            const data = await BookingService.getSubjects()
            setSubjects(data)
        } catch {
            showToast(ERROR_MESSAGES.LOAD_FAILED, 'error')
        }
    }, [showToast])

    /**
     * Select a faculty and load all slots for subjects under that faculty
     */
    const selectFaculty = useCallback(async (faculty: string) => {
        setSelectedFacultyName(faculty)

        // Find the first subject for this faculty to load slots
        const facultySubjects = subjects.filter(s => s.name === faculty)
        if (facultySubjects.length === 0) return

        // Use the first subject (in case there are multiple instructors, 
        // they should all have the same slots structure)
        const subject = facultySubjects[0]
        setSelection(prev => ({ ...prev, subject, date: null, slot: null }))

        showToast('Loading schedule...', 'loading')
        try {
            const data = await BookingService.getSlots(subject.id)
            setSlots(data)
            setStep(BOOKING_STEPS.TIME as BookingStep)
            hideToast()
        } catch {
            showToast(ERROR_MESSAGES.LOAD_FAILED, 'error')
        }
    }, [subjects, showToast, hideToast])

    const selectDate = useCallback((date: string) => {
        setSelection(prev => ({ ...prev, date, slot: null }))
    }, [])

    const selectSlot = useCallback((slot: Slot) => {
        if (slot.currentBookings >= slot.maxCapacity) return
        setSelection(prev => ({ ...prev, slot }))
    }, [])

    /**
     * Validate slot availability before moving to details step
     * This is the first layer of race condition protection
     */
    const validateAndContinue = useCallback(async () => {
        if (!selection.slot || !selection.subject) {
            showToast('Please select a time slot', 'error')
            return
        }

        setIsValidating(true)
        showToast('Checking availability...', 'loading')

        try {
            const freshSlot = await validateSlotAvailability(
                selection.subject.id,
                selection.slot.id
            )

            if (!freshSlot) {
                showToast(ERROR_MESSAGES.SLOT_UNAVAILABLE, 'error')
                // Refresh the slots list
                const freshSlots = await BookingService.getSlots(selection.subject.id)
                setSlots(freshSlots)
                setSelection(prev => ({ ...prev, slot: null }))
                return
            }

            // Update with fresh slot data and proceed
            setSelection(prev => ({ ...prev, slot: freshSlot }))
            setStep(BOOKING_STEPS.DETAILS as BookingStep)
            hideToast()
        } catch {
            showToast(ERROR_MESSAGES.LOAD_FAILED, 'error')
        } finally {
            setIsValidating(false)
        }
    }, [selection, showToast, hideToast, validateSlotAvailability])

    const updateForm = useCallback((updates: Partial<BookingFormData>) => {
        setForm(prev => ({ ...prev, ...updates }))
    }, [])

    const goToStep = useCallback((newStep: BookingStep) => {
        setStep(newStep)
    }, [])

    const refreshSlots = useCallback(async () => {
        if (!selection.subject) return

        showToast('Refreshing...', 'loading')
        try {
            const data = await BookingService.getSlots(selection.subject.id)
            setSlots(data)
            // Clear selected slot if it's no longer available
            if (selection.slot) {
                const stillAvailable = data.find(s =>
                    s.id === selection.slot?.id &&
                    s.currentBookings < s.maxCapacity
                )
                if (!stillAvailable) {
                    setSelection(prev => ({ ...prev, slot: null }))
                }
            }
            hideToast()
        } catch {
            showToast(ERROR_MESSAGES.LOAD_FAILED, 'error')
        }
    }, [selection.subject, selection.slot, showToast, hideToast])

    /**
     * Submit booking with final validation
     * This is the second layer of race condition protection
     */
    const submitBooking = useCallback(async () => {
        // Form validation
        if (!form.name || !form.studentId || !form.email) {
            showToast(ERROR_MESSAGES.FORM_INCOMPLETE, 'error')
            return
        }

        if (!selection.slot || !selection.subject) {
            showToast('Please select a time slot', 'error')
            return
        }

        setIsLoading(true)

        try {
            // Final validation: Check slot availability right before booking
            const freshSlot = await validateSlotAvailability(
                selection.subject.id,
                selection.slot.id
            )

            if (!freshSlot) {
                showToast(ERROR_MESSAGES.SLOT_FULL, 'error')
                // Go back to time selection with refreshed data
                const freshSlots = await BookingService.getSlots(selection.subject.id)
                setSlots(freshSlots)
                setSelection(prev => ({ ...prev, slot: null }))
                setStep(BOOKING_STEPS.TIME as BookingStep)
                return
            }

            // Proceed with booking
            await BookingService.createBooking({
                slotId: selection.slot.id,
                subjectId: selection.subject.id,
                studentName: form.name,
                studentId: form.studentId,
                studentEmail: form.email,
                customAnswers: form.customAnswers,
            })

            setShowSuccess(true)
        } catch (e) {
            const message = e instanceof Error ? e.message : ERROR_MESSAGES.BOOKING_FAILED

            // If booking failed, it might be a race condition - refresh slots
            if (selection.subject) {
                try {
                    const freshSlots = await BookingService.getSlots(selection.subject.id)
                    setSlots(freshSlots)

                    // Check if our slot is still valid
                    const stillAvailable = freshSlots.find(s =>
                        s.id === selection.slot?.id &&
                        s.currentBookings < s.maxCapacity
                    )

                    if (!stillAvailable) {
                        showToast(ERROR_MESSAGES.SLOT_FULL, 'error')
                        setSelection(prev => ({ ...prev, slot: null }))
                        setStep(BOOKING_STEPS.TIME as BookingStep)
                        return
                    }
                } catch {
                    // Ignore refresh error, show original error
                }
            }

            showToast(message, 'error')
        } finally {
            setIsLoading(false)
        }
    }, [form, selection, showToast, validateSlotAvailability])

    const reset = useCallback(() => {
        setStep(BOOKING_STEPS.FACULTY as BookingStep)
        setSelection(INITIAL_SELECTION)
        setSelectedFacultyName(null)
        setForm(INITIAL_FORM)
        setSlots([])
        setShowSuccess(false)
        setSearchQuery('')
    }, [])

    return {
        // Data State
        subjects,
        slots,

        // Selection State
        step,
        selection,

        // Form State
        form,

        // UI State
        isLoading,
        isValidating,
        showSuccess,
        searchQuery,
        toast,

        // Derived Data
        uniqueFaculties,
        filteredFaculties,
        subjectsForFaculty,
        slotsByDate,
        sortedDates,

        // Actions
        initialize,
        selectFaculty,
        selectDate,
        selectSlot,
        updateForm,
        setSearchQuery,
        goToStep,
        validateAndContinue,
        submitBooking,
        reset,
        refreshSlots,
    }
}
