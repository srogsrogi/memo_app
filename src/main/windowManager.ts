import { BrowserWindow, screen, shell } from 'electron'
import * as path from 'path'
import { is } from '@electron-toolkit/utils'
import {
  COLLAPSED_HEIGHT,
  DEFAULT_STICKY_HEIGHT,
  DEFAULT_STICKY_WIDTH,
  NotesChangedPayload,
  StickyWindowState,
  SyncStatusChangedPayload
} from '../shared/types'
import { LocalStore } from './localStore'

export class WindowManager {
  private readonly store: LocalStore
  private stickyWindows: Map<string, BrowserWindow> = new Map()
  private archiveWindow: BrowserWindow | null = null
  private areStickiesHidden: boolean = false
  private boundsDebounceTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(store: LocalStore) {
    this.store = store
  }

  private getPreloadPath(): string {
    return path.join(__dirname, '../preload/index.js')
  }

  private getAppIconPath(): string {
    return path.join(__dirname, '../../resources/icon.png')
  }

  private loadWindowUrl(win: BrowserWindow, queryParams: Record<string, string>): void {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = new URL(process.env['ELECTRON_RENDERER_URL'])
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value)
      }
      win.loadURL(url.toString())
    } else {
      win.loadFile(path.join(__dirname, '../renderer/index.html'), {
        query: queryParams
      })
    }
  }

  private clampBoundsToScreen(bounds: StickyWindowState): StickyWindowState {
    const displays = screen.getAllDisplays()
    let isInside = false

    for (const d of displays) {
      const { x, y, width, height } = d.workArea
      if (
        bounds.x >= x - 50 &&
        bounds.x <= x + width - 50 &&
        bounds.y >= y - 50 &&
        bounds.y <= y + height - 50
      ) {
        isInside = true
        break
      }
    }

    if (!isInside) {
      const primary = screen.getPrimaryDisplay().workArea
      return {
        ...bounds,
        x: Math.max(primary.x + 20, Math.min(bounds.x, primary.x + primary.width - bounds.width - 20)),
        y: Math.max(primary.y + 20, Math.min(bounds.y, primary.y + primary.height - bounds.height - 20))
      }
    }
    return bounds
  }

  private calculateSnapPosition(
    noteId: string,
    currentX: number,
    currentY: number,
    width: number,
    height: number
  ): { x: number; y: number } {
    const SNAP_THRESHOLD = 14
    let snappedX = currentX
    let snappedY = currentY

    // 1. Snap to screen edges
    const displays = screen.getAllDisplays()
    for (const d of displays) {
      const { x, y, width: screenW, height: screenH } = d.workArea
      if (Math.abs(snappedX - x) <= SNAP_THRESHOLD) snappedX = x
      if (Math.abs(snappedX + width - (x + screenW)) <= SNAP_THRESHOLD) snappedX = x + screenW - width
      if (Math.abs(snappedY - y) <= SNAP_THRESHOLD) snappedY = y
      if (Math.abs(snappedY + height - (y + screenH)) <= SNAP_THRESHOLD) snappedY = y + screenH - height
    }

    // 2. Snap to other open sticky windows
    for (const [otherId, otherWin] of this.stickyWindows.entries()) {
      if (otherId === noteId || otherWin.isDestroyed() || !otherWin.isVisible()) continue
      const [ox, oy] = otherWin.getPosition()
      const [ow, oh] = otherWin.getSize()

      // Horizontal magnetic snaps
      if (Math.abs(snappedX + width - ox) <= SNAP_THRESHOLD) snappedX = ox - width
      if (Math.abs(snappedX - (ox + ow)) <= SNAP_THRESHOLD) snappedX = ox + ow
      if (Math.abs(snappedX - ox) <= SNAP_THRESHOLD) snappedX = ox
      if (Math.abs(snappedX + width - (ox + ow)) <= SNAP_THRESHOLD) snappedX = ox + ow - width

      // Vertical magnetic snaps
      if (Math.abs(snappedY + height - oy) <= SNAP_THRESHOLD) snappedY = oy - height
      if (Math.abs(snappedY - (oy + oh)) <= SNAP_THRESHOLD) snappedY = oy + oh
      if (Math.abs(snappedY - oy) <= SNAP_THRESHOLD) snappedY = oy
      if (Math.abs(snappedY + height - (oy + oh)) <= SNAP_THRESHOLD) snappedY = oy + oh - height
    }

    return { x: snappedX, y: snappedY }
  }

  public openSticky(noteId: string): BrowserWindow {
    const existing = this.stickyWindows.get(noteId)
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore()
      existing.show()
      existing.focus()
      return existing
    }

    const note = this.store.getById(noteId)
    if (!note) throw new Error(`Note ${noteId} not found`)

    const rawBounds = this.store.getWindowState(noteId)
    const bounds = this.clampBoundsToScreen(rawBounds)

    const winHeight = bounds.isCollapsed ? COLLAPSED_HEIGHT : bounds.height || DEFAULT_STICKY_HEIGHT
    const winWidth = bounds.width || DEFAULT_STICKY_WIDTH

    const win = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: winWidth,
      height: winHeight,
      minWidth: 220,
      minHeight: bounds.isCollapsed ? COLLAPSED_HEIGHT : 160,
      maxHeight: bounds.isCollapsed ? COLLAPSED_HEIGHT : undefined,
      frame: false,
      transparent: false,
      hasShadow: true,
      skipTaskbar: false,
      resizable: !bounds.isCollapsed,
      alwaysOnTop: bounds.alwaysOnTop,
      icon: this.getAppIconPath(),
      webPreferences: {
        preload: this.getPreloadPath(),
        sandbox: false,
        contextIsolation: true
      }
    })

    if (bounds.alwaysOnTop) {
      win.setAlwaysOnTop(true, 'floating')
    }

    this.stickyWindows.set(noteId, win)

    const handleBoundsChange = (): void => {
      if (win.isDestroyed()) return
      const timer = this.boundsDebounceTimers.get(noteId)
      if (timer) clearTimeout(timer)

      this.boundsDebounceTimers.set(
        noteId,
        setTimeout(() => {
          if (win.isDestroyed()) return
          const [currentX, currentY] = win.getPosition()
          const [currentW, currentH] = win.getSize()
          const current = this.store.getWindowState(noteId)

          const snapped = this.calculateSnapPosition(noteId, currentX, currentY, currentW, currentH)
          if (snapped.x !== currentX || snapped.y !== currentY) {
            win.setPosition(snapped.x, snapped.y)
          }

          this.store.setWindowState(noteId, {
            x: snapped.x,
            y: snapped.y,
            width: currentW,
            height: current.isCollapsed ? current.height : currentH
          })
        }, 250)
      )
    }

    win.on('move', handleBoundsChange)
    win.on('resize', handleBoundsChange)

    win.on('closed', () => {
      this.stickyWindows.delete(noteId)
      const timer = this.boundsDebounceTimers.get(noteId)
      if (timer) clearTimeout(timer)
    })

    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    this.loadWindowUrl(win, {
      window: 'sticky',
      id: noteId
    })

    return win
  }

  public closeStickyWindow(noteId: string): void {
    const win = this.stickyWindows.get(noteId)
    if (win && !win.isDestroyed()) {
      win.close()
    }
    this.stickyWindows.delete(noteId)
  }

  public toggleAlwaysOnTop(noteId: string): boolean {
    const current = this.store.getWindowState(noteId)
    const next = !current.alwaysOnTop
    this.store.setWindowState(noteId, { alwaysOnTop: next })

    const win = this.stickyWindows.get(noteId)
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(next, 'floating')
    }
    this.broadcastNotesChanged()
    return next
  }

  public toggleCollapse(noteId: string): boolean {
    const current = this.store.getWindowState(noteId)
    const next = !current.isCollapsed
    const win = this.stickyWindows.get(noteId)

    this.store.setWindowState(noteId, { isCollapsed: next })

    if (win && !win.isDestroyed()) {
      if (next) {
        win.setResizable(false)
        win.setMaximumSize(10000, COLLAPSED_HEIGHT)
        win.setMinimumSize(220, COLLAPSED_HEIGHT)
        win.setSize(current.width, COLLAPSED_HEIGHT, true)
      } else {
        win.setMaximumSize(10000, 10000)
        win.setMinimumSize(220, 160)
        win.setSize(current.width, current.height || DEFAULT_STICKY_HEIGHT, true)
        win.setResizable(true)
      }
    }
    this.broadcastNotesChanged()
    return next
  }

  public toggleHideAll(): boolean {
    this.areStickiesHidden = !this.areStickiesHidden
    for (const win of this.stickyWindows.values()) {
      if (!win.isDestroyed()) {
        if (this.areStickiesHidden) {
          win.hide()
        } else {
          win.show()
        }
      }
    }
    return this.areStickiesHidden
  }

  public focusSticky(noteId: string): void {
    const win = this.stickyWindows.get(noteId)
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  }

  public openArchiveWindow(): BrowserWindow {
    if (this.archiveWindow && !this.archiveWindow.isDestroyed()) {
      if (this.archiveWindow.isMinimized()) this.archiveWindow.restore()
      this.archiveWindow.show()
      this.archiveWindow.focus()
      return this.archiveWindow
    }

    const primary = screen.getPrimaryDisplay().workArea
    const width = 420
    const height = 540
    const x = Math.round(primary.x + primary.width - width - 40)
    const y = Math.round(primary.y + primary.height - height - 40)

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      minWidth: 360,
      minHeight: 460,
      frame: false,
      resizable: true,
      hasShadow: true,
      skipTaskbar: false,
      alwaysOnTop: true,
      icon: this.getAppIconPath(),
      webPreferences: {
        preload: this.getPreloadPath(),
        sandbox: false,
        contextIsolation: true
      }
    })

    win.setAlwaysOnTop(true, 'floating')

    win.on('closed', () => {
      this.archiveWindow = null
    })

    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    this.loadWindowUrl(win, {
      window: 'archive'
    })

    this.archiveWindow = win
    return win
  }

  public closeArchiveWindow(): void {
    if (this.archiveWindow && !this.archiveWindow.isDestroyed()) {
      this.archiveWindow.close()
    }
    this.archiveWindow = null
  }

  public restoreAllStickies(): void {
    const stickies = this.store.getAllStickies()
    if (stickies.length === 0) {
      // First run: create 1 default memo sticky
      const primary = screen.getPrimaryDisplay().workArea
      const defaultNote = this.store.createSticky({
        type: 'memo',
        color: 'yellow',
        initialContent: ''
      })
      this.store.setWindowState(defaultNote.id, {
        x: Math.round(primary.x + (primary.width - DEFAULT_STICKY_WIDTH) / 2),
        y: Math.round(primary.y + (primary.height - DEFAULT_STICKY_HEIGHT) / 2)
      })
      this.openSticky(defaultNote.id)
    } else {
      for (const s of stickies) {
        this.openSticky(s.id)
      }
    }
  }

  public broadcastNotesChanged(): void {
    const payload: NotesChangedPayload = {
      stickies: this.store.getAllStickies(),
      archivedLogs: this.store.getAllArchivedLogs()
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('notes:changed', payload)
      }
    }
  }

  public broadcastSyncStatus(payload: SyncStatusChangedPayload): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('sync:statusChanged', payload)
      }
    }
  }
}
