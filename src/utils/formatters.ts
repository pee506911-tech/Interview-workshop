import type { Slot } from '../types'

/**
 * Format a slot's time range for display (AM/PM format)
 */
export function formatTimeRange(slot: Slot): string {
    const start = new Date(slot.startTime)
    const end = new Date(start.getTime() + slot.duration * 60000)

    const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }

    return `${start.toLocaleTimeString('en-US', options)} - ${end.toLocaleTimeString('en-US', options)}`
}

/**
 * Format a date string into weekday and day parts
 */
export function formatDateParts(dateStr: string): { weekday: string; day: number } {
    const d = new Date(dateStr)
    return {
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        day: d.getDate(),
    }
}

/**
 * Format a date for full display
 */
export function formatFullDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    })
}
