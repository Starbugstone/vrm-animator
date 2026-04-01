import { describe, expect, it } from 'vitest'
import {
  buildPrimaryWorkspaceUrl,
  buildHologramFullscreenWindowSize,
  buildHologramProjectionUrl,
  buildHologramWindowFeatures,
  isHologramProjectionView,
} from './hologramProjection.js'

describe('hologramProjection', () => {
  it('detects the hologram route from the query string', () => {
    expect(isHologramProjectionView('?view=hologram')).toBe(true)
    expect(isHologramProjectionView('?view=viewer')).toBe(false)
    expect(isHologramProjectionView('')).toBe(false)
  })

  it('builds a projection url that preserves the current origin', () => {
    const url = buildHologramProjectionUrl({
      href: 'http://localhost:5173/?page=viewer',
    })

    expect(url).toBe('http://localhost:5173/?page=viewer&view=hologram')
  })

  it('builds a workspace url by removing the hologram view flag', () => {
    const url = buildPrimaryWorkspaceUrl({
      href: 'http://localhost:5173/?page=viewer&view=hologram',
    })

    expect(url).toBe('http://localhost:5173/?page=viewer')
  })

  it('builds popup window features with the requested size', () => {
    expect(buildHologramWindowFeatures({ width: 1400, height: 900 })).toContain('width=1400')
    expect(buildHologramWindowFeatures({ width: 1400, height: 900 })).toContain('height=900')
  })

  it('builds a fullscreen-sized popup preset from the available screen area', () => {
    expect(buildHologramFullscreenWindowSize({
      availWidth: 1920,
      availHeight: 1032,
      availLeft: 0,
      availTop: 0,
    })).toEqual({
      width: 1920,
      height: 1032,
      left: 0,
      top: 0,
    })
  })
})
