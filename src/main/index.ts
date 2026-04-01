import log from 'electron-log/main'
log.initialize()
log.info('[app] Main process starting')

import { app, shell, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, getDatabase, closeDatabase } from './database'
import { getAllEntities, getEntityById, createEntity, updateEntity, deleteEntity, getEntityHistory } from './services/entities'
import { getApiKey, setApiKey, getApiKeyStatus } from './services/settings'
import { registerAiHandlers } from './services/ai'
import { registerNotesHandlers } from './services/notes'
import { applySession, getAllSessions, getSessionById, savePendingSession, listPendingSessions, getPendingSessionById, deletePendingSession } from './services/sessions'
import { saveDraft, getDrafts, getStoryById, discardDraft, applyStory, getAllAppliedStories } from './services/stories'
import type { EntityType, ProposedUpdate, NewEntityProposal } from '../shared/types'

// IPC handlers — registered before any BrowserWindow is created
ipcMain.handle('ping', () => 'pong')

ipcMain.handle('db:getVersion', () => {
  const db = getDatabase()
  return db.pragma('user_version', { simple: true })
})

ipcMain.handle('db:healthCheck', () => {
  try {
    const db = getDatabase()
    db.prepare('SELECT 1').get()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Entity IPC handlers
ipcMain.handle('entities:getAll', (_event, entityType: string) => {
  return getAllEntities(getDatabase(), entityType as EntityType)
})

ipcMain.handle('entities:getById', (_event, id: string) => {
  return getEntityById(getDatabase(), id)
})

ipcMain.handle('entities:create', (_event, entityType: string) => {
  return createEntity(getDatabase(), entityType as EntityType)
})

ipcMain.handle('entities:update', (_event, id: string, changes: Record<string, unknown>) => {
  return updateEntity(getDatabase(), id, changes)
})

ipcMain.handle('entities:delete', (_event, id: string) => {
  return deleteEntity(getDatabase(), id)
})

ipcMain.handle('entities:getHistory', (_event, entityId: string) => {
  return getEntityHistory(getDatabase(), entityId)
})

// Settings IPC handlers — use lazy evaluation for app.getPath('userData') and safeStorage
// (must be called after app.whenReady() resolves)
ipcMain.handle('settings:getApiKeyStatus', () => {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const canEncrypt = safeStorage.isEncryptionAvailable()
  if (!canEncrypt) {
    console.warn('[settings] safeStorage not available — API key stored in plain text')
  }
  const decryptFn = canEncrypt ? (buf: Buffer) => safeStorage.decryptString(buf) : undefined
  return getApiKeyStatus(settingsPath, decryptFn)
})

ipcMain.handle('settings:setApiKey', (_event, key: string) => {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const canEncrypt = safeStorage.isEncryptionAvailable()
  if (!canEncrypt) {
    console.warn('[settings] safeStorage not available — API key stored in plain text')
  }
  const encryptFn = canEncrypt ? (text: string) => safeStorage.encryptString(text) : undefined
  setApiKey(key, settingsPath, encryptFn)
  return { ok: true }
})

ipcMain.handle('settings:testApiKey', async () => {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const canEncrypt = safeStorage.isEncryptionAvailable()
  const decryptFn = canEncrypt ? (buf: Buffer) => safeStorage.decryptString(buf) : undefined
  const key = getApiKey(settingsPath, decryptFn)
  if (!key) return { ok: false, error: 'No API key configured' }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: key })
    await client.models.list()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// AI IPC handlers
registerAiHandlers(() => {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const canEncrypt = safeStorage.isEncryptionAvailable()
  const decryptFn = canEncrypt ? (buf: Buffer) => safeStorage.decryptString(buf) : undefined
  return getApiKey(settingsPath, decryptFn)
})

// Notes (Session Import) IPC handlers
registerNotesHandlers(() => {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const canEncrypt = safeStorage.isEncryptionAvailable()
  const decryptFn = canEncrypt ? (buf: Buffer) => safeStorage.decryptString(buf) : undefined
  return getApiKey(settingsPath, decryptFn)
})

// Session apply handler
ipcMain.handle('notes:applySession', (_event, params: { notes: string; entityUpdates: ProposedUpdate[]; newEntities: NewEntityProposal[] }) => {
  return applySession(getDatabase(), params)
})

// Stories IPC handlers
ipcMain.handle('stories:saveDraft', (_event, params: { prompt: string; storyText: string; contextEntityIds: string[]; proposedUpdates: unknown[] }) => {
  return saveDraft(getDatabase(), params as Parameters<typeof saveDraft>[1])
})
ipcMain.handle('stories:getDrafts', () => getDrafts(getDatabase()))
ipcMain.handle('stories:getById', (_event, id: string) => getStoryById(getDatabase(), id))
ipcMain.handle('stories:discardDraft', (_event, id: string) => discardDraft(getDatabase(), id))
ipcMain.handle('stories:applyStory', (_event, storyId: string, checkedUpdates: ProposedUpdate[]) => {
  return applyStory(getDatabase(), storyId, checkedUpdates)
})

// Archive IPC handlers (read-only)
ipcMain.handle('stories:getAll', () => {
  try {
    return getAllAppliedStories(getDatabase())
  } catch (err) {
    log.error('[ipc] stories:getAll failed', err)
    throw err
  }
})
ipcMain.handle('sessions:getAll', () => {
  try {
    return getAllSessions(getDatabase())
  } catch (err) {
    log.error('[ipc] sessions:getAll failed', err)
    throw err
  }
})
ipcMain.handle('sessions:getById', (_event, id: string) => {
  try {
    return getSessionById(getDatabase(), id)
  } catch (err) {
    log.error('[ipc] sessions:getById failed', err)
    throw err
  }
})

// Pending session draft IPC handlers (per D-07, D-09, D-10, D-13)
ipcMain.handle('sessions:savePendingDraft', (_event, params: { rawNotes: string; analysisText: string; entityUpdates: unknown[]; newEntities: unknown[] }) => {
  try {
    return savePendingSession(getDatabase(), params as Parameters<typeof savePendingSession>[1])
  } catch (err) {
    log.error('[ipc] sessions:savePendingDraft failed', err)
    throw err
  }
})
ipcMain.handle('sessions:listPendingDrafts', () => {
  try {
    return listPendingSessions(getDatabase())
  } catch (err) {
    log.error('[ipc] sessions:listPendingDrafts failed', err)
    throw err
  }
})
ipcMain.handle('sessions:getPendingDraftById', (_event, id: string) => {
  try {
    return getPendingSessionById(getDatabase(), id)
  } catch (err) {
    log.error('[ipc] sessions:getPendingDraftById failed', err)
    throw err
  }
})
ipcMain.handle('sessions:deletePendingDraft', (_event, id: string) => {
  try {
    return deletePendingSession(getDatabase(), id)
  } catch (err) {
    log.error('[ipc] sessions:deletePendingDraft failed', err)
    throw err
  }
})

function createWindow(): void {
  log.info('[win] creating BrowserWindow...')
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  console.log('[win] BrowserWindow created, id:', mainWindow.id)

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[win] did-fail-load:', code, desc)
  })
  mainWindow.webContents.on('dom-ready', () => console.log('[win] dom-ready'))
  mainWindow.webContents.on('did-finish-load', () => console.log('[win] did-finish-load'))
  mainWindow.on('show', () => console.log('[win] show event fired'))
  mainWindow.on('ready-to-show', () => console.log('[win] ready-to-show event fired'))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// WSL2: disable GPU acceleration (prevents renderer freeze) and force basic password store
// (avoids D-Bus/libsecret hang). Must be called before app.ready fires.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('password-store', 'basic')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.shadowrun.story-engine')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database before creating the window
  initDatabase()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their window to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})
