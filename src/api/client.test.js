import { describe, expect, it, vi, afterEach } from 'vitest'
import { downloadFile } from './client'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('downloadFile', () => {
  it('creates a File from an authenticated backend response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-disposition': 'attachment; filename="avatar.vrm"',
      }),
      blob: async () => new Blob(['avatar-bytes'], { type: 'application/octet-stream' }),
    })

    const file = await downloadFile('/api/avatars/1/file', 'jwt-token', 'fallback.vrm')

    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('avatar.vrm')
    expect(file.size).toBeGreaterThan(0)
  })
})
