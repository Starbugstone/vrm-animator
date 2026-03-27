import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useHologramViewer from '../useHologramViewer.js'
import { createHologramChannel, PIXELXL_PRISM_WINDOW_PRESET } from '../lib/hologramProjection.js'

const PROJECTION_PANELS = [
  {
    id: 'top',
    label: 'Back',
    yawOffset: 180,
    cellClassName: 'col-start-2 row-start-1',
    canvasClassName: 'rotate-180',
  },
  {
    id: 'left',
    label: 'Left',
    yawOffset: 90,
    cellClassName: 'col-start-1 row-start-2',
    canvasClassName: 'rotate-90',
  },
  {
    id: 'right',
    label: 'Right',
    yawOffset: -90,
    cellClassName: 'col-start-3 row-start-2',
    canvasClassName: '-rotate-90',
  },
  {
    id: 'bottom',
    label: 'Front',
    yawOffset: 0,
    cellClassName: 'col-start-2 row-start-3',
    canvasClassName: '',
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
    viewerOptions: DEFAULT_VIEWER_OPTIONS,
    framingState: DEFAULT_FRAMING_STATE,
    fullStateVersion: 0,
    settingsVersion: 0,
  }
}

function normalizeDegrees(value) {
  const numericValue = Number(value) || 0
  const normalizedValue = ((numericValue % 360) + 360) % 360
  return normalizedValue > 180 ? normalizedValue - 360 : normalizedValue
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
  } = useHologramViewer(canvasRef)
  const lastEventIdRef = useRef('')

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
  }, [panel.yawOffset, projectionState.framingState, projectionState.settingsVersion, setFramingValue])

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
    <div className={`${panel.cellClassName} relative overflow-hidden rounded-[20px] bg-black`}>
      <canvas
        ref={canvasRef}
        className={`viewer-canvas pointer-events-none origin-center ${panel.canvasClassName}`.trim()}
        aria-label={`${panel.label} projection`}
      />
    </div>
  )
}

export default function HologramProjectionPage() {
  const [projectionState, setProjectionState] = useState(createEmptyProjectionState)
  const [runtimeEvent, setRuntimeEvent] = useState(null)
  const [connectionState, setConnectionState] = useState('waiting')
  const channelRef = useRef(null)

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
          viewerOptions: message.viewerOptions || DEFAULT_VIEWER_OPTIONS,
          framingState: message.framingState || DEFAULT_FRAMING_STATE,
          fullStateVersion: current.fullStateVersion + 1,
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
  }, [requestProjectionState])

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
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="grid aspect-square w-full max-w-full grid-cols-3 grid-rows-3 gap-2 bg-black"
          style={{
            maxWidth: `min(calc(100vw - 2rem), calc(100vh - 2rem), ${PIXELXL_PRISM_WINDOW_PRESET.height}px)`,
            maxHeight: `min(calc(100vw - 2rem), calc(100vh - 2rem), ${PIXELXL_PRISM_WINDOW_PRESET.height}px)`,
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

          <div className="col-start-2 row-start-2 rounded-[20px] bg-black" />
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
