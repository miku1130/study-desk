import type { Period } from '../types'

export const MINUTES_PER_HOUR = 60
export const TIMETABLE_HOUR_HEIGHT = 72

export interface TimelineBounds {
  start: number
  end: number
  duration: number
  hours: number[]
}

export interface PeriodPosition {
  top: string
  height: string
  durationMinutes: number
}

export function timeToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  return hours * MINUTES_PER_HOUR + minutes
}

export function isPeriodRemaining(period: Pick<Period, 'end'>, nowMinutes: number): boolean {
  return timeToMinutes(period.end) > nowMinutes
}

export function getTimelineBounds(periods: Period[]): TimelineBounds {
  const ranges = periods
    .map((period) => ({
      start: timeToMinutes(period.start),
      end: timeToMinutes(period.end)
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start)

  if (ranges.length === 0) {
    const start = 8 * MINUTES_PER_HOUR
    const end = 18 * MINUTES_PER_HOUR
    return createTimelineBounds(start, end)
  }

  const firstMinute = Math.min(...ranges.map(({ start }) => start))
  const lastMinute = Math.max(...ranges.map(({ end }) => end))
  const start = Math.floor(firstMinute / MINUTES_PER_HOUR) * MINUTES_PER_HOUR
  const end = Math.ceil(lastMinute / MINUTES_PER_HOUR) * MINUTES_PER_HOUR

  return createTimelineBounds(start, Math.max(end, start + MINUTES_PER_HOUR))
}

export function getPeriodPosition(period: Period, timeline: TimelineBounds): PeriodPosition {
  const start = timeToMinutes(period.start)
  const end = timeToMinutes(period.end)
  const durationMinutes = Math.max(0, end - start)

  return {
    top: `${((start - timeline.start) / timeline.duration) * 100}%`,
    height: `${(durationMinutes / timeline.duration) * 100}%`,
    durationMinutes
  }
}

export function formatHour(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  return `${String(hours).padStart(2, '0')}:00`
}

export function formatDuration(durationMinutes: number): string {
  return `${durationMinutes} 分钟`
}

function createTimelineBounds(start: number, end: number): TimelineBounds {
  const duration = end - start
  const hourCount = duration / MINUTES_PER_HOUR

  return {
    start,
    end,
    duration,
    hours: Array.from({ length: hourCount }, (_, index) => start + index * MINUTES_PER_HOUR)
  }
}
