import { describe, expect, it } from 'vitest'
import {
  createEmptySpeechClockState,
  createSpeechClock,
  estimateSpeechDurationMs,
  getSpeechClockElapsedMs,
  getSpeechClockReleaseDelayMs,
  getSpeechClockRemainingMs,
  recordSpeechClockActivity,
  syncSpeechClockDuration,
} from './viewerSpeechClock.js'

describe('estimateSpeechDurationMs', () => {
  it('returns zero for blank text', () => {
    expect(estimateSpeechDurationMs('')).toBe(0)
  })

  it('pads non-empty text to a sensible minimum duration', () => {
    expect(estimateSpeechDurationMs('Short line.')).toBeGreaterThanOrEqual(1800)
  })
})

describe('speech clock state', () => {
  it('creates an empty inactive clock', () => {
    expect(createEmptySpeechClockState()).toEqual({
      sessionId: 0,
      active: false,
      source: 'idle',
      timingKind: 'estimated',
      startedAt: 0,
      lastActivityAt: 0,
      totalDurationMs: 0,
      playbackRate: 1,
    })
  })

  it('tracks elapsed and remaining playback from a shared start time', () => {
    const clock = createSpeechClock({
      sessionId: 7,
      source: 'browser-speech',
      timingKind: 'boundary-events',
      totalDurationMs: 4200,
      now: 1000,
    })

    expect(getSpeechClockElapsedMs(clock, { now: 2500 })).toBe(1500)
    expect(getSpeechClockRemainingMs(clock, { now: 2500 })).toBe(2700)
  })

  it('records new activity without changing the reply start time', () => {
    const clock = createSpeechClock({
      sessionId: 4,
      totalDurationMs: 3000,
      now: 500,
    })

    const updatedClock = recordSpeechClockActivity(clock, { now: 1100 })

    expect(updatedClock.startedAt).toBe(500)
    expect(updatedClock.lastActivityAt).toBe(1100)
  })

  it('extends duration for the same reply without shrinking it', () => {
    const clock = createSpeechClock({
      sessionId: 2,
      text: 'Short reply.',
      rate: 1,
      now: 100,
    })

    const extendedClock = syncSpeechClockDuration(clock, {
      text: 'Short reply. This grew into a much longer answer with more words to speak aloud.',
      rate: 1,
    })
    const shrunkClock = syncSpeechClockDuration(extendedClock, {
      totalDurationMs: 1200,
    })

    expect(extendedClock.startedAt).toBe(100)
    expect(extendedClock.totalDurationMs).toBeGreaterThan(clock.totalDurationMs)
    expect(shrunkClock.totalDurationMs).toBe(extendedClock.totalDurationMs)
  })

  it('derives overlay release delay from the last speech activity when available', () => {
    const clock = createSpeechClock({
      sessionId: 9,
      totalDurationMs: 3000,
      now: 1000,
    })
    const activeClock = recordSpeechClockActivity(clock, { now: 1450 })

    expect(getSpeechClockReleaseDelayMs(activeClock, {
      now: 1500,
      boundaryReleaseMs: 180,
      overlayReleaseMs: 220,
    })).toBe(130)

    expect(getSpeechClockReleaseDelayMs(createEmptySpeechClockState(), {
      now: 1500,
      boundaryReleaseMs: 180,
      overlayReleaseMs: 220,
    })).toBe(220)
  })
})
