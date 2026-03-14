function findParagraphBoundary(text) {
  const match = /\n\s*\n/.exec(text)
  if (!match) {
    return null
  }

  return {
    contentEnd: match.index,
    boundaryEnd: match.index + match[0].length,
  }
}

export function takeSpeakableSpeechChunk(text, startIndex = 0, options = {}) {
  const source = String(text || '')
  const final = Boolean(options.final)

  if (startIndex >= source.length) {
    return null
  }

  const remaining = source.slice(startIndex)
  const leadingWhitespaceLength = remaining.match(/^\s*/)?.[0]?.length || 0
  const contentStart = startIndex + leadingWhitespaceLength

  if (contentStart >= source.length) {
    return null
  }

  const content = source.slice(contentStart)
  const paragraphBoundary = findParagraphBoundary(content)

  if (paragraphBoundary) {
    const chunk = content.slice(0, paragraphBoundary.contentEnd).trim()
    if (!chunk) {
      return null
    }

    return {
      chunk,
      nextIndex: contentStart + paragraphBoundary.boundaryEnd,
    }
  }

  if (!final) {
    return null
  }

  const chunk = content.trim()

  return chunk
    ? {
      chunk,
      nextIndex: source.length,
    }
    : null
}

export const SPEECH_MOTION_INJECTION_MIN_MS = 3800
export const SPEECH_MOTION_INJECTION_MAX_MS = 7600

function countWords(text) {
  const matches = String(text || '').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)
  return matches?.length || 0
}

export function sampleSpeechMotionDelay(randomValue = Math.random()) {
  const normalized = Number.isFinite(randomValue)
    ? Math.min(1, Math.max(0, randomValue))
    : Math.random()

  return Math.round(
    SPEECH_MOTION_INJECTION_MIN_MS +
      normalized * (SPEECH_MOTION_INJECTION_MAX_MS - SPEECH_MOTION_INJECTION_MIN_MS),
  )
}

export function buildSpeechCuePlan(timeline = [], options = {}) {
  const fallbackText = String(options.fallbackText || '')
  const fallbackEmotion = String(options.fallbackEmotion || 'neutral').trim().toLowerCase() || 'neutral'
  const entries = Array.isArray(timeline) ? timeline : []
  const beats = []
  const distinctEmotions = new Set()
  let currentEmotion = fallbackEmotion
  let currentEmotionAssetId = ''
  let pendingAnimationTag = ''
  let pendingAnimationAssetId = ''
  let pendingAnimationDelayMs = null

  for (const entry of entries) {
    const type = String(entry?.type || '').trim().toLowerCase()

    if (type === 'emotion') {
      currentEmotion = String(entry?.value || '').trim().toLowerCase() || currentEmotion
      currentEmotionAssetId = String(entry?.assetId || '').trim()
      distinctEmotions.add(currentEmotion)
      continue
    }

    if (type === 'animation') {
      pendingAnimationTag = String(entry?.value || '').trim()
      pendingAnimationAssetId = String(entry?.assetId || '').trim()
      pendingAnimationDelayMs = Number.isFinite(Number(entry?.delayMs)) ? Math.max(0, Number(entry.delayMs)) : null
      continue
    }

    if (type !== 'text') {
      continue
    }

    const text = String(entry?.value || '')
    const wordCount = countWords(text)
    if (wordCount === 0) {
      continue
    }

    distinctEmotions.add(currentEmotion)
    beats.push({
      text,
      wordCount,
      emotion: currentEmotion,
      emotionAssetId: currentEmotionAssetId,
      animationTag: pendingAnimationTag,
      animationAssetId: pendingAnimationAssetId,
      animationDelayMs: pendingAnimationDelayMs,
      hasExplicitAnimation: Boolean(pendingAnimationTag || pendingAnimationAssetId),
    })

    pendingAnimationTag = ''
    pendingAnimationAssetId = ''
    pendingAnimationDelayMs = null
  }

  if (beats.length === 0 && fallbackText.trim()) {
    const fallbackWordCount = countWords(fallbackText) || 1
    distinctEmotions.add(fallbackEmotion)
    beats.push({
      text: fallbackText,
      wordCount: fallbackWordCount,
      emotion: fallbackEmotion,
      emotionAssetId: '',
      animationTag: '',
      animationAssetId: '',
      animationDelayMs: null,
      hasExplicitAnimation: false,
    })
  }

  const totalWords = beats.reduce((sum, beat) => sum + beat.wordCount, 0)
  let consumedWords = 0

  return {
    fullText: fallbackText,
    totalWords,
    explicitAnimationCount: beats.filter((beat) => beat.hasExplicitAnimation).length,
    distinctEmotions: Array.from(distinctEmotions),
    beats: beats.map((beat, index) => {
      const offsetRatio = totalWords > 0 ? consumedWords / totalWords : 0
      consumedWords += beat.wordCount

      return {
        ...beat,
        index,
        offsetRatio,
      }
    }),
  }
}
