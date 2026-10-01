import { app, safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  ArchivedTodoLog,
  DEFAULT_STICKY_HEIGHT,
  DEFAULT_STICKY_WIDTH,
  GistArchivePayload,
  LocalDeviceConfig,
  MAX_STICKIES,
  Note,
  NoteColor,
  NoteType,
  StickyViewModel,
  StickyWindowState
} from '../shared/types'

function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export class LocalStore {
  private readonly userDataDir: string
  private readonly notesPath: string
  private readonly archivePath: string
  private readonly configPath: string

  private notes: Note[] = []
  private archivePayload: GistArchivePayload = {
    archivedLogs: [],
    deletedNoteIds: {},
    deletedLogIds: {}
  }
  private config: LocalDeviceConfig

  constructor() {
    this.userDataDir = app.getPath('userData')
    this.notesPath = path.join(this.userDataDir, 'notes.json')
    this.archivePath = path.join(this.userDataDir, 'archive.json')
    this.configPath = path.join(this.userDataDir, 'device-config.json')

    this.notes = readJsonSafe<Note[]>(this.notesPath, [])
    this.archivePayload = readJsonSafe<GistArchivePayload>(this.archivePath, {
      archivedLogs: [],
      deletedNoteIds: {},
      deletedLogIds: {}
    })
    this.config = readJsonSafe<LocalDeviceConfig>(this.configPath, {
      deviceId: randomUUID(),
      deviceName: os.hostname() || 'My-Device',
      stickies: {},
      syncMeta: {},
      isArchiveDirty: false
    })
    this.saveConfig()
  }

  private saveNotes(): void {
    atomicWriteJson(this.notesPath, this.notes)
  }

  private saveArchive(): void {
    atomicWriteJson(this.archivePath, this.archivePayload)
  }

  public saveConfig(): void {
    atomicWriteJson(this.configPath, this.config)
  }

  public getConfig(): LocalDeviceConfig {
    return this.config
  }

  public getDeviceName(): string {
    return this.config.deviceName
  }

  public setGithubToken(token: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token)
      this.config.encryptedGithubToken = `enc:${encrypted.toString('base64')}`
    } else {
      this.config.encryptedGithubToken = `b64:${Buffer.from(token, 'utf-8').toString('base64')}`
    }
    this.saveConfig()
  }

  public getGithubToken(): string | null {
    const raw = this.config.encryptedGithubToken
    if (!raw) return null
    try {
      if (raw.startsWith('enc:')) {
        const buf = Buffer.from(raw.slice(4), 'base64')
        return safeStorage.decryptString(buf)
      }
      if (raw.startsWith('b64:')) {
        return Buffer.from(raw.slice(4), 'base64').toString('utf-8')
      }
      return null
    } catch {
      return null
    }
  }

  public setGistId(gistId: string): void {
    this.config.gistId = gistId
    this.saveConfig()
  }

  public setLastSynced(timestamp: number, etag?: string): void {
    this.config.lastSyncedAt = timestamp
    if (etag !== undefined) {
      this.config.lastEtag = etag
    }
    this.saveConfig()
  }

  public getWindowState(noteId: string): StickyWindowState {
    if (!this.config.stickies[noteId]) {
      const count = Object.keys(this.config.stickies).length
      const offset = (count % 6) * 28
      this.config.stickies[noteId] = {
        x: 120 + offset,
        y: 120 + offset,
        width: DEFAULT_STICKY_WIDTH,
        height: DEFAULT_STICKY_HEIGHT,
        alwaysOnTop: false,
        isCollapsed: false
      }
      this.saveConfig()
    }
    return this.config.stickies[noteId]
  }

  public setWindowState(noteId: string, patch: Partial<StickyWindowState>): StickyWindowState {
    const current = this.getWindowState(noteId)
    const updated: StickyWindowState = { ...current, ...patch }
    this.config.stickies[noteId] = updated
    this.saveConfig()
    return updated
  }

  public toViewModel(note: Note): StickyViewModel {
    const winState = this.getWindowState(note.id)
    return {
      ...note,
      alwaysOnTop: winState.alwaysOnTop,
      isCollapsed: winState.isCollapsed
    }
  }

  public getAllStickies(): StickyViewModel[] {
    return this.notes.map((n) => this.toViewModel(n))
  }

  public getRawNotes(): Note[] {
    return this.notes
  }

  public getById(id: string): StickyViewModel | null {
    const note = this.notes.find((n) => n.id === id)
    return note ? this.toViewModel(note) : null
  }

  public createSticky(params: {
    type: NoteType
    color?: NoteColor
    fromNoteId?: string
    initialContent?: string
    initialGroupTitle?: string
  }): StickyViewModel {
    if (this.notes.length >= MAX_STICKIES) {
      throw new Error(`스티커는 최대 ${MAX_STICKIES}개까지만 생성할 수 있습니다.`)
    }

    const now = Date.now()
    const id = randomUUID()
    const note: Note = {
      id,
      type: params.type,
      color: params.color ?? 'yellow',
      content: params.type === 'memo' ? (params.initialContent ?? '') : '',
      groupTitle: params.type === 'todo' ? (params.initialGroupTitle ?? '') : '',
      todos: [],
      createdAt: now,
      updatedAt: now,
      lastDeviceName: this.config.deviceName
    }

    if (params.fromNoteId && this.config.stickies[params.fromNoteId]) {
      const sourceWin = this.config.stickies[params.fromNoteId]
      this.config.stickies[id] = {
        x: sourceWin.x + 24,
        y: sourceWin.y + 24,
        width: DEFAULT_STICKY_WIDTH,
        height: DEFAULT_STICKY_HEIGHT,
        alwaysOnTop: sourceWin.alwaysOnTop,
        isCollapsed: false
      }
    } else {
      this.getWindowState(id)
    }

    this.config.syncMeta[id] = {
      baseUpdatedAt: 0,
      isDirty: true
    }

    this.notes.push(note)
    this.saveNotes()
    this.saveConfig()
    return this.toViewModel(note)
  }

  public updateMemo(params: { id: string; content?: string; color?: NoteColor }): StickyViewModel {
    const note = this.notes.find((n) => n.id === params.id)
    if (!note) throw new Error('Note not found')

    if (params.content !== undefined) note.content = params.content
    if (params.color !== undefined) note.color = params.color
    note.updatedAt = Date.now()
    note.lastDeviceName = this.config.deviceName

    this.markNoteDirty(note.id)
    this.saveNotes()
    return this.toViewModel(note)
  }

  public updateTodoGroup(params: { id: string; groupTitle?: string; color?: NoteColor }): StickyViewModel {
    const note = this.notes.find((n) => n.id === params.id)
    if (!note) throw new Error('Note not found')

    if (params.groupTitle !== undefined) note.groupTitle = params.groupTitle
    if (params.color !== undefined) note.color = params.color
    note.updatedAt = Date.now()
    note.lastDeviceName = this.config.deviceName

    this.markNoteDirty(note.id)
    this.saveNotes()
    return this.toViewModel(note)
  }

  public addTodoItem(params: { noteId: string; text: string }): StickyViewModel {
    const trimmed = params.text.trim()
    const note = this.notes.find((n) => n.id === params.noteId)
    if (!note) throw new Error('Note not found')
    if (!trimmed) return this.toViewModel(note)

    note.todos.push({
      id: randomUUID(),
      text: trimmed,
      createdAt: Date.now()
    })
    note.updatedAt = Date.now()
    note.lastDeviceName = this.config.deviceName

    this.markNoteDirty(note.id)
    this.saveNotes()
    return this.toViewModel(note)
  }

  public editTodoItem(params: { noteId: string; itemId: string; text: string }): StickyViewModel {
    const note = this.notes.find((n) => n.id === params.noteId)
    if (!note) throw new Error('Note not found')

    const item = note.todos.find((t) => t.id === params.itemId)
    if (item) {
      item.text = params.text
      note.updatedAt = Date.now()
      note.lastDeviceName = this.config.deviceName
      this.markNoteDirty(note.id)
      this.saveNotes()
    }
    return this.toViewModel(note)
  }

  public completeTodoItem(params: {
    noteId: string
    itemId: string
  }): { note: StickyViewModel; archivedLog: ArchivedTodoLog } {
    const note = this.notes.find((n) => n.id === params.noteId)
    if (!note) throw new Error('Note not found')

    const idx = note.todos.findIndex((t) => t.id === params.itemId)
    if (idx === -1) throw new Error('Todo item not found')

    const [removed] = note.todos.splice(idx, 1)
    const now = Date.now()
    note.updatedAt = now
    note.lastDeviceName = this.config.deviceName

    const archivedLog: ArchivedTodoLog = {
      id: removed.id,
      text: removed.text,
      sourceNoteId: note.id,
      sourceGroupTitle: note.groupTitle.trim() || '할 일',
      color: note.color,
      createdAt: removed.createdAt,
      completedAt: now,
      completedByDevice: this.config.deviceName
    }

    this.archivePayload.archivedLogs.unshift(archivedLog)
    this.config.isArchiveDirty = true
    this.markNoteDirty(note.id)

    this.saveNotes()
    this.saveArchive()
    this.saveConfig()

    return {
      note: this.toViewModel(note),
      archivedLog
    }
  }

  public deleteTodoItem(params: { noteId: string; itemId: string }): StickyViewModel {
    const note = this.notes.find((n) => n.id === params.noteId)
    if (!note) throw new Error('Note not found')

    note.todos = note.todos.filter((t) => t.id !== params.itemId)
    note.updatedAt = Date.now()
    note.lastDeviceName = this.config.deviceName

    this.markNoteDirty(note.id)
    this.saveNotes()
    return this.toViewModel(note)
  }

  public deleteSticky(id: string): void {
    this.notes = this.notes.filter((n) => n.id !== id)
    delete this.config.stickies[id]
    delete this.config.syncMeta[id]

    this.archivePayload.deletedNoteIds[id] = Date.now()
    this.config.isArchiveDirty = true

    this.saveNotes()
    this.saveArchive()
    this.saveConfig()
  }

  public getAllArchivedLogs(): ArchivedTodoLog[] {
    return [...this.archivePayload.archivedLogs].sort((a, b) => b.completedAt - a.completedAt)
  }

  public getArchivePayload(): GistArchivePayload {
    return this.archivePayload
  }

  public uncompleteArchivedLog(logId: string): { targetNoteId: string; createdNewNote: boolean } {
    const idx = this.archivePayload.archivedLogs.findIndex((l) => l.id === logId)
    if (idx === -1) throw new Error('Archived log not found')

    const [log] = this.archivePayload.archivedLogs.splice(idx, 1)
    this.archivePayload.deletedLogIds[logId] = Date.now()
    this.config.isArchiveDirty = true

    let targetNote = this.notes.find((n) => n.id === log.sourceNoteId && n.type === 'todo')
    let createdNewNote = false

    if (!targetNote) {
      const now = Date.now()
      const newId = randomUUID()
      targetNote = {
        id: newId,
        type: 'todo',
        color: log.color,
        content: '',
        groupTitle: log.sourceGroupTitle || '할 일',
        todos: [],
        createdAt: now,
        updatedAt: now,
        lastDeviceName: this.config.deviceName
      }
      this.notes.push(targetNote)
      this.getWindowState(newId)
      createdNewNote = true
    }

    targetNote.todos.push({
      id: log.id,
      text: log.text,
      createdAt: log.createdAt
    })
    targetNote.updatedAt = Date.now()
    targetNote.lastDeviceName = this.config.deviceName
    delete this.archivePayload.deletedLogIds[logId]

    this.markNoteDirty(targetNote.id)
    this.saveNotes()
    this.saveArchive()
    this.saveConfig()

    return { targetNoteId: targetNote.id, createdNewNote }
  }

  public deleteArchivedLog(logId: string): void {
    this.archivePayload.archivedLogs = this.archivePayload.archivedLogs.filter((l) => l.id !== logId)
    this.archivePayload.deletedLogIds[logId] = Date.now()
    this.config.isArchiveDirty = true
    this.saveArchive()
    this.saveConfig()
  }

  public markNoteDirty(noteId: string): void {
    const existing = this.config.syncMeta[noteId]
    this.config.syncMeta[noteId] = {
      baseUpdatedAt: existing ? existing.baseUpdatedAt : 0,
      isDirty: true
    }
    this.saveConfig()
  }

  public markNoteSynced(noteId: string, syncedUpdatedAt: number): void {
    this.config.syncMeta[noteId] = {
      baseUpdatedAt: syncedUpdatedAt,
      isDirty: false
    }
    this.saveConfig()
  }

  public markArchiveSynced(): void {
    this.config.isArchiveDirty = false
    this.saveConfig()
  }

  public applyRemoteSync(params: {
    remoteNotes: Note[]
    remoteArchive: GistArchivePayload
  }): { createdNoteIds: string[]; deletedNoteIds: string[] } {
    const createdNoteIds: string[] = []
    const deletedNoteIds: string[] = []

    // 1. Merge deletedNoteIds tombstones
    const mergedDeletedNotes: Record<string, number> = {
      ...this.archivePayload.deletedNoteIds,
      ...(params.remoteArchive.deletedNoteIds || {})
    }
    if (
      Object.keys(mergedDeletedNotes).length !== Object.keys(this.archivePayload.deletedNoteIds).length
    ) {
      this.config.isArchiveDirty = true
    }
    this.archivePayload.deletedNoteIds = mergedDeletedNotes

    // Remove locally any notes that were deleted remotely
    for (const [delId, deletedAt] of Object.entries(mergedDeletedNotes)) {
      const localNote = this.notes.find((n) => n.id === delId)
      if (localNote && localNote.updatedAt <= deletedAt) {
        this.notes = this.notes.filter((n) => n.id !== delId)
        delete this.config.stickies[delId]
        delete this.config.syncMeta[delId]
        deletedNoteIds.push(delId)
      }
    }

    // 2. Merge deletedLogIds tombstones & archivedLogs (Union merge)
    const mergedDeletedLogs: Record<string, number> = {
      ...this.archivePayload.deletedLogIds,
      ...(params.remoteArchive.deletedLogIds || {})
    }
    this.archivePayload.deletedLogIds = mergedDeletedLogs

    const logMap = new Map<string, ArchivedTodoLog>()
    for (const log of params.remoteArchive.archivedLogs || []) {
      if (!mergedDeletedLogs[log.id]) {
        logMap.set(log.id, log)
      }
    }
    for (const log of this.archivePayload.archivedLogs) {
      if (!mergedDeletedLogs[log.id]) {
        logMap.set(log.id, log)
      }
    }
    this.archivePayload.archivedLogs = Array.from(logMap.values()).sort(
      (a, b) => b.completedAt - a.completedAt
    )

    // 3. Merge active notes with conflict backup creation (FN-SYS-03)
    for (const remoteNote of params.remoteNotes) {
      if (mergedDeletedNotes[remoteNote.id] && mergedDeletedNotes[remoteNote.id] >= remoteNote.updatedAt) {
        continue
      }

      const localIdx = this.notes.findIndex((n) => n.id === remoteNote.id)
      if (localIdx === -1) {
        if (this.notes.length < MAX_STICKIES) {
          this.notes.push(remoteNote)
          this.getWindowState(remoteNote.id)
          this.config.syncMeta[remoteNote.id] = {
            baseUpdatedAt: remoteNote.updatedAt,
            isDirty: false
          }
          createdNoteIds.push(remoteNote.id)
        }
        continue
      }

      const localNote = this.notes[localIdx]
      const meta = this.config.syncMeta[localNote.id] ?? {
        baseUpdatedAt: localNote.updatedAt,
        isDirty: false
      }

      const remoteChanged = remoteNote.updatedAt !== meta.baseUpdatedAt
      const isSamePayload =
        localNote.content === remoteNote.content &&
        localNote.groupTitle === remoteNote.groupTitle &&
        JSON.stringify(localNote.todos) === JSON.stringify(remoteNote.todos)

      if (!meta.isDirty && remoteChanged) {
        this.notes[localIdx] = remoteNote
        this.config.syncMeta[remoteNote.id] = {
          baseUpdatedAt: remoteNote.updatedAt,
          isDirty: false
        }
      } else if (meta.isDirty && remoteChanged && !isSamePayload) {
        const localIsNewer = localNote.updatedAt >= remoteNote.updatedAt
        const winner = localIsNewer ? localNote : remoteNote
        const loser = localIsNewer ? remoteNote : localNote

        this.notes[localIdx] = winner
        this.config.syncMeta[winner.id] = {
          baseUpdatedAt: remoteNote.updatedAt,
          isDirty: localIsNewer
        }

        if (this.notes.length < MAX_STICKIES) {
          const backupId = randomUUID()
          const backupNote: Note = {
            ...loser,
            id: backupId,
            content:
              loser.type === 'memo'
                ? `# [충돌 백업 - ${loser.lastDeviceName}]\n\n${loser.content}`
                : '',
            groupTitle:
              loser.type === 'todo'
                ? `[충돌 백업 - ${loser.lastDeviceName}] ${loser.groupTitle || '할 일'}`
                : '',
            updatedAt: Date.now()
          }
          this.notes.push(backupNote)
          this.getWindowState(backupId)
          this.config.syncMeta[backupId] = {
            baseUpdatedAt: 0,
            isDirty: true
          }
          createdNoteIds.push(backupId)
        }
      }
    }

    this.saveNotes()
    this.saveArchive()
    this.saveConfig()

    return { createdNoteIds, deletedNoteIds }
  }

  public exportBackupPayload(): {
    version: number
    exportedAt: number
    deviceName: string
    notes: Note[]
    archivedLogs: ArchivedTodoLog[]
  } {
    return {
      version: 1,
      exportedAt: Date.now(),
      deviceName: this.getDeviceName(),
      notes: this.notes,
      archivedLogs: this.archivePayload.archivedLogs
    }
  }

  public importBackupPayload(payload: {
    notes?: Note[]
    archivedLogs?: ArchivedTodoLog[]
  }): { importedNotesCount: number; importedLogsCount: number; newNoteIds: string[] } {
    let importedNotesCount = 0
    let importedLogsCount = 0
    const newNoteIds: string[] = []

    if (Array.isArray(payload.notes)) {
      for (const n of payload.notes) {
        if (!n || !n.id || !n.type) continue
        const existingIdx = this.notes.findIndex((item) => item.id === n.id)
        if (existingIdx >= 0) {
          if (n.updatedAt > this.notes[existingIdx].updatedAt) {
            this.notes[existingIdx] = n
            importedNotesCount++
          }
        } else {
          if (this.notes.length < MAX_STICKIES) {
            this.notes.push(n)
            this.getWindowState(n.id)
            newNoteIds.push(n.id)
            importedNotesCount++
          }
        }
      }
    }

    if (Array.isArray(payload.archivedLogs)) {
      for (const log of payload.archivedLogs) {
        if (!log || !log.id) continue
        const exists = this.archivePayload.archivedLogs.some((l) => l.id === log.id)
        if (!exists) {
          this.archivePayload.archivedLogs.push(log)
          importedLogsCount++
        }
      }
      this.archivePayload.archivedLogs.sort((a, b) => b.completedAt - a.completedAt)
    }

    if (importedNotesCount > 0) this.saveNotes()
    if (importedLogsCount > 0) this.saveArchive()
    this.saveConfig()

    return { importedNotesCount, importedLogsCount, newNoteIds }
  }
}
