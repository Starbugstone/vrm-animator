import { describe, expect, it } from 'vitest'
import {
  pickThinkingInjectionAsset,
  sampleThinkingInjectionDelay,
  THINKING_INJECTION_MAX_MS,
  THINKING_INJECTION_MIN_MS,
} from './viewerThinking.js'

describe('sampleThinkingInjectionDelay', () => {
  it('stays within the configured injection window', () => {
    expect(sampleThinkingInjectionDelay(0)).toBe(THINKING_INJECTION_MIN_MS)
    expect(sampleThinkingInjectionDelay(1)).toBe(THINKING_INJECTION_MAX_MS)
  })
})

describe('pickThinkingInjectionAsset', () => {
  it('prefers dedicated thinking assets over idle assets', () => {
    const asset = pickThinkingInjectionAsset({
      thinkingItems: [
        { id: 'think-1', label: 'Focus' },
      ],
      idleItems: [
        { id: 'idle-1', label: 'Main Idle' },
      ],
    })

    expect(asset?.id).toBe('think-1')
  })

  it('avoids repeating the same thinking asset when alternatives exist', () => {
    const asset = pickThinkingInjectionAsset({
      thinkingItems: [
        { id: 'think-1', label: 'Focus' },
        { id: 'think-2', label: 'Head Nod' },
      ],
      lastAssetId: 'think-1',
      randomValue: 0,
    })

    expect(asset?.id).toBe('think-2')
  })

  it('can reuse the same asset when it is the only thinking option', () => {
    const asset = pickThinkingInjectionAsset({
      thinkingItems: [
        { id: 'think-1', label: 'Focus' },
      ],
      lastAssetId: 'think-1',
      randomValue: 0,
    })

    expect(asset?.id).toBe('think-1')
  })

  it('falls back to inferred waiting motions when no dedicated thinking asset exists', () => {
    const asset = pickThinkingInjectionAsset({
      actionItems: [
        { id: 'action-1', label: 'Wave', keywords: ['hello'], kind: 'action' },
        { id: 'action-2', label: 'Thinking Pose', keywords: ['thinking'], kind: 'action' },
      ],
      idleItems: [
        { id: 'idle-1', label: 'Main Idle', keywords: ['idle'], kind: 'idle' },
      ],
    })

    expect(asset?.id).toBe('action-2')
  })
})
