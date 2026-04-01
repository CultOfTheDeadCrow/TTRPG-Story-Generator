export type EntityType = 'character' | 'location' | 'event'

export type CharacterStatus = 'active' | 'inactive' | 'dead' | 'unknown'
export type LocationStatus = 'secure' | 'hostile' | 'neutral' | 'unknown'
export type EventStatus = 'ongoing' | 'resolved' | 'past'
export type EntityStatus = CharacterStatus | LocationStatus | EventStatus

export const CHARACTER_STATUSES: CharacterStatus[] = ['active', 'inactive', 'dead', 'unknown']
export const LOCATION_STATUSES: LocationStatus[] = ['secure', 'hostile', 'neutral', 'unknown']
export const EVENT_STATUSES: EventStatus[] = ['ongoing', 'resolved', 'past']

export const STATUS_OPTIONS: Record<EntityType, readonly string[]> = {
  character: CHARACTER_STATUSES,
  location: LOCATION_STATUSES,
  event: EVENT_STATUSES,
}

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  inactive: 'bg-zinc-400',
  dead: 'bg-red-500',
  unknown: 'bg-yellow-400',
  secure: 'bg-green-500',
  hostile: 'bg-red-500',
  neutral: 'bg-zinc-400',
  ongoing: 'bg-blue-500',
  resolved: 'bg-green-500',
  past: 'bg-zinc-400',
}

export type HistorySource = 'manual_edit' | 'story_generation' | 'session_import'

export type StoryStatus = 'draft' | 'applied'

export interface ProposedUpdate {
  entity_id: string
  entity_name: string
  entity_type: string
  field: string
  new_value: string
  reason: string
  contradictionNote?: string
}

export interface NewEntityProposal {
  tempKey: string           // 'new:${index}' — assigned at parse time
  entity_name: string
  entity_type: string       // 'character' | 'location' | 'event'
  status?: string
  tags?: string[]
  description?: string
  reason: string
}

export interface SessionRecord {
  id: string
  title: string
  raw_notes: string
  applied_entity_ids: string[]
  date: number
  created_at: number
}

export interface PendingSessionRecord {
  id: string
  title: string
  raw_notes: string
  analysis_text: string
  entity_updates: ProposedUpdate[]
  new_entities: NewEntityProposal[]
  created_at: number
}

export interface StoryRecord {
  id: string
  prompt: string
  story_text: string
  context_entity_ids: string[]
  proposed_updates: ProposedUpdate[]
  status: StoryStatus
  created_at: number
  applied_at: number | null
}

export interface Entity {
  id: string
  type: EntityType
  name: string
  status: EntityStatus
  tags: string[]
  description: string
  notes: string
  created_at: number
  updated_at: number
}

export interface EntityHistoryEntry {
  id: number
  entity_id: string
  field: string
  old_value: string | null
  new_value: string | null
  reason: string | null
  source: HistorySource
  created_at: number
}

export type ViewType = 'characters' | 'locations' | 'events' | 'story-generator' | 'story-drafts' | 'session-import' | 'pending-sessions' | 'story-archive' | 'session-archive' | 'settings'

export interface NavigationState {
  view: ViewType
  selectedEntityId: string | null
}
