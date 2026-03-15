export const MOTION_PRIORITIES = {
  idle: 10,
  ambient: 10,
  speechInjection: 20,
  speechExplicit: 30,
  thinking: 40,
  userMessage: 50,
  manual: 35,
}

const PRIORITY_ALIASES = {
  idle: 'idle',
  ambient: 'ambient',
  action: 'speechInjection',
  speech: 'speechInjection',
  'speech-injection': 'speechInjection',
  cue: 'speechExplicit',
  explicit: 'speechExplicit',
  'speech-explicit': 'speechExplicit',
  thinking: 'thinking',
  'user-message': 'userMessage',
  manual: 'manual',
  preview: 'manual',
}

const MIN_PROTECTED_ACTION_SECONDS = 0.24
const MAX_PROTECTED_ACTION_SECONDS = 1.15
const PROTECTED_ACTION_RATIO = 0.45
const MIN_HANDOFF_SECONDS = 0.18
const MAX_HANDOFF_SECONDS = 0.6
const HANDOFF_RATIO = 0.22

export function isAmbientMotionKind(kind) {
  return kind === 'idle' || kind === 'thinking'
}

export function resolveMotionPriority(kind = 'action', requestedPriority = null) {
  if (Number.isFinite(Number(requestedPriority))) {
    return Number(requestedPriority)
  }

  const normalizedPriority = String(requestedPriority || '').trim().toLowerCase()
  if (normalizedPriority && PRIORITY_ALIASES[normalizedPriority]) {
    return MOTION_PRIORITIES[PRIORITY_ALIASES[normalizedPriority]]
  }

  if (kind === 'idle') {
    return MOTION_PRIORITIES.idle
  }

  if (kind === 'thinking') {
    return MOTION_PRIORITIES.thinking
  }

  return MOTION_PRIORITIES.speechInjection
}

export function buildMotionRuntimeMeta({ kind = 'action', priority = null, duration = 0, nowMs = 0 } = {}) {
  const safeDuration = Math.max(0, Number(duration) || 0)
  const ambient = isAmbientMotionKind(kind)

  return {
    priority: resolveMotionPriority(kind, priority),
    startedAtMs: Number.isFinite(Number(nowMs)) ? Number(nowMs) : 0,
    minHoldSeconds: ambient || safeDuration === 0
      ? 0
      : Math.min(MAX_PROTECTED_ACTION_SECONDS, Math.max(MIN_PROTECTED_ACTION_SECONDS, safeDuration * PROTECTED_ACTION_RATIO)),
    handoffWindowSeconds: ambient || safeDuration === 0
      ? 0
      : Math.min(MAX_HANDOFF_SECONDS, Math.max(MIN_HANDOFF_SECONDS, safeDuration * HANDOFF_RATIO)),
  }
}

export function shouldQueueBaseMotion({ activeMotion, nextMotion, previousMotion } = {}) {
  if (!activeMotion) {
    return false
  }

  if (previousMotion) {
    return true
  }

  if (isAmbientMotionKind(activeMotion.kind)) {
    return false
  }

  const currentTime = Math.max(0, Number(activeMotion?.action?.time) || 0)
  const duration = Math.max(0, Number(activeMotion?.duration) || 0)
  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0
  const activePriority = resolveMotionPriority(activeMotion.kind, activeMotion.priority)
  const nextPriority = resolveMotionPriority(nextMotion?.kind, nextMotion?.priority)

  if (nextPriority > activePriority) {
    return currentTime < Math.max(0, Number(activeMotion.minHoldSeconds) || 0)
  }

  if (duration <= 0) {
    return true
  }

  return remaining > Math.max(0, Number(activeMotion.handoffWindowSeconds) || 0)
}

export function shouldPromoteQueuedBaseMotion({ activeMotion, queuedMotion, previousMotion } = {}) {
  if (!queuedMotion) {
    return false
  }

  if (!activeMotion) {
    return true
  }

  if (previousMotion) {
    return false
  }

  if (isAmbientMotionKind(activeMotion.kind)) {
    return true
  }

  const currentTime = Math.max(0, Number(activeMotion?.action?.time) || 0)
  const duration = Math.max(0, Number(activeMotion?.duration) || 0)
  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0
  const activePriority = resolveMotionPriority(activeMotion.kind, activeMotion.priority)
  const queuedPriority = resolveMotionPriority(queuedMotion.kind, queuedMotion.priority)

  if (queuedPriority > activePriority) {
    return currentTime >= Math.max(0, Number(activeMotion.minHoldSeconds) || 0)
  }

  return duration <= 0 || remaining <= Math.max(0, Number(activeMotion.handoffWindowSeconds) || 0)
}

export function shouldReplaceQueuedMotion(currentQueuedMotion, nextMotion) {
  if (!currentQueuedMotion) {
    return true
  }

  const currentPriority = resolveMotionPriority(currentQueuedMotion.kind, currentQueuedMotion.priority)
  const nextPriority = resolveMotionPriority(nextMotion?.kind, nextMotion?.priority)

  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority
  }

  return (Number(nextMotion?.queuedAtMs) || 0) >= (Number(currentQueuedMotion.queuedAtMs) || 0)
}
