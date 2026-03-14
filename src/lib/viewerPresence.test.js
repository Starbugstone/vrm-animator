import { describe, expect, it } from 'vitest'
import { findThinkingMovementAsset } from './viewerPresence'

describe('findThinkingMovementAsset', () => {
  it('prefers an asset tagged for thinking-style waiting motions', () => {
    const asset = findThinkingMovementAsset([
      { id: '1', label: 'Greeting', keywords: ['hello'] },
      { id: '2', label: 'Ponder Loop', keywords: ['pondering', 'idle'], kind: 'action' },
    ])

    expect(asset?.id).toBe('2')
  })

  it('matches thinking hints from descriptions and prefers actions over idles', () => {
    const asset = findThinkingMovementAsset([
      { id: '1', label: 'Wait Loop', description: 'A thoughtful idle sway.', kind: 'idle' },
      { id: '2', label: 'Thinking Pose', description: 'Short reflective action.', kind: 'action' },
    ])

    expect(asset?.id).toBe('2')
  })

  it('prefers an explicit thinking category over generic movement matches', () => {
    const asset = findThinkingMovementAsset([
      { id: '1', label: 'Look Around', keywords: ['thinking'], kind: 'idle' },
      { id: '2', label: 'Focus', keywords: ['waiting'], kind: 'thinking' },
    ])

    expect(asset?.id).toBe('2')
  })

  it('uses weight as a tie-breaker when multiple assets fit', () => {
    const asset = findThinkingMovementAsset([
      { id: '1', label: 'Think Left', keywords: ['thinking'], kind: 'action', weight: 2 },
      { id: '2', label: 'Think Right', keywords: ['thinking'], kind: 'action', weight: 8 },
    ])

    expect(asset?.id).toBe('2')
  })

  it('returns null when no thinking-like asset is available', () => {
    const asset = findThinkingMovementAsset([
      { id: '1', label: 'Greeting', keywords: ['hello'] },
      { id: '2', label: 'Celebration', keywords: ['victory'] },
    ])

    expect(asset).toBeNull()
  })
})
