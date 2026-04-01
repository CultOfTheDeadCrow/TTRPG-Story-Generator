import { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { Badge } from '@renderer/components/ui/badge'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@renderer/components/ui/resizable'
import { WarningBanner } from './WarningBanner'
import { DiffReview } from './DiffReview'
import { useSessionImport } from '../hooks/useSessionImport'

interface SessionImportScreenProps {
  apiKeyConfigured: boolean
  onEntityListRefresh: () => void
  pendingDraftId?: string | null
}

export function SessionImportScreen({ apiKeyConfigured, onEntityListRefresh, pendingDraftId }: SessionImportScreenProps): JSX.Element {
  const [notes, setNotes] = useState('')
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    analysisText,
    entityUpdates,
    newEntities,
    entityCount,
    isAnalyzing,
    error,
    autoSaveError,
    pendingDraftId: hookPendingDraftId,
    startImport,
    cancel,
    reset,
    reanalyze,
    loadPendingDraft,
  } = useSessionImport()

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Draft restore on mount (D-10)
  useEffect(() => {
    if (pendingDraftId && pendingDraftId !== hookPendingDraftId) {
      window.electronAPI.sessions.getPendingDraftById(pendingDraftId).then(draft => {
        if (draft) {
          setNotes(draft.raw_notes)
          loadPendingDraft(draft)
        }
      }).catch(console.error)
    }
  }, [pendingDraftId])

  // Derived state
  const analysisComplete = !isAnalyzing && (entityUpdates.length > 0 || newEntities.length > 0 || (analysisText.length > 0 && hookPendingDraftId !== null))
  const isDraftMode = hookPendingDraftId !== null
  const notesReadOnly = isAnalyzing || analysisComplete

  // Calculate accepted count
  const allKeys = [
    ...entityUpdates.map(u => `${u.entity_id}:${u.field}`),
    ...newEntities.flatMap(ne => {
      const fields = ['name', 'type']
      if (ne.status) fields.push('status')
      if (ne.description) fields.push('description')
      if (ne.tags && ne.tags.length > 0) fields.push('tags')
      return fields.map(f => `${ne.tempKey}:${f}`)
    })
  ]
  const acceptedCount = allKeys.filter(k => accepted[k] ?? true).length

  const hasProposals = entityUpdates.length > 0 || newEntities.length > 0
  const hasOutput = analysisText.length > 0 || hasProposals

  async function handleApply(): Promise<void> {
    const checkedUpdates = entityUpdates.filter(u => accepted[`${u.entity_id}:${u.field}`] !== false)
    const checkedNewEntities = newEntities.filter(ne => {
      const fields = ['name', 'type']
      if (ne.status) fields.push('status')
      if (ne.description) fields.push('description')
      if (ne.tags && ne.tags.length > 0) fields.push('tags')
      return fields.some(f => accepted[`${ne.tempKey}:${f}`] !== false)
    })
    const result = await window.electronAPI.sessions.applySession({
      notes,
      entityUpdates: checkedUpdates,
      newEntities: checkedNewEntities,
    })
    // Delete pending draft if this was a draft-mode apply (D-12)
    if (hookPendingDraftId) {
      try {
        await window.electronAPI.sessions.deletePendingDraft(hookPendingDraftId)
      } catch (err) {
        console.error('[SessionImportScreen] delete draft after apply failed:', err)
      }
    }
    setSuccessMessage(`${result.appliedCount} updates applied, ${result.createdCount} entities created`)
    setNotes('')
    setAccepted({})
    reset()
    onEntityListRefresh()
  }

  async function handleDiscard(): Promise<void> {
    if (hookPendingDraftId) {
      try {
        await window.electronAPI.sessions.deletePendingDraft(hookPendingDraftId)
      } catch (err) {
        console.error('[SessionImportScreen] discard failed:', err)
      }
    }
    setNotes('')
    setAccepted({})
    reset()
  }

  async function handleReanalyze(): Promise<void> {
    await reanalyze()
    setAccepted({})
    // notes stay — GM can edit and re-submit
  }

  return (
    <div className="h-full w-full overflow-hidden">
      {!apiKeyConfigured && <div className="p-4"><WarningBanner /></div>}
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize="50%" minSize="20%" maxSize="80%">
          {/* LEFT PANEL: Session notes */}
          <div className="h-full overflow-y-auto p-4 space-y-4">
            {isDraftMode && (
              <Badge variant="secondary">Pending Session</Badge>
            )}
            {notesReadOnly && !isAnalyzing && (
              <Button variant="outline" size="sm" onClick={() => void handleReanalyze()}>
                Re-analyze
              </Button>
            )}
            <Textarea
              placeholder="Paste session notes here — German and English accepted, no formatting required"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="min-h-[200px] resize-y"
              disabled={notesReadOnly}
            />
            {!notesReadOnly && !isDraftMode && (
              <div className="space-x-2">
                <Button
                  onClick={() => void startImport(notes)}
                  disabled={!apiKeyConfigured || notes.trim().length === 0 || isAnalyzing}
                >
                  Analyze
                </Button>
                {isAnalyzing && (
                  <Button variant="destructive" onClick={cancel}>
                    Stop Analysis
                  </Button>
                )}
              </div>
            )}
            {isAnalyzing && entityCount > 0 && (
              <p className="text-sm text-muted-foreground">Analyzing against {entityCount} entities</p>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="50%" minSize="20%">
          {/* RIGHT PANEL: Analysis + DiffReview + action buttons */}
          <div className="h-full overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                Analysis failed: {error}. Check your API key in Settings and try again.
              </div>
            )}
            {autoSaveError && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                {autoSaveError}
              </div>
            )}
            {successMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 p-3 text-sm text-green-800 dark:text-green-200">
                {successMessage}
              </div>
            )}
            {isDraftMode && hookPendingDraftId && (
              <p className="text-xs text-muted-foreground">Draft saved — come back via Pending Sessions</p>
            )}
            {(analysisText || isAnalyzing) && (
              <div>
                {isAnalyzing && !analysisText && (
                  <p className="text-sm text-muted-foreground animate-pulse">Analyzing...</p>
                )}
                {analysisText && (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{analysisText}</div>
                )}
              </div>
            )}
            {!isAnalyzing && hasProposals && (
              <DiffReview
                updates={entityUpdates}
                newEntities={newEntities}
                accepted={accepted}
                onAcceptedChange={setAccepted}
              />
            )}
            {!isAnalyzing && hasProposals && (
              <div className="flex gap-2">
                <Button onClick={() => void handleApply()} disabled={acceptedCount === 0}>
                  Apply Selected ({acceptedCount})
                </Button>
                {isDraftMode && (
                  <Button variant="destructive" onClick={() => void handleDiscard()}>
                    Discard
                  </Button>
                )}
              </div>
            )}
            {!hasOutput && !isAnalyzing && !error && !successMessage && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-sm text-muted-foreground">
                  <p className="font-semibold">No session imported yet</p>
                  <p className="mt-1">Paste your session notes in the left panel and click Analyze.</p>
                </div>
              </div>
            )}
            {!isAnalyzing && analysisText && entityUpdates.length === 0 && newEntities.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No changes proposed. Your knowledge base is already up to date with these notes.
              </p>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
