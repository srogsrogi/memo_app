import { useEffect, useState, useMemo } from 'react'
import { CheckSquare, FileText, Palette, Pin, Plus, Trash2, Undo2 } from 'lucide-react'
import { COLOR_THEMES, NoteColor, StickyViewModel } from '../../../shared/types'
import MemoEditor from '../components/MemoEditor'
import TodoListEditor from '../components/TodoListEditor'

interface StickyWindowProps {
  noteId: string
}

export default function StickyWindow({ noteId }: StickyWindowProps): JSX.Element {
  const [note, setNote] = useState<StickyViewModel | null>(null)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null)
  const [lastCompletedLogId, setLastCompletedLogId] = useState<string | null>(null)
  const [limitToast, setLimitToast] = useState<string | null>(null)

  // Max limit toast auto-dismiss
  useEffect(() => {
    if (!limitToast) return
    const timer = setTimeout(() => {
      setLimitToast(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [limitToast])

  // Fetch initial note
  useEffect(() => {
    window.api.notes.getById({ id: noteId }).then((data) => {
      if (data) setNote(data)
    })
  }, [noteId])

  // Listen for changes
  useEffect(() => {
    const unsub = window.api.notes.onChanged((payload) => {
      const found = payload.stickies.find((s) => s.id === noteId)
      if (found) {
        setNote(found)
      }
    })
    return () => unsub()
  }, [noteId])

  // 3-second undo delete countdown timer (FN-STK-03)
  useEffect(() => {
    if (deleteCountdown === null) return
    if (deleteCountdown <= 0) {
      window.api.notes.deleteSticky({ id: noteId })
      return
    }
    const timer = setTimeout(() => {
      setDeleteCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [deleteCountdown, noteId])

  // 3-second undo toast for completed todo items
  useEffect(() => {
    if (!lastCompletedLogId) return
    const timer = setTimeout(() => {
      setLastCompletedLogId(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [lastCompletedLogId])

  const theme = useMemo(() => {
    const colorKey = (note?.color as NoteColor) || 'yellow'
    return COLOR_THEMES[colorKey] || COLOR_THEMES.yellow
  }, [note?.color])

  const handleHeaderDoubleClick = (): void => {
    window.api.window.toggleCollapse({ noteId })
  }

  const handleToggleAlwaysOnTop = (): void => {
    window.api.window.toggleAlwaysOnTop({ noteId })
  }

  const handleCreateSameType = async (): Promise<void> => {
    if (!note) return
    try {
      await window.api.notes.create({
        type: note.type,
        color: note.color,
        fromNoteId: note.id
      })
    } catch {
      setLimitToast('스티커는 최대 10개까지 생성할 수 있습니다.')
    }
  }

  const handleColorChange = (color: NoteColor): void => {
    if (!note) return
    if (note.type === 'memo') {
      window.api.notes.updateMemo({ id: note.id, color })
    } else {
      window.api.notes.updateTodoGroup({ id: note.id, color })
    }
    setIsPaletteOpen(false)
  }

  const handleStartDelete = (): void => {
    setDeleteCountdown(3)
  }

  const handleCancelDelete = (): void => {
    setDeleteCountdown(null)
  }

  // Extract first non-empty line of memo for collapsed summary
  const memoSummary = useMemo(() => {
    if (!note || note.type !== 'memo') return ''
    const text = note.content.replace(/<[^>]*>/g, '').trim()
    const firstLine = text.split('\n').find((line) => line.trim().length > 0)
    return firstLine || '메모'
  }, [note])

  if (!note) {
    return <div className="h-screen w-screen bg-amber-50" />
  }

  return (
    <div
      style={{ backgroundColor: theme.bg }}
      className="relative flex h-screen w-screen flex-col overflow-hidden border border-black/10 shadow-lg transition-colors duration-150"
    >
      {/* Top Header & Mini Toolbar (FN-STK-01) */}
      <div
        style={{ backgroundColor: theme.headerBg }}
        onDoubleClick={handleHeaderDoubleClick}
        className="app-drag-region group relative flex h-[38px] shrink-0 items-center justify-between px-2.5 transition-colors border-b border-black/5"
      >
        {/* Left: Type Icon & Collapsed Summary */}
        <div className="flex items-center gap-1.5 overflow-hidden pr-2">
          {note.type === 'memo' ? (
            <FileText className="h-3.5 w-3.5 text-stone-600 shrink-0" />
          ) : (
            <CheckSquare className="h-3.5 w-3.5 text-stone-600 shrink-0" />
          )}

          {note.isCollapsed && (
            <span className="truncate text-xs font-medium text-stone-700 select-none">
              {note.type === 'memo'
                ? memoSummary
                : `${note.groupTitle || '할 일'} (${note.todos.length}건)`}
            </span>
          )}
        </div>

        {/* Right: Mini Toolbar Buttons */}
        <div className="app-no-drag flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
          {/* ➕ Same Type Sticky (FN-STK-02) */}
          <button
            type="button"
            onClick={handleCreateSameType}
            title={note.type === 'memo' ? '새 메모 스티커 추가' : '새 할 일 스티커 추가'}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/10 text-stone-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* 🎨 4-Color Palette Selector (FN-EDT-04) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPaletteOpen((prev) => !prev)}
              title="스티커 테마 색상 변경"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/10 text-stone-700 transition-colors cursor-pointer"
            >
              <Palette className="h-3.5 w-3.5" />
            </button>

            {isPaletteOpen && (
              <div className="absolute right-0 top-7 z-50 flex gap-1 rounded-md bg-white p-1.5 shadow-md border border-stone-200">
                {(['yellow', 'mint', 'pink', 'purple'] as NoteColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorChange(c)}
                    style={{ backgroundColor: COLOR_THEMES[c].bg }}
                    className={`h-5 w-5 rounded-full border border-black/20 hover:scale-110 transition-transform cursor-pointer ${
                      note.color === c ? 'ring-2 ring-stone-600' : ''
                    }`}
                    title={COLOR_THEMES[c].label}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 📌 Always-on-Top Toggle (FN-STK-04) */}
          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            title={note.alwaysOnTop ? '항상 위 고정 해제' : '항상 위 고정'}
            className={`flex h-6 w-6 items-center justify-center rounded hover:bg-black/10 transition-colors cursor-pointer ${
              note.alwaysOnTop ? 'text-amber-800 bg-black/10' : 'text-stone-700'
            }`}
          >
            <Pin className={`h-3.5 w-3.5 ${note.alwaysOnTop ? 'fill-current' : ''}`} />
          </button>

          {/* 🗑️ Delete Button with 3s Undo (FN-STK-03) */}
          <button
            type="button"
            onClick={handleStartDelete}
            title="스티커 삭제 (3초 실행 취소 가능)"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-500/20 text-stone-700 hover:text-red-700 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Body (Hidden when collapsed) */}
      {!note.isCollapsed && (
        <div className="relative flex-1 overflow-hidden">
          {note.type === 'memo' ? (
            <MemoEditor
              noteId={note.id}
              content={note.content}
              onContentChange={(newContent) => {
                window.api.notes.updateMemo({ id: note.id, content: newContent })
              }}
            />
          ) : (
            <TodoListEditor
              noteId={note.id}
              groupTitle={note.groupTitle}
              todos={note.todos}
              onUpdateGroupTitle={(newTitle) => {
                window.api.notes.updateTodoGroup({ id: note.id, groupTitle: newTitle })
              }}
              onAddTodo={(text, dueDate) => {
                window.api.notes.addTodoItem({ noteId: note.id, text, dueDate })
              }}
              onEditTodo={(itemId, text, dueDate) => {
                window.api.notes.editTodoItem({ noteId: note.id, itemId, text, dueDate })
              }}
              onCompleteTodo={(itemId) => {
                window.api.notes.completeTodoItem({ noteId: note.id, itemId }).then((res) => {
                  setLastCompletedLogId(res.archivedLog.id)
                })
              }}
              onDeleteTodo={(itemId) => {
                window.api.notes.deleteTodoItem({ noteId: note.id, itemId })
              }}
              onMoveTodo={(itemId, direction) => {
                window.api.notes.moveTodoItem({ noteId: note.id, itemId, direction })
              }}
              lastCompletedLogId={lastCompletedLogId}
              onUndoComplete={(logId) => {
                window.api.archive.uncomplete({ logId })
                setLastCompletedLogId(null)
              }}
            />
          )}

          {/* 3-Second Undo Delete Overlay (FN-STK-03) */}
          {deleteCountdown !== null && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/90 p-4 text-white backdrop-blur-xs animate-in fade-in duration-150">
              <Trash2 className="mb-2 h-7 w-7 text-red-400 animate-pulse" />
              <p className="text-xs font-medium mb-1">스티커가 삭제됩니다</p>
              <p className="text-[11px] text-stone-300 mb-3">{deleteCountdown}초 후 창이 닫힙니다</p>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-semibold text-white hover:bg-white/30 transition-all cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5 text-emerald-400" />
                실행 취소
              </button>
            </div>
          )}

          {/* Max Limit Toast Notification */}
          {limitToast && (
            <div className="absolute top-2 left-3 right-3 z-50 flex items-center justify-center rounded bg-stone-900/90 px-3 py-1.5 text-[11px] text-white shadow-lg backdrop-blur-xs animate-in fade-in duration-150">
              <span>{limitToast}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
