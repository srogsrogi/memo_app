import React, { useState, useRef } from 'react'
import { Calendar as CalendarIcon, X, Check, Trash2 } from 'lucide-react'
import { formatDateKey, parseDirectDateInput } from '../utils/dateUtils'

interface DueDatePickerModalProps {
  initialDueDate?: string
  onSave: (newDueDate: string | null) => void
  onClose: () => void
}

export default function DueDatePickerModal({
  initialDueDate,
  onSave,
  onClose
}: DueDatePickerModalProps): JSX.Element {
  const getInitialDatePart = (): string => {
    if (!initialDueDate) return formatDateKey(new Date())
    if (initialDueDate.includes('T')) return initialDueDate.split('T')[0]
    if (initialDueDate.includes(' ')) return initialDueDate.split(' ')[0]
    return initialDueDate
  }

  const [dateValue, setDateValue] = useState(getInitialDatePart())
  const [textInput, setTextInput] = useState(initialDueDate ? getInitialDatePart() : '')

  const nativeDateInputRef = useRef<HTMLInputElement>(null)

  // Handle direct text typing
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setTextInput(val)

    const parsed = parseDirectDateInput(val)
    if (parsed) {
      setDateValue(parsed)
    }
  }

  // Handle calendar date change
  const handleCalendarDateChange = (newDate: string): void => {
    setDateValue(newDate)
    setTextInput(newDate)
  }

  const handleConfirm = (): void => {
    if (!textInput.trim() && !dateValue) {
      onSave(null)
      return
    }

    const parsed = parseDirectDateInput(textInput)
    if (parsed) {
      onSave(parsed)
      return
    }

    if (dateValue) {
      onSave(dateValue)
      return
    }

    onSave(textInput.trim() || null)
  }

  const handleClear = (): void => {
    onSave(null)
  }

  // Open native picker dialog on button click
  const triggerNativeCalendar = (): void => {
    if (nativeDateInputRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          nativeDateInputRef.current.showPicker()
        } else {
          nativeDateInputRef.current.focus()
        }
      } catch {
        nativeDateInputRef.current.focus()
      }
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-3 backdrop-blur-2xs animate-in fade-in duration-100">
      <div className="w-full max-w-[270px] rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xl text-stone-800 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-stone-100">
          <div className="flex items-center gap-1.5 font-bold text-stone-800">
            <CalendarIcon className="h-4 w-4 text-amber-600" />
            <span>만료일(날짜) 설정</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 1. Calendar Click Picker (달력 클릭 방식) */}
        <div className="mb-2.5">
          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
            달력에서 선택
          </label>
          <div className="flex items-center gap-1.5">
            <input
              ref={nativeDateInputRef}
              type="date"
              value={dateValue}
              onChange={(e) => handleCalendarDateChange(e.target.value)}
              className="flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-amber-500 cursor-pointer"
            />
            <button
              type="button"
              onClick={triggerNativeCalendar}
              title="달력 열기"
              className="flex h-8 w-8 items-center justify-center rounded border border-stone-300 bg-stone-100 hover:bg-amber-100 hover:border-amber-400 text-stone-700 transition-colors cursor-pointer shrink-0"
            >
              <CalendarIcon className="h-4 w-4 text-amber-700" />
            </button>
          </div>
        </div>

        {/* 2. Direct Text Input (직접 입력 방식) */}
        <div className="mb-3.5">
          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
            직접 입력
          </label>
          <input
            type="text"
            autoFocus
            value={textInput}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="예: 2026-10-15, 10/15, 오늘, 내일"
            className="w-full rounded-md border border-stone-300 bg-stone-50 px-2 py-1.5 text-xs outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-stone-800 placeholder-stone-400"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          {initialDueDate ? (
            <button
              type="button"
              onClick={handleClear}
              title="날짜 삭제"
              className="flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-stone-100 hover:bg-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1 rounded bg-amber-500 hover:bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white shadow-xs transition-colors cursor-pointer"
            >
              <Check className="h-3 w-3" />
              설정
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
