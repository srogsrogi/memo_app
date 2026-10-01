import { useMemo } from 'react'
import StickyWindow from './windows/StickyWindow'
import ArchiveWindow from './windows/ArchiveWindow'

export default function App(): JSX.Element {
  const { windowType, noteId } = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      windowType: params.get('window') || 'sticky',
      noteId: params.get('id') || ''
    }
  }, [])

  if (windowType === 'archive') {
    return <ArchiveWindow />
  }

  if (windowType === 'sticky' && noteId) {
    return <StickyWindow noteId={noteId} />
  }

  return <div className="h-screen w-screen bg-transparent" />
}
