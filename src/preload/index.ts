import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  db: {
    getVersion: () => ipcRenderer.invoke('db:getVersion'),
    healthCheck: () => ipcRenderer.invoke('db:healthCheck')
  },
  entities: {
    getAll: (type: string) => ipcRenderer.invoke('entities:getAll', type),
    getById: (id: string) => ipcRenderer.invoke('entities:getById', id),
    create: (type: string) => ipcRenderer.invoke('entities:create', type),
    update: (id: string, changes: Record<string, unknown>) => ipcRenderer.invoke('entities:update', id, changes),
    delete: (id: string) => ipcRenderer.invoke('entities:delete', id),
    getHistory: (entityId: string) => ipcRenderer.invoke('entities:getHistory', entityId),
  },
  settings: {
    getApiKeyStatus: () => ipcRenderer.invoke('settings:getApiKeyStatus'),
    setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
    testApiKey: () => ipcRenderer.invoke('settings:testApiKey'),
  },
  ai: {
    startGeneration: (payload: { entityContext: string; userPrompt: string }) =>
      ipcRenderer.invoke('ai:startGeneration', payload),
    cancelGeneration: (requestId: string) =>
      ipcRenderer.invoke('ai:cancelGeneration', requestId),
    onChunk: (handler: (data: { requestId: string; text: string }) => void) => {
      const listener = (_: unknown, data: { requestId: string; text: string }): void => handler(data)
      ipcRenderer.on('ai:chunk', listener)
      return (): void => { ipcRenderer.removeListener('ai:chunk', listener) }
    },
    onDone: (handler: (data: { requestId: string; storyText: string; proposedUpdates: unknown[] }) => void) => {
      const listener = (_: unknown, data: { requestId: string; storyText: string; proposedUpdates: unknown[] }): void => handler(data)
      ipcRenderer.on('ai:done', listener)
      return (): void => { ipcRenderer.removeListener('ai:done', listener) }
    },
    onError: (handler: (data: { requestId: string; message: string }) => void) => {
      const listener = (_: unknown, data: { requestId: string; message: string }): void => handler(data)
      ipcRenderer.on('ai:error', listener)
      return (): void => { ipcRenderer.removeListener('ai:error', listener) }
    },
    onCancelled: (handler: (data: { requestId: string }) => void) => {
      const listener = (_: unknown, data: { requestId: string }): void => handler(data)
      ipcRenderer.on('ai:cancelled', listener)
      return (): void => { ipcRenderer.removeListener('ai:cancelled', listener) }
    },
  },
  stories: {
    saveDraft: (params: { prompt: string; storyText: string; contextEntityIds: string[]; proposedUpdates: unknown[] }) =>
      ipcRenderer.invoke('stories:saveDraft', params),
    getDrafts: () => ipcRenderer.invoke('stories:getDrafts'),
    getById: (id: string) => ipcRenderer.invoke('stories:getById', id),
    discardDraft: (id: string) => ipcRenderer.invoke('stories:discardDraft', id),
    applyStory: (storyId: string, checkedUpdates: unknown[]) =>
      ipcRenderer.invoke('stories:applyStory', storyId, checkedUpdates),
    getAll: () => ipcRenderer.invoke('stories:getAll'),
  },
  notes: {
    startImport: (payload: { notes: string }) =>
      ipcRenderer.invoke('notes:startImport', payload),
    cancelImport: (requestId: string) =>
      ipcRenderer.invoke('notes:cancelImport', requestId),
    onChunk: (handler: (data: { requestId: string; text: string }) => void) => {
      const listener = (_: unknown, data: { requestId: string; text: string }): void => handler(data)
      ipcRenderer.on('notes:chunk', listener)
      return (): void => { ipcRenderer.removeListener('notes:chunk', listener) }
    },
    onDone: (handler: (data: { requestId: string; analysisText: string; entityUpdates: unknown[]; newEntities: unknown[]; entityCount: number }) => void) => {
      const listener = (_: unknown, data: { requestId: string; analysisText: string; entityUpdates: unknown[]; newEntities: unknown[]; entityCount: number }): void => handler(data)
      ipcRenderer.on('notes:done', listener)
      return (): void => { ipcRenderer.removeListener('notes:done', listener) }
    },
    onError: (handler: (data: { requestId: string; message: string }) => void) => {
      const listener = (_: unknown, data: { requestId: string; message: string }): void => handler(data)
      ipcRenderer.on('notes:error', listener)
      return (): void => { ipcRenderer.removeListener('notes:error', listener) }
    },
    onCancelled: (handler: (data: { requestId: string }) => void) => {
      const listener = (_: unknown, data: { requestId: string }): void => handler(data)
      ipcRenderer.on('notes:cancelled', listener)
      return (): void => { ipcRenderer.removeListener('notes:cancelled', listener) }
    },
  },
  sessions: {
    applySession: (params: { notes: string; entityUpdates: unknown[]; newEntities: unknown[] }) =>
      ipcRenderer.invoke('notes:applySession', params),
    getAll: () => ipcRenderer.invoke('sessions:getAll'),
    getById: (id: string) => ipcRenderer.invoke('sessions:getById', id),
    savePendingDraft: (params: { rawNotes: string; analysisText: string; entityUpdates: unknown[]; newEntities: unknown[] }) =>
      ipcRenderer.invoke('sessions:savePendingDraft', params),
    listPendingDrafts: () => ipcRenderer.invoke('sessions:listPendingDrafts'),
    getPendingDraftById: (id: string) => ipcRenderer.invoke('sessions:getPendingDraftById', id),
    deletePendingDraft: (id: string) => ipcRenderer.invoke('sessions:deletePendingDraft', id),
  },
})
