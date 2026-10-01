/**
 * 날짜(만료일) 유틸리티 함수
 * - 달력 선택값(YYYY-MM-DD) 및 직접 입력 텍스트(오늘, 내일, MM/DD 등) 지원
 */

export interface FormattedDueDate {
  label: string
  isOverdue: boolean
  isToday: boolean
  isTomorrow: boolean
}

/**
 * 저장된 dueDate(YYYY-MM-DD)를 읽기 쉬운 배지 라벨로 변환
 */
export function formatDueDate(dueStr?: string): FormattedDueDate | null {
  if (!dueStr) return null

  const trimmed = dueStr.trim()
  if (!trimmed) return null

  // Strip time part if present in legacy/imported data
  const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed.split(' ')[0]
  const targetDate = new Date(`${datePart}T00:00:00`)

  if (isNaN(targetDate.getTime())) {
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
  const isToday = diffDays === 0
  const isTomorrow = diffDays === 1
  const isOverdue = diffDays < 0

  let label = ''
  if (isToday) {
    label = '오늘'
  } else if (isTomorrow) {
    label = '내일'
  } else if (diffDays === -1) {
    label = '어제'
  } else if (diffDays < -1) {
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    label = `${month}/${day} (지남)`
  } else if (diffDays <= 7) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = dayNames[targetDate.getDay()]
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    label = `${month}/${day}(${dayName})`
  } else {
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    const isThisYear = year === now.getFullYear()
    label = isThisYear ? `${month}/${day}` : `${year}/${month}/${day}`
  }

  return {
    label,
    isOverdue,
    isToday,
    isTomorrow
  }
}

/**
 * 직접 입력된 문자열을 YYYY-MM-DD 규격으로 파싱
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
  const shortDateMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})$/)
  if (shortDateMatch) {
    const month = parseInt(shortDateMatch[1], 10)
    const day = parseInt(shortDateMatch[2], 10)
    const year = now.getFullYear()
    const dateObj = new Date(year, month - 1, day)
    if (!isNaN(dateObj.getTime()) && dateObj.getMonth() === month - 1) {
      return formatDateKey(dateObj)
    }
  }

  // 3. YYYY-MM-DD 또는 YYYY/MM/DD (예: 2026-10-15, 2026/10/15)
  const fullDateMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1], 10)
    const month = parseInt(fullDateMatch[2], 10)
    const day = parseInt(fullDateMatch[3], 10)
    const dateObj = new Date(year, month - 1, day)
    if (!isNaN(dateObj.getTime()) && dateObj.getMonth() === month - 1) {
      return formatDateKey(dateObj)
    }
  }

  return null
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
