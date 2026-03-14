import { describe, expect, it } from 'vitest'
import {
  buildSpeechCuePlan,
  sampleSpeechMotionDelay,
  SPEECH_MOTION_INJECTION_MAX_MS,
  SPEECH_MOTION_INJECTION_MIN_MS,
  takeSpeakableSpeechChunk,
} from './viewerSpeech.js'

describe('takeSpeakableSpeechChunk', () => {
  it('waits until a full paragraph is available during streaming', () => {
    const result = takeSpeakableSpeechChunk('Hello there. More will come later.', 0)

    expect(result).toBeNull()
  })

  it('emits the completed paragraph when a blank-line boundary arrives', () => {
    const result = takeSpeakableSpeechChunk('First paragraph.\n\nSecond paragraph starts here.', 0)

    expect(result).toEqual({
      chunk: 'First paragraph.',
      nextIndex: 18,
    })
  })

  it('skips paragraph separators and can continue from the next paragraph', () => {
    const result = takeSpeakableSpeechChunk('First paragraph.\n\nSecond paragraph starts here.\n\nThird.', 18)

    expect(result).toEqual({
      chunk: 'Second paragraph starts here.',
      nextIndex: 49,
    })
  })

  it('flushes the remaining paragraph when the stream completes', () => {
    const result = takeSpeakableSpeechChunk('Trailing partial reply', 0, { final: true })

    expect(result).toEqual({
      chunk: 'Trailing partial reply',
      nextIndex: 22,
    })
  })
})

describe('sampleSpeechMotionDelay', () => {
  it('stays within the configured speaking-motion window', () => {
    expect(sampleSpeechMotionDelay(0)).toBe(SPEECH_MOTION_INJECTION_MIN_MS)
    expect(sampleSpeechMotionDelay(1)).toBe(SPEECH_MOTION_INJECTION_MAX_MS)
  })
})

describe('buildSpeechCuePlan', () => {
  it('turns cue-tagged timeline segments into timed speech beats', () => {
    const plan = buildSpeechCuePlan([
      { type: 'emotion', value: 'happy', assetId: 'expr-happy' },
      { type: 'animation', value: 'Swing Arms', assetId: 'anim-swing', delayMs: 2500 },
      { type: 'text', value: 'Hey there friend.' },
      { type: 'emotion', value: 'calm', assetId: 'expr-calm' },
      { type: 'text', value: 'Let me explain that more carefully.' },
    ], {
      fallbackText: 'Hey there friend. Let me explain that more carefully.',
      fallbackEmotion: 'neutral',
    })

    expect(plan.explicitAnimationCount).toBe(1)
    expect(plan.distinctEmotions).toEqual(['happy', 'calm'])
    expect(plan.beats).toEqual([
      expect.objectContaining({
        index: 0,
        emotion: 'happy',
        emotionAssetId: 'expr-happy',
        animationTag: 'Swing Arms',
        animationAssetId: 'anim-swing',
        animationDelayMs: 2500,
        hasExplicitAnimation: true,
        offsetRatio: 0,
      }),
      expect.objectContaining({
        index: 1,
        emotion: 'calm',
        emotionAssetId: 'expr-calm',
        animationTag: '',
        animationAssetId: '',
        animationDelayMs: null,
        hasExplicitAnimation: false,
      }),
    ])
    expect(plan.beats[1].offsetRatio).toBeGreaterThan(0)
  })

  it('falls back to the final assistant text when no timeline beats are present', () => {
    const plan = buildSpeechCuePlan([], {
      fallbackText: 'Simple fallback reply.',
      fallbackEmotion: 'playful',
    })

    expect(plan.explicitAnimationCount).toBe(0)
    expect(plan.distinctEmotions).toEqual(['playful'])
    expect(plan.beats).toEqual([
      expect.objectContaining({
        emotion: 'playful',
        text: 'Simple fallback reply.',
        hasExplicitAnimation: false,
        offsetRatio: 0,
      }),
    ])
  })
})
