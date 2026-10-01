import { contextBridge, ipcRenderer } from 'electron'
import {
  ElectronAPI,
  NoteColor,
  NoteType,
  NotesChangedPayload,
  SyncStatusChangedPayload
} from '../shared/types'

const api: ElectronAPI = {
  notes: {
    getAllStickies: () => ipcRenderer.invoke('notes:getAllStickies'),
    getById: (params: { id: string }) => ipcRenderer.invoke('notes:getById', params),
    create: (params: { type: NoteType; color?: NoteColor; fromNoteId?: string }) =>
      ipcRenderer.invoke('notes:create', params),
    updateMemo: (params: { id: string; content?: string; color?: NoteColor }) =>
      ipcRenderer.invoke('notes:updateMemo', params),
    updateTodoGroup: (params: { id: string; groupTitle?: string; color?: NoteColor }) =>
      ipcRenderer.invoke('notes:updateTodoGroup', params),
    addTodoItem: (params: { noteId: string; text: string }) =>
      ipcRenderer.invoke('notes:addTodoItem', params),
    editTodoItem: (params: { noteId: string; itemId: string; text: string }) =>
      ipcRenderer.invoke('notes:editTodoItem', params),
    completeTodoItem: (params: { noteId: string; itemId: string }) =>
      ipcRenderer.invoke('notes:completeTodoItem', params),
    deleteTodoItem: (params: { noteId: string; itemId: string }) =>
      ipcRenderer.invoke('notes:deleteTodoItem', params),
    moveTodoItem: (params: { noteId: string; itemId: string; direction: 'up' | 'down' }) =>
      ipcRenderer.invoke('notes:moveTodoItem', params),
    deleteSticky: (params: { id: string }) => ipcRenderer.invoke('notes:deleteSticky', params),
    onChanged: (callback: (payload: NotesChangedPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: NotesChangedPayload): void => {
        callback(payload)
      }
      ipcRenderer.on('notes:changed', listener)
      return () => {
        ipcRenderer.removeListener('notes:changed', listener)
      }
    }
  },
  archive: {
    getAll: () => ipcRenderer.invoke('archive:getAll'),
    uncomplete: (params: { logId: string }) => ipcRenderer.invoke('archive:uncomplete', params),
    deleteLog: (params: { logId: string }) => ipcRenderer.invoke('archive:deleteLog', params)
  },
  window: {
    openArchive: () => ipcRenderer.invoke('window:openArchive'),
    toggleAlwaysOnTop: (params: { noteId: string }) =>
      ipcRenderer.invoke('window:toggleAlwaysOnTop', params),
    toggleCollapse: (params: { noteId: string }) =>
      ipcRenderer.invoke('window:toggleCollapse', params),
    toggleHideAll: () => ipcRenderer.invoke('window:toggleHideAll'),
    focusSticky: (params: { noteId: string }) => ipcRenderer.invoke('window:focusSticky', params)
  },
  sync: {
    getConfig: () => ipcRenderer.invoke('sync:getConfig'),
    setupToken: (params: { token: string }) => ipcRenderer.invoke('sync:setupToken', params),
    triggerNow: () => ipcRenderer.invoke('sync:triggerNow'),
    onStatusChanged: (callback: (payload: SyncStatusChangedPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: SyncStatusChangedPayload): void => {
        callback(payload)
      }
      ipcRenderer.on('sync:statusChanged', listener)
      return () => {
        ipcRenderer.removeListener('sync:statusChanged', listener)
      }
    }
  },
  backup: {
    exportData: () => ipcRenderer.invoke('backup:exportData'),
    importData: () => ipcRenderer.invoke('backup:importData')
  },
  system: {
    getAutoLaunch: () => ipcRenderer.invoke('system:getAutoLaunch'),
    setAutoLaunch: (params: { enabled: boolean }) => ipcRenderer.invoke('system:setAutoLaunch', params)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose context bridge api:', error)
  }
} else {
  // @ts-ignore
  window.api = api
}
