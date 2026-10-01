export type NoteType = 'memo' | 'todo'
export type NoteColor = 'yellow' | 'mint' | 'pink' | 'purple'

export interface TodoItem {
  id: string
  text: string
  createdAt: number
}

export interface Note {
  id: string
  type: NoteType
  color: NoteColor
  content: string
  groupTitle: string
  todos: TodoItem[]
  createdAt: number
  updatedAt: number
  lastDeviceName: string
}

export interface ArchivedTodoLog {
  id: string
  text: string
  sourceNoteId: string
  sourceGroupTitle: string
  color: NoteColor
  createdAt: number
  completedAt: number
  completedByDevice: string
}

export interface GistArchivePayload {
  archivedLogs: ArchivedTodoLog[]
  deletedNoteIds: Record<string, number>
  deletedLogIds: Record<string, number>
}

export interface StickyWindowState {
  x: number
  y: number
  width: number
  height: number
  alwaysOnTop: boolean
  isCollapsed: boolean
}

export interface NoteSyncMeta {
  baseUpdatedAt: number
  isDirty: boolean
}

export type SyncStatus = 'SYNCED' | 'SYNCING' | 'OFFLINE' | 'ERROR'

export interface LocalDeviceConfig {
  deviceId: string
  deviceName: string
  encryptedGithubToken?: string
  gistId?: string
  lastSyncedAt?: number
  lastEtag?: string
  stickies: Record<string, StickyWindowState>
  syncMeta: Record<string, NoteSyncMeta>
  isArchiveDirty: boolean
}

export interface StickyViewModel extends Note {
  alwaysOnTop: boolean
  isCollapsed: boolean
}

export interface SyncConfigInfo {
  hasToken: boolean
  gistId?: string
  deviceName: string
  lastSyncedAt?: number
  status: SyncStatus
  message?: string
}

export interface NotesChangedPayload {
  stickies: StickyViewModel[]
  archivedLogs: ArchivedTodoLog[]
}

export interface SyncStatusChangedPayload {
  status: SyncStatus
  lastSyncedAt?: number
  message?: string
}

export interface ElectronAPI {
  notes: {
    getAllStickies: () => Promise<StickyViewModel[]>
    getById: (params: { id: string }) => Promise<StickyViewModel | null>
    create: (params: { type: NoteType; color?: NoteColor; fromNoteId?: string }) => Promise<StickyViewModel>
    updateMemo: (params: { id: string; content?: string; color?: NoteColor }) => Promise<StickyViewModel>
    updateTodoGroup: (params: { id: string; groupTitle?: string; color?: NoteColor }) => Promise<StickyViewModel>
    addTodoItem: (params: { noteId: string; text: string }) => Promise<StickyViewModel>
    editTodoItem: (params: { noteId: string; itemId: string; text: string }) => Promise<StickyViewModel>
    completeTodoItem: (params: {
      noteId: string
      itemId: string
    }) => Promise<{ note: StickyViewModel; archivedLog: ArchivedTodoLog }>
    deleteTodoItem: (params: { noteId: string; itemId: string }) => Promise<StickyViewModel>
    moveTodoItem: (params: {
      noteId: string
      itemId: string
      direction: 'up' | 'down'
    }) => Promise<StickyViewModel>
    deleteSticky: (params: { id: string }) => Promise<{ success: boolean }>
    onChanged: (callback: (payload: NotesChangedPayload) => void) => () => void
  }
  archive: {
    getAll: () => Promise<ArchivedTodoLog[]>
    uncomplete: (params: { logId: string }) => Promise<NotesChangedPayload>
    deleteLog: (params: { logId: string }) => Promise<{ success: boolean }>
  }
  window: {
    openArchive: () => Promise<{ success: boolean }>
    toggleAlwaysOnTop: (params: { noteId: string }) => Promise<{ alwaysOnTop: boolean }>
    toggleCollapse: (params: { noteId: string }) => Promise<{ isCollapsed: boolean }>
    toggleHideAll: () => Promise<{ isHidden: boolean }>
  }
  sync: {
    getConfig: () => Promise<SyncConfigInfo>
    setupToken: (params: { token: string }) => Promise<{ success: boolean; gistId: string; username: string }>
    triggerNow: () => Promise<{ status: SyncStatus; syncedCount: number }>
    onStatusChanged: (callback: (payload: SyncStatusChangedPayload) => void) => () => void
  }
  backup: {
    exportData: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; count?: number }>
    importData: () => Promise<{
      success: boolean
      canceled?: boolean
      importedNotesCount?: number
      importedLogsCount?: number
    }>
  }
  system: {
    getAutoLaunch: () => Promise<{ enabled: boolean }>
    setAutoLaunch: (params: { enabled: boolean }) => Promise<{ enabled: boolean }>
  }
}

export const MAX_STICKIES = 10
export const COLLAPSED_HEIGHT = 38
export const DEFAULT_STICKY_WIDTH = 300
export const DEFAULT_STICKY_HEIGHT = 360

export const COLOR_THEMES: Record<
  NoteColor,
  {
    label: string
    bg: string
    headerBg: string
    border: string
    accent: string
    dot: string
    badgeBg: string
    badgeText: string
  }
> = {
  yellow: {
    label: '노란색',
    bg: '#FFF9C4',
    headerBg: '#FFF176',
    border: '#FBC02D',
    accent: '#F57F17',
    dot: '#FBC02D',
    badgeBg: '#FFF59D',
    badgeText: '#7F6000'
  },
  mint: {
    label: '민트',
    bg: '#E0F2F1',
    headerBg: '#B2DFDB',
    border: '#4DB6AC',
    accent: '#00695C',
    dot: '#26A69A',
    badgeBg: '#B2DFDB',
    badgeText: '#004D40'
  },
  pink: {
    label: '핑크',
    bg: '#FCE4EC',
    headerBg: '#F8BBD0',
    border: '#F06292',
    accent: '#AD1457',
    dot: '#EC407A',
    badgeBg: '#F8BBD0',
    badgeText: '#880E4F'
  },
  purple: {
    label: '퍼플',
    bg: '#F3E5F5',
    headerBg: '#E1BEE7',
    border: '#BA68C8',
    accent: '#6A1B9A',
    dot: '#AB47BC',
    badgeBg: '#E1BEE7',
    badgeText: '#4A148C'
  }
}
