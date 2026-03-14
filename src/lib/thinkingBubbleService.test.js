import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  THINKING_CLOUD_DEPTH,
  computeThinkingBubbleAnchor,
  computeThinkingBubbleState,
} from './thinkingBubbleService.js'

describe('computeThinkingBubbleState', () => {
  it('starts with the first trail bubble before the cloud appears', () => {
    const state = computeThinkingBubbleState(0.08)

    expect(state.trail[0]).toBeGreaterThan(0)
    expect(state.trail[1]).toBe(0)
    expect(state.cloud).toBe(0)
  })

  it('reveals the cloud and animated dots mid-cycle', () => {
    const state = computeThinkingBubbleState(0.62)

    expect(state.cloud).toBeGreaterThan(0.8)
    expect(state.dots.some((value) => value > 0.4)).toBe(true)
  })

  it('fades back out near the end of the loop', () => {
    const state = computeThinkingBubbleState(0.93)

    expect(state.cloud).toBeLessThan(0.2)
    expect(state.trail[2]).toBeLessThan(0.4)
  })
})

describe('computeThinkingBubbleAnchor', () => {
  it('anchors the bubble in head-relative world space without any camera input', () => {
    const headPosition = new THREE.Vector3(1, 2, 3)
    const headQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))

    const anchor = computeThinkingBubbleAnchor(headPosition, headQuaternion, 0.05)

    expect(anchor.position.x).toBeCloseTo(1.14, 4)
    expect(anchor.position.y).toBeCloseTo(2.45, 4)
    expect(anchor.position.z).toBeCloseTo(2.58, 4)
    expect(anchor.quaternion.length()).toBeCloseTo(1, 4)
  })

  it('keeps a thick cloud body for hologram rendering from multiple angles', () => {
    expect(THINKING_CLOUD_DEPTH).toBeGreaterThan(0.12)
  })
})
