import { app, powerMonitor } from 'electron'
import { GistArchivePayload, Note, SyncStatus } from '../shared/types'
import { LocalStore } from './localStore'
import { WindowManager } from './windowManager'

const GIST_DESCRIPTION = '[HybridMemoApp] Sync Store'
const GIST_ARCHIVE_FILE = 'todo-archive.json'

interface GitHubGistFile {
  filename?: string
  content?: string
  raw_url?: string
}

interface GitHubGistResponse {
  id: string
  description?: string
  updated_at?: string
  files: Record<string, GitHubGistFile | null>
}

export class GistSyncEngine {
  private readonly store: LocalStore
  private readonly wm: WindowManager
  private syncTimer: NodeJS.Timeout | null = null
  private debouncePushTimer: NodeJS.Timeout | null = null
  private currentStatus: SyncStatus = 'SYNCED'
  private statusMessage: string = ''
  private isSyncInProgress: boolean = false
  private knownRemoteFiles: Set<string> = new Set()
  private lastFocusPullAt: number = 0

  constructor(store: LocalStore, wm: WindowManager) {
    this.store = store
    this.wm = wm
  }

  public init(): void {
    // Schedule periodic pull every 10 seconds (was 60s)
    this.syncTimer = setInterval(() => {
      this.triggerSync()
    }, 10000)

    // OS sleep resume event
    powerMonitor.on('resume', () => {
      this.triggerSync()
    })

    // Immediate sync on window focus (throttled to 4s)
    app.on('browser-window-focus', () => {
      this.triggerThrottledPull()
    })

    // Initial sync
    setTimeout(() => {
      this.triggerSync()
    }, 1500)
  }

  public destroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer)
    if (this.debouncePushTimer) clearTimeout(this.debouncePushTimer)
  }

  public getStatus(): { status: SyncStatus; lastSyncedAt?: number; message?: string } {
    return {
      status: this.currentStatus,
      lastSyncedAt: this.store.getConfig().lastSyncedAt,
      message: this.statusMessage
    }
  }

  private setStatus(status: SyncStatus, message: string = ''): void {
    this.currentStatus = status
    this.statusMessage = message
    this.wm.broadcastSyncStatus({
      status,
      lastSyncedAt: this.store.getConfig().lastSyncedAt,
      message
    })
  }

  public triggerThrottledPull(): void {
    const now = Date.now()
    if (now - this.lastFocusPullAt < 4000) {
      return
    }
    this.lastFocusPullAt = now
    this.triggerSync()
  }

  public scheduleDebouncedPush(delayMs: number = 1500): void {
    if (this.debouncePushTimer) {
      clearTimeout(this.debouncePushTimer)
    }
    this.debouncePushTimer = setTimeout(() => {
      this.triggerSync()
    }, delayMs)
  }

  public async setupToken(token: string): Promise<{ success: boolean; gistId: string; username: string }> {
    const trimmed = token.trim()
    if (!trimmed) throw new Error('토큰을 입력해주세요.')

    // 1. Verify token
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'HybridStickyMemo-App'
      }
    })

    if (!userRes.ok) {
      throw new Error('유효하지 않은 GitHub 토큰입니다. (401 Unauthorized)')
    }

    const userData = (await userRes.json()) as { login: string }
    this.store.setGithubToken(trimmed)

    // 2. Search for existing Gist
    let targetGistId = ''
    const gistsRes = await fetch('https://api.github.com/gists?per_page=100', {
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'HybridStickyMemo-App'
      }
    })

    if (gistsRes.ok) {
      const gists = (await gistsRes.json()) as GitHubGistResponse[]
      const found = gists.find((g) => g.description === GIST_DESCRIPTION)
      if (found) {
        targetGistId = found.id
      }
    }

    // 3. Create new Gist if not found
    if (!targetGistId) {
      const initialPayload: Record<string, { content: string }> = {
        [GIST_ARCHIVE_FILE]: {
          content: JSON.stringify(this.store.getArchivePayload(), null, 2)
        }
      }
      for (const note of this.store.getRawNotes()) {
        initialPayload[`note-${note.id}.json`] = {
          content: JSON.stringify(note, null, 2)
        }
      }

      const createRes = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${trimmed}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'HybridStickyMemo-App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: GIST_DESCRIPTION,
          public: false,
          files: initialPayload
        })
      })

      if (!createRes.ok) {
        throw new Error('GitHub Gist 생성에 실패했습니다.')
      }

      const createdGist = (await createRes.json()) as GitHubGistResponse
      targetGistId = createdGist.id
    }

    this.store.setGistId(targetGistId)
    this.store.setLastSynced(Date.now())

    // Run first full sync
    setTimeout(() => {
      this.triggerSync()
    }, 500)

    return {
      success: true,
      gistId: targetGistId,
      username: userData.login
    }
  }

  public async triggerSync(): Promise<{ status: SyncStatus; syncedCount: number }> {
    const token = this.store.getGithubToken()
    const gistId = this.store.getConfig().gistId

    if (!token || !gistId) {
      return { status: 'OFFLINE', syncedCount: 0 }
    }

    if (this.isSyncInProgress) {
      return { status: this.currentStatus, syncedCount: 0 }
    }

    this.isSyncInProgress = true
    this.setStatus('SYNCING', '동기화 진행 중...')

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'HybridStickyMemo-App'
      }

      const lastEtag = this.store.getConfig().lastEtag
      if (lastEtag && this.knownRemoteFiles.size > 0) {
        headers['If-None-Match'] = lastEtag
      }

      // Step 1: Pull from Gist
      const pullRes = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'GET',
        headers
      })

      let remoteNotes: Note[] = []
      let remoteArchive: GistArchivePayload = {
        archivedLogs: [],
        deletedNoteIds: {},
        deletedLogIds: {}
      }

      if (pullRes.status === 200) {
        const etag = pullRes.headers.get('etag') || undefined
        const data = (await pullRes.json()) as GitHubGistResponse

        // Cache remote file list
        this.knownRemoteFiles = new Set(Object.keys(data.files || {}))

        for (const [filename, fileObj] of Object.entries(data.files || {})) {
          if (!fileObj || !fileObj.content) continue
          try {
            if (filename === GIST_ARCHIVE_FILE) {
              remoteArchive = JSON.parse(fileObj.content) as GistArchivePayload
            } else if (filename.startsWith('note-') && filename.endsWith('.json')) {
              const note = JSON.parse(fileObj.content) as Note
              remoteNotes.push(note)
            }
          } catch {
            // ignore JSON parse error on malformed file
          }
        }

        const { createdNoteIds, deletedNoteIds } = this.store.applyRemoteSync({
          remoteNotes,
          remoteArchive
        })

        // Open newly downloaded stickies, close deleted ones
        for (const id of createdNoteIds) {
          this.wm.openSticky(id)
        }
        for (const id of deletedNoteIds) {
          this.wm.closeStickyWindow(id)
        }

        this.store.setLastSynced(Date.now(), etag)
        this.wm.broadcastNotesChanged()
      } else if (pullRes.status === 304) {
        // Not modified, ETag matches
        this.store.setLastSynced(Date.now())
      } else if (pullRes.status === 401) {
        this.setStatus('ERROR', 'GitHub 토큰이 만료되었습니다.')
        this.isSyncInProgress = false
        return { status: 'ERROR', syncedCount: 0 }
      }

      // Step 2: Push local dirty files to Gist
      const filesPatch: Record<string, { content: string } | null> = {}
      const config = this.store.getConfig()
      let hasChangesToPush = false

      const activeNoteIds = new Set(this.store.getRawNotes().map((n) => n.id))

      // Ensure active notes are never in deletedNoteIds
      for (const activeId of activeNoteIds) {
        if (this.store.getArchivePayload().deletedNoteIds && this.store.getArchivePayload().deletedNoteIds[activeId]) {
          delete this.store.getArchivePayload().deletedNoteIds[activeId]
          this.store.getConfig().isArchiveDirty = true
        }
      }

      // Check dirty notes or notes missing from remote Gist
      for (const note of this.store.getRawNotes()) {
        const meta = config.syncMeta[note.id]
        const fileKey = `note-${note.id}.json`
        const isMissingFromRemote = this.knownRemoteFiles.size > 0 && !this.knownRemoteFiles.has(fileKey)
        if (!meta || meta.isDirty || isMissingFromRemote) {
          filesPatch[fileKey] = {
            content: JSON.stringify(note, null, 2)
          }
          hasChangesToPush = true
        }
      }

      // Check deleted notes - ONLY delete if not active locally and actually present in remote Gist!
      for (const deletedId of Object.keys(this.store.getArchivePayload().deletedNoteIds || {})) {
        if (activeNoteIds.has(deletedId)) continue
        const fileKey = `note-${deletedId}.json`
        if (this.knownRemoteFiles.has(fileKey)) {
          filesPatch[fileKey] = null
          hasChangesToPush = true
        }
      }

      // Check dirty archive
      if (config.isArchiveDirty) {
        filesPatch[GIST_ARCHIVE_FILE] = {
          content: JSON.stringify(this.store.getArchivePayload(), null, 2)
        }
        hasChangesToPush = true
      }

      if (hasChangesToPush) {
        const patchRes = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'HybridStickyMemo-App',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: GIST_DESCRIPTION,
            files: filesPatch
          })
        })

        if (!patchRes.ok) {
          const errText = await patchRes.text()
          console.error('[GistSync] PATCH failed:', patchRes.status, errText)
          this.setStatus('ERROR', `동기화 업로드 실패 (${patchRes.status})`)
          this.isSyncInProgress = false
          return { status: 'ERROR', syncedCount: 0 }
        }

        const patchedData = (await patchRes.json()) as GitHubGistResponse
        const newEtag = patchRes.headers.get('etag') || undefined

        if (patchedData.files) {
          this.knownRemoteFiles = new Set(Object.keys(patchedData.files))
        }

        for (const note of this.store.getRawNotes()) {
          this.store.markNoteSynced(note.id, note.updatedAt)
        }
        this.store.markArchiveSynced()
        this.store.setLastSynced(Date.now(), newEtag)
      }

      this.setStatus('SYNCED', '동기화 완료')
      this.isSyncInProgress = false
      return { status: 'SYNCED', syncedCount: Object.keys(filesPatch).length }
    } catch {
      this.setStatus('OFFLINE', '네트워크 오프라인 상태 (로컬 저장됨)')
      this.isSyncInProgress = false
      return { status: 'OFFLINE', syncedCount: 0 }
    }
  }
}
