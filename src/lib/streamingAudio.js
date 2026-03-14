function createAbortError() {
  return new DOMException('Playback aborted.', 'AbortError')
}

function ensureAudioElement(audio) {
  if (!audio) {
    throw new Error('Audio playback is not available in this browser.')
  }
}

function waitForEvent(target, type) {
  return new Promise((resolve) => {
    target.addEventListener(type, resolve, { once: true })
  })
}

function canUseMediaSourceAudio(mimeType) {
  if (typeof window === 'undefined' || typeof window.MediaSource === 'undefined') {
    return false
  }

  return window.MediaSource.isTypeSupported?.(mimeType) === true
}

function revokeObjectUrl(url) {
  if (typeof URL !== 'undefined' && url) {
    URL.revokeObjectURL(url)
  }
}

export async function playStreamedAudioResponse(response, audio, options = {}) {
  ensureAudioElement(audio)

  const mimeType = (response.headers.get('content-type') || 'audio/mpeg').split(';')[0].trim() || 'audio/mpeg'
  if (!response.body) {
    throw new Error('Streaming audio is not available in this browser.')
  }

  if (canUseMediaSourceAudio(mimeType)) {
    return playWithMediaSource(response, audio, mimeType, options)
  }

  return playWithBlob(response, audio, options)
}

async function playWithBlob(response, audio, options) {
  const { signal, onStart, onEnd } = options
  if (signal?.aborted) {
    throw createAbortError()
  }

  const blob = await response.blob()
  if (signal?.aborted) {
    throw createAbortError()
  }

  const objectUrl = URL.createObjectURL(blob)
  const cleanup = () => {
    audio.pause()
    audio.removeAttribute('src')
    audio.load?.()
    revokeObjectUrl(objectUrl)
  }

  if (signal) {
    signal.addEventListener('abort', cleanup, { once: true })
  }

  audio.src = objectUrl
  await audio.play()
  onStart?.()
  await waitForEvent(audio, 'ended')
  onEnd?.()
  cleanup()
}

async function playWithMediaSource(response, audio, mimeType, options) {
  const { signal, onStart, onEnd } = options
  if (signal?.aborted) {
    throw createAbortError()
  }

  const mediaSource = new window.MediaSource()
  const objectUrl = URL.createObjectURL(mediaSource)
  const reader = response.body.getReader()
  const queue = []
  let sourceBuffer = null
  let started = false
  let finishedReading = false

  const cleanup = () => {
    reader.cancel().catch(() => {})
    audio.pause()
    audio.removeAttribute('src')
    audio.load?.()
    revokeObjectUrl(objectUrl)
  }

  if (signal) {
    signal.addEventListener('abort', cleanup, { once: true })
  }

  const maybeAppendNext = () => {
    if (!sourceBuffer || sourceBuffer.updating) {
      return
    }

    const nextChunk = queue.shift()
    if (nextChunk) {
      sourceBuffer.appendBuffer(nextChunk)
      return
    }

    if (finishedReading && mediaSource.readyState === 'open') {
      mediaSource.endOfStream()
    }
  }

  mediaSource.addEventListener('sourceopen', () => {
    sourceBuffer = mediaSource.addSourceBuffer(mimeType)
    sourceBuffer.mode = 'sequence'
    sourceBuffer.addEventListener('updateend', maybeAppendNext)
    maybeAppendNext()
  }, { once: true })

  audio.src = objectUrl

  while (true) {
    if (signal?.aborted) {
      throw createAbortError()
    }

    const { done, value } = await reader.read()
    if (done) {
      finishedReading = true
      maybeAppendNext()
      break
    }

    if (value?.byteLength) {
      queue.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
      maybeAppendNext()

      if (!started) {
        await audio.play()
        onStart?.()
        started = true
      }
    }
  }

  if (!started) {
    await audio.play()
    onStart?.()
  }

  await waitForEvent(audio, 'ended')
  onEnd?.()
  cleanup()
}
