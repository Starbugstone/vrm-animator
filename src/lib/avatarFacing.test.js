import { describe, expect, it } from 'vitest'
import { deriveSavedFacingYawDegrees, normalizeFacingYawDegrees } from './avatarFacing.js'

describe('normalizeFacingYawDegrees', () => {
  it('wraps values into the supported range', () => {
    expect(normalizeFacingYawDegrees(540)).toBe(180)
    expect(normalizeFacingYawDegrees(270)).toBe(-90)
    expect(normalizeFacingYawDegrees(-540)).toBe(180)
  })

  it('falls back to zero for invalid values', () => {
    expect(normalizeFacingYawDegrees('bad')).toBe(0)
  })
})

describe('deriveSavedFacingYawDegrees', () => {
  it('turns the current preview angle into a saved avatar yaw', () => {
    expect(deriveSavedFacingYawDegrees(180, 180)).toBe(0)
    expect(deriveSavedFacingYawDegrees(90, 90)).toBe(0)
    expect(deriveSavedFacingYawDegrees(0, -90)).toBe(90)
  })
})
