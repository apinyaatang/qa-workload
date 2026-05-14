import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  eachDayOfInterval,
  isWeekend, format, parseISO,
  isBefore,
  differenceInDays,
} from 'date-fns'
import type { Period, PeriodType } from '../types'

export function getPeriod(type: PeriodType, referenceDate: Date = new Date(), customStart?: string, customEnd?: string): Period {
  if (type === 'weekly') {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 })
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 })
    return {
      type,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      label: `สัปดาห์ ${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`,
    }
  }
  if (type === 'monthly') {
    const start = startOfMonth(referenceDate)
    const end = endOfMonth(referenceDate)
    return {
      type,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      label: format(start, 'MMMM yyyy'),
    }
  }
  // custom
  const s = customStart ?? format(startOfMonth(referenceDate), 'yyyy-MM-dd')
  const e = customEnd ?? format(endOfMonth(referenceDate), 'yyyy-MM-dd')
  return {
    type: 'custom',
    startDate: s,
    endDate: e,
    label: `${format(parseISO(s), 'd MMM')} – ${format(parseISO(e), 'd MMM yyyy')}`,
  }
}

export function getWorkingDaysInPeriod(startDate: string, endDate: string, publicHolidays: string[], leaveDates: string[]): number {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const allDays = eachDayOfInterval({ start, end })
  return allDays.filter(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return !isWeekend(day) && !publicHolidays.includes(dateStr) && !leaveDates.includes(dateStr)
  }).length
}

export function getDeadlineFlag(deadline: string, status: string): 'Due Soon' | 'Overdue' | null {
  if (status === 'Done' || status === 'Cancelled') return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dl = parseISO(deadline)
  if (isBefore(dl, today)) return 'Overdue'
  if (differenceInDays(dl, today) <= 3) return 'Due Soon'
  return null
}

export function isTaskInPeriod(task: { periodStart: string; periodEnd: string }, period: Period): boolean {
  return task.periodStart === period.startDate && task.periodEnd === period.endDate
    || (task.periodStart <= period.endDate && task.periodEnd >= period.startDate)
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMM yyyy')
}
