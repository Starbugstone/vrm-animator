import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useHologramViewer from '../useHologramViewer.js'
import { buildPrimaryWorkspaceUrl, createHologramChannel } from '../lib/hologramProjection.js'

const PROJECTION_PANELS = [
  {
    id: 'top',
    label: 'Back',
    yawOffset: 180,
    rotationDegrees: 180,
  },
  {
    id: 'left',
    label: 'Left',
    yawOffset: 90,
    rotationDegrees: 90,
  },
  {
    id: 'right',
    label: 'Right',
    yawOffset: -90,
    rotationDegrees: -90,
  },
  {
    id: 'bottom',
    label: 'Front',
    yawOffset: 0,
    rotationDegrees: 0,
  },
]

const DEFAULT_VIEWER_OPTIONS = {
  autoBlink: true,
  lookAtCamera: false,
}

const DEFAULT_FRAMING_STATE = {
  yaw: 0,
  tilt: 72,
  zoom: 8,
  height: 0,
  shift: 0,
}

function createEmptyProjectionState() {
  return {
    avatar: null,
    idle: null,
    thinking: null,
    runtime: null,
    viewerOptions: DEFAULT_VIEWER_OPTIONS,
    framingState: DEFAULT_FRAMING_STATE,
    fullStateVersion: 0,
    runtimeVersion: 0,
    settingsVersion: 0,
  }
}

function normalizeDegrees(value) {
  const numericValue = Number(value) || 0
  const normalizedValue = ((numericValue % 360) + 360) % 360
  return normalizedValue > 180 ? normalizedValue - 360 : normalizedValue
}

function buildRuntimeSignature(runtime) {
  const serializeMotion = (motion) => (
    motion
      ? [
        motion.cacheKey || '',
        motion.kind || '',
        motion.loop ? '1' : '0',
        motion.returnToDefault ? '1' : '0',
        motion.stripExpressionTracks ? '1' : '0',
        motion.expressionOnly ? '1' : '0',
        motion.priority || '',
      ].join('|')
      : ''
  )

  return [
    runtime?.playbackMode || '',
    runtime?.thinkingIndicatorEnabled ? '1' : '0',
    serializeMotion(runtime?.defaultIdleMotion),
    serializeMotion(runtime?.activeBaseMotion),
    serializeMotion(runtime?.activeOverlayMotion),
  ].join('::')
}

function getProjectionPanelStyle(panelId) {
  const shared = {
    width: 'var(--projection-panel-size)',
    height: 'var(--projection-panel-size)',
  }

  if (panelId === 'top') {
    return {
      ...shared,
      left: 'calc(50% - var(--projection-panel-size) / 2)',
      top: 'calc(50% - var(--projection-panel-size) * 1.5)',
    }
  }

  if (panelId === 'bottom') {
    return {
      ...shared,
      left: 'calc(50% - var(--projection-panel-size) / 2)',
      top: 'calc(50% + var(--projection-panel-size) / 2)',
    }
  }

  if (panelId === 'left') {
    return {
      ...shared,
      left: 'calc(50% - var(--projection-panel-size) * 1.5)',
      top: 'calc(50% - var(--projection-panel-size) / 2)',
    }
  }

  return {
    ...shared,
    left: 'calc(50% + var(--projection-panel-size) / 2)',
    top: 'calc(50% - var(--projection-panel-size) / 2)',
  }
}

function ProjectionPanel({ panel, projectionState, runtimeEvent }) {
  const canvasRef = useRef(null)
  const {
    loadFile,
    setIdleAnimation,
    resumeIdleMotion,
    playAnimationFile,
    playOverlayAnimationFile,
    setFramingValue,
    setViewerOption,
    stopOverlayAnimation,
    setThinkingIndicatorEnabled,
    isLoaded,
  } = useHologramViewer(canvasRef)
  const lastEventIdRef = useRef('')
  const lastAppliedRuntimeSignatureRef = useRef('')

  useEffect(() => {
    const avatar = projectionState.avatar
    if (!avatar?.file) {
      return
    }

    loadFile(avatar.file, {
      defaultFacingYaw: avatar.defaultFacingYaw || 0,
    })
  }, [loadFile, projectionState.avatar, projectionState.fullStateVersion])

  useEffect(() => {
    const idle = projectionState.idle
    if (!idle?.file) {
      return
    }

    setIdleAnimation(idle.file, idle.label, {
      cacheKey: idle.cacheKey || `${idle.assetId || idle.label}:idle`,
    })
  }, [projectionState.idle, projectionState.fullStateVersion, setIdleAnimation])

  useEffect(() => {
    const viewerOptions = projectionState.viewerOptions || DEFAULT_VIEWER_OPTIONS

    setViewerOption('autoBlink', Boolean(viewerOptions.autoBlink))
    setViewerOption('lookAtCamera', Boolean(viewerOptions.lookAtCamera))
  }, [projectionState.viewerOptions, projectionState.settingsVersion, setViewerOption])

  useEffect(() => {
    const framingState = projectionState.framingState || DEFAULT_FRAMING_STATE

    setFramingValue('yaw', normalizeDegrees((framingState.yaw || 0) + panel.yawOffset))
    setFramingValue('tilt', framingState.tilt ?? DEFAULT_FRAMING_STATE.tilt)
    setFramingValue('zoom', framingState.zoom ?? DEFAULT_FRAMING_STATE.zoom)
    setFramingValue('height', framingState.height ?? DEFAULT_FRAMING_STATE.height)
    setFramingValue('shift', framingState.shift ?? DEFAULT_FRAMING_STATE.shift)
  }, [
    isLoaded,
    panel.yawOffset,
    projectionState.framingState,
    projectionState.fullStateVersion,
    projectionState.settingsVersion,
    setFramingValue,
  ])

  useEffect(() => {
    lastAppliedRuntimeSignatureRef.current = ''
  }, [projectionState.fullStateVersion])

  useEffect(() => {
    const runtime = projectionState.runtime
    if (!runtime || !isLoaded) {
      return
    }

    const signature = buildRuntimeSignature(runtime)
    if (signature === lastAppliedRuntimeSignatureRef.current) {
      return
    }

    lastAppliedRuntimeSignatureRef.current = signature
    setThinkingIndicatorEnabled(Boolean(runtime.thinkingIndicatorEnabled))

    if (runtime.activeBaseMotion?.file) {
      playAnimationFile(runtime.activeBaseMotion.file, runtime.activeBaseMotion.label, {
        cacheKey: runtime.activeBaseMotion.cacheKey,
        kind: runtime.activeBaseMotion.kind || 'action',
        loop: Boolean(runtime.activeBaseMotion.loop),
        returnToDefault: runtime.activeBaseMotion.returnToDefault !== false,
        stripExpressionTracks: Boolean(runtime.activeBaseMotion.stripExpressionTracks),
        priority: runtime.activeBaseMotion.priority || 'projection-runtime',
      })
    } else if (projectionState.idle?.file) {
      resumeIdleMotion()
    }

    if (runtime.activeOverlayMotion?.file) {
      playOverlayAnimationFile(runtime.activeOverlayMotion.file, runtime.activeOverlayMotion.label, {
        cacheKey: runtime.activeOverlayMotion.cacheKey,
        expressionOnly: runtime.activeOverlayMotion.expressionOnly !== false,
        loop: Boolean(runtime.activeOverlayMotion.loop),
      })
      return
    }

    stopOverlayAnimation({ immediate: true })
  }, [
    isLoaded,
    playAnimationFile,
    playOverlayAnimationFile,
    projectionState.idle,
    projectionState.runtime,
    projectionState.runtimeVersion,
    resumeIdleMotion,
    setThinkingIndicatorEnabled,
    stopOverlayAnimation,
  ])

  useEffect(() => {
    if (!runtimeEvent?.id || runtimeEvent.id === lastEventIdRef.current) {
      return
    }

    lastEventIdRef.current = runtimeEvent.id

    if (runtimeEvent.kind === 'resume-idle') {
      resumeIdleMotion()
      return
    }

    if (runtimeEvent.kind === 'stop-overlay') {
      stopOverlayAnimation({ immediate: Boolean(runtimeEvent.immediate) })
      return
    }

    if (runtimeEvent.kind === 'play-motion' && runtimeEvent.asset?.file) {
      playAnimationFile(runtimeEvent.asset.file, runtimeEvent.asset.label, {
        cacheKey: runtimeEvent.asset.cacheKey || `${runtimeEvent.asset.assetId || runtimeEvent.asset.label}:projection`,
        kind: runtimeEvent.motionKind || 'action',
        loop: Boolean(runtimeEvent.loop),
        returnToDefault: runtimeEvent.returnToDefault !== false,
        stripExpressionTracks: runtimeEvent.stripExpressionTracks !== false,
        priority: runtimeEvent.priority || 'projection-sync',
      })
      return
    }

    if (runtimeEvent.kind === 'play-overlay' && runtimeEvent.asset?.file) {
      playOverlayAnimationFile(runtimeEvent.asset.file, runtimeEvent.asset.label, {
        cacheKey: runtimeEvent.asset.cacheKey || `${runtimeEvent.asset.assetId || runtimeEvent.asset.label}:projection-overlay`,
        expressionOnly: runtimeEvent.expressionOnly !== false,
        loop: Boolean(runtimeEvent.loop),
      })
    }
  }, [
    playAnimationFile,
    playOverlayAnimationFile,
    resumeIdleMotion,
    runtimeEvent,
    stopOverlayAnimation,
  ])

  return (
    <div
      className="absolute overflow-hidden bg-black"
      style={getProjectionPanelStyle(panel.id)}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${panel.rotationDegrees}deg)`,
          transformOrigin: 'center center',
        }}
      >
        <canvas
          ref={canvasRef}
          className="viewer-canvas pointer-events-none"
          style={{
            transform: 'scaleY(-1)',
            transformOrigin: 'center center',
          }}
          aria-label={`${panel.label} projection`}
        />
      </div>
    </div>
  )
}

export default function HologramProjectionPage() {
  const [projectionState, setProjectionState] = useState(createEmptyProjectionState)
  const [runtimeEvent, setRuntimeEvent] = useState(null)
  const [connectionState, setConnectionState] = useState('waiting')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLeavingProjection, setIsLeavingProjection] = useState(false)
  const channelRef = useRef(null)

  const requestFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') {
      return false
    }

    const element = document.documentElement
    if (!element?.requestFullscreen || document.fullscreenElement) {
      return Boolean(document.fullscreenElement)
    }

    try {
      await element.requestFullscreen()
      return true
    } catch (error) {
      console.warn('Unable to enter hologram fullscreen mode.', error)
      return false
    }
  }, [])

  const exitProjectionMode = useCallback(async () => {
    if (typeof window === 'undefined' || isLeavingProjection) {
      return
    }

    setIsLeavingProjection(true)

    try {
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen()
        } catch (error) {
          console.warn('Unable to leave hologram fullscreen mode cleanly.', error)
        }
      }

      window.close()

      window.setTimeout(() => {
        if (!window.closed) {
          const workspaceUrl = buildPrimaryWorkspaceUrl(window.location)
          if (workspaceUrl) {
            window.location.replace(workspaceUrl)
          }
        }
      }, 180)
    } finally {
      window.setTimeout(() => {
        setIsLeavingProjection(false)
      }, 400)
    }
  }, [isLeavingProjection])

  const requestProjectionState = useCallback(() => {
    const channel = channelRef.current
    if (!channel) {
      return
    }

    channel.postMessage({
      type: 'projection:request-state',
    })
  }, [])

  useEffect(() => {
    const channel = createHologramChannel()
    if (!channel) {
      setConnectionState('unsupported')
      return undefined
    }

    channelRef.current = channel

    const handleMessage = (event) => {
      const message = event?.data || {}

      if (message.type === 'projection:full-state') {
        setProjectionState((current) => ({
          avatar: message.avatar || null,
          idle: message.idle || null,
          thinking: message.thinking || null,
          runtime: message.runtime || null,
          viewerOptions: message.viewerOptions || DEFAULT_VIEWER_OPTIONS,
          framingState: message.framingState || DEFAULT_FRAMING_STATE,
          fullStateVersion: current.fullStateVersion + 1,
          runtimeVersion: current.runtimeVersion + 1,
          settingsVersion: current.settingsVersion + 1,
        }))
        setConnectionState(message.avatar?.file ? 'live' : 'waiting')
        return
      }

      if (message.type === 'projection:settings') {
        setProjectionState((current) => ({
          ...current,
          viewerOptions: message.viewerOptions || current.viewerOptions,
          framingState: message.framingState || current.framingState,
          settingsVersion: current.settingsVersion + 1,
        }))
        return
      }

      if (message.type === 'projection:runtime') {
        setProjectionState((current) => ({
          ...current,
          runtime: message.runtime || null,
          runtimeVersion: current.runtimeVersion + 1,
        }))
        return
      }

      if (message.type === 'projection:enter-fullscreen') {
        void requestFullscreen()
        return
      }

      if (message.type === 'projection:event' && message.event) {
        setRuntimeEvent(message.event)
      }
    }

    channel.addEventListener('message', handleMessage)
    requestProjectionState()
    window.addEventListener('focus', requestProjectionState)

    return () => {
      window.removeEventListener('focus', requestProjectionState)
      channel.removeEventListener('message', handleMessage)
      channel.close()
      channelRef.current = null
    }
  }, [requestFullscreen, requestProjectionState])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [])

  const waitingMessage = useMemo(() => {
    if (connectionState === 'unsupported') {
      return 'This browser does not support BroadcastChannel. Open the projection tab in a current Chromium or Firefox build.'
    }

    if (connectionState === 'live') {
      return ''
    }

    return 'Open this tab from Workspace while an avatar is loaded. The projection layout will attach to the live viewer state automatically.'
  }, [connectionState])

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white">
      <div className="fixed right-4 top-4 z-20 flex items-center gap-3">
        {!isFullscreen ? (
          <button
            type="button"
            onClick={() => {
              void requestFullscreen()
            }}
            className="rounded-full border border-cyan-300/25 bg-[rgba(5,12,18,0.82)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur transition hover:bg-[rgba(9,18,27,0.92)]"
          >
            Enter fullscreen
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void exitProjectionMode()
          }}
          disabled={isLeavingProjection}
          aria-label="Exit hologram mode"
          title="Exit hologram mode"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-red-300/35 bg-[rgba(68,10,16,0.82)] text-xl font-semibold leading-none text-red-100 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur transition hover:bg-[rgba(96,16,24,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          ×
        </button>
      </div>

      <div
        className="relative h-full w-full bg-black"
        style={{
          '--projection-panel-size': 'min(33.333vw, 33.333vh)',
        }}
      >
        {PROJECTION_PANELS.map((panel) => (
          <ProjectionPanel
            key={panel.id}
            panel={panel}
            projectionState={projectionState}
            runtimeEvent={runtimeEvent}
          />
        ))}

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-black">
          <div className="h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.85)]" />
        </div>
      </div>

      {waitingMessage ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
          <div className="max-w-xl rounded-full border border-cyan-300/20 bg-[rgba(5,12,18,0.84)] px-5 py-3 text-center text-sm text-cyan-100 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur">
            {waitingMessage}
          </div>
        </div>
      ) : null}
    </div>
  )
}
