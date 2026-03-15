import { describe, expect, it } from 'vitest'
import { createAvatarPresenceState, reduceAvatarPresence } from './avatarPresenceMachine.js'

describe('avatar presence machine', () => {
  it('starts idle', () => {
    expect(createAvatarPresenceState()).toEqual({
      requestId: 0,
      mode: 'idle',
      responseVisible: false,
      responseComplete: false,
      speechActive: false,
    })
  })

  it('moves from thinking to responding to speaking for the active request', () => {
    let state = createAvatarPresenceState()

    state = reduceAvatarPresence(state, { type: 'user_message_submitted', requestId: 7 })
    expect(state.mode).toBe('thinking')

    state = reduceAvatarPresence(state, { type: 'assistant_text_visible', requestId: 7 })
    expect(state.mode).toBe('responding')

    state = reduceAvatarPresence(state, { type: 'speech_started', requestId: 7 })
    expect(state.mode).toBe('speaking')
    expect(state.speechActive).toBe(true)
  })

  it('returns to responding if speech stops before the response is fully complete', () => {
    let state = reduceAvatarPresence(createAvatarPresenceState(), {
      type: 'user_message_submitted',
      requestId: 3,
    })

    state = reduceAvatarPresence(state, { type: 'assistant_text_visible', requestId: 3 })
    state = reduceAvatarPresence(state, { type: 'speech_started', requestId: 3 })
    state = reduceAvatarPresence(state, { type: 'speech_stopped', requestId: 3 })

    expect(state.mode).toBe('responding')
    expect(state.speechActive).toBe(false)
  })

  it('returns to idle once the response is complete and speech has stopped', () => {
    let state = reduceAvatarPresence(createAvatarPresenceState(), {
      type: 'user_message_submitted',
      requestId: 5,
    })

    state = reduceAvatarPresence(state, { type: 'assistant_text_visible', requestId: 5 })
    state = reduceAvatarPresence(state, { type: 'speech_started', requestId: 5 })
    state = reduceAvatarPresence(state, { type: 'response_finished', requestId: 5 })
    expect(state.mode).toBe('speaking')

    state = reduceAvatarPresence(state, { type: 'speech_stopped', requestId: 5 })
    expect(state.mode).toBe('idle')
  })

  it('ignores stale events from an older request', () => {
    let state = reduceAvatarPresence(createAvatarPresenceState(), {
      type: 'user_message_submitted',
      requestId: 10,
    })

    state = reduceAvatarPresence(state, { type: 'assistant_text_visible', requestId: 9 })

    expect(state.mode).toBe('thinking')
    expect(state.requestId).toBe(10)
  })
})
