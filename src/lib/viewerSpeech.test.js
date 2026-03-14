import { describe, expect, it } from 'vitest'
import { takeSpeakableSpeechChunk } from './viewerSpeech.js'

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
