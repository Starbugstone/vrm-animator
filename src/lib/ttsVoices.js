function normalizeComparableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeDisplayText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))]
}

function sortDisplayValues(values) {
  return [...values].sort((left, right) => (
    normalizeComparableText(left).localeCompare(normalizeComparableText(right)) || String(left).localeCompare(String(right))
  ))
}

const LANGUAGE_NAME_TO_CODE = {
  english: 'en',
  anglais: 'en',
  french: 'fr',
  francais: 'fr',
  frenchfrance: 'fr',
  spanish: 'es',
  espanol: 'es',
  castilian: 'es',
  german: 'de',
  allemand: 'de',
  italian: 'it',
  italien: 'it',
}

function normalizeLocaleTag(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  const segments = normalized.split('-').filter(Boolean)
  if (segments.length === 0) {
    return ''
  }

  if (segments.length === 1) {
    return segments[0].toLowerCase()
  }

  return `${segments[0].toLowerCase()}-${segments.slice(1).join('-').toUpperCase()}`
}

function normalizeLanguageCode(value) {
  const normalizedName = normalizeComparableText(value).replace(/[^a-z]/g, '')
  if (normalizedName && LANGUAGE_NAME_TO_CODE[normalizedName]) {
    return LANGUAGE_NAME_TO_CODE[normalizedName]
  }

  const normalized = normalizeLocaleTag(value)
  if (!normalized || normalized === 'auto') {
    return ''
  }

  return normalized.split('-')[0]
}

function getVoiceVerifiedLanguages(voice) {
  return Array.isArray(voice?.verifiedLanguages) ? voice.verifiedLanguages : []
}

export function normalizeGenderTag(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'female' || normalized === 'male' ? normalized : ''
}

export function getEffectiveVoiceGender(avatar) {
  return normalizeGenderTag(avatar?.speechVoiceGender) || normalizeGenderTag(avatar?.presentationGender) || ''
}

export function getSpeechPlaybackMode(avatar) {
  const normalized = String(avatar?.speechMode || '').trim().toLowerCase()
  return normalized === 'none' ? 'none' : 'auto'
}

export function isSpeechPlaybackDisabled(avatar) {
  return getSpeechPlaybackMode(avatar) === 'none'
}

export function hasRemoteTtsConfiguration(avatar) {
  return Boolean(avatar?.ttsCredentialId && avatar?.ttsVoiceId)
}

export function getEffectiveSpeechLanguage(avatar) {
  const normalized = normalizeLocaleTag(avatar?.speechLanguage)
  return normalized && normalized !== 'auto' ? normalized : ''
}

export function getVoiceLocales(voice) {
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {}

  return uniqueStrings([
    normalizeLocaleTag(voice?.locale),
    normalizeLocaleTag(labels.locale),
    ...getVoiceVerifiedLanguages(voice).map((entry) => normalizeLocaleTag(entry?.locale)),
  ])
}

export function getVoiceLanguages(voice) {
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {}
  const locales = getVoiceLocales(voice)

  return uniqueStrings([
    normalizeLanguageCode(voice?.language),
    normalizeLanguageCode(labels.language),
    ...locales.map((locale) => normalizeLanguageCode(locale)),
    ...getVoiceVerifiedLanguages(voice).map((entry) => normalizeLanguageCode(entry?.language)),
  ])
}

export function voiceHasLanguageMetadata(voice) {
  return getVoiceLocales(voice).length > 0 || getVoiceLanguages(voice).length > 0
}

export function voiceMatchesLanguage(voice, speechLanguage) {
  const preferredLocale = normalizeLocaleTag(speechLanguage)
  if (!preferredLocale || preferredLocale === 'auto') {
    return false
  }

  const preferredLanguage = normalizeLanguageCode(preferredLocale)
  const locales = getVoiceLocales(voice)
  const languages = getVoiceLanguages(voice)

  return locales.includes(preferredLocale) || languages.includes(preferredLanguage)
}

export function getVoicePrimaryLocale(voice) {
  return getVoiceLocales(voice)[0] || getVoiceLanguages(voice)[0] || ''
}

export function getVoiceTagSummary(voice) {
  const values = uniqueStrings([
    getVoicePrimaryLocale(voice),
    ...getVoiceFacetValues(voice, 'accent'),
    ...getVoiceFacetValues(voice, 'age'),
    ...getVoiceFacetValues(voice, 'useCase'),
    ...getVoiceFacetValues(voice, 'category'),
  ])

  return values
}

export function getVoiceFacetValues(voice, facet) {
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {}

  if (facet === 'category') {
    return uniqueStrings([
      normalizeDisplayText(voice?.category),
    ])
  }

  if (facet === 'useCase') {
    return uniqueStrings([
      normalizeDisplayText(labels.use_case),
    ])
  }

  if (facet === 'accent') {
    return uniqueStrings([
      normalizeDisplayText(labels.accent),
      ...getVoiceVerifiedLanguages(voice).map((entry) => normalizeDisplayText(entry?.accent)),
    ])
  }

  if (facet === 'age') {
    return uniqueStrings([
      normalizeDisplayText(labels.age),
    ])
  }

  return []
}

export function buildVoiceFacetOptions(voices) {
  const items = Array.isArray(voices) ? voices : []

  return {
    categories: sortDisplayValues(uniqueStrings(items.flatMap((voice) => getVoiceFacetValues(voice, 'category')))),
    useCases: sortDisplayValues(uniqueStrings(items.flatMap((voice) => getVoiceFacetValues(voice, 'useCase')))),
    accents: sortDisplayValues(uniqueStrings(items.flatMap((voice) => getVoiceFacetValues(voice, 'accent')))),
    ages: sortDisplayValues(uniqueStrings(items.flatMap((voice) => getVoiceFacetValues(voice, 'age')))),
  }
}

export function voiceMatchesFacetFilters(voice, filters = {}) {
  const entries = [
    ['category', filters.category],
    ['useCase', filters.useCase],
    ['accent', filters.accent],
    ['age', filters.age],
  ]

  return entries.every(([facet, value]) => {
    const expected = normalizeComparableText(value)
    if (!expected) {
      return true
    }

    return getVoiceFacetValues(voice, facet).some((candidate) => normalizeComparableText(candidate) === expected)
  })
}

export function filterVoicesForAvatar(voices, avatar, options = {}) {
  const items = Array.isArray(voices) ? voices : []
  const effectiveGender = options.gender || getEffectiveVoiceGender(avatar)
  const includeUnknown = options.includeUnknown !== false

  let visible = items

  if (effectiveGender) {
    const preferred = visible.filter((voice) => normalizeGenderTag(voice?.gender) === effectiveGender)
    const unknown = includeUnknown
      ? visible.filter((voice) => !normalizeGenderTag(voice?.gender))
      : []

    if (preferred.length > 0) {
      visible = [...preferred, ...unknown]
    } else if (visible.some((voice) => normalizeGenderTag(voice?.gender))) {
      visible = unknown
    }
  }

  const preferredLanguage = options.language || getEffectiveSpeechLanguage(avatar)
  if (!preferredLanguage) {
    return visible
  }

  const matchingLanguage = visible.filter((voice) => voiceMatchesLanguage(voice, preferredLanguage))
  const unknownLanguage = includeUnknown
    ? visible.filter((voice) => !voiceHasLanguageMetadata(voice))
    : []

  if (matchingLanguage.length > 0) {
    return [...matchingLanguage, ...unknownLanguage]
  }

  return visible.some((voice) => voiceHasLanguageMetadata(voice)) ? unknownLanguage : visible
}

export function matchesVoiceSearch(voice, query) {
  const normalizedQuery = normalizeComparableText(query)
  if (!normalizedQuery) {
    return true
  }

  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {}
  const verifiedLanguages = getVoiceVerifiedLanguages(voice)
  const haystack = normalizeComparableText([
    voice?.name,
    voice?.description,
    voice?.category,
    voice?.gender,
    voice?.language,
    voice?.locale,
    ...Object.entries(labels).flatMap(([key, value]) => [key, value]),
    ...verifiedLanguages.flatMap((entry) => [entry?.language, entry?.locale, entry?.accent]),
  ].filter(Boolean).join(' '))

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}
