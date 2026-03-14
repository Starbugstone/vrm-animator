import { describe, expect, it } from 'vitest'
import { pickExpressionAsset, pickSilentExpressionAsset } from './viewerExpressions.js'

describe('pickExpressionAsset', () => {
  it('prefers speech-tagged overlays for spoken replies when requested', () => {
    const asset = pickExpressionAsset([
      { id: '1', label: 'Neutral Eyes', emotionTags: ['neutral'], channels: ['eyes'] },
      { id: '2', label: 'Neutral Speech', emotionTags: ['neutral'], tags: ['speech'], channels: ['mouth', 'eyes'] },
    ], 'neutral', { preferSpeech: true })

    expect(asset?.id).toBe('2')
  })

  it('avoids speech fallback overlays for silent thinking states', () => {
    const asset = pickSilentExpressionAsset([
      { id: '1', label: 'Thinking Mouth', emotionTags: ['thinking'], tags: ['speech'], channels: ['mouth', 'eyes'] },
      { id: '2', label: 'Calm Mouth', emotionTags: ['calm'], tags: ['fallback'], channels: ['mouth', 'eyes'] },
    ], ['thinking', 'calm', 'neutral'], {
      excludedChannels: ['mouth'],
    })

    expect(asset).toBeNull()
  })

  it('can fall back to a non-mouth calm overlay during thinking', () => {
    const asset = pickSilentExpressionAsset([
      { id: '1', label: 'Neutral Speech', emotionTags: ['neutral'], tags: ['speech'], channels: ['mouth', 'eyes'] },
      { id: '2', label: 'Calm Eyes', emotionTags: ['calm'], channels: ['eyes', 'face'], weight: 2 },
    ], ['thinking', 'calm', 'neutral'], {
      excludedChannels: ['mouth'],
    })

    expect(asset?.id).toBe('2')
  })
})
