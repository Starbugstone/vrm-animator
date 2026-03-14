const CANONICAL_EMOTIONS = new Set([
  'neutral',
  'happy',
  'sad',
  'angry',
  'playful',
  'shouting',
  'sleepy',
  'surprised',
  'thinking',
  'calm',
])

function normalizeEntries(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean),
  ))
}

export function collectAssetTags(asset) {
  return normalizeEntries([
    ...(Array.isArray(asset?.emotionTags) ? asset.emotionTags : []),
    ...(Array.isArray(asset?.keywords) ? asset.keywords : []),
    ...(Array.isArray(asset?.tags) ? asset.tags : []),
  ])
}

function collectAssetChannels(asset) {
  return normalizeEntries(asset?.channels)
}

function scoreExpressionAssetForEmotion(
  asset,
  emotion,
  {
    preferSpeech = false,
    allowSpeechFallback = false,
    excludedChannels = [],
  } = {},
) {
  const tags = collectAssetTags(asset)
  const channels = collectAssetChannels(asset)
  const blockedChannels = normalizeEntries(excludedChannels)
  const hasSpeechTag = tags.includes('speech') || tags.includes('fallback')

  if (blockedChannels.some((channel) => channels.includes(channel))) {
    return 0
  }

  let score = 0

  if (tags.includes(emotion)) {
    score += 8
  }

  if (preferSpeech && hasSpeechTag) {
    score += 4
  }

  if (!preferSpeech && !hasSpeechTag) {
    score += 2
  }

  if (!preferSpeech && hasSpeechTag && !allowSpeechFallback) {
    return 0
  }

  if (asset.weight) {
    score += Number(asset.weight) * 0.2
  }

  return score
}

export function pickExpressionAsset(items, emotion, options = {}) {
  const normalizedEmotion = CANONICAL_EMOTIONS.has(emotion) ? emotion : 'neutral'
  const ranked = items
    .map((item) => ({ item, score: scoreExpressionAssetForEmotion(item, normalizedEmotion, options) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  return ranked[0]?.item || null
}

export function pickSilentExpressionAsset(items, emotions = ['thinking', 'calm', 'neutral'], options = {}) {
  for (const emotion of emotions) {
    const asset = pickExpressionAsset(items, emotion, {
      ...options,
      preferSpeech: false,
      allowSpeechFallback: false,
    })

    if (asset) {
      return asset
    }
  }

  return null
}
