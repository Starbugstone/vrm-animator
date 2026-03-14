export function normalizeGenderTag(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'female' || normalized === 'male' ? normalized : ''
}

export function getEffectiveVoiceGender(avatar) {
  return normalizeGenderTag(avatar?.speechVoiceGender) || normalizeGenderTag(avatar?.presentationGender) || ''
}

export function hasRemoteTtsConfiguration(avatar) {
  return Boolean(avatar?.ttsCredentialId && avatar?.ttsVoiceId)
}

export function filterVoicesForAvatar(voices, avatar, options = {}) {
  const effectiveGender = options.gender || getEffectiveVoiceGender(avatar)
  const includeUnknown = options.includeUnknown !== false

  if (!effectiveGender) {
    return Array.isArray(voices) ? voices : []
  }

  const items = Array.isArray(voices) ? voices : []
  const preferred = items.filter((voice) => normalizeGenderTag(voice?.gender) === effectiveGender)
  const unknown = includeUnknown
    ? items.filter((voice) => !normalizeGenderTag(voice?.gender))
    : []

  return preferred.length > 0 ? [...preferred, ...unknown] : items
}
