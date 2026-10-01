import React, { useState } from 'react'
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronUp, Plus, Undo2, X } from 'lucide-react'
import { TodoItem } from '../../../shared/types'
import { formatDueDate } from '../utils/dateUtils'
import DueDatePickerModal from './DueDatePickerModal'

interface TodoListEditorProps {
  noteId: string
  groupTitle: string
  todos: TodoItem[]
  onUpdateGroupTitle: (newTitle: string) => void
  onAddTodo: (text: string, dueDate?: string) => void
  onEditTodo: (itemId: string, text?: string, dueDate?: string | null) => void
  onCompleteTodo: (itemId: string) => void
  onDeleteTodo: (itemId: string) => void
  onMoveTodo?: (itemId: string, direction: 'up' | 'down') => void
  lastCompletedLogId: string | null
  onUndoComplete: (logId: string) => void
}

type PickerTarget =
  | { mode: 'new' }
  | { mode: 'edit'; item: TodoItem }
  | null

export default function TodoListEditor({
  groupTitle,
  todos,
  onUpdateGroupTitle,
  onAddTodo,
  onEditTodo,
  onCompleteTodo,
  onDeleteTodo,
  onMoveTodo,
  lastCompletedLogId,
  onUndoComplete
}: TodoListEditorProps): JSX.Element {
  const [inputText, setInputText] = useState('')
  const [newDueDate, setNewDueDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)

  const handleAddSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed) return
    onAddTodo(trimmed, newDueDate || undefined)
    setInputText('')
    setNewDueDate(null)
  }

  const handleStartEdit = (item: TodoItem): void => {
    setEditingId(item.id)
    setEditingText(item.text)
  }

  const handleSaveEdit = (item: TodoItem): void => {
    const trimmed = editingText.trim()
    if (trimmed) {
      onEditTodo(item.id, trimmed, item.dueDate)
    } else {
      onDeleteTodo(item.id)
    }
    setEditingId(null)
  }

  const formattedNewDate = newDueDate ? formatDueDate(newDueDate) : null

  return (
    <div className="relative flex h-full w-full flex-col app-no-drag">
      {/* Group Title Field */}
      <div className="px-3 pt-1 pb-1.5">
        <input
          type="text"
          value={groupTitle}
          onChange={(e) => onUpdateGroupTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.currentTarget.blur()
            }
          }}
          placeholder="제목"
          className="w-full bg-transparent text-sm font-semibold text-stone-800 placeholder-stone-400 focus:outline-none"
        />
      </div>

      {/* Fixed Top Input Box (FN-EDT-02: 상단 고정 입력창 + 날짜 선택) */}
      <form onSubmit={handleAddSubmit} className="px-3 pb-2">
        <div className="flex flex-col gap-1 rounded-md bg-white/50 px-2 py-1.5 shadow-xs focus-within:bg-white/80 focus-within:ring-1 focus-within:ring-stone-400">
          <div className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setInputText('')
                  setNewDueDate(null)
                  e.currentTarget.blur()
                }
              }}
              placeholder="할 일 추가..."
              className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400 focus:outline-none"
            />

            {/* Date setting button in top input */}
            <button
              type="button"
              onClick={() => setPickerTarget({ mode: 'new' })}
              title="날짜/일시 지정"
              className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                newDueDate ? 'text-amber-800 bg-amber-100/80' : 'text-stone-400 hover:text-amber-700'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* New Due Date Badge if selected */}
          {formattedNewDate && (
            <div className="flex items-center gap-1 self-start ml-5 mt-0.5">
              <span
                onClick={() => setPickerTarget({ mode: 'new' })}
                title="날짜 수정"
                className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
              >
                <CalendarIcon className="h-2.5 w-2.5 opacity-70" />
                <span>{formattedNewDate.label}</span>
              </span>
              <button
                type="button"
                onClick={() => setNewDueDate(null)}
                title="날짜 제거"
                className="text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Todo Items List (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
        {todos.length === 0 ? null : (
          todos.map((item, index) => {
            const formatted = item.dueDate ? formatDueDate(item.dueDate) : null

            return (
              <div
                key={item.id}
                className="group flex items-center justify-between rounded px-2 py-1 hover:bg-black/5 transition-colors text-xs text-stone-800"
              >
                {/* Complete Checkbox */}
                <button
                  type="button"
                  onClick={() => onCompleteTodo(item.id)}
                  title="완료 (아카이브로 이동)"
                  className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-stone-400 bg-white/70 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                >
                  <Check className="h-3 w-3 opacity-0 group-hover:opacity-100 hover:!opacity-100" />
                </button>

                {/* Text / Inline Edit */}
                <div className="flex-1 min-w-0 mr-1.5 select-text">
                  {editingId === item.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={() => handleSaveEdit(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="w-full bg-white px-1.5 py-0.5 rounded text-xs text-stone-900 focus:outline-none ring-1 ring-stone-400"
                    />
                  ) : (
                    <span
                      onClick={() => handleStartEdit(item)}
                      className="block truncate cursor-text"
                      title={item.text}
                    >
                      {item.text}
                    </span>
                  )}
                </div>

                {/* Due Date Badge or Add Date Icon */}
                <div className="flex items-center shrink-0 mr-1">
                  {formatted ? (
                    <button
                      type="button"
                      onClick={() => setPickerTarget({ mode: 'edit', item })}
                      title={`날짜 변경: ${item.dueDate}`}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all cursor-pointer ${
                        formatted.isOverdue
                          ? 'bg-rose-100/90 text-rose-700 border border-rose-300 hover:bg-rose-200'
                          : formatted.isToday
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                          : 'bg-black/5 hover:bg-black/10 text-stone-600 border border-black/5'
                      }`}
                    >
                      <CalendarIcon className="h-2.5 w-2.5 opacity-70 shrink-0" />
                      <span className="truncate max-w-[85px]">{formatted.label}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerTarget({ mode: 'edit', item })}
                      title="날짜/일시 지정"
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 text-stone-400 hover:text-amber-700 transition-opacity cursor-pointer"
                    >
                      <CalendarIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Actions: Move Up / Move Down / Delete */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity shrink-0">
                  {onMoveTodo && todos.length > 1 && (
                    <>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onMoveTodo(item.id, 'up')}
                        title="위로 이동"
                        className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-20 disabled:hover:text-stone-500 rounded transition-all cursor-pointer"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={index === todos.length - 1}
                        onClick={() => onMoveTodo(item.id, 'down')}
                        title="아래로 이동"
                        className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-20 disabled:hover:text-stone-500 rounded transition-all cursor-pointer"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteTodo(item.id)}
                    title="단순 삭제 (로그 남기지 않음)"
                    className="p-0.5 text-stone-500 hover:text-red-600 rounded transition-all cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Undo Toast when item was completed (FN-EDT-03) */}
      {lastCompletedLogId && (
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between rounded bg-stone-900/90 px-2.5 py-1.5 text-[11px] text-white shadow-lg backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span>할 일이 완료되었습니다.</span>
          <button
            type="button"
            onClick={() => onUndoComplete(lastCompletedLogId)}
            className="flex items-center gap-1 font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <Undo2 className="h-3 w-3" />
            실행 취소
          </button>
        </div>
      )}

      {/* Due Date Picker Modal (달력 클릭 및 직접 입력 지원) */}
      {pickerTarget && (
        <DueDatePickerModal
          initialDueDate={
            pickerTarget.mode === 'new'
              ? (newDueDate || undefined)
              : pickerTarget.item.dueDate
          }
          onSave={(savedDueDate) => {
            if (pickerTarget.mode === 'new') {
              setNewDueDate(savedDueDate)
            } else {
              onEditTodo(pickerTarget.item.id, pickerTarget.item.text, savedDueDate)
            }
            setPickerTarget(null)
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </div>
  )
}
