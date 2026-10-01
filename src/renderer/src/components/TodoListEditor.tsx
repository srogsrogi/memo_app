import { useState } from 'react'
import { Check, Plus, Undo2, X } from 'lucide-react'
import { TodoItem } from '../../../shared/types'

interface TodoListEditorProps {
  noteId: string
  groupTitle: string
  todos: TodoItem[]
  onUpdateGroupTitle: (newTitle: string) => void
  onAddTodo: (text: string) => void
  onEditTodo: (itemId: string, text: string) => void
  onCompleteTodo: (itemId: string) => void
  onDeleteTodo: (itemId: string) => void
  lastCompletedLogId: string | null
  onUndoComplete: (logId: string) => void
}

export default function TodoListEditor({
  groupTitle,
  todos,
  onUpdateGroupTitle,
  onAddTodo,
  onEditTodo,
  onCompleteTodo,
  onDeleteTodo,
  lastCompletedLogId,
  onUndoComplete
}: TodoListEditorProps): JSX.Element {
  const [inputText, setInputText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  const handleAddSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed) return
    onAddTodo(trimmed)
    setInputText('')
  }

  const handleStartEdit = (item: TodoItem): void => {
    setEditingId(item.id)
    setEditingText(item.text)
  }

  const handleSaveEdit = (itemId: string): void => {
    const trimmed = editingText.trim()
    if (trimmed) {
      onEditTodo(itemId, trimmed)
    } else {
      onDeleteTodo(itemId)
    }
    setEditingId(null)
  }

  return (
    <div className="flex h-full w-full flex-col app-no-drag">
      {/* Group Title Field */}
      <div className="px-3 pt-1 pb-2">
        <input
          type="text"
          value={groupTitle}
          onChange={(e) => onUpdateGroupTitle(e.target.value)}
          placeholder="제목"
          className="w-full bg-transparent text-sm font-semibold text-stone-800 placeholder-stone-400 focus:outline-none"
        />
      </div>

      {/* Fixed Top Input Box (FN-EDT-02: 상단 고정 입력창) */}
      <form onSubmit={handleAddSubmit} className="px-3 pb-2">
        <div className="flex items-center gap-1.5 rounded-md bg-white/50 px-2 py-1.5 shadow-xs focus-within:bg-white/80 focus-within:ring-1 focus-within:ring-stone-400">
          <Plus className="h-3.5 w-3.5 text-stone-400 shrink-0" />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="할 일 추가..."
            className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400 focus:outline-none"
          />
        </div>
      </form>

      {/* Todo Items List (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
        {todos.length === 0 ? null : (
          todos.map((item) => (
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
                    onBlur={() => handleSaveEdit(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(item.id)
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

              {/* Delete Item (without archive) */}
              <button
                type="button"
                onClick={() => onDeleteTodo(item.id)}
                title="단순 삭제 (로그 남기지 않음)"
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 text-stone-500 hover:text-red-600 rounded transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
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
    </div>
  )
}
