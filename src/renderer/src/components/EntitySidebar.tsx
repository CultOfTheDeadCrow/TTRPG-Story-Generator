import { useEffect, useState } from 'react'
import { PlusIcon, ChevronDownIcon, ZapIcon, FileTextIcon, FileArchiveIcon, SettingsIcon, BookOpenIcon, ClipboardListIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@renderer/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { StatusDot } from './StatusDot'
import type { Entity, EntityType, NavigationState, ViewType } from '../../../shared/types'

interface EntitySidebarProps {
  nav: NavigationState
  onNavigate: (target: NavigationState) => void
  refreshKey: number
}

interface EntityGroupConfig {
  type: EntityType
  label: string
  view: ViewType
  ariaLabel: string
  emptyTitle: string
  emptyCta: string
}

const ENTITY_GROUPS: EntityGroupConfig[] = [
  {
    type: 'character',
    label: 'Characters',
    view: 'characters',
    ariaLabel: 'New Character',
    emptyTitle: 'No characters yet',
    emptyCta: 'Click + to add your first character.',
  },
  {
    type: 'location',
    label: 'Locations',
    view: 'locations',
    ariaLabel: 'New Location',
    emptyTitle: 'No locations yet',
    emptyCta: 'Click + to add your first location.',
  },
  {
    type: 'event',
    label: 'Events',
    view: 'events',
    ariaLabel: 'New Event',
    emptyTitle: 'No events yet',
    emptyCta: 'Click + to add your first event.',
  },
]

function EntityGroup({
  config,
  nav,
  onNavigate,
  refreshKey,
}: {
  config: EntityGroupConfig
  nav: NavigationState
  onNavigate: (target: NavigationState) => void
  refreshKey: number
}): JSX.Element {
  const [entities, setEntities] = useState<Entity[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    window.electronAPI.entities.getAll(config.type).then(setEntities).catch(console.error)
  }, [config.type, refreshKey])

  async function handleCreate(): Promise<void> {
    try {
      const newEntity = await window.electronAPI.entities.create(config.type)
      setEntities((prev) => [...prev, newEntity])
      onNavigate({ view: config.view, selectedEntityId: newEntity.id })
    } catch (err) {
      console.error('Failed to create entity', err)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup>
        <div className="flex items-center justify-between px-2 py-1">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center gap-1 text-left text-sm font-semibold text-sidebar-foreground hover:text-sidebar-foreground/80"
            >
              <ChevronDownIcon
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
              />
              {config.label}
            </button>
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={config.ariaLabel}
            title={config.ariaLabel}
            onClick={handleCreate}
            className="h-6 w-6"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </Button>
        </div>

        <CollapsibleContent>
          <SidebarGroupContent>
            {entities.length === 0 ? (
              <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                <p>{config.emptyTitle}</p>
                <p className="mt-0.5">{config.emptyCta}</p>
              </div>
            ) : (
              <SidebarMenu>
                {entities.map((entity) => {
                  const isActive = nav.selectedEntityId === entity.id
                  return (
                    <SidebarMenuItem key={entity.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => onNavigate({ view: config.view, selectedEntityId: entity.id })}
                        className="h-9"
                      >
                        <StatusDot status={entity.status} />
                        <span className="flex-1 truncate text-sm">{entity.name || 'Unnamed'}</span>
                        <div className="flex shrink-0 gap-1 overflow-hidden">
                          {entity.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="h-5 px-1.5 text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

export function EntitySidebar({ nav, onNavigate, refreshKey }: EntitySidebarProps): JSX.Element {
  return (
    <Sidebar collapsible="none">
      <SidebarContent>
        {ENTITY_GROUPS.map((config) => (
          <EntityGroup
            key={config.type}
            config={config}
            nav={nav}
            onNavigate={onNavigate}
            refreshKey={refreshKey}
          />
        ))}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={nav.view === 'story-generator'}
                  onClick={() => onNavigate({ view: 'story-generator', selectedEntityId: null })}
                >
                  <ZapIcon className="h-4 w-4" />
                  <span>Story Generator</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={nav.view === 'story-drafts'}
                  onClick={() => onNavigate({ view: 'story-drafts', selectedEntityId: null })}
                  className="pl-8"
                >
                  <FileArchiveIcon className="h-4 w-4" />
                  <span>Drafts</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={nav.view === 'session-import'}
                  onClick={() => onNavigate({ view: 'session-import', selectedEntityId: null })}
                >
                  <FileTextIcon className="h-4 w-4" />
                  <span>Session Import</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={nav.view === 'pending-sessions'}
                  onClick={() => onNavigate({ view: 'pending-sessions', selectedEntityId: null })}
                  className="pl-8"
                >
                  <ClipboardListIcon className="h-4 w-4" />
                  <span>Pending Sessions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Archive</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={nav.view === 'story-archive'}
                  onClick={() => onNavigate({ view: 'story-archive', selectedEntityId: null })}
                >
                  <BookOpenIcon className="h-4 w-4" />
                  <span>Story Archive</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={nav.view === 'session-archive'}
                  onClick={() => onNavigate({ view: 'session-archive', selectedEntityId: null })}
                >
                  <ClipboardListIcon className="h-4 w-4" />
                  <span>Session Archive</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={nav.view === 'settings'}
                  onClick={() => onNavigate({ view: 'settings', selectedEntityId: null })}
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
