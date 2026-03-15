import { describe, expect, it } from 'vitest'
import {
  buildMotionRuntimeMeta,
  isAmbientMotionKind,
  resolveMotionPriority,
  shouldPromoteQueuedBaseMotion,
  shouldQueueBaseMotion,
  shouldReplaceQueuedMotion,
} from './viewerMotionQueue.js'

describe('viewer motion queue', () => {
  it('detects ambient motion kinds', () => {
    expect(isAmbientMotionKind('idle')).toBe(true)
    expect(isAmbientMotionKind('thinking')).toBe(true)
    expect(isAmbientMotionKind('action')).toBe(false)
  })

  it('assigns stronger priorities to user-message and explicit cues', () => {
    expect(resolveMotionPriority('action', 'speech-injection')).toBeLessThan(resolveMotionPriority('action', 'speech-explicit'))
    expect(resolveMotionPriority('thinking', 'user-message')).toBeGreaterThan(resolveMotionPriority('thinking', 'speech-explicit'))
  })

  it('queues equal-priority follow-up actions until the current clip reaches its handoff window', () => {
    const activeMotion = {
      kind: 'action',
      duration: 2.0,
      action: { time: 0.5 },
      ...buildMotionRuntimeMeta({ kind: 'action', priority: 'speech-explicit', duration: 2.0 }),
    }

    expect(shouldQueueBaseMotion({
      activeMotion,
      nextMotion: { kind: 'action', priority: 'speech-explicit' },
      previousMotion: null,
    })).toBe(true)

    activeMotion.action.time = 1.75

    expect(shouldQueueBaseMotion({
      activeMotion,
      nextMotion: { kind: 'action', priority: 'speech-explicit' },
      previousMotion: null,
    })).toBe(false)
  })

  it('lets higher-priority user-message motions interrupt after the protected lead-in', () => {
    const activeMotion = {
      kind: 'action',
      duration: 2.0,
      action: { time: 0.2 },
      ...buildMotionRuntimeMeta({ kind: 'action', priority: 'speech-explicit', duration: 2.0 }),
    }

    expect(shouldQueueBaseMotion({
      activeMotion,
      nextMotion: { kind: 'thinking', priority: 'user-message' },
      previousMotion: null,
    })).toBe(true)

    activeMotion.action.time = activeMotion.minHoldSeconds + 0.05

    expect(shouldQueueBaseMotion({
      activeMotion,
      nextMotion: { kind: 'thinking', priority: 'user-message' },
      previousMotion: null,
    })).toBe(false)
  })

  it('promotes queued motions once the active action reaches a safe handoff point', () => {
    const activeMotion = {
      kind: 'action',
      duration: 2.0,
      action: { time: 0.4 },
      ...buildMotionRuntimeMeta({ kind: 'action', priority: 'speech-explicit', duration: 2.0 }),
    }

    expect(shouldPromoteQueuedBaseMotion({
      activeMotion,
      queuedMotion: { kind: 'action', priority: 'speech-explicit' },
      previousMotion: null,
    })).toBe(false)

    activeMotion.action.time = 1.82

    expect(shouldPromoteQueuedBaseMotion({
      activeMotion,
      queuedMotion: { kind: 'action', priority: 'speech-explicit' },
      previousMotion: null,
    })).toBe(true)
  })

  it('waits for an in-progress crossfade before promoting another queued motion', () => {
    const activeMotion = {
      kind: 'action',
      duration: 2.0,
      action: { time: 1.9 },
      ...buildMotionRuntimeMeta({ kind: 'action', priority: 'speech-explicit', duration: 2.0 }),
    }

    expect(shouldQueueBaseMotion({
      activeMotion,
      nextMotion: { kind: 'action', priority: 'speech-explicit' },
      previousMotion: { kind: 'idle' },
    })).toBe(true)

    expect(shouldPromoteQueuedBaseMotion({
      activeMotion,
      queuedMotion: { kind: 'action', priority: 'speech-explicit' },
      previousMotion: { kind: 'idle' },
    })).toBe(false)
  })

  it('keeps a stronger queued motion instead of replacing it with a weaker one', () => {
    const currentQueued = { kind: 'thinking', priority: 'user-message', queuedAtMs: 100 }

    expect(shouldReplaceQueuedMotion(currentQueued, {
      kind: 'action',
      priority: 'speech-injection',
      queuedAtMs: 200,
    })).toBe(false)
  })
})
