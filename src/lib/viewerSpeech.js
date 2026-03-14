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
