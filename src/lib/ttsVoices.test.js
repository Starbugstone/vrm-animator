import { describe, expect, it } from 'vitest'
import {
  filterVoicesForAvatar,
  getEffectiveVoiceGender,
  hasRemoteTtsConfiguration,
  normalizeGenderTag,
} from './ttsVoices.js'

describe('ttsVoices', () => {
  it('prefers the explicit voice gender override over the avatar sex', () => {
    expect(getEffectiveVoiceGender({
      presentationGender: 'female',
      speechVoiceGender: 'male',
    })).toBe('male')
  })

  it('falls back to the avatar sex when no voice override is set', () => {
    expect(getEffectiveVoiceGender({
      presentationGender: 'female',
      speechVoiceGender: '',
    })).toBe('female')
  })

  it('filters voices by the effective avatar gender but keeps untagged voices available', () => {
    const voices = [
      { id: '1', name: 'Ava', gender: 'female' },
      { id: '2', name: 'Adam', gender: 'male' },
      { id: '3', name: 'Mystery', gender: '' },
    ]

    expect(filterVoicesForAvatar(voices, {
      presentationGender: 'female',
      speechVoiceGender: '',
    }).map((voice) => voice.id)).toEqual(['1', '3'])
  })

  it('detects when an avatar has a remote TTS configuration', () => {
    expect(hasRemoteTtsConfiguration({ ttsCredentialId: 12, ttsVoiceId: 'voice_1' })).toBe(true)
    expect(hasRemoteTtsConfiguration({ ttsCredentialId: 12, ttsVoiceId: '' })).toBe(false)
  })

  it('normalizes only known gender tags', () => {
    expect(normalizeGenderTag(' Female ')).toBe('female')
    expect(normalizeGenderTag('other')).toBe('')
  })
})
