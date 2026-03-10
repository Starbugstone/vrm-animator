import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CameraPopover from './src/CameraPopover.jsx'
import useHologramViewer from './src/useHologramViewer.js'

const COMMANDS = ['idle', 'clap', 'jump', 'dance', 'spin']

const projectVrmModules = import.meta.glob('./vrm/**/*.{vrm,glb}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const defaultVrmModules = import.meta.glob('./default_vrm/**/*.{vrm,glb}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const bundledIdleModules = import.meta.glob('./idle/**/*.vrma', {
  eager: true,
  import: 'default',
  query: '?url',
})

const projectVrmaModules = import.meta.glob('./vrma/**/*.vrma', {
  eager: true,
  import: 'default',
  query: '?url',
})

const projectExpressionVrmaModules = import.meta.glob('./expressions_vrma/**/*.vrma', {
  eager: true,
  import: 'default',
  query: '?url',
})

const defaultVrmaModules = import.meta.glob('./default_vrma/**/*.vrma', {
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

function getAssetGroup(path) {
  const normalized = path.replace(/^\.\//, '')
  const segments = normalized.split('/')
  return segments.slice(1, -1).join(' / ')
}

function buildBundledAssets(modules, options) {
  const { type, source, sourceLabel } = options

  return Object.entries(modules)
    .filter(([path]) => !path.endsWith('.gitignore'))
    .map(([path, url]) => {
      const name = getFileName(path)
      return {
        id: `${type}:${source}:${path}`,
        type,
        name,
        label: getDisplayBase(name),
        source,
        sourceLabel,
        groupLabel: getAssetGroup(path),
        url,
      }
    })
    .sort((left, right) => {
      const groupCompare = left.groupLabel.localeCompare(right.groupLabel)
      if (groupCompare !== 0) return groupCompare
      return left.label.localeCompare(right.label)
    })
}

const DEFAULT_AVATARS = buildBundledAssets(defaultVrmModules, {
  type: 'avatar',
  source: 'example',
  sourceLabel: 'Bundled example',
})

const PROJECT_AVATARS = buildBundledAssets(projectVrmModules, {
  type: 'avatar',
  source: 'project',
  sourceLabel: 'Project asset',
})

const BUNDLED_IDLE_ACTIONS = buildBundledAssets(bundledIdleModules, {
  type: 'idle',
  source: 'project',
  sourceLabel: 'Project idle',
})

const DEFAULT_ACTIONS = buildBundledAssets(defaultVrmaModules, {
  type: 'action',
  source: 'example',
  sourceLabel: 'Bundled example',
})

const PROJECT_ACTIONS = buildBundledAssets(projectVrmaModules, {
  type: 'action',
  source: 'project',
  sourceLabel: 'Project asset',
})

const PROJECT_EXPRESSION_ACTIONS = buildBundledAssets(projectExpressionVrmaModules, {
  type: 'expression',
  source: 'project',
  sourceLabel: 'Expression asset',
})

const BUNDLED_AVATARS = [...DEFAULT_AVATARS, ...PROJECT_AVATARS]
const BUNDLED_ACTIONS = [...DEFAULT_ACTIONS, ...PROJECT_ACTIONS]
const DEFAULT_IDLE_ID = BUNDLED_IDLE_ACTIONS.find((item) => item.name === 'idle_main.vrma')?.id || BUNDLED_IDLE_ACTIONS[0]?.id || ''
const IDLE_VARIATION_MIN_MS = 9000
const IDLE_VARIATION_MAX_MS = 16000

function getAssetLabel(asset) {
  return asset?.alias?.trim() || asset?.label || asset?.name || 'Unnamed'
}

function getAssetSourceTag(asset) {
  if (asset?.source === 'upload') return 'Upload'
  if (asset?.source === 'example') return 'Example'
  return 'Project'
}

function createUploadedAsset(type, file) {
  return {
    id: `${type}:upload:${Date.now()}:${file.name}`,
    type,
    name: file.name,
    label: getDisplayBase(file.name),
    source: 'upload',
    sourceLabel: 'Session upload',
    groupLabel: '',
    file,
  }
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
  onSecondaryAction,
  primaryLabel,
  secondaryLabel,
  primaryDisabled = false,
  secondaryDisabled = false,
  primaryBusy = false,
  primaryBusyLabel = 'Working...',
  secondaryBusy = false,
  secondaryBusyLabel = 'Working...',
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
              [{getAssetSourceTag(item)}] {getAssetLabel(item)}
            </option>
          ))}
        </select>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
          {selectedItem ? (
            <>
              <div className="font-medium text-cyan-200">{getAssetLabel(selectedItem)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                {[selectedItem.sourceLabel, selectedItem.groupLabel].filter(Boolean).join(' / ')}
              </div>
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
            disabled={!selectedItem || primaryDisabled}
            className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-2">
              {primaryBusy ? <span className="h-4 w-4 rounded-full border-2 border-cyan-100/25 border-t-cyan-100 animate-spin" /> : null}
              {primaryBusy ? primaryBusyLabel : primaryLabel}
            </span>
          </button>
          {onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              disabled={!selectedItem || secondaryDisabled}
              className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="inline-flex items-center gap-2">
                {secondaryBusy ? <span className="h-4 w-4 rounded-full border-2 border-amber-100/25 border-t-amber-100 animate-spin" /> : null}
                {secondaryBusy ? secondaryBusyLabel : secondaryLabel}
              </span>
            </button>
          ) : null}
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

function AvatarLoadingOverlay({ label, keepCurrentAvatar }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-[28px] border border-cyan-300/18 bg-[rgba(3,7,18,0.68)] px-6 py-5 text-center shadow-[0_0_64px_rgba(34,211,238,0.12)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/8">
          <div className="h-10 w-10 rounded-full border-2 border-cyan-100/20 border-t-cyan-100 animate-spin" />
        </div>
        <div className="mt-4 text-xs uppercase tracking-[0.28em] text-cyan-200/70">Loading avatar</div>
        <div className="mt-2 text-base font-medium text-white">{label || 'Preparing selected avatar'}</div>
        <div className="mt-2 text-sm leading-6 text-white/65">
          {keepCurrentAvatar
            ? 'The current avatar stays visible until the next model is ready.'
            : 'Large VRM and GLB files can take a moment to prepare.'}
        </div>
      </div>
    </div>
  )
}

const VIEWER_OPTION_LABELS = {
  autoBlink: 'Auto blink',
  lookAtCamera: 'Eyes follow camera',
}

export default function WaifuHologramPage() {
  const canvasRef = useRef(null)
  const resetTimeoutRef = useRef(null)
  const idleVariationTimeoutRef = useRef(null)
  const idleVariationCycleRef = useRef(0)

  const {
    loadFile,
    setIdleAnimation,
    playAnimationFile,
    playOverlayAnimationFile,
    setCommand: setViewerCommand,
    setFramingValue,
    setViewerOption,
    viewerOptions,
    framingState,
    status,
    isLoaded,
    isAvatarLoading,
  } = useHologramViewer(canvasRef)

  const [command, setCommand] = useState('idle')
  const [activeMotionLabel, setActiveMotionLabel] = useState('idle')
  const [toolLog, setToolLog] = useState(['System ready'])
  const [loadedName, setLoadedName] = useState('None loaded yet')
  const [avatarItems, setAvatarItems] = useState(BUNDLED_AVATARS)
  const [idleItems, setIdleItems] = useState(BUNDLED_IDLE_ACTIONS)
  const [actionItems, setActionItems] = useState(BUNDLED_ACTIONS)
  const [expressionItems, setExpressionItems] = useState(PROJECT_EXPRESSION_ACTIONS)
  const [avatarSearch, setAvatarSearch] = useState('')
  const [idleSearch, setIdleSearch] = useState('')
  const [actionSearch, setActionSearch] = useState('')
  const [expressionSearch, setExpressionSearch] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState(DEFAULT_AVATARS[0]?.id || PROJECT_AVATARS[0]?.id || '')
  const [selectedIdleId, setSelectedIdleId] = useState(DEFAULT_IDLE_ID)
  const [selectedActionId, setSelectedActionId] = useState(DEFAULT_ACTIONS[0]?.id || PROJECT_ACTIONS[0]?.id || '')
  const [selectedExpressionId, setSelectedExpressionId] = useState(PROJECT_EXPRESSION_ACTIONS[0]?.id || '')
  const [avatarRenameDraft, setAvatarRenameDraft] = useState('')
  const [idleRenameDraft, setIdleRenameDraft] = useState('')
  const [actionRenameDraft, setActionRenameDraft] = useState('')
  const [expressionRenameDraft, setExpressionRenameDraft] = useState('')
  const [pendingAvatarLabel, setPendingAvatarLabel] = useState('')
  const [avatarLoadStage, setAvatarLoadStage] = useState('idle')

  const selectedAvatar = avatarItems.find((item) => item.id === selectedAvatarId) || null
  const selectedIdle = idleItems.find((item) => item.id === selectedIdleId) || null
  const selectedAction = actionItems.find((item) => item.id === selectedActionId) || null
  const selectedExpression = expressionItems.find((item) => item.id === selectedExpressionId) || null
  const viewerOverlay = getViewerOverlay(status, isLoaded)
  const showAvatarLoading = avatarLoadStage !== 'idle' || isAvatarLoading
  const addLogLine = useCallback((line) => {
    setToolLog((previous) => [line, ...previous].slice(0, 10))
  }, [])

  useEffect(() => {
    setAvatarRenameDraft(selectedAvatar ? getAssetLabel(selectedAvatar) : '')
  }, [selectedAvatar])

  useEffect(() => {
    setIdleRenameDraft(selectedIdle ? getAssetLabel(selectedIdle) : '')
  }, [selectedIdle])

  useEffect(() => {
    setActionRenameDraft(selectedAction ? getAssetLabel(selectedAction) : '')
  }, [selectedAction])

  useEffect(() => {
    setExpressionRenameDraft(selectedExpression ? getAssetLabel(selectedExpression) : '')
  }, [selectedExpression])

  useEffect(() => {
    if (status.startsWith('Idle: ')) {
      setActiveMotionLabel(status.slice(6))
      return
    }
    if (status.startsWith('Playing action: ')) {
      setActiveMotionLabel(status.slice('Playing action: '.length))
      return
    }
    if (status.startsWith('Command: ')) {
      setActiveMotionLabel(status.slice(9))
    }
  }, [status])

  useEffect(() => {
    if (!pendingAvatarLabel || avatarLoadStage === 'idle') return

    if (avatarLoadStage === 'loading' && (status === 'Load failed' || status === 'Unsupported file')) {
      addLogLine(`Avatar load failed: ${pendingAvatarLabel}`)
      setPendingAvatarLabel('')
      setAvatarLoadStage('idle')
      return
    }

    if (avatarLoadStage === 'loading' && !isAvatarLoading) {
      setLoadedName(pendingAvatarLabel)
      addLogLine(`Loaded avatar: ${pendingAvatarLabel}`)
      setPendingAvatarLabel('')
      setAvatarLoadStage('idle')
    }
  }, [addLogLine, avatarLoadStage, isAvatarLoading, pendingAvatarLabel, status])

  const clearResetTimer = useCallback(() => {
    if (!resetTimeoutRef.current) return
    window.clearTimeout(resetTimeoutRef.current)
    resetTimeoutRef.current = null
  }, [])

  const clearIdleVariationTimer = useCallback(() => {
    if (!idleVariationTimeoutRef.current) return
    window.clearTimeout(idleVariationTimeoutRef.current)
    idleVariationTimeoutRef.current = null
  }, [])

  const runCommand = useCallback((incoming, contextLabel) => {
    const normalized = String(incoming || '').trim().toLowerCase()
    if (!COMMANDS.includes(normalized)) return false

    clearResetTimer()
    setCommand(normalized)
    setActiveMotionLabel(normalized)
    addLogLine(contextLabel ? `${contextLabel}: ${normalized}` : `Tool command: ${normalized}`)
    setViewerCommand(normalized)

    if (normalized === 'jump' || normalized === 'spin') {
      resetTimeoutRef.current = window.setTimeout(() => {
        setCommand('idle')
        setActiveMotionLabel('idle')
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
      clearIdleVariationTimer()
      window.removeEventListener('hologram-command', onEvent)
      delete window.hologramTool
    }
  }, [clearIdleVariationTimer, clearResetTimer, runCommand])

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
    const label = getAssetLabel(asset)
    setPendingAvatarLabel(label)
    setAvatarLoadStage('preparing')
    addLogLine(`Loading avatar: ${label}`)

    try {
      const file = await assetToFile(asset)
      if (!file) {
        setPendingAvatarLabel('')
        setAvatarLoadStage('idle')
        return
      }

      setAvatarLoadStage('loading')
      loadFile(file)
    } catch (error) {
      console.error(error)
      addLogLine(`Avatar load failed: ${label}`)
      setPendingAvatarLabel('')
      setAvatarLoadStage('idle')
    }
  }, [addLogLine, loadFile])

  const handleAvatarUpload = useCallback(async (file) => {
    const asset = createUploadedAsset('avatar', file)
    setAvatarItems((previous) => [asset, ...previous])
    setSelectedAvatarId(asset.id)
    await loadAvatarAsset(asset)
  }, [loadAvatarAsset])

  const handleIdleUpload = useCallback((file) => {
    const asset = createUploadedAsset('idle', file)
    setIdleItems((previous) => [asset, ...previous])
    setSelectedIdleId(asset.id)
    addLogLine(`Added idle file: ${file.name}`)
  }, [addLogLine])

  const handleSetIdle = useCallback(async (asset = selectedIdle) => {
    if (!asset) return

    const label = getAssetLabel(asset)
    const file = await assetToFile(asset)
    if (!file) return

    const started = setIdleAnimation(file, label, { cacheKey: asset.id })
    if (!started) return

    addLogLine(`Default idle set: ${label}`)
  }, [addLogLine, selectedIdle, setIdleAnimation])

  const pickRandomIdleAsset = useCallback(() => {
    if (idleItems.length === 0) return null

    const pool = idleItems.filter(
      (item) => item.id !== selectedIdleId && getAssetLabel(item) !== activeMotionLabel,
    )

    const source = pool.length > 0 ? pool : idleItems
    return source[Math.floor(Math.random() * source.length)] || null
  }, [activeMotionLabel, idleItems, selectedIdleId])

  const handleActionUpload = useCallback((file) => {
    const asset = createUploadedAsset('action', file)
    setActionItems((previous) => [asset, ...previous])
    setSelectedActionId(asset.id)
    addLogLine(`Added action file: ${file.name}`)
  }, [addLogLine])

  const handleExpressionUpload = useCallback((file) => {
    const asset = createUploadedAsset('expression', file)
    setExpressionItems((previous) => [asset, ...previous])
    setSelectedExpressionId(asset.id)
    addLogLine(`Added expression file: ${file.name}`)
  }, [addLogLine])

  useEffect(() => {
    if (!selectedIdle) return
    handleSetIdle(selectedIdle)
  }, [handleSetIdle, selectedIdle])

  useEffect(() => {
    clearIdleVariationTimer()

    if (!isLoaded || !status.startsWith('Idle: ') || idleItems.length < 2) {
      return undefined
    }

    const cycle = idleVariationCycleRef.current + 1
    idleVariationCycleRef.current = cycle
    const delay =
      IDLE_VARIATION_MIN_MS + Math.floor(Math.random() * (IDLE_VARIATION_MAX_MS - IDLE_VARIATION_MIN_MS + 1))

    idleVariationTimeoutRef.current = window.setTimeout(async () => {
      const nextIdle = pickRandomIdleAsset()
      if (!nextIdle) return

      const file = await assetToFile(nextIdle)
      if (!file || idleVariationCycleRef.current !== cycle) return

      const label = getAssetLabel(nextIdle)
      const started = setIdleAnimation(file, label, {
        cacheKey: nextIdle.id,
        persistDefault: false,
      })

      if (started) {
        addLogLine(`Idle variation: ${label}`)
      }
    }, delay)

    return () => {
      clearIdleVariationTimer()
    }
  }, [addLogLine, clearIdleVariationTimer, idleItems.length, isLoaded, pickRandomIdleAsset, setIdleAnimation, status])

  const playSelectedAction = useCallback(async () => {
    if (!selectedAction) return

    const label = getAssetLabel(selectedAction)
    const file = await assetToFile(selectedAction)
    if (!file) return

    const started = playAnimationFile(file, label, { cacheKey: selectedAction.id })
    if (!started) {
      addLogLine(`Action failed: ${label}`)
      return
    }

    clearResetTimer()
    setCommand('idle')
    setActiveMotionLabel(label)
    addLogLine(`Playing action: ${label}`)
  }, [addLogLine, clearResetTimer, playAnimationFile, selectedAction])

  const playSelectedExpression = useCallback(async () => {
    if (!selectedExpression) return

    const label = getAssetLabel(selectedExpression)
    const file = await assetToFile(selectedExpression)
    if (!file) return

    const started = playOverlayAnimationFile(file, label, {
      cacheKey: `${selectedExpression.id}:overlay`,
    })
    if (!started) {
      addLogLine(`Expression overlay failed: ${label}`)
      return
    }

    addLogLine(`Playing expression overlay: ${label}`)
  }, [addLogLine, playOverlayAnimationFile, selectedExpression])

  const handleViewerOptionChange = useCallback((key, value) => {
    setViewerOption(key, value)
    const label = VIEWER_OPTION_LABELS[key] || key
    addLogLine(`${label}: ${value ? 'on' : 'off'}`)
  }, [addLogLine, setViewerOption])

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#11214b_0%,_#071125_35%,_#030712_100%)] text-white">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-black/20 p-4 backdrop-blur xl:max-h-screen xl:overflow-y-auto xl:border-b-0 xl:border-r xl:p-5">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">AI Hologram Console</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">VRM Holo Avatar</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
              Local preview shell for curated example assets, project libraries, and one-off VRM or VRMA uploads.
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
              helper="Browse bundled examples, project VRM files, or a temporary upload."
              onSearchChange={setAvatarSearch}
              onSelect={setSelectedAvatarId}
              onRenameDraftChange={setAvatarRenameDraft}
              onRename={() => renameAsset(setAvatarItems, selectedAvatarId, avatarRenameDraft, 'Avatar')}
              onUpload={handleAvatarUpload}
              onPrimaryAction={() => loadAvatarAsset(selectedAvatar)}
              primaryLabel="Load selected"
              primaryDisabled={showAvatarLoading}
              primaryBusy={showAvatarLoading}
              primaryBusyLabel="Loading..."
            />

            <AssetPanel
              title="Idle Library"
              accent="text-emerald-300/80"
              items={idleItems}
              selectedId={selectedIdleId}
              search={idleSearch}
              renameDraft={idleRenameDraft}
              emptyLabel="No matching idle files"
              uploadAccept=".vrma"
              helper="Pick the default idle loop. Action playback crossfades back here after one-shot clips."
              onSearchChange={setIdleSearch}
              onSelect={setSelectedIdleId}
              onRenameDraftChange={setIdleRenameDraft}
              onRename={() => renameAsset(setIdleItems, selectedIdleId, idleRenameDraft, 'Idle')}
              onUpload={handleIdleUpload}
              onPrimaryAction={() => handleSetIdle(selectedIdle)}
              primaryLabel="Set selected"
            />

            <AssetPanel
              title="VRMA Library"
              accent="text-amber-300/80"
              items={actionItems}
              selectedId={selectedActionId}
              search={actionSearch}
              renameDraft={actionRenameDraft}
              emptyLabel="No matching action files"
              uploadAccept=".vrma"
              helper="Play bundled example motions, project clips, or a temporary upload."
              onSearchChange={setActionSearch}
              onSelect={setSelectedActionId}
              onRenameDraftChange={setActionRenameDraft}
              onRename={() => renameAsset(setActionItems, selectedActionId, actionRenameDraft, 'Action')}
              onUpload={handleActionUpload}
              onPrimaryAction={playSelectedAction}
              primaryLabel="Play selected"
            />

            <AssetPanel
              title="Expression VRMA"
              accent="text-rose-300/80"
              items={expressionItems}
              selectedId={selectedExpressionId}
              search={expressionSearch}
              renameDraft={expressionRenameDraft}
              emptyLabel="No matching expression files"
              uploadAccept=".vrma"
              helper="Expression-only VRMAs for face and mouth testing. These play over the current body animation."
              onSearchChange={setExpressionSearch}
              onSelect={setSelectedExpressionId}
              onRenameDraftChange={setExpressionRenameDraft}
              onRename={() => renameAsset(setExpressionItems, selectedExpressionId, expressionRenameDraft, 'Expression')}
              onUpload={handleExpressionUpload}
              onPrimaryAction={playSelectedExpression}
              primaryLabel="Play expression"
            />

            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-1">
              <div className="mb-2 text-xs uppercase tracking-[0.28em] text-white/45">Loaded avatar</div>
              <div className="rounded-2xl bg-black/25 px-3 py-2 text-sm text-white/75">{loadedName}</div>
            </section>

            <section className="rounded-3xl border border-amber-300/15 bg-amber-300/5 p-4 md:col-span-2 xl:col-span-1">
              <div className="mb-2 text-xs uppercase tracking-[0.28em] text-amber-200/70">Asset rights</div>
              <div className="text-sm leading-6 text-white/70">
                Bundled example VRM and VRMA files are third-party sample assets. Check the README and source files before reusing or redistributing them outside this demo project.
              </div>
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
              viewerOptions={viewerOptions}
              activeCommand={activeMotionLabel}
              onFramingChange={setFramingValue}
              onOptionChange={handleViewerOptionChange}
              onCommand={runCommand}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-5 sm:p-8">
              <div className="rounded-full border border-cyan-300/20 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.25em] text-cyan-200/90 backdrop-blur">
                Active motion: {activeMotionLabel}
              </div>
            </div>

            <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/65 backdrop-blur sm:left-auto sm:right-4">
              Orbit drag, wheel zoom, middle drag for height
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-cyan-300/20 bg-black/35 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-100/90 backdrop-blur">
              {status}
            </div>

            {showAvatarLoading ? (
              <AvatarLoadingOverlay
                label={pendingAvatarLabel}
                keepCurrentAvatar={isLoaded}
              />
            ) : null}

            {viewerOverlay && !showAvatarLoading ? (
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
