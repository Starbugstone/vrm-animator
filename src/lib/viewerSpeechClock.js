export const MIN_SPEECH_DURATION_MS = 1800
export const SPEECH_DURATION_PADDING_MS = 1200
export const MIN_SPEECH_RATE = 0.6
export const SPEECH_RELEASE_MIN_DELAY_MS = 80

export function getSpeechClockNowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function createEmptySpeechClockState() {
  return {
    sessionId: 0,
    active: false,
    source: 'idle',
    timingKind: 'estimated',
    startedAt: 0,
    lastActivityAt: 0,
    totalDurationMs: 0,
    playbackRate: 1,
  }
}

export function estimateSpeechDurationMs(text, rate = 1) {
  const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length
  if (wordCount === 0) {
    return 0
  }

  const normalizedRate = Math.max(Number(rate) || 1, MIN_SPEECH_RATE)
  const wordsPerMinute = 165 * normalizedRate
  const minutes = wordCount / wordsPerMinute

  return Math.max(MIN_SPEECH_DURATION_MS, Math.ceil(minutes * 60_000) + SPEECH_DURATION_PADDING_MS)
}

export function createSpeechClock(options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : getSpeechClockNowMs()
  const playbackRate = Number.isFinite(Number(options.rate)) ? Number(options.rate) : 1
  const explicitDurationMs = Number.isFinite(Number(options.totalDurationMs))
    ? Math.max(0, Number(options.totalDurationMs))
    : null

  return {
    sessionId: Number.isFinite(Number(options.sessionId)) ? Number(options.sessionId) : 0,
    active: true,
    source: String(options.source || 'speech'),
    timingKind: String(options.timingKind || 'estimated'),
    startedAt: now,
    lastActivityAt: now,
    totalDurationMs: explicitDurationMs ?? estimateSpeechDurationMs(options.text || '', playbackRate),
    playbackRate,
  }
}

export function recordSpeechClockActivity(clock, options = {}) {
  if (!clock?.active) {
    return clock || createEmptySpeechClockState()
  }

  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : getSpeechClockNowMs()

  return {
    ...clock,
    lastActivityAt: now,
  }
}

export function syncSpeechClockDuration(clock, options = {}) {
  if (!clock?.active) {
    return clock || createEmptySpeechClockState()
  }

  const playbackRate = Number.isFinite(Number(options.rate))
    ? Number(options.rate)
    : (clock.playbackRate || 1)
  const explicitDurationMs = Number.isFinite(Number(options.totalDurationMs))
    ? Math.max(0, Number(options.totalDurationMs))
    : null
  const estimatedDurationMs = explicitDurationMs ?? estimateSpeechDurationMs(options.text || '', playbackRate)

  return {
    ...clock,
    playbackRate,
    totalDurationMs: Math.max(clock.totalDurationMs || 0, estimatedDurationMs),
  }
}

export function getSpeechClockElapsedMs(clock, options = {}) {
  if (!clock?.active || clock.startedAt === null || clock.startedAt === undefined) {
    return 0
  }

  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : getSpeechClockNowMs()
  return Math.max(0, now - clock.startedAt)
}

export function getSpeechClockRemainingMs(clock, options = {}) {
  if (!clock?.active) {
    return 0
  }

  return Math.max(0, (clock.totalDurationMs || 0) - getSpeechClockElapsedMs(clock, options))
}

export function getSpeechClockReleaseDelayMs(clock, options = {}) {
  const boundaryReleaseMs = Number.isFinite(Number(options.boundaryReleaseMs))
    ? Number(options.boundaryReleaseMs)
    : 0
  const overlayReleaseMs = Number.isFinite(Number(options.overlayReleaseMs))
    ? Number(options.overlayReleaseMs)
    : 0
  const minDelayMs = Number.isFinite(Number(options.minDelayMs))
    ? Number(options.minDelayMs)
    : SPEECH_RELEASE_MIN_DELAY_MS

  if (!clock?.active || clock.lastActivityAt === null || clock.lastActivityAt === undefined) {
    return Math.max(minDelayMs, overlayReleaseMs)
  }

  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : getSpeechClockNowMs()
  const elapsedSinceActivity = Math.max(0, now - clock.lastActivityAt)

  return Math.max(minDelayMs, boundaryReleaseMs - elapsedSinceActivity)
}
