import { findThinkingMovementAsset } from './viewerPresence.js'

export const THINKING_INJECTION_MIN_MS = 5200
export const THINKING_INJECTION_MAX_MS = 9800

export function sampleThinkingInjectionDelay(randomValue = Math.random()) {
  const normalized = Number.isFinite(randomValue)
    ? Math.min(1, Math.max(0, randomValue))
    : Math.random()

  return Math.round(
    THINKING_INJECTION_MIN_MS + normalized * (THINKING_INJECTION_MAX_MS - THINKING_INJECTION_MIN_MS),
  )
}

export function pickThinkingInjectionAsset({
  thinkingItems = [],
  idleItems = [],
  actionItems = [],
  lastAssetId = '',
  randomValue = Math.random(),
} = {}) {
  if (thinkingItems.length > 0) {
    const uniquePool = thinkingItems.filter((item) => item?.id !== lastAssetId)
    const pool = uniquePool.length > 0 ? uniquePool : thinkingItems
    const normalized = Number.isFinite(randomValue)
      ? Math.min(0.999999, Math.max(0, randomValue))
      : Math.random()
    const index = Math.floor(normalized * pool.length)

    return pool[index] || null
  }

  return findThinkingMovementAsset([...actionItems, ...idleItems])
}
