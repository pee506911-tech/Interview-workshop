import { apiClient } from './api.client'
import { API_ROUTES } from '../constants'
import type { Subject, Slot, CreateBookingRequest } from '../types'

// ============================================================================
// BOOKING SERVICE - Application Layer
// ============================================================================

export const BookingService = {
    /**
     * Fetch all available subjects/faculties
     */
    async getSubjects(): Promise<Subject[]> {
        return apiClient.get<Subject[]>(API_ROUTES.SUBJECTS)
    },

    /**
     * Fetch available slots for a specific subject
     */
    async getSlots(subjectId: string): Promise<Slot[]> {
        return apiClient.get<Slot[]>(API_ROUTES.SLOTS(subjectId))
    },

    /**
     * Create a new booking
     */
    async createBooking(request: CreateBookingRequest): Promise<void> {
        return apiClient.post(API_ROUTES.BOOKINGS, request)
    },
}
