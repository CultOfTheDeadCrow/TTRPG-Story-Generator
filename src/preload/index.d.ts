import type { Entity, EntityType, EntityHistoryEntry, ProposedUpdate, StoryRecord, SessionRecord, NewEntityProposal, PendingSessionRecord } from '../shared/types'

export interface ElectronAPI {
  ping: () => Promise<string>
  db: {
    getVersion: () => Promise<number>
    healthCheck: () => Promise<{ ok: boolean; error?: string }>
  }
  entities: {
    getAll: (type: EntityType) => Promise<Entity[]>
    getById: (id: string) => Promise<Entity | null>
    create: (type: EntityType) => Promise<Entity>
    update: (id: string, changes: Partial<Omit<Entity, 'id' | 'type' | 'created_at'>>) => Promise<Entity>
    delete: (id: string) => Promise<{ ok: boolean }>
    getHistory: (entityId: string) => Promise<EntityHistoryEntry[]>
  }
  settings: {
    getApiKeyStatus: () => Promise<{ configured: boolean }>
    setApiKey: (key: string) => Promise<{ ok: boolean }>
    testApiKey: () => Promise<{ ok: boolean; error?: string }>
  }
  ai: {
    startGeneration: (payload: { entityContext: string; userPrompt: string }) => Promise<{ requestId: string } | { error: string }>
    cancelGeneration: (requestId: string) => Promise<{ ok: boolean }>
    onChunk: (handler: (data: { requestId: string; text: string }) => void) => () => void
    onDone: (handler: (data: { requestId: string; storyText: string; proposedUpdates: ProposedUpdate[] }) => void) => () => void
    onError: (handler: (data: { requestId: string; message: string }) => void) => () => void
    onCancelled: (handler: (data: { requestId: string }) => void) => () => void
  }
  stories: {
    saveDraft: (params: { prompt: string; storyText: string; contextEntityIds: string[]; proposedUpdates: ProposedUpdate[] }) => Promise<StoryRecord>
    getDrafts: () => Promise<StoryRecord[]>
    getById: (id: string) => Promise<StoryRecord | null>
    discardDraft: (id: string) => Promise<{ ok: boolean }>
    applyStory: (storyId: string, checkedUpdates: ProposedUpdate[]) => Promise<void>
    getAll: () => Promise<StoryRecord[]>
  }
  notes: {
    startImport: (payload: { notes: string }) => Promise<{ requestId: string; entityCount: number } | { error: string }>
    cancelImport: (requestId: string) => Promise<{ ok: boolean }>
    onChunk: (handler: (data: { requestId: string; text: string }) => void) => () => void
    onDone: (handler: (data: { requestId: string; analysisText: string; entityUpdates: unknown[]; newEntities: unknown[]; entityCount: number }) => void) => () => void
    onError: (handler: (data: { requestId: string; message: string }) => void) => () => void
    onCancelled: (handler: (data: { requestId: string }) => void) => () => void
  }
  sessions: {
    applySession: (params: { notes: string; entityUpdates: ProposedUpdate[]; newEntities: NewEntityProposal[] }) => Promise<{ appliedCount: number; createdCount: number; sessionId: string }>
    getAll: () => Promise<SessionRecord[]>
    getById: (id: string) => Promise<SessionRecord | null>
    savePendingDraft: (params: {
      rawNotes: string; analysisText: string;
      entityUpdates: ProposedUpdate[]; newEntities: NewEntityProposal[]
    }) => Promise<PendingSessionRecord>
    listPendingDrafts: () => Promise<PendingSessionRecord[]>
    getPendingDraftById: (id: string) => Promise<PendingSessionRecord | null>
    deletePendingDraft: (id: string) => Promise<{ ok: boolean }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
