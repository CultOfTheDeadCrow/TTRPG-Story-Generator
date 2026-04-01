import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProposedUpdate, NewEntityProposal, PendingSessionRecord } from '../../../../shared/types'

interface UseSessionImportResult {
  analysisText: string
  entityUpdates: ProposedUpdate[]
  newEntities: NewEntityProposal[]
  entityCount: number
  isAnalyzing: boolean
  error: string | null
  autoSaveError: string | null
  pendingDraftId: string | null
  startImport: (notes: string) => Promise<void>
  cancel: () => void
  reset: () => void
  reanalyze: () => Promise<void>
  loadPendingDraft: (draft: PendingSessionRecord) => void
}

export function useSessionImport(): UseSessionImportResult {
  const [analysisText, setAnalysisText] = useState('')
  const [entityUpdates, setEntityUpdates] = useState<ProposedUpdate[]>([])
  const [newEntities, setNewEntities] = useState<NewEntityProposal[]>([])
  const [entityCount, setEntityCount] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null)
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const notesRef = useRef<string>('')

  useEffect(() => {
    const removeChunk = window.electronAPI.notes.onChunk(({ requestId, text }) => {
      if (requestId !== requestIdRef.current) return
      setAnalysisText(prev => prev + text)
    })
    const removeDone = window.electronAPI.notes.onDone(async ({ requestId, analysisText: fullText, entityUpdates: updates, newEntities: newEnts, entityCount: count }) => {
      if (requestId !== requestIdRef.current) return
      setAnalysisText(fullText)
      setEntityUpdates(updates as ProposedUpdate[])
      setNewEntities(newEnts as NewEntityProposal[])
      setEntityCount(count)
      setIsAnalyzing(false)
      requestIdRef.current = null

      // Auto-save as pending draft (D-07)
      try {
        const draft = await window.electronAPI.sessions.savePendingDraft({
          rawNotes: notesRef.current,
          analysisText: fullText,
          entityUpdates: updates as ProposedUpdate[],
          newEntities: newEnts as NewEntityProposal[],
        })
        setPendingDraftId(draft.id)
      } catch (err) {
        console.error('[useSessionImport] auto-save failed:', err)
        setAutoSaveError('Draft auto-save failed. You can still apply changes immediately.')
      }
    })
    const removeError = window.electronAPI.notes.onError(({ requestId, message }) => {
      if (requestId !== requestIdRef.current) return
      setError(message)
      setIsAnalyzing(false)
      requestIdRef.current = null
    })
    const removeCancelled = window.electronAPI.notes.onCancelled(({ requestId }) => {
      if (requestId !== requestIdRef.current) return
      setIsAnalyzing(false)
      requestIdRef.current = null
    })
    return () => { removeChunk(); removeDone(); removeError(); removeCancelled() }
  }, [])

  const startImport = useCallback(async (notes: string) => {
    notesRef.current = notes
    setAnalysisText('')
    setEntityUpdates([])
    setNewEntities([])
    setError(null)
    setIsAnalyzing(true)
    setPendingDraftId(null)
    setAutoSaveError(null)
    const result = await window.electronAPI.notes.startImport({ notes })
    if ('error' in result) {
      setError(result.error)
      setIsAnalyzing(false)
      return
    }
    requestIdRef.current = result.requestId
    setEntityCount(result.entityCount)
  }, [])

  const cancel = useCallback(() => {
    if (requestIdRef.current) {
      window.electronAPI.notes.cancelImport(requestIdRef.current)
    }
  }, [])

  const reset = useCallback(() => {
    setAnalysisText('')
    setEntityUpdates([])
    setNewEntities([])
    setError(null)
    setIsAnalyzing(false)
    setEntityCount(0)
    requestIdRef.current = null
    setPendingDraftId(null)
    setAutoSaveError(null)
  }, [])

  const reanalyze = useCallback(async () => {
    if (pendingDraftId) {
      try {
        await window.electronAPI.sessions.deletePendingDraft(pendingDraftId)
      } catch (err) {
        console.error('[useSessionImport] delete draft on reanalyze failed:', err)
      }
    }
    setPendingDraftId(null)
    setAutoSaveError(null)
    setAnalysisText('')
    setEntityUpdates([])
    setNewEntities([])
    setError(null)
    setIsAnalyzing(false)
    setEntityCount(0)
    requestIdRef.current = null
  }, [pendingDraftId])

  const loadPendingDraft = useCallback((draft: PendingSessionRecord) => {
    setAnalysisText(draft.analysis_text)
    setEntityUpdates(draft.entity_updates)
    setNewEntities(draft.new_entities)
    setPendingDraftId(draft.id)
    notesRef.current = draft.raw_notes
    setIsAnalyzing(false)
    setError(null)
    setAutoSaveError(null)
  }, [])

  return {
    analysisText,
    entityUpdates,
    newEntities,
    entityCount,
    isAnalyzing,
    error,
    autoSaveError,
    pendingDraftId,
    startImport,
    cancel,
    reset,
    reanalyze,
    loadPendingDraft,
  }
}
