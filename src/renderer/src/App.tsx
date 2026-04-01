import { useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@renderer/components/ui/alert-dialog'
import { AppShell } from './components/AppShell'
import { DraftsList } from './components/DraftsList'
import { PendingSessionsList } from './components/PendingSessionsList'
import { EntityEditor } from './components/EntityEditor'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SessionArchiveScreen } from './components/SessionArchiveScreen'
import { SessionImportScreen } from './components/SessionImportScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { StoryArchiveScreen } from './components/StoryArchiveScreen'
import { StoryGenerator } from './components/StoryGenerator'
import type { NavigationState, StoryRecord, PendingSessionRecord } from '../../shared/types'

function App(): JSX.Element {
  const [nav, setNav] = useState<NavigationState>({ view: 'characters', selectedEntityId: null })
  const [isDirty, setIsDirty] = useState(false)
  const [pendingNav, setPendingNav] = useState<NavigationState | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const saveRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    window.electronAPI.settings.getApiKeyStatus().then((status) => {
      setApiKeyConfigured(status.configured)
    })
  }, [nav.view])

  function navigate(target: NavigationState): void {
    if (isDirty) {
      setPendingNav(target)
    } else {
      setNav(target)
    }
  }

  async function handleSaveAndNavigate(): Promise<void> {
    if (saveRef.current) {
      await saveRef.current()
    }
    if (pendingNav) {
      setIsDirty(false)
      setNav(pendingNav)
      setPendingNav(null)
    }
  }

  function handleDiscardAndNavigate(): void {
    setIsDirty(false)
    if (pendingNav) {
      setNav(pendingNav)
      setPendingNav(null)
    }
  }

  function handleKeepEditing(): void {
    setPendingNav(null)
  }

  function handleEntitySaved(): void {
    setIsDirty(false)
    setRefreshKey((k) => k + 1)
  }

  function handleEntityDeleted(): void {
    setIsDirty(false)
    setNav({ ...nav, selectedEntityId: null })
    setRefreshKey((k) => k + 1)
  }

  function handleOpenDraft(draft: StoryRecord): void {
    setNav({ view: 'story-generator', selectedEntityId: draft.id })
  }

  function handleOpenPendingSession(draft: PendingSessionRecord): void {
    setNav({ view: 'session-import', selectedEntityId: draft.id })
  }

  function renderContent(): JSX.Element {
    const { view, selectedEntityId } = nav

    if (view === 'story-drafts') {
      return (
        <DraftsList
          onOpenDraft={handleOpenDraft}
        />
      )
    }

    if (view === 'pending-sessions') {
      return (
        <PendingSessionsList
          onOpenPendingSession={handleOpenPendingSession}
        />
      )
    }

    if (view === 'story-generator') {
      return (
        <StoryGenerator
          apiKeyConfigured={apiKeyConfigured}
          onEntityListRefresh={() => setRefreshKey(k => k + 1)}
          draftId={selectedEntityId}
        />
      )
    }

    if (view === 'session-import') {
      return (
        <SessionImportScreen
          apiKeyConfigured={apiKeyConfigured}
          onEntityListRefresh={() => setRefreshKey(k => k + 1)}
          pendingDraftId={selectedEntityId}
        />
      )
    }

    if (view === 'story-archive') {
      return <StoryArchiveScreen onNavigate={navigate} />
    }

    if (view === 'session-archive') {
      return <SessionArchiveScreen onNavigate={navigate} />
    }

    if (view === 'settings') {
      return <SettingsScreen />
    }

    // Entity views: characters, locations, events
    if (selectedEntityId) {
      return (
        <EntityEditor
          entityId={selectedEntityId}
          onDirtyChange={setIsDirty}
          onEntityDeleted={handleEntityDeleted}
          onEntitySaved={handleEntitySaved}
          saveRef={saveRef}
        />
      )
    }

    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select an entity or create a new one
      </div>
    )
  }

  // Current entity name for dialog description
  const entityName = nav.selectedEntityId ? 'this entity' : 'the current item'

  return (
    <ErrorBoundary>
      <div className="h-screen overflow-hidden">
        <AppShell nav={nav} onNavigate={navigate} refreshKey={refreshKey}>
          {renderContent()}
        </AppShell>

        {/* Unsaved Changes Dialog */}
        <AlertDialog open={pendingNav !== null}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes to {entityName}. What would you like to do?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleKeepEditing}>
                Keep editing
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDiscardAndNavigate}
              >
                Discard changes
              </AlertDialogAction>
              <AlertDialogAction onClick={() => void handleSaveAndNavigate()}>
                Save now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  )
}

export default App
