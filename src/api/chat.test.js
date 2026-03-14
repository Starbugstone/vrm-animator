import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  apiStreamRequest: vi.fn(),
}))

import { apiStreamRequest } from './client'
import { streamAvatarChatMessage } from './chat'

function createStreamResponse(chunks) {
  let index = 0

  return {
    body: {
      getReader() {
        return {
          read: async () => {
            if (index >= chunks.length) {
              return { done: true, value: undefined }
            }

            const encoder = new TextEncoder()
            return {
              done: false,
              value: encoder.encode(chunks[index++]),
            }
          },
        }
      },
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('streamAvatarChatMessage', () => {
  it('dispatches streamed events even when SSE blocks arrive across chunk boundaries', async () => {
    apiStreamRequest.mockResolvedValue(createStreamResponse([
      'event: status\ndata: {"message":"Preparing avatar context..."}\n\n',
      'event: text.delta\ndata: {"delta":"Hel',
      'lo"}\n\nevent: cue\ndata: {"cueType":"emotion","value":"happy"}\n\n',
      'event: memory\ndata: {"entry":"likes jasmine tea"}\n\n',
      'event: message.complete\ndata: {"conversation":{"id":1,"provider":"minimax","model":"MiniMax-M2.5"},"assistantMessage":{"content":"Hello"}}\n\n',
    ]))

    const onStatus = vi.fn()
    const onTextDelta = vi.fn()
    const onCue = vi.fn()
    const onMemory = vi.fn()
    const onComplete = vi.fn()

    const completion = await streamAvatarChatMessage('jwt-token', 42, { message: 'Hi' }, {
      onStatus,
      onTextDelta,
      onCue,
      onMemory,
      onComplete,
    })

    expect(onStatus).toHaveBeenCalledWith({ message: 'Preparing avatar context...' })
    expect(onTextDelta).toHaveBeenCalledWith({ delta: 'Hello' })
    expect(onCue).toHaveBeenCalledWith({ cueType: 'emotion', value: 'happy' })
    expect(onMemory).toHaveBeenCalledWith({ entry: 'likes jasmine tea' })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(completion.conversation.model).toBe('MiniMax-M2.5')
  })

  it('throws a readable error when the stream sends an error event', async () => {
    apiStreamRequest.mockResolvedValue(createStreamResponse([
      'event: error\ndata: {"message":"Provider request failed."}\n\n',
    ]))

    await expect(streamAvatarChatMessage('jwt-token', 42, { message: 'Hi' })).rejects.toThrow(
      'Provider request failed.',
    )
  })
})
