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
