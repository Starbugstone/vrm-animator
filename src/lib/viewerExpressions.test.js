import { describe, expect, it } from 'vitest'
import { isExpressionAssetAllowed, pickExpressionAsset, pickSilentExpressionAsset, pickThinkingExpressionAsset } from './viewerExpressions.js'

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

  it('supports smile and wink as explicit expression cues', () => {
    const smile = pickExpressionAsset([
      { id: '1', label: 'Happy Talk', tags: ['speech', 'happy'], channels: ['mouth', 'eyes', 'face'], weight: 1 },
      { id: '2', label: 'Smile', tags: ['smile', 'happy', 'reaction'], channels: ['eyes', 'face'], weight: 3 },
    ], 'smile')

    const wink = pickExpressionAsset([
      { id: '1', label: 'Playful Talk', tags: ['speech', 'playful'], channels: ['mouth', 'eyes', 'face'], weight: 1 },
      { id: '2', label: 'Wink', tags: ['wink', 'playful', 'reaction'], channels: ['eyes', 'face'], weight: 3 },
    ], 'wink')

    expect(smile?.id).toBe('2')
    expect(wink?.id).toBe('2')
  })

  it('rejects direct speech overlays during silent thinking playback', () => {
    const allowed = isExpressionAssetAllowed(
      { id: '1', label: 'Thinking Mouth', tags: ['speech', 'thinking'], channels: ['mouth', 'eyes'] },
      {
        preferSpeech: false,
        allowSpeechFallback: false,
        excludedChannels: ['mouth'],
      },
    )

    expect(allowed).toBe(false)
  })

  it('only auto-picks explicitly tagged thinking expressions for the waiting state', () => {
    const noConfiguredThinking = pickThinkingExpressionAsset([
      { id: '1', label: 'Calm Eyes', emotionTags: ['calm'], channels: ['eyes', 'face'] },
      { id: '2', label: 'Neutral Speech', tags: ['speech', 'neutral'], channels: ['mouth', 'eyes'] },
    ], {
      excludedChannels: ['mouth'],
    })

    const configuredThinking = pickThinkingExpressionAsset([
      { id: '1', label: 'Calm Eyes', emotionTags: ['calm'], channels: ['eyes', 'face'] },
      { id: '2', label: 'Thinking Eyes', emotionTags: ['thinking'], channels: ['eyes', 'face'] },
    ], {
      excludedChannels: ['mouth'],
    })

    expect(noConfiguredThinking).toBeNull()
    expect(configuredThinking?.id).toBe('2')
  })
})
