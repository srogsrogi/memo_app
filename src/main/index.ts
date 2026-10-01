import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { GistSyncEngine } from './gistSyncEngine'
import { registerIpcHandlers } from './ipcHandlers'
import { LocalStore } from './localStore'
import { TrayManager } from './trayManager'
import { WindowManager } from './windowManager'

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let store: LocalStore
  let wm: WindowManager
  let sync: GistSyncEngine
  let tray: TrayManager

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.srogsrogi.hybridmemo')

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    store = new LocalStore()
    wm = new WindowManager(store)
    sync = new GistSyncEngine(store, wm)
    tray = new TrayManager(store, wm, sync)

    registerIpcHandlers(store, wm, sync)

    tray.init()
    wm.restoreAllStickies()
    sync.init()
  })

  // Prevent app from quitting when all windows are closed, stay in system tray (FN-SYS-01)
  app.on('window-all-closed', () => {
    // Keep running in system tray
  })

  app.on('second-instance', () => {
    // If user tries to launch another instance, focus/restore stickies or archive window
    wm.openArchiveWindow()
  })

  app.on('will-quit', () => {
    if (tray) tray.destroy()
    if (sync) sync.destroy()
  })
}
