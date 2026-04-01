import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { ProposedUpdate, NewEntityProposal, SessionRecord, PendingSessionRecord } from '../../shared/types'
import { getEntityById } from './entities'

export function applySession(
  db: Database.Database,
  params: {
    notes: string
    entityUpdates: ProposedUpdate[]
    newEntities: NewEntityProposal[]
  }
): { appliedCount: number; createdCount: number; sessionId: string } {
  const appliedEntityIds: string[] = []
  let sessionId = ''

  const insertHistory = db.prepare(`
    INSERT INTO entity_history (entity_id, field, old_value, new_value, reason, source, created_at)
    VALUES (?, ?, ?, ?, ?, 'session_import', ?)
  `)

  db.transaction(() => {
    const now = Math.floor(Date.now() / 1000)

    // 1. Create accepted new entities directly (NOT via IPC — direct DB insert per RESEARCH anti-pattern)
    for (const ne of params.newEntities) {
      const id = randomUUID()
      const tags = ne.tags ? JSON.stringify(ne.tags) : '[]'
      const status = ne.status || 'unknown'
      const description = ne.description || ''
      db.prepare(`
        INSERT INTO entities (id, type, name, status, tags, description, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)
      `).run(id, ne.entity_type, ne.entity_name, status, tags, description, now, now)

      // Insert history entry for new entity creation
      insertHistory.run(id, 'created', null, ne.entity_name, ne.reason, now)
      appliedEntityIds.push(id)
    }

    // 2. Apply accepted entity field updates (same pattern as applyStory)
    for (const update of params.entityUpdates) {
      const entity = getEntityById(db, update.entity_id)
      if (!entity) throw new Error(`Entity not found: ${update.entity_id}`)

      const oldValue = (entity as Record<string, unknown>)[update.field]
      const oldStr = Array.isArray(oldValue) ? JSON.stringify(oldValue) : String(oldValue ?? '')

      let dbValue: string = update.new_value
      if (update.field === 'tags') {
        // The AI delivers tags as a comma-separated string (e.g. "Shadowrunner, Drake, Changeling").
        // Split, trim, and merge with existing tags — deduplicating by value.
        const existingTags: string[] = Array.isArray(oldValue) ? (oldValue as string[]) : []
        const newTags: string[] = update.new_value
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0)
        const mergedTags = Array.from(new Set([...existingTags, ...newTags]))
        dbValue = JSON.stringify(mergedTags)
      } else if (update.field === 'description') {
        // Append new intel to the existing description rather than replacing it.
        const existingDesc = String(oldValue ?? '').trim()
        const newDesc = update.new_value.trim()
        if (existingDesc.length > 0 && newDesc.length > 0) {
          dbValue = `${existingDesc}\n\n${newDesc}`
        } else {
          dbValue = newDesc || existingDesc
        }
      }

      db.prepare(`UPDATE entities SET ${update.field} = ?, updated_at = ? WHERE id = ?`)
        .run(dbValue, now, update.entity_id)

      insertHistory.run(update.entity_id, update.field, oldStr, update.new_value, update.reason, now)
      if (!appliedEntityIds.includes(update.entity_id)) {
        appliedEntityIds.push(update.entity_id)
      }
    }

    // 3. Insert session record with title from first 60 chars of notes + date
    sessionId = randomUUID()
    const title = params.notes.slice(0, 60).replace(/\n/g, ' ') + ' \u2014 ' + new Date(now * 1000).toISOString().slice(0, 10)
    db.prepare(`
      INSERT INTO sessions (id, title, raw_notes, applied_entity_ids, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, title, params.notes, JSON.stringify(appliedEntityIds), now, now)
  })()

  return {
    appliedCount: params.entityUpdates.length,
    createdCount: params.newEntities.length,
    sessionId
  }
}

interface RawSessionRow {
  id: string
  title: string
  raw_notes: string
  applied_entity_ids: string
  date: number
  created_at: number
}

function parseSessionRow(row: RawSessionRow): SessionRecord {
  return {
    id: row.id,
    title: row.title,
    raw_notes: row.raw_notes,
    applied_entity_ids: JSON.parse(row.applied_entity_ids),
    date: row.date,
    created_at: row.created_at,
  }
}

export function getAllSessions(db: Database.Database): SessionRecord[] {
  const rows = db
    .prepare('SELECT * FROM sessions ORDER BY date DESC')
    .all() as RawSessionRow[]
  return rows.map(parseSessionRow)
}

export function getSessionById(db: Database.Database, id: string): SessionRecord | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as RawSessionRow | undefined
  if (!row) return null
  return parseSessionRow(row)
}

interface RawPendingSessionRow {
  id: string
  title: string
  raw_notes: string
  analysis_text: string
  entity_updates: string  // JSON
  new_entities: string    // JSON
  created_at: number
}

function parsePendingSessionRow(row: RawPendingSessionRow): PendingSessionRecord {
  return {
    id: row.id,
    title: row.title,
    raw_notes: row.raw_notes,
    analysis_text: row.analysis_text,
    entity_updates: JSON.parse(row.entity_updates),
    new_entities: JSON.parse(row.new_entities),
    created_at: row.created_at,
  }
}

export function savePendingSession(
  db: Database.Database,
  params: {
    rawNotes: string
    analysisText: string
    entityUpdates: ProposedUpdate[]
    newEntities: NewEntityProposal[]
  }
): PendingSessionRecord {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const title = params.rawNotes.slice(0, 60).replace(/\n/g, ' ') +
    ' \u2014 ' + new Date(now * 1000).toISOString().slice(0, 10)
  db.prepare(`
    INSERT INTO pending_sessions
      (id, title, raw_notes, analysis_text, entity_updates, new_entities, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title, params.rawNotes, params.analysisText,
    JSON.stringify(params.entityUpdates),
    JSON.stringify(params.newEntities),
    now
  )
  return getPendingSessionById(db, id)!
}

export function listPendingSessions(db: Database.Database): PendingSessionRecord[] {
  const rows = db
    .prepare('SELECT * FROM pending_sessions ORDER BY created_at DESC')
    .all() as RawPendingSessionRow[]
  return rows.map(parsePendingSessionRow)
}

export function getPendingSessionById(db: Database.Database, id: string): PendingSessionRecord | null {
  const row = db.prepare('SELECT * FROM pending_sessions WHERE id = ?').get(id) as RawPendingSessionRow | undefined
  if (!row) return null
  return parsePendingSessionRow(row)
}

export function deletePendingSession(db: Database.Database, id: string): { ok: boolean } {
  db.prepare('DELETE FROM pending_sessions WHERE id = ?').run(id)
  return { ok: true }
}
