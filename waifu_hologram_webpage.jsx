import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CameraPopover from './src/CameraPopover.jsx'
import useHologramViewer from './src/useHologramViewer.js'

const COMMANDS = ['idle', 'clap', 'jump', 'dance', 'spin']

const bundledVrmModules = import.meta.glob('./vrm/*.{vrm,glb}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const bundledVrmaModules = import.meta.glob('./vrma/*.vrma', {
  eager: true,
  import: 'default',
  query: '?url',
})

function getFileName(path) {
  return path.split('/').pop() || path
}

function getDisplayBase(name) {
  return name.replace(/\.[^.]+$/, '')
}

function buildBundledAssets(modules, type) {
  return Object.entries(modules)
    .filter(([path]) => !path.endsWith('.gitignore'))
    .map(([path, url]) => {
      const name = getFileName(path)
      return {
        id: `${type}:${path}`,
        type,
        name,
        label: getDisplayBase(name),
        source: 'bundled',
        url,
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
}

const BUNDLED_AVATARS = buildBundledAssets(bundledVrmModules, 'avatar')
const BUNDLED_ACTIONS = buildBundledAssets(bundledVrmaModules, 'action')

function getAssetLabel(asset) {
  return asset?.alias?.trim() || asset?.label || asset?.name || 'Unnamed'
}

function createUploadedAsset(type, file) {
  return {
    id: `${type}:upload:${Date.now()}:${file.name}`,
    type,
    name: file.name,
    label: getDisplayBase(file.name),
    source: 'upload',
    file,
  }
}

function inferCommandFromAction(asset) {
  const raw = `${asset?.name || ''} ${asset?.alias || ''}`.toLowerCase()

  if (raw.includes('clap')) return 'clap'
  if (raw.includes('jump')) return 'jump'
  if (raw.includes('dance')) return 'dance'
  if (raw.includes('spin') || raw.includes('turn') || raw.includes('twirl')) return 'spin'
  return 'idle'
}

async function assetToFile(asset) {
  if (!asset) return null
  if (asset.file) return asset.file

  const response = await fetch(asset.url)
  const blob = await response.blob()
  return new File([blob], asset.name, { type: blob.type || 'application/octet-stream' })
}

function AssetPanel({
  title,
  accent,
  items,
  selectedId,
  search,
  renameDraft,
  emptyLabel,
  uploadAccept,
  helper,
  onSearchChange,
  onSelect,
  onRenameDraftChange,
  onRename,
  onUpload,
  onPrimaryAction,
  primaryLabel,
}) {
  const inputRef = useRef(null)

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return items

    return items.filter((item) => {
      const haystack = `${item.name} ${item.label} ${item.alias || ''}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [items, search])

  const selectedItem = items.find((item) => item.id === selectedId) || null

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className={`text-xs uppercase tracking-[0.28em] ${accent}`}>{title}</div>
          <div className="mt-1 text-sm text-white/60">{helper}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60">
          {items.length}
        </div>
      </div>

      <div className="space-y-3">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}`}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
        />

        <select
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
          size={Math.min(7, Math.max(4, filteredItems.length || 4))}
          className="h-44 w-full rounded-2xl border border-white/10 bg-black/25 p-2 text-sm text-white outline-none focus:border-cyan-300/40"
        >
          {filteredItems.length === 0 ? <option value="">{emptyLabel}</option> : null}
          {filteredItems.map((item) => (
            <option key={item.id} value={item.id}>
              {getAssetLabel(item)}
            </option>
          ))}
        </select>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
          {selectedItem ? (
            <>
              <div className="font-medium text-cyan-200">{getAssetLabel(selectedItem)}</div>
              <div className="mt-1 break-all text-xs text-white/45">{selectedItem.name}</div>
            </>
          ) : (
            'Nothing selected'
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={!selectedItem}
            className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-cyan-300/30 hover:bg-white/10"
          >
            Upload file
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={uploadAccept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.target.value = ''
          }}
        />

        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">Temporary rename</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={renameDraft}
              onChange={(event) => onRenameDraftChange(event.target.value)}
              placeholder="Visible label"
              disabled={!selectedItem}
              className="min-w-[180px] flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <button
              type="button"
              onClick={onRename}
              disabled={!selectedItem}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-cyan-300/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Rename
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function getViewerOverlay(status, isLoaded) {
  if (isLoaded) return null
  if (status === 'Loading') return 'Loading avatar...'
  if (status === 'Unsupported file') return 'This file loaded, but it is not a supported VRM avatar.'
  if (status === 'Load failed') return 'Failed to load this avatar.'
  return 'No avatar loaded yet. Pick one from the library or upload a VRM or GLB file.'
}

export default function WaifuHologramPage() {
  const canvasRef = useRef(null)
  const resetTimeoutRef = useRef(null)

  const { loadFile, setCommand: setViewerCommand, setFramingValue, framingState, status, isLoaded } = useHologramViewer(canvasRef)

  const [command, setCommand] = useState('idle')
  const [toolLog, setToolLog] = useState(['System ready'])
  const [loadedName, setLoadedName] = useState('None loaded yet')
  const [avatarItems, setAvatarItems] = useState(BUNDLED_AVATARS)
  const [actionItems, setActionItems] = useState(BUNDLED_ACTIONS)
  const [avatarSearch, setAvatarSearch] = useState('')
  const [actionSearch, setActionSearch] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState(BUNDLED_AVATARS[0]?.id || '')
  const [selectedActionId, setSelectedActionId] = useState(BUNDLED_ACTIONS[0]?.id || '')
  const [avatarRenameDraft, setAvatarRenameDraft] = useState('')
  const [actionRenameDraft, setActionRenameDraft] = useState('')

  const selectedAvatar = avatarItems.find((item) => item.id === selectedAvatarId) || null
  const selectedAction = actionItems.find((item) => item.id === selectedActionId) || null
  const viewerOverlay = getViewerOverlay(status, isLoaded)

  useEffect(() => {
    setAvatarRenameDraft(selectedAvatar ? getAssetLabel(selectedAvatar) : '')
  }, [selectedAvatar])

  useEffect(() => {
    setActionRenameDraft(selectedAction ? getAssetLabel(selectedAction) : '')
  }, [selectedAction])

  const addLogLine = useCallback((line) => {
    setToolLog((previous) => [line, ...previous].slice(0, 10))
  }, [])

  const clearResetTimer = useCallback(() => {
    if (!resetTimeoutRef.current) return
    window.clearTimeout(resetTimeoutRef.current)
    resetTimeoutRef.current = null
  }, [])

  const runCommand = useCallback((incoming, contextLabel) => {
    const normalized = String(incoming || '').trim().toLowerCase()
    if (!COMMANDS.includes(normalized)) return false

    clearResetTimer()
    setCommand(normalized)
    addLogLine(contextLabel ? `${contextLabel}: ${normalized}` : `Tool command: ${normalized}`)
    setViewerCommand(normalized)

    if (normalized === 'jump' || normalized === 'spin') {
      resetTimeoutRef.current = window.setTimeout(() => {
        setCommand('idle')
        setViewerCommand('idle')
        resetTimeoutRef.current = null
      }, normalized === 'jump' ? 1000 : 1450)
    }

    return true
  }, [addLogLine, clearResetTimer, setViewerCommand])

  useEffect(() => {
    window.hologramTool = {
      execute: runCommand,
      commands: COMMANDS,
      help: 'Use window.hologramTool.execute("dance") or dispatch a hologram-command event.',
    }

    const onEvent = (event) => {
      runCommand(event?.detail?.command)
    }

    window.addEventListener('hologram-command', onEvent)
    return () => {
      clearResetTimer()
      window.removeEventListener('hologram-command', onEvent)
      delete window.hologramTool
    }
  }, [clearResetTimer, runCommand])

  const renameAsset = useCallback((setItems, selectedId, value, typeLabel) => {
    const trimmed = value.trim()
    if (!selectedId || !trimmed) return

    setItems((previous) =>
      previous.map((item) => (item.id === selectedId ? { ...item, alias: trimmed } : item)),
    )
    addLogLine(`${typeLabel} renamed: ${trimmed}`)
  }, [addLogLine])

  const loadAvatarAsset = useCallback(async (asset) => {
    if (!asset) return
    const file = await assetToFile(asset)
    if (!file) return

    setLoadedName(getAssetLabel(asset))
    addLogLine(`Loaded avatar: ${getAssetLabel(asset)}`)
    loadFile(file)
  }, [addLogLine, loadFile])

  const handleAvatarUpload = useCallback(async (file) => {
    const asset = createUploadedAsset('avatar', file)
    setAvatarItems((previous) => [asset, ...previous])
    setSelectedAvatarId(asset.id)
    await loadAvatarAsset(asset)
  }, [loadAvatarAsset])

  const handleActionUpload = useCallback((file) => {
    const asset = createUploadedAsset('action', file)
    setActionItems((previous) => [asset, ...previous])
    setSelectedActionId(asset.id)
    addLogLine(`Added action file: ${file.name}`)
  }, [addLogLine])

  const playSelectedAction = useCallback(() => {
    if (!selectedAction) return
    runCommand(inferCommandFromAction(selectedAction), `Action file ${getAssetLabel(selectedAction)}`)
  }, [runCommand, selectedAction])

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#11214b_0%,_#071125_35%,_#030712_100%)] text-white">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-black/20 p-4 backdrop-blur xl:max-h-screen xl:overflow-y-auto xl:border-b-0 xl:border-r xl:p-5">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">AI Hologram Console</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">VRM Holo Avatar</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
              Local preview shell for testing VRM avatars and temporary action files without needing fullscreen.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <AssetPanel
              title="Avatar Library"
              accent="text-cyan-300/80"
              items={avatarItems}
              selectedId={selectedAvatarId}
              search={avatarSearch}
              renameDraft={avatarRenameDraft}
              emptyLabel="No matching VRM files"
              uploadAccept=".vrm,.glb"
              helper="Search local VRM files, upload another one, or rename the visible label."
              onSearchChange={setAvatarSearch}
              onSelect={setSelectedAvatarId}
              onRenameDraftChange={setAvatarRenameDraft}
              onRename={() => renameAsset(setAvatarItems, selectedAvatarId, avatarRenameDraft, 'Avatar')}
              onUpload={handleAvatarUpload}
              onPrimaryAction={() => loadAvatarAsset(selectedAvatar)}
              primaryLabel="Load selected"
            />

            <AssetPanel
              title="Action Library"
              accent="text-amber-300/80"
              items={actionItems}
              selectedId={selectedActionId}
              search={actionSearch}
              renameDraft={actionRenameDraft}
              emptyLabel="No matching action files"
              uploadAccept=".vrma"
              helper="Temporary testing list. Action files currently map to built-in demo commands by filename."
              onSearchChange={setActionSearch}
              onSelect={setSelectedActionId}
              onRenameDraftChange={setActionRenameDraft}
              onRename={() => renameAsset(setActionItems, selectedActionId, actionRenameDraft, 'Action')}
              onUpload={handleActionUpload}
              onPrimaryAction={playSelectedAction}
              primaryLabel="Play selected"
            />

            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-1">
              <div className="mb-2 text-xs uppercase tracking-[0.28em] text-white/45">Loaded avatar</div>
              <div className="rounded-2xl bg-black/25 px-3 py-2 text-sm text-white/75">{loadedName}</div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-1">
              <div className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">Recent log</div>
              <div className="space-y-2 text-sm text-white/70">
                {toolLog.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-2xl bg-black/25 px-3 py-2">
                    {line}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <main className="relative min-h-[62vh] p-3 sm:p-4 lg:p-5">
          <div className="relative h-[62vh] min-h-[520px] overflow-hidden rounded-[32px] border border-cyan-300/15 bg-black/20 xl:h-[calc(100vh-40px)]">
            <canvas ref={canvasRef} className="viewer-canvas" />

            <CameraPopover
              framingValues={framingState}
              activeCommand={command}
              onFramingChange={setFramingValue}
              onCommand={runCommand}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-5 sm:p-8">
              <div className="rounded-full border border-cyan-300/20 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.25em] text-cyan-200/90 backdrop-blur">
                Active command: {command}
              </div>
            </div>

            <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/65 backdrop-blur sm:left-auto sm:right-4">
              Orbit drag, wheel zoom, middle drag for height
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-cyan-300/20 bg-black/35 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-100/90 backdrop-blur">
              {status}
            </div>

            {viewerOverlay ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-md rounded-[24px] border border-cyan-300/16 bg-[rgba(3,7,18,0.55)] px-5 py-4 text-center text-sm leading-6 text-white/76 shadow-[0_0_48px_rgba(34,211,238,0.08)] backdrop-blur">
                  {viewerOverlay}
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
