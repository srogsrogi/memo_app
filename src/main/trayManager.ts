import { app, globalShortcut, Menu, nativeImage, Tray } from 'electron'
import { GistSyncEngine } from './gistSyncEngine'
import { LocalStore } from './localStore'
import { WindowManager } from './windowManager'

function createTrayIcon(): Electron.NativeImage {
  // 16x16 icon in PNG format (a bright yellow post-it square with dark pin dot)
  // Transparent background, rounded 14x14 box at (1,1) with color #FBC02D
  const width = 16
  const height = 16
  const canvas = Buffer.alloc(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (x >= 2 && x <= 13 && y >= 2 && y <= 13) {
        // Post-it yellow fill
        canvas[idx] = 251 // B
        canvas[idx + 1] = 192 // G
        canvas[idx + 2] = 45 // R
        canvas[idx + 3] = 255 // A

        // Draw small red pin dot at (7, 4)
        if (x >= 7 && x <= 8 && y >= 4 && y <= 5) {
          canvas[idx] = 40
          canvas[idx + 1] = 40
          canvas[idx + 2] = 220
          canvas[idx + 3] = 255
        }
      } else {
        canvas[idx] = 0
        canvas[idx + 1] = 0
        canvas[idx + 2] = 0
        canvas[idx + 3] = 0
      }
    }
  }

  return nativeImage.createFromBitmap(canvas, { width, height })
}

export class TrayManager {
  private tray: Tray | null = null
  private readonly store: LocalStore
  private readonly wm: WindowManager
  private readonly sync: GistSyncEngine

  constructor(store: LocalStore, wm: WindowManager, sync: GistSyncEngine) {
    this.store = store
    this.wm = wm
    this.sync = sync
  }

  public init(): void {
    const icon = createTrayIcon()
    this.tray = new Tray(icon)
    this.tray.setToolTip('StickyMemo - 메모 & 할 일')

    this.tray.on('click', () => {
      this.wm.openArchiveWindow()
    })

    this.updateContextMenu()

    // Register global shortcuts (FN-SYS-01)
    globalShortcut.register('CommandOrControl+Shift+N', () => {
      try {
        const note = this.store.createSticky({ type: 'memo', color: 'yellow' })
        this.wm.openSticky(note.id)
        this.wm.broadcastNotesChanged()
      } catch (err: unknown) {
        console.error('Failed to create memo from shortcut:', err)
      }
    })

    globalShortcut.register('CommandOrControl+Shift+T', () => {
      try {
        const note = this.store.createSticky({ type: 'todo', color: 'mint' })
        this.wm.openSticky(note.id)
        this.wm.broadcastNotesChanged()
      } catch (err: unknown) {
        console.error('Failed to create todo from shortcut:', err)
      }
    })
  }

  public updateContextMenu(): void {
    if (!this.tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '📝 새 메모 스티커 (Ctrl+Shift+N)',
        click: () => {
          try {
            const note = this.store.createSticky({ type: 'memo', color: 'yellow' })
            this.wm.openSticky(note.id)
            this.wm.broadcastNotesChanged()
          } catch (e: unknown) {
            console.error(e)
          }
        }
      },
      {
        label: '☑️ 새 할 일 스티커 (Ctrl+Shift+T)',
        click: () => {
          try {
            const note = this.store.createSticky({ type: 'todo', color: 'mint' })
            this.wm.openSticky(note.id)
            this.wm.broadcastNotesChanged()
          } catch (e: unknown) {
            console.error(e)
          }
        }
      },
      { type: 'separator' },
      {
        label: '👀 모든 스티커 숨기기 / 보이기',
        click: () => {
          this.wm.toggleHideAll()
        }
      },
      {
        label: '🗄️ 완료 아카이브 & 설정 열기',
        click: () => {
          this.wm.openArchiveWindow()
        }
      },
      {
        label: '🔄 지금 동기화',
        click: () => {
          this.sync.triggerSync()
        }
      },
      { type: 'separator' },
      {
        label: '✖ 앱 완전 종료',
        click: () => {
          // Force quit
          app.exit(0)
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public destroy(): void {
    globalShortcut.unregisterAll()
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
