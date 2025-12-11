import type { Slot } from '../types'

/**
 * Format time as AM/PM manually (works in all environments including Cloudflare Workers)
 */
export function formatTimeAMPM(date: Date): string {
    let hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12 // 0 should be 12
    const minuteStr = minutes < 10 ? '0' + minutes : String(minutes)
    return `${hours}:${minuteStr} ${ampm}`
}

/**
 * Format a slot's time range for display
 */
export function formatTimeRange(slot: Slot): string {
    const start = new Date(slot.startTime)
    const end = new Date(start.getTime() + slot.duration * 60000)
    return `${formatTimeAMPM(start)} - ${formatTimeAMPM(end)}`
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
