import { describe, expect, it } from 'vitest'
import {
  filterVoicesForAvatar,
  getEffectiveSpeechLanguage,
  getEffectiveVoiceGender,
  getVoiceLanguages,
  hasRemoteTtsConfiguration,
  matchesVoiceSearch,
  normalizeGenderTag,
  voiceMatchesLanguage,
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

  it('normalizes the avatar speech language when it is explicitly set', () => {
    expect(getEffectiveSpeechLanguage({ speechLanguage: 'fr-fr' })).toBe('fr-FR')
    expect(getEffectiveSpeechLanguage({ speechLanguage: 'auto' })).toBe('')
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

  it('filters voices by language when the voice catalog exposes locale metadata', () => {
    const voices = [
      { id: '1', name: 'Claire', language: 'fr', locale: 'fr-FR' },
      { id: '2', name: 'Adam', language: 'en', locale: 'en-US' },
      { id: '3', name: 'Mystery' },
    ]

    expect(filterVoicesForAvatar(voices, {
      speechLanguage: 'fr-FR',
    }).map((voice) => voice.id)).toEqual(['1', '3'])
  })

  it('matches languages from verified language metadata as well as top-level locale fields', () => {
    const voice = {
      id: '1',
      name: 'Polyglot',
      verifiedLanguages: [
        { language: 'fr', locale: 'fr-FR', accent: 'parisian' },
      ],
    }

    expect(voiceMatchesLanguage(voice, 'fr-FR')).toBe(true)
    expect(getVoiceLanguages(voice)).toEqual(['fr'])
  })

  it('searches across voice names and tags', () => {
    const voice = {
      id: '1',
      name: 'Julien',
      labels: {
        accent: 'Parisian',
        use_case: 'narration',
      },
      verifiedLanguages: [
        { language: 'fr', locale: 'fr-FR' },
      ],
    }

    expect(matchesVoiceSearch(voice, 'julien parisian')).toBe(true)
    expect(matchesVoiceSearch(voice, 'narration fr')).toBe(true)
    expect(matchesVoiceSearch(voice, 'german')).toBe(false)
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
