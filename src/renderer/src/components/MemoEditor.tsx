import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface MemoEditorProps {
  noteId: string
  content: string
  onContentChange: (newContent: string) => void
}

export default function MemoEditor({ noteId, content, onContentChange }: MemoEditorProps): JSX.Element {
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: '메모...'
      })
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none min-h-[140px] px-3 py-2 text-stone-800 leading-relaxed select-text'
      }
    },
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true
      onContentChange(editor.getHTML())
    }
  })

  // Synchronize when remote updates arrive and user is not currently typing that exact content
  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    const currentHtml = editor.getHTML()
    if (content !== currentHtml) {
      editor.commands.setContent(content || '', false)
    }
  }, [content, editor, noteId])

  return (
    <div className="h-full w-full overflow-y-auto app-no-drag">
      <EditorContent editor={editor} />
    </div>
  )
}
