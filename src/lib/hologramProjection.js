export const HOLOGRAM_ROUTE_VIEW = 'hologram'
export const HOLOGRAM_CHANNEL_NAME = 'vrm-animator:hologram-projection'

export const PIXELXL_PRISM_WINDOW_PRESET = {
  width: 1280,
  height: 800,
}

export function isHologramProjectionView(search = '') {
  if (!search) {
    return false
  }

  const params = new URLSearchParams(search)
  return params.get('view') === HOLOGRAM_ROUTE_VIEW
}

export function buildHologramProjectionUrl(locationLike) {
  const location = locationLike || (typeof window !== 'undefined' ? window.location : null)
  if (!location) {
    return ''
  }

  const url = new URL(location.href)
  url.searchParams.set('view', HOLOGRAM_ROUTE_VIEW)
  return url.toString()
}

export function buildHologramWindowFeatures(size = PIXELXL_PRISM_WINDOW_PRESET) {
  const width = Math.max(640, Math.round(Number(size?.width) || PIXELXL_PRISM_WINDOW_PRESET.width))
  const height = Math.max(640, Math.round(Number(size?.height) || PIXELXL_PRISM_WINDOW_PRESET.height))

  return [
    'popup=yes',
    'noopener=yes',
    'noreferrer=yes',
    `width=${width}`,
    `height=${height}`,
  ].join(',')
}

export function createHologramChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null
  }

  return new BroadcastChannel(HOLOGRAM_CHANNEL_NAME)
}
