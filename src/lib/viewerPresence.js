const THINKING_MOVEMENT_HINTS = [
  'thinking',
  'think',
  'thoughtful',
  'ponder',
  'pondering',
  'curious',
  'waiting',
  'idlethink',
]

const SPEAKING_MOVEMENT_HINTS = [
  'speech',
  'talk',
  'body',
  'gesture',
  'casual',
  'conversation',
  'friendly',
  'warm',
]

const MOVEMENT_EMOTION_GROUPS = {
  neutral: 'steady',
  calm: 'steady',
  thinking: 'steady',
  confident: 'steady',
  curious: 'steady',
  reflective: 'steady',
  grounded: 'steady',
  steady: 'steady',
  happy: 'positive',
  playful: 'positive',
  smile: 'positive',
  wink: 'positive',
  joyful: 'positive',
  positive: 'positive',
  friendly: 'positive',
  warm: 'positive',
  affectionate: 'positive',
  flirty: 'positive',
  cheeky: 'positive',
  teasing: 'positive',
  celebrate: 'positive',
  excited: 'energetic',
  shouting: 'energetic',
  emphatic: 'energetic',
  loud: 'energetic',
  surprised: 'surprised',
  startled: 'surprised',
  shocked: 'surprised',
  sad: 'negative',
  melancholy: 'negative',
  downcast: 'negative',
  angry: 'negative',
  frustrated: 'negative',
  irritated: 'negative',
  uneasy: 'negative',
  concerned: 'negative',
  overwhelmed: 'negative',
  sleepy: 'sleepy',
  tired: 'sleepy',
  lowenergy: 'sleepy',
  yawn: 'sleepy',
}

const COMPATIBLE_EMOTION_GROUPS = {
  steady: new Set(['steady', 'positive', 'surprised']),
  positive: new Set(['positive', 'steady', 'surprised']),
  energetic: new Set(['energetic', 'positive', 'surprised']),
  surprised: new Set(['surprised', 'positive', 'energetic', 'steady']),
  negative: new Set(['negative', 'steady']),
  sleepy: new Set(['sleepy', 'steady']),
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function collectNormalizedCandidates(item) {
  const rawCandidates = [
    item?.label,
    item?.name,
    item?.description,
    ...(Array.isArray(item?.keywords) ? item.keywords : []),
    ...(Array.isArray(item?.emotionTags) ? item.emotionTags : []),
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ]

  return rawCandidates
    .map(normalizeToken)
    .filter(Boolean)
}

function hasHintMatch(candidates, hints) {
  return hints.some((hint) => {
    const normalizedHint = normalizeToken(hint)
    return candidates.some((candidate) => candidate.includes(normalizedHint))
  })
}

function normalizeEmotionGroup(value) {
  const normalized = normalizeToken(value)
  return MOVEMENT_EMOTION_GROUPS[normalized] || null
}

function collectAssetEmotionGroups(item) {
  const rawCandidates = [
    ...(Array.isArray(item?.emotionTags) ? item.emotionTags : []),
    ...(Array.isArray(item?.tags) ? item.tags : []),
    ...(Array.isArray(item?.keywords) ? item.keywords : []),
  ]

  return Array.from(new Set(
    rawCandidates
      .map(normalizeEmotionGroup)
      .filter(Boolean),
  ))
}

function areEmotionGroupsCompatible(activeGroup, candidateGroup) {
  if (!activeGroup || !candidateGroup) {
    return true
  }

  return COMPATIBLE_EMOTION_GROUPS[activeGroup]?.has(candidateGroup) ?? activeGroup === candidateGroup
}

export function findThinkingMovementAsset(items) {
  const ranked = (items || [])
    .map((item) => {
      const normalizedCandidates = collectNormalizedCandidates(item)
      let score = 0

      for (const hint of THINKING_MOVEMENT_HINTS) {
        const normalizedHint = normalizeToken(hint)
        if (normalizedCandidates.some((candidate) => candidate.includes(normalizedHint))) {
          score += 12
        }
      }

      if (item?.kind === 'thinking') {
        score += 18
      } else if (item?.kind === 'action') {
        score += 3
      } else if (item?.kind === 'idle') {
        score += 1
      }

      if (Number.isFinite(Number(item?.weight))) {
        score += Number(item.weight) * 0.1
      }

      return {
        item,
        score,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  return ranked[0]?.item || null
}

export function isSpeechMovementAssetAllowed(item, emotion, options = {}) {
  if (!item) {
    return false
  }

  const allowIdle = Boolean(options.allowIdle)
  if (!allowIdle && item.kind === 'idle') {
    return false
  }

  const activeGroup = normalizeEmotionGroup(emotion)
  const candidateGroups = collectAssetEmotionGroups(item)

  if (candidateGroups.length === 0 || !activeGroup) {
    return true
  }

  return candidateGroups.some((candidateGroup) => areEmotionGroupsCompatible(activeGroup, candidateGroup))
}

export function pickSpeechMovementAsset(items, emotion, options = {}) {
  const normalizedEmotion = normalizeToken(emotion)
  const normalizedLastAssetId = String(options.lastAssetId || '').trim()
  const recentAssetIds = new Set(
    (Array.isArray(options.recentAssetIds) ? options.recentAssetIds : [])
      .map((assetId) => String(assetId || '').trim())
      .filter(Boolean),
  )
  const ranked = (items || [])
    .filter((item) => item?.kind !== 'thinking')
    .filter((item) => isSpeechMovementAssetAllowed(item, emotion, options))
    .map((item) => {
      const normalizedCandidates = collectNormalizedCandidates(item)
      let score = 0

      if (normalizedEmotion) {
        if (normalizedCandidates.some((candidate) => candidate === normalizedEmotion)) {
          score += 18
        } else if (
          normalizedCandidates.some(
            (candidate) => candidate.includes(normalizedEmotion) || normalizedEmotion.includes(candidate),
          )
        ) {
          score += 8
        }
      }

      if (item?.kind === 'action') {
        score += 10
      } else if (item?.kind === 'idle') {
        score += 4
      }

      if (hasHintMatch(normalizedCandidates, SPEAKING_MOVEMENT_HINTS)) {
        score += 6
      }

      if (Number.isFinite(Number(item?.weight))) {
        score += Number(item.weight) * 0.2
      }

      if (String(item?.id || '') === normalizedLastAssetId) {
        score -= 9
      }

      if (recentAssetIds.has(String(item?.id || ''))) {
        score -= 5
      }

      return {
        item,
        score,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  if (ranked.length === 0) {
    return null
  }

  const topScore = ranked[0].score
  const nearTop = ranked.filter((entry) => entry.score >= Math.max(1, topScore - 3))
  const withoutImmediateRepeat = normalizedLastAssetId
    ? nearTop.filter((entry) => String(entry.item?.id || '') !== normalizedLastAssetId)
    : nearTop
  const pool = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : nearTop

  return pool[0]?.item || null
}
