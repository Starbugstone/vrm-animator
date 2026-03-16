import { useEffect, useMemo, useRef, useState } from 'react'
import useHologramViewer from '../useHologramViewer.js'
import { assetToFile } from '../lib/viewerAssets.js'
import { deriveSavedFacingYawDegrees, normalizeFacingYawDegrees } from '../lib/avatarFacing.js'

export default function AvatarPreviewCard({
  asset = null,
  file = null,
  title = 'Avatar preview',
  helper = 'Select an avatar or choose a VRM file to inspect it here before editing.',
  emptyLabel = 'Choose an avatar or upload a VRM file to preview it.',
  defaultFacingYaw = 0,
  onSaveDefaultFacing = null,
  saveFacingBusy = false,
}) {
  const canvasRef = useRef(null)
  const [notice, setNotice] = useState('')
  const { loadFile, status, isLoaded, isAvatarLoading, framingState } = useHologramViewer(canvasRef)

  const activeLabel = useMemo(() => {
    if (file) return file.name
    if (asset) return asset.label || asset.name || 'Avatar preview'
    return 'No avatar loaded'
  }, [asset, file])

  useEffect(() => {
    if (!file && !asset) {
      setNotice('')
      return
    }

    let cancelled = false

    async function loadPreview() {
      try {
        const nextFile = file || (await assetToFile(asset))
        if (!nextFile || cancelled) return
        loadFile(nextFile, {
          defaultFacingYaw,
        })
        setNotice('')
      } catch (error) {
        if (!cancelled) {
          setNotice(error.message || 'Unable to load the avatar preview.')
        }
      }
    }

    loadPreview()

    return () => {
      cancelled = true
    }
  }, [asset, defaultFacingYaw, file, loadFile])

  const savedFacingLabel = useMemo(
    () => `${normalizeFacingYawDegrees(defaultFacingYaw)} deg`,
    [defaultFacingYaw],
  )

  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">{title}</div>
          <div className="mt-2 text-sm text-white/60">{helper}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
          {isAvatarLoading ? 'Loading' : status}
        </div>
      </div>

      <div className="relative mt-4 h-[440px] overflow-hidden rounded-[28px] border border-cyan-300/15 bg-black/30">
        <canvas ref={canvasRef} className="viewer-canvas" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
          <div className="rounded-full border border-cyan-300/20 bg-black/35 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-cyan-100/90 backdrop-blur">
            {activeLabel}
          </div>
        </div>

        {!isLoaded && !isAvatarLoading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-[24px] border border-cyan-300/16 bg-[rgba(3,7,18,0.58)] px-5 py-4 text-center text-sm leading-6 text-white/78 shadow-[0_0_56px_rgba(34,211,238,0.1)] backdrop-blur">
              {emptyLabel}
            </div>
          </div>
        ) : null}
      </div>

      {onSaveDefaultFacing ? (
        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Default facing</div>
              <div className="mt-1 text-sm text-white/60">
                Rotate the preview until the avatar looks right, then save that view as the starting direction.
              </div>
              <div className="mt-2 text-xs text-white/45">Saved yaw: {savedFacingLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => onSaveDefaultFacing(deriveSavedFacingYawDegrees(defaultFacingYaw, framingState.yaw))}
              disabled={!isLoaded || isAvatarLoading || saveFacingBusy}
              className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveFacingBusy ? 'Saving facing...' : 'Use current view as default'}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {notice}
        </div>
      ) : null}
    </section>
  )
}
