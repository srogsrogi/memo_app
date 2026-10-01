/**
 * 날짜 / 일시 유틸리티 함수
 * - 달력 선택값(YYYY-MM-DD, YYYY-MM-DDTHH:mm) 및 직접 입력 텍스트 지원
 */

export interface FormattedDueDate {
  label: string
  isOverdue: boolean
  isToday: boolean
  isTomorrow: boolean
}

/**
 * 저장된 dueDate 문자열을 읽기 쉬운 배지 라벨로 변환
 */
export function formatDueDate(dueStr?: string): FormattedDueDate | null {
  if (!dueStr) return null

  const trimmed = dueStr.trim()
  if (!trimmed) return null

  const targetDate = new Date(trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed)
  if (isNaN(targetDate.getTime())) {
    // If not a valid standard date, show as raw text
    return {
      label: trimmed,
      isOverdue: false,
      isToday: false,
      isTomorrow: false
    }
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()

  const diffDays = Math.round((targetDayStart - todayStart) / (1000 * 60 * 60 * 24))
  const hasTime = trimmed.includes('T') || trimmed.includes(':')

  const timeStr = hasTime
    ? ` ${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`
    : ''

  const isToday = diffDays === 0
  const isTomorrow = diffDays === 1
  const isOverdue = hasTime ? targetDate.getTime() < now.getTime() : diffDays < 0

  let label = ''
  if (isToday) {
    label = `오늘${timeStr}`
  } else if (isTomorrow) {
    label = `내일${timeStr}`
  } else if (diffDays === -1) {
    label = `어제${timeStr}`
  } else if (diffDays < -1) {
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    label = `${month}/${day}${timeStr} (지남)`
  } else if (diffDays <= 7) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = dayNames[targetDate.getDay()]
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    label = `${month}/${day}(${dayName})${timeStr}`
  } else {
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    const isThisYear = year === now.getFullYear()
    label = isThisYear ? `${month}/${day}${timeStr}` : `${year}/${month}/${day}${timeStr}`
  }

  return {
    label,
    isOverdue,
    isToday,
    isTomorrow
  }
}

/**
 * 사용자가 직접 텍스트로 입력한 날짜 문자열을 표준 포맷(YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm)으로 파싱
 */
export function parseDirectDateInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const now = new Date()

  // 1. 단어 기반 직접 입력 (오늘, 내일, 모레)
  if (trimmed === '오늘') {
    return formatDateKey(now)
  }
  if (trimmed === '내일') {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return formatDateKey(tomorrow)
  }
  if (trimmed === '모레') {
    const dayAfter = new Date(now)
    dayAfter.setDate(dayAfter.getDate() + 2)
    return formatDateKey(dayAfter)
  }

  // 2. MM-DD 또는 MM/DD (예: 10-15, 10/15)
  const shortDateMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (shortDateMatch) {
    const month = parseInt(shortDateMatch[1], 10)
    const day = parseInt(shortDateMatch[2], 10)
    const hour = shortDateMatch[3] !== undefined ? parseInt(shortDateMatch[3], 10) : null
    const minute = shortDateMatch[4] !== undefined ? parseInt(shortDateMatch[4], 10) : null

    const year = now.getFullYear()
    const dateObj = new Date(year, month - 1, day, hour ?? 0, minute ?? 0)
    if (!isNaN(dateObj.getTime())) {
      if (hour !== null && minute !== null) {
        return formatDateTimeKey(dateObj)
      }
      return formatDateKey(dateObj)
    }
  }

  // 3. YYYY-MM-DD 또는 YYYY/MM/DD (예: 2026-10-15, 2026/10/15 14:00)
  const fullDateMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?$/)
  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1], 10)
    const month = parseInt(fullDateMatch[2], 10)
    const day = parseInt(fullDateMatch[3], 10)
    const hour = fullDateMatch[4] !== undefined ? parseInt(fullDateMatch[4], 10) : null
    const minute = fullDateMatch[5] !== undefined ? parseInt(fullDateMatch[5], 10) : null

    const dateObj = new Date(year, month - 1, day, hour ?? 0, minute ?? 0)
    if (!isNaN(dateObj.getTime())) {
      if (hour !== null && minute !== null) {
        return formatDateTimeKey(dateObj)
      }
      return formatDateKey(dateObj)
    }
  }

  // 4. Fallback: 표준 Date 파싱 시도
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    if (trimmed.includes(':')) {
      return formatDateTimeKey(parsed)
    }
    return formatDateKey(parsed)
  }

  return trimmed
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTimeKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}
