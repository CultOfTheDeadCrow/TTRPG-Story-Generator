import { useEffect, useState } from 'react'
import { ClipboardListIcon, TrashIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import type { PendingSessionRecord } from '../../../../shared/types'

interface PendingSessionsListProps {
  onOpenPendingSession: (draft: PendingSessionRecord) => void
}

export function PendingSessionsList({ onOpenPendingSession }: PendingSessionsListProps): JSX.Element {
  const [drafts, setDrafts] = useState<PendingSessionRecord[] | null>(null)

  useEffect(() => {
    window.electronAPI.sessions.listPendingDrafts().then(setDrafts).catch(console.error)
  }, [])

  async function handleDiscard(id: string): Promise<void> {
    await window.electronAPI.sessions.deletePendingDraft(id)
    setDrafts(prev => prev?.filter(d => d.id !== id) ?? [])
  }

  if (drafts === null) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center text-sm text-muted-foreground">
          <ClipboardListIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No pending sessions.</p>
          <p className="mt-1">Analyze session notes and they will auto-save here for review.</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Pending Sessions</h2>
        {drafts.map(draft => {
          const updateCount = draft.entity_updates.length + draft.new_entities.length
          return (
            <div key={draft.id} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
              <button
                className="flex-1 text-left"
                onClick={() => onOpenPendingSession(draft)}
              >
                <p className="text-sm font-medium truncate">
                  {draft.title || 'Untitled session'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(draft.created_at * 1000).toLocaleString()} &mdash; {updateCount} proposed change{updateCount !== 1 ? 's' : ''}
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void handleDiscard(draft.id)}
                title="Discard pending session"
              >
                <TrashIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
