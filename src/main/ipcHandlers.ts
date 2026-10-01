import { ipcMain } from 'electron'
import { NoteColor, NoteType, SyncConfigInfo } from '../shared/types'
import { GistSyncEngine } from './gistSyncEngine'
import { LocalStore } from './localStore'
import { WindowManager } from './windowManager'

export function registerIpcHandlers(store: LocalStore, wm: WindowManager, sync: GistSyncEngine): void {
  // --- Notes Management ---
  ipcMain.handle('notes:getAllStickies', async () => {
    return store.getAllStickies()
  })

  ipcMain.handle('notes:getById', async (_event, params: { id: string }) => {
    return store.getById(params.id)
  })

  ipcMain.handle(
    'notes:create',
    async (_event, params: { type: NoteType; color?: NoteColor; fromNoteId?: string }) => {
      const note = store.createSticky(params)
      wm.openSticky(note.id)
      wm.broadcastNotesChanged()
      sync.scheduleDebouncedPush()
      return note
    }
  )

  ipcMain.handle(
    'notes:updateMemo',
    async (_event, params: { id: string; content?: string; color?: NoteColor }) => {
      const updated = store.updateMemo(params)
      wm.broadcastNotesChanged()
      sync.scheduleDebouncedPush()
      return updated
    }
  )

  ipcMain.handle(
    'notes:updateTodoGroup',
    async (_event, params: { id: string; groupTitle?: string; color?: NoteColor }) => {
      const updated = store.updateTodoGroup(params)
      wm.broadcastNotesChanged()
      sync.scheduleDebouncedPush()
      return updated
    }
  )

  ipcMain.handle('notes:addTodoItem', async (_event, params: { noteId: string; text: string }) => {
    const updated = store.addTodoItem(params)
    wm.broadcastNotesChanged()
    sync.scheduleDebouncedPush()
    return updated
  })

  ipcMain.handle(
    'notes:editTodoItem',
    async (_event, params: { noteId: string; itemId: string; text: string }) => {
      const updated = store.editTodoItem(params)
      wm.broadcastNotesChanged()
      sync.scheduleDebouncedPush()
      return updated
    }
  )

  ipcMain.handle(
    'notes:completeTodoItem',
    async (_event, params: { noteId: string; itemId: string }) => {
      const result = store.completeTodoItem(params)
      wm.broadcastNotesChanged()
      sync.scheduleDebouncedPush()
      return result
    }
  )

  ipcMain.handle(
    'notes:deleteTodoItem',
    async (_event, params: { noteId: string; itemId: string }) => {
      const updated = store.deleteTodoItem(params)
      wm.broadcastNotesChanged()
      sync.scheduleDebouncedPush()
      return updated
    }
  )

  ipcMain.handle('notes:deleteSticky', async (_event, params: { id: string }) => {
    wm.closeStickyWindow(params.id)
    store.deleteSticky(params.id)
    wm.broadcastNotesChanged()
    sync.scheduleDebouncedPush()
    return { success: true }
  })

  // --- Archive Management ---
  ipcMain.handle('archive:getAll', async () => {
    return store.getAllArchivedLogs()
  })

  ipcMain.handle('archive:uncomplete', async (_event, params: { logId: string }) => {
    const { targetNoteId, createdNewNote } = store.uncompleteArchivedLog(params.logId)
    if (createdNewNote) {
      wm.openSticky(targetNoteId)
    }
    wm.broadcastNotesChanged()
    sync.scheduleDebouncedPush()
    return {
      stickies: store.getAllStickies(),
      archivedLogs: store.getAllArchivedLogs()
    }
  })

  ipcMain.handle('archive:deleteLog', async (_event, params: { logId: string }) => {
    store.deleteArchivedLog(params.logId)
    wm.broadcastNotesChanged()
    sync.scheduleDebouncedPush()
    return { success: true }
  })

  // --- Window Control ---
  ipcMain.handle('window:openArchive', async () => {
    wm.openArchiveWindow()
    return { success: true }
  })

  ipcMain.handle('window:toggleAlwaysOnTop', async (_event, params: { noteId: string }) => {
    const flag = wm.toggleAlwaysOnTop(params.noteId)
    return { alwaysOnTop: flag }
  })

  ipcMain.handle('window:toggleCollapse', async (_event, params: { noteId: string }) => {
    const flag = wm.toggleCollapse(params.noteId)
    return { isCollapsed: flag }
  })

  ipcMain.handle('window:toggleHideAll', async () => {
    const isHidden = wm.toggleHideAll()
    return { isHidden }
  })

  // --- Sync Control ---
  ipcMain.handle('sync:getConfig', async (): Promise<SyncConfigInfo> => {
    const token = store.getGithubToken()
    const gistId = store.getConfig().gistId
    const statusInfo = sync.getStatus()
    return {
      hasToken: Boolean(token),
      gistId,
      deviceName: store.getDeviceName(),
      lastSyncedAt: statusInfo.lastSyncedAt,
      status: statusInfo.status,
      message: statusInfo.message
    }
  })

  ipcMain.handle('sync:setupToken', async (_event, params: { token: string }) => {
    return sync.setupToken(params.token)
  })

  ipcMain.handle('sync:triggerNow', async () => {
    return sync.triggerSync()
  })
}
