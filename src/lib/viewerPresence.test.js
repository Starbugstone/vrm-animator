import { describe, expect, it } from 'vitest'
import { findThinkingMovementAsset, isSpeechMovementAssetAllowed, pickSpeechMovementAsset } from './viewerPresence'

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

describe('pickSpeechMovementAsset', () => {
  it('prefers emotion-matched action gestures for spoken replies', () => {
    const asset = pickSpeechMovementAsset([
      { id: '1', label: 'Happy Idle', emotionTags: ['happy'], kind: 'idle' },
      { id: '2', label: 'Victory Fingers', emotionTags: ['happy'], kind: 'action' },
    ], 'happy')

    expect(asset?.id).toBe('2')
  })

  it('avoids immediately repeating the same gesture when alternatives exist', () => {
    const asset = pickSpeechMovementAsset([
      { id: '1', label: 'Swing Arms', keywords: ['speech', 'casual'], kind: 'action' },
      { id: '2', label: 'Friendly Wave', keywords: ['speech', 'friendly'], kind: 'action' },
    ], 'neutral', {
      lastAssetId: '1',
      recentAssetIds: ['1'],
    })

    expect(asset?.id).toBe('2')
  })

  it('falls back to conversational body motion when no exact emotion match exists', () => {
    const asset = pickSpeechMovementAsset([
      { id: '1', label: 'Dance Twirl', keywords: ['dance', 'celebrate'], kind: 'action' },
      { id: '2', label: 'Swing Arms', keywords: ['speech', 'casual', 'body'], kind: 'action' },
    ], 'calm')

    expect(asset?.id).toBe('2')
  })

  it('does not select an emotion-conflicting gesture during speech', () => {
    const asset = pickSpeechMovementAsset([
      { id: '1', label: 'Angry Talk Pose', emotionTags: ['angry'], kind: 'action' },
      { id: '2', label: 'Happy Gesture', emotionTags: ['happy'], kind: 'action' },
    ], 'happy')

    expect(asset?.id).toBe('2')
  })

  it('keeps the selected idle as the baseline by excluding idle injections by default', () => {
    const asset = pickSpeechMovementAsset([
      { id: '1', label: 'Happy Idle', emotionTags: ['happy'], kind: 'idle' },
      { id: '2', label: 'Happy Gesture', emotionTags: ['happy'], kind: 'action' },
    ], 'happy')

    expect(asset?.id).toBe('2')
  })
})

describe('isSpeechMovementAssetAllowed', () => {
  it('rejects an angry movement when the active reply emotion is happy', () => {
    const allowed = isSpeechMovementAssetAllowed(
      { id: '1', label: 'Angry Talk Pose', emotionTags: ['angry'], kind: 'action' },
      'happy',
    )

    expect(allowed).toBe(false)
  })

  it('rejects idle motions for reply-time gesture injections by default', () => {
    const allowed = isSpeechMovementAssetAllowed(
      { id: '1', label: 'Happy Idle', emotionTags: ['happy'], kind: 'idle' },
      'happy',
    )

    expect(allowed).toBe(false)
  })
})
